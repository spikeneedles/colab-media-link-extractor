/**
 * Universal Search Routes
 * Unified interface for all three search modes across all source types.
 *
 * GET  /api/universal-search/sources        List all available sources
 * POST /api/universal-search/run            Execute a search across selected sources
 */

import { Router, Request, Response } from 'express'
import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import axios from 'axios'
import { getAllPresets, getPresetById } from '../services/searchSourcePresets.js'
import type { SearchSourceConfig } from '../services/SearchCrawler.js'
import { archivist } from '../services/ArchivistService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const CUSTOM_SOURCES_FILE = path.join(__dirname, '..', '..', 'data', 'custom_sources.json')

function readCustomSources(): any[] {
  try {
    if (!fs.existsSync(CUSTOM_SOURCES_FILE)) return []
    return JSON.parse(fs.readFileSync(CUSTOM_SOURCES_FILE, 'utf-8'))
  } catch { return [] }
}

function writeCustomSources(sources: any[]) {
  fs.mkdirSync(path.dirname(CUSTOM_SOURCES_FILE), { recursive: true })
  fs.writeFileSync(CUSTOM_SOURCES_FILE, JSON.stringify(sources, null, 2), 'utf-8')
}

const router = Router()

// ── Prowlarr helpers ──────────────────────────────────────────────────────────

async function getProwlarrIndexers() {
  const prowlarrUrl = process.env.PROWLARR_URL || 'http://localhost:9696'
  const apiKey      = process.env.PROWLARR_API_KEY || ''
  if (!apiKey) return []
  try {
    const res = await axios.get(`${prowlarrUrl}/api/v1/indexer`, {
      headers: { 'X-Api-Key': apiKey },
      timeout: 8000,
    })
    return (res.data as any[]).filter(i => i.enable).map(i => ({
      id:       i.id as number,
      name:     i.name as string,
      protocol: i.protocol as string,
    }))
  } catch {
    return []
  }
}

const PROWLARR_CATEGORIES: Record<string, string> = {
  // Console (1000)
  '1000': 'Console',
  '1010': 'Console/NDS',
  '1020': 'Console/PSP',
  '1030': 'Console/Wii',
  '1040': 'Console/XBox',
  '1050': 'Console/XBox 360',
  '1060': 'Console/Wiiware',
  '1070': 'Console/XBox 360 DLC',
  '1080': 'Console/PS3',
  '1090': 'Console/Other',
  '1100': 'Console/DS',
  '1110': 'Console/PS Vita',
  '1120': 'Console/WiiU',
  '1130': 'Console/XBox One',
  '1140': 'Console/PS4',
  '1180': 'Console/PS5',
  // Movies (2000)
  '2000': 'Movies',
  '2010': 'Movies/Foreign',
  '2020': 'Movies/Other',
  '2030': 'Movies/SD',
  '2040': 'Movies/HD',
  '2045': 'Movies/UHD',
  '2050': 'Movies/BluRay',
  '2060': 'Movies/3D',
  '2070': 'Movies/DVD',
  '2080': 'Movies/WEB-DL',
  '2090': 'Movies/x265',
  // Audio (3000)
  '3000': 'Audio',
  '3010': 'Audio/MP3',
  '3020': 'Audio/Video',
  '3030': 'Audio/Audiobook',
  '3040': 'Audio/Lossless',
  '3050': 'Audio/Other',
  '3060': 'Audio/Foreign',
  // PC (4000)
  '4000': 'PC',
  '4010': 'PC/0day',
  '4020': 'PC/ISO',
  '4030': 'PC/Mac',
  '4040': 'PC/Mobile-Other',
  '4050': 'PC/Games',
  '4060': 'PC/Mobile-iOS',
  '4070': 'PC/Mobile-Android',
  // TV (5000)
  '5000': 'TV',
  '5010': 'TV/WEB-DL',
  '5020': 'TV/Foreign',
  '5030': 'TV/SD',
  '5040': 'TV/HD',
  '5045': 'TV/UHD',
  '5050': 'TV/Other',
  '5060': 'TV/Sport',
  '5070': 'TV/Anime',
  '5080': 'TV/Documentary',
  '5090': 'TV/x265',
  // XXX (6000)
  '6000': 'XXX',
  '6010': 'XXX/DVD',
  '6020': 'XXX/WMV',
  '6030': 'XXX/XviD',
  '6040': 'XXX/x265',
  '6045': 'XXX/UHD',
  '6050': 'XXX/Pack',
  '6060': 'XXX/ImageSet',
  '6070': 'XXX/Other',
  '6080': 'XXX/SD',
  '6090': 'XXX/WEB-DL',
  // Books (7000)
  '7000': 'Books',
  '7010': 'Books/Mags',
  '7020': 'Books/EBook',
  '7030': 'Books/Comics',
  '7040': 'Books/Technical',
  '7050': 'Books/Other',
  '7060': 'Books/Foreign',
  // Other (8000)
  '8000': 'Other',
  '8010': 'Other/Misc',
  '8020': 'Other/Hashed',
}

