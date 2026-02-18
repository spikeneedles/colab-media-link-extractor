/**
 * Headless Browser Module
 * 
 * This module provides headless browsing capabilities for crawlers and scrapers.
 * Since Puppeteer is Node.js-only, we implement browser-compatible alternatives
 * that can be enhanced with a backend service when available.
 */

export type BrowserOptions = {
  timeout?: number
  waitForSelector?: string
  executeScript?: string
  captureScreenshot?: boolean
  blockImages?: boolean
  blockStyles?: boolean
  blockFonts?: boolean
  userAgent?: string
  viewport?: { width: number; height: number }
}

export type BrowserResult = {
  html: string
  text: string
  links: string[]
  scripts: string[]
  metadata: {
    title: string
    description?: string
    keywords?: string[]
    ogImage?: string
  }
  screenshot?: string
  executionTime: number
  error?: string
}

export type HeadlessBrowserConfig = {
  backendUrl?: string
  enableFallback: boolean
  maxRetries: number
  timeout: number
}

class HeadlessBrowser {
  private config: HeadlessBrowserConfig
  private iframe: HTMLIFrameElement | null = null

  constructor(config: Partial<HeadlessBrowserConfig> = {}) {
    this.config = {
      backendUrl: config.backendUrl,
      enableFallback: config.enableFallback ?? true,
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 30000,
    }
  }

  /**
   * Navigate to a URL and extract content with JavaScript rendering
   */
  async navigate(url: string, options: BrowserOptions = {}): Promise<BrowserResult> {
    const startTime = Date.now()

    if (this.config.backendUrl) {
      try {
        return await this.navigateWithBackend(url, options)
      } catch (error) {
        console.warn('Backend navigation failed, falling back to browser method:', error)
        if (!this.config.enableFallback) {
          throw error
        }
      }
    }

    return await this.navigateWithBrowser(url, options)
  }

