export interface StreamingPattern {
  id: string
  name: string
  description: string
  author: string
  category: 'xtream' | 'hls' | 'rtmp' | 'rtsp' | 'm3u' | 'dash' | 'generic' | 'iptv-panel' | 'custom'
  patterns: string[]
  exampleUrls: string[]
  testUrls?: string[]
  tags: string[]
  popularity: number
  rating: number
  downloads: number
  createdAt: string
  updatedAt: string
  verified: boolean
  providerHints?: string[]
  scrapingRules?: {
    selectors?: string[]
    jsExecution?: string
    waitForElement?: string
    paginationPattern?: string
  }
  validationRules?: {
    requiresAuth?: boolean
    headerPatterns?: Record<string, string>
    expectedContentType?: string[]
  }
}

export interface PatternLibraryStats {
  totalPatterns: number
  totalDownloads: number
  categories: Record<string, number>
  topPatterns: StreamingPattern[]
  recentPatterns: StreamingPattern[]
}

export interface PatternSubmission {
  name: string
  description: string
  category: StreamingPattern['category']
  patterns: string[]
  exampleUrls: string[]
  testUrls?: string[]
  tags: string[]
  providerHints?: string[]
  scrapingRules?: StreamingPattern['scrapingRules']
  validationRules?: StreamingPattern['validationRules']
}

export interface PatternReview {
  patternId: string
  rating: number
  comment: string
  author: string
  helpful: number
  createdAt: string
}

