/**
 * Auto-Discovery System for Stremio Addon
 * 
 * Captures stream requests from Stremio, crawls the source domain,
 * and generates M3U playlists from discovered media content
 */

import { DomainCrawler } from './domainCrawler.js'
import type { StreamioLink } from './stremioAddon.js'

export interface DiscoveryJob {
  id: string
  sourceUrl: string
  triggeredBy: 'stream-request' | 'manual'
  status: 'pending' | 'crawling' | 'completed' | 'failed'
  progress: number
  discoveredLinks: StreamioLink[]
  playlistUrl?: string
  startedAt: Date
  completedAt?: Date
  error?: string
}

export interface Playlist {
  id: string
  name: string
  category: string
  links: StreamioLink[]
  format: 'm3u' | 'm3u8'
  createdAt: Date
  sourceUrl: string
  m3uContent: string
}

/**
 * Auto-Discovery Manager
 * Coordinates crawling, link extraction, and playlist generation
 */
export class AutoDiscoveryManager {
  private jobs: Map<string, DiscoveryJob> = new Map()
  private playlists: Map<string, Playlist> = new Map()
  private crawler: DomainCrawler
  private processedUrls: Set<string> = new Set() // Prevent duplicate crawls

  constructor() {
    this.crawler = new DomainCrawler(50, 2) // Max 50 pages, depth 2
  }

  /**
   * Start auto-discovery from a stream request
   * This is triggered when Stremio requests a stream
   */
  async discoverFromStreamRequest(
    streamUrl: string,
    title?: string,
    category?: string
  ): Promise<DiscoveryJob> {
    // Extract base domain from stream URL
    const baseUrl = this.extractBaseUrl(streamUrl)
    
    // Check if we already processed this domain recently
    if (this.processedUrls.has(baseUrl)) {
      const existingJob = Array.from(this.jobs.values()).find(
        job => job.sourceUrl === baseUrl
      )
      if (existingJob) {
        return existingJob
      }
    }

    const jobId = `discovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const job: DiscoveryJob = {
      id: jobId,
      sourceUrl: baseUrl,
      triggeredBy: 'stream-request',
      status: 'pending',
      progress: 0,
      discoveredLinks: [
        {
          url: streamUrl,
          title: title || undefined,
          category: category || 'discovered',
          type: this.classifyMediaType(streamUrl)
        }
      ],
      startedAt: new Date()
    }

    this.jobs.set(jobId, job)
    this.processedUrls.add(baseUrl)

    // Start crawling asynchronously
    this.performDiscovery(job, title, category).catch(error => {
      job.status = 'failed'
      job.error = this.getErrorMessage(error)
      job.completedAt = new Date()
    })

    return job
  }

  /**
   * Manually trigger discovery for a URL
   */
  async discoverManually(
    url: string,
    title?: string,
    category?: string
  ): Promise<DiscoveryJob> {
    const jobId = `discovery-manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const job: DiscoveryJob = {
      id: jobId,
      sourceUrl: url,
      triggeredBy: 'manual',
      status: 'pending',
      progress: 0,
      discoveredLinks: [],
      startedAt: new Date()
    }

    this.jobs.set(jobId, job)

    // Start crawling
    this.performDiscovery(job, title, category).catch(error => {
      job.status = 'failed'
      job.error = this.getErrorMessage(error)
      job.completedAt = new Date()
    })

    return job
  }

  /**
   * Perform the actual discovery: crawl, extract, generate playlist
   */
  private async performDiscovery(
    job: DiscoveryJob,
    title?: string,
    category?: string
  ): Promise<void> {
    job.status = 'crawling'
    job.progress = 10

    try {
      // Start domain crawl
      const crawlSession = await this.crawler.startCrawl(
        job.id,
        job.sourceUrl,
        title || 'Auto-Discovery Crawl'
      )

      // Poll for crawl completion
      while (crawlSession.status === 'pending' || crawlSession.status === 'crawling') {
        await this.delay(2000) // Check every 2 seconds
        job.progress = Math.min(50, job.progress + 5)
      }

      if (crawlSession.status === 'error') {
        throw new Error(crawlSession.error || 'Crawl failed')
      }

      job.progress = 60

      // Extract media links from crawl results
      const mediaLinks = this.extractMediaLinksFromCrawl(crawlSession, category)
      job.discoveredLinks = this.mergeUniqueLinks(job.discoveredLinks, mediaLinks)
      job.progress = 80

      // Generate M3U playlist
      const playlist = this.generatePlaylist(
        job.sourceUrl,
        job.discoveredLinks,
        title || 'Auto-Discovered Media',
        category || 'discovered'
      )

      this.playlists.set(playlist.id, playlist)
      job.playlistUrl = `/stremio/api/playlists/${playlist.id}/download`
      job.progress = 100
      job.status = 'completed'
      job.completedAt = new Date()

    } catch (error) {
      job.status = 'failed'
      job.error = error instanceof Error ? error.message : 'Unknown error'
      job.completedAt = new Date()
      throw error
    }
  }

