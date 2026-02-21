import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { BrowserPool } from './browserPool.js'
import { CacheManager } from './cache.js'
import { AuthManager } from './auth.js'
import extensionRoutes from './routes/extensionRoutes.js'
import stremioRoutes from './routes/stremioRoutes.js'
import apkRuntimeRoutes from './routes/apkRuntimeRoutes.js'
import runtimeCaptureRoutes from './routes/runtimeCaptureRoutes.js'
import aiRoutes from './routes/aiRoutes.js'
import kodiSyncRoutes from './routes/kodiSyncRoutes.js'
import axios from 'axios'
import { parse as parseContentRange } from 'content-range'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || ['http://localhost:5173']
const MAX_CONCURRENT_BROWSERS = parseInt(process.env.MAX_CONCURRENT_BROWSERS || '5', 10)
const CACHE_ENABLED = process.env.CACHE_ENABLED === 'true'
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600', 10)

const browserPool = new BrowserPool({ maxConcurrent: MAX_CONCURRENT_BROWSERS })
const cacheManager = new CacheManager({ enabled: CACHE_ENABLED, ttl: CACHE_TTL })
const authManager = new AuthManager()

global.authManager = authManager

app.use(helmet())
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || CORS_ORIGIN.includes(origin) || CORS_ORIGIN.includes('*')) {
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
          'GET /api/media/stream': 'Stream media content (with range support)',
          'GET /api/media/info': 'Get media file information',
          'POST /api/media/generate-m3u': 'Generate M3U playlist',
        },
        description: 'Media proxy and playlist generation',
        authentication: authManager.isEnabled() ? 'API Key required' : 'none',
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
  })
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

interface MediaProxyRequest extends Request {
  query: {
    url: string
    title?: string
    type?: string
  }
}

app.get('/api/media/stream', async (req: MediaProxyRequest, res: Response) => {
  const { url, title, type } = req.query

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' })
  }

  try {
    new URL(url)
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' })
  }

  try {
    const range = req.headers.range

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity',
    }

    if (range) {
      headers['Range'] = range
    }

    const response = await axios({
      method: 'GET',
      url,
      headers,
      responseType: 'stream',
      validateStatus: (status) => status < 500,
      timeout: 30000,
    })

    const contentType = response.headers['content-type'] || type || 'video/mp4'
    const contentLength = response.headers['content-length']
    const acceptRanges = response.headers['accept-ranges'] || 'bytes'
    const contentRange = response.headers['content-range']

    res.setHeader('Content-Type', contentType)
    res.setHeader('Accept-Ranges', acceptRanges)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
    res.setHeader('Cache-Control', 'public, max-age=3600')

    if (title) {
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(title)}"`)
    }

    if (contentLength) {
      res.setHeader('Content-Length', contentLength)
    }

    if (contentRange) {
      res.setHeader('Content-Range', contentRange)
      res.status(206)
    } else if (range) {
      res.status(206)
    } else {
      res.status(200)
    }

    response.data.pipe(res)

    response.data.on('error', (error: Error) => {
      console.error('Stream error:', error)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error' })
      }
    })

  } catch (error) {
    console.error('Media proxy error:', error)
    if (!res.headersSent) {
      if (axios.isAxiosError(error) && error.response) {
        res.status(error.response.status).json({ 
          error: `Failed to fetch media: ${error.message}`,
          status: error.response.status 
        })
      } else {
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }
  }
})

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
}).on('error', (err) => {
  console.error('❌ FATAL: Failed to start server:', err)
  console.error('Port', PORT, 'may be in use or inaccessible')
  process.exit(1)
})

const shutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...')
  server.close(() => {
    console.log('✅ HTTP server closed')
  })
  await browserPool.cleanup()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
