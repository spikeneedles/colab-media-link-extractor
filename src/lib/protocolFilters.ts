export type StreamingProtocol = 
  | 'http'
  | 'https'
  | 'rtsp'
  | 'rtmp'
  | 'rtmps'
  | 'rtp'
  | 'udp'
  | 'hls'
  | 'dash'
  | 'mms'
  | 'mmsh'
  | 'mmst'
  | 'rtmpt'
  | 'rtmpe'
  | 'rtmpte'
  | 'ftp'
  | 'sftp'
  | 'srt'
  | 'webrtc'
  | 'icecast'
  | 'shoutcast'
  | 'all'

export type ProtocolFilterResult = {
  protocol: StreamingProtocol
  url: string
  matches: boolean
  details?: {
    port?: number
    host?: string
    path?: string
    extension?: string
  }
}

export type ProtocolPattern = {
  protocol: StreamingProtocol
  name: string
  description: string
  regex: RegExp
  examples: string[]
  commonPorts?: number[]
  extensions?: string[]
}

export const PROTOCOL_PATTERNS: Record<StreamingProtocol, ProtocolPattern> = {
  'http': {
    protocol: 'http',
    name: 'HTTP',
    description: 'Standard HTTP streaming protocol',
    regex: /^http:\/\//i,
    examples: [
      'http://example.com/stream.m3u8',
      'http://192.168.1.1:8080/video.mp4'
    ],
    commonPorts: [80, 8080, 8000, 8888],
    extensions: ['.m3u8', '.m3u', '.mp4', '.ts', '.mkv', '.avi']
  },
  'https': {
    protocol: 'https',
    name: 'HTTPS',
    description: 'Secure HTTP streaming protocol',
    regex: /^https:\/\//i,
    examples: [
      'https://example.com/stream.m3u8',
      'https://cdn.provider.tv/live/channel.m3u8'
    ],
    commonPorts: [443, 8443],
    extensions: ['.m3u8', '.m3u', '.mp4', '.ts', '.mkv']
  },
  'rtsp': {
    protocol: 'rtsp',
    name: 'RTSP',
    description: 'Real-Time Streaming Protocol for live streams',
    regex: /^rtsp:\/\//i,
    examples: [
      'rtsp://example.com:554/live/stream',
      'rtsp://192.168.1.100/stream1'
    ],
    commonPorts: [554, 8554, 5554],
    extensions: []
  },
  'rtmp': {
    protocol: 'rtmp',
    name: 'RTMP',
    description: 'Real-Time Messaging Protocol (Adobe Flash)',
    regex: /^rtmp:\/\//i,
    examples: [
      'rtmp://example.com/live/stream',
      'rtmp://cdn.tv:1935/app/stream'
    ],
    commonPorts: [1935],
    extensions: []
  },
  'rtmps': {
    protocol: 'rtmps',
    name: 'RTMPS',
    description: 'Secure RTMP over TLS/SSL',
    regex: /^rtmps:\/\//i,
    examples: [
      'rtmps://example.com/live/stream',
      'rtmps://secure.tv:443/app/stream'
    ],
    commonPorts: [443],
    extensions: []
  },
  'rtp': {
    protocol: 'rtp',
    name: 'RTP',
    description: 'Real-time Transport Protocol',
    regex: /^rtp:\/\//i,
    examples: [
      'rtp://example.com:5004',
      'rtp://239.255.0.1:5004'
    ],
    commonPorts: [5004, 5005, 5006],
    extensions: []
  },
  'udp': {
    protocol: 'udp',
    name: 'UDP',
    description: 'User Datagram Protocol streaming',
    regex: /^udp:\/\//i,
    examples: [
      'udp://@239.0.0.1:1234',
      'udp://239.255.0.1:5004'
    ],
    commonPorts: [1234, 5004],
    extensions: []
  },
  'hls': {
    protocol: 'hls',
    name: 'HLS',
    description: 'HTTP Live Streaming (Apple)',
    regex: /^(http|https):\/\/.*\.(m3u8|m3u)(\?.*)?$/i,
    examples: [
      'https://example.com/playlist.m3u8',
      'http://stream.tv/live/channel/playlist.m3u8'
    ],
    commonPorts: [80, 443, 8080],
    extensions: ['.m3u8', '.m3u']
  },
  'dash': {
    protocol: 'dash',
    name: 'DASH',
    description: 'Dynamic Adaptive Streaming over HTTP (MPEG-DASH)',
    regex: /^(http|https):\/\/.*\.(mpd|dash)(\?.*)?$/i,
    examples: [
      'https://example.com/manifest.mpd',
      'http://stream.tv/video/stream.mpd'
    ],
    commonPorts: [80, 443],
    extensions: ['.mpd', '.dash']
  },
  'mms': {
    protocol: 'mms',
    name: 'MMS',
    description: 'Microsoft Media Server protocol',
    regex: /^mms:\/\//i,
    examples: [
      'mms://example.com/stream',
      'mms://server.tv:1755/broadcast'
    ],
    commonPorts: [1755],
    extensions: []
  },
  'mmsh': {
    protocol: 'mmsh',
    name: 'MMSH',
    description: 'MMS over HTTP',
    regex: /^mmsh:\/\//i,
    examples: [
      'mmsh://example.com/stream',
      'mmsh://server.tv:80/live'
    ],
    commonPorts: [80, 8080],
    extensions: []
  },
  'mmst': {
    protocol: 'mmst',
    name: 'MMST',
    description: 'MMS over TCP',
    regex: /^mmst:\/\//i,
    examples: [
      'mmst://example.com/stream',
      'mmst://server.tv:1755/broadcast'
    ],
    commonPorts: [1755],
    extensions: []
  },
  'rtmpt': {
    protocol: 'rtmpt',
    name: 'RTMPT',
    description: 'RTMP Tunneled over HTTP',
    regex: /^rtmpt:\/\//i,
    examples: [
      'rtmpt://example.com/live/stream',
      'rtmpt://server.tv:80/app/stream'
    ],
    commonPorts: [80, 8080],
    extensions: []
  },
  'rtmpe': {
    protocol: 'rtmpe',
    name: 'RTMPE',
    description: 'Encrypted RTMP',
    regex: /^rtmpe:\/\//i,
    examples: [
      'rtmpe://example.com/live/stream',
      'rtmpe://server.tv:1935/secure/stream'
    ],
    commonPorts: [1935],
    extensions: []
  },
  'rtmpte': {
    protocol: 'rtmpte',
    name: 'RTMPTE',
    description: 'Encrypted RTMP Tunneled',
    regex: /^rtmpte:\/\//i,
    examples: [
      'rtmpte://example.com/live/stream',
      'rtmpte://server.tv:80/secure/stream'
    ],
    commonPorts: [80],
    extensions: []
  },
  'ftp': {
    protocol: 'ftp',
    name: 'FTP',
    description: 'File Transfer Protocol',
    regex: /^ftp:\/\//i,
    examples: [
      'ftp://example.com/media/video.mp4',
      'ftp://192.168.1.1/files/stream.mkv'
    ],
    commonPorts: [21],
    extensions: ['.mp4', '.mkv', '.avi', '.mov']
  },
  'sftp': {
    protocol: 'sftp',
    name: 'SFTP',
    description: 'Secure File Transfer Protocol',
    regex: /^sftp:\/\//i,
    examples: [
      'sftp://example.com/media/video.mp4',
      'sftp://server.com:22/files/stream.mkv'
    ],
    commonPorts: [22],
    extensions: ['.mp4', '.mkv', '.avi', '.mov']
  },
  'srt': {
    protocol: 'srt',
    name: 'SRT',
    description: 'Secure Reliable Transport',
    regex: /^srt:\/\//i,
    examples: [
      'srt://example.com:9999',
      'srt://192.168.1.100:9998?mode=listener'
    ],
    commonPorts: [9999, 9998],
    extensions: []
  },
  'webrtc': {
    protocol: 'webrtc',
    name: 'WebRTC',
    description: 'Web Real-Time Communication',
    regex: /^(webrtc|wss):\/\//i,
    examples: [
      'webrtc://example.com/stream',
      'wss://example.com/webrtc'
    ],
    commonPorts: [443],
    extensions: []
  },
  'icecast': {
    protocol: 'icecast',
    name: 'Icecast',
    description: 'Icecast streaming server',
    regex: /^(http|https):\/\/.*[:\/].*\/(stream|mount|listen|radio|live)/i,
    examples: [
      'http://icecast.example.com:8000/stream',
      'https://radio.fm/listen/station'
    ],
    commonPorts: [8000, 8001, 8080],
    extensions: []
  },
  'shoutcast': {
    protocol: 'shoutcast',
    name: 'SHOUTcast',
    description: 'SHOUTcast streaming server',
    regex: /^(http|https):\/\/.*[:\/].*(shoutcast|stream|radio)/i,
    examples: [
      'http://shoutcast.example.com:8000',
      'http://stream.radio.com:80/live'
    ],
    commonPorts: [8000, 8001],
    extensions: []
  },
  'all': {
    protocol: 'all',
    name: 'All Protocols',
    description: 'Match all streaming protocols',
    regex: /.*/,
    examples: [],
    commonPorts: [],
    extensions: []
  }
}

