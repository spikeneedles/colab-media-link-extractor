/**
 * SiteCrawlerService.ts — Full-Force multi-strategy site indexer
 *
 * Runs ALL available crawler strategies simultaneously:
 *   1. Puppeteer BFS        — 24-thread GPU-accelerated page crawler (RTX 2070 / 3900X)
 *   2. Sitemap seeder       — /sitemap.xml + /sitemap_index.xml fast URL discovery
 *   3. Robots.txt miner     — extracts Sitemap: directives
 *   4. Playlist hunter      — 30+ common M3U/M3U8 endpoint paths
 *   5. API path hunter      — /api/videos /api/streams /v1/streams + JSON parsing
 *   6. RSS/Atom feeds       — /feed /rss /atom media enclosure extraction
 *   7. SearchCrawler        — searches domain name across 62 configured presets
 *   8. ParallelWebCrawler   — secondary BFS (different implementation, different findings)
 *
 * All media → ArchivistService pipeline (dedup + categorize + Drive sync)
 * Emits SSE events: progress, timeline_point, complete, error
 */

import puppeteerExtra                from 'puppeteer-extra'
import { createRequire }             from 'module'
import { Browser }                   from 'puppeteer'
import { EventEmitter }           from 'events'
import crypto                     from 'crypto'
import axios                      from 'axios'
import fs                         from 'fs'
import path                       from 'path'
import { fileURLToPath }          from 'url'
import { archivist }              from './ArchivistService.js'
import { googleDrive }            from './GoogleDriveService.js'
import { BrowserPool }            from '../browserPool.js'
import { ParallelWebCrawler }     from './ParallelWebCrawler.js'
import { SearchCrawler }          from './SearchCrawler.js'
import { getAllPresets }           from './searchSourcePresets.js'

const __dirname     = path.dirname(fileURLToPath(import.meta.url))
const COOKIES_FILE  = path.resolve(__dirname, '../../data/site-cookies.json')

const _require      = createRequire(import.meta.url)
const StealthPlugin = _require('puppeteer-extra-plugin-stealth')
const { gotScraping } = await import('got-scraping')
puppeteerExtra.use(StealthPlugin())

const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL ?? 'http://localhost:8191/v1'

// ── FlareSolverr helper ───────────────────────────────────────────────────────
// Solves Cloudflare challenges using a real browser session, returns HTML + cookies

