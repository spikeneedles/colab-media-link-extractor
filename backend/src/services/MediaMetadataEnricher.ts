/**
 * Media Metadata Enricher Service
 * 
 * Enriches extracted media with:
 * - Deduplication
 * - Metadata enhancement (titles, descriptions, logos)
 * - Content classification (Movie, Live TV, Series)
 * - Genre detection
 */

export type ContentType = 'movie' | 'series' | 'live-tv' | 'extra-content'

export interface EnrichedMedia {
  url: string
  title: string
  contentType: ContentType
  category?: string
  genre?: string[]
  description?: string
  logo?: string
  season?: number
  episode?: number
  releaseYear?: number
  duration?: number
  confidence: 'high' | 'medium' | 'low'
  source?: string
}

export interface EnrichmentResult {
  totalInput: number
  totalDeduped: number
  byContentType: {
    movies: number
    series: number
    liveTV: number
    extraContent: number
  }
  media: EnrichedMedia[]
}

// Common movie title patterns
const MOVIE_KEYWORDS = [
  'movie', 'film', 'cinema', 'watch', 'dubbed', 'subbed',
  '720p', '1080p', '480p', '4k', 'hd', 'uhd',
  'bluray', 'dvdrip', 'webrip', 'hdtv'
]

// Common series/show patterns
const SERIES_KEYWORDS = [
  'series', 'season', 's\d{1,2}', 'episode', 'e\d{1,2}', 'show',
  'tv-series', 'tvshow', 'serial', 'saga'
]

// Common live TV patterns
const LIVETV_KEYWORDS = [
  'live', 'channel', 'hls', 'm3u8', 'stream', 'broadcast',
  'news', 'sports', 'music', 'radio', 'iptv', 'tv-channel',
  'playlist', 'rtmp', 'rtsp'
]

export class MediaMetadataEnricher {
  /**
   * Enrich and deduplicate media URLs
   */
  enrich(media: Array<{
    url: string
    title?: string
    category?: string
    description?: string
    logo?: string
    epgId?: string
    duration?: number
  }>): EnrichmentResult {
    // Step 1: Deduplicate by URL
    const deduped = this.deduplicateByUrl(media)

    // Step 2: Enrich each media item
    const enriched = deduped.map((item, index) => {
      const title = item.title || this.generateTitle(item.url, index)
      const contentType = this.classifyContent(item.url, title, item.category)
      const genres = this.extractGenres(title, item.category, contentType)

      return {
        url: item.url,
        title,
        contentType,
        category: item.category,
        genre: genres,
        description: item.description,
        logo: item.logo,
        duration: item.duration,
        confidence: this.calculateConfidence(item, title, contentType),
        source: this.detectSource(item.url),
      } as EnrichedMedia
    })

    // Step 3: Calculate summary
    const result: EnrichmentResult = {
      totalInput: media.length,
      totalDeduped: deduped.length,
      byContentType: {
        movies: enriched.filter(m => m.contentType === 'movie').length,
        series: enriched.filter(m => m.contentType === 'series').length,
        liveTV: enriched.filter(m => m.contentType === 'live-tv').length,
        extraContent: enriched.filter(m => m.contentType === 'extra-content').length,
      },
      media: enriched,
    }

    return result
  }

  /**
   * Deduplicate media by URL
   */
  private deduplicateByUrl(media: any[]): any[] {
    const seen = new Map<string, any>()

    for (const item of media) {
      // For Prowlarr downloads, use exact URL (don't normalize - query params matter!)
      // For other URLs, normalize for comparison
      const comparisonUrl = item.url.includes('localhost:9696') 
        ? item.url  // Use exact URL for Prowlarr
        : this.normalizeUrl(item.url)  // Normalize for other URLs
      
      if (!seen.has(comparisonUrl)) {
        seen.set(comparisonUrl, item)
      }
    }

    return Array.from(seen.values())
  }

  /**
   * Normalize URL for comparison (remove query params, trailing slashes, etc.)
   */
  private normalizeUrl(url: string): string {
    try {
      const u = new URL(url)
      // Remove tracking params
      u.search = ''
      return u.toString().toLowerCase()
    } catch {
      return url.toLowerCase()
    }
  }

  /**
   * Generate title from filename or URL
   */
  private generateTitle(url: string, index: number): string {
    try {
      // Extract filename from URL
      const pathname = new URL(url).pathname
      const filename = pathname.split('/').pop() || `Media ${index + 1}`

      // Remove extension
      const titleWithoutExt = filename.replace(/\.[^.]+$/, '')

      // Decode and clean
      const decoded = decodeURIComponent(titleWithoutExt)
      const title = decoded
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      return title || `Media ${index + 1}`
    } catch {
      return `Media ${index + 1}`
    }
  }