const COMMUNITY_PATTERNS: StreamingPattern[] = [
  {
    id: 'xtream-codes-standard',
    name: 'Xtream Codes Standard',
    description: 'Standard Xtream Codes API pattern for live streams, movies, and series',
    author: 'Community',
    category: 'xtream',
    patterns: [
      'https?://[^/]+/(?:live|movie|series)/[^/]+/[^/]+/\\d+',
      'https?://[^/]+/player_api\\.php\\?username=[^&]+&password=[^&]+',
      'https?://[^/]+:\\d+/(?:live|movie|series)/[^/]+/[^/]+/\\d+'
    ],
    exampleUrls: [
      'http://example.com:8080/live/username/password/12345',
      'http://provider.tv/movie/user123/pass456/67890.mp4',
      'http://server.net/player_api.php?username=user&password=pass'
    ],
    testUrls: [],
    tags: ['xtream-codes', 'iptv', 'live-tv', 'vod', 'panel'],
    popularity: 9500,
    rating: 4.8,
    downloads: 15200,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T15:30:00Z',
    verified: true,
    providerHints: ['Xtream Codes', 'XC Panel', 'XUI Panel'],
    validationRules: {
      requiresAuth: true,
      expectedContentType: ['video/mp2t', 'application/vnd.apple.mpegurl', 'video/mp4']
    }
  },
  {
    id: 'hls-m3u8-adaptive',
    name: 'HLS M3U8 Adaptive Streaming',
    description: 'HTTP Live Streaming with adaptive bitrate patterns',
    author: 'Community',
    category: 'hls',
    patterns: [
      'https?://[^/]+/[^\\s]+\\.m3u8(?:\\?[^\\s]*)?',
      'https?://[^/]+/hls/[^\\s]+/[^\\s]+\\.m3u8',
      'https?://[^/]+/live/[^\\s]+/playlist\\.m3u8'
    ],
    exampleUrls: [
      'https://cdn.example.com/stream/playlist.m3u8',
      'https://live.provider.tv/hls/channel1/master.m3u8',
      'https://streaming.net/live/sports/playlist.m3u8?token=abc123'
    ],
    tags: ['hls', 'm3u8', 'adaptive-streaming', 'live', 'vod'],
    popularity: 8700,
    rating: 4.7,
    downloads: 12800,
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-18T12:00:00Z',
    verified: true,
    providerHints: ['Cloudflare Stream', 'AWS MediaLive', 'Akamai'],
    validationRules: {
      expectedContentType: ['application/vnd.apple.mpegurl', 'application/x-mpegURL']
    }
  },
  {
    id: 'dash-mpd-streaming',
    name: 'MPEG-DASH MPD Streaming',
    description: 'Dynamic Adaptive Streaming over HTTP manifest patterns',
    author: 'Community',
    category: 'dash',
    patterns: [
      'https?://[^/]+/[^\\s]+\\.mpd(?:\\?[^\\s]*)?',
      'https?://[^/]+/dash/[^\\s]+/manifest\\.mpd',
      'https?://[^/]+/stream/[^\\s]+\\.mpd'
    ],
    exampleUrls: [
      'https://cdn.provider.com/content/stream.mpd',
      'https://dash.example.tv/manifest.mpd?id=12345',
      'https://stream.net/dash/live/channel.mpd'
    ],
    tags: ['dash', 'mpd', 'mpeg-dash', 'adaptive-streaming'],
    popularity: 6200,
    rating: 4.5,
    downloads: 8400,
    createdAt: '2024-01-12T14:00:00Z',
    updatedAt: '2024-01-19T09:30:00Z',
    verified: true,
    providerHints: ['YouTube', 'Netflix', 'Amazon Prime'],
    validationRules: {
      expectedContentType: ['application/dash+xml']
    }
  },
  {
    id: 'rtmp-streaming',
    name: 'RTMP/RTMPS Streaming',
    description: 'Real-Time Messaging Protocol streaming patterns',
    author: 'Community',
    category: 'rtmp',
    patterns: [
      'rtmps?://[^/]+/[^\\s]+',
      'rtmps?://[^/]+:\\d+/[^\\s]+/[^\\s]+',
      'rtmpe?://[^/]+/live/[^\\s]+'
    ],
    exampleUrls: [
      'rtmp://live.example.com/stream/channel1',
      'rtmps://secure.provider.tv:1935/live/stream',
      'rtmpe://server.net/app/streamkey'
    ],
    tags: ['rtmp', 'rtmps', 'live-streaming', 'broadcast'],
    popularity: 5100,
    rating: 4.4,
    downloads: 6900,
    createdAt: '2024-01-08T16:00:00Z',
    updatedAt: '2024-01-17T11:00:00Z',
    verified: true,
    providerHints: ['Twitch', 'Facebook Live', 'YouTube Live']
  },
  {
    id: 'rtsp-camera-streams',
    name: 'RTSP Camera & IP Streams',
    description: 'Real-Time Streaming Protocol for IP cameras and security systems',
    author: 'Community',
    category: 'rtsp',
    patterns: [
      'rtsps?://[^/]+/[^\\s]+',
      'rtsps?://[^:]+:[^@]+@[^/]+/[^\\s]+',
      'rtsps?://[^/]+:\\d+/[^\\s]+'
    ],
    exampleUrls: [
      'rtsp://camera.example.com/stream1',
      'rtsp://admin:pass@192.168.1.100/live',
      'rtsps://secure.camera.net:554/h264/ch1/main/av_stream'
    ],
    tags: ['rtsp', 'ip-camera', 'security', 'surveillance'],
    popularity: 4800,
    rating: 4.6,
    downloads: 7200,
    createdAt: '2024-01-05T12:00:00Z',
    updatedAt: '2024-01-16T14:30:00Z',
    verified: true,
    providerHints: ['Hikvision', 'Dahua', 'Axis', 'Uniview']
  },
  {
    id: 'iptv-panel-generic',
    name: 'Generic IPTV Panel',
    description: 'Common patterns for web-based IPTV panel systems',
    author: 'Community',
    category: 'iptv-panel',
    patterns: [
      'https?://[^/]+/get\\.php\\?[^\\s]*',
      'https?://[^/]+/panel/[^\\s]+',
      'https?://[^/]+/api/[^\\s]+/stream'
    ],
    exampleUrls: [
      'http://panel.provider.tv/get.php?username=user&password=pass&type=m3u',
      'https://iptv.example.com/panel/stream/12345',
      'http://api.provider.net/api/v1/stream?token=abc123'
    ],
    tags: ['iptv', 'panel', 'api', 'm3u-generator'],
    popularity: 7300,
    rating: 4.3,
    downloads: 9600,
    createdAt: '2024-01-11T09:00:00Z',
    updatedAt: '2024-01-19T16:00:00Z',
    verified: true,
    providerHints: ['Generic Panel', 'Custom IPTV Panel']
  },
  {
    id: 'acestream-p2p',
    name: 'AceStream P2P',
    description: 'AceStream peer-to-peer streaming protocol patterns',
    author: 'Community',
    category: 'custom',
    patterns: [
      'acestream://[a-f0-9]{40}',
      'http://[^/]+/ace/getstream\\?id=[a-f0-9]{40}',
      'https?://[^/]+/ace/[a-f0-9]{40}'
    ],
    exampleUrls: [
      'acestream://0123456789abcdef0123456789abcdef01234567',
      'http://127.0.0.1:6878/ace/getstream?id=abcd1234efgh5678ijkl9012mnop3456qrst7890',
      'https://acestream.provider.net/ace/fedcba9876543210fedcba9876543210fedcba98'
    ],
    tags: ['acestream', 'p2p', 'torrent-streaming', 'sports'],
    popularity: 3900,
    rating: 4.2,
    downloads: 5100,
    createdAt: '2024-01-09T13:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    verified: true,
    providerHints: ['AceStream', 'Torrent Streaming']
  },
  {
    id: 'stalker-portal',
    name: 'Stalker Portal Middleware',
    description: 'MAG/Stalker portal middleware system patterns',
    author: 'Community',
    category: 'iptv-panel',
    patterns: [
      'https?://[^/]+/stalker_portal/[^\\s]+',
      'https?://[^/]+/server/load\\.php',
      'https?://[^/]+/portal\\.php\\?[^\\s]*'
    ],
    exampleUrls: [
      'http://portal.provider.tv/stalker_portal/server/load.php',
      'https://mag.example.com/portal.php?type=itv&action=get_all_channels',
      'http://server.net/stalker_portal/c/index.html'
    ],
    tags: ['stalker', 'mag', 'middleware', 'set-top-box'],
    popularity: 5600,
    rating: 4.5,
    downloads: 7800,
    createdAt: '2024-01-13T11:00:00Z',
    updatedAt: '2024-01-20T13:00:00Z',
    verified: true,
    providerHints: ['Stalker Middleware', 'MAG Portal', 'Ministra']
  },
  {
    id: 'youtube-live-streams',
    name: 'YouTube Live Streams',
    description: 'Patterns for extracting YouTube live stream URLs',
    author: 'Community',
    category: 'custom',
    patterns: [
      'https?://(?:www\\.)?youtube\\.com/watch\\?v=[a-zA-Z0-9_-]{11}',
      'https?://(?:www\\.)?youtube\\.com/live/[a-zA-Z0-9_-]+',
      'https?://youtu\\.be/[a-zA-Z0-9_-]{11}'
    ],
    exampleUrls: [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/live/live-stream-id',
      'https://youtu.be/abc123DEF456'
    ],
    tags: ['youtube', 'live', 'vod', 'streaming-platform'],
    popularity: 8100,
    rating: 4.6,
    downloads: 11500,
    createdAt: '2024-01-14T15:00:00Z',
    updatedAt: '2024-01-21T10:30:00Z',
    verified: true,
    providerHints: ['YouTube', 'Google Video']
  },
  {
    id: 'twitch-streams',
    name: 'Twitch Live Streams',
    description: 'Patterns for Twitch live streaming channels',
    author: 'Community',
    category: 'custom',
    patterns: [
      'https?://(?:www\\.)?twitch\\.tv/[a-zA-Z0-9_]+',
      'https?://(?:www\\.)?twitch\\.tv/videos/\\d+',
      'https?://player\\.twitch\\.tv/\\?[^\\s]*channel=[^&\\s]+'
    ],
    exampleUrls: [
      'https://www.twitch.tv/channelname',
      'https://twitch.tv/videos/1234567890',
      'https://player.twitch.tv/?channel=streamername&parent=example.com'
    ],
    tags: ['twitch', 'gaming', 'live', 'streaming-platform'],
    popularity: 6800,
    rating: 4.4,
    downloads: 9200,
    createdAt: '2024-01-07T14:00:00Z',
    updatedAt: '2024-01-18T16:00:00Z',
    verified: true,
    providerHints: ['Twitch', 'Amazon Interactive Video']
  }
]