export const filterByProtocol = (url: string, protocol: StreamingProtocol): ProtocolFilterResult => {
  const pattern = PROTOCOL_PATTERNS[protocol]
  
  if (!pattern) {
    return {
      protocol,
      url,
      matches: false
    }
  }

  const matches = pattern.regex.test(url)
  
  if (!matches) {
    return {
      protocol,
      url,
      matches: false
    }
  }

  try {
    const urlObj = new URL(url)
    const extension = urlObj.pathname.split('.').pop() || ''
    
    return {
      protocol,
      url,
      matches: true,
      details: {
        port: urlObj.port ? parseInt(urlObj.port) : undefined,
        host: urlObj.hostname,
        path: urlObj.pathname,
        extension: extension ? `.${extension}` : undefined
      }
    }
  } catch {
    return {
      protocol,
      url,
      matches: true
    }
  }
}

export const filterUrlsByProtocols = (
  urls: string[],
  protocols: StreamingProtocol[]
): Map<StreamingProtocol, string[]> => {
  const resultMap = new Map<StreamingProtocol, string[]>()
  
  protocols.forEach(protocol => {
    resultMap.set(protocol, [])
  })

  urls.forEach(url => {
    protocols.forEach(protocol => {
      const result = filterByProtocol(url, protocol)
      if (result.matches) {
        const existing = resultMap.get(protocol) || []
        existing.push(url)
        resultMap.set(protocol, existing)
      }
    })
  })

  return resultMap
}

