/**
 * PlaywrightPoolService
 *
 * Multi-browser page pool using Playwright (https://playwright.dev/).
 * Provides Chromium, Firefox, and WebKit browsers as alternatives to the
 * Puppeteer-only BrowserPool — different fingerprinting, different anti-bot
 * bypass characteristics.
 *
 * Rationale:
 *   - Chromium  → same as Puppeteer, useful for Puppeteer-extra-style plugins
 *   - Firefox   → bypasses many Chromium-specific bot checks (canvas, WebGL)
 *   - WebKit    → Safari fingerprint; effective for some CDNs (Akamai, Fastly)
 *
 * Prerequisites: playwright must be installed:
 *   cd backend && npm install playwright
 *   npx playwright install  (downloads browser binaries ~300 MB)
 *
 * Env vars:
 *   PLAYWRIGHT_BROWSERS    — comma-separated list: "chromium,firefox,webkit"
 *                            (default: "chromium,firefox")
 *   PLAYWRIGHT_MAX_PAGES   — max concurrent pages per browser (default: 4)
 *   PLAYWRIGHT_HEADLESS    — "true" | "false" (default: "true")
 *   PLAYWRIGHT_TIMEOUT     — page timeout ms (default: 30000)
 */

import { EventEmitter } from 'events'

// Lazy-load playwright to avoid hard crash if not installed
let _playwright: any = null
async function getPlaywright() {
  if (_playwright) return _playwright
  try {
    _playwright = await import('playwright')
    return _playwright
  } catch {
    throw new Error('[PlaywrightPool] playwright not installed — run: cd backend && npm install playwright && npx playwright install')
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type PlaywrightBrowserType = 'chromium' | 'firefox' | 'webkit'

export interface PlaywrightPage {
  page:        any   // Playwright Page
  browserType: PlaywrightBrowserType
  createdAt:   number
}

interface BrowserSlot {
  browser:   any
  type:      PlaywrightBrowserType
  pages:     Set<any>
  maxPages:  number
}

// ── Service ────────────────────────────────────────────────────────────────────

export class PlaywrightPoolService extends EventEmitter {
  private slots:    BrowserSlot[] = []
  private maxPages: number
  private headless: boolean
  private timeout:  number
  private types:    PlaywrightBrowserType[]
  private ready     = false
  private initP?:   Promise<void>

  constructor() {
    super()
    const rawBrowsers = (process.env.PLAYWRIGHT_BROWSERS ?? 'chromium,firefox')
      .split(',').map(s => s.trim().toLowerCase()) as PlaywrightBrowserType[]
    this.types    = rawBrowsers.filter(b => ['chromium', 'firefox', 'webkit'].includes(b))
    this.maxPages = parseInt(process.env.PLAYWRIGHT_MAX_PAGES ?? '4', 10)
    this.headless = process.env.PLAYWRIGHT_HEADLESS !== 'false'
    this.timeout  = parseInt(process.env.PLAYWRIGHT_TIMEOUT ?? '30000', 10)
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Get a page from the pool.
   * Optionally specify which browser type; defaults to round-robin.
   */
  async getPage(preferType?: PlaywrightBrowserType): Promise<PlaywrightPage> {
    await this._ensureInit()
    const slot = await this._pickSlot(preferType)
    const pw   = await getPlaywright()
    const context = await slot.browser.newContext({
      userAgent: this._randomUA(slot.type),
      viewport:  { width: 1366 + Math.floor(Math.random() * 400), height: 768 + Math.floor(Math.random() * 200) },
      locale:    'en-US',
      timezoneId: 'America/New_York',
    })
    const page = await context.newPage()
    page.setDefaultTimeout(this.timeout)
    slot.pages.add(page)
    ;(page as any).__slot = slot
    ;(page as any).__ctx  = context
    return { page, browserType: slot.type, createdAt: Date.now() }
  }

  /**
   * Return a page to the pool. Closes its context (clears cookies/storage).
   */
  async releasePage(pw: PlaywrightPage): Promise<void> {
    try {
      const slot    = (pw.page as any).__slot as BrowserSlot
      const context = (pw.page as any).__ctx
      slot?.pages.delete(pw.page)
      await context?.close().catch(() => {})
    } catch {
      // best-effort
    }
  }

  /**
   * Fetch a URL through a Playwright browser, returning the final HTML.
   * Automatically handles navigation and waits for network idle.
   */
  async fetchUrl(url: string, browserType?: PlaywrightBrowserType): Promise<{
    html: string
    finalUrl: string
    status: number
    browserType: PlaywrightBrowserType
  }> {
    const pw  = await this.getPage(browserType)
    try {
      let status = 200
      pw.page.on('response', (res: any) => {
        if (res.url() === url) status = res.status()
      })
      await pw.page.goto(url, { waitUntil: 'networkidle', timeout: this.timeout })
      const html     = await pw.page.content()
      const finalUrl = pw.page.url()
      return { html, finalUrl, status, browserType: pw.browserType }
    } finally {
      await this.releasePage(pw)
    }
  }

  /** Quick health check — returns true if at least one browser is running. */
  async isReady(): Promise<boolean> {
    try {
      await this._ensureInit()
      return this.slots.length > 0
    } catch {
      return false
    }
  }

  /** Pool statistics. */
  getStats() {
    return this.slots.map(s => ({
      type:      s.type,
      activePages: s.pages.size,
      maxPages:  s.maxPages,
    }))
  }

  /** Gracefully close all browsers. */
  async cleanup(): Promise<void> {
    for (const slot of this.slots) {
      try { await slot.browser.close() } catch {}
    }
    this.slots = []
    this.ready = false
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _ensureInit(): Promise<void> {
    if (this.ready) return
    if (this.initP) return this.initP
    this.initP = this._init()
    return this.initP
  }

  private async _init(): Promise<void> {
    const pw = await getPlaywright()
    for (const type of this.types) {
      try {
        const browser = await pw[type].launch({
          headless: this.headless,
          args: type === 'chromium' ? [
            '--no-sandbox', '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled',
          ] : [],
        })
        this.slots.push({ browser, type, pages: new Set(), maxPages: this.maxPages })
        console.log(`[PlaywrightPool] ✓ ${type} browser launched`)
      } catch (err: any) {
        console.warn(`[PlaywrightPool] Failed to launch ${type}: ${err.message}`)
      }
    }
    if (this.slots.length === 0) {
      throw new Error('[PlaywrightPool] No browsers could be launched. Run: npx playwright install')
    }
    this.ready = true
  }

  private async _pickSlot(preferType?: PlaywrightBrowserType): Promise<BrowserSlot> {
    // Prefer requested type, fall back to least-loaded
    const candidates = preferType
      ? this.slots.filter(s => s.type === preferType)
      : this.slots

    const available = candidates.filter(s => s.pages.size < s.maxPages)
    if (available.length > 0) {
      return available.sort((a, b) => a.pages.size - b.pages.size)[0]
    }

    // Wait for any slot to free up
    return new Promise(resolve => {
      const check = () => {
        const free = (preferType ? this.slots.filter(s => s.type === preferType) : this.slots)
          .filter(s => s.pages.size < s.maxPages)
        if (free.length > 0) {
          resolve(free.sort((a, b) => a.pages.size - b.pages.size)[0])
        } else {
          setTimeout(check, 200)
        }
      }
      check()
    })
  }

  private _randomUA(type: PlaywrightBrowserType): string {
    const uas: Record<PlaywrightBrowserType, string[]> = {
      chromium: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      ],
      firefox: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:122.0) Gecko/20100101 Firefox/122.0',
        'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
      ],
      webkit: [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
      ],
    }
    const pool = uas[type]
    return pool[Math.floor(Math.random() * pool.length)]
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

export const playwrightPool = new PlaywrightPoolService()
