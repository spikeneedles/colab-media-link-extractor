/**
 * yt-dlp Routes
 *
 * POST /api/ytdlp/extract         — extract stream URLs from a single URL
 * POST /api/ytdlp/playlist        — extract all entries from a playlist/channel
 * GET  /api/ytdlp/formats         — list available formats for a URL
 * POST /api/ytdlp/batch           — batch extract + archive multiple URLs
 * GET  /api/ytdlp/status          — check if yt-dlp is installed and available
 */

import { Router, Request, Response } from 'express'
import { ytDlp }                      from '../services/YtDlpService.js'

const router = Router()

// POST /api/ytdlp/extract
router.post('/extract', async (req: Request, res: Response) => {
  const { url } = req.body as { url?: string }
  if (!url) return res.status(400).json({ error: 'url is required' })

  const result = await ytDlp.extract(url)
  if (!result.success) return res.status(502).json({ error: result.error, url })
  res.json(result)
})

// POST /api/ytdlp/playlist
router.post('/playlist', async (req: Request, res: Response) => {
  const { url, maxItems } = req.body as { url?: string; maxItems?: number }
  if (!url) return res.status(400).json({ error: 'url is required' })

  const result = await ytDlp.extractPlaylist(url, maxItems ?? 200)
  if (!result.success) return res.status(502).json({ error: result.error, url })
  res.json(result)
})

// GET /api/ytdlp/formats?url=...
router.get('/formats', async (req: Request, res: Response) => {
  const url = req.query.url as string | undefined
  if (!url) return res.status(400).json({ error: 'url query param required' })

  const formats = await ytDlp.getFormats(url)
  res.json({ url, formats })
})

// POST /api/ytdlp/batch
// Body: { urls: string[], archive?: boolean }
router.post('/batch', async (req: Request, res: Response) => {
  const { urls, archive = true } = req.body as { urls?: string[]; archive?: boolean }
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'urls array is required' })
  }
  if (urls.length > 50) {
    return res.status(400).json({ error: 'Max 50 URLs per batch' })
  }

  const results = await Promise.allSettled(
    urls.map(async url => {
      if (archive) {
        const count = await ytDlp.extractAndArchive(url)
        return { url, archived: count }
      }
      return ytDlp.extract(url)
    })
  )

  res.json({
    total:  urls.length,
    results: results.map((r, i) => ({
      url: urls[i],
      ...(r.status === 'fulfilled' ? { success: true, data: r.value } : { success: false, error: (r.reason as Error).message }),
    })),
  })
})

// GET /api/ytdlp/status
router.get('/status', async (_req: Request, res: Response) => {
  const available = await ytDlp.isAvailable()
  res.json({
    available,
    message: available
      ? 'yt-dlp is installed and working'
      : 'yt-dlp not found — install it: pip install yt-dlp',
    bin: process.env.YTDLP_BIN ?? 'yt-dlp',
  })
})

export default router
