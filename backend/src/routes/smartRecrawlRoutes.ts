/**
 * Smart Recrawl Routes
 *
 * GET  /api/smart-recrawl/status   — stats (total, due, totalChanges)
 * GET  /api/smart-recrawl/list     — list all watched URLs
 * POST /api/smart-recrawl/add      — add URL(s) to watchlist
 * DELETE /api/smart-recrawl/remove — remove URL from watchlist
 * POST /api/smart-recrawl/check    — force-check specific URL(s) now
 * POST /api/smart-recrawl/run      — run all due checks now
 */

import { Router, Request, Response } from 'express'
import { smartRecrawl }               from '../services/SmartRecrawlService.js'

const router = Router()

// GET /api/smart-recrawl/status
router.get('/status', (_req: Request, res: Response) => {
  res.json(smartRecrawl.getStats())
})

// GET /api/smart-recrawl/list
router.get('/list', (_req: Request, res: Response) => {
  const entries = smartRecrawl.listAll()
  res.json({ entries, total: entries.length })
})

// POST /api/smart-recrawl/add
// Body: { urls: string[] | string, intervalMs?: number }
router.post('/add', (req: Request, res: Response) => {
  const { urls, intervalMs } = req.body as { urls?: string | string[]; intervalMs?: number }
  if (!urls) return res.status(400).json({ error: 'urls is required' })

  const list = Array.isArray(urls) ? urls : [urls]
  smartRecrawl.addUrls(list, intervalMs)
  res.json({ added: list.length, message: `${list.length} URL(s) added to smart recrawl watchlist` })
})

// DELETE /api/smart-recrawl/remove
// Body: { url: string }
router.delete('/remove', (req: Request, res: Response) => {
  const { url } = req.body as { url?: string }
  if (!url) return res.status(400).json({ error: 'url is required' })
  smartRecrawl.removeUrl(url)
  res.json({ removed: true, url })
})

// POST /api/smart-recrawl/check
// Body: { url: string } or { urls: string[] }
router.post('/check', async (req: Request, res: Response) => {
  const { url, urls } = req.body as { url?: string; urls?: string[] }
  const list = urls ?? (url ? [url] : null)
  if (!list) return res.status(400).json({ error: 'url or urls is required' })

  const results = await Promise.all(list.map(u => smartRecrawl.forceCheck(u)))
  res.json({ results })
})

// POST /api/smart-recrawl/run — run all due checks immediately
router.post('/run', async (_req: Request, res: Response) => {
  const results = await smartRecrawl.checkDue()
  const changed = results.filter(r => r.changed)
  res.json({
    checked: results.length,
    changed: changed.length,
    changedUrls: changed.map(r => r.url),
  })
})

export default router
