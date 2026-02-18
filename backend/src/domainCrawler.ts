import axios, { AxiosInstance } from 'axios'
import * as cheerio from 'cheerio'
import { URL } from 'url'

interface CrawlResult {
  url: string
  title: string
  timestamp: Date
  mediaLinks: string[]
  metadata?: Record<string, any>
}

interface CrawlSession {
  sessionId: string
  startUrl: string
  domain: string
  status: 'pending' | 'crawling' | 'completed' | 'error'
  progress: number
  discoveredUrls: Set<string>
  mediaLinks: Set<string>
  results: CrawlResult[]
  startedAt: Date
  completedAt?: Date
  error?: string
}

export class DomainCrawler {
  private sessions: Map<string, CrawlSession> = new Map()
  private axiosInstance: AxiosInstance
  private maxPagesPerDomain: number = 100
  private maxDepth: number = 3
  private timeout: number = 30000

  constructor(maxPages = 100, maxDepth = 3) {
    this.maxPagesPerDomain = maxPages
    this.maxDepth = maxDepth

    this.axiosInstance = axios.create({
      timeout: this.timeout,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
  }

  /**
   * Start crawling a domain from initial URL
   */
  async startCrawl(
    sessionId: string,
    initialUrl: string,
    title: string = 'Media Crawl'
  ): Promise<CrawlSession> {
    try {
      const domain = new URL(initialUrl).hostname!

      const session: CrawlSession = {
        sessionId,
        startUrl: initialUrl,
        domain,
        status: 'pending',
        progress: 0,
        discoveredUrls: new Set([initialUrl]),
        mediaLinks: new Set(),
        results: [],
        startedAt: new Date(),
      }

      this.sessions.set(sessionId, session)

      // Start crawl asynchronously
      this.crawlDomain(session, title).catch((error) => {
        session.status = 'error'
        session.error = error.message
        session.completedAt = new Date()
      })

      return session
    } catch (error) {
      throw new Error(`Failed to start crawl: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Recursively crawl domain and extract media links
   */
  private async crawlDomain(session: CrawlSession, title: string, depth = 0): Promise<void> {
    if (depth > this.maxDepth || session.discoveredUrls.size > this.maxPagesPerDomain) {
      session.status = 'completed'
      session.completedAt = new Date()
      return
    }

    session.status = 'crawling'

    // Get URLs to crawl at this depth
    const urlsToCrawl = Array.from(session.discoveredUrls).slice(
      0,
      Math.min(10, this.maxPagesPerDomain - session.discoveredUrls.size)
    )

    for (const url of urlsToCrawl) {
      if (session.discoveredUrls.size >= this.maxPagesPerDomain) break

      try {
        const result = await this.crawlPage(url, session.domain, title)

        // Extract media links
        result.mediaLinks.forEach((link) => session.mediaLinks.add(link))

        session.results.push(result)
        session.progress = Math.round((session.results.length / Math.min(50, this.maxPagesPerDomain)) * 100)

        // Discover new URLs from this page
        const $ = cheerio.load(result.metadata?.html || '')
        $('a[href]').each((_: number, el: any) => {
          try {
            const href = $(el).attr('href')!
            if (!href) return

            const absoluteUrl = new URL(href, url).toString()
            const urlDomain = new URL(absoluteUrl).hostname

            // Only crawl same domain
            if (urlDomain === session.domain && !session.discoveredUrls.has(absoluteUrl)) {
              session.discoveredUrls.add(absoluteUrl)
            }
          } catch {
            // Skip invalid URLs
          }
        })
      } catch (error) {
        console.warn(`Error crawling ${url}:`, error)
      }
    }

    // Continue to next depth
    await this.crawlDomain(session, title, depth + 1)
  }

  /**
   * Crawl a single page and extract media links
   */
  private async crawlPage(url: string, domain: string, pageTitle: string): Promise<CrawlResult> {
    try {
      const response = await this.axiosInstance.get(url)
      const html = response.data

      const mediaLinks = this.extractMediaLinks(html)

      return {
        url,
        title: pageTitle || domain,
        timestamp: new Date(),
        mediaLinks,
        metadata: {
          html,
          statusCode: response.status,
          contentType: response.headers['content-type'],
        },
      }
    } catch (error) {
      console.warn(`Failed to crawl ${url}:`, error)
      return {
        url,
        title: pageTitle || domain,
        timestamp: new Date(),
        mediaLinks: [],
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    }
  }

  /**
   * Extract media links from HTML
   */
  private extractMediaLinks(html: string): string[] {
    const links = new Set<string>()

    const mediaPatterns = [
      /https?:\/\/[^\s"'<>]+\.m3u8/gi,
      /https?:\/\/[^\s"'<>]+\.m3u/gi,
      /https?:\/\/[^\s"'<>]+\.ts(?:\?[^\s"'<>]*)?/gi,
      /https?:\/\/[^\s"'<>]+\.mp4(?:\?[^\s"'<>]*)?/gi,
      /https?:\/\/[^\s"'<>]+\.mkv(?:\?[^\s"'<>]*)?/gi,
      /https?:\/\/[^\s"'<>]+\.webm(?:\?[^\s"'<>]*)?/gi,
      /https?:\/\/[^\s"'<>]+\.flv(?:\?[^\s"'<>]*)?/gi,
      /rtmp:\/\/[^\s"'<>]+/gi,
      /rtmps:\/\/[^\s"'<>]+/gi,
    ]

    for (const pattern of mediaPatterns) {
      const matches = html.matchAll(pattern)
      for (const match of matches) {
        const url = match[0]
        try {
          new URL(url)
          links.add(url)
        } catch {
          // Skip invalid URLs
        }
      }
    }

    // Extract from JSON/API patterns
    try {
      const jsonMatches = html.matchAll(/"(?:url|src|stream|media|video)"\s*:\s*"([^"]+)"/gi)
      for (const match of jsonMatches) {
        const url = match[1]
        if (this.isMediaUrl(url)) {
          links.add(url)
        }
      }
    } catch {
      // Skip
    }

    return Array.from(links)
  }

  /**
   * Check if URL is likely a media URL
   */
  private isMediaUrl(url: string): boolean {
    const mediaExtensions = ['.m3u8', '.m3u', '.ts', '.mp4', '.mkv', '.webm', '.flv', '.avi', '.mov']
    return mediaExtensions.some((ext) => url.toLowerCase().includes(ext))
  }

  /**
   * Get crawl session
   */
  getSession(sessionId: string): CrawlSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Get all media links from session
   */
  getAllMediaLinks(sessionId: string): string[] {
    const session = this.sessions.get(sessionId)
    return session ? Array.from(session.mediaLinks) : []
  }

  /**
   * Get crawl results
   */
  getResults(sessionId: string): CrawlResult[] {
    const session = this.sessions.get(sessionId)
    return session ? session.results : []
  }

  /**
   * Cancel crawl
   */
  cancelCrawl(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.status = 'error'
      session.error = 'Cancelled by user'
      session.completedAt = new Date()
      return true
    }
    return false
  }

  /**
   * Clean up old sessions
   */
  cleanup(): void {
    const now = Date.now()
    const maxAge = 3600000 // 1 hour

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.completedAt && now - session.completedAt.getTime() > maxAge) {
        this.sessions.delete(sessionId)
      }
    }
  }
}

export default DomainCrawler