  /**
   * Extract media links from crawl session results
   */
  private extractMediaLinksFromCrawl(
    crawlSession: any,
    category?: string
  ): StreamioLink[] {
    const links: StreamioLink[] = []
    const mediaLinks = crawlSession.mediaLinks || new Set()

    // Convert media links to StreamioLink format
    mediaLinks.forEach((url: string) => {
      const link: StreamioLink = {
        url,
        category: category || 'discovered',
        type: this.classifyMediaType(url)
      }

      // Try to extract title from URL
      const urlParts = url.split('/').pop()?.split('?')[0]
      if (urlParts) {
        link.title = this.formatTitle(urlParts)
      }

      links.push(link)
    })

    return links
  }

  /**
   * Merge links and de-duplicate by URL
   */
  private mergeUniqueLinks(existing: StreamioLink[], incoming: StreamioLink[]): StreamioLink[] {
    const seen = new Set(existing.map(link => link.url))
    const merged = [...existing]

    incoming.forEach(link => {
      if (!seen.has(link.url)) {
        seen.add(link.url)
        merged.push(link)
      }
    })

    return merged
  }

  /**
   * Classify media type from URL patterns
   */
  private classifyMediaType(url: string): 'movie' | 'series' | 'tv' | 'channel' {
    const lower = url.toLowerCase()
    
    if (lower.includes('/live/') || lower.includes('/channel/') || lower.includes('.ts') || lower.includes('playlist.m3u8')) {
      return 'tv'
    }
    if (lower.includes('/movie/') || lower.includes('/film/')) {
      return 'movie'
    }
    if (lower.includes('/series/') || lower.includes('/show/') || lower.includes('/episode/')) {
      return 'series'
    }
    if (lower.includes('rtmp://') || lower.includes('rtsp://') || lower.endsWith('.m3u8')) {
      return 'tv'
    }
    
    return 'channel'
  }

  /**
   * Format title from filename
   */
  private formatTitle(filename: string): string {
    return filename
      .replace(/\.[^.]+$/, '') // Remove extension
      .replace(/[-_]/g, ' ')   // Replace dashes/underscores with spaces
      .replace(/\b\w/g, c => c.toUpperCase()) // Capitalize words
      .trim()
  }

  /**
   * Generate M3U playlist from discovered links
   */
  private generatePlaylist(
    sourceUrl: string,
    links: StreamioLink[],
    name: string,
    category: string
  ): Playlist {
    const playlistId = `playlist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Generate M3U content
    const m3uLines = ['#EXTM3U']
    m3uLines.push(`#PLAYLIST:${name}`)
    m3uLines.push(`#EXTVLCOPT:http-user-agent=Mozilla/5.0`)
    m3uLines.push('')

    links.forEach((link, index) => {
      const title = link.title || `Media ${index + 1}`
      const groupTitle = link.category || category
      
      m3uLines.push(`#EXTINF:-1 tvg-id="${index}" group-title="${groupTitle}",${title}`)
      m3uLines.push(link.url)
    })

    const playlist: Playlist = {
      id: playlistId,
      name,
      category,
      links,
      format: 'm3u8',
      createdAt: new Date(),
      sourceUrl,
      m3uContent: m3uLines.join('\n')
    }

    return playlist
  }

  /**
   * Extract base URL from stream URL
   */
  private extractBaseUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}`
    } catch {
      return url
    }
  }

  /**
   * Helper: delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Normalize unknown errors
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    return 'Unknown error'
  }

  /**
   * Get job status
   */
  getJob(jobId: string): DiscoveryJob | undefined {
    return this.jobs.get(jobId)
  }

  /**
   * Get all jobs
   */
  getAllJobs(): DiscoveryJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => 
      b.startedAt.getTime() - a.startedAt.getTime()
    )
  }

  /**
   * Get playlist
   */
  getPlaylist(playlistId: string): Playlist | undefined {
    return this.playlists.get(playlistId)
  }

  /**
   * Get all playlists
   */
  getAllPlaylists(): Playlist[] {
    return Array.from(this.playlists.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    )
  }

  /**
   * Clear old jobs (cleanup)
   */
  clearOldJobs(maxAge: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now()
    let cleared = 0

    this.jobs.forEach((job, id) => {
      if (job.completedAt && now - job.completedAt.getTime() > maxAge) {
        this.jobs.delete(id)
        cleared++
      }
    })

    return cleared
  }

  /**
   * Clear processed URLs cache
   */
  clearProcessedUrls(): void {
    this.processedUrls.clear()
  }
}

export const autoDiscoveryManager = new AutoDiscoveryManager()