export const detectProtocol = (url: string): StreamingProtocol => {
  const protocolOrder: StreamingProtocol[] = [
    'rtsp', 'rtmp', 'rtmps', 'rtp', 'udp', 'mms', 'mmsh', 'mmst',
    'rtmpt', 'rtmpe', 'rtmpte', 'srt', 'webrtc', 'ftp', 'sftp',
    'hls', 'dash', 'icecast', 'shoutcast', 'https', 'http'
  ]

  for (const protocol of protocolOrder) {
    const result = filterByProtocol(url, protocol)
    if (result.matches) {
      return protocol
    }
  }

  return 'http'
}

export const getProtocolStats = (urls: string[]): Map<StreamingProtocol, number> => {
  const stats = new Map<StreamingProtocol, number>()
  
  urls.forEach(url => {
    const protocol = detectProtocol(url)
    stats.set(protocol, (stats.get(protocol) || 0) + 1)
  })

  return stats
}

export const filterByCustomRegex = (
  urls: string[],
  regexPattern: string,
  caseSensitive: boolean = false
): string[] => {
  try {
    const flags = caseSensitive ? 'g' : 'gi'
    const regex = new RegExp(regexPattern, flags)
    return urls.filter(url => regex.test(url))
  } catch (error) {
    console.error('Invalid regex pattern:', error)
    return []
  }
}

export const filterByHost = (urls: string[], hostPattern: string): string[] => {
  const normalizedPattern = hostPattern.toLowerCase()
  return urls.filter(url => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.toLowerCase().includes(normalizedPattern)
    } catch {
      return url.toLowerCase().includes(normalizedPattern)
    }
  })
}

export const filterByPort = (urls: string[], port: number): string[] => {
  return urls.filter(url => {
    try {
      const urlObj = new URL(url)
      return urlObj.port === port.toString()
    } catch {
      return false
    }
  })
}