async function prowlarrSearch(opts: {
  query:      string
  categories: string[]
  indexerIds: number[]   // empty = all
  maxResults: number
}) {
  const prowlarrUrl = process.env.PROWLARR_URL || 'http://localhost:9696'
  const apiKey      = process.env.PROWLARR_API_KEY || ''
  if (!apiKey) return []

  const params: Record<string, string> = {
    query:      opts.query || '.',
    limit:      String(Math.min(opts.maxResults, 100)),
  }
  if (opts.categories.length) params.categories = opts.categories.join(',')
  if (opts.indexerIds.length) params.indexerIds  = opts.indexerIds.join(',')

  try {
    const res = await axios.get(`${prowlarrUrl}/api/v1/search`, {
      params,
      headers: { 'X-Api-Key': apiKey },
      timeout: 30000,
    })
    return (res.data as any[]).map(r => ({
      title:       r.title ?? '',
      downloadUrl: r.downloadUrl ?? r.guid ?? '',
      magnetUrl:   r.magnetUrl   ?? '',
      infoHash:    r.infoHash    ?? '',
      seeders:     r.seeders     ?? 0,
      leechers:    r.leechers    ?? 0,
      size:        r.size        ?? 0,
      indexer:     r.indexer     ?? '',
      indexerId:   r.indexerId   ?? 0,
      category:    r.categories?.[0]?.name ?? '',
      publishDate: r.publishDate ?? '',
      source:      'prowlarr',
    }))
  } catch (err: any) {
    console.error('Prowlarr search error:', err.message)
    return []
  }
}

// ── GET /sources ──────────────────────────────────────────────────────────────

router.get('/sources', async (_req: Request, res: Response) => {
  const customSources = readCustomSources()

  const [indexers, presets] = await Promise.all([
    getProwlarrIndexers(),
    Promise.resolve([
      ...getAllPresets().map(p => ({
        id:          p.id,
        name:        p.name,
        baseUrl:     p.baseUrl,
        method:      p.searchMethod,
        group:       (p as any).group ?? 'utility',
        description: (p as any).description ?? '',
        custom:      false,
      })),
      ...customSources.map((c: any) => ({
        id:          c.id,
        name:        c.name,
        baseUrl:     c.baseUrl,
        method:      c.searchMethod ?? 'url',
        group:       c.group ?? 'utility',
        description: c.description ?? '',
        custom:      true,
      })),
    ]),
  ])

  res.json({
    prowlarr: {
      connected: indexers.length > 0,
      indexers,
      categories: Object.entries(PROWLARR_CATEGORIES).map(([id, name]) => ({ id, name })),
    },
    webPresets: presets,
  })
})

// ── POST /sources — add a custom web scraper source ──────────────────────────

