/**
 * ProxyPoolService
 *
 * Proxy pool rotation, User-Agent rotation, per-domain cookie jar,
 * and adaptive rate limiting — ready to drop into any Axios request.
 */

import fs from 'fs'
import path from 'path'
import axios, { type AxiosRequestConfig, type AxiosProxyConfig } from 'axios'

const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[ProxyPool] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[ProxyPool] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ProxyPool] ${msg}`, ...args),
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ProxyEntry {
  url: string
  protocol: 'http' | 'https' | 'socks4' | 'socks5'
  host: string
  port: number
  username?: string
  password?: string
  failures: number
  successes: number
  lastUsed: number
  bannedUntil?: number
  avgLatencyMs: number
}

export type UACategory = 'desktop' | 'mobile' | 'tablet'

export interface UserAgentEntry {
  ua: string
  browser: 'chrome' | 'firefox' | 'safari' | 'edge'
  platform: 'windows' | 'mac' | 'linux' | 'android' | 'ios'
  category: UACategory
  weight: number
}

export interface CookieEntry {
  name: string
  value: string
  expires?: number  // Unix timestamp
  path?: string
  secure?: boolean
  httpOnly?: boolean
}

export interface DomainStats {
  requestCount: number
  errorCount: number
  avgResponseMs: number
  lastRequest: number
}

// ---------------------------------------------------------------------------
// User-Agent pool (50 entries)
// ---------------------------------------------------------------------------

const UA_POOL: UserAgentEntry[] = [
  // ── Chrome on Windows (weight 15 each) ──────────────────────────────────
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', browser: 'chrome', platform: 'windows', category: 'desktop', weight: 15 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36', browser: 'chrome', platform: 'windows', category: 'desktop', weight: 15 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', browser: 'chrome', platform: 'windows', category: 'desktop', weight: 15 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36', browser: 'chrome', platform: 'windows', category: 'desktop', weight: 14 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', browser: 'chrome', platform: 'windows', category: 'desktop', weight: 14 },
  // ── Chrome on Mac ────────────────────────────────────────────────────────
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', browser: 'chrome', platform: 'mac', category: 'desktop', weight: 12 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36', browser: 'chrome', platform: 'mac', category: 'desktop', weight: 12 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', browser: 'chrome', platform: 'mac', category: 'desktop', weight: 12 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36', browser: 'chrome', platform: 'mac', category: 'desktop', weight: 11 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36', browser: 'chrome', platform: 'mac', category: 'desktop', weight: 11 },
  // ── Chrome on Linux ──────────────────────────────────────────────────────
  { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', browser: 'chrome', platform: 'linux', category: 'desktop', weight: 8 },
  { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36', browser: 'chrome', platform: 'linux', category: 'desktop', weight: 8 },
  { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', browser: 'chrome', platform: 'linux', category: 'desktop', weight: 7 },
  // ── Chrome Mobile Android ────────────────────────────────────────────────
  { ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36', browser: 'chrome', platform: 'android', category: 'mobile', weight: 6 },
  { ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.144 Mobile Safari/537.36', browser: 'chrome', platform: 'android', category: 'mobile', weight: 6 },
  { ua: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36', browser: 'chrome', platform: 'android', category: 'mobile', weight: 5 },
  { ua: 'Mozilla/5.0 (Linux; Android 12; M2102J20SG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.193 Mobile Safari/537.36', browser: 'chrome', platform: 'android', category: 'mobile', weight: 4 },
  // ── Firefox on Windows ───────────────────────────────────────────────────
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0', browser: 'firefox', platform: 'windows', category: 'desktop', weight: 8 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0', browser: 'firefox', platform: 'windows', category: 'desktop', weight: 8 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0', browser: 'firefox', platform: 'windows', category: 'desktop', weight: 8 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0', browser: 'firefox', platform: 'windows', category: 'desktop', weight: 7 },
  // ── Firefox on Mac ───────────────────────────────────────────────────────
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:121.0) Gecko/20100101 Firefox/121.0', browser: 'firefox', platform: 'mac', category: 'desktop', weight: 6 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:122.0) Gecko/20100101 Firefox/122.0', browser: 'firefox', platform: 'mac', category: 'desktop', weight: 6 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:123.0) Gecko/20100101 Firefox/123.0', browser: 'firefox', platform: 'mac', category: 'desktop', weight: 5 },
  // ── Firefox on Linux ─────────────────────────────────────────────────────
  { ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0', browser: 'firefox', platform: 'linux', category: 'desktop', weight: 5 },
  { ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0', browser: 'firefox', platform: 'linux', category: 'desktop', weight: 4 },
  // ── Firefox Mobile ───────────────────────────────────────────────────────
  { ua: 'Mozilla/5.0 (Android 13; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0', browser: 'firefox', platform: 'android', category: 'mobile', weight: 3 },
  // ── Safari on Mac ────────────────────────────────────────────────────────
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15', browser: 'safari', platform: 'mac', category: 'desktop', weight: 5 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15', browser: 'safari', platform: 'mac', category: 'desktop', weight: 5 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15', browser: 'safari', platform: 'mac', category: 'desktop', weight: 4 },
  // ── Safari on iPhone ─────────────────────────────────────────────────────
  { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1', browser: 'safari', platform: 'ios', category: 'mobile', weight: 4 },
  { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1', browser: 'safari', platform: 'ios', category: 'mobile', weight: 3 },
  // ── Safari on iPad ───────────────────────────────────────────────────────
  { ua: 'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1', browser: 'safari', platform: 'ios', category: 'tablet', weight: 3 },
  // ── Edge on Windows ──────────────────────────────────────────────────────
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91', browser: 'edge', platform: 'windows', category: 'desktop', weight: 5 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.2277.83', browser: 'edge', platform: 'windows', category: 'desktop', weight: 5 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.2365.52', browser: 'edge', platform: 'windows', category: 'desktop', weight: 4 },
  // ── Edge on Mac ──────────────────────────────────────────────────────────
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91', browser: 'edge', platform: 'mac', category: 'desktop', weight: 3 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.2277.83', browser: 'edge', platform: 'mac', category: 'desktop', weight: 3 },
  // ── Android Tablet ───────────────────────────────────────────────────────
  { ua: 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Safari/537.36', browser: 'chrome', platform: 'android', category: 'tablet', weight: 3 },
  { ua: 'Mozilla/5.0 (Linux; Android 12; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.193 Safari/537.36', browser: 'chrome', platform: 'android', category: 'tablet', weight: 2 },
  // ── Older Chrome fallbacks ────────────────────────────────────────────────
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36', browser: 'chrome', platform: 'windows', category: 'desktop', weight: 4 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36', browser: 'chrome', platform: 'windows', category: 'desktop', weight: 5 },
  { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36', browser: 'chrome', platform: 'mac', category: 'desktop', weight: 4 },
  { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36', browser: 'chrome', platform: 'linux', category: 'desktop', weight: 3 },
  // ── Chrome on Windows (extra to reach 50) ────────────────────────────────
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36', browser: 'chrome', platform: 'windows', category: 'desktop', weight: 3 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36', browser: 'chrome', platform: 'windows', category: 'desktop', weight: 2 },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36', browser: 'chrome', platform: 'windows', category: 'desktop', weight: 2 },
  { ua: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', browser: 'chrome', platform: 'windows', category: 'desktop', weight: 2 },
]

// Pre-build cumulative weight table for O(log n) weighted pick
const UA_CUMULATIVE = (() => {
  const result: number[] = []
  let acc = 0
  for (const entry of UA_POOL) {
    acc += entry.weight
    result.push(acc)
  }
  return result
})()

const UA_TOTAL_WEIGHT = UA_CUMULATIVE[UA_CUMULATIVE.length - 1]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function parseProxyUrl(rawUrl: string): Omit<ProxyEntry, 'failures' | 'successes' | 'lastUsed' | 'avgLatencyMs'> | null {
  try {
    const u = new URL(rawUrl)
    const protocol = u.protocol.replace(':', '') as ProxyEntry['protocol']
    if (!['http', 'https', 'socks4', 'socks5'].includes(protocol)) return null

    return {
      url: rawUrl,
      protocol,
      host: u.hostname,
      port: parseInt(u.port, 10) || (protocol === 'https' ? 443 : 1080),
      username: u.username || undefined,
      password: u.password || undefined,
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// ProxyPoolService
// ---------------------------------------------------------------------------

export class ProxyPoolService {
  private proxies: ProxyEntry[] = []
  private cookieJar = new Map<string, Map<string, CookieEntry>>()
  private domainStats = new Map<string, DomainStats>()

  constructor(proxies: string[] = [], proxyFilePath?: string) {
    const sources: string[] = [...proxies]

    // Load from environment
    if (process.env.PROXY_LIST) {
      sources.push(...process.env.PROXY_LIST.split(',').map((s) => s.trim()).filter(Boolean))
    }

    // Load from file
    const filePath = proxyFilePath ?? process.env.PROXY_FILE
    if (filePath) {
      try {
        const lines = fs.readFileSync(path.resolve(filePath), 'utf-8')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
        sources.push(...lines)
      } catch (err) {
        logger.warn(`Could not read proxy file ${filePath}:`, err)
      }
    }

    this._addProxies(sources)
    logger.info(`Loaded ${this.proxies.length} proxies`)
  }

  // -------------------------------------------------------------------------
  // Proxy management
  // -------------------------------------------------------------------------

  addProxies(rawUrls: string[]): void {
    this._addProxies(rawUrls)
  }

  private _addProxies(rawUrls: string[]): void {
    for (const raw of rawUrls) {
      const parsed = parseProxyUrl(raw)
      if (parsed) {
        this.proxies.push({ ...parsed, failures: 0, successes: 0, lastUsed: 0, avgLatencyMs: 0 })
      } else {
        logger.warn(`Skipping invalid proxy: ${raw}`)
      }
    }
  }

  /** Returns the best available proxy: not banned, lowest failure rate, then lowest latency. */
  getBestProxy(): ProxyEntry | null {
    if (this.proxies.length === 0) return null

    const now = Date.now()
    const available = this.proxies.filter((p) => !p.bannedUntil || p.bannedUntil < now)
    if (available.length === 0) return null

    return available.sort((a, b) => {
      const aFR = a.failures / Math.max(a.successes + a.failures, 1)
      const bFR = b.failures / Math.max(b.successes + b.failures, 1)
      if (aFR !== bFR) return aFR - bFR
      return a.avgLatencyMs - b.avgLatencyMs
    })[0]
  }

  recordProxyResult(proxyUrl: string, latencyMs: number, success: boolean): void {
    const proxy = this.proxies.find((p) => p.url === proxyUrl)
    if (!proxy) return

    proxy.lastUsed = Date.now()

    if (success) {
      proxy.successes++
      // Reset consecutive-failure counter by clearing ban
      const alpha = 0.2
      proxy.avgLatencyMs = proxy.avgLatencyMs === 0
        ? latencyMs
        : Math.round(alpha * latencyMs + (1 - alpha) * proxy.avgLatencyMs)
    } else {
      proxy.failures++
      // Count consecutive failures by checking ban state
      const consecutiveFails = proxy.failures - proxy.successes
      if (consecutiveFails >= 3) {
        proxy.bannedUntil = Date.now() + 15 * 60 * 1000
        logger.warn(`Banned proxy ${proxy.host}:${proxy.port} for 15 min`)
      }
    }
  }

  /** Health-check all proxies by pinging https://api.ipify.org?format=json */
  async healthCheckAll(): Promise<void> {
    logger.info('Starting proxy health check...')
    await Promise.allSettled(
      this.proxies.map(async (proxy) => {
        const start = Date.now()
        try {
          await axios.get('https://api.ipify.org?format=json', {
            proxy: this._toAxiosProxy(proxy),
            timeout: 10_000,
          })
          this.recordProxyResult(proxy.url, Date.now() - start, true)
          logger.info(`✓ ${proxy.host}:${proxy.port} (${Date.now() - start}ms)`)
        } catch {
          this.recordProxyResult(proxy.url, Date.now() - start, false)
          logger.warn(`✗ ${proxy.host}:${proxy.port}`)
        }
      })
    )
    logger.info('Proxy health check complete')
  }

  getProxyStats(): { total: number; available: number; banned: number } {
    const now = Date.now()
    const banned = this.proxies.filter((p) => p.bannedUntil && p.bannedUntil > now).length
    return { total: this.proxies.length, available: this.proxies.length - banned, banned }
  }

  // -------------------------------------------------------------------------
  // User-Agent rotation
  // -------------------------------------------------------------------------

  /** Weighted-random UA pick across all categories. */
  getRandomUA(): string {
    const r = Math.random() * UA_TOTAL_WEIGHT
    let lo = 0
    let hi = UA_CUMULATIVE.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (UA_CUMULATIVE[mid] < r) lo = mid + 1
      else hi = mid
    }
    return UA_POOL[lo].ua
  }

  /** Get a UA filtered by category; falls back to random if none match. */
  getUA(category: UACategory): string {
    const pool = UA_POOL.filter((e) => e.category === category)
    if (pool.length === 0) return this.getRandomUA()

    const total = pool.reduce((s, e) => s + e.weight, 0)
    const r = Math.random() * total
    let acc = 0
    for (const entry of pool) {
      acc += entry.weight
      if (r < acc) return entry.ua
    }
    return pool[pool.length - 1].ua
  }

  // -------------------------------------------------------------------------
  // Cookie jar
  // -------------------------------------------------------------------------

  setCookie(domain: string, name: string, value: string, options: Omit<CookieEntry, 'name' | 'value'> = {}): void {
    if (!this.cookieJar.has(domain)) {
      this.cookieJar.set(domain, new Map())
    }
    this.cookieJar.get(domain)!.set(name, { name, value, ...options })
  }

  getCookies(domain: string): CookieEntry[] {
    const jar = this.cookieJar.get(domain)
    if (!jar) return []

    const now = Math.floor(Date.now() / 1000)
    const valid: CookieEntry[] = []
    for (const [name, cookie] of jar) {
      if (cookie.expires && cookie.expires < now) {
        jar.delete(name) // prune expired
      } else {
        valid.push(cookie)
      }
    }
    return valid
  }

  getCookieHeader(domain: string): string {
    return this.getCookies(domain)
      .map((c) => `${c.name}=${c.value}`)
      .join('; ')
  }

  clearCookies(domain?: string): void {
    if (domain) {
      this.cookieJar.delete(domain)
    } else {
      this.cookieJar.clear()
    }
  }

  exportCookieJar(): Record<string, CookieEntry[]> {
    const out: Record<string, CookieEntry[]> = {}
    for (const [domain] of this.cookieJar) {
      out[domain] = this.getCookies(domain)
    }
    return out
  }

  importCookieJar(data: Record<string, CookieEntry[]>): void {
    for (const [domain, cookies] of Object.entries(data)) {
      for (const cookie of cookies) {
        this.setCookie(domain, cookie.name, cookie.value, {
          expires: cookie.expires,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
        })
      }
    }
  }

  // -------------------------------------------------------------------------
  // Adaptive rate limiting
  // -------------------------------------------------------------------------

  recordRequest(domain: string, responseMs: number, success: boolean): void {
    const existing = this.domainStats.get(domain) ?? {
      requestCount: 0,
      errorCount: 0,
      avgResponseMs: 0,
      lastRequest: 0,
    }

    const alpha = 0.2
    const newAvg = existing.avgResponseMs === 0
      ? responseMs
      : Math.round(alpha * responseMs + (1 - alpha) * existing.avgResponseMs)

    this.domainStats.set(domain, {
      requestCount: existing.requestCount + 1,
      errorCount: existing.errorCount + (success ? 0 : 1),
      avgResponseMs: newAvg,
      lastRequest: Date.now(),
    })
  }

  /**
   * Returns adaptive delay in ms for a domain.
   * Base: avg response time × 1.5, + 500 ms per error, clamped 500–10 000 ms.
   */
  getDelay(domain: string): number {
    const stats = this.domainStats.get(domain)
    if (!stats) return 1000

    const base = Math.round(stats.avgResponseMs * 1.5)
    const errorPenalty = stats.errorCount * 500
    return Math.min(Math.max(base + errorPenalty, 500), 10_000)
  }

  // -------------------------------------------------------------------------
  // Axios integration
  // -------------------------------------------------------------------------

  /**
   * Returns a ready-to-use AxiosRequestConfig with:
   *  - Best available proxy (if pool configured)
   *  - Randomised User-Agent
   *  - Cookie header for the target domain
   *  - Common browser-like headers
   */
  getAxiosConfig(
    url: string,
    options: {
      uaCategory?: UACategory
      forceProxy?: boolean
      extraHeaders?: Record<string, string>
      timeout?: number
    } = {}
  ): AxiosRequestConfig {
    const domain = parseDomain(url)
    const ua = options.uaCategory ? this.getUA(options.uaCategory) : this.getRandomUA()
    const cookieHeader = this.getCookieHeader(domain)

    const headers: Record<string, string> = {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      ...options.extraHeaders,
    }

    if (cookieHeader) {
      headers['Cookie'] = cookieHeader
    }

    const config: AxiosRequestConfig = {
      headers,
      timeout: options.timeout ?? 30_000,
    }

    const proxy = this.getBestProxy()
    if (proxy && (options.forceProxy !== false)) {
      config.proxy = this._toAxiosProxy(proxy)
    }

    return config
  }

  // -------------------------------------------------------------------------
  // Free proxy auto-fetch (ProxyScrape + Webshare)
  // -------------------------------------------------------------------------

  /**
   * Fetch free proxies from ProxyScrape and Webshare and add them to the pool.
   * Sources: api.proxyscrape.com (no key), proxyscrape.com/v2 (no key)
   * Env: WEBSHARE_API_KEY — optional Webshare free-tier key for extra proxies
   */
  async fetchFreeProxies(): Promise<number> {
    const sources = [
      // ProxyScrape — HTTP
      'https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
      // ProxyScrape — SOCKS5
      'https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&protocol=socks5&timeout=10000&country=all',
      // ProxyScrape v2 fallback
      'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all&simplified=true',
      // OpenProxyList
      'https://openproxylist.xyz/http.txt',
      'https://openproxylist.xyz/socks5.txt',
    ]

    let added = 0
    const before = this.proxies.length

    for (const url of sources) {
      try {
        const res = await axios.get<string>(url, {
          timeout: 12_000,
          responseType: 'text',
          headers: { 'User-Agent': 'MediaLinkExtractor/ProxyFetcher/1.0' },
        })
        const lines = (res.data as string)
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(l => /^\d+\.\d+\.\d+\.\d+:\d+$/.test(l))

        const protocol = url.includes('socks5') ? 'socks5' : 'http'
        this.addProxies(lines.map(l => `${protocol}://${l}`))
      } catch (err: any) {
        logger.warn(`Free proxy source failed (${url.slice(0, 60)}…): ${err.message}`)
      }
    }

    // Webshare free tier (needs API key)
    const webshareKey = process.env.WEBSHARE_API_KEY
    if (webshareKey) {
      try {
        const res = await axios.get('https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=100', {
          headers: { Authorization: `Token ${webshareKey}` },
          timeout: 12_000,
        })
        const results: any[] = res.data?.results ?? []
        for (const p of results) {
          const url = `http://${p.username}:${p.password}@${p.proxy_address}:${p.port}`
          this.addProxies([url])
        }
      } catch (err: any) {
        logger.warn(`Webshare fetch failed: ${err.message}`)
      }
    }

    added = this.proxies.length - before
    logger.info(`fetchFreeProxies: +${added} proxies (pool now ${this.proxies.length})`)
    return added
  }

  /**
   * Start auto-refresh of free proxies.
   * Fetches immediately on call, then repeats every intervalMs.
   */
  startAutoRefresh(intervalMs = 30 * 60 * 1000): ReturnType<typeof setInterval> {
    void this.fetchFreeProxies()
    return setInterval(() => void this.fetchFreeProxies(), intervalMs)
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _toAxiosProxy(proxy: ProxyEntry): AxiosProxyConfig {
    const cfg: AxiosProxyConfig = {
      host: proxy.host,
      port: proxy.port,
      protocol: proxy.protocol.startsWith('socks') ? 'socks5' : proxy.protocol,
    }
    if (proxy.username && proxy.password) {
      cfg.auth = { username: proxy.username, password: proxy.password }
    }
    return cfg
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const proxyPool = new ProxyPoolService()
