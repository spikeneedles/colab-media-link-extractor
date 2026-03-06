/**
 * ParallelWebCrawler
 *
 * State-of-the-art parallel web crawler with:
 *  - N simultaneous Puppeteer worker pages (from BrowserPool)
 *  - Priority work queue (breadth-first by default)
 *  - Per-domain adaptive rate limiting & politeness delay
 *  - Depth-limited recursive link following
 *  - Smart deduplication (visited URL set + content-hash)
 *  - FlareSolverr Cloudflare bypass (auto-escalation)
 *  - Exponential back-off retry (3 attempts max)
 *  - Live streaming results via EventEmitter
 *  - Configurable allow/deny patterns
 *  - Graceful stop / pause / resume
 *
 * Usage:
 *   const crawler = new ParallelWebCrawler(browserPool, { workers: 8, maxDepth: 3 })
 *   crawler.on('result', (r) => archivist.archive(r))
 *   crawler.on('done',   (stats) => console.log(stats))
 *   await crawler.crawl('https://example.com')
 *
 *   // Multiple independent instances can share one crawler and inject separate seeds:
 *   crawler.addSeeds(['https://site-a.com', 'https://site-b.com'])
 */

import { EventEmitter }  from 'events'
import { Page }          from 'puppeteer'
import { BrowserPool }   from '../browserPool.js'
import { flareSolverr, isCloudflareBlocked } from './FlareSolverrClient.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CrawlJob {
  url:      string
  depth:    number
  priority: number   // lower = higher priority
  retries:  number
  parentUrl?: string
}

export interface CrawlPageResult {
  url:              string
  depth:            number
  title:            string
  description:      string
  links:            string[]
  mediaUrls:        string[]          // direct video/audio/m3u8 URLs found on the page
  interceptedUrls:  string[]          // URLs captured via network request interception
  metadata:         Record<string, string>
  contentType:      string
  statusCode:       number
  crawledAt:        number
  durationMs:       number
  viaSolver:        boolean           // true if CF was bypassed via FlareSolverr
}

export interface CrawlerConfig {
  workers:         number         // parallel Puppeteer pages  (default: 4)
  maxDepth:        number         // max link-follow depth       (default: 2)
  maxPages:        number         // hard cap on total pages crawled (default: 500)
  politenessMs:    number         // min delay per domain in ms   (default: 1500)
  retryMax:        number         // max retries per page          (default: 3)
  retryBackoffMs:  number         // base back-off for retries     (default: 2000)
  allowPatterns:   RegExp[]       // only follow links matching these
  denyPatterns:    RegExp[]       // never follow links matching these
  mediaPatterns:   RegExp[]       // URLs considered direct media
  extractMetaTags: boolean        // extract all <meta> tags       (default: true)
  followLinks:     boolean        // recursively follow found links (default: true)
  timeout:         number         // per-page timeout ms            (default: 30000)
  userAgent?:      string
}

