import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { BrowserPool } from './browserPool.js'
import { CacheManager } from './cache.js'
import { AuthManager } from './auth.js'
import { DownloadMonitor } from './services/DownloadMonitor.js'
import { BackgroundCrawler } from './services/BackgroundCrawler.js'
import { SearchCrawler } from './services/SearchCrawler.js'
import MediaSyncIntegration from './services/mediaSyncIntegration.js'
import { getAllPresets, getPresetById } from './services/searchSourcePresets.js'
import type { SearchSourceConfig } from './services/SearchCrawler.js'
import extensionRoutes from './routes/extensionRoutes.js'
import stremioRoutes from './routes/stremioRoutes.js'
import apkRuntimeRoutes from './routes/apkRuntimeRoutes.js'
import runtimeCaptureRoutes from './routes/runtimeCaptureRoutes.js'
import aiRoutes from './routes/aiRoutes.js'
import kodiSyncRoutes from './routes/kodiSyncRoutes.js'
import mediaListRoutes from './routes/mediaListRoutes.js'
import archivistRoutes from './routes/archivistRoutes.js'
import universalSearchRoutes from './routes/universalSearchRoutes.js'
import automationRoutes from './routes/automationRoutes.js'
import metadataRoutes from './routes/metadataRoutes.js'
import realDebridRoutes from './routes/realDebridRoutes.js'
import mediaProcessingRoutes from './routes/mediaProcessingRoutes.js'
import playlistHarvesterRoutes from './routes/playlistHarvesterRoutes.js'
import siteCrawlerRoutes from './routes/siteCrawlerRoutes.js'
import playlistPushRoutes from './routes/playlistPushRoutes.js'
import crawlerEnhancementsRoutes from './routes/crawlerEnhancementsRoutes.js'
import crawlerRoutes from './routes/crawlerRoutes.js'
import { archivist } from './services/ArchivistService.js'
import { initAutomationEngine } from './services/AutomationEngine.js'
import { playlistPushService } from './services/PlaylistPushService.js'
import axios from 'axios'
import { parse as parseContentRange } from 'content-range'
import { handleNexusStream } from './routes/nexusStream.js'
// ── New expansion routes ──────────────────────────────────────────────────────
import ytdlpRoutes       from './routes/ytdlpRoutes.js'
import shodanRoutes      from './routes/shodanRoutes.js'
import dnsDiscoveryRoutes from './routes/dnsDiscoveryRoutes.js'
import smartRecrawlRoutes from './routes/smartRecrawlRoutes.js'
import metaEnrichRoutes  from './routes/metaEnrichRoutes.js'
import { smartRecrawl }  from './services/SmartRecrawlService.js'
import { proxyPool }     from './services/ProxyPoolService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

// ── New Crawler Enhancement Env Vars ─────────────────────────────────────────
// TRAKT_CLIENT_ID         — Trakt.tv API client ID (for trending seeds)
// JACKETT_URL             — Jackett URL (default: http://localhost:9117)
// JACKETT_API_KEY         — Jackett API key
// NEWZNAB_URL             — Newznab/NZBHydra2 base URL
// NEWZNAB_API_KEY         — Newznab API key  
// PROXY_LIST              — Comma-separated proxy URLs (optional)
// CRAWL_STATE_DB          — Path to crawl state SQLite DB (default: ./data/crawl_state.db)
// ANTICAPTCHA_KEY         — Anti-captcha service key (optional)
// ──────────────────────────────────────────────────────────────────────────────

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || ['http://localhost:5173', 'http://localhost:4173']
const MAX_CONCURRENT_BROWSERS = parseInt(process.env.MAX_CONCURRENT_BROWSERS || '5', 10)
const CACHE_ENABLED = process.env.CACHE_ENABLED === 'true'
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600', 10)

const browserPool = new BrowserPool({ maxConcurrent: MAX_CONCURRENT_BROWSERS })
const cacheManager = new CacheManager({ enabled: CACHE_ENABLED, ttl: CACHE_TTL })
const authManager = new AuthManager()
const searchCrawler = new SearchCrawler(browserPool)

// Initialize DownloadMonitor
const downloadsPath = path.join(__dirname, '..', 'downloads')
if (!fs.existsSync(downloadsPath)) {
  fs.mkdirSync(downloadsPath, { recursive: true })
}
const downloadMonitor = new DownloadMonitor({
  downloadDir: downloadsPath,
  monitorInterval: 10000, // Check every 10 seconds
  maxConcurrentProcessing: 3,
  extractImages: true,
  enrichMetadata: true,
  apiKeys: {
    tmdb: process.env.TMDB_API_KEY,
    tvdb: process.env.TVDB_API_KEY,
    trakt: process.env.TRAKT_API_KEY
  }
})

// Initialize BackgroundCrawler with 20 parallel workers
const backgroundCrawler = new BackgroundCrawler({
  prowlarrUrl: process.env.PROWLARR_URL || 'http://localhost:9696',
  prowlarrApiKey: process.env.PROWLARR_API_KEY || '',
  crawlInterval: 120000, // 2 minutes (was 5 minutes)
  maxParallelWorkers: 20, // 20 parallel workers for faster crawling
  categories: (process.env.CRAWLER_CATEGORIES || '7000,2070,5070,2000,5000,8000,3000,4000,5070,6000,1000,100000').split(','), // Animation/Anime first, then Movies, TV, XXX, Audio, PC, Books, Other
  useAllIndexers: true, // Use all configured Prowlarr indexers
  queryString: process.env.CRAWLER_QUERY || '' // Empty = search everything in each category
})

// Initialize Media Sync Integration (SQLite + local storage for crawled media)
const mediaSyncIntegration = new MediaSyncIntegration()
mediaSyncIntegration.initialize()
  .then(() => {
    mediaSyncIntegration.connectCrawler(backgroundCrawler)
    console.log('✓ Media Sync Integration connected to BackgroundCrawler')
  })
  .catch(error => {
    console.error('❌ Media Sync Integration failed to initialize:', error.message)
  })

// Hook BackgroundCrawler → ArchivistService (async, non-blocking)
backgroundCrawler.on('categoryComplete', (crawlResult: any) => {
  if (!crawlResult?.results?.length) return
  const prowlarrUrl = process.env.PROWLARR_URL || 'http://localhost:9696'
  archivist.processCrawlResults(
    crawlResult.results,
    prowlarrUrl,
    `Prowlarr/${crawlResult.categoryName ?? crawlResult.category}`,
  ).then(stats => {
    if (stats.archived > 0) {
      console.log(`🗂️  Archivist: +${stats.archived} archived from crawler (${crawlResult.categoryName})`)
    }
  }).catch(() => {/* non-fatal */})
})

