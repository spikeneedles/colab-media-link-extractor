import { Router, Request, Response } from 'express'
import type { Router as RouterType } from 'express'

const router: RouterType = Router()

// ── IPTVOrg ──────────────────────────────────────────────────────────────────

// GET /api/crawl-enhancements/iptv-org/channels
// Returns all channels from iptv-org database
router.get('/iptv-org/channels', async (req: Request, res: Response) => {
  try {
    const { IPTVOrgService } = await import('../services/IPTVOrgService.js')
    const svc = new IPTVOrgService()
    const channels = await svc.fetchIPTVOrgChannels()
    res.json({ count: channels.length, channels })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// GET /api/crawl-enhancements/iptv-org/playlists
// Returns all discovered playlist URLs
router.get('/iptv-org/playlists', async (req: Request, res: Response) => {
  try {
    const { IPTVOrgService } = await import('../services/IPTVOrgService.js')
    const svc = new IPTVOrgService()
    const urls = await svc.getAllPlaylistUrls()
    res.json({ count: urls.length, urls })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// GET /api/crawl-enhancements/iptv-org/awesome-lists
// Scans all awesome-iptv GitHub lists  
router.get('/iptv-org/awesome-lists', async (req: Request, res: Response) => {
  try {
    const { IPTVOrgService } = await import('../services/IPTVOrgService.js')
    const svc = new IPTVOrgService()
    const lists = await svc.fetchAwesomeLists()
    res.json({ count: lists.length, lists })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Trakt ─────────────────────────────────────────────────────────────────────

// GET /api/crawl-enhancements/trakt/trending?type=shows&limit=50
router.get('/trakt/trending', async (req: Request, res: Response) => {
  try {
    const { TraktService } = await import('../services/TraktService.js')
    const svc = new TraktService({ clientId: process.env.TRAKT_CLIENT_ID || '' })
    const type = req.query.type as string || 'shows'
    const limit = parseInt(req.query.limit as string) || 50
    const results = type === 'movies'
      ? await svc.getTrendingMovies(1, limit)
      : await svc.getTrendingShows(1, limit)
    res.json({ count: results.length, results })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// GET /api/crawl-enhancements/trakt/seeds
// Returns flat list of trending+popular titles for use as search seeds
router.get('/trakt/seeds', async (req: Request, res: Response) => {
  try {
    const { TraktService } = await import('../services/TraktService.js')
    const svc = new TraktService({ clientId: process.env.TRAKT_CLIENT_ID || '' })
    const seeds = await svc.generateSeeds(true)
    res.json(seeds)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// POST /api/crawl-enhancements/trakt/webhook  (Trakt sends POST on new episode)
router.post('/trakt/webhook', async (req: Request, res: Response) => {
  try {
    const payload = req.body
    // Emit event so crawlers can react
    process.emit('traktWebhook' as any, payload)
    res.json({ ok: true })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Social Media Crawler ───────────────────────────────────────────────────────

// POST /api/crawl-enhancements/social/reddit  body: { subreddits?: string[], limit?: number }
router.post('/social/reddit', async (req: Request, res: Response) => {
  try {
    const { SocialMediaCrawler } = await import('../services/SocialMediaCrawler.js')
    const crawler = new SocialMediaCrawler(req.body)
    const subreddits: string[] = req.body.subreddits || ['IPTV', 'cordcutters', 'Addons4Kodi', 'animepiracy']
    const all: any[] = []
    for (const sub of subreddits) { all.push(...await crawler.crawlSubreddit(sub)) }
    const results = all
    res.json({ count: results.length, results })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// POST /api/crawl-enhancements/social/telegram  body: { channels?: string[] }
router.post('/social/telegram', async (req: Request, res: Response) => {
  try {
    const { SocialMediaCrawler } = await import('../services/SocialMediaCrawler.js')
    const crawler = new SocialMediaCrawler(req.body)
    const channels: string[] = req.body.channels || ['iptvchannel', 'freeiptv', 'm3ulinks']
    const all: any[] = []
    for (const ch of channels) { all.push(...await crawler.crawlTelegramChannel(ch)) }
    const results = all
    res.json({ count: results.length, results })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// POST /api/crawl-enhancements/social/paste  body: { enablePastebin?: boolean }
router.post('/social/paste', async (req: Request, res: Response) => {
  try {
    const { SocialMediaCrawler } = await import('../services/SocialMediaCrawler.js')
    const crawler = new SocialMediaCrawler(req.body)
    const results = await crawler.crawlPastebin()
    res.json({ count: results.length, results })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Archive.org ───────────────────────────────────────────────────────────────

// GET /api/crawl-enhancements/archive/search?q=m3u+iptv&limit=100
router.get('/archive/search', async (req: Request, res: Response) => {
  try {
    const { ArchiveOrgCrawler } = await import('../services/ArchiveOrgCrawler.js')
    const crawler = new ArchiveOrgCrawler()
    const q = req.query.q as string || 'm3u iptv'
    const limit = parseInt(req.query.limit as string) || 100
    const results = await crawler.searchArchiveOrg(q, { maxResults: limit })
    res.json({ count: results.length, results })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// GET /api/crawl-enhancements/archive/cdx?pattern=*.m3u8
router.get('/archive/cdx', async (req: Request, res: Response) => {
  try {
    const { ArchiveOrgCrawler } = await import('../services/ArchiveOrgCrawler.js')
    const crawler = new ArchiveOrgCrawler()
    const pattern = req.query.pattern as string || '*.m3u8'
    const results = await crawler.searchCDX(pattern, {})
    res.json({ count: results.length, results })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Stream Validator ──────────────────────────────────────────────────────────

// POST /api/crawl-enhancements/validate  body: { urls: string[], parallel?: number }
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { StreamValidator } = await import('../services/StreamValidator.js')
    const validator = new StreamValidator()
    const { urls, parallel } = req.body
    const results = await validator.checkHealthBatch(urls, parallel || 20)
    res.json({ results })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// POST /api/crawl-enhancements/hls-manifest  body: { url: string }
router.post('/hls-manifest', async (req: Request, res: Response) => {
  try {
    const { StreamValidator } = await import('../services/StreamValidator.js')
    const validator = new StreamValidator()
    const variants = await validator.parseHLSManifest(req.body.url)
    res.json({ variants })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// POST /api/crawl-enhancements/dash-manifest  body: { url: string }
router.post('/dash-manifest', async (req: Request, res: Response) => {
  try {
    const { StreamValidator } = await import('../services/StreamValidator.js')
    const validator = new StreamValidator()
    const representations = await validator.parseDASHManifest(req.body.url)
    res.json({ representations })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Xtream Detector ───────────────────────────────────────────────────────────

// POST /api/crawl-enhancements/xtream/detect  body: { url: string }
router.post('/xtream/detect', async (req: Request, res: Response) => {
  try {
    const { XtreamDetector } = await import('../services/XtreamDetector.js')
    const detector = new XtreamDetector()
    const result = await detector.detectXtream(req.body.url)
    res.json(result)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// POST /api/crawl-enhancements/xtream/enumerate  body: { panelUrl, username, password }
router.post('/xtream/enumerate', async (req: Request, res: Response) => {
  try {
    const { XtreamDetector } = await import('../services/XtreamDetector.js')
    const detector = new XtreamDetector()
    const { panelUrl, username, password } = req.body
    const result = await detector.enumerateXtream(panelUrl, username, password)
    res.json(result)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// POST /api/crawl-enhancements/decode  body: { text: string }
router.post('/decode', async (req: Request, res: Response) => {
  try {
    const { XtreamDetector } = await import('../services/XtreamDetector.js')
    const detector = new XtreamDetector()
    const urls = detector.decodeObfuscated(req.body.text)
    res.json({ found: urls.length, urls })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── AI Discovery ─────────────────────────────────────────────────────────────

// POST /api/crawl-enhancements/ai/normalize  body: { title: string } or { titles: string[] }
router.post('/ai/normalize', async (req: Request, res: Response) => {
  try {
    const { AIDiscoveryService } = await import('../services/AIDiscoveryService.js')
    const svc = new AIDiscoveryService()
    const { title, titles } = req.body
    if (titles) {
      const results = await svc.normalizeTitles(titles)
      res.json({ results })
    } else {
      const result = await svc.normalizeTitle(title)
      res.json(result)
    }
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// POST /api/crawl-enhancements/ai/aliases  body: { title: string }
router.post('/ai/aliases', async (req: Request, res: Response) => {
  try {
    const { AIDiscoveryService } = await import('../services/AIDiscoveryService.js')
    const svc = new AIDiscoveryService()
    const aliases = await svc.getAliases(req.body.title)
    res.json({ title: req.body.title, aliases })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// POST /api/crawl-enhancements/ai/expand-genre  body: { genre: string, limit?: number }
router.post('/ai/expand-genre', async (req: Request, res: Response) => {
  try {
    const { AIDiscoveryService } = await import('../services/AIDiscoveryService.js')
    const svc = new AIDiscoveryService()
    const titles = await svc.expandGenre(req.body.genre, req.body.limit || 50)
    res.json({ genre: req.body.genre, count: titles.length, titles })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// POST /api/crawl-enhancements/ai/snowball  body: { url: string }
router.post('/ai/snowball', async (req: Request, res: Response) => {
  try {
    const { AIDiscoveryService } = await import('../services/AIDiscoveryService.js')
    const svc = new AIDiscoveryService()
    const seeds = await svc.snowball(req.body.url, req.body.depth || 1)
    res.json({ count: seeds.length, seeds })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Jackett/Newznab ───────────────────────────────────────────────────────────

// POST /api/crawl-enhancements/jackett/search  body: { query, category?, indexers? }
router.post('/jackett/search', async (req: Request, res: Response) => {
  try {
    const { NewznabJackettService } = await import('../services/NewznabJackettService.js')
    const svc = new NewznabJackettService(
      { servers: [], defaultCategories: ['5000', '2000', '7000'] },
      { url: process.env.JACKETT_URL || 'http://localhost:9117', apiKey: process.env.JACKETT_API_KEY || '' }
    )
    const results = await svc.search(req.body.query, req.body)
    res.json({ count: results.length, results })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Content Dedup ─────────────────────────────────────────────────────────────

// POST /api/crawl-enhancements/dedup  body: { streams: any[], options? }
router.post('/dedup', async (req: Request, res: Response) => {
  try {
    const { ContentDeduplicator } = await import('../services/ContentDeduplicator.js')
    const dedup = new ContentDeduplicator()
    const result = await dedup.deduplicateBatch(req.body.streams, req.body.options)
    res.json(result)
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// ── Crawl State ───────────────────────────────────────────────────────────────

// GET /api/crawl-enhancements/state/jobs
router.get('/state/jobs', async (req: Request, res: Response) => {
  try {
    const { CrawlStateManager } = await import('../services/CrawlStateManager.js')
    const mgr = new CrawlStateManager()
    res.json(mgr.getStats())
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

// GET /api/crawl-enhancements/state/links?limit=100&offset=0
router.get('/state/links', async (req: Request, res: Response) => {
  try {
    const { CrawlStateManager } = await import('../services/CrawlStateManager.js')
    const mgr = new CrawlStateManager()
    const result = mgr.getDiscoveredLinks({ limit: parseInt(req.query.limit as string) || 100, offset: parseInt(req.query.offset as string) || 0 })
    res.json({ count: result.links.length, total: result.total, links: result.links })
  } catch (e: any) { res.status(500).json({ error: e.message }) }
})

export default router
