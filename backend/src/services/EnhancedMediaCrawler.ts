/**
 * Enhanced Domain Crawler with API Provider Integration
 * 
 * Extends the basic crawler to leverage discovered API providers for:
 * - Metadata enrichment from TMDb/TVDb/Trakt
 * - Torrent resolution through debrid services
 * - Multi-source content discovery
 */

import { DomainCrawler, CrawlResult } from '../domainCrawler.js'
import { apiProviderService, MediaSearchResult, TorrentSearchResult, DebridStreamResult } from './ApiProviderService.js'
import { mediaMetadataEnricher, EnrichedMedia } from './MediaMetadataEnricher.js'

export interface EnhancedCrawlResult extends CrawlResult {
  metadataEnrichment?: {
    tmdbMatch?: MediaSearchResult
    torrentResults?: TorrentSearchResult[]
    debridStreams?: DebridStreamResult[]
    confidence: 'high' | 'medium' | 'low'
  }
}

export interface DiscoveryStrategy {
  name: string
  enabled: boolean
  providers: string[]
  priority: number
}

/**
 * Enhanced crawler that combines traditional web scraping with API integrations
 */
export class EnhancedMediaCrawler {
  private domainCrawler: DomainCrawler
  private strategies: DiscoveryStrategy[] = []

  constructor() {
    this.domainCrawler = new DomainCrawler(50, 2)
    this.initializeStrategies()
  }

  /**
   * Initialize discovery strategies
   */
  private initializeStrategies(): void {
    this.strategies = [
      {
        name: 'Metadata Enrichment',
        enabled: true,
        providers: ['api.themoviedb.org', 'api.thetvdb.com', 'api.trakt.tv'],
        priority: 1,
      },
      {
        name: 'Torrent Discovery',
        enabled: true,
        providers: ['btdb.eu', 'btdb.io', 'torrentsdb.com'],
        priority: 2,
      },
      {
        name: 'Debrid Resolution',
        enabled: true,
        providers: ['api.real-debrid.com', 'api.alldebrid.com'],
        priority: 3,
      },
    ]
  }