  /**
   * Navigate using a backend Puppeteer service (recommended for production)
   */
  private async navigateWithBackend(url: string, options: BrowserOptions): Promise<BrowserResult> {
    const timeout = options.timeout || this.config.timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(`${this.config.backendUrl}/api/headless-browse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, options }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Navigate using browser-based approach (fallback for simple pages)
   */
  private async navigateWithBrowser(url: string, options: BrowserOptions): Promise<BrowserResult> {
    const startTime = Date.now()
    const timeout = options.timeout || this.config.timeout

    try {
      const response = await Promise.race([
        fetch(url, {
          headers: {
            'User-Agent': options.userAgent || navigator.userAgent,
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), timeout)
        ),
      ])

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const html = await response.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')

      const links = this.extractLinks(doc, url)
      const scripts = this.extractScripts(doc)
      const metadata = this.extractMetadata(doc)
      const text = doc.body?.textContent || ''

      const executionTime = Date.now() - startTime

      return {
        html,
        text: text.trim(),
        links,
        scripts,
        metadata,
        executionTime,
      }
    } catch (error) {
      const executionTime = Date.now() - startTime
      return {
        html: '',
        text: '',
        links: [],
        scripts: [],
        metadata: { title: '' },
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Extract all links from a document
   */
  private extractLinks(doc: Document, baseUrl: string): string[] {
    const links = new Set<string>()
    const anchorElements = doc.querySelectorAll('a[href]')

    anchorElements.forEach((anchor) => {
      try {
        const href = anchor.getAttribute('href')
        if (href) {
          const absoluteUrl = new URL(href, baseUrl).href
          links.add(absoluteUrl)
        }
      } catch (e) {
        // Invalid URL, skip
      }
    })

    return Array.from(links)
  }

  /**
   * Extract all script sources from a document
   */
  private extractScripts(doc: Document): string[] {
    const scripts = new Set<string>()
    const scriptElements = doc.querySelectorAll('script[src]')

    scriptElements.forEach((script) => {
      const src = script.getAttribute('src')
      if (src) {
        scripts.add(src)
      }
    })

    return Array.from(scripts)
  }

  /**
   * Extract metadata from a document
   */
  private extractMetadata(doc: Document): BrowserResult['metadata'] {
    const titleElement = doc.querySelector('title')
    const descriptionMeta = doc.querySelector('meta[name="description"]')
    const keywordsMeta = doc.querySelector('meta[name="keywords"]')
    const ogImageMeta = doc.querySelector('meta[property="og:image"]')

    return {
      title: titleElement?.textContent || '',
      description: descriptionMeta?.getAttribute('content') || undefined,
      keywords: keywordsMeta?.getAttribute('content')?.split(',').map(k => k.trim()) || undefined,
      ogImage: ogImageMeta?.getAttribute('content') || undefined,
    }
  }

  /**
   * Execute custom JavaScript in the context of the page
   */
  async executeScript(url: string, script: string, options: BrowserOptions = {}): Promise<any> {
    if (this.config.backendUrl) {
      const timeout = options.timeout || this.config.timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        const response = await fetch(`${this.config.backendUrl}/api/headless-execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url, script, options }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`)
        }

        const result = await response.json()
        return result.data
      } finally {
        clearTimeout(timeoutId)
      }
    }

    throw new Error('Script execution requires backend service')
  }

  /**
   * Wait for a specific element to appear on the page
   */
  async waitForElement(url: string, selector: string, options: BrowserOptions = {}): Promise<BrowserResult> {
    if (this.config.backendUrl) {
      return await this.navigate(url, { ...options, waitForSelector: selector })
    }

    const result = await this.navigateWithBrowser(url, options)
    
    if (result.error) {
      return result
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(result.html, 'text/html')
    const element = doc.querySelector(selector)

    if (!element) {
      return {
        ...result,
        error: `Element not found: ${selector}`,
      }
    }

    return result
  }

  /**
   * Take a screenshot of a page (requires backend)
   */
  async screenshot(url: string, options: BrowserOptions = {}): Promise<string | null> {
    if (!this.config.backendUrl) {
      throw new Error('Screenshot requires backend service')
    }

    const result = await this.navigate(url, { ...options, captureScreenshot: true })
    return result.screenshot || null
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.iframe) {
      this.iframe.remove()
      this.iframe = null
    }
  }
}

export const createHeadlessBrowser = (config?: Partial<HeadlessBrowserConfig>): HeadlessBrowser => {
  return new HeadlessBrowser(config)
}

/**
 * Utility function to detect if a URL requires JavaScript rendering
 */
export const requiresJavaScript = (url: string): boolean => {
  const jsFrameworks = [
    'angular',
    'react',
    'vue',
    'next',
    'nuxt',
    'svelte',
    'ember',
    'backbone',
  ]

  const urlLower = url.toLowerCase()
  return jsFrameworks.some(framework => urlLower.includes(framework))
}

/**
 * Utility function to extract media links from rendered page
 */
export const extractMediaFromRenderedPage = (html: string, baseUrl: string): string[] => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const mediaLinks = new Set<string>()

  const mediaElements = doc.querySelectorAll('video[src], audio[src], source[src], a[href]')
  
  mediaElements.forEach((element) => {
    const src = element.getAttribute('src') || element.getAttribute('href')
    if (!src) return

    try {
      const absoluteUrl = new URL(src, baseUrl).href
      
      const mediaPatterns = [
        /\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v|mpg|mpeg|3gp)$/i,
        /\.(mp3|wav|flac|aac|ogg|wma|m4a|opus)$/i,
        /\.(m3u8?|mpd|ism|f4m)$/i,
        /\/(live|stream|watch|video|audio|media)\//i,
        /rtmp|rtsp|rtp|udp|mms|hls|dash/i,
      ]

      if (mediaPatterns.some(pattern => pattern.test(absoluteUrl))) {
        mediaLinks.add(absoluteUrl)
      }
    } catch (e) {
      // Invalid URL
    }
  })

  const inlineScripts = doc.querySelectorAll('script:not([src])')
  inlineScripts.forEach((script) => {
    const content = script.textContent || ''
    const urlRegex = /(https?:\/\/[^\s"'<>]+\.(m3u8?|mpd|mp4|mkv|avi|mov|mp3|wav|flac|ism|f4m))/gi
    const matches = content.match(urlRegex)
    if (matches) {
      matches.forEach(url => mediaLinks.add(url))
    }
  })

  return Array.from(mediaLinks)
}

export default HeadlessBrowser
