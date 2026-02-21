/**
 * API Content Extractor
 * Detects content API endpoints and extracts playable stream URLs
 */

export interface APIEndpoint {
  url: string
  type: 'roku' | 'stremio' | 'xtream' | 'm3u-playlist' | 'epg' | 'generic'
  source?: string
}

export interface ExtractedStream {
  url: string
  title?: string
  type: string
  quality?: string
  format?: string
  source: string
}

// Detect API endpoints in text
export function detectAPIEndpoints(text: string): APIEndpoint[] {
  const endpoints: APIEndpoint[] = []
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g
  const matches = text.match(urlRegex) || []

  matches.forEach(url => {
    if (isContentAPI(url)) {
      endpoints.push({
        url,
        type: detectAPIType(url),
        source: 'extracted'
      })
    }
  })

  return endpoints
}

// Detect API type from URL
function detectAPIType(url: string): APIEndpoint['type'] {
  if (url.includes('roku.com') || url.includes('content.sr.roku')) {
    return 'roku'
  }
  if (url.includes('stremio') || url.includes('manifest.json')) {
    return 'stremio'
  }
  if (url.includes('xtream') || url.includes('player_api.php')) {
    return 'xtream'
  }
  if (url.includes('.m3u') || url.includes('playlist')) {
    return 'm3u-playlist'
  }
  if (url.includes('epg') || url.includes('.xml')) {
    return 'epg'
  }
  return 'generic'
}

// Check if URL is a content API
function isContentAPI(url: string): boolean {
  const apiPatterns = [
    /roku\.com.*content/i,
    /content\.sr\.roku/i,
    /stremio/i,
    /xtream|player_api/i,
    /manifest\.json/i,
    /\.m3u8?(?:\?|$)/i,
    /epg.*\.xml/i,
    /api.*content/i,
    /streaming.*api/i,
    /cdn.*stream/i
  ]

  return apiPatterns.some(pattern => pattern.test(url))
}

// Query Roku content API
async function queryRokuAPI(url: string): Promise<ExtractedStream[]> {
  const streams: ExtractedStream[] = []

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json'
      }
    })

    if (!response.ok) return streams

    const data = await response.json()

    // Parse Roku recommendation/content response
    if (data.body && Array.isArray(data.body)) {
      data.body.forEach((item: any) => {
        if (item.streamUrl) {
          streams.push({
            url: item.streamUrl,
            title: item.title || item.name,
            type: item.contentType || 'stream',
            quality: item.quality,
            format: item.format || 'unknown',
            source: 'Roku Content API'
          })
        }
        if (item.links && Array.isArray(item.links)) {
          item.links.forEach((link: any) => {
            if (link.href) {
              streams.push({
                url: link.href,
                title: item.title || item.name,
                type: link.rel || 'stream',
                source: 'Roku Content API'
              })
            }
          })
        }
      })
    }

    // Parse generic stream URLs
    if (data.streams && Array.isArray(data.streams)) {
      data.streams.forEach((stream: any) => {
        if (typeof stream === 'string') {
          streams.push({
            url: stream,
            type: 'stream',
            source: 'Roku Content API'
          })
        } else if (stream.url) {
          streams.push({
            url: stream.url,
            title: stream.title,
            type: stream.type || 'stream',
            quality: stream.quality,
            source: 'Roku Content API'
          })
        }
      })
    }
  } catch (error) {
    console.error('Error querying Roku API:', error)
  }

  return streams
}

// Query Stremio manifest
async function queryStremioAPI(url: string): Promise<ExtractedStream[]> {
  const streams: ExtractedStream[] = []

  try {
    const baseUrl = url.replace('/manifest.json', '')
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    })

    if (!response.ok) return streams

    const manifest = await response.json()

    // Get catalogs from manifest
    if (manifest.catalogs && Array.isArray(manifest.catalogs)) {
      for (const catalog of manifest.catalogs) {
        try {
          const catalogUrl = `${baseUrl}/catalog/${catalog.type}/${catalog.id}.json`
          const catalogResponse = await fetch(catalogUrl)
          
          if (catalogResponse.ok) {
            const catalogData = await catalogResponse.json()
            
            if (catalogData.metas && Array.isArray(catalogData.metas)) {
              catalogData.metas.forEach((meta: any) => {
                if (meta.links && Array.isArray(meta.links)) {
                  meta.links.forEach((link: any) => {
                    streams.push({
                      url: link.url || meta.id,
                      title: meta.name || meta.title,
                      type: catalog.type,
                      source: 'Stremio Manifest'
                    })
                  })
                }
              })
            }
          }
        } catch (error) {
          console.error('Error querying Stremio catalog:', error)
        }
      }
    }
  } catch (error) {
    console.error('Error querying Stremio API:', error)
  }

  return streams
}

// Query M3U playlist
async function queryM3UPlaylist(url: string): Promise<ExtractedStream[]> {
  const streams: ExtractedStream[] = []

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    })

    if (!response.ok) return streams

    const content = await response.text()
    const lines = content.split('\n')

    let currentTitle = ''
    for (const line of lines) {
      if (line.startsWith('#EXTINF')) {
        const titleMatch = line.match(/,(.+)$/)
        currentTitle = titleMatch ? titleMatch[1].trim() : ''
      } else if (line.startsWith('http')) {
        streams.push({
          url: line.trim(),
          title: currentTitle || undefined,
          type: 'stream',
          source: 'M3U Playlist'
        })
        currentTitle = ''
      }
    }
  } catch (error) {
    console.error('Error querying M3U playlist:', error)
  }

  return streams
}

// Main extraction function
export async function extractFromAPIEndpoints(
  endpoints: APIEndpoint[],
  onProgress?: (current: number, total: number) => void
): Promise<ExtractedStream[]> {
  const allStreams: ExtractedStream[] = []
  const timeout = 10000 // 10 second timeout per request

  for (let i = 0; i < endpoints.length; i++) {
    onProgress?.(i + 1, endpoints.length)

    const endpoint = endpoints[i]
    let streams: ExtractedStream[] = []

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout)

      switch (endpoint.type) {
        case 'roku':
          streams = await queryRokuAPI(endpoint.url)
          break
        case 'stremio':
          streams = await queryStremioAPI(endpoint.url)
          break
        case 'm3u-playlist':
          streams = await queryM3UPlaylist(endpoint.url)
          break
        case 'xtream':
          // For Xtream, try to extract get_live_streams.php endpoint
          const xtreamUrl = endpoint.url.includes('player_api.php')
            ? endpoint.url.replace('player_api.php', 'get_live_streams.php')
            : endpoint.url
          streams = await queryM3UPlaylist(xtreamUrl)
          break
        default:
          // Try generic M3U/playlist format
          streams = await queryM3UPlaylist(endpoint.url)
      }

      clearTimeout(timer)
    } catch (error) {
      console.error(`Error extracting from ${endpoint.url}:`, error)
    }

    // Deduplicate streams
    const urlSet = new Set(allStreams.map(s => s.url))
    streams.forEach(stream => {
      if (!urlSet.has(stream.url)) {
        allStreams.push(stream)
        urlSet.add(stream.url)
      }
    })
  }

  return allStreams
}

// Convert to link format for app
export function streamsToLinks(streams: ExtractedStream[]) {
  return streams.map(stream => ({
    url: stream.url,
    title: stream.title,
    source: stream.source,
    metadata: {
      type: stream.type,
      quality: stream.quality,
      format: stream.format
    }
  }))
}