export function getCommunityPatterns(): StreamingPattern[] {
  return [...COMMUNITY_PATTERNS].sort((a, b) => b.popularity - a.popularity)
}

export function getPatternById(id: string): StreamingPattern | undefined {
  return COMMUNITY_PATTERNS.find(p => p.id === id)
}

export function getPatternsByCategory(category: StreamingPattern['category']): StreamingPattern[] {
  return COMMUNITY_PATTERNS.filter(p => p.category === category)
}

export function searchPatterns(query: string): StreamingPattern[] {
  const lowerQuery = query.toLowerCase()
  return COMMUNITY_PATTERNS.filter(p => 
    p.name.toLowerCase().includes(lowerQuery) ||
    p.description.toLowerCase().includes(lowerQuery) ||
    p.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
    p.providerHints?.some(hint => hint.toLowerCase().includes(lowerQuery))
  )
}

export function getTopPatterns(limit: number = 10): StreamingPattern[] {
  return [...COMMUNITY_PATTERNS]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit)
}

export function getRecentPatterns(limit: number = 10): StreamingPattern[] {
  return [...COMMUNITY_PATTERNS]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit)
}

export function getPatternStats(): PatternLibraryStats {
  const categories = COMMUNITY_PATTERNS.reduce((acc, pattern) => {
    acc[pattern.category] = (acc[pattern.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    totalPatterns: COMMUNITY_PATTERNS.length,
    totalDownloads: COMMUNITY_PATTERNS.reduce((sum, p) => sum + p.downloads, 0),
    categories,
    topPatterns: getTopPatterns(5),
    recentPatterns: getRecentPatterns(5)
  }
}

export function testPatternAgainstUrl(pattern: string, url: string): boolean {
  try {
    const regex = new RegExp(pattern, 'i')
    return regex.test(url)
  } catch {
    return false
  }
}

export function testPatternSetAgainstUrl(patterns: string[], url: string): boolean {
  return patterns.some(pattern => testPatternAgainstUrl(pattern, url))
}

export function findMatchingPatterns(url: string): StreamingPattern[] {
  return COMMUNITY_PATTERNS.filter(pattern => 
    testPatternSetAgainstUrl(pattern.patterns, url)
  )
}

export async function exportPattern(pattern: StreamingPattern): Promise<Blob> {
  const exportData = {
    ...pattern,
    exportedAt: new Date().toISOString(),
    exportVersion: '1.0'
  }
  
  return new Blob([JSON.stringify(exportData, null, 2)], { 
    type: 'application/json' 
  })
}

export async function importPattern(jsonString: string): Promise<StreamingPattern> {
  try {
    const data = JSON.parse(jsonString)
    
    if (!data.name || !data.patterns || !Array.isArray(data.patterns)) {
      throw new Error('Invalid pattern format')
    }

    const pattern: StreamingPattern = {
      id: data.id || `custom-${Date.now()}`,
      name: data.name,
      description: data.description || '',
      author: data.author || 'Anonymous',
      category: data.category || 'custom',
      patterns: data.patterns,
      exampleUrls: data.exampleUrls || [],
      testUrls: data.testUrls,
      tags: data.tags || [],
      popularity: data.popularity || 0,
      rating: data.rating || 0,
      downloads: data.downloads || 0,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      verified: false,
      providerHints: data.providerHints,
      scrapingRules: data.scrapingRules,
      validationRules: data.validationRules
    }

    return pattern
  } catch (error) {
    throw new Error('Failed to import pattern: ' + (error as Error).message)
  }
}

export function validatePattern(pattern: Partial<StreamingPattern>): { 
  valid: boolean
  errors: string[] 
} {
  const errors: string[] = []

  if (!pattern.name || pattern.name.trim().length === 0) {
    errors.push('Pattern name is required')
  }

  if (!pattern.patterns || !Array.isArray(pattern.patterns) || pattern.patterns.length === 0) {
    errors.push('At least one pattern regex is required')
  }

  if (pattern.patterns) {
    pattern.patterns.forEach((p, i) => {
      try {
        new RegExp(p)
      } catch {
        errors.push(`Invalid regex pattern at index ${i}: ${p}`)
      }
    })
  }

  if (!pattern.category) {
    errors.push('Pattern category is required')
  }

  if (pattern.exampleUrls && pattern.exampleUrls.length > 0 && pattern.patterns) {
    const unmatchedUrls = pattern.exampleUrls.filter(url => 
      !testPatternSetAgainstUrl(pattern.patterns!, url)
    )
    if (unmatchedUrls.length > 0) {
      errors.push(`Example URLs don't match patterns: ${unmatchedUrls.join(', ')}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export function combinePatterns(...patterns: StreamingPattern[]): string[] {
  const allPatterns = new Set<string>()
  
  patterns.forEach(pattern => {
    pattern.patterns.forEach(p => allPatterns.add(p))
  })
  
  return Array.from(allPatterns)
}

export function extractUrlsUsingPattern(
  content: string, 
  pattern: StreamingPattern
): string[] {
  const urls: string[] = []
  
  pattern.patterns.forEach(patternStr => {
    try {
      const regex = new RegExp(patternStr, 'gi')
      const matches = content.matchAll(regex)
      
      for (const match of matches) {
        if (match[0]) {
          urls.push(match[0])
        }
      }
    } catch (error) {
      console.error('Error extracting URLs with pattern:', error)
    }
  })
  
  return [...new Set(urls)]
}

export async function scanContentWithPatterns(
  content: string,
  patterns: StreamingPattern[]
): Promise<Map<string, string[]>> {
  const resultMap = new Map<string, string[]>()
  
  patterns.forEach(pattern => {
    const urls = extractUrlsUsingPattern(content, pattern)
    if (urls.length > 0) {
      resultMap.set(pattern.id, urls)
    }
  })
  
  return resultMap
}

export function generatePatternReport(
  patterns: StreamingPattern[],
  scanResults: Map<string, string[]>
): string {
  const lines: string[] = []
  
  lines.push('=' .repeat(80))
  lines.push('PATTERN LIBRARY SCAN REPORT')
  lines.push('=' .repeat(80))
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Patterns Used: ${patterns.length}`)
  lines.push(`Total URLs Found: ${Array.from(scanResults.values()).flat().length}`)
  lines.push('')
  lines.push('=' .repeat(80))
  lines.push('RESULTS BY PATTERN')
  lines.push('=' .repeat(80))
  lines.push('')
  
  patterns.forEach(pattern => {
    const urls = scanResults.get(pattern.id) || []
    
    if (urls.length > 0) {
      lines.push('')
      lines.push(`[${pattern.name}]`)
      lines.push(`${'─'.repeat(80)}`)
      lines.push(`Category: ${pattern.category.toUpperCase()}`)
      lines.push(`Description: ${pattern.description}`)
      lines.push(`URLs Found: ${urls.length}`)
      lines.push('')
      lines.push('MATCHED URLS:')
      urls.forEach((url, index) => {
        lines.push(`  ${index + 1}. ${url}`)
      })
    }
  })
  
  lines.push('')
  lines.push('=' .repeat(80))
  lines.push('END OF REPORT')
  lines.push('=' .repeat(80))
  
  return lines.join('\n')
}
