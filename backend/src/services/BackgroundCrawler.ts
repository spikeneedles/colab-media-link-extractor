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
  jackettUrl?: string
  jackettApiKey?: string
  newznabServers?: { url: string; apiKey: string }[]
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
  private domainBackoffs: Map<string, { backoffMs: number; consecutive429s: number; until: number }> = new Map()

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

    // Run Jackett + Newznab in parallel with Prowlarr results already cached above
    await this.crawlJackettAndNewznab()

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

    // Adaptive rate limiting per domain
    const domain = this.config.prowlarrUrl
    const delay = this.getDomainDelay(domain)
    if (delay > 0) await new Promise(r => setTimeout(r, delay))

    try {
      const response = await axios.get(apiUrl, {
        headers: {
          'X-Api-Key': this.config.prowlarrApiKey,
          'Accept': 'application/json'
        },
        timeout: 60000
      })

      this.recordDomainSuccess(domain)
      const rawResults = Array.isArray(response.data) ? response.data : []
      const normalized = rawResults.map((result) =>
        this.normalizeResult(result, category, indexer)
      )

      return this.dedupeAndScore(normalized)
    } catch (err: any) {
      const status = err?.response?.status
      this.recordDomainError(domain, status)
      throw err
    }
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

  // ── Adaptive rate limiting ────────────────────────────────────────────────

  recordDomainError(domain: string, statusCode?: number): void {
    const entry = this.domainBackoffs.get(domain) ?? { backoffMs: 0, consecutive429s: 0, until: 0 }
    if (statusCode === 429) {
      entry.consecutive429s++
      const backoff = Math.min(60000 * Math.pow(2, entry.consecutive429s - 1), 3600000)
      entry.backoffMs = backoff
      entry.until = Date.now() + backoff
    } else if (statusCode === 503) {
      entry.backoffMs = 30000
      entry.until = Date.now() + 30000
    }
    this.domainBackoffs.set(domain, entry)
  }

  private recordDomainSuccess(domain: string): void {
    this.domainBackoffs.delete(domain)
  }

  getDomainDelay(domain: string): number {
    const entry = this.domainBackoffs.get(domain)
    if (!entry) return 0
    const remaining = entry.until - Date.now()
    return remaining > 0 ? remaining : 0
  }

  // ── Jackett integration ───────────────────────────────────────────────────

  async searchJackett(query: string, category: string): Promise<NormalizedResult[]> {
    if (!this.config.jackettUrl || !this.config.jackettApiKey) return []
    const url = `${this.config.jackettUrl}/api/v2.0/indexers/all/results?apikey=${this.config.jackettApiKey}&Query=${encodeURIComponent(query)}&Category[]=${category}`
    try {
      const resp = await axios.get(url, { timeout: 30000 })
      const results: any[] = resp.data?.Results ?? []
      return this.dedupeAndScore(results.map(r => ({
        title:       r.Title       ?? 'Unknown',
        size:        r.Size        ?? 0,
        seeders:     r.Seeders     ?? 0,
        leechers:    r.Peers       ?? 0,
        indexer:     r.Tracker     ?? 'Jackett',
        indexerId:   0,
        category,
        publishDate: r.PublishDate,
        downloadUrl: r.Link,
        magnetUrl:   r.MagnetUri,
        infoHash:    r.InfoHash,
        guid:        r.Guid,
        score:       this.computeScore(r.Seeders ?? 0, r.Peers ?? 0, r.Size ?? 0),
      })))
    } catch (err: any) {
      console.error('❌ Jackett search error:', err.message)
      return []
    }
  }

  // ── Newznab integration ───────────────────────────────────────────────────

  async searchNewznab(server: { url: string; apiKey: string }, query: string, category: string): Promise<NormalizedResult[]> {
    const url = `${server.url}/api?apikey=${server.apiKey}&t=search&q=${encodeURIComponent(query)}&cat=${category}&extended=1`
    try {
      const resp = await axios.get(url, { timeout: 30000, responseType: 'text' })
      const xml: string = resp.data
      const results: NormalizedResult[] = []

      // Parse RSS <item> elements from Newznab XML
      const itemRe = /<item>([\s\S]*?)<\/item>/gi
      let im: RegExpExecArray | null
      while ((im = itemRe.exec(xml)) !== null) {
        const block = im[1]
        const title       = block.match(/<title[^>]*><!\[CDATA\[([^\]]*)\]\]><\/title>|<title[^>]*>([^<]*)<\/title>/)?.[1] ?? block.match(/<title>([^<]*)<\/title>/)?.[1] ?? 'Unknown'
        const link        = block.match(/<link>([^<]*)<\/link>/)?.[1]
        const enclosureUrl = block.match(/enclosure[^>]+url="([^"]+)"/)?.[1]
        const pubDate     = block.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1]
        const sizeAttr    = block.match(/newznab:attr[^>]+name="size"[^>]+value="(\d+)"/)?.[1] ?? '0'
        const seeders     = parseInt(block.match(/newznab:attr[^>]+name="seeders"[^>]+value="(\d+)"/)?.[1] ?? '0', 10)
        const leechers    = parseInt(block.match(/newznab:attr[^>]+name="peers"[^>]+value="(\d+)"/)?.[1] ?? '0', 10)
        const infoHash    = block.match(/newznab:attr[^>]+name="infohash"[^>]+value="([^"]+)"/)?.[1]
        const size        = parseInt(sizeAttr, 10)
        results.push({
          title: title.trim(),
          size,
          seeders,
          leechers,
          indexer: server.url,
          indexerId: 0,
          category,
          publishDate: pubDate,
          downloadUrl: enclosureUrl || link,
          magnetUrl: undefined,
          infoHash,
          guid: link,
          score: this.computeScore(seeders, leechers, size),
        })
      }
      return this.dedupeAndScore(results)
    } catch (err: any) {
      console.error(`❌ Newznab search error (${server.url}):`, err.message)
      return []
    }
  }

  // ── Combined Jackett + Newznab crawl ──────────────────────────────────────

  async crawlJackettAndNewznab(): Promise<void> {
    if (!this.config.jackettUrl && (!this.config.newznabServers || this.config.newznabServers.length === 0)) return

    const query = (this.config.queryString || '').trim() || 'a'
    const tasks: Promise<NormalizedResult[]>[] = []

    for (const category of this.config.categories) {
      if (this.config.jackettUrl && this.config.jackettApiKey) {
        tasks.push(this.searchJackett(query, category))
      }
      for (const server of (this.config.newznabServers ?? [])) {
        tasks.push(this.searchNewznab(server, query, category))
      }
    }

    const allResults = await Promise.allSettled(tasks)
    let total = 0
    for (const res of allResults) {
      if (res.status === 'fulfilled' && res.value.length > 0) {
        const crawlResult: CrawlResult = {
          category:     'jackett-newznab',
          categoryName: 'Jackett/Newznab',
          results:      res.value,
          timestamp:    Date.now(),
          duration:     0,
          success:      true,
        }
        this.cacheResult(crawlResult)
        total += res.value.length
      }
    }
    if (total > 0) console.log(`📡 Jackett/Newznab: ${total} results cached`)
  }
}
