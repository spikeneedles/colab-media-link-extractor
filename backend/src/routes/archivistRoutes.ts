/**
 * Archivist Routes — REST API for The Archivist Protocol
 *
 * GET  /api/archivist/playlist/:category  Serve master M3U (movies|live_tv|series)
 * GET  /api/archivist/stats               Archive statistics
 * GET  /api/archivist/flagged             Ambiguous items pending manual review
 * POST /api/archivist/validate            Validate a single URL (no archive)
 * POST /api/archivist/archive             Archive a single entry
 * POST /api/archivist/archive-batch       Archive multiple entries
 * POST /api/archivist/resolve-flagged     Manually assign a flagged item
 * POST /api/archivist/process-crawl       Pipe raw crawler results through the protocol
 */

import { Router, Request, Response } from 'express'
import { archivist, ArchivistEntry, ArchiveCategory } from '../services/ArchivistService.js'

const router = Router()
const VALID_CATEGORIES: ArchiveCategory[] = ['movies', 'live_tv', 'series', 'adult_movies', 'adult_livetv', 'adult_series']

// ── Serve master playlist ─────────────────────────────────────────────────────

router.get('/playlist/:category', (req: Request, res: Response) => {
  const { category } = req.params
  if (!VALID_CATEGORIES.includes(category as ArchiveCategory)) {
    return res.status(400).json({ error: `Invalid category. Valid: ${VALID_CATEGORIES.join(', ')}` })
  }
  const content = archivist.getPlaylistContent(category as ArchiveCategory)
  res.setHeader('Content-Type', 'application/x-mpegURL')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Disposition', `inline; filename="${category}_master.m3u"`)
  res.send(content)
})

// ── Stats ─────────────────────────────────────────────────────────────────────

router.get('/stats', (_req: Request, res: Response) => {
  res.json(archivist.getStats())
})

// ── Flagged items ─────────────────────────────────────────────────────────────

router.get('/flagged', (_req: Request, res: Response) => {
  res.json(archivist.getFlaggedItems())
})

// ── Resolve a flagged item ────────────────────────────────────────────────────

router.post('/resolve-flagged', (req: Request, res: Response) => {
  const { mediaUrl, category } = req.body as { mediaUrl?: string; category?: string }
  if (!mediaUrl || !category) {
    return res.status(400).json({ error: 'mediaUrl and category are required' })
  }
  if (!VALID_CATEGORIES.includes(category as ArchiveCategory)) {
    return res.status(400).json({ error: `Invalid category. Valid: ${VALID_CATEGORIES.join(', ')}` })
  }
  const ok = archivist.resolveFlagged(mediaUrl, category as ArchiveCategory)
  if (!ok) return res.status(404).json({ error: 'Flagged item not found' })
  res.json({ status: 'Archived', category })
})

// ── Validate a URL (no archive) ───────────────────────────────────────────────

router.post('/validate', async (req: Request, res: Response) => {
  const { url } = req.body as { url?: string }
  if (!url) return res.status(400).json({ error: 'url is required' })
  const result = await archivist.validateUrl(url)
  res.json(result)
})

// ── Archive a single entry ────────────────────────────────────────────────────

router.post('/archive', async (req: Request, res: Response) => {
  const entry = req.body as Partial<ArchivistEntry>

  if (!entry.mediaUrl || !entry.sourceUrl) {
    return res.status(400).json({
      status: 'rejected',
      code: 'META_MINIMUM_VIOLATION',
      error: 'sourceUrl and mediaUrl are required',
    })
  }

  // Apply Meta-Minimum defaults
  const full: ArchivistEntry = {
    sourceUrl:   entry.sourceUrl,
    mediaUrl:    entry.mediaUrl,
    title:       entry.title ?? new URL(entry.mediaUrl).pathname.split('/').pop() ?? 'Untitled',
    contentType: entry.contentType ?? 'unknown',
    category:    entry.category,
    duration:    entry.duration,
    resolution:  entry.resolution,
    tvgId:       entry.tvgId,
    tvgLogo:     entry.tvgLogo,
    groupTitle:  entry.groupTitle,
    indexer:     entry.indexer,
  }

  // For magnet/torrent URLs that need RD caching, process async and return accepted status
  const needsRd = /^(magnet:|infohash:)/i.test(full.mediaUrl) || /\.torrent(\?|$)/i.test(full.mediaUrl)
  if (needsRd) {
    res.status(202).json({ status: 'processing', code: 'RD_RESOLVING', message: 'Magnet/torrent submitted for Real-Debrid resolution. Check playlist shortly.' })
    archivist.archive(full).then(result => {
      console.log(`[Archivist] Async archive result for ${full.title}: ${result.status} ${result.code ?? ''}`)
    }).catch(err => {
      console.error('[Archivist] Async archive error:', err?.message)
    })
    return
  }

  const result = await archivist.archive(full)
  const httpStatus = result.status === 'archived' ? 201 : result.status === 'flagged' ? 202 : 422
  res.status(httpStatus).json(result)
})

// ── Archive a batch of entries ────────────────────────────────────────────────

router.post('/archive-batch', async (req: Request, res: Response) => {
  const { entries } = req.body as { entries?: ArchivistEntry[] }
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'entries array is required' })
  }
  if (entries.length > 500) {
    return res.status(400).json({ error: 'Maximum batch size is 500 entries' })
  }

  const results = await archivist.archiveBatch(entries)
  const archived = results.filter(r => r.status === 'archived').length
  const flagged  = results.filter(r => r.status === 'flagged').length
  const rejected = results.filter(r => r.status === 'rejected').length

  res.json({
    summary: { archived, flagged, rejected, total: results.length },
    results,
  })
})

// ── Process raw crawler results ───────────────────────────────────────────────

router.post('/process-crawl', async (req: Request, res: Response) => {
  const { results, sourceUrl, indexerName } = req.body as {
    results?: any[]
    sourceUrl?: string
    indexerName?: string
  }
  if (!Array.isArray(results) || !sourceUrl) {
    return res.status(400).json({ error: 'results array and sourceUrl are required' })
  }

  const stats = await archivist.processCrawlResults(results, sourceUrl, indexerName)
  res.json({ status: 'Processed', ...stats })
})

// ── Process search/scraper media URLs ────────────────────────────────────────

router.post('/process-search', async (req: Request, res: Response) => {
  const { mediaUrls, sourceUrl } = req.body as {
    mediaUrls?: Array<{ url: string; title?: string; contentType?: string; sourcePageUrl?: string; indexer?: string }>
    sourceUrl?: string
  }
  if (!Array.isArray(mediaUrls) || !sourceUrl) {
    return res.status(400).json({ error: 'mediaUrls array and sourceUrl are required' })
  }

  const stats = await archivist.processSearchResults(mediaUrls, sourceUrl)
  res.json({ status: 'Processed', ...stats })
})

// ── Auto-resolve non-streamable URLs ─────────────────────────────────────────
// Attempts to find a direct streamable media URL from any input (magnet, torrent,
// page URL, mirror, etc.) using crawling / Archive.org / regex extraction.

router.get('/resolve', async (req: Request, res: Response) => {
  const { url, title } = req.query as { url?: string; title?: string }
  if (!url) return res.status(400).json({ error: 'url query param is required' })
  const result = await archivist.resolveMediaUrl(url, title)
  res.json(result)
})

export default router
