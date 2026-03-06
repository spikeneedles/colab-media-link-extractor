/**
 * metaEnrichRoutes.ts
 *
 * Dedicated API endpoints for the free metadata enrichment services:
 *  POST /api/meta/enrich         — scrape all sources for a title/url
 *  POST /api/meta/omdb           — OMDB lookup (poster + multi-ratings)
 *  POST /api/meta/jikan          — Jikan/MAL anime lookup (no key needed)
 *  POST /api/meta/fanart/movie   — FanArt.tv movie artwork by TMDb ID
 *  POST /api/meta/fanart/tv      — FanArt.tv TV artwork by TVDb ID
 *  POST /api/meta/mdblist        — MDBList aggregate ratings
 *  GET  /api/meta/status         — which services are available
 */

import { Router, Request, Response } from 'express'
import { omdbService }   from '../services/OmdbService.js'
import { jikanService }  from '../services/JikanService.js'
import { fanArtTv }      from '../services/FanArtTvService.js'
import { mdbList }       from '../services/MDBListService.js'
import { metadataScraper } from '../services/MetadataScraperService.js'

const router = Router()

// ── GET /api/meta/status ──────────────────────────────────────────────────────

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    services: {
      omdb:     { available: omdbService.isAvailable,  keyEnv: 'OMDB_API_KEY',       freeTier: '1,000 req/day' },
      jikan:    { available: true,                     keyEnv: 'none required',       freeTier: 'unlimited (rate limited 3 req/s)' },
      fanart:   { available: fanArtTv.isAvailable,     keyEnv: 'FANART_TV_API_KEY',   freeTier: 'unlimited personal use' },
      mdblist:  { available: mdbList.isAvailable,      keyEnv: 'MDBLIST_API_KEY',     freeTier: '1,000 req/day' },
    },
  })
})

// ── POST /api/meta/enrich ─────────────────────────────────────────────────────

router.post('/enrich', async (req: Request, res: Response) => {
  const { url = '', title = '', options = {} } = req.body
  if (!title && !url) {
    return res.status(400).json({ error: 'Provide at least one of: title, url' })
  }
  try {
    const result = await metadataScraper.scrape(url, title, options)
    res.json({ success: true, result })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Enrichment failed' })
  }
})

// ── POST /api/meta/enrich/batch ───────────────────────────────────────────────

router.post('/enrich/batch', async (req: Request, res: Response) => {
  const { items, options = {} } = req.body
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' })
  }
  try {
    const results = await metadataScraper.scrapeBatch(items, options)
    res.json({ success: true, count: results.length, results })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Batch enrichment failed' })
  }
})

// ── POST /api/meta/omdb ───────────────────────────────────────────────────────

router.post('/omdb', async (req: Request, res: Response) => {
  const { imdbId, title, year, type } = req.body
  if (!imdbId && !title) {
    return res.status(400).json({ error: 'Provide imdbId or title' })
  }
  if (!omdbService.isAvailable) {
    return res.status(503).json({ error: 'OMDB not configured. Set OMDB_API_KEY.' })
  }
  try {
    const result = imdbId
      ? await omdbService.getByImdbId(imdbId)
      : await omdbService.getByTitle(title, year, type)
    if (!result) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true, result })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'OMDB lookup failed' })
  }
})

// ── POST /api/meta/jikan ──────────────────────────────────────────────────────

router.post('/jikan', async (req: Request, res: Response) => {
  const { title, malId, pictures } = req.body
  if (!title && !malId) {
    return res.status(400).json({ error: 'Provide title or malId' })
  }
  try {
    const result = malId
      ? await jikanService.getById(malId)
      : await jikanService.search(title)
    if (!result) return res.status(404).json({ error: 'Anime not found' })

    const extra: Record<string, any> = { result }
    if (pictures && result.malId) {
      extra.pictures = await jikanService.getPictures(result.malId)
    }
    res.json({ success: true, ...extra })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Jikan lookup failed' })
  }
})

// ── POST /api/meta/fanart/movie ───────────────────────────────────────────────

router.post('/fanart/movie', async (req: Request, res: Response) => {
  const { tmdbId } = req.body
  if (!tmdbId) return res.status(400).json({ error: 'tmdbId required' })
  if (!fanArtTv.isAvailable) {
    return res.status(503).json({ error: 'FanArt.tv not configured. Set FANART_TV_API_KEY.' })
  }
  try {
    const result = await fanArtTv.getMovieArt(Number(tmdbId))
    if (!result) return res.status(404).json({ error: 'No artwork found' })
    res.json({ success: true, result })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'FanArt lookup failed' })
  }
})

// ── POST /api/meta/fanart/tv ──────────────────────────────────────────────────

router.post('/fanart/tv', async (req: Request, res: Response) => {
  const { tvdbId } = req.body
  if (!tvdbId) return res.status(400).json({ error: 'tvdbId required' })
  if (!fanArtTv.isAvailable) {
    return res.status(503).json({ error: 'FanArt.tv not configured. Set FANART_TV_API_KEY.' })
  }
  try {
    const result = await fanArtTv.getTvArt(Number(tvdbId))
    if (!result) return res.status(404).json({ error: 'No artwork found' })
    res.json({ success: true, result })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'FanArt lookup failed' })
  }
})

// ── POST /api/meta/mdblist ────────────────────────────────────────────────────

router.post('/mdblist', async (req: Request, res: Response) => {
  const { imdbId, tmdbId, title, year, type } = req.body
  if (!imdbId && !tmdbId && !title) {
    return res.status(400).json({ error: 'Provide imdbId, tmdbId, or title' })
  }
  if (!mdbList.isAvailable) {
    return res.status(503).json({ error: 'MDBList not configured. Set MDBLIST_API_KEY.' })
  }
  try {
    let result
    if (imdbId)       result = await mdbList.getByImdbId(imdbId)
    else if (tmdbId)  result = await mdbList.getByTmdbId(Number(tmdbId), type ?? 'movie')
    else              result = await mdbList.getByTitle(title, year, type)
    if (!result) return res.status(404).json({ error: 'Not found' })
    res.json({ success: true, result })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'MDBList lookup failed' })
  }
})

export default router
