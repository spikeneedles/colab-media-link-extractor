/**
 * Background Crawler Service
 * 
 * Manages parallel background crawling operations
 * Automatically searches Prowlarr at intervals with parallel workers
 */

import { EventEmitter } from 'events'
import axios from 'axios'

export interface CrawlerConfig {
  prowlarrUrl: string
  prowlarrApiKey: string
  crawlInterval: number // ms between crawl cycles
  maxParallelWorkers: number
  categories: string[] // Categories to crawl (will search broadly within each)
  useAllIndexers: boolean
  queryString?: string // Optional query string (empty = search everything)
}

export interface CrawlResult {
  category: string
  categoryName: string
  results: any[]
  timestamp: number
  duration: number
  success: boolean
  error?: string
}

interface ProwlarrIndexer {
  id: number
  name: string
  enable: boolean
}

interface NormalizedResult {
  title: string
  size: number
  seeders: number
  leechers: number
  indexer: string
  indexerId: number
  category: string
  publishDate?: string
  downloadUrl?: string
  magnetUrl?: string
  infoHash?: string
  guid?: string
  score: number
}

export class BackgroundCrawler extends EventEmitter {
  private config: CrawlerConfig
  private running: boolean = false
  private workers: Map<number, boolean> = new Map()
  private resultsCache: CrawlResult[] = []
  private intervalTimer: NodeJS.Timeout | null = null

  constructor(config: CrawlerConfig) {
    super()
    this.config = config
    console.log(`✓ BackgroundCrawler initialized with ${config.maxParallelWorkers} workers`)
  }

  /**
   * Start background crawling
   */
  start(): void {
    if (this.running) {
      console.log('⚠️  BackgroundCrawler already running')
      return
    }

    this.running = true
    console.log('🔍 BackgroundCrawler started')
    
    // Start crawl cycle
    this.crawlCycle()
    
    // Schedule recurring crawls
    this.intervalTimer = setInterval(() => {
      this.crawlCycle()
    }, this.config.crawlInterval)
  }

