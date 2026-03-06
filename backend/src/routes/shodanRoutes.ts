/**
 * Shodan Discovery Routes
 *
 * GET  /api/shodan/status           — check if Shodan API key is configured
 * POST /api/shodan/discover         — run full Xtream panel discovery
 * GET  /api/shodan/panels           — list known discovered panels
 * POST /api/shodan/validate         — validate a specific IP:port as Xtream panel
 * POST /api/shodan/search           — run custom Shodan query
 */

import { Router, Request, Response } from 'express'
import { shodanService }              from '../services/ShodanService.js'

const router = Router()

// GET /api/shodan/status
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    configured: shodanService.isConfigured(),
    knownPanels: shodanService.getKnownPanels().length,
    message: shodanService.isConfigured()
      ? 'Shodan API key configured'
      : 'Set SHODAN_API_KEY env var (free key at account.shodan.io)',
  })
})

// POST /api/shodan/discover — kick off full discovery scan
router.post('/discover', async (_req: Request, res: Response) => {
  if (!shodanService.isConfigured()) {
    return res.status(503).json({ error: 'SHODAN_API_KEY not configured' })
  }

  // Run async; stream progress via response header
  res.setHeader('Content-Type', 'application/json')

  try {
    const result = await shodanService.discoverXtreamPanels()
    res.json(result)
  } catch (err: any) {
    res.status(502).json({ error: err.message })
  }
})

// GET /api/shodan/panels
router.get('/panels', (_req: Request, res: Response) => {
  res.json({
    panels: shodanService.getKnownPanels(),
    total:  shodanService.getKnownPanels().length,
  })
})

// POST /api/shodan/validate — body: { ip, port }
router.post('/validate', async (req: Request, res: Response) => {
  const { ip, port } = req.body as { ip?: string; port?: number }
  if (!ip || !port) return res.status(400).json({ error: 'ip and port are required' })

  const panel = await shodanService.validatePanel(ip, port)
  res.json({ valid: Boolean(panel), panel })
})

// POST /api/shodan/search — body: { query, limit? }
router.post('/search', async (req: Request, res: Response) => {
  if (!shodanService.isConfigured()) {
    return res.status(503).json({ error: 'SHODAN_API_KEY not configured' })
  }
  const { query, limit } = req.body as { query?: string; limit?: number }
  if (!query) return res.status(400).json({ error: 'query is required' })

  try {
    const hosts = await shodanService.shodanSearch(query, limit ?? 100)
    res.json({ hosts, total: hosts.length })
  } catch (err: any) {
    res.status(502).json({ error: err.message })
  }
})

export default router
