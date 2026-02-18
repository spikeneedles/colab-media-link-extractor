import puppeteer, { Browser, Page } from 'puppeteer'

export interface BrowserPoolConfig {
  maxConcurrent: number
  timeout?: number
  headless?: boolean
}

export class BrowserPool {
  private browser: Browser | null = null
  private availablePages: Page[] = []
  private busyPages: Set<Page> = new Set()
  private maxConcurrent: number
  private timeout: number
  private headless: boolean
  private initPromise: Promise<void> | null = null

  constructor(config: BrowserPoolConfig) {
    this.maxConcurrent = config.maxConcurrent
    this.timeout = config.timeout || 30000
    this.headless = config.headless !== false
  }

  private async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = (async () => {
      console.log('🌐 Launching browser...')
      this.browser = await puppeteer.launch({
        headless: this.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      })
      console.log('✅ Browser launched')
    })()

    return this.initPromise
  }

  async getPage(): Promise<Page> {
    await this.init()

    if (this.availablePages.length > 0) {
      const page = this.availablePages.pop()!
      this.busyPages.add(page)
      return page
    }

    if (this.busyPages.size >= this.maxConcurrent) {
      await this.waitForAvailablePage()
      return this.getPage()
    }

    if (!this.browser) {
      throw new Error('Browser not initialized')
    }

    console.log(`📄 Creating new page (${this.busyPages.size + 1}/${this.maxConcurrent})`)
    const page = await this.browser.newPage()
    
    page.setDefaultTimeout(this.timeout)
    page.setDefaultNavigationTimeout(this.timeout)

    page.on('error', (error) => {
      console.error('Page error:', error)
    })

    page.on('pageerror', (error) => {
      console.error('Page error (uncaught):', error)
    })

    this.busyPages.add(page)
    return page
  }

  async releasePage(page: Page): Promise<void> {
    this.busyPages.delete(page)

    try {
      await page.evaluate(() => {
        window.stop()
      })

      const cookies = await page.cookies()
      if (cookies.length > 0) {
        await page.deleteCookie(...cookies)
      }

      await page.goto('about:blank')

      if (this.availablePages.length < this.maxConcurrent) {
        this.availablePages.push(page)
      } else {
        await page.close()
      }
    } catch (error) {
      console.error('Error releasing page:', error)
      try {
        await page.close()
      } catch (e) {
        // Ignore close errors
      }
    }
  }

  private async waitForAvailablePage(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.busyPages.size < this.maxConcurrent || this.availablePages.length > 0) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)

      setTimeout(() => {
        clearInterval(checkInterval)
        resolve()
      }, this.timeout)
    })
  }

  getStats() {
    return {
      activeBrowsers: this.busyPages.size,
      availableBrowsers: this.availablePages.length,
      maxBrowsers: this.maxConcurrent,
      totalPages: this.busyPages.size + this.availablePages.length,
    }
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up browser pool...')

    for (const page of this.busyPages) {
      try {
        await page.close()
      } catch (e) {
        // Ignore errors during cleanup
      }
    }

    for (const page of this.availablePages) {
      try {
        await page.close()
      } catch (e) {
        // Ignore errors during cleanup
      }
    }

    this.busyPages.clear()
    this.availablePages = []

    if (this.browser) {
      try {
        await this.browser.close()
        console.log('✅ Browser closed')
      } catch (e) {
        console.error('Error closing browser:', e)
      }
      this.browser = null
    }

    this.initPromise = null
  }
}