  /**
   * Stop background crawling
   */
  stop(): void {
    this.running = false
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer)
      this.intervalTimer = null
    }
    console.log('🛑 BackgroundCrawler stopped')
  }

  /**
   * Execute a crawl cycle with parallel workers
   */
  private async crawlCycle(force: boolean = false): Promise<void> {
    if (!this.running && !force) return

    const categories = this.config.categories
    if (categories.length === 0) {
      console.log('⚠️  No categories configured for crawling')
      return
    }

    // Log indexer count for info (non-blocking — don't fail if unavailable)
    this.fetchEnabledIndexers().then(indexers => {
      if (indexers.length > 0) {
        console.log(`📋 ${indexers.length} indexers active in Prowlarr`)
      }
    }).catch(() => {})

    console.log(
      `🚀 Starting crawl cycle for ${categories.length} categories (all indexers) ` +
      `with ${this.config.maxParallelWorkers} workers`
    )

    // One search per category, Prowlarr aggregates all indexers internally.
    // Run all categories in parallel (4 requests vs 36).
    await Promise.allSettled(
      categories.map((category, i) => this.crawlCategory(category, i))
    )
    
    console.log(`✅ Crawl cycle completed. Total results cached: ${this.resultsCache.length}`)
    this.emit('cycleComplete', {
      resultsCount: this.resultsCache.length,
      timestamp: Date.now()
    })
  }

  /**
   * Trigger a single crawl cycle on demand
   */
  async runOnce(): Promise<void> {
    const wasRunning = this.running
    if (!wasRunning) {
      this.running = true
    }

    await this.crawlCycle(true)

    if (!wasRunning) {
      this.running = false
    }
  }

  /**
   * Crawl a single category (worker function)
   */
  private async crawlCategory(category: string, workerId: number): Promise<void> {
    this.workers.set(workerId, true)
    const startTime = Date.now()

    const categoryNames: Record<string, string> = {
      '1000': 'Console',
      '2000': 'Movies',
      '2070': 'Movies/Animation',
      '3000': 'Audio',
      '4000': 'PC',
      '5000': 'TV',
      '5070': 'TV/Animation',
      '6000': 'Books',
      '7000': 'Anime/Animation',
      '8000': 'XXX',
      '100000': 'Custom'
    }
    const categoryName = categoryNames[category] || `Category ${category}`

    try {
      // Legacy category-only crawl (kept for compatibility)
      console.log(`[Worker ${workerId}] Crawling category: ${categoryName} (${category})`)
      const normalized = await this.searchAndProcess(category, undefined)
      const duration = Date.now() - startTime

      const crawlResult: CrawlResult = {
        category,
        categoryName,
        results: normalized,
        timestamp: Date.now(),
        duration,
        success: true
      }

      this.cacheResult(crawlResult)
      console.log(`[Worker ${workerId}] ✅ Found ${normalized.length} results for ${categoryName} (${duration}ms)`)
      this.emit('categoryComplete', crawlResult)
    } catch (error) {
      this.handleCrawlError(workerId, category, categoryName, error, startTime)
    } finally {
      this.workers.set(workerId, false)
    }
  }

  private async crawlCategoryWithIndexer(category: string, indexer: ProwlarrIndexer, workerId: number): Promise<void> {
    this.workers.set(workerId, true)
    const startTime = Date.now()

    const categoryNames: Record<string, string> = {
      '1000': 'Console',
      '2000': 'Movies',
      '2070': 'Movies/Animation',
      '3000': 'Audio',
      '4000': 'PC',
      '5000': 'TV',
      '5070': 'TV/Animation',
      '6000': 'Books',
      '7000': 'Anime/Animation',
      '8000': 'XXX',
      '100000': 'Custom'
    }
    const categoryName = categoryNames[category] || `Category ${category}`

    try {
      console.log(`[Worker ${workerId}] Crawling ${categoryName} via ${indexer.name}`)

      const normalized = await this.searchAndProcess(category, indexer)
      const duration = Date.now() - startTime

      const crawlResult: CrawlResult = {
        category,
        categoryName,
        results: normalized,
        timestamp: Date.now(),
        duration,
        success: true
      }

      this.cacheResult(crawlResult)
      console.log(`[Worker ${workerId}] ✅ ${indexer.name} returned ${normalized.length} results (${duration}ms)`)
      this.emit('categoryComplete', crawlResult)
    } catch (error) {
      this.handleCrawlError(workerId, category, categoryName, error, startTime)
    } finally {
      this.workers.set(workerId, false)
    }
  }

  private async fetchEnabledIndexers(): Promise<ProwlarrIndexer[]> {
    try {
      const response = await axios.get(`${this.config.prowlarrUrl}/api/v1/indexer`, {
        headers: {
          'X-Api-Key': this.config.prowlarrApiKey,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      })

      const indexers = Array.isArray(response.data) ? response.data : []
      return indexers.filter((indexer: ProwlarrIndexer) => indexer.enable)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('❌ Failed to load Prowlarr indexers:', errorMsg)
      return []
    }
  }

  private async searchAndProcess(category: string, indexer?: ProwlarrIndexer): Promise<NormalizedResult[]> {
    const queryString = (this.config.queryString || '').trim() || 'a'
    const categoryParam = `&categories=${category}`
    const indexerParam = indexer?.id ? `&indexerIds=${indexer.id}` : `&indexerIds=-2`
    const apiUrl = `${this.config.prowlarrUrl}/api/v1/search?query=${encodeURIComponent(queryString)}${categoryParam}${indexerParam}&type=search`

    const response = await axios.get(apiUrl, {
      headers: {
        'X-Api-Key': this.config.prowlarrApiKey,
        'Accept': 'application/json'
      },
      timeout: 60000
    })

    const rawResults = Array.isArray(response.data) ? response.data : []
    const normalized = rawResults.map((result) =>
      this.normalizeResult(result, category, indexer)
    )

    return this.dedupeAndScore(normalized)
  }

  private normalizeResult(result: any, category: string, indexer?: ProwlarrIndexer): NormalizedResult {
    const seeders = result.seeders || 0
    const leechers = result.leechers || result.peers || 0
    const size = result.size || 0
    const indexerName = result.indexer || indexer?.name || 'Unknown'
    const indexerId = indexer?.id || result.indexerId || 0
    const publishDate = result.publishDate || result.pubDate

    return {
      title: result.title || 'Unknown',
      size,
      seeders,
      leechers,
      indexer: indexerName,
      indexerId,
      category,
      publishDate,
      downloadUrl: result.downloadUrl,
      magnetUrl: result.magnetUrl,
      infoHash: result.infoHash,
      guid: result.guid,
      score: this.computeScore(seeders, leechers, size)
    }
  }

  private dedupeAndScore(results: NormalizedResult[]): NormalizedResult[] {
    const map = new Map<string, NormalizedResult>()

    for (const result of results) {
      const key = result.infoHash || result.magnetUrl || result.downloadUrl || `${result.title}:${result.size}:${result.indexerId}`
      const existing = map.get(key)

      if (!existing || result.score > existing.score) {
        map.set(key, result)
      }
    }

    return Array.from(map.values()).sort((a, b) => b.score - a.score)
  }

  private computeScore(seeders: number, leechers: number, size: number): number {
    const sizeGb = size / (1024 * 1024 * 1024)
    return seeders * 5 + leechers * 2 - sizeGb
  }

  private cacheResult(result: CrawlResult): void {
    this.resultsCache.push(result)
    if (this.resultsCache.length > 100) {
      this.resultsCache.shift()
    }
  }

  private handleCrawlError(workerId: number, category: string, categoryName: string, error: unknown, startTime: number): void {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : String(error)

    console.error(`[Worker ${workerId}] ❌ Error crawling ${categoryName}:`, errorMsg)

    const crawlResult: CrawlResult = {
      category,
      categoryName,
      results: [],
      timestamp: Date.now(),
      duration,
      success: false,
      error: errorMsg
    }

    this.cacheResult(crawlResult)
    this.emit('categoryError', crawlResult)
  }

  /**
   * Get all cached results
   */
  getResults(): CrawlResult[] {
    return this.resultsCache
  }

  /**
   * Get results for a specific category
   */
  getResultsForCategory(category: string): CrawlResult[] {
    return this.resultsCache.filter(r => r.category === category)
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CrawlerConfig>): void {
    this.config = { ...this.config, ...config }
    console.log('✓ BackgroundCrawler configuration updated')
  }

  /**
   * Get crawler status
   */
  getStatus() {
    return {
      running: this.running,
      activeWorkers: Array.from(this.workers.values()).filter(active => active).length,
      totalWorkers: this.config.maxParallelWorkers,
      cachedResults: this.resultsCache.length,
      categories: this.config.categories,
      crawlInterval: this.config.crawlInterval
    }
  }
}