  /**
   * Start enhanced crawl with API integration
   */
  async startEnhancedCrawl(
    sessionId: string,
    initialUrl: string,
    title?: string,
    options?: {
      enrichMetadata?: boolean
      discoverTorrents?: boolean
      resolveDebrid?: boolean
      debridService?: 'real-debrid' | 'alldebrid' | 'premiumize'
    }
  ): Promise<{
    sessionId: string
    status: 'pending' | 'crawling' | 'completed' | 'error'
    progress: number
    results: EnhancedCrawlResult[]
    enrichedMedia: EnrichedMedia[]
    apiCallsMade: number
  }> {
    // Start traditional domain crawl
    const crawlSession = await this.domainCrawler.startCrawl(sessionId, initialUrl, title || 'Enhanced Crawl')

    // Wait for crawl to complete
    while (crawlSession.status === 'pending' || crawlSession.status === 'crawling') {
      await this.delay(2000)
    }

    if (crawlSession.status === 'error') {
      throw new Error(crawlSession.error || 'Crawl failed')
    }

    // Get base results
    const baseResults = this.domainCrawler.getResults(sessionId)
    const enhancedResults: EnhancedCrawlResult[] = []
    let apiCallsMade = 0

    // Process each result with API enrichment
    for (const result of baseResults) {
      const enhanced: EnhancedCrawlResult = {
        ...result,
        metadataEnrichment: undefined,
      }

      // Extract title from URL/content
      const extractedTitle = this.extractTitleFromResult(result)

      // Strategy 1: Metadata Enrichment
      if (options?.enrichMetadata !== false && extractedTitle) {
        try {
          const metadataResults = await apiProviderService.searchMedia(extractedTitle)
          if (metadataResults.length > 0) {
            enhanced.metadataEnrichment = {
              tmdbMatch: metadataResults[0],
              confidence: this.calculateMetadataConfidence(extractedTitle, metadataResults[0]),
            }
            apiCallsMade++
          }
        } catch (error) {
          console.warn(`[EnhancedCrawler] Metadata enrichment failed for "${extractedTitle}":`, error)
        }
      }

      // Strategy 2: Torrent Discovery
      if (options?.discoverTorrents && extractedTitle) {
        try {
          const torrentResults = await apiProviderService.searchTorrents(extractedTitle)
          if (torrentResults.length > 0) {
            if (!enhanced.metadataEnrichment) {
              enhanced.metadataEnrichment = { confidence: 'medium' }
            }
            enhanced.metadataEnrichment.torrentResults = torrentResults.slice(0, 5) // Top 5
            apiCallsMade++
          }
        } catch (error) {
          console.warn(`[EnhancedCrawler] Torrent discovery failed for "${extractedTitle}":`, error)
        }
      }

      // Strategy 3: Debrid Resolution
      if (options?.resolveDebrid && enhanced.metadataEnrichment?.torrentResults) {
        const debridStreams: DebridStreamResult[] = []

        for (const torrent of enhanced.metadataEnrichment.torrentResults.slice(0, 3)) {
          try {
            const stream = await apiProviderService.resolveDebridStream(
              torrent.magnetUrl,
              options.debridService
            )
            if (stream) {
              debridStreams.push(stream)
              apiCallsMade++
            }
          } catch (error) {
            console.warn(`[EnhancedCrawler] Debrid resolution failed:`, error)
          }
        }

        if (debridStreams.length > 0) {
          enhanced.metadataEnrichment.debridStreams = debridStreams
        }
      }

      enhancedResults.push(enhanced)
    }

    // Enrich all discovered media
    const allMediaUrls = baseResults.flatMap(r => r.mediaLinks)
    const mediaForEnrichment = allMediaUrls.map(url => ({ url }))
    const enrichmentResult = mediaMetadataEnricher.enrich(mediaForEnrichment)

    return {
      sessionId,
      status: 'completed',
      progress: 100,
      results: enhancedResults,
      enrichedMedia: enrichmentResult.media,
      apiCallsMade,
    }
  }

  /**
   * Discover content by title across all API providers
   */
  async discoverByTitle(
    title: string,
    options?: {
      includeMetadata?: boolean
      includeTorrents?: boolean
      resolveStreams?: boolean
      debridService?: 'real-debrid' | 'alldebrid' | 'premiumize'
    }
  ): Promise<{
    title: string
    metadata?: MediaSearchResult[]
    torrents?: TorrentSearchResult[]
    streams?: DebridStreamResult[]
    recommendations: {
      bestMatch?: MediaSearchResult
      topTorrents: TorrentSearchResult[]
      availableStreams: number
    }
  }> {
    const result: any = {
      title,
      recommendations: {
        topTorrents: [],
        availableStreams: 0,
      },
    }

    // Get metadata
    if (options?.includeMetadata !== false) {
      result.metadata = await apiProviderService.searchMedia(title)
      if (result.metadata.length > 0) {
        result.recommendations.bestMatch = result.metadata[0]
      }
    }

    // Get torrents
    if (options?.includeTorrents) {
      result.torrents = await apiProviderService.searchTorrents(title)
      
      // Sort by seeders and take top 10
      result.recommendations.topTorrents = result.torrents
        .sort((a: TorrentSearchResult, b: TorrentSearchResult) => b.seeders - a.seeders)
        .slice(0, 10)
    }

    // Resolve streams
    if (options?.resolveStreams && result.torrents) {
      result.streams = []

      for (const torrent of result.recommendations.topTorrents.slice(0, 5)) {
        try {
          const stream = await apiProviderService.resolveDebridStream(
            torrent.magnetUrl,
            options.debridService
          )
          if (stream) {
            result.streams.push(stream)
          }
        } catch (error) {
          console.warn(`[EnhancedCrawler] Stream resolution failed:`, error)
        }
      }

      result.recommendations.availableStreams = result.streams.length
    }

    return result
  }

