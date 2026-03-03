import { Router, Request, Response } from 'express'
import { metadataScraper } from '../services/MetadataScraperService.js'

const router = Router()

// POST /api/metadata/scrape
// Body: { items: Array<{ url: string; title?: string }>, concurrency?: number }
router.post('/scrape', async (req: Request, res: Response) => {
  try {
    const { items, concurrency = 8 } = req.body as {
      items: Array<{ url: string; title?: string }>
      concurrency?: number
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' })
    }

    const results = await metadataScraper.scrapeBatch(items.map(i => ({ url: i.url, title: i.title ?? '' })), { concurrency })
    res.json({ count: results.length, results })
  } catch (err) {
    console.error('[MetadataRoute] scrape error:', err)
    res.status(500).json({ error: String(err) })
  }
})

// POST /api/metadata/scrape/stream  — SSE progress stream
router.post('/scrape/stream', async (req: Request, res: Response) => {
  const { items, concurrency = 8 } = req.body as {
    items: Array<{ url: string; title?: string }>
    concurrency?: number
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (event: string, data: unknown) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  const onProgress = (p: unknown) => send('progress', p)
  const onResult   = (r: unknown) => send('result',   r)

  metadataScraper.on('progress', onProgress)
  metadataScraper.on('result',   onResult)

  req.on('close', () => {
    metadataScraper.off('progress', onProgress)
    metadataScraper.off('result',   onResult)
  })

  try {
    const results = await metadataScraper.scrapeBatch(items.map(i => ({ url: i.url, title: i.title ?? '' })), { concurrency })
    send('done', { count: results.length })
  } catch (err) {
    send('error', { message: String(err) })
  } finally {
    metadataScraper.off('progress', onProgress)
    metadataScraper.off('result',   onResult)
    res.end()
  }
})

// GET /api/metadata/parse?title=<torrent+title>  — quick title parse
router.get('/parse', (req: Request, res: Response) => {
  const { title } = req.query as { title?: string }
  if (!title) return res.status(400).json({ error: 'title query param required' })
  const parsed = metadataScraper.parseTitle(title)
  res.json(parsed)
})

// GET /api/metadata/poster?title=<title>&type=movie|tv
// Returns { posterUrl, backdropUrl, tmdbTitle, year, overview } — cached in-service LRU
router.get('/poster', async (req: Request, res: Response) => {
  const { title, type } = req.query as { title?: string; type?: string }
  if (!title) return res.status(400).json({ error: 'title query param required' })

  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return res.status(503).json({ error: 'TMDB_API_KEY not configured' })

  try {
    // Reuse existing scrapeBatch with minimal options (no HEAD probe)
    const results = await metadataScraper.scrapeBatch(
      [{ url: '', title }],
      { concurrency: 1, includeTmdb: true, includeHead: false, timeoutMs: 6000 }
    )
    const tmdb = results[0]?.tmdb
    if (!tmdb) return res.json({ posterUrl: null })
    res.json({
      posterUrl:   tmdb.posterUrl   ?? null,
      backdropUrl: tmdb.backdropUrl ?? null,
      tmdbTitle:   tmdb.title,
      year:        tmdb.year,
      overview:    tmdb.overview,
      rating:      tmdb.rating,
      genres:      tmdb.genres,
    })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// GET /api/metadata/cache/clear  — clear cache
router.delete('/cache', (_req: Request, res: Response) => {
  metadataScraper.clearCache()
  res.json({ cleared: true })
})

export default router
