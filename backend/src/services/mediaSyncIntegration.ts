/**
 * Media Sync Integration Service
 *
 * Bridges BackgroundCrawler events into the Archivist Protocol pipeline.
 * All results are routed through ArchivistService.processCrawlResults()
 * which enforces: resolve → validate → categorize → M3U commit (Rules 1–4).
 */

import FirebaseService from './sqliteService.js'
import { BackgroundCrawler, type CrawlResult } from './BackgroundCrawler.js'
import { archivist } from './ArchivistService.js'

export class MediaSyncIntegration {
  private firebaseService: FirebaseService
  private crawler: BackgroundCrawler | null = null
  private isEnabled = false

  constructor() {
    this.firebaseService = FirebaseService.getInstance()
  }

  async initialize(): Promise<void> {
    try {
      await this.firebaseService.initialize()
      await this.firebaseService.initializeMediaLists()
      this.isEnabled = true
      console.log('[MediaSync] Initialized and ready')
    } catch (error) {
      console.error('[MediaSync] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * Connect to a BackgroundCrawler — all results are funnelled through
   * the Archivist Protocol (resolve → validate → categorize → M3U commit).
   */
  connectCrawler(crawler: BackgroundCrawler): void {
    this.crawler = crawler

    crawler.on('categoryComplete', (result: CrawlResult) => {
      if (!this.isEnabled || !result.success || result.results.length === 0) return

      console.log(`[MediaSync] Processing ${result.results.length} results from ${result.categoryName}`)

      // Delegate entirely to the Archivist Protocol pipeline.
      // processCrawlResults now handles: resolve → dedup → validate → categorize → M3U commit.
      const sourceUrl = process.env.PROWLARR_URL || 'http://localhost:9696'
      archivist.processCrawlResults(result.results, sourceUrl, result.categoryName)
        .then(stats => {
          console.log(`[MediaSync] ${result.categoryName}: archived=${stats.archived} rejected=${stats.rejected} flagged=${stats.flagged}`)
        })
        .catch(err => {
          console.error('[MediaSync] Archivist pipeline error:', err)
        })
    })

    console.log('[MediaSync] Connected to BackgroundCrawler')
  }

  // ── Read-only helpers (still served from FirebaseService for legacy routes) ──

  async getMediaLists() {
    return this.firebaseService.getAllMediaLists()
  }

  async getMediaList(category: 'live tv' | 'movies' | 'series') {
    return this.firebaseService.getMediaList(category)
  }

  async searchMedia(query: string) {
    return this.firebaseService.searchMedia(query)
  }

  getStats() {
    return {
      enabled:          this.isEnabled,
      crawlerConnected: this.crawler !== null,
      timestamp:        Date.now(),
    }
  }
}

export default MediaSyncIntegration