async function flaresolverrFetch(url: string): Promise<{ html: string; cookies: Array<{name:string;value:string}> } | null> {
  try {
    const res = await axios.post(FLARESOLVERR_URL, {
      cmd: 'request.get',
      url,
      maxTimeout: 60000,
    }, { timeout: 70000 })
    if (res.data?.status !== 'ok') return null
    return {
      html:    res.data.solution?.response ?? '',
      cookies: res.data.solution?.cookies  ?? [],
    }
  } catch { return null }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PageIndex {
  url:          string
  title:        string
  description:  string
  headings:     string[]
  bodyText:     string
  outboundLinks: string[]
  mediaUrls:    string[]
  screenshotB64?: string
  crawledAt:    string
}

export interface CrawlerStats {
  bfs:       { pages: number; media: number; active: boolean }
  sitemap:   { urlsFound: number; sitemapsChecked: number; active: boolean }
  playlists: { pathsTried: number; found: number; entries: number; active: boolean }
  apiPaths:  { tried: number; found: number; media: number; active: boolean }
  rss:       { feedsTried: number; feedsFound: number; entries: number; media: number; active: boolean }
  search:    { presetsSearched: number; resultsFound: number; media: number; active: boolean }
  parallel:  { pages: number; media: number; active: boolean }
}

export interface SiteCrawlJob {
  id:            string
  baseUrl:       string
  domain:        string
  status:        'running' | 'stopping' | 'completed' | 'error'
  pagesVisited:  number
  pagesQueued:   number
  mediaFound:    number
  mediaArchived: number
  startedAt:     string
  completedAt?:  string
  error?:        string
  pages:         PageIndex[]
  crawlerStats:  CrawlerStats
  categories:    { movies: number; livetv: number; series: number; unknown: number }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MEDIA_PATTERNS = [
  /["'`\s](https?:\/\/[^"'`\s<>]+\.m3u8[^"'`\s<>]*)/gi,
  /["'`\s](https?:\/\/[^"'`\s<>]+\.mp4[^"'`\s<>]*)/gi,
  /["'`\s](https?:\/\/[^"'`\s<>]+\.mkv[^"'`\s<>]*)/gi,
  /["'`\s](https?:\/\/[^"'`\s<>]+\.avi[^"'`\s<>]*)/gi,
  /["'`\s](https?:\/\/[^"'`\s<>]+\.webm[^"'`\s<>]*)/gi,
  /["'`\s](https?:\/\/[^"'`\s<>]+\.ts[?#][^"'`\s<>]*)/gi,
  /["'`\s](https?:\/\/[^"'`\s<>]+\.mpd[^"'`\s<>]*)/gi,
  /["'`\s](https?:\/\/[^"'`\s<>]+\.flv[^"'`\s<>]*)/gi,
  /["'`\s](https?:\/\/[^"'`\s<>]+\.mov[^"'`\s<>]*)/gi,
  /source[^>]+src=["']([^"']+\.(?:mp4|m3u8|webm|mkv|avi)[^"']*)/gi,
  /["'](?:src|url|source|stream|video_url|file)["']\s*:\s*["']([^"']+\.(?:mp4|m3u8|webm|mkv)[^"']*)/gi,
  /(?:stream|video|media|hls|dash)(?:_?url|_?src)?\s*[:=]\s*["']([^"']+)/gi,
]

const PLAYLIST_PATHS = [
  '/playlist.m3u', '/playlist.m3u8', '/streams.m3u', '/streams.m3u8',
  '/live.m3u', '/live.m3u8', '/tv.m3u', '/tv.m3u8', '/channels.m3u',
  '/index.m3u', '/index.m3u8', '/all.m3u', '/all.m3u8',
  '/iptv.m3u', '/iptv.m3u8', '/movies.m3u', '/series.m3u',
  '/feed/playlist', '/api/playlist', '/api/streams', '/api/live',
  '/video/playlist', '/media/playlist', '/watch/playlist',
  '/get.php?type=m3u', '/player/index.m3u8', '/stream/playlist.m3u8',
  '/m3u/playlist', '/m3u8/playlist', '/hls/index.m3u8',
  '/dash/manifest.mpd', '/manifest.m3u8', '/master.m3u8',
]

const RSS_PATHS = [
  '/feed', '/rss', '/atom', '/feed.xml', '/rss.xml', '/atom.xml',
  '/feed/rss', '/feed/atom', '/api/feed', '/blog/feed', '/news/feed',
  '/podcast.xml', '/media-feed', '/video-feed',
]

const API_MEDIA_PATHS = [
  '/api/videos', '/api/video', '/api/streams', '/api/stream',
  '/api/movies', '/api/episodes', '/api/channels', '/api/live',
  '/v1/videos', '/v1/streams', '/v2/videos', '/v2/streams',
  '/api/v1/videos', '/api/v1/streams', '/api/v2/videos',
  '/api/media', '/media/api', '/api/content', '/api/list',
  '/wp-json/wp/v2/posts?per_page=100&_fields=title,link',
  '/wp-json/wp/v2/media?per_page=100',
]

// Puppeteer args — headless-safe on Windows (RTX 2070 / 3900X)
// Note: --use-angle=d3d11 hangs headless Chrome on Windows; use SwiftShader instead
const GPU_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',                        // safe headless mode (no D3D hang)
  '--disable-software-rasterizer',
  '--enable-accelerated-video-decode',
  '--num-raster-threads=12',
  '--renderer-process-limit=24',
  '--aggressive-cache-discard',
  '--disable-background-networking',
  '--disable-extensions',
  '--disable-default-apps',
  '--mute-audio',
]

// ── Semaphore ─────────────────────────────────────────────────────────────────

class Semaphore {
  private count:   number
  private waiters: Array<() => void> = []
  constructor(max: number) { this.count = max }
  async acquire() {
    if (this.count > 0) { this.count--; return }
    await new Promise<void>(r => this.waiters.push(r))
    this.count--
  }
  release() {
    this.count++
    const next = this.waiters.shift()
    if (next) next()
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferCategory(url: string, title: string): keyof SiteCrawlJob['categories'] {
  const t = `${url} ${title}`.toLowerCase()
  if (/live|\.ts[?#]|channel|news|sports?|rtmp|rtsp|udp:|rtp:/.test(t)) return 'livetv'
  if (/s\d{1,2}[\. _x]?e\d{1,2}|season|episode|series/.test(t)) return 'series'
  if (/movie|film|cinema|dvdrip|bluray|1080p|720p|bdrip/.test(t)) return 'movies'
  return 'unknown'
}

function extractMediaFromText(text: string): string[] {
  const found = new Set<string>()
  for (const pattern of MEDIA_PATTERNS) {
    pattern.lastIndex = 0
    for (const m of text.matchAll(pattern)) {
      if (m[1] && m[1].startsWith('http')) found.add(m[1])
    }
  }
  return Array.from(found)
}

async function safeFetch(url: string, timeoutMs = 10_000, extraCookies?: Array<{name: string; value: string}>): Promise<string | null> {
  try {
    const cookieHeader = extraCookies?.length
      ? extraCookies.map(c => `${c.name}=${c.value}`).join('; ')
      : undefined
    // got-scraping mimics real browser TLS fingerprint — bypasses basic Cloudflare bot checks
    const res = await gotScraping.get(url, {
      timeout: { request: timeoutMs },
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      throwHttpErrors: false,
    })
    if (res.statusCode >= 400) {
      // Cloudflare challenge (403/503) — try FlareSolverr
      if (res.statusCode === 403 || res.statusCode === 503) {
        const solved = await flaresolverrFetch(url)
        return solved?.html ?? null
      }
      return null
    }
    return res.body
  } catch { return null }
}

function parseSitemapUrls(xml: string): string[] {
  return (xml.match(/<loc>\s*(https?:\/\/[^<]+)\s*<\/loc>/gi) ?? [])
    .map(m => m.replace(/<\/?loc>/gi, '').trim())
    .filter(u => u.startsWith('http'))
}

// ── Service ───────────────────────────────────────────────────────────────────

// Cookie entry matching Puppeteer's Protocol.Network.CookieParam
interface StoredCookie { name: string; value: string; domain?: string; path?: string; httpOnly?: boolean; secure?: boolean }

function parseCookies(raw: StoredCookie[] | string): StoredCookie[] {
  if (Array.isArray(raw)) return raw
  // Accept raw "Cookie:" header string: "name=value; name2=value2"
  return raw.split(';').map(p => {
    const [name, ...rest] = p.trim().split('=')
    return { name: name.trim(), value: rest.join('=').trim() }
  }).filter(c => c.name)
}

class SiteCrawlerService extends EventEmitter {
  private jobs        = new Map<string, SiteCrawlJob>()
  private cookieStore = new Map<string, StoredCookie[]>()  // domain → cookies

  constructor() {
    super()
    this._loadCookies()
  }

  // ── Cookie persistence ────────────────────────────────────────────────────────
  private _loadCookies() {
    try {
      if (fs.existsSync(COOKIES_FILE)) {
        const saved = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8')) as Record<string, StoredCookie[]>
        for (const [domain, cookies] of Object.entries(saved)) this.cookieStore.set(domain, cookies)
        console.log(`[SiteCrawler] 🍪 Loaded cookies for ${this.cookieStore.size} domain(s) from disk`)
      }
    } catch (e) { console.warn('[SiteCrawler] Could not load cookies file:', e) }
  }

  private _saveCookies() {
    try {
      fs.mkdirSync(path.dirname(COOKIES_FILE), { recursive: true })
      const obj: Record<string, StoredCookie[]> = {}
      for (const [d, c] of this.cookieStore) obj[d] = c
      fs.writeFileSync(COOKIES_FILE, JSON.stringify(obj, null, 2))
    } catch (e) { console.warn('[SiteCrawler] Could not save cookies file:', e) }
  }

  // ── Cookie management ────────────────────────────────────────────────────────
  setCookies(domain: string, raw: StoredCookie[] | string) {
    this.cookieStore.set(domain, parseCookies(raw))
    console.log(`[SiteCrawler] 🍪 Cookies stored for ${domain}: ${this.cookieStore.get(domain)!.length} cookies`)
    this._saveCookies()
  }
  getCookies(domain: string): StoredCookie[] { return this.cookieStore.get(domain) ?? [] }
  clearCookies(domain: string) { this.cookieStore.delete(domain); this._saveCookies() }
  listCookieDomains() {
    return Array.from(this.cookieStore.entries()).map(([domain, cookies]) => ({ domain, count: cookies.length }))
  }
  private _cookiesFor(domain: string): StoredCookie[] {
    // Match exact domain or parent domain (e.g. cookies for "eporner.com" apply to "www.eporner.com")
    for (const [k, v] of this.cookieStore) {
      if (domain === k || domain.endsWith(`.${k}`) || k.endsWith(`.${domain}`)) return v
    }
    return []
  }

  async startCrawl(rawUrl: string): Promise<SiteCrawlJob> {
    const baseUrl = rawUrl.replace(/\/$/, '')
    const domain  = new URL(baseUrl).hostname

    const job: SiteCrawlJob = {
      id:            crypto.randomUUID(),
      baseUrl,
      domain,
      status:        'running',
      pagesVisited:  0,
      pagesQueued:   1,
      mediaFound:    0,
      mediaArchived: 0,
      startedAt:     new Date().toISOString(),
      pages:         [],
      crawlerStats: {
        bfs:       { pages: 0, media: 0, active: true },
        sitemap:   { urlsFound: 0, sitemapsChecked: 0, active: true },
        playlists: { pathsTried: 0, found: 0, entries: 0, active: true },
        apiPaths:  { tried: 0, found: 0, media: 0, active: true },
        rss:       { feedsTried: 0, feedsFound: 0, entries: 0, media: 0, active: true },
        search:    { presetsSearched: 0, resultsFound: 0, media: 0, active: true },
        parallel:  { pages: 0, media: 0, active: true },
      },
      categories: { movies: 0, livetv: 0, series: 0, unknown: 0 },
    }

    this.jobs.set(job.id, job)
    this.emit(`job:${job.id}`, { type: 'start', job })
    this._runCrawl(job).catch(err => {
      job.status = 'error'
      job.error  = String(err)
      this.emit(`job:${job.id}`, { type: 'error', error: job.error })
    })
    return job
  }

  stopCrawl(jobId: string) {
    const job = this.jobs.get(jobId)
    if (job && job.status === 'running') job.status = 'stopping'
  }

  getJob(jobId: string)    { return this.jobs.get(jobId) }
  listJobs(): SiteCrawlJob[] { return Array.from(this.jobs.values()) }

  // ── Orchestrator ───────────────────────────────────────────────────────────

  private async _runCrawl(job: SiteCrawlJob) {
    const domainCookies = this._cookiesFor(job.domain)
    if (domainCookies.length > 0) {
      console.log(`[SiteCrawler] 🍪 Using ${domainCookies.length} stored cookies for ${job.domain}`)
    }
    console.log(`[SiteCrawler] Launching stealth Puppeteer for ${job.domain}`)
    const browser = await puppeteerExtra.launch({ headless: true, args: GPU_ARGS })
    console.log(`[SiteCrawler] Stealth Puppeteer ready for ${job.domain}`)
    // Secondary browser pool for SearchCrawler + ParallelWebCrawler
    const browserPool = new BrowserPool({ maxConcurrent: 8 })

    const queue:     string[] = [job.baseUrl]
    const visited    = new Set<string>([job.baseUrl])
    const seenMedia  = new Set<string>()
    // seedingActive: BFS keeps spinning while any async seeder is still adding URLs
    const seeding    = { active: true }

    // Timeline ticker — emits a data point every 5 seconds
    const startMs   = Date.now()
    const tickTimer = setInterval(() => {
      if (job.status !== 'running') return
      this.emit(`job:${job.id}`, {
        type:     'timeline_point',
        elapsed:  Math.floor((Date.now() - startMs) / 1000),
        pages:    job.pagesVisited,
        media:    job.mediaFound,
        archived: job.mediaArchived,
      })
    }, 5_000)

    try {
      await Promise.allSettled([
        // ① Sitemap seeder — fast URL injection into the BFS queue
        this._seedFromSitemap(job, queue, visited).finally(() => { /* seeding tracks own active */ }),
        // ② Main BFS — runs until queue empty AND seeding done
        this._runBFS(job, browser, queue, visited, seenMedia, seeding, domainCookies),
        // ③ Playlist hunter — direct M3U endpoint checks
        this._runPlaylistHunter(job, seenMedia),
        // ④ API path hunter — /api/videos /api/streams etc.
        this._runAPIPathHunter(job, seenMedia),
        // ⑤ RSS/Atom feeds — enclosure + media link extraction
        this._runRSSCrawl(job, seenMedia),
        // ⑥ SearchCrawler — domain name on 62 presets
        this._runSearchCrawl(job, seenMedia, browserPool),
        // ⑦ ParallelWebCrawler — secondary BFS (finds different things)
        this._runParallelCrawl(job, seenMedia, browserPool),
      ])

      job.status      = 'completed'
      job.completedAt = new Date().toISOString()
      await this._uploadToDrive(job)
      this.emit(`job:${job.id}`, { type: 'complete', job })
    } finally {
      clearInterval(tickTimer)
      seeding.active = false
      await browser.close().catch(() => {})
      await browserPool.cleanup().catch(() => {})
    }
  }

  // ── ① Main BFS ─────────────────────────────────────────────────────────────

  private async _runBFS(
    job:           SiteCrawlJob,
    browser:       Browser,
    queue:         string[],
    visited:       Set<string>,
    seenMedia:     Set<string>,
    seeding:       { active: boolean },
    domainCookies: StoredCookie[] = [],
  ) {
    const sem = new Semaphore(24)

    while (job.status === 'running') {
      // If queue empty, wait for seeders unless all are done
      if (queue.length === 0) {
        if (!seeding.active) break
        await new Promise(r => setTimeout(r, 300))
        continue
      }

      const batch = queue.splice(0, 24)
      job.pagesQueued = queue.length

      await Promise.all(batch.map(async pageUrl => {
        await sem.acquire()
        try {
          if (job.status !== 'running') return
          const result = await this._crawlPage(browser, pageUrl, job.domain, domainCookies)
          if (!result) return

          job.pagesVisited++
          job.crawlerStats.bfs.pages++
          job.pages.push(result)

          for (const link of result.outboundLinks) {
            if (!visited.has(link)) { visited.add(link); queue.push(link); job.pagesQueued++ }
          }

          if (result.mediaUrls.length > 0) {
            const archived = await this._archiveMedia(job, result.mediaUrls, pageUrl, seenMedia, 'bfs')
            job.crawlerStats.bfs.media += archived
          }

          this._emitProgress(job, pageUrl)
        } finally { sem.release() }
      }))
    }

    job.crawlerStats.bfs.active = false
    this._emitProgress(job)
  }

  // ── ② Sitemap seeder ───────────────────────────────────────────────────────

  private async _seedFromSitemap(
    job:     SiteCrawlJob,
    queue:   string[],
    visited: Set<string>,
  ) {
    const cs = job.crawlerStats.sitemap
    const seen = new Set<string>()

    // 1. Check robots.txt for Sitemap: directives
    const robots = await safeFetch(`${job.baseUrl}/robots.txt`, 8_000)
    const robotsSitemaps = (robots?.match(/^Sitemap:\s*(https?:\/\/\S+)/gim) ?? [])
      .map(m => m.replace(/^Sitemap:\s*/i, '').trim())

    const sitemapUrls = [
      `${job.baseUrl}/sitemap.xml`,
      `${job.baseUrl}/sitemap_index.xml`,
      ...robotsSitemaps,
    ]

    const processXml = async (url: string) => {
      if (seen.has(url)) return
      seen.add(url)
      cs.sitemapsChecked++
      const xml = await safeFetch(url, 12_000)
      if (!xml) return

      const locs = parseSitemapUrls(xml)
      for (const loc of locs) {
        // Nested sitemap index
        if (loc.endsWith('.xml')) { await processXml(loc); continue }
        if (new URL(loc).hostname === job.domain && !visited.has(loc)) {
          visited.add(loc)
          queue.push(loc)
          cs.urlsFound++
        }
      }
    }

    for (const url of sitemapUrls) await processXml(url)
    cs.active = false
  }

  // ── ③ Playlist hunter ─────────────────────────────────────────────────────

  private async _runPlaylistHunter(job: SiteCrawlJob, seenMedia: Set<string>) {
    const cs = job.crawlerStats.playlists
    const sem = new Semaphore(10)

    await Promise.all(PLAYLIST_PATHS.map(async p => {
      await sem.acquire()
      try {
        if (job.status !== 'running') return
        const url     = `${job.baseUrl}${p}`
        const content = await safeFetch(url, 8_000)
        cs.pathsTried++
        if (!content) return

        // Check it looks like a playlist (has #EXTM3U or media URLs)
        if (!content.includes('#EXTM3U') && !content.includes('.m3u8') && !content.includes('.mp4')) return
        cs.found++

        // Extract media URLs from the playlist
        const urls = [
          ...content.split('\n').filter(l => l.startsWith('http')),
          ...extractMediaFromText(content),
        ]
        cs.entries += urls.length
        const archived = await this._archiveMedia(job, urls, url, seenMedia, 'playlists')
        cs.entries = Math.max(cs.entries, archived)
      } finally { sem.release() }
    }))

    cs.active = false
    this._emitProgress(job)
  }

  // ── ④ API path hunter ─────────────────────────────────────────────────────

  private async _runAPIPathHunter(job: SiteCrawlJob, seenMedia: Set<string>) {
    const cs  = job.crawlerStats.apiPaths
    const sem = new Semaphore(8)

    await Promise.all(API_MEDIA_PATHS.map(async p => {
      await sem.acquire()
      try {
        if (job.status !== 'running') return
        const url     = `${job.baseUrl}${p}`
        const content = await safeFetch(url, 8_000)
        cs.tried++
        if (!content) return

        // Try JSON parse
        let json: unknown = null
        try { json = JSON.parse(content) } catch { /* might be HTML */ }

        const mediaUrls = json
          ? this._extractUrlsFromJson(json)
          : extractMediaFromText(content)

        if (mediaUrls.length === 0) return
        cs.found++
        const archived = await this._archiveMedia(job, mediaUrls, url, seenMedia, 'apiPaths')
        cs.media += archived
      } finally { sem.release() }
    }))

    cs.active = false
    this._emitProgress(job)
  }

  // ── ⑤ RSS / Atom feeds ────────────────────────────────────────────────────

  private async _runRSSCrawl(job: SiteCrawlJob, seenMedia: Set<string>) {
    const cs  = job.crawlerStats.rss
    const sem = new Semaphore(6)

    await Promise.all(RSS_PATHS.map(async p => {
      await sem.acquire()
      try {
        if (job.status !== 'running') return
        const url     = `${job.baseUrl}${p}`
        const content = await safeFetch(url, 8_000)
        cs.feedsTried++
        if (!content) return

        // Must look like RSS/Atom XML
        if (!/<(?:rss|feed|channel|item|entry)\b/i.test(content)) return
        cs.feedsFound++

        // Extract enclosure urls, media:content, and <link>s
        const enclosures = (content.match(/enclosure[^>]+url=["']([^"']+)/gi) ?? [])
          .map(m => { const u = m.match(/url=["']([^"']+)/i); return u?.[1] ?? '' })
          .filter(Boolean)

        const mediaContent = (content.match(/<media:content[^>]+url=["']([^"']+)/gi) ?? [])
          .map(m => { const u = m.match(/url=["']([^"']+)/i); return u?.[1] ?? '' })
          .filter(Boolean)

        const links = extractMediaFromText(content)

        const all = [...enclosures, ...mediaContent, ...links]
        cs.entries += all.length
        const archived = await this._archiveMedia(job, all, url, seenMedia, 'rss')
        cs.media += archived
      } finally { sem.release() }
    }))

    cs.active = false
    this._emitProgress(job)
  }

  // ── ⑥ SearchCrawler — domain name across all presets ─────────────────────

  private async _runSearchCrawl(
    job:        SiteCrawlJob,
    seenMedia:  Set<string>,
    browserPool: BrowserPool,
  ) {
    const cs = job.crawlerStats.search
    try {
      const crawler = new SearchCrawler(browserPool)
      // Use streaming/video/iptv presets — most likely to find media content
      const presets = getAllPresets().filter(p =>
        ['streaming', 'video', 'iptv', 'torrent'].includes((p as any).group ?? '')
      ).slice(0, 20)  // cap at 20 to avoid flooding

      const sem = new Semaphore(4)  // 4 presets at a time
      await Promise.all(presets.map(async preset => {
        await sem.acquire()
        try {
          if (job.status !== 'running') return
          const result = await crawler.search(preset, job.domain, 2)
          cs.presetsSearched++
          cs.resultsFound += result.totalResults

          const urls = result.results.map(r => r.url).filter(Boolean)
          if (urls.length > 0) {
            const archived = await this._archiveMedia(job, urls, preset.baseUrl, seenMedia, 'search')
            cs.media += archived
          }
        } catch { /* non-fatal — one preset failure shouldn't stop the rest */ }
        finally  { sem.release() }
      }))
    } catch { /* SearchCrawler init may fail if browser pool saturated */ }
    finally {
      cs.active = false
      this._emitProgress(job)
    }
  }

  // ── ⑦ ParallelWebCrawler — secondary BFS ─────────────────────────────────

  private async _runParallelCrawl(
    job:         SiteCrawlJob,
    seenMedia:   Set<string>,
    browserPool: BrowserPool,
  ) {
    const cs = job.crawlerStats.parallel
    try {
      const pwc = new ParallelWebCrawler(browserPool, {
        workers:        6,
        maxDepth:       3,
        maxPages:       300,
        politenessMs:   800,
        allowPatterns:  [new RegExp(`^https?://${job.domain.replace(/\./g, '\\.')}`)],
        mediaPatterns:  MEDIA_PATTERNS,
        extractMetaTags: true,
        followLinks:    true,
      })

      await new Promise<void>((resolve) => {
        pwc.on('result', async (result: any) => {
          if (job.status !== 'running') { pwc.stop(); resolve(); return }
          cs.pages++
          const urls: string[] = result.mediaUrls ?? []
          if (urls.length > 0) {
            const archived = await this._archiveMedia(job, urls, result.url, seenMedia, 'parallel')
            cs.media += archived
            this._emitProgress(job, result.url)
          }
        })

        pwc.on('done', () => resolve())

        if (job.status === 'running') {
          pwc.crawl(job.baseUrl).catch(() => resolve())
        } else {
          resolve()
        }

        // Stop secondary crawler when main job stops
        const stopChecker = setInterval(() => {
          if (job.status !== 'running') { pwc.stop(); clearInterval(stopChecker); resolve() }
        }, 2_000)
      })
    } catch { /* non-fatal */ }
    finally {
      cs.active = false
      this._emitProgress(job)
    }
  }

  // ── Crawl a single page (BFS worker) ──────────────────────────────────────

  private async _crawlPage(
    browser:       Browser,
    url:           string,
    domain:        string,
    domainCookies: StoredCookie[] = [],
  ): Promise<PageIndex | null> {
    const page = await browser.newPage()
    page.setDefaultTimeout(10_000)  // all operations timeout after 10s max
    // Intercept network requests — capture HLS/MP4 URLs fired by JS players
    const interceptedMedia: string[] = []
    await page.setRequestInterception(true)
    page.on('request', req => {
      const u = req.url()
      if (/\.(m3u8|mp4|mkv|webm|mpd|ts)(\?|$)/i.test(u) || /stream|video|hls|dash/i.test(u)) {
        interceptedMedia.push(u)
      }
      req.continue().catch(() => {})
    })
    try {
      await page.setViewport({ width: 1280, height: 720 })
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })

      // ── Fast HTTP path: try got-scraping with session cookies first ──────────
      // This works when the site needs cookies but not a full JS render
      if (domainCookies.length > 0) {
        const html = await safeFetch(url, 15_000, domainCookies)
        if (html && html.length > 500 && !html.includes('cf-browser-verification') && !html.includes('Just a moment')) {
          const mediaUrls = new Set<string>()
          for (const m of extractMediaFromText(html)) mediaUrls.add(m)

          const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
          const descMatch  = html.match(/meta[^>]+description[^>]+content=["']([^"']+)/i)
          const linkMatches = [...html.matchAll(/href=["'](https?:\/\/[^"']+)/gi)].map(m => m[1])
          const outboundLinks = linkMatches.filter(l => { try { return new URL(l).hostname === domain } catch { return false } })
          console.log(`[SiteCrawler] 🍪 Cookie HTTP hit: ${url} — media: ${mediaUrls.size}, links: ${outboundLinks.length}`)
          await page.close().catch(() => {})
          return {
            url,
            title:         titleMatch?.[1]?.trim() ?? '',
            description:   descMatch?.[1]?.trim() ?? '',
            headings:      [],
            bodyText:      html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 2000),
            outboundLinks: [...new Set(outboundLinks)].slice(0, 200),
            mediaUrls:     Array.from(mediaUrls),
            crawledAt:     new Date().toISOString(),
          }
        }
        // HTTP path failed or got blocked — fall through to Puppeteer
      }

      // Inject domain cookies (e.g. cf_clearance) before navigation
      if (domainCookies.length > 0) {
        await page.setCookie(...domainCookies.map(c => ({ ...c, url })))
      }

      // Navigate — catch timeout but still extract content from whatever loaded
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout:   20_000,
      }).catch(async (err) => {
        // Timeout is OK — page may have partial content; check status via response interception
        if (!err.message?.includes('timeout') && !err.message?.includes('Timeout')) return null
        return 'timeout' as any  // signal: timed out but try to extract anyway
      })

      const timedOut = response === 'timeout'
      if (!timedOut && (!response || (response as any).status?.() >= 400)) {
        console.log(`[SiteCrawler] Page skipped (${(response as any)?.status?.() ?? 'no response'}): ${url}`)
        return null
      }
      // If navigation timed out — try FlareSolverr (real browser, solves CF challenges)
      if (timedOut) {
        console.log(`[SiteCrawler] Nav timed out — trying FlareSolverr: ${url}`)
        const solved = await flaresolverrFetch(url)
        if (!solved?.html) return null

        // Inject FlareSolverr cookies so Puppeteer reuses the solved session
        if (solved.cookies.length > 0) {
          await page.setCookie(...solved.cookies.map(c => ({ name: c.name, value: c.value, url })))
        }

        // Parse the solved HTML directly
        const mediaUrls = new Set<string>(interceptedMedia)
        for (const m of extractMediaFromText(solved.html)) mediaUrls.add(m)

        const titleMatch = solved.html.match(/<title[^>]*>([^<]*)<\/title>/i)
        const descMatch  = solved.html.match(/meta[^>]+description[^>]+content=["']([^"']+)/i)
        const linkMatches = [...solved.html.matchAll(/href=["'](https?:\/\/[^"']+)/gi)].map(m => m[1])
        const outboundLinks = linkMatches.filter(l => { try { return new URL(l).hostname === domain } catch { return false } })

        console.log(`[SiteCrawler] FlareSolverr solved ${url} — media: ${mediaUrls.size}, links: ${outboundLinks.length}`)
        return {
          url,
          title:         titleMatch?.[1]?.trim() ?? '',
          description:   descMatch?.[1]?.trim() ?? '',
          headings:      [],
          bodyText:      solved.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 2000),
          outboundLinks: [...new Set(outboundLinks)].slice(0, 200),
          mediaUrls:     Array.from(mediaUrls),
          crawledAt:     new Date().toISOString(),
        }
      }

      // Wait up to 5s for JS to render / fire video URLs (skip if already timed out)
      if (!timedOut) {
        await page.waitForNetworkIdle({ timeout: 5_000, idleTime: 1500 }).catch(() => {})
      }

      const data = await Promise.race([
        page.evaluate(() => {
          const getMeta = (name: string) =>
            (document.querySelector(`meta[name="${name}"], meta[property="${name}"]`) as HTMLMetaElement)?.content ?? ''
          const headings    = Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.textContent?.trim() ?? '').filter(Boolean).slice(0, 20)
          const bodyText    = (document.body?.innerText ?? '').replace(/\s+/g, ' ').substring(0, 2000)
          const allLinks    = Array.from(document.querySelectorAll('a[href]')).map(a => (a as HTMLAnchorElement).href).filter(h => h.startsWith('http'))
          const videoSrcs   = Array.from(document.querySelectorAll('video source, video')).map(v => (v as HTMLSourceElement).src ?? '').filter(Boolean)
          const sourceSrcs  = Array.from(document.querySelectorAll('source[src]')).map(s => (s as HTMLSourceElement).src).filter(Boolean)
          return {
            title:       document.title?.trim() ?? '',
            description: getMeta('description') || getMeta('og:description'),
            headings,
            bodyText,
            allLinks,
            videoSrcs:   [...new Set([...videoSrcs, ...sourceSrcs])],
            rawHtml:     document.documentElement.outerHTML.substring(0, 500_000),
          }
        }),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('eval timeout')), 8_000)),
      ]).catch(() => null)

      if (!data) return null

      const mediaUrls = new Set<string>([...data.videoSrcs, ...interceptedMedia])
      for (const m of extractMediaFromText(data.rawHtml)) mediaUrls.add(m)

      const outboundLinks = data.allLinks
        .filter(link => { try { return new URL(link).hostname === domain } catch { return false } })
        .map(l => l.split('#')[0].split('?')[0])

      let screenshotB64: string | undefined
      try {
        const buf = await page.screenshot({ type: 'jpeg', quality: 60, clip: { x: 0, y: 0, width: 1280, height: 720 } })
        screenshotB64 = Buffer.isBuffer(buf) ? buf.toString('base64') : undefined
      } catch { /* non-fatal */ }

      return {
        url,
        title:         data.title,
        description:   data.description,
        headings:      data.headings,
        bodyText:      data.bodyText,
        outboundLinks: [...new Set(outboundLinks)].slice(0, 200),
        mediaUrls:     Array.from(mediaUrls),
        screenshotB64,
        crawledAt:     new Date().toISOString(),
      }
    } catch { return null }
    finally  { await page.close().catch(() => {}) }
  }

  // ── Shared: archive a batch of media URLs through the pipeline ─────────────

  private async _archiveMedia(
    job:       SiteCrawlJob,
    urls:      string[],
    sourceUrl: string,
    seenMedia: Set<string>,
    source:    string,
  ): Promise<number> {
    const newUrls = urls.filter(u => u && u.startsWith('http') && !seenMedia.has(u))
    if (newUrls.length === 0) return 0
    newUrls.forEach(u => seenMedia.add(u))
    job.mediaFound += newUrls.length

    // Update category counters
    for (const u of newUrls) {
      const cat = inferCategory(u, '')
      job.categories[cat]++
    }

    const stats = await archivist.processCrawlResults(
      newUrls.map(u => ({ downloadUrl: u, indexer: `SiteIndexer/${source}/${job.domain}` })),
      sourceUrl,
      `SiteIndexer/${job.domain}`,
    ).catch(() => ({ archived: 0, rejected: 0, flagged: 0 }))

    job.mediaArchived += stats.archived
    return stats.archived
  }

  // ── Shared: extract URLs from arbitrary JSON ───────────────────────────────

  private _extractUrlsFromJson(data: unknown, depth = 0): string[] {
    if (depth > 5) return []
    const found: string[] = []
    if (typeof data === 'string' && data.startsWith('http')) {
      if (/\.(mp4|m3u8|mkv|avi|webm|mpd|ts)/.test(data)) found.push(data)
    } else if (Array.isArray(data)) {
      for (const item of data) found.push(...this._extractUrlsFromJson(item, depth + 1))
    } else if (data && typeof data === 'object') {
      for (const v of Object.values(data as Record<string, unknown>)) {
        found.push(...this._extractUrlsFromJson(v, depth + 1))
      }
    }
    return found
  }

  // ── Shared: emit progress SSE ──────────────────────────────────────────────

  private _emitProgress(job: SiteCrawlJob, lastUrl?: string) {
    this.emit(`job:${job.id}`, {
      type:         'progress',
      visited:      job.pagesVisited,
      queued:       job.pagesQueued,
      media:        job.mediaFound,
      archived:     job.mediaArchived,
      lastUrl,
      crawlerStats: job.crawlerStats,
      categories:   job.categories,
    })
  }

  // ── Upload site index to Google Drive ─────────────────────────────────────

  private async _uploadToDrive(job: SiteCrawlJob) {
    try {
      if (!googleDrive.isConnected()) return

      const indexedFolderId = await googleDrive.getOrCreateIndexedFolder()
      if (!indexedFolderId) return

      const domainFolderId = await googleDrive.getOrCreateSubfolder(indexedFolderId, job.domain)
      if (!domainFolderId) return

      const indexDoc = {
        domain:       job.domain,
        baseUrl:      job.baseUrl,
        crawledAt:    job.completedAt,
        pagesIndexed: job.pagesVisited,
        mediaFound:   job.mediaFound,
        mediaArchived: job.mediaArchived,
        categories:   job.categories,
        crawlerStats: job.crawlerStats,
        pages: job.pages.map(p => ({
          url:          p.url,
          title:        p.title,
          description:  p.description,
          headings:     p.headings,
          bodyText:     p.bodyText,
          mediaUrls:    p.mediaUrls,
          crawledAt:    p.crawledAt,
        })),
      }

      const ts       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `${job.domain}_${ts}.json`
      await googleDrive.uploadFileToFolder(domainFolderId, filename, JSON.stringify(indexDoc, null, 2), 'application/json')
      console.log(`[SiteCrawler] ☁️  Uploaded: ${job.domain}/${filename}`)
    } catch (err) {
      console.error('[SiteCrawler] Drive upload failed:', err)
    }
  }
}

export const siteCrawler = new SiteCrawlerService()