  /**
   * Batch discover content from M3U8 playlist entries
   */
  async batchDiscoverFromPlaylist(
    playlistEntries: Array<{ title: string; url: string }>,
    options?: {
      maxConcurrent?: number
      enrichMetadata?: boolean
      findTorrents?: boolean
    }
  ): Promise<Array<{
    title: string
    url: string
    metadata?: MediaSearchResult
    torrents?: TorrentSearchResult[]
    enriched: boolean
  }>> {
    const maxConcurrent = options?.maxConcurrent || 5
    const results: any[] = []

    // Process in batches
    for (let i = 0; i < playlistEntries.length; i += maxConcurrent) {
      const batch = playlistEntries.slice(i, i + maxConcurrent)

      const batchResults = await Promise.all(
        batch.map(async (entry) => {
          const enriched: any = {
            title: entry.title,
            url: entry.url,
            enriched: false,
          }

          try {
            // Search metadata
            if (options?.enrichMetadata !== false) {
              const metadata = await apiProviderService.searchMedia(entry.title)
              if (metadata.length > 0) {
                enriched.metadata = metadata[0]
                enriched.enriched = true
              }
            }

            // Search torrents
            if (options?.findTorrents) {
              const torrents = await apiProviderService.searchTorrents(entry.title)
              if (torrents.length > 0) {
                enriched.torrents = torrents.slice(0, 3)
                enriched.enriched = true
              }
            }
          } catch (error) {
            console.warn(`[EnhancedCrawler] Batch enrichment failed for "${entry.title}":`, error)
          }

          return enriched
        })
      )

      results.push(...batchResults)

      // Progress log
      console.log(`[EnhancedCrawler] Processed ${Math.min(i + maxConcurrent, playlistEntries.length)}/${playlistEntries.length} entries`)

      // Rate limiting delay
      if (i + maxConcurrent < playlistEntries.length) {
        await this.delay(1000)
      }
    }

    return results
  }

  /**
   * Extract title from crawl result
   */
  private extractTitleFromResult(result: CrawlResult): string | null {
    // Try extracting from URL first
    try {
      const url = new URL(result.url)
      const pathname = url.pathname
      const parts = pathname.split('/').filter(p => p.length > 0)
      
      // Look for movie/series identifiers
      const titlePart = parts.find(part => 
        part.length > 3 && 
        !part.match(/^\d+$/) && 
        !part.match(/\.(html|php|asp|jsp)$/i)
      )

      if (titlePart) {
        return decodeURIComponent(titlePart)
          .replace(/[-_]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }
    } catch {
      // Fall back to result title
    }

    return result.title || null
  }

  /**
   * Calculate confidence of metadata match
   */
  private calculateMetadataConfidence(
    query: string,
    match: MediaSearchResult
  ): 'high' | 'medium' | 'low' {
    const queryLower = query.toLowerCase()
    const titleLower = match.title.toLowerCase()

    // Exact match
    if (queryLower === titleLower) return 'high'

    // Close match (substring)
    if (queryLower.includes(titleLower) || titleLower.includes(queryLower)) {
      return 'medium'
    }

    // Weak match
    return 'low'
  }

  /**
   * Get discovery statistics
   */
  getStats(): {
    strategies: DiscoveryStrategy[]
    apiProviders: any
  } {
    return {
      strategies: this.strategies,
      apiProviders: apiProviderService.getStats(),
    }
  }

  /**
   * Enable/disable discovery strategy
   */
  setStrategyEnabled(strategyName: string, enabled: boolean): void {
    const strategy = this.strategies.find(s => s.name === strategyName)
    if (strategy) {
      strategy.enabled = enabled
    }
  }

  /**
   * Helper: delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const enhancedMediaCrawler = new EnhancedMediaCrawler()