router.post('/sources', (req: Request, res: Response) => {
  const {
    name, group, description, baseUrl, searchMethod,
    urlTemplate, formInputSelector,
    containerSelector, linkSelector, titleSelector,
  } = req.body as {
    name?:              string
    group?:             string
    description?:       string
    baseUrl?:           string
    searchMethod?:      'url' | 'form'
    urlTemplate?:       string
    formInputSelector?: string
    containerSelector?: string
    linkSelector?:      string
    titleSelector?:     string
  }

  if (!name?.trim() || !baseUrl?.trim()) {
    return res.status(400).json({ error: 'name and baseUrl are required' })
  }

  const id     = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const method = searchMethod ?? 'url'

  const newSource = {
    id,
    name:         name.trim(),
    group:        group ?? 'utility',
    description:  description ?? '',
    baseUrl:      baseUrl.trim(),
    searchMethod: method,
    urlTemplate:  urlTemplate ?? `${baseUrl.trim()}/search?q={query}`,
    ...(method === 'form' && formInputSelector ? {
      formConfig: {
        inputSelector:  formInputSelector,
        waitForResults: '.results',
      },
    } : {}),
    resultSelectors: {
      containerSelector: containerSelector ?? '.result, article',
      linkSelector:      linkSelector      ?? 'a',
      titleSelector:     titleSelector     ?? 'h2, h3, .title',
      thumbnailSelector: '',
    },
    browserOptions: { blockImages: true, blockStyles: false, blockFonts: true, timeout: 30000 },
  }

  const existing = readCustomSources().filter((s: any) => s.id !== id)
  writeCustomSources([...existing, newSource])
  res.status(201).json({ status: 'added', source: newSource })
})

// ── DELETE /sources/:id — remove a custom source ─────────────────────────────

router.delete('/sources/:id', (req: Request, res: Response) => {
  const sources = readCustomSources()
  const filtered = sources.filter((s: any) => s.id !== req.params.id)
  if (filtered.length === sources.length) {
    return res.status(404).json({ error: 'Custom source not found' })
  }
  writeCustomSources(filtered)
  res.json({ status: 'deleted' })
})

// ── POST /run ─────────────────────────────────────────────────────────────────
//
// mode: 'category' — browse everything in the given categories (broad query)
// mode: 'keyword'  — search for a specific keyword across selected sources
//
// Both modes use the same source-selector: pick any combo of
// Prowlarr indexers + web presets.

