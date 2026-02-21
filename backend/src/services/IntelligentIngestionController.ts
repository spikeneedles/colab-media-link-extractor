/**
 * Intelligent Ingestion Controller
 * 
 * Processes payloads from Agent 1 (The Harvester) with tiered logic:
 * 1. IF metadata.addon.sourceUrl exists → Git Repository Scan
 * 2. ELSE IF metadata.headers.referer exists → Automated Crawler
 * 3. ELSE → Octokit Targeted Search via metadata.addon.id
 * 
 * All captured media persisted to Content Intelligence database
 */

import { Octokit } from '@octokit/rest'

/**
 * Payload structure from Agent 1 (The Harvester)
 */
export interface Agent1Payload {
  job_id: string
  source_url: string
  repo_type: string
  repo_url?: string
  confidence_level: 'high' | 'medium' | 'low'
  kodi_session_id?: string
  kodi_source?: string
  metadata: {
    addon?: {
      id?: string
      name?: string
      version?: string
      sourceUrl?: string  // Tier 1: Git Repository Scan trigger
      author?: string
    }
    headers?: {
      referer?: string    // Tier 2: Automated Crawler trigger
      userAgent?: string
      [key: string]: any
    }
    media_type?: 'movie' | 'tv-series' | 'live-tv' | 'vod' | 'unknown'
    category?: string
    source_name?: string
    [key: string]: any
  }
  results?: {
    total_links_found?: number
    total_files_scanned?: number
    media_breakdown?: {
      video_count?: number
      audio_count?: number
      playlist_count?: number
    }
    file_types_found?: string[]
  }
}

/**
 * Content Intelligence Record
 */
export interface ContentIntelligenceRecord {
  id: string
  job_id: string
  ingestion_timestamp: Date
  ingestion_method: 'git_scan' | 'web_crawler' | 'octokit_search'
  source_url: string
  repository_info: {
    type: string
    url: string
    name?: string
    owner?: string
    branch?: string
    confidence: 'high' | 'medium' | 'low'
  }
  extracted_media: ExtractedMedia[]
  kodi_metadata: {
    session_id?: string
    source?: string
    addon_id?: string
  }
  content_tags: {
    media_type?: string
    category?: string
    verified?: boolean
    ai_confidence?: number
  }
  processing_stats: {
    total_files_scanned: number
    total_media_extracted: number
    processing_time_ms: number
    extraction_methods: string[]
  }
}

/**
 * Extracted Media Item
 */
export interface ExtractedMedia {
  id: string
  type: 'video' | 'audio' | 'playlist' | 'archive' | 'document' | 'other'
  name?: string
  url: string
  mime_type?: string
  file_size?: number
  extracted_from: string
  extraction_metadata: {
    method: string
    confidence: number
    timestamp: Date
    source_file?: string
  }
  content_hash?: string
}

/**
 * Ingestion Result
 */
export interface IngestionResult {
  success: boolean
  ingest_id: string
  ingestion_method: 'git_scan' | 'web_crawler' | 'octokit_search'
  status: 'processing' | 'completed' | 'failed'
  media_extracted: number
  database_records: number
  error?: string
  details?: {
    git_repository?: string
    crawler_url?: string
    octokit_results?: number
    [key: string]: any
  }
}

/**
 * Intelligent Ingestion Service
 */
export class IntelligentIngestionController {
  private octokit: Octokit
  private contentIntelligenceDB: Map<string, ContentIntelligenceRecord> = new Map()
  private extractedMediaDB: Map<string, ExtractedMedia[]> = new Map()
  private testMode: boolean = false

  constructor(githubToken?: string, enableTestMode?: boolean) {
    // Initialize Octokit with GitHub token if provided
    this.octokit = new Octokit({
      auth: githubToken || process.env.GITHUB_TOKEN,
    })
    
    // Enable test mode if explicitly passed or via environment variable
    this.testMode = enableTestMode || process.env.TEST_MODE === 'true'
    
    if (this.testMode) {
      console.log('🧪 [TEST MODE] Intelligent Ingestion Controller initialized with logging enabled')
    }
  }

  /**
   * Enable or disable test mode logging
   */
  setTestMode(enabled: boolean): void {
    this.testMode = enabled
    console.log(`🧪 [TEST MODE] ${enabled ? 'ENABLED' : 'DISABLED'}`)
  }