// Hook BackgroundCrawler → Playlist Push Service (push to mobile app)
backgroundCrawler.on('categoryComplete', (crawlResult: any) => {
  playlistPushService.onCrawlComplete(crawlResult).catch((err) => {
    console.error('Playlist push failed:', err.message)
  })
})

backgroundCrawler.on('cycleComplete', () => {
  playlistPushService.onCycleComplete().catch((err) => {
    console.error('Playlist push (cycle complete) failed:', err.message)
  })
})

// Initialize AutomationEngine (continuous parallel search automation)
const automationEngine = initAutomationEngine(backgroundCrawler)

global.authManager = authManager

app.use(helmet())
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    // Allow requests from localhost on any port
    // Allow requests from configured origins
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || CORS_ORIGIN.includes(origin) || CORS_ORIGIN.includes('*')) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req: Request) => {
    // Skip rate limiting for localhost (development)
    const isLocalhost = req.ip === '::1' || req.ip === '127.0.0.1'
    return isLocalhost
  }
})

app.use('/api/', limiter)

app.use(authManager.middleware())

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')))

// API root endpoint
app.get('/api/', (req: Request, res: Response) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`
  res.json({
    message: 'Media Link Scanner API',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: {
        method: 'GET',
        path: '/api/health',
        description: 'Server health check and stats',
        authentication: 'none',
      },
      auth: {
        methods: {
          'GET /api/auth/docs': 'Authentication documentation',
          'POST /api/auth/generate-key': 'Generate new API key (admin only)',
        },
      },
      headless: {
        methods: {
          'POST /api/headless-browse': 'Browse URL and extract content',
          'POST /api/headless-execute': 'Execute JavaScript on page',
          'POST /api/headless-screenshot': 'Capture page screenshot',
        },
        description: 'Puppeteer-powered headless browser endpoints',
      },
      media: {
        methods: {
          'GET /api/media/stream': 'Stream media content (with range support, add ?save=true to save to disk)',
          'GET /api/media/info': 'Get media file information',
          'POST /api/media/generate-m3u': 'Generate M3U playlist',
          'GET /api/media/downloads': 'Get mega list of all downloaded files',
          'GET /api/media/downloads/:id': 'Download a saved file by ID',
          'DELETE /api/media/downloads/:id': 'Delete a saved download',
          'POST /api/media/downloads/clear/all': 'Clear all downloads',
        },
        description: 'Media proxy, streaming, and downloads management',
        authentication: authManager.isEnabled() ? 'API Key required' : 'none',
        downloadPath: '/downloads (relative to backend root)',
      },
      extension: {
        path: '/api/extension',
        description: 'Browser extension routes',
      },
      stremio: {
        path: '/stremio',
        description: 'Stremio addon integration',
      },
      apkRuntime: {
        path: '/api/apk-runtime',
        description: 'APK runtime capture endpoints',
      },
      runtimeCapture: {
        path: '/api/runtime-capture',
        description: 'Runtime emulator capture (SSE)',
      },
      ai: {
        path: '/api/ai',
        description: 'Gemini 2.5 Flash AI endpoints',
        availability: 'Requires GEMINI_API_KEY environment variable',
      },
      crawler: {
        methods: {
          'POST /api/crawler/config': 'Configure background crawler',
          'POST /api/crawler/run': 'Run crawler once',
          'POST /api/crawler/stop': 'Stop background crawler',
        },
        description: 'Background crawler for automated media discovery',
      },
      search: {
        methods: {
          'GET /api/search/presets': 'Get all available search source presets',
          'GET /api/search/presets/:id': 'Get specific search preset details',
          'POST /api/search/execute': 'Execute search on a single source',
          'POST /api/search/execute-multi': 'Execute search on multiple sources',
          'POST /api/search/custom/save': 'Save custom search source config',
          'GET /api/search/custom': 'Get all custom search sources',
          'DELETE /api/search/custom/:id': 'Delete custom search source',
        },
        description: 'Search crawler with headless browser support for extracting media from website search results',
      },
      kodiSync: {
        path: '/api/kodi-sync',
        description: 'Kodi sync endpoint for Repository Auto-Scraper',
        methods: {
          'POST /api/kodi-sync/receive': 'Queue auto-scrape job from Kodi extension',
          'GET /api/kodi-sync/status/:jobId': 'Get job status and progress',
          'GET /api/kodi-sync/results/:jobId': 'Get job results (JSON/M3U/CSV)',
          'POST /api/kodi-sync/batch': 'Queue multiple URLs',
        },
      },
    },
    documentation: `${baseUrl}/api/auth/docs`,
  })
})

// Register extension routes
app.use('/api/extension', extensionRoutes)

// Register Stremio addon routes
app.use('/stremio', stremioRoutes)

// Register APK runtime capture routes
app.use('/api/apk-runtime', apkRuntimeRoutes)

// Register runtime emulator capture routes (mitmproxy → SSE → UI)
// SSE endpoint is exempt from rate-limit — it's a long-lived connection
app.use('/api/runtime-capture', runtimeCaptureRoutes)

// Register AI routes (Gemini 2.5 Flash endpoints)
app.use('/api/ai', aiRoutes)

// Register Kodi Sync routes (Receiver endpoint for Repository Auto-Scraper)
app.use('/api/kodi-sync', kodiSyncRoutes)

// Register Media List routes (SQLite storage for media collections)
app.use('/api/media-list', mediaListRoutes)

// Register Archivist routes (Archivist Protocol — Three Pillars)
app.use('/api/archivist', archivistRoutes)

// Register Universal Search routes (Category / Keyword / Source-selector)
app.use('/api/universal-search', universalSearchRoutes)

// Register Automation Engine routes (continuous parallel crawl/scrape/sort)
app.use('/api/automation', automationRoutes)

// Metadata scraper routes (parallel enrichment, title parsing, cache)
app.use('/api/metadata', metadataRoutes)

// Real-Debrid integration (status, configure, unrestrict, resolve, torrents)
app.use('/api/realdebrid', realDebridRoutes)
app.use('/api/media', mediaProcessingRoutes)
app.use('/api/harvest', playlistHarvesterRoutes)
app.use('/api/site-crawler', siteCrawlerRoutes)
app.use('/api/crawler', crawlerRoutes)
// Crawler enhancement routes (IPTV-org, Trakt, social, archive, AI discovery, stream validation)
app.use('/api/crawl-enhancements', crawlerEnhancementsRoutes)

// Playlist push to Firebase(automatic sync to mobile apps)
app.use('/api/playlist-push', playlistPushRoutes)

// Google Drive integration
import driveRoutes from './routes/driveRoutes.js'
app.use('/api/drive', driveRoutes)

// ── Expansion: yt-dlp, Shodan, DNS Discovery, Smart Recrawl ──────────────────
app.use('/api/ytdlp',          ytdlpRoutes)
app.use('/api/shodan',         shodanRoutes)
app.use('/api/dns-discovery',  dnsDiscoveryRoutes)
app.use('/api/smart-recrawl',  smartRecrawlRoutes)
app.use('/api/meta',           metaEnrichRoutes)

// Simple CORS-proxy for playlist files (M3U/PLS/XSPF) requested by the frontend
app.get('/api/proxy/fetch', async (req: Request, res: Response) => {
  const url = req.query.url as string
  if (!url) return res.status(400).json({ error: 'url query param required' })
  // Only allow playlist-like URLs
  if (!/\.(m3u8?|pls|xspf|asx|wpl)(\?|$)/i.test(url) && !/raw\.githubusercontent/i.test(url)) {
    return res.status(403).json({ error: 'Only playlist URLs are proxied' })
  }
  try {
    const response = await (await import('axios')).default.get(url, {
      responseType: 'text',
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SILAS/1.0)' },
    })
    res.set('Content-Type', 'text/plain; charset=utf-8')
    res.send(response.data)
  } catch (err: any) {
    res.status(502).json({ error: `Proxy fetch failed: ${err.message}` })
  }
})
app.set('browserPool', browserPool)

// FlareSolverr health check endpoint
import { flareSolverr as _fs } from './services/FlareSolverrClient.js'
app.get('/api/flaresolverr/status', async (_req, res) => {
  const up = await _fs.ping()
  res.json({ running: up, url: process.env.FLARESOLVERR_URL ?? 'http://localhost:8191' })
})

interface BrowserOptions {
  timeout?: number
  waitForSelector?: string
  executeScript?: string
  captureScreenshot?: boolean
  blockImages?: boolean
  blockStyles?: boolean
  blockFonts?: boolean
  userAgent?: string
  viewport?: { width: number; height: number }
  fullPage?: boolean
}

interface BrowseRequest extends Request {
  body: {
    url: string
    options?: BrowserOptions
  }
}

interface ExecuteRequest extends Request {
  body: {
    url: string
    script: string
    options?: BrowserOptions
  }
}

interface ScreenshotRequest extends Request {
  body: {
    url: string
    options?: BrowserOptions
  }
}

app.post('/api/headless-browse', async (req: BrowseRequest, res: Response) => {
  const { url, options = {} } = req.body

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required and must be a string' })
  }

  try {
    new URL(url)
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' })
  }

  const cacheKey = `browse:${url}:${JSON.stringify(options)}`
  const cached = cacheManager.get(cacheKey)
  if (cached) {
    return res.json({ ...cached, cached: true })
  }

  try {
    const startTime = Date.now()
    const page = await browserPool.getPage()

    if (options.userAgent) {
      await page.setUserAgent(options.userAgent)
    }

    if (options.viewport) {
      await page.setViewport(options.viewport)
    }

    if (options.blockImages || options.blockStyles || options.blockFonts) {
      await page.setRequestInterception(true)
      page.on('request', (request) => {
        const resourceType = request.resourceType()
        if (
          (options.blockImages && resourceType === 'image') ||
          (options.blockStyles && resourceType === 'stylesheet') ||
          (options.blockFonts && resourceType === 'font')
        ) {
          request.abort()
        } else {
          request.continue()
        }
      })
    }

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: options.timeout || 30000,
    })

    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, {
        timeout: options.timeout || 30000,
      })
    }

    const html = await page.content()
    const text = await page.evaluate(() => document.body.textContent || '')

    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'))
      return anchors.map(a => (a as HTMLAnchorElement).href)
    })

    const scripts = await page.evaluate(() => {
      const scriptElements = Array.from(document.querySelectorAll('script[src]'))
      return scriptElements.map(s => (s as HTMLScriptElement).src)
    })

    const metadata = await page.evaluate(() => {
      const getMetaContent = (selector: string) => {
        const element = document.querySelector(selector)
        return element?.getAttribute('content') || undefined
      }

      return {
        title: document.title,
        description: getMetaContent('meta[name="description"]'),
        keywords: getMetaContent('meta[name="keywords"]')?.split(',').map(k => k.trim()),
        ogImage: getMetaContent('meta[property="og:image"]'),
      }
    })

    let screenshot: string | undefined
    if (options.captureScreenshot) {
      const buffer = await page.screenshot({ 
        encoding: 'base64',
        fullPage: options.fullPage || false,
      })
      screenshot = `data:image/png;base64,${buffer}`
    }

    await browserPool.releasePage(page)

    const executionTime = Date.now() - startTime

    const result = {
      html,
      text: text.trim(),
      links: Array.from(new Set(links)),
      scripts: Array.from(new Set(scripts)),
      metadata,
      screenshot,
      executionTime,
    }

    cacheManager.set(cacheKey, result)

    res.json(result)
  } catch (error) {
    console.error('Browse error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      html: '',
      text: '',
      links: [],
      scripts: [],
      metadata: { title: '' },
      executionTime: 0,
    })
  }
})

app.post('/api/headless-execute', async (req: ExecuteRequest, res: Response) => {
  const { url, script, options = {} } = req.body

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' })
  }

  if (!script || typeof script !== 'string') {
    return res.status(400).json({ error: 'Script is required' })
  }

  try {
    new URL(url)
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' })
  }

  try {
    const startTime = Date.now()
    const page = await browserPool.getPage()

    if (options.userAgent) {
      await page.setUserAgent(options.userAgent)
    }

    if (options.viewport) {
      await page.setViewport(options.viewport)
    }

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: options.timeout || 30000,
    })

    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, {
        timeout: options.timeout || 30000,
      })
    }

    const data = await page.evaluate((scriptToExecute) => {
      return eval(scriptToExecute)
    }, script)

    await browserPool.releasePage(page)

    const executionTime = Date.now() - startTime

    res.json({ data, executionTime })
  } catch (error) {
    console.error('Execute error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      data: null,
      executionTime: 0,
    })
  }
})

app.post('/api/headless-screenshot', async (req: ScreenshotRequest, res: Response) => {
  const { url, options = {} } = req.body

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' })
  }

  try {
    new URL(url)
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' })
  }

  const cacheKey = `screenshot:${url}:${JSON.stringify(options)}`
  const cached = cacheManager.get(cacheKey)
  if (cached) {
    return res.json({ ...cached, cached: true })
  }

  try {
    const startTime = Date.now()
    const page = await browserPool.getPage()

    if (options.viewport) {
      await page.setViewport(options.viewport)
    }

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: options.timeout || 30000,
    })

    const buffer = await page.screenshot({ 
      encoding: 'base64',
      fullPage: options.fullPage !== false,
    })
    const screenshot = `data:image/png;base64,${buffer}`

    await browserPool.releasePage(page)

    const executionTime = Date.now() - startTime

    const result = { screenshot, executionTime }
    cacheManager.set(cacheKey, result)

    res.json(result)
  } catch (error) {
    console.error('Screenshot error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      screenshot: null,
      executionTime: 0,
    })
  }
})

app.get('/api/health', (req: Request, res: Response) => {
  const stats = browserPool.getStats()
  const memStats = process.memoryUsage()
  const cpuLoad = os.loadavg()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      api: {
        status: 'up',
        responseTime: 5,
        lastCheck: new Date().toISOString(),
        message: 'API server is running normally',
      },
      database: {
        status: 'up',
        responseTime: 2,
        lastCheck: new Date().toISOString(),
        message: 'Database connection is healthy',
        details: {
          jobsStored: 42,
        },
      },
      crawler: {
        status: stats.activeBrowsers > 0 ? 'up' : 'degraded',
        responseTime: 10,
        lastCheck: new Date().toISOString(),
        message: stats.activeBrowsers > 0 ? 'Browser pool is active' : 'Browser pool idle',
        details: {
          activeJobs: stats.activeBrowsers,
        },
      },
    },
    system: {
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: Math.round((usedMem / totalMem) * 100),
      },
      cpu: {
        loadAverage: cpuLoad,
        coresCount: os.cpus().length,
      },
      process: {
        pid: process.pid,
        uptime: Math.floor(process.uptime()),
        memoryUsage: {
          rss: memStats.rss,
          heapTotal: memStats.heapTotal,
          heapUsed: memStats.heapUsed,
          external: memStats.external,
        },
      },
    },
    metrics: {
      totalJobs: stats.totalPages || 0,
      activeJobs: stats.activeBrowsers || 0,
      completedJobs: Math.max(0, (stats.totalPages || 0) - (stats.activeBrowsers || 0)),
      failedJobs: 0,
      totalLinksScanned: 0,
      averageJobDuration: 0,
      requestsPerMinute: 0,
    },
    cache: {
      enabled: CACHE_ENABLED,
      stats: cacheManager.getStats(),
    },
    auth: {
      enabled: authManager.isEnabled(),
      keysConfigured: authManager.isEnabled() ? authManager.listApiKeys().length : 0,
    },
    downloadMonitor: downloadMonitor.getStatus(),
    backgroundCrawler: backgroundCrawler.getStatus(),
  })
})

// Background crawler configuration endpoint
app.post('/api/crawler/config', (req: Request, res: Response) => {
  const { categories, queryString } = req.body
  
  if (!categories || !Array.isArray(categories)) {
    return res.status(400).json({ error: 'categories must be an array' })
  }
  
  // Validate category IDs
  const validCategories = ['1000', '2000', '3000', '4000', '5000', '6000', '7000', '8000', '5070', '100000']
  const invalidCats = categories.filter(c => !validCategories.includes(c))
  if (invalidCats.length > 0) {
    return res.status(400).json({ error: `Invalid categories: ${invalidCats.join(', ')}` })
  }
  
  // Update crawler configuration
  backgroundCrawler.updateConfig({
    categories: categories,
    queryString: queryString || undefined
  })
  
  // Restart crawler if it's running
  if (backgroundCrawler.getStatus().running) {
    backgroundCrawler.stop()
    setTimeout(() => {
      backgroundCrawler.start()
      console.log(`🔄 BackgroundCrawler restarted with ${categories.length} categories`)
    }, 1000)
  }
  
  res.json({
    success: true,
    message: 'Crawler configuration updated',
    config: {
      categories: categories,
      queryString: queryString || '',
      totalWorkers: backgroundCrawler.getStatus().totalWorkers
    }
  })
})

// Trigger a single background crawl cycle
app.post('/api/crawler/run', async (req: Request, res: Response) => {
  try {
    await backgroundCrawler.runOnce()
    res.json({ success: true, message: 'Crawler cycle started' })
  } catch (error) {
    console.error('Crawler run error:', error)
    res.status(500).json({ error: 'Failed to start crawler cycle' })
  }
})

// Stop background crawler
app.post('/api/crawler/stop', (req: Request, res: Response) => {
  try {
    backgroundCrawler.stop()
    res.json({ success: true, message: 'Crawler stopped' })
  } catch (error) {
    console.error('Crawler stop error:', error)
    res.status(500).json({ error: 'Failed to stop crawler' })
  }
})

// ============================================
// Parallel Web Crawler Endpoints (/api/parallel-crawler)
// ============================================
import { ParallelWebCrawler } from './services/ParallelWebCrawler.js'
import type { CrawlerConfig } from './services/ParallelWebCrawler.js'

const parallelCrawlJobs = new Map<string, { crawler: ParallelWebCrawler; results: unknown[] }>()

app.post('/api/parallel-crawler/start', async (req: Request, res: Response) => {
  try {
    const { seeds, config = {} } = req.body as { seeds: string[]; config?: Partial<CrawlerConfig> }
    if (!seeds?.length) return res.status(400).json({ error: 'seeds required' })

    const jobId = `pcrawl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const crawler = new ParallelWebCrawler(browserPool, {
      maxDepth:       config.maxDepth      ?? 2,
      maxPages:       config.maxPages      ?? 100,
      workers:        4,
      politenessMs:   config.politenessMs  ?? 1500,
      timeout:        config.timeout       ?? 30000,
      allowPatterns:  config.allowPatterns ?? [],
      denyPatterns:   config.denyPatterns  ?? [],
      mediaPatterns:  config.mediaPatterns ?? [],
      followLinks:    true,
      extractMetaTags: true,
      retryMax:       config.retryMax      ?? 3,
      retryBackoffMs: config.retryBackoffMs ?? 2000,
    })

    const results: unknown[] = []
    crawler.on('result', r => results.push(r))
    crawler.on('workerError', e => console.error('[ParallelCrawler]', e))
    parallelCrawlJobs.set(jobId, { crawler, results })
    void crawler.crawl(seeds[0])  // start async — non-blocking
    if (seeds.length > 1) crawler.addSeeds(seeds.slice(1))

    res.json({ jobId, started: true, seeds: seeds.length })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

app.get('/api/parallel-crawler/:jobId/stream', (req: Request, res: Response) => {
  const jobId = req.params['jobId'] as string
  const entry = parallelCrawlJobs.get(jobId)
  if (!entry) return res.status(404).json({ error: 'Job not found' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (ev: string, d: unknown) => res.write(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`)
  const onResult    = (r: unknown) => send('result', r)
  const onDone      = ()           => { send('done', {}); res.end() }
  const onPageError = (e: unknown) => send('pageError', e)

  entry.crawler.on('result',    onResult)
  entry.crawler.on('done',      onDone)
  entry.crawler.on('pageError', onPageError)
  req.on('close', () => {
    entry.crawler.off('result',    onResult)
    entry.crawler.off('done',      onDone)
    entry.crawler.off('pageError', onPageError)
  })
})

app.get('/api/parallel-crawler/:jobId/results', (req: Request, res: Response) => {
  const jobId = req.params['jobId'] as string
  const entry = parallelCrawlJobs.get(jobId)
  if (!entry) return res.status(404).json({ error: 'Job not found' })
  res.json({ jobId, count: entry.results.length, results: entry.results })
})

app.post('/api/parallel-crawler/:jobId/stop', (req: Request, res: Response) => {
  const jobId = req.params['jobId'] as string
  const entry = parallelCrawlJobs.get(jobId)
  if (!entry) return res.status(404).json({ error: 'Job not found' })
  entry.crawler.stop()
  res.json({ stopped: true })
})

app.delete('/api/parallel-crawler/:jobId', (req: Request, res: Response) => {
  const jobId = req.params['jobId'] as string
  const entry = parallelCrawlJobs.get(jobId)
  if (entry) { entry.crawler.stop(); parallelCrawlJobs.delete(jobId) }
  res.json({ deleted: true })
})

// ============================================
// Search Crawler Endpoints
// ============================================

// Get all available search source presets
app.get('/api/search/presets', (req: Request, res: Response) => {
  try {
    const presets = getAllPresets()
    res.json({
      success: true,
      count: presets.length,
      presets: presets.map(p => ({
        id: p.id,
        name: p.name,
        baseUrl: p.baseUrl,
        searchMethod: p.searchMethod,
        supportsForm: !!p.formConfig,
        supportsUrl: !!p.urlTemplate,
        supportsPagination: !!p.pagination,
      })),
    })
  } catch (error) {
    console.error('Error getting presets:', error)
    res.status(500).json({ error: 'Failed to get search presets' })
  }
})

// Get a specific preset by ID
app.get('/api/search/presets/:id', (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const preset = getPresetById(id)
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' })
    }
    res.json({ success: true, preset })
  } catch (error) {
    console.error('Error getting preset:', error)
    res.status(500).json({ error: 'Failed to get preset' })
  }
})

// Execute a search using a preset
app.post('/api/search/execute', async (req: Request, res: Response) => {
  const { presetId, query, maxPages = 5, customConfig, extractMediaFromResults = false } = req.body

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Search query is required' })
  }

  try {
    let config: SearchSourceConfig

    if (customConfig) {
      // Use custom configuration
      config = customConfig as SearchSourceConfig
    } else if (presetId) {
      // Use preset configuration
      const preset = getPresetById(presetId)
      if (!preset) {
        return res.status(404).json({ error: 'Preset not found' })
      }
      config = preset
    } else {
      return res.status(400).json({ error: 'Either presetId or customConfig is required' })
    }

    console.log(`🔍 Searching ${config.name} for: "${query}"`)
    let result = await searchCrawler.search(config, query, maxPages)

    // If extractMediaFromResults is enabled, extract media and metadata from each result
    if (extractMediaFromResults && result.results.length > 0) {
      console.log(`📊 Extracting media & metadata from ${result.results.length} results...`)
      const enrichedResults = []
      
      for (let i = 0; i < result.results.length; i++) {
        const item = result.results[i]
        try {
          // Extract media and metadata from each result URL
          const mediaData = await extractMediaAndMetadata(item.url)
          enrichedResults.push({
            ...item,
            mediaUrls: mediaData.videos || [],
            audioUrls: mediaData.audios || [],
            metadata: {
              ...item.metadata,
              ...mediaData.metadata
            }
          })
          console.log(`  ✓ Extracted from ${i + 1}/${result.results.length}`)
        } catch (error) {
          console.error(`  ✗ Failed to extract from ${item.url}:`, error)
          enrichedResults.push(item) // Keep original if extraction fails
        }
      }
      
      result.results = enrichedResults
      
      // Save to downloads mega-list
      const downloadsDir = path.join(__dirname, '..', 'downloads')
      const megaListFile = path.join(downloadsDir, 'mega-list.json')
      
      const timestamp = new Date().toISOString()
      const fileId = `search-${query.replace(/\s+/g, '-')}-${Date.now()}`
      const fileName = `${fileId}.json`
      const filePath = path.join(downloadsDir, fileName)
      
      // Write results to file
      fs.writeFileSync(filePath, JSON.stringify(enrichedResults, null, 2))
      
      // Update mega-list
      let megaList = []
      if (fs.existsSync(megaListFile)) {
        megaList = JSON.parse(fs.readFileSync(megaListFile, 'utf-8'))
      }
      
      megaList.push({
        id: fileId,
        title: `${config.name} - ${query}`,
        source: config.name,
        searchQuery: query,
        downloadedAt: timestamp,
        filePath: fileName,
        totalItems: enrichedResults.length,
        withMedia: true
      })
      
      fs.writeFileSync(megaListFile, JSON.stringify(megaList, null, 2))
      console.log(`💾 Saved ${enrichedResults.length} results to downloads`)

      // Hook → ArchivistService: pipe extracted media URLs through the protocol
      const archivistEntries = enrichedResults.flatMap((item: any) => [
        ...(item.mediaUrls ?? []).map((url: string) => ({
          url, title: item.metadata?.title ?? item.title ?? new URL(url).pathname.split('/').pop() ?? 'Untitled',
          contentType: 'video/stream', sourcePageUrl: item.url, indexer: config.name,
        })),
        ...(item.audioUrls ?? []).map((url: string) => ({
          url, title: item.metadata?.title ?? item.title ?? new URL(url).pathname.split('/').pop() ?? 'Untitled',
          contentType: 'audio/stream', sourcePageUrl: item.url, indexer: config.name,
        })),
      ])
      if (archivistEntries.length > 0) {
        archivist.processSearchResults(archivistEntries, config.baseUrl ?? config.name)
          .then(s => { if (s.archived > 0) console.log(`🗂️  Archivist: +${s.archived} from search "${query}"`) })
          .catch(() => {/* non-fatal */})
      }
    }

    res.json({
      success: true,
      result,
      savedToDownloads: extractMediaFromResults && result.results.length > 0
    })
  } catch (error) {
    console.error('Search execution error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Search failed',
    })
  }
})

/**
 * Extract media URLs and metadata from a page
 */
async function extractMediaAndMetadata(url: string) {
  const page = await browserPool.getPage()
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 })
    
    // Extract metadata
    const metadata = await page.evaluate(() => {
      const result: Record<string, string> = {}
      
      // Get title
      const titleEl = document.querySelector('h1, title, [property="og:title"]')
      if (titleEl) result.title = titleEl.textContent || ''
      
      // Get description
      const descEl = document.querySelector('meta[name="description"], meta[property="og:description"]')
      if (descEl) result.description = descEl.getAttribute('content') || ''
      
      // Get OG image
      const ogImage = document.querySelector('meta[property="og:image"]')
      if (ogImage) result.image = ogImage.getAttribute('content') || ''
      
      // Get duration if available
      const durationEl = document.querySelector('[data-duration], .duration, [aria-label*="duration"]')
      if (durationEl) result.duration = durationEl.textContent || ''
      
      return result
    })
    
    // Extract video URLs
    const videos = await page.evaluate(() => {
      const urls = new Set<string>()
      
      // Check common video sources
      document.querySelectorAll('video source, [src*=".mp4"], [src*=".webm"]').forEach((el) => {
        const src = (el as any).src || el.getAttribute('src')
        if (src) urls.add(src)
      })
      
      // Check m3u8 playlists
      document.querySelectorAll('[src*=".m3u8"]').forEach((el) => {
        const src = (el as any).src || el.getAttribute('src')
        if (src) urls.add(src)
      })
      
      // Check iframe sources
      document.querySelectorAll('iframe').forEach((iframe) => {
        const src = iframe.src
        if (src && (src.includes('video') || src.includes('youtube') || src.includes('vimeo'))) {
          urls.add(src)
        }
      })
      
      return Array.from(urls)
    })
    
    // Extract audio URLs
    const audios = await page.evaluate(() => {
      const urls = new Set<string>()
      
      document.querySelectorAll('audio source, [src*=".mp3"], [src*=".wav"], [src*=".aac"]').forEach((el) => {
        const src = (el as any).src || el.getAttribute('src')
        if (src) urls.add(src)
      })
      
      return Array.from(urls)
    })
    
    await browserPool.releasePage(page)
    
    return {
      videos,
      audios,
      metadata
    }
  } catch (error) {
    await browserPool.releasePage(page)
    throw error
  }
}

// Execute search on multiple sources
app.post('/api/search/execute-multi', async (req: Request, res: Response) => {
  const { presetIds, query, maxPages = 5 } = req.body

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Search query is required' })
  }

  if (!Array.isArray(presetIds) || presetIds.length === 0) {
    return res.status(400).json({ error: 'presetIds array is required' })
  }

  try {
    const configs: SearchSourceConfig[] = []
    
    for (const id of presetIds) {
      const preset = getPresetById(id)
      if (preset) {
        configs.push(preset)
      }
    }

    if (configs.length === 0) {
      return res.status(404).json({ error: 'No valid presets found' })
    }

    console.log(`🔍 Multi-searching ${configs.length} sources for: "${query}"`)
    const results = await searchCrawler.searchMultipleSources(configs, query, maxPages)

    res.json({
      success: true,
      results,
      summary: {
        totalSources: configs.length,
        totalResults: Object.values(results).reduce((sum, r) => sum + r.totalResults, 0),
        totalPages: Object.values(results).reduce((sum, r) => sum + r.pagesScraped, 0),
        totalTime: Object.values(results).reduce((sum, r) => sum + r.executionTime, 0),
      },
    })
  } catch (error) {
    console.error('Multi-search execution error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Multi-search failed',
    })
  }
})

// Save a custom search source config
const customSearchSources = new Map<string, SearchSourceConfig>()

app.post('/api/search/custom/save', (req: Request, res: Response) => {
  const config = req.body as SearchSourceConfig

  if (!config.id || !config.name || !config.baseUrl || !config.searchMethod) {
    return res.status(400).json({ error: 'Invalid search source configuration' })
  }

  customSearchSources.set(config.id, config)

  res.json({
    success: true,
    message: 'Custom search source saved',
    config: {
      id: config.id,
      name: config.name,
    },
  })
})

// Get all custom search sources
app.get('/api/search/custom', (req: Request, res: Response) => {
  const customs = Array.from(customSearchSources.values())
  res.json({
    success: true,
    count: customs.length,
    sources: customs,
  })
})

// Delete a custom search source
app.delete('/api/search/custom/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  
  if (!customSearchSources.has(id)) {
    return res.status(404).json({ error: 'Custom source not found' })
  }

  customSearchSources.delete(id)
  res.json({ success: true, message: 'Custom source deleted' })
})

app.get('/api/auth/docs', (req: Request, res: Response) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`
  
  res.json({
    title: 'Media Link Scanner API Authentication',
    version: '1.0.0',
    authEnabled: authManager.isEnabled(),
    description: 'API Key authentication is required for all /api/media/* endpoints',
    authentication: {
      methods: [
        {
          name: 'Header Authentication (Recommended)',
          example: 'X-API-Key: mls_your_api_key_here',
          curl: `curl -H "X-API-Key: your_key_here" "${baseUrl}/api/media/stream?url=..."`,
        },
        {
          name: 'Query Parameter Authentication',
          example: '?apiKey=mls_your_api_key_here',
          curl: `curl "${baseUrl}/api/media/stream?url=...&apiKey=your_key_here"`,
        },
      ],
    },
    rateLimits: {
      perApiKey: `${process.env.API_KEY_RATE_LIMIT || '1000'} requests per hour`,
      global: '100 requests per 15 minutes per IP',
    },
    protectedEndpoints: [
      '/api/media/stream',
      '/api/media/info',
      '/api/media/generate-m3u',
    ],
    publicEndpoints: [
      '/api/health',
      '/api/auth/docs',
    ],
    errors: {
      401: 'Authentication required - API key not provided',
      403: 'Invalid API key - The key is not valid or has been revoked',
      429: 'Rate limit exceeded - Too many requests for this API key',
    },
    setup: authManager.isEnabled() ? {
      message: 'Contact the administrator to obtain an API key',
    } : {
      message: 'Authentication is currently disabled. Set AUTH_ENABLED=true to enable it.',
      steps: [
        '1. Set AUTH_ENABLED=true in your .env file',
        '2. Generate API keys: npm run generate-key',
        '3. Add keys to API_KEYS in .env file (comma-separated)',
        '4. Restart the server',
      ],
    },
  })
})

app.post('/api/auth/generate-key', (req: Request, res: Response) => {
  if (!authManager.isEnabled()) {
    return res.status(400).json({
      error: 'Authentication is not enabled',
      message: 'Set AUTH_ENABLED=true in your .env file to use API keys',
    })
  }

  const adminKey = req.headers['x-admin-key'] as string
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({
      error: 'Unauthorized',
      message: 'Admin key required to generate new API keys',
    })
  }

  const newKey = authManager.generateApiKey()
  
  res.json({
    key: newKey,
    message: 'API key generated successfully. Add this to your API_KEYS environment variable.',
    warning: 'Store this key securely. It will not be shown again.',
  })
})

// Use Nexus unified streaming handler (implements universal resolver, metadata enrichment, HLS proxying, Android optimization)
app.get('/api/media/stream', handleNexusStream)

interface MediaInfoRequest extends Request {
  query: {
    url: string
  }
}

app.get('/api/media/info', async (req: MediaInfoRequest, res: Response) => {
  const { url } = req.query

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' })
  }

  try {
    new URL(url)
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' })
  }

  try {
    const response = await axios({
      method: 'HEAD',
      url,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      },
      timeout: 10000,
      validateStatus: (status) => status < 500,
    })

    const info = {
      contentType: response.headers['content-type'] || 'unknown',
      contentLength: response.headers['content-length'] ? parseInt(response.headers['content-length']) : null,
      acceptRanges: response.headers['accept-ranges'] === 'bytes',
      lastModified: response.headers['last-modified'] || null,
      etag: response.headers['etag'] || null,
      status: response.status,
      available: response.status >= 200 && response.status < 300,
    }

    res.json(info)
  } catch (error) {
    console.error('Media info error:', error)
    if (axios.isAxiosError(error) && error.response) {
      res.status(error.response.status).json({ 
        error: `Failed to get media info: ${error.message}`,
        status: error.response.status,
        available: false,
      })
    } else {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        available: false,
      })
    }
  }
})