  /**
   * Classify content into Movie, Series, Live TV, or Extra Content
   */
  private classifyContent(
    url: string,
    title: string,
    category?: string
  ): ContentType {
    const urlLower = url.toLowerCase()
    const titleLower = title.toLowerCase()
    const categoryLower = category?.toLowerCase() || ''

    // Check for non-media file extensions (send to extra-content)
    const nonMediaExtensions = /\.(apk|zip|rar|7z|tar|gz|exe|msi|dmg|iso|img|bin|doc|docx|pdf|txt|csv|json|xml|xls|xlsx|ppt|pptx)$/i
    if (nonMediaExtensions.test(urlLower) || nonMediaExtensions.test(titleLower)) {
      return 'extra-content'
    }

    // Check live TV indicators
    if (this.hasKeywords(urlLower, LIVETV_KEYWORDS) ||
        this.hasKeywords(categoryLower, ['live', 'channel', 'iptv', 'broadcast']) ||
        this.hasKeywords(titleLower, ['live', 'channel', 'news', 'sports'])) {
      return 'live-tv'
    }

    // Check series indicators
    if (this.hasKeywords(titleLower, SERIES_KEYWORDS) ||
        this.hasKeywords(categoryLower, ['series', 'show', 'tv', 'serial']) ||
        /s\d{1,2}e\d{1,2}|season|episode/i.test(titleLower)) {
      return 'series'
    }

    // Check movie indicators
    if (this.hasKeywords(titleLower, MOVIE_KEYWORDS) ||
        this.hasKeywords(categoryLower, ['movie', 'film', 'cinema']) ||
        categoryLower.includes('movie')) {
      return 'movie'
    }

    // Default: if URL is a direct stream, likely live-tv
    if (urlLower.includes('m3u8') || urlLower.includes('playlist')) {
      return 'live-tv'
    }

    // Default: if it looks like a progressive download, it's a movie
    if (/\.(mp4|mkv|avi|webm|mov)$/i.test(urlLower)) {
      return 'movie'
    }

    // Default fallback
    return 'live-tv'
  }

  /**
   * Extract genres from title and category
   */
  private extractGenres(title: string, category?: string, contentType?: ContentType): string[] {
    const genres: Set<string> = new Set()

    const titleLower = title.toLowerCase()
    const categoryLower = category?.toLowerCase() || ''

    // Genre mappings
    const genreKeywords: Record<string, string[]> = {
      'action': ['action', 'fight', 'combat'],
      'comedy': ['comedy', 'funny', 'humor'],
      'drama': ['drama', 'tearjerker'],
      'horror': ['horror', 'scary', 'supernatural'],
      'thriller': ['thriller', 'suspense'],
      'romance': ['romance', 'love'],
      'sci-fi': ['sci-fi', 'science fiction', 'space', 'future'],
      'fantasy': ['fantasy', 'magic', 'wizard'],
      'adventure': ['adventure', 'quest'],
      'animation': ['anime', 'animation', 'animated'],
      'documentary': ['documentary', 'doc'],
      'news': ['news', 'news channel'],
      'sports': ['sports', 'football', 'basketball', 'soccer', 'sports channel'],
      'music': ['music', 'concert', 'mtv'],
      'lifestyle': ['lifestyle', 'cooking', 'fashion'],
      'educational': ['education', 'learning'],
    }

    for (const [genre, keywords] of Object.entries(genreKeywords)) {
      const isInTitle = keywords.some(kw => titleLower.includes(kw))
      const isInCategory = keywords.some(kw => categoryLower.includes(kw))

      if (isInTitle || isInCategory) {
        genres.add(genre)
      }
    }

    return Array.from(genres)
  }

  /**
   * Calculate confidence score for classification
   */
  private calculateConfidence(
    item: any,
    title: string,
    contentType: ContentType
  ): 'high' | 'medium' | 'low' {
    let confidence = 0

    // Has explicit title
    if (item.title) confidence += 2

    // Has category
    if (item.category) confidence += 1

    // Title is descriptive (not just a URL filename)
    if (title && title.length > 10 && !title.match(/^[a-f0-9]{8,}$/i)) {
      confidence += 1
    }

    // URL matches content type
    const urlLower = item.url.toLowerCase()
    if (contentType === 'movie' && urlLower.match(/\.(mp4|mkv|avi)/)) {
      confidence += 1
    } else if (contentType === 'live-tv' && urlLower.includes('m3u8')) {
      confidence += 1
    }

    if (confidence >= 3) return 'high'
    if (confidence >= 1) return 'medium'
    return 'low'
  }

  /**
   * Detect source from URL
   */
  private detectSource(url: string): string {
    try {
      const hostname = new URL(url).hostname

      if (hostname.includes('github')) return 'GitHub'
      if (hostname.includes('gitlab')) return 'GitLab'
      if (hostname.includes('bitbucket')) return 'Bitbucket'
      if (hostname.includes('youtube')) return 'YouTube'
      if (hostname.includes('vimeo')) return 'Vimeo'
      if (hostname.includes('twitch')) return 'Twitch'
      if (hostname.includes('netflix')) return 'Netflix'
      if (hostname.includes('amazon')) return 'Amazon Prime'

      return hostname
    } catch {
      return 'Unknown'
    }
  }

  /**
   * Helper: Check if text contains any keywords
   */
  private hasKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => {
      // Handle regex patterns
      if (keyword.match(/^[a-z\\d$|()[\].*+?{}]/i)) {
        try {
          return new RegExp(keyword, 'i').test(text)
        } catch {
          return text.includes(keyword)
        }
      }
      return text.includes(keyword)
    })
  }

  /**
   * Sort media into four categorized lists
   */
  sortByContentType(media: EnrichedMedia[]): {
    movies: EnrichedMedia[]
    series: EnrichedMedia[]
    liveTV: EnrichedMedia[]
    extraContent: EnrichedMedia[]
  } {
    return {
      movies: media.filter(m => m.contentType === 'movie').sort((a, b) => a.title.localeCompare(b.title)),
      series: media.filter(m => m.contentType === 'series').sort((a, b) => a.title.localeCompare(b.title)),
      liveTV: media.filter(m => m.contentType === 'live-tv').sort((a, b) => a.title.localeCompare(b.title)),
      extraContent: media.filter(m => m.contentType === 'extra-content').sort((a, b) => a.title.localeCompare(b.title)),
    }
  }
}

export const mediaMetadataEnricher = new MediaMetadataEnricher()