  /**
   * Check if test mode is enabled
   */
  isTestMode(): boolean {
    return this.testMode
  }

  /**
   * Main ingestion method - implements tiered logic
   */
  async ingest(payload: Agent1Payload): Promise<IngestionResult> {
    const ingestId = `ingest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startTime = Date.now()

    if (this.testMode) {
      console.log('\n')
      console.log('═══════════════════════════════════════════════════════════════════════════')
      console.log('🧪 [VALIDATION LOGGER] DECISION TREE EVALUATION STARTING')
      console.log('═══════════════════════════════════════════════════════════════════════════')
      console.log(`📋 Ingest ID: ${ingestId}`)
      console.log(`📋 Job ID: ${payload.job_id}`)
      console.log(`📋 Source URL: ${payload.source_url}`)
      console.log('───────────────────────────────────────────────────────────────────────────')
    }

    try {
      // ════════════════════════════════════════════════════════════════════════════
      // TIER 1: Check if metadata.addon.sourceUrl exists
      // ════════════════════════════════════════════════════════════════════════════
      if (this.testMode) {
        console.log('\n🔍 TIER 1 CHECK: metadata.addon.sourceUrl')
        console.log(`   Present: ${!!payload.metadata?.addon?.sourceUrl}`)
        if (payload.metadata?.addon?.sourceUrl) {
          console.log(`   Value: ${payload.metadata.addon.sourceUrl}`)
        }
      }

      if (payload.metadata?.addon?.sourceUrl) {
        if (this.testMode) {
          console.log('\n✅ TIER 1 MATCH DETECTED')
          console.log('   ↓ Pathway Selected: Git Repository Scan')
          console.log('   ↓ Triggering: processGitRepositoryScan()')
          console.log(`   ↓ Repository: ${payload.metadata.addon.sourceUrl}`)
        }
        return await this.processGitRepositoryScan(payload, ingestId, startTime)
      }

      if (this.testMode) {
        console.log('❌ TIER 1 NOT MATCHED - Proceeding to TIER 2\n')
      }

      // ════════════════════════════════════════════════════════════════════════════
      // TIER 2: Check if metadata.headers.referer exists
      // ════════════════════════════════════════════════════════════════════════════
      if (this.testMode) {
        console.log('🔍 TIER 2 CHECK: metadata.headers.referer')
        console.log(`   Present: ${!!payload.metadata?.headers?.referer}`)
        if (payload.metadata?.headers?.referer) {
          console.log(`   Value: ${payload.metadata.headers.referer}`)
        }
      }

      if (payload.metadata?.headers?.referer) {
        if (this.testMode) {
          console.log('\n✅ TIER 2 MATCH DETECTED')
          console.log('   ↓ Pathway Selected: Automated Web Crawler')
          console.log('   ↓ Triggering: processAutomatedCrawler()')
          console.log(`   ↓ Crawler URL (referer): ${payload.metadata.headers.referer}`)
        }
        return await this.processAutomatedCrawler(payload, ingestId, startTime)
      }

      if (this.testMode) {
        console.log('❌ TIER 2 NOT MATCHED - Proceeding to TIER 3\n')
      }

      // ════════════════════════════════════════════════════════════════════════════
      // TIER 3: Use metadata.addon.id for Octokit search
      // ════════════════════════════════════════════════════════════════════════════
      if (this.testMode) {
        console.log('🔍 TIER 3 CHECK: metadata.addon.id')
        console.log(`   Present: ${!!payload.metadata?.addon?.id}`)
        if (payload.metadata?.addon?.id) {
          console.log(`   Value: ${payload.metadata.addon.id}`)
          console.log(`   Addon Name: ${payload.metadata.addon.name || 'N/A'}`)
        }
      }

      if (payload.metadata?.addon?.id) {
        if (this.testMode) {
          console.log('\n✅ TIER 3 MATCH DETECTED')
          console.log('   ↓ Pathway Selected: Octokit GitHub Search')
          console.log('   ↓ Triggering: processOctokitSearch()')
          console.log(`   ↓ Search Query: ${payload.metadata.addon.id} ${payload.metadata.addon.name || ''}`)
        }
        return await this.processOctokitSearch(payload, ingestId, startTime)
      }

      if (this.testMode) {
        console.log('❌ TIER 3 NOT MATCHED - Using FALLBACK\n')
      }

      // ════════════════════════════════════════════════════════════════════════════
      // FALLBACK: Use the source_url directly
      // ════════════════════════════════════════════════════════════════════════════
      if (this.testMode) {
        console.log('🔍 FALLBACK CHECK: Direct URL Ingestion')
        console.log('   All tiers exhausted - using source_url')
        console.log('   ↓ Pathway Selected: Direct URL Crawl')
        console.log('   ↓ Triggering: processDirectURLIngestion()')
        console.log(`   ↓ Target URL: ${payload.source_url}`)
      }
      return await this.processDirectURLIngestion(payload, ingestId, startTime)
    } catch (error) {
      if (this.testMode) {
        console.log('\n❌ ERROR DURING INGESTION')
        console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
      return {
        success: false,
        ingest_id: ingestId,
        ingestion_method: 'octokit_search',
        status: 'failed',
        media_extracted: 0,
        database_records: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Tier 1: Git Repository Scan
   * Triggered when metadata.addon.sourceUrl exists
   */
  private async processGitRepositoryScan(
    payload: Agent1Payload,
    ingestId: string,
    startTime: number
  ): Promise<IngestionResult> {
    try {
      const sourceUrl = payload.metadata?.addon?.sourceUrl
      if (!sourceUrl) {
        throw new Error('sourceUrl not found in metadata.addon')
      }

      if (this.testMode) {
        console.log('\n📂 [TIER 1 EXECUTION] Git Repository Scan')
        console.log(`   Repository URL: ${sourceUrl}`)
      }

      // Parse repository info from sourceUrl
      const repoInfo = this.parseRepositoryUrl(sourceUrl)
      if (!repoInfo) {
        throw new Error('Could not parse repository URL')
      }

      if (this.testMode) {
        console.log(`   Detected Type: ${repoInfo.type}`)
        console.log(`   Owner: ${repoInfo.owner || 'N/A'}`)
        console.log(`   Repository: ${repoInfo.name || 'N/A'}`)
      }

      // Perform Git repository scan
      const mediaItems = await this.scanGitRepository(repoInfo)

      if (this.testMode) {
        console.log(`   ✓ Media Items Extracted: ${mediaItems.length}`)
      }

      // Persist to Content Intelligence database
      const record = this.createContentIntelligenceRecord(
        payload,
        ingestId,
        'git_scan',
        mediaItems,
        repoInfo,
        Date.now() - startTime
      )

      this.contentIntelligenceDB.set(ingestId, record)
      this.extractedMediaDB.set(ingestId, mediaItems)

      if (this.testMode) {
        console.log(`   ✓ Persisted to Content Intelligence DB`)
        console.log(`   ✓ Processing Time: ${Date.now() - startTime}ms`)
        console.log('───────────────────────────────────────────────────────────────────────────')
        console.log('✅ [RESULT] Git Repository Scan - COMPLETED')
        console.log(`   Ingest ID: ${ingestId}`)
        console.log(`   Media Extracted: ${mediaItems.length}`)
        console.log(`   Database Records: 1`)
        console.log('═══════════════════════════════════════════════════════════════════════════\n')
      }

      return {
        success: true,
        ingest_id: ingestId,
        ingestion_method: 'git_scan',
        status: 'completed',
        media_extracted: mediaItems.length,
        database_records: 1,
        details: {
          git_repository: sourceUrl,
          files_scanned: mediaItems.length,
        },
      }
    } catch (error) {
      if (this.testMode) {
        console.log('───────────────────────────────────────────────────────────────────────────')
        console.log('❌ [RESULT] Git Repository Scan - FAILED')
        console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        console.log('═══════════════════════════════════════════════════════════════════════════\n')
      }
      return {
        success: false,
        ingest_id: ingestId,
        ingestion_method: 'git_scan',
        status: 'failed',
        media_extracted: 0,
        database_records: 0,
        error: error instanceof Error ? error.message : 'Git scan failed',
      }
    }
  }

  /**
   * Tier 2: Automated Crawler
   * Triggered when metadata.headers.referer exists
   */
  private async processAutomatedCrawler(
    payload: Agent1Payload,
    ingestId: string,
    startTime: number
  ): Promise<IngestionResult> {
    try {
      const crawlerUrl = payload.metadata?.headers?.referer || payload.source_url
      if (!crawlerUrl) {
        throw new Error('No crawler URL available')
      }

      if (this.testMode) {
        console.log('\n🌐 [TIER 2 EXECUTION] Automated Web Crawler')
        console.log(`   Crawler URL: ${crawlerUrl}`)
      }

      // Perform web crawling on the referer URL
      const mediaItems = await this.crawlWebURL(crawlerUrl)

      if (this.testMode) {
        console.log(`   ✓ Media Items Extracted: ${mediaItems.length}`)
      }

      // Extract repository info from crawled content
      const repoInfo = this.parseRepositoryUrl(crawlerUrl)

      // Persist to Content Intelligence database
      const record = this.createContentIntelligenceRecord(
        payload,
        ingestId,
        'web_crawler',
        mediaItems,
        repoInfo || { type: 'web', url: crawlerUrl, confidence: 'low' as const },
        Date.now() - startTime
      )

      this.contentIntelligenceDB.set(ingestId, record)
      this.extractedMediaDB.set(ingestId, mediaItems)

      if (this.testMode) {
        console.log(`   ✓ Persisted to Content Intelligence DB`)
        console.log(`   ✓ Processing Time: ${Date.now() - startTime}ms`)
        console.log('───────────────────────────────────────────────────────────────────────────')
        console.log('✅ [RESULT] Web Crawler - COMPLETED')
        console.log(`   Ingest ID: ${ingestId}`)
        console.log(`   Media Extracted: ${mediaItems.length}`)
        console.log(`   Database Records: 1`)
        console.log('═══════════════════════════════════════════════════════════════════════════\n')
      }

      return {
        success: true,
        ingest_id: ingestId,
        ingestion_method: 'web_crawler',
        status: 'completed',
        media_extracted: mediaItems.length,
        database_records: 1,
        details: {
          crawler_url: crawlerUrl,
          media_items_extracted: mediaItems.length,
        },
      }
    } catch (error) {
      if (this.testMode) {
        console.log('───────────────────────────────────────────────────────────────────────────')
        console.log('❌ [RESULT] Web Crawler - FAILED')
        console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        console.log('═══════════════════════════════════════════════════════════════════════════\n')
      }
      return {
        success: false,
        ingest_id: ingestId,
        ingestion_method: 'web_crawler',
        status: 'failed',
        media_extracted: 0,
        database_records: 0,
        error: error instanceof Error ? error.message : 'Web crawl failed',
      }
    }
  }

  /**
   * Tier 3: Octokit Targeted Search
   * Uses metadata.addon.id to perform GitHub API search
   */
  private async processOctokitSearch(
    payload: Agent1Payload,
    ingestId: string,
    startTime: number
  ): Promise<IngestionResult> {
    try {
      const addonId = payload.metadata?.addon?.id
      if (!addonId) {
        throw new Error('addon.id not found in metadata')
      }

      if (this.testMode) {
        console.log('\n🔍 [TIER 3 EXECUTION] Octokit Targeted Search')
        console.log(`   Addon ID: ${addonId}`)
        console.log(`   Addon Name: ${payload.metadata?.addon?.name || 'N/A'}`)
      }

      // Search GitHub for addon-related repositories
      const searchResults = await this.searchGitHubByAddonId(addonId, payload.metadata?.addon?.name)

      if (this.testMode) {
        console.log(`   ✓ GitHub Search Results: ${searchResults.total_count || 0}`)
      }

      // Extract media items from search results
      const mediaItems = await this.extractMediaFromOctokitResults(searchResults)

      if (this.testMode) {
        console.log(`   ✓ Media Items Extracted: ${mediaItems.length}`)
      }

      // Determine primary repository info from search results
      const primaryRepo = searchResults.items?.[0]
      const repoInfo = primaryRepo
        ? {
            type: 'github',
            name: primaryRepo.name,
            owner: primaryRepo.owner?.login,
            url: primaryRepo.html_url,
            confidence: 'high' as const,
          }
        : { type: 'github', url: `https://github.com/search?q=${addonId}`, confidence: 'low' as const }

      // Persist to Content Intelligence database
      const record = this.createContentIntelligenceRecord(
        payload,
        ingestId,
        'octokit_search',
        mediaItems,
        repoInfo,
        Date.now() - startTime
      )

      this.contentIntelligenceDB.set(ingestId, record)
      this.extractedMediaDB.set(ingestId, mediaItems)

      if (this.testMode) {
        console.log(`   ✓ Persisted to Content Intelligence DB`)
        console.log(`   ✓ Processing Time: ${Date.now() - startTime}ms`)
        console.log('───────────────────────────────────────────────────────────────────────────')
        console.log('✅ [RESULT] Octokit Search - COMPLETED')
        console.log(`   Ingest ID: ${ingestId}`)
        console.log(`   Media Extracted: ${mediaItems.length}`)
        console.log(`   Repositories Found: ${searchResults.items?.length || 0}`)
        console.log(`   Database Records: 1`)
        console.log('═══════════════════════════════════════════════════════════════════════════\n')
      }

      return {
        success: true,
        ingest_id: ingestId,
        ingestion_method: 'octokit_search',
        status: 'completed',
        media_extracted: mediaItems.length,
        database_records: 1,
        details: {
          octokit_results: searchResults.total_count || 0,
          repositories_found: searchResults.items?.length || 0,
        },
      }
    } catch (error) {
      if (this.testMode) {
        console.log('───────────────────────────────────────────────────────────────────────────')
        console.log('❌ [RESULT] Octokit Search - FAILED')
        console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        console.log('═══════════════════════════════════════════════════════════════════════════\n')
      }
      return {
        success: false,
        ingest_id: ingestId,
        ingestion_method: 'octokit_search',
        status: 'failed',
        media_extracted: 0,
        database_records: 0,
        error: error instanceof Error ? error.message : 'Octokit search failed',
      }
    }
  }

  /**
   * Fallback: Direct URL Ingestion
   */
  private async processDirectURLIngestion(
    payload: Agent1Payload,
    ingestId: string,
    startTime: number
  ): Promise<IngestionResult> {
    try {
      if (this.testMode) {
        console.log('\n🔗 [FALLBACK EXECUTION] Direct URL Ingestion')
        console.log(`   Target URL: ${payload.source_url}`)
        console.log(`   Repository Type: ${payload.repo_type || 'unknown'}`)
      }

      const mediaItems = await this.crawlWebURL(payload.source_url)

      if (this.testMode) {
        console.log(`   ✓ Media Items Extracted: ${mediaItems.length}`)
      }

      const repoInfo = this.parseRepositoryUrl(payload.source_url) || {
        type: payload.repo_type,
        url: payload.source_url,
        confidence: payload.confidence_level,
      }

      const record = this.createContentIntelligenceRecord(
        payload,
        ingestId,
        'web_crawler',
        mediaItems,
        repoInfo,
        Date.now() - startTime
      )

      this.contentIntelligenceDB.set(ingestId, record)
      this.extractedMediaDB.set(ingestId, mediaItems)

      if (this.testMode) {
        console.log(`   ✓ Persisted to Content Intelligence DB`)
        console.log(`   ✓ Processing Time: ${Date.now() - startTime}ms`)
        console.log('───────────────────────────────────────────────────────────────────────────')
        console.log('✅ [RESULT] Direct URL Ingestion - COMPLETED')
        console.log(`   Ingest ID: ${ingestId}`)
        console.log(`   Media Extracted: ${mediaItems.length}`)
        console.log(`   Database Records: 1`)
        console.log('═══════════════════════════════════════════════════════════════════════════\n')
      }

      return {
        success: true,
        ingest_id: ingestId,
        ingestion_method: 'web_crawler',
        status: 'completed',
        media_extracted: mediaItems.length,
        database_records: 1,
        details: {
          crawler_url: payload.source_url,
        },
      }
    } catch (error) {
      if (this.testMode) {
        console.log('───────────────────────────────────────────────────────────────────────────')
        console.log('❌ [RESULT] Direct URL Ingestion - FAILED')
        console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        console.log('═══════════════════════════════════════════════════════════════════════════\n')
      }
      return {
        success: false,
        ingest_id: ingestId,
        ingestion_method: 'web_crawler',
        status: 'failed',
        media_extracted: 0,
        database_records: 0,
        error: error instanceof Error ? error.message : 'Direct URL ingestion failed',
      }
    }
  }

  /**
   * Scan a Git repository for media files
   */
  private async scanGitRepository(repoInfo: any): Promise<ExtractedMedia[]> {
    const mediaItems: ExtractedMedia[] = []

    // Simulated Git repository scanning
    // In production, this would use git clone + file scanning or GitHub API
    const mediaPatterns = [
      { type: 'playlist' as const, pattern: /\.(m3u|m3u8|xspf|pls)$/i },
      { type: 'video' as const, pattern: /\.(mp4|mkv|webm|ts|m2ts)$/i },
      { type: 'audio' as const, pattern: /\.(mp3|aac|flac|ogg|wav)$/i },
      { type: 'archive' as const, pattern: /\.(zip|rar|7z|tar\.gz)$/i },
    ]

    // Simulate finding various media files in repository
    const simulatedFiles = [
      { name: 'streams.m3u8', type: 'playlist' },
      { name: 'backup.tar.gz', type: 'archive' },
      { name: 'config.json', type: 'document' },
    ]

    for (const file of simulatedFiles) {
      const mediaItem: ExtractedMedia = {
        id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: (file.type as any) || 'other',
        name: file.name,
        url: `${repoInfo.url}/blob/main/${file.name}`,
        extracted_from: repoInfo.url,
        extraction_metadata: {
          method: 'git_scan',
          confidence: 0.95,
          timestamp: new Date(),
          source_file: file.name,
        },
      }
      mediaItems.push(mediaItem)
    }

    return mediaItems
  }

  /**
   * Crawl a web URL for media content
   */
  private async crawlWebURL(url: string): Promise<ExtractedMedia[]> {
    const mediaItems: ExtractedMedia[] = []

    // Simulated web crawling
    // In production, this would use Puppeteer or similar
    const simulatedContent = [
      { type: 'playlist', path: 'playlist.m3u' },
      { type: 'video', path: 'videos/sample.mp4' },
      { type: 'archive', path: 'downloads/backup.zip' },
    ]

    for (const item of simulatedContent) {
      const mediaItem: ExtractedMedia = {
        id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: (item.type as any) || 'other',
        url: `${url.replace(/\/$/, '')}/${item.path}`,
        extracted_from: url,
        extraction_metadata: {
          method: 'web_crawler',
          confidence: 0.85,
          timestamp: new Date(),
        },
      }
      mediaItems.push(mediaItem)
    }

    return mediaItems
  }

  /**
   * Search GitHub using Octokit API
   */
  private async searchGitHubByAddonId(addonId: string, addonName?: string): Promise<any> {
    try {
      // Build search query
      const query = addonName ? `${addonId} ${addonName}` : addonId

      // Search GitHub repositories
      const response = await this.octokit.search.repos({
        q: `${query} addon`,
        sort: 'stars',
        order: 'desc',
        per_page: 10,
      })

      return response.data
    } catch (error) {
      // Return empty results if API call fails
      console.error('Octokit search error:', error)
      return { items: [], total_count: 0 }
    }
  }

  /**
   * Extract media items from Octokit search results
   */
  private async extractMediaFromOctokitResults(searchResults: any): Promise<ExtractedMedia[]> {
    const mediaItems: ExtractedMedia[] = []

    const repositories = searchResults.items || []

    for (const repo of repositories.slice(0, 3)) {
      // For each repository, create a media entry
      const mediaItem: ExtractedMedia = {
        id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: 'document',
        name: repo.name,
        url: repo.html_url,
        extracted_from: `GitHub search: ${repo.full_name}`,
        extraction_metadata: {
          method: 'octokit_search',
          confidence: 0.9,
          timestamp: new Date(),
        },
      }
      mediaItems.push(mediaItem)
    }

    return mediaItems
  }

  /**
   * Parse repository URL to extract info
   */
  private parseRepositoryUrl(url: string): any {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.toLowerCase()

      // GitHub
      if (hostname.includes('github')) {
        const match = url.match(/github[^/]*\.com\/([^/]+)\/([^/]+)/)
        if (match) {
          return {
            type: 'github',
            name: match[2],
            owner: match[1],
            url: `https://github.com/${match[1]}/${match[2]}`,
            confidence: 'high' as const,
          }
        }
      }

      // GitLab
      if (hostname.includes('gitlab')) {
        const match = url.match(/gitlab\.com\/([^/]+)\/([^/]+)/)
        if (match) {
          return {
            type: 'gitlab',
            name: match[2],
            owner: match[1],
            url: `https://gitlab.com/${match[1]}/${match[2]}`,
            confidence: 'high' as const,
          }
        }
      }

      // Bitbucket
      if (hostname.includes('bitbucket')) {
        const match = url.match(/bitbucket\.org\/([^/]+)\/([^/]+)/)
        if (match) {
          return {
            type: 'bitbucket',
            name: match[2],
            owner: match[1],
            url: `https://bitbucket.org/${match[1]}/${match[2]}`,
            confidence: 'high' as const,
          }
        }
      }

      // Default
      return {
        type: 'web',
        url: urlObj.origin,
        confidence: 'low' as const,
      }
    } catch {
      return null
    }
  }

  /**
   * Create a Content Intelligence record for persistence
   */
  private createContentIntelligenceRecord(
    payload: Agent1Payload,
    ingestId: string,
    method: 'git_scan' | 'web_crawler' | 'octokit_search',
    mediaItems: ExtractedMedia[],
    repoInfo: any,
    processingTimeMs: number
  ): ContentIntelligenceRecord {
    return {
      id: ingestId,
      job_id: payload.job_id,
      ingestion_timestamp: new Date(),
      ingestion_method: method,
      source_url: payload.source_url,
      repository_info: {
        type: repoInfo.type,
        url: repoInfo.url,
        name: repoInfo.name,
        owner: repoInfo.owner,
        branch: repoInfo.branch,
        confidence: repoInfo.confidence,
      },
      extracted_media: mediaItems,
      kodi_metadata: {
        session_id: payload.kodi_session_id,
        source: payload.kodi_source,
        addon_id: payload.metadata?.addon?.id,
      },
      content_tags: {
        media_type: payload.metadata?.media_type,
        category: payload.metadata?.category,
        verified: false,
        ai_confidence: 0.85,
      },
      processing_stats: {
        total_files_scanned: mediaItems.length,
        total_media_extracted: mediaItems.length,
        processing_time_ms: processingTimeMs,
        extraction_methods: [method],
      },
    }
  }

  /**
   * Retrieve Content Intelligence record by ID
   */
  getContentIntelligenceRecord(ingestId: string): ContentIntelligenceRecord | undefined {
    return this.contentIntelligenceDB.get(ingestId)
  }

  /**
   * Retrieve extracted media by ingest ID
   */
  getExtractedMedia(ingestId: string): ExtractedMedia[] | undefined {
    return this.extractedMediaDB.get(ingestId)
  }

  /**
   * Get database statistics
   */
  getDatabaseStats(): {
    total_records: number
    total_media_items: number
    ingestion_methods: { [key: string]: number }
  } {
    const stats = {
      total_records: this.contentIntelligenceDB.size,
      total_media_items: Array.from(this.extractedMediaDB.values()).reduce(
        (sum, items) => sum + items.length,
        0
      ),
      ingestion_methods: {
        git_scan: 0,
        web_crawler: 0,
        octokit_search: 0,
      },
    }

    for (const record of this.contentIntelligenceDB.values()) {
      stats.ingestion_methods[record.ingestion_method] =
        (stats.ingestion_methods[record.ingestion_method] || 0) + 1
    }

    return stats
  }

  /**
   * Get all ingest records for a specific job
   */
  getIngestRecordsByJobId(jobId: string): ContentIntelligenceRecord[] {
    const records: ContentIntelligenceRecord[] = []
    for (const record of this.contentIntelligenceDB.values()) {
      if (record.job_id === jobId) {
        records.push(record)
      }
    }
    return records
  }

  /**
   * Get all extracted media URLs for a specific job
   */
  getMediaUrlsByJobId(jobId: string): ExtractedMedia[] {
    const allMedia: ExtractedMedia[] = []
    const records = this.getIngestRecordsByJobId(jobId)
    
    for (const record of records) {
      const media = this.extractedMediaDB.get(record.id)
      if (media && media.length > 0) {
        allMedia.push(...media)
      }
    }
    
    return allMedia
  }
}

/**
 * Export singleton instance
 */
export const intelligentIngestion = new IntelligentIngestionController()
