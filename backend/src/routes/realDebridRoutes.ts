/**
 * Real-Debrid Routes
 *
 * GET  /api/realdebrid/status        Check connection & return user info
 * POST /api/realdebrid/configure     Set / update API key
 * POST /api/realdebrid/unrestrict    Unrestrict a direct hoster link
 * POST /api/realdebrid/resolve       Resolve magnet → stream URL (with polling)
 * GET  /api/realdebrid/torrents      List active RD torrents
 */

import { Router, Request, Response } from 'express'
import { apiProviderService } from '../services/ApiProviderService.js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const router = Router()

// ── Status ────────────────────────────────────────────────────────────────────

router.get('/status', async (_req: Request, res: Response) => {
  const provider = apiProviderService.getProvider('api.real-debrid.com')
  const configured = !!(provider?.apiKey)

  if (!configured) {
    return res.json({ connected: false, configured: false })
  }

  const user = await apiProviderService.getRealDebridUser()
  if (!user) {
    return res.json({ connected: false, configured: true, error: 'API key invalid or RD unreachable' })
  }

  res.json({ connected: true, configured: true, user })
})

// ── Configure API key ─────────────────────────────────────────────────────────

router.post('/configure', async (req: Request, res: Response) => {
  const { apiKey } = req.body as { apiKey?: string }
  if (!apiKey?.trim()) {
    return res.status(400).json({ error: 'apiKey is required' })
  }

  // Set in-memory
  apiProviderService.setApiKey('api.real-debrid.com', apiKey.trim())

  // Persist to .env file
  try {
    const envPath = path.join(__dirname, '..', '..', '.env')
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8')
      if (/^REAL_DEBRID_API_KEY=/m.test(content)) {
        content = content.replace(/^REAL_DEBRID_API_KEY=.*/m, `REAL_DEBRID_API_KEY=${apiKey.trim()}`)
      } else {
        content += `\nREAL_DEBRID_API_KEY=${apiKey.trim()}\n`
      }
      fs.writeFileSync(envPath, content, 'utf8')
    }
  } catch (err) {
    console.warn('[RealDebrid] Could not persist key to .env:', err)
  }

  // Verify the new key
  const user = await apiProviderService.getRealDebridUser()
  if (!user) {
    return res.status(422).json({ error: 'Key saved but RD returned an error — check the key is valid' })
  }

  res.json({ success: true, user })
})

// ── Unrestrict a direct hoster link ──────────────────────────────────────────

router.post('/unrestrict', async (req: Request, res: Response) => {
  const { link } = req.body as { link?: string }
  if (!link) return res.status(400).json({ error: 'link is required' })

  const result = await apiProviderService.unrestrictLink(link)
  if (!result) return res.status(422).json({ error: 'Could not unrestrict link — RD rejected it (unsupported host, invalid link, or account issue). Check backend logs for detail.' })

  res.json(result)
})

// ── Resolve magnet → stream (with polling) ────────────────────────────────────

router.post('/resolve', async (req: Request, res: Response) => {
  const { magnet } = req.body as { magnet?: string }
  if (!magnet) return res.status(400).json({ error: 'magnet is required' })

  const provider = apiProviderService.getProvider('api.real-debrid.com')
  if (!provider?.apiKey) {
    return res.status(503).json({ error: 'Real-Debrid not configured — set your API key first' })
  }

  const result = await apiProviderService.resolveDebridStream(magnet)
  if (!result) {
    return res.status(422).json({ error: 'Could not resolve magnet — torrent may not be cached or timed out' })
  }

  res.json(result)
})

// ── Resolve .torrent file URL → stream (download torrent → RD addTorrent) ─────

router.post('/resolve-torrent', async (req: Request, res: Response) => {
  const { torrentUrl } = req.body as { torrentUrl?: string }
  if (!torrentUrl) return res.status(400).json({ error: 'torrentUrl is required' })

  const provider = apiProviderService.getProvider('api.real-debrid.com')
  if (!provider?.apiKey) {
    return res.status(503).json({ error: 'Real-Debrid not configured — set your API key first' })
  }

  const result = await apiProviderService.addTorrentFile(torrentUrl)
  if (!result) {
    return res.status(422).json({ error: 'Could not add torrent to Real-Debrid — file may be invalid or RD timed out' })
  }

  res.json(result)
})

// ── List active torrents ──────────────────────────────────────────────────────

router.get('/torrents', async (_req: Request, res: Response) => {
  const provider = apiProviderService.getProvider('api.real-debrid.com')
  if (!provider?.apiKey) {
    return res.status(503).json({ error: 'Real-Debrid not configured' })
  }

  const torrents = await apiProviderService.getRealDebridTorrents()
  res.json(torrents)
})

export default router