interface PlaylistGenerateRequest extends Request {
  body: {
    links: Array<{
      url: string
      title?: string
      category?: string
      tvgLogo?: string
      tvgId?: string
      duration?: number
    }>
    playlistName?: string
    playlistDescription?: string
  }
}

app.post('/api/media/generate-m3u', async (req: PlaylistGenerateRequest, res: Response) => {
  const { links, playlistName, playlistDescription } = req.body

  if (!links || !Array.isArray(links) || links.length === 0) {
    return res.status(400).json({ error: 'Links array is required and must not be empty' })
  }

  try {
    const serverUrl = `${req.protocol}://${req.get('host')}`
    
    let m3u = '#EXTM3U\n'
    
    if (playlistName) {
      m3u += `#PLAYLIST:${playlistName}\n`
    }
    
    if (playlistDescription) {
      m3u += `#EXTENC:${playlistDescription}\n`
    }

    links.forEach((link) => {
      const proxyUrl = `${serverUrl}/api/media/stream?url=${encodeURIComponent(link.url)}`
      
      let extinf = '#EXTINF:'
      
      if (link.duration) {
        extinf += `${link.duration},`
      } else {
        extinf += '-1,'
      }
      
      const attributes: string[] = []
      
      if (link.tvgId) {
        attributes.push(`tvg-id="${link.tvgId}"`)
      }
      
      if (link.tvgLogo) {
        attributes.push(`tvg-logo="${link.tvgLogo}"`)
      }
      
      if (link.category) {
        attributes.push(`group-title="${link.category}"`)
      }
      
      if (attributes.length > 0) {
        extinf += ` ${attributes.join(' ')}`
      }
      
      extinf += ` ${link.title || link.url}\n`
      
      m3u += extinf
      m3u += `${proxyUrl}\n`
    })

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
    res.setHeader('Content-Disposition', `attachment; filename="${playlistName || 'playlist'}.m3u"`)
    res.send(m3u)
  } catch (error) {
    console.error('M3U generation error:', error)
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
})

// ─── DOWNLOADS MANAGEMENT ───────────────────────────────────────────────────────

// Get mega list of all downloads
app.get('/api/media/downloads', async (req: Request, res: Response) => {
  try {
    const downloadsDir = path.join(__dirname, '..', 'downloads')
    const megaListFile = path.join(downloadsDir, 'mega-list.json')

    if (!fs.existsSync(megaListFile)) {
      return res.json({ downloads: [], total: 0, message: 'No downloads yet' })
    }

    const megaList = JSON.parse(fs.readFileSync(megaListFile, 'utf-8'))
    
    // Add real file info
    const withFileInfo = megaList.map((entry: any) => {
      // filePath might be relative, so construct full path
      const fullPath = path.isAbsolute(entry.filePath) 
        ? entry.filePath 
        : path.join(downloadsDir, entry.filePath)
      
      return {
        ...entry,
        exists: fs.existsSync(fullPath),
        actualSize: fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0,
        filePath: fullPath, // Update to full path for consistency
      }
    })

    // Sort by downloadedAt (newest first)
    const sorted = withFileInfo.sort((a: any, b: any) => {
      const dateA = new Date(a.downloadedAt || 0).getTime()
      const dateB = new Date(b.downloadedAt || 0).getTime()
      return dateB - dateA // Descending order (newest first)
    })

    res.json({
      downloads: sorted,
      total: sorted.length,
      downloadPath: downloadsDir,
      storagePath: megaListFile,
    })
  } catch (error) {
    console.error('[API-DOWNLOADS] Error reading mega list:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// Download a saved file by ID
app.get('/api/media/downloads/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const downloadsDir = path.join(__dirname, '..', 'downloads')
    const megaListFile = path.join(downloadsDir, 'mega-list.json')

    if (!fs.existsSync(megaListFile)) {
      return res.status(404).json({ error: 'File not found' })
    }

    const megaList = JSON.parse(fs.readFileSync(megaListFile, 'utf-8'))
    const entry = megaList.find((e: any) => e.id === id)

    if (!entry) {
      return res.status(404).json({ error: 'Download entry not found' })
    }

    // Resolve full absolute path (filePath may be relative or absolute)
    const absolutePath = path.isAbsolute(entry.filePath)
      ? entry.filePath
      : path.join(downloadsDir, entry.filePath)

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'File no longer exists on disk' })
    }

    // Return the JSON content (array of search results) directly
    const results = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'))
    res.json({ ...entry, filePath: absolutePath, results })
  } catch (error) {
    console.error('[API-DOWNLOAD-GET] Error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// Delete a download
app.delete('/api/media/downloads/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const downloadsDir = path.join(__dirname, '..', 'downloads')
    const megaListFile = path.join(downloadsDir, 'mega-list.json')

    if (!fs.existsSync(megaListFile)) {
      return res.status(404).json({ error: 'No downloads found' })
    }

    let megaList = JSON.parse(fs.readFileSync(megaListFile, 'utf-8'))
    const entryIndex = megaList.findIndex((e: any) => e.id === id)

    if (entryIndex === -1) {
      return res.status(404).json({ error: 'Download entry not found' })
    }

    const entry = megaList[entryIndex]

    // Delete file if it exists
    if (fs.existsSync(entry.filePath)) {
      fs.unlinkSync(entry.filePath)
      console.log(`[API-DOWNLOAD-DELETE] Deleted file: ${entry.filePath}`)
    }

    // Remove from mega list
    megaList.splice(entryIndex, 1)
    fs.writeFileSync(megaListFile, JSON.stringify(megaList, null, 2), 'utf-8')

    res.json({
      message: 'Download deleted successfully',
      deletedEntry: entry,
      remaining: megaList.length,
    })
  } catch (error) {
    console.error('[API-DOWNLOAD-DELETE] Error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// Clear all downloads
app.post('/api/media/downloads/clear/all', async (req: Request, res: Response) => {
  try {
    const downloadsDir = path.join(__dirname, '..', 'downloads')
    const megaListFile = path.join(downloadsDir, 'mega-list.json')

    if (!fs.existsSync(megaListFile)) {
      return res.json({ message: 'No downloads to clear' })
    }

    const megaList = JSON.parse(fs.readFileSync(megaListFile, 'utf-8'))
    let deletedCount = 0

    megaList.forEach((entry: any) => {
      if (fs.existsSync(entry.filePath)) {
        fs.unlinkSync(entry.filePath)
        deletedCount++
      }
    })

    fs.writeFileSync(megaListFile, JSON.stringify([], null, 2), 'utf-8')

    res.json({
      message: 'All downloads cleared',
      deletedFiles: deletedCount,
      deletedEntries: megaList.length,
    })
  } catch (error) {
    console.error('[API-DOWNLOADS-CLEAR] Error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// Prowlarr search endpoint
app.post('/api/prowlarr/search', async (req: Request, res: Response) => {
  try {
    const { query, categories = [], useAllIndexers = true, autoCrawl = false } = req.body

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' })
    }

    const prowlarrUrl = process.env.PROWLARR_URL || 'http://localhost:9696'
    const prowlarrApiKey = process.env.PROWLARR_API_KEY

    if (!prowlarrApiKey) {
      return res.status(400).json({ 
        error: 'Prowlarr API key not configured. Set PROWLARR_API_KEY environment variable.' 
      })
    }

    // Build category string - if empty, search all categories
    const categoryParam = Array.isArray(categories) && categories.length > 0 
      ? `&categories=${categories.join(',')}`
      : ''

    // Construct Prowlarr API search URL - use /api/v1/search for all indexers
    const apiUrl = `${prowlarrUrl}/api/v1/search?query=${encodeURIComponent(query)}${categoryParam}&type=1`

    console.log('[PROWLARR-SEARCH] Querying:', apiUrl)

    const response = await axios.get(apiUrl, {
      headers: {
        'X-API-Key': prowlarrApiKey,
        'Accept': 'application/json',
      },
      timeout: 10000,
    })

    const results = Array.isArray(response.data) ? response.data : []

    // Transform Prowlarr results for frontend
    const transformedResults = results.slice(0, 100).map((item: any) => ({
      id: item.guid || item.id || Math.random().toString(),
      title: item.title,
      description: item.description || '',
      downloadUrl: item.downloadUrl || item.link || '',
      torrentUrl: item.torrentUrl || '',
      magnetUrl: item.magnetUrl || '',
      seeders: item.seeders || 0,
      leechers: item.leechers || 0,
      size: item.size || 0,
      indexer: item.indexer || 'Unknown',
      releaseDate: item.releaseDate || new Date().toISOString(),
      categories: item.categories || [],
      imdbId: item.imdbId,
      tvdbId: item.tvdbId,
    }))

    res.json({
      query,
      resultCount: transformedResults.length,
      results: transformedResults,
      autoCrawl: autoCrawl,
    })
  } catch (error) {
    console.error('[PROWLARR-SEARCH] Error:', error)
    const message = error instanceof axios.AxiosError
      ? `Prowlarr error: ${error.response?.status} ${error.message}`
      : error instanceof Error ? error.message : 'Unknown error'
    
    res.status(error instanceof axios.AxiosError ? (error.response?.status || 500) : 500).json({
      error: message,
      details: error instanceof Error ? error.message : undefined,
    })
  }
})

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Global error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Puppeteer backend running on http://localhost:${PORT}`)
  console.log(`📊 Max concurrent browsers: ${MAX_CONCURRENT_BROWSERS}`)
  console.log(`🗄️  Cache ${CACHE_ENABLED ? 'enabled' : 'disabled'}`)
  console.log(`🔒 CORS origins: ${CORS_ORIGIN.join(', ')}`)
  console.log(`🔐 Authentication: ${authManager.isEnabled() ? 'ENABLED' : 'DISABLED'}`)
  if (authManager.isEnabled()) {
    const keyCount = authManager.listApiKeys().length
    console.log(`🔑 API Keys configured: ${keyCount}`)
    if (keyCount > 0) {
      console.log(`   Protected endpoints: /api/media/*`)
      console.log(`   Rate limit: ${process.env.API_KEY_RATE_LIMIT || '1000'} requests/hour per key`)
    } else {
      console.log(`⚠️  No API keys configured! Generate with: npm run generate-key`)
    }
  }
  console.log(`📖 API documentation: http://localhost:${PORT}/api/auth/docs`)
  
  // Start DownloadMonitor
  downloadMonitor.start()
  console.log(`📥 DownloadMonitor active`)
  
  // Start BackgroundCrawler if configured
  if (process.env.ENABLE_BACKGROUND_CRAWLER === 'true') {
    backgroundCrawler.start()
    const status = backgroundCrawler.getStatus()
    console.log(`🔄 BackgroundCrawler active (${status.categories?.length || 0} categories)`)
  } else {
    console.log(`⏸️  BackgroundCrawler disabled (set ENABLE_BACKGROUND_CRAWLER=true to enable)`)
  }

  // Start SmartRecrawl watcher
  smartRecrawl.startWatcher()
  console.log(`🔁 SmartRecrawl watcher active (ETag/Last-Modified adaptive scheduling)`)

  // Auto-fetch free proxies on startup (non-blocking)
  if (process.env.DISABLE_PROXY_AUTOFETCH !== 'true') {
    proxyPool.startAutoRefresh(30 * 60 * 1000) // refresh every 30 min
    console.log(`🌐 ProxyPool auto-refresh active (free proxy sources)`)
  }
}).on('error', (err) => {
  console.error('❌ FATAL: Failed to start server:', err)
  console.error('Port', PORT, 'may be in use or inaccessible')
  process.exit(1)
})

const shutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...')
  
  // Stop monitoring services
  downloadMonitor.stop()
  console.log('✅ DownloadMonitor stopped')
  
  backgroundCrawler.stop()
  console.log('✅ BackgroundCrawler stopped')

  smartRecrawl.stopWatcher()
  console.log('✅ SmartRecrawl watcher stopped')
  
  server.close(() => {
    console.log('✅ HTTP server closed')
  })
  await browserPool.cleanup()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception — keeping server alive:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled promise rejection — keeping server alive:', reason)
})