export const filterByExtension = (urls: string[], extension: string): string[] => {
  const normalizedExt = extension.toLowerCase().replace(/^\./, '')
  return urls.filter(url => {
    try {
      const urlObj = new URL(url)
      const path = urlObj.pathname.toLowerCase()
      return path.endsWith(`.${normalizedExt}`)
    } catch {
      return url.toLowerCase().endsWith(`.${normalizedExt}`)
    }
  })
}

export const generateProtocolReport = (urls: string[]): string => {
  const stats = getProtocolStats(urls)
  const lines: string[] = []
  
  lines.push('=' .repeat(80))
  lines.push('STREAMING PROTOCOL ANALYSIS REPORT')
  lines.push('=' .repeat(80))
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Total URLs Analyzed: ${urls.length}`)
  lines.push('')
  lines.push('=' .repeat(80))
  lines.push('PROTOCOL DISTRIBUTION')
  lines.push('-' .repeat(80))
  
  const sortedStats = Array.from(stats.entries())
    .sort((a, b) => b[1] - a[1])
  
  sortedStats.forEach(([protocol, count]) => {
    const pattern = PROTOCOL_PATTERNS[protocol]
    const percentage = ((count / urls.length) * 100).toFixed(2)
    lines.push(`${pattern.name} (${protocol.toUpperCase()}): ${count} URLs (${percentage}%)`)
    lines.push(`  Description: ${pattern.description}`)
    if (pattern.commonPorts && pattern.commonPorts.length > 0) {
      lines.push(`  Common Ports: ${pattern.commonPorts.join(', ')}`)
    }
    lines.push('')
  })
  
  lines.push('=' .repeat(80))
  lines.push('PROTOCOL DETAILS')
  lines.push('-' .repeat(80))
  
  sortedStats.forEach(([protocol, count]) => {
    const pattern = PROTOCOL_PATTERNS[protocol]
    const protocolUrls = urls.filter(url => detectProtocol(url) === protocol)
    
    lines.push('')
    lines.push(`[${pattern.name.toUpperCase()}]`)
    lines.push(`Count: ${count}`)
    
    const hosts = new Set<string>()
    const ports = new Set<string>()
    const extensions = new Set<string>()
    
    protocolUrls.forEach(url => {
      try {
        const urlObj = new URL(url)
        hosts.add(urlObj.hostname)
        if (urlObj.port) ports.add(urlObj.port)
        const ext = urlObj.pathname.split('.').pop()
        if (ext && ext.length < 10) extensions.add(`.${ext}`)
      } catch {}
    })
    
    if (hosts.size > 0) {
      lines.push(`Unique Hosts: ${hosts.size}`)
      if (hosts.size <= 10) {
        Array.from(hosts).forEach(host => {
          lines.push(`  - ${host}`)
        })
      }
    }
    
    if (ports.size > 0) {
      lines.push(`Ports Used: ${Array.from(ports).join(', ')}`)
    }
    
    if (extensions.size > 0) {
      lines.push(`File Extensions: ${Array.from(extensions).join(', ')}`)
    }
    
    lines.push('')
    lines.push('Sample URLs:')
    protocolUrls.slice(0, 5).forEach((url, idx) => {
      lines.push(`  ${idx + 1}. ${url}`)
    })
    
    if (protocolUrls.length > 5) {
      lines.push(`  ... and ${protocolUrls.length - 5} more`)
    }
  })
  
  lines.push('')
  lines.push('=' .repeat(80))
  lines.push('END OF REPORT')
  lines.push('=' .repeat(80))
  
  return lines.join('\n')
}

export const exportProtocolFilteredFiles = async (
  urls: string[],
  protocol: StreamingProtocol
): Promise<Blob> => {
  const filteredUrls = urls.filter(url => detectProtocol(url) === protocol)
  const pattern = PROTOCOL_PATTERNS[protocol]
  
  const content = [
    `# ${pattern.name} URLs - ${pattern.description}`,
    `# Generated: ${new Date().toISOString()}`,
    `# Total URLs: ${filteredUrls.length}`,
    '',
    ...filteredUrls
  ].join('\n')
  
  return new Blob([content], { type: 'text/plain' })
}