router.post('/run', async (req: Request, res: Response) => {
  const {
    mode              = 'keyword',      // 'category' | 'keyword'
    query             = '',             // keyword (keyword mode) or ignored (category mode)
    categoryIds       = [],             // Prowlarr category IDs to search in
    prowlarrIndexerIds = [],            // empty = all enabled indexers
    webPresetIds      = [],             // web preset IDs to search
    maxPages          = 3,
    maxResults        = 50,
    extractMedia      = false,          // run headless media extraction on web results
    archiveResults    = false,          // pipe valid results to ArchivistService
  } = req.body as {
    mode?:               'category' | 'keyword'
    query?:              string
    categoryIds?:        string[]
    prowlarrIndexerIds?: number[]
    webPresetIds?:       string[]
    maxPages?:           number
    maxResults?:         number
    extractMedia?:       boolean
    archiveResults?:     boolean
  }

  // Build effective search query
  // Category mode: use a broad wildcard so Prowlarr returns everything
  const effectiveQuery = mode === 'category'
    ? (query.trim() || '.')        // '.' matches everything in Prowlarr
    : query.trim() || '.'

  const results: {
    prowlarr: any[]
    web:      any[]
    archiveSummary?: { archived: number; flagged: number; rejected: number }
  } = { prowlarr: [], web: [] }

  // ── Prowlarr search ─────────────────────────────────────────────────────────
  const runProwlarr = categoryIds.length > 0 || prowlarrIndexerIds.length > 0 || webPresetIds.length === 0

  if (runProwlarr) {
    const cats = categoryIds.length > 0
      ? categoryIds
      : Object.keys(PROWLARR_CATEGORIES)   // all categories if none specified

    results.prowlarr = await prowlarrSearch({
      query:      effectiveQuery,
      categories: cats,
      indexerIds: prowlarrIndexerIds,
      maxResults,
    })
  }

  // ── Web preset search ───────────────────────────────────────────────────────
  // We import SearchCrawler lazily to avoid circular init issues
  if (webPresetIds.length > 0) {
    const { SearchCrawler } = await import('../services/SearchCrawler.js')
    // Reuse a lightweight ephemeral instance (no browser pool needed for non-headless)
    // For actual headless scraping we need the shared browserPool — import it
    const { BrowserPool } = await import('../browserPool.js')
    const tempPool    = new BrowserPool({ maxConcurrent: 3 })
    const crawler     = new SearchCrawler(tempPool)

    const webSearchPromises = webPresetIds.map(async (presetId) => {
      const config: SearchSourceConfig | undefined = getPresetById(presetId)
      if (!config) return null
      try {
        const searchQuery = mode === 'category'
          ? (query.trim() || config.name)   // use category name as search term
          : effectiveQuery
        const result = await crawler.search(config, searchQuery, maxPages)
        return { presetId, presetName: config.name, ...result }
      } catch (err: any) {
        return { presetId, presetName: config.name, error: err.message, results: [] }
      }
    })

    const webResults = await Promise.all(webSearchPromises)
    results.web = webResults.filter(Boolean)

    await tempPool.cleanup().catch(() => {})
  }

  // ── Archive results through the full Archivist Protocol pipeline ───────────
  // archiveResults defaults to true so all crawled results are persisted.
  const shouldArchive = archiveResults !== false

  if (shouldArchive) {
    const sourceUrl = process.env.PROWLARR_URL || 'http://localhost:9696'

    // Prowlarr results: pass raw objects to processCrawlResults which handles
    // both HTTP download URLs and magnet links (resolve pipeline runs inside).
    if (results.prowlarr.length > 0) {
      const crawlStats = await archivist.processCrawlResults(
        results.prowlarr,
        sourceUrl,
      )
      results.archiveSummary = {
        archived: crawlStats.archived,
        flagged:  crawlStats.flagged,
        rejected: crawlStats.rejected,
      }
    } else {
      results.archiveSummary = { archived: 0, flagged: 0, rejected: 0 }
    }

    // Web scraper results: use archiveBatch for the extracted media URLs.
    const webEntries = results.web.flatMap((source: any) =>
      (source.results ?? []).flatMap((item: any) =>
        (item.mediaUrls ?? []).map((u: string) => ({
          sourceUrl:   item.url,
          mediaUrl:    u,
          title:       item.metadata?.title ?? item.title ?? 'Untitled',
          contentType: 'video/stream',
          indexer:     source.presetName,
        }))
      )
    )

    if (webEntries.length > 0) {
      const webStats = await archivist.archiveBatch(webEntries as any)
      const ws = {
        archived: webStats.filter(r => r.status === 'archived').length,
        flagged:  webStats.filter(r => r.status === 'flagged').length,
        rejected: webStats.filter(r => r.status === 'rejected').length,
      }
      results.archiveSummary = {
        archived: (results.archiveSummary?.archived ?? 0) + ws.archived,
        flagged:  (results.archiveSummary?.flagged  ?? 0) + ws.flagged,
        rejected: (results.archiveSummary?.rejected ?? 0) + ws.rejected,
      }
    }
  }

  res.json({
    mode,
    query: effectiveQuery,
    summary: {
      prowlarrResults: results.prowlarr.length,
      webResults:      results.web.reduce((s: number, src: any) => s + (src.results?.length ?? 0), 0),
      archiveSummary:  results.archiveSummary,
    },
    results,
  })
})

export default router
