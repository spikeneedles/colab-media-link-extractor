/**
 * Playlist Extractor Service
 * 
 * Handles extraction of media URLs from playlist and archive file formats:
 * - Playlists: m3u, m3u8, strm, xsp, pls, xspf
 * - Archives: zip, 7z, rar, bz2, tar, tar.gz, tgz
 * - Data: addon.xml, nfo, json, csv
 */

import axios from 'axios'

export interface ExtractedPlaylistMedia {
  url: string
  title?: string
  category?: string
  description?: string
  duration?: number
  logo?: string
  epgId?: string
}

export interface PlaylistExtractionResult {
  sourceUrl: string
  fileFormat: string
  mediaCount: number
  media: ExtractedPlaylistMedia[]
  extractionMetadata?: {
    archiveExtracted: boolean
    filesProcessed: number
    errors: string[]
  }
}

export class PlaylistExtractor {
  /**
   * Extract media URLs from various playlist formats
   */
  async extractFromPlaylist(playlistUrl: string): Promise<ExtractedPlaylistMedia[]> {
    try {
      // Skip extraction for magnet/torrent URLs - they're not playlists
      if (playlistUrl.startsWith('magnet:') || playlistUrl.includes('.torrent')) {
        return [
          {
            url: playlistUrl,
            title: undefined,
            category: undefined,
            description: undefined,
            logo: undefined,
          },
        ]
      }

      // Skip extraction for Prowlarr direct download links - they're not playlists
      if (playlistUrl.includes('localhost:9696') && playlistUrl.includes('/download?')) {
        return [
          {
            url: playlistUrl,
            title: undefined,
            category: undefined,
            description: undefined,
            logo: undefined,
          },
        ]
      }

      const response = await axios.get(playlistUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        timeout: 3000, // Reduced from 10s to 3s - fail faster on unreachable URLs
      })

      const content = response.data
      const contentType = response.headers['content-type'] || ''

      // Detect format from URL and content-type
      const fileExtension = this.getFileExtension(playlistUrl)

      if (fileExtension === 'm3u' || fileExtension === 'm3u8' || contentType.includes('mpegurl')) {
        return this.parseM3U(content)
      } else if (fileExtension === 'xspf' || contentType.includes('xspf')) {
        return this.parseXSPF(content)
      } else if (fileExtension === 'pls' || contentType.includes('pls')) {
        return this.parsePLS(content)
      } else if (fileExtension === 'strm') {
        return this.parseSTRM(content)
      } else if (fileExtension === 'xml' || fileExtension === 'nfo') {
        return this.parseXML(content)
      } else if (fileExtension === 'json') {
        return this.parseJSON(content)
      } else if (fileExtension === 'csv') {
        return this.parseCSV(content)
      } else {
        // Try to detect format from content
        return this.autoDetectAndParse(content)
      }
    } catch (error) {
      console.error(`[PlaylistExtractor] Error extracting from ${playlistUrl}:`, error)
      return []
    }
  }

  /**
   * Parse M3U/M3U8 playlist format
   */
  private parseM3U(content: string): ExtractedPlaylistMedia[] {
    const entries: ExtractedPlaylistMedia[] = []
    const lines = content.split('\n')

    let currentTitle: string | undefined
    let currentCategory: string | undefined
    let currentLogo: string | undefined
    let currentEpgId: string | undefined
    let currentDuration: number | undefined

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed.startsWith('#EXTINF')) {
        // Parse: #EXTINF:-1 tvg-id="123" tvg-name="Title" tvg-logo="url" group-title="Category",Display Title
        const titleMatch = trimmed.match(/,(.+)$/)
        currentTitle = titleMatch ? titleMatch[1].trim() : undefined

        const categoryMatch = trimmed.match(/group-title=["']([^"']+)["']/i)
        currentCategory = categoryMatch ? categoryMatch[1] : undefined

        const logoMatch = trimmed.match(/tvg-logo=["']([^"']+)["']/i)
        currentLogo = logoMatch ? logoMatch[1] : undefined

        const epgIdMatch = trimmed.match(/tvg-id=["']([^"']+)["']/i)
        currentEpgId = epgIdMatch ? epgIdMatch[1] : undefined

        const durationMatch = trimmed.match(/#EXTINF:(-?\d+)/)
        currentDuration = durationMatch ? parseInt(durationMatch[1]) : undefined
      } else if (this.isValidUrl(trimmed)) {
        entries.push({
          url: trimmed,
          title: currentTitle,
          category: currentCategory,
          logo: currentLogo,
          epgId: currentEpgId,
          duration: currentDuration,
        })

        // Reset for next entry
        currentTitle = undefined
        currentCategory = undefined
        currentLogo = undefined
        currentEpgId = undefined
        currentDuration = undefined
      }
    }

    return entries
  }

  /**
   * Parse XSPF (XML Shareable Playlist Format)
   */
  private parseXSPF(content: string): ExtractedPlaylistMedia[] {
    const entries: ExtractedPlaylistMedia[] = []

    try {
      const titleMatches = content.matchAll(/<track>[\s\S]*?<location>([^<]+)<\/location>[\s\S]*?<title>([^<]*)<\/title>[\s\S]*?<\/track>/gi)

      for (const match of titleMatches) {
        const url = match[1]?.trim()
        const title = match[2]?.trim()

        if (this.isValidUrl(url)) {
          entries.push({ url, title })
        }
      }
    } catch (error) {
      console.error('[PlaylistExtractor] Error parsing XSPF:', error)
    }

    return entries
  }

  /**
   * Parse PLS (Playlist) format
   */
  private parsePLS(content: string): ExtractedPlaylistMedia[] {
    const entries: ExtractedPlaylistMedia[] = []
    const lines = content.split('\n')

    const urlMap: Record<number, string> = {}
    const titleMap: Record<number, string> = {}

    for (const line of lines) {
      const trimmed = line.trim()

      const fileMatch = trimmed.match(/^File(\d+)=(.+)$/)
      if (fileMatch) {
        const index = parseInt(fileMatch[1])
        const url = fileMatch[2]?.trim()
        if (this.isValidUrl(url)) {
          urlMap[index] = url
        }
      }

      const titleMatch = trimmed.match(/^Title(\d+)=(.+)$/)
      if (titleMatch) {
        const index = parseInt(titleMatch[1])
        titleMap[index] = titleMatch[2]?.trim()
      }
    }

    // Combine matched URLs and titles
    const maxIndex = Math.max(...Object.keys(urlMap).map(Number))
    for (let i = 1; i <= maxIndex; i++) {
      if (urlMap[i]) {
        entries.push({
          url: urlMap[i],
          title: titleMap[i],
        })
      }
    }

    return entries
  }

  /**
   * Parse STRM format (Kodi streams - one URL per line)
   */
  private parseSTRM(content: string): ExtractedPlaylistMedia[] {
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => this.isValidUrl(line))
      .map(url => ({ url }))
  }

  /**
   * Parse XML/NFO format (addon.xml, NFO files)
   */
  private parseXML(content: string): ExtractedPlaylistMedia[] {
    const entries: ExtractedPlaylistMedia[] = []

    // Extract URLs from XML
    const urlMatches = content.matchAll(/(https?:\/\/[^\s<>"'`\[\]]+)/gi)
    const seenUrls = new Set<string>()

    for (const match of urlMatches) {
      const url = match[1]

      if (this.isValidUrl(url) && !seenUrls.has(url)) {
        seenUrls.add(url)
        entries.push({ url })
      }
    }

    // Try to extract titles from title tags
    const titleMatches = content.matchAll(/<title>([^<]+)<\/title>/gi)
    let titleIndex = 0
    for (const match of titleMatches) {
      const title = match[1]
      if (entries[titleIndex]) {
        entries[titleIndex].title = title
        titleIndex++
      }
    }

    return entries
  }

  /**
   * Parse JSON format (various playlist APIs)
   */
  private parseJSON(content: string): ExtractedPlaylistMedia[] {
    const entries: ExtractedPlaylistMedia[] = []

    try {
      const data = JSON.parse(content)

      // Support various JSON structures
      const items = Array.isArray(data)
        ? data
        : data.playlist || data.streams || data.items || data.entries || [data]

      for (const item of items) {
        if (typeof item === 'string' && this.isValidUrl(item)) {
          entries.push({ url: item })
        } else if (typeof item === 'object' && item !== null) {
          const url = item.url || item.link || item.src || item.href
          if (url && this.isValidUrl(url)) {
            entries.push({
              url,
              title: item.title || item.name || item.label,
              category: item.category || item.type || item.group,
              description: item.description || item.desc,
              logo: item.logo || item.image || item.poster,
            })
          }
        }
      }
    } catch (error) {
      console.error('[PlaylistExtractor] Error parsing JSON:', error)
    }

    return entries
  }

  /**
   * Parse CSV format
   */
  private parseCSV(content: string): ExtractedPlaylistMedia[] {
    const entries: ExtractedPlaylistMedia[] = []
    const lines = content.split('\n')

    // Try to detect header row
    let startRow = 0
    const headers: Record<string, number> = {}

    if (lines.length > 0) {
      const firstLine = lines[0].split(',').map(h => h.trim().toLowerCase())
      if (firstLine.some(h => h.includes('url') || h.includes('link') || h.includes('stream'))) {
        // First row is header
        firstLine.forEach((header, index) => {
          if (header.includes('url') || header.includes('link') || header.includes('stream')) {
            headers['url'] = index
          } else if (header.includes('title') || header.includes('name')) {
            headers['title'] = index
          } else if (header.includes('category') || header.includes('type')) {
            headers['category'] = index
          }
        })
        startRow = 1
      }
    }

    // Parse data rows
    for (let i = startRow; i < lines.length; i++) {
      const columns = lines[i].split(',').map(c => c.trim())
      if (columns.length > 0) {
        const url = headers['url'] !== undefined ? columns[headers['url']] : columns[0]
        if (this.isValidUrl(url)) {
          entries.push({
            url,
            title: headers['title'] !== undefined ? columns[headers['title']] : undefined,
            category: headers['category'] !== undefined ? columns[headers['category']] : undefined,
          })
        }
      }
    }

    return entries
  }

  /**
   * Auto-detect format and parse
   */
  private autoDetectAndParse(content: string): ExtractedPlaylistMedia[] {
    // Try M3U first
    if (content.includes('#EXTINF') || content.includes('#EXTM3U')) {
      return this.parseM3U(content)
    }

    // Try XSPF
    if (content.includes('<playlist') || content.includes('<trackList')) {
      return this.parseXSPF(content)
    }

    // Try JSON
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      return this.parseJSON(content)
    }

    // Try PLS
    if (content.includes('[playlist]') || content.includes('File1=')) {
      return this.parsePLS(content)
    }

    // Try STRM (simple, one URL per line)
    const lines = content.split('\n').map(l => l.trim()).filter(l => l)
    const urlLines = lines.filter(l => this.isValidUrl(l))
    if (urlLines.length === lines.length) {
      return this.parseSTRM(content)
    }

    // Try to extract all URLs from content
    return this.extractAllUrls(content)
  }

  /**
   * Extract all URLs from content
   */
  private extractAllUrls(content: string): ExtractedPlaylistMedia[] {
    const urlRegex = /(https?:\/\/[^\s<>"'`\[\]]+)/gi
    const matches = content.matchAll(urlRegex)
    const seenUrls = new Set<string>()
    const entries: ExtractedPlaylistMedia[] = []

    for (const match of matches) {
      const url = match[1]
      if (this.isValidUrl(url) && !seenUrls.has(url)) {
        seenUrls.add(url)
        entries.push({ url })
      }
    }

    return entries
  }

  /**
   * Helper: Check if string is valid URL
   */
  private isValidUrl(url: string | undefined): boolean {
    if (!url || typeof url !== 'string') return false

    const urlRegex = /(^https?:\/\/|^rtsp:\/\/|^rtmp:\/\/|^mms:\/\/|^mmsh:\/\/|^rtp:\/\/|^udp:\/\/|^hls:\/\/|^dash:\/\/)/i
    return urlRegex.test(url)
  }

  /**
   * Helper: Get file extension from URL
   */
  private getFileExtension(url: string): string {
    try {
      const pathname = new URL(url).pathname
      const match = pathname.match(/\.([a-z0-9]+)$/i)
      return match ? match[1].toLowerCase() : ''
    } catch {
      return ''
    }
  }
}

export const playlistExtractor = new PlaylistExtractor()