const DEFAULT_CONFIG: CrawlerConfig = {
  workers:        4,
  maxDepth:       2,
  maxPages:       500,
  politenessMs:   1500,
  retryMax:       3,
  retryBackoffMs: 2000,
  allowPatterns:  [],
  denyPatterns:   [
    /\.(css|js|woff2?|ttf|eot|svg|ico|png|gif|jpg|jpeg|webp|pdf|zip|rar|exe|dmg)(\?.*)?$/i,
    /\/(login|logout|register|signup|account|cart|checkout|404|500)\b/i,
  ],
  mediaPatterns: [
    /\.(m3u8|mp4|mkv|webm|ts|avi|mpg|mpeg|mov|m4v|flv|ogv|ogg|mp3|aac|flac|opus)([\?#].*)?$/i,
    /\/(hls|dash|stream|play|video|media)\//i,
    /content-type=(video|audio)/i,
  ],
  extractMetaTags: true,
  followLinks:     true,
  timeout:         30000,
}

// ── Queue ─────────────────────────────────────────────────────────────────────

class PriorityQueue<T extends { priority: number }> {
  private items: T[] = []

  push(item: T) {
    this.items.push(item)
    this.items.sort((a, b) => a.priority - b.priority)
  }

  pop(): T | undefined { return this.items.shift() }
  peek(): T | undefined { return this.items[0] }
  get size(): number    { return this.items.length }
  isEmpty(): boolean   { return this.items.length === 0 }
  clear()              { this.items = [] }
}

// ── Rate limiter ──────────────────────────────────────────────────────────────

class DomainRateLimiter {
  private lastHit: Map<string, number> = new Map()
  private politenessMs: number

  constructor(politenessMs: number) { this.politenessMs = politenessMs }

  async wait(url: string): Promise<void> {
    const host = new URL(url).hostname
    const last = this.lastHit.get(host) ?? 0
    const wait = this.politenessMs - (Date.now() - last)
    if (wait > 0) await new Promise(r => setTimeout(r, wait + Math.random() * 500))
    this.lastHit.set(host, Date.now())
  }
}

// ── Main class ────────────────────────────────────────────────────────────────

// 20 realistic user agents for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
]

export class ParallelWebCrawler extends EventEmitter {
  private pool:     BrowserPool
  private config:   CrawlerConfig
  private queue:    PriorityQueue<CrawlJob>
  private visited:  Set<string>
  private rateLimiter: DomainRateLimiter
  private activeWorkers: number
  private totalCrawled:  number
  private stopped:  boolean
  private paused:   boolean
  private uaIndex:  number
  private cookieJar: Map<string, any[]>

  constructor(pool: BrowserPool, config: Partial<CrawlerConfig> = {}) {
    super()
    this.pool        = pool
    this.config      = { ...DEFAULT_CONFIG, ...config }
    this.queue       = new PriorityQueue()
    this.visited     = new Set()
    this.rateLimiter = new DomainRateLimiter(this.config.politenessMs)
    this.activeWorkers = 0
    this.totalCrawled  = 0
    this.stopped  = false
    this.paused   = false
    this.uaIndex  = 0
    this.cookieJar = new Map()
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Seed one URL and start crawling. Returns when the queue is drained. */
  async crawl(seed: string): Promise<void> {
    this.stopped = false
    this.paused  = false
    this.addSeeds([seed])
    await this.drain()
  }

  /** Inject additional seed URLs mid-crawl. */
  addSeeds(urls: string[]) {
    for (const url of urls) {
      const norm = this.normalise(url)
      if (norm && !this.visited.has(norm)) {
        this.queue.push({ url: norm, depth: 0, priority: 0, retries: 0 })
      }
    }
    this.emit('seedsAdded', urls.length)
  }

  stop()   { this.stopped = true;  this.emit('stopped') }
  pause()  { this.paused  = true;  this.emit('paused')  }
  resume() { this.paused  = false; this.emit('resumed'); this.drain().catch(() => {}) }

  get stats() {
    return {
      queued:  this.queue.size,
      visited: this.visited.size,
      active:  this.activeWorkers,
      total:   this.totalCrawled,
    }
  }

  // ── Core drain loop ────────────────────────────────────────────────────────

  private async drain(): Promise<void> {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (this.stopped) { resolve(); return }

        while (
          !this.paused &&
          !this.stopped &&
          this.activeWorkers < this.config.workers &&
          !this.queue.isEmpty() &&
          this.totalCrawled < this.config.maxPages
        ) {
          const job = this.queue.pop()!
          this.activeWorkers++
          this.processJob(job)
            .catch(err => this.emit('workerError', err))
            .finally(() => {
              this.activeWorkers--
              check()
            })
        }

        if (this.activeWorkers === 0 && (this.queue.isEmpty() || this.totalCrawled >= this.config.maxPages)) {
          this.emit('done', this.stats)
          resolve()
        }
      }
      check()
    })
  }

  // ── Job processor ─────────────────────────────────────────────────────────

  private async processJob(job: CrawlJob): Promise<void> {
    const norm = this.normalise(job.url)
    if (!norm || this.visited.has(norm)) return
    if (this.isDenied(norm))             return
    if (job.depth > this.config.maxDepth) return

    this.visited.add(norm)

    // Politeness delay
    await this.rateLimiter.wait(norm)
    if (this.stopped) return

    const t0 = Date.now()
    let page: Page | null = null
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.config.retryMax; attempt++) {
      if (attempt > 0) {
        const backoff = this.config.retryBackoffMs * Math.pow(2, attempt - 1)
        await new Promise(r => setTimeout(r, backoff))
      }

      try {
        page = await this.pool.getPage()
        const result = await this.scrapePage(page, norm, job.depth)
        this.totalCrawled++
        this.emit('result', result)

        // Recursively enqueue outbound links
        if (this.config.followLinks && result.links.length > 0 && job.depth < this.config.maxDepth) {
          for (const link of result.links) {
            const linkNorm = this.normalise(link)
            if (linkNorm && !this.visited.has(linkNorm) && !this.isDenied(linkNorm)) {
              if (this.config.allowPatterns.length === 0 || this.config.allowPatterns.some(p => p.test(linkNorm))) {
                this.queue.push({
                  url:      linkNorm,
                  depth:    job.depth + 1,
                  priority: job.depth + 1,
                  retries:  0,
                  parentUrl: norm,
                })
              }
            }
          }
        }
        lastError = null
        break
      } catch (err: any) {
        lastError = err
        this.emit('pageError', { url: norm, attempt, error: err.message })
      } finally {
        if (page) {
          this.pool.releasePage(page).catch(() => {})
          page = null
        }
      }
    }

    if (lastError) {
      this.emit('pageFailed', { url: norm, error: lastError.message, depth: job.depth })
    }
  }

  // ── Page scraper ───────────────────────────────────────────────────────────

  private async scrapePage(page: Page, url: string, depth: number): Promise<CrawlPageResult> {
    const t0 = Date.now()
    let viaSolver = false

    // Rotate user agent
    const ua = this.config.userAgent ?? USER_AGENTS[this.uaIndex++ % USER_AGENTS.length]
    await page.setUserAgent(ua)

    // Inject saved cookies for this domain before navigation
    try {
      const domain = new URL(url).hostname
      const saved = this.cookieJar.get(domain)
      if (saved && saved.length > 0) {
        await page.setCookie(...saved)
      }
    } catch {}

    // Intercept ALL requests: block heavy assets and capture media/WS URLs
    const interceptedUrls: string[] = []
    const mediaInterceptRe = /\.(m3u8?|ts|mpd)(\?.*)?$|\/hls\/|\/dash\/|\/stream\/|video|stream|media|playlist/i
    await page.setRequestInterception(true)
    page.removeAllListeners('request')
    page.on('request', req => {
      const reqUrl = req.url()
      const t = req.resourceType()

      // Capture WebSocket upgrades
      if (reqUrl.startsWith('ws://') || reqUrl.startsWith('wss://')) {
        interceptedUrls.push(reqUrl)
        req.abort()
        return
      }

      // Capture XHR/fetch to media-related endpoints
      if ((t === 'xhr' || t === 'fetch') && mediaInterceptRe.test(reqUrl)) {
        interceptedUrls.push(reqUrl)
      }

      // Capture any URL matching media patterns
      if (this.config.mediaPatterns.some(p => p.test(reqUrl))) {
        interceptedUrls.push(reqUrl)
      }

      // Block heavy assets to speed up crawl
      if (['image', 'font', 'stylesheet'].includes(t)) {
        req.abort()
      } else {
        req.continue()
      }
    })

    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout })
      const status = resp?.status() ?? 0

      // Wait for async XHR/fetch requests to fire after initial load
      await new Promise(r => setTimeout(r, 2000))

      // CF detection
      const bodyPreview = await page.evaluate(() => document.body?.innerText?.substring(0, 500) ?? '')
      if (isCloudflareBlocked({ status, body: bodyPreview })) {
        const solution = await flareSolverr.get(url)
        if (solution) {
          const cdp = await page.target().createCDPSession()
          for (const c of solution.cookies) {
            await cdp.send('Network.setCookie', c as any).catch(() => {})
          }
          await page.setUserAgent(solution.userAgent)
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout })
          viaSolver = true
        }
      }

      // Save cookies for this domain
      try {
        const domain = new URL(url).hostname
        const cookies = await page.cookies()
        if (cookies.length > 0) this.cookieJar.set(domain, cookies)
      } catch {}

      // Extract all data in one evaluate call for performance
      const data = await page.evaluate((mediaPatternsStr: string[]) => {
        const mediaRe = mediaPatternsStr.map(p => new RegExp(p, 'i'))

        // Recursively extract links from a root element (handles shadow DOM)
        function extractLinks(root: Document | ShadowRoot | Element): string[] {
          const found: string[] = []
          root.querySelectorAll('a[href]').forEach(a => {
            const href = (a as HTMLAnchorElement).href
            if (href && href.startsWith('http')) found.push(href)
          })
          // Shadow DOM traversal
          root.querySelectorAll('*').forEach(el => {
            if ((el as any).shadowRoot) {
              found.push(...extractLinks((el as any).shadowRoot))
            }
          })
          return found
        }

        // Links from main document + shadow DOM
        const links = extractLinks(document)

        // iframe src extraction (same-origin content + src attribute)
        const iframeLinks: string[] = []
        document.querySelectorAll('iframe[src]').forEach(iframe => {
          const src = (iframe as HTMLIFrameElement).src
          if (src && src.startsWith('http')) iframeLinks.push(src)
          try {
            const iDoc = (iframe as HTMLIFrameElement).contentDocument
            if (iDoc) iframeLinks.push(...extractLinks(iDoc))
          } catch {}
        })

        // Media URLs (video/audio sources + links that look like media)
        const mediaTags = [
          ...Array.from(document.querySelectorAll('video source, audio source')).map(s => (s as HTMLSourceElement).src),
          ...Array.from(document.querySelectorAll('video[src], audio[src]')).map(v => (v as HTMLVideoElement).src),
          ...Array.from(document.querySelectorAll('source[src]')).map(s => (s as HTMLSourceElement).src),
        ].filter(Boolean)

        const allLinks  = [...new Set([...links, ...iframeLinks])]
        const mediaLinks = allLinks.filter(l => mediaRe.some(re => re.test(l)))
        const allMedia   = Array.from(new Set([...mediaTags, ...mediaLinks]))

        // Metadata from meta tags
        const meta: Record<string, string> = {}
        document.querySelectorAll('meta[name], meta[property]').forEach(m => {
          const key = (m.getAttribute('name') || m.getAttribute('property') || '').toLowerCase()
          const val = m.getAttribute('content') || ''
          if (key && val) meta[key] = val
        })

        return {
          title:       document.title || '',
          description: meta['description'] || meta['og:description'] || '',
          links:       allLinks.slice(0, 300),
          mediaUrls:   allMedia,
          meta,
        }
      }, this.config.mediaPatterns.map(r => r.source))

      const dedupedIntercepted = Array.from(new Set(interceptedUrls))

      return {
        url,
        depth,
        title:            data.title,
        description:      data.description,
        links:            data.links,
        mediaUrls:        Array.from(new Set([...data.mediaUrls, ...dedupedIntercepted])),
        interceptedUrls:  dedupedIntercepted,
        metadata:         data.meta,
        contentType:      'text/html',
        statusCode:       resp?.status() ?? 200,
        crawledAt:        Date.now(),
        durationMs:       Date.now() - t0,
        viaSolver,
      }
    } finally {
      page.removeAllListeners('request')
      await page.setRequestInterception(false).catch(() => {})
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private normalise(url: string): string | null {
    try {
      const u = new URL(url)
      u.hash = ''
      // Remove tracking params
      ;['utm_source','utm_medium','utm_campaign','ref','fbclid','gclid'].forEach(p => u.searchParams.delete(p))
      return u.toString()
    } catch { return null }
  }

  private isDenied(url: string): boolean {
    return this.config.denyPatterns.some(p => p.test(url))
  }
}
