export interface PatternExample {
  url: string
  shouldMatch: boolean
}

export interface GeneratedPattern {
  regex: string
  description: string
  confidence: number
  examples: {
    matching: string[]
    nonMatching: string[]
  }
  suggestions: string[]
}

export interface PatternAnalysis {
  commonProtocols: string[]
  commonDomains: string[]
  commonPaths: string[]
  commonExtensions: string[]
  commonParameters: string[]
  portPatterns: string[]
  structureAnalysis: {
    hasAuth: boolean
    hasPort: boolean
    hasPath: boolean
    hasQuery: boolean
    hasFragment: boolean
  }
}

const COMMON_STREAMING_PROTOCOLS = [
  'http', 'https', 'rtmp', 'rtmps', 'rtsp', 'rtsps', 
  'hls', 'dash', 'mms', 'mmsh', 'rtp', 'udp', 'tcp'
]

const COMMON_VIDEO_EXTENSIONS = [
  'm3u8', 'm3u', 'mpd', 'ts', 'mp4', 'mkv', 'avi', 
  'flv', 'mov', 'wmv', 'webm', 'mpeg', 'mpg'
]

const COMMON_AUDIO_EXTENSIONS = [
  'mp3', 'aac', 'ogg', 'opus', 'flac', 'wav', 'm4a'
]

const STREAMING_PROVIDER_PATTERNS = {
  xtreamCodes: /player_api\.php\?username=[^&]+&password=[^&]+/i,
  hls: /\.m3u8/i,
  dash: /\.mpd/i,
  rtmp: /^rtmp[s]?:\/\//i,
  rtsp: /^rtsp[s]?:\/\//i,
  github: /github\.com|githubusercontent\.com/i,
  gitlab: /gitlab\.com/i,
  akamai: /akamai|akamaihd/i,
  cloudfront: /cloudfront\.net/i,
  cloudflare: /cloudflare/i,
  youtube: /youtube\.com|youtu\.be/i,
  vimeo: /vimeo\.com/i,
  twitch: /twitch\.tv/i,
  dailymotion: /dailymotion\.com/i
}

const QUALITY_INDICATORS = [
  '144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p', '4k', '8k',
  'sd', 'hd', 'fhd', 'uhd', 'low', 'medium', 'high', 'auto'
]

const AUTHENTICATION_PATTERNS = {
  basic: /^https?:\/\/[^:]+:[^@]+@/,
  query: /[?&](username|password|user|pass|token|auth|key|api_key)=/i,
  bearer: /[?&](token|bearer|access_token)=/i,
  apiKey: /[?&](api_key|apikey|key)=/i
}

function detectProviderType(url: string): string | null {
  for (const [provider, pattern] of Object.entries(STREAMING_PROVIDER_PATTERNS)) {
    if (pattern.test(url)) {
      return provider
    }
  }
  return null
}

function detectAuthenticationType(url: string): string[] {
  const authTypes: string[] = []
  for (const [type, pattern] of Object.entries(AUTHENTICATION_PATTERNS)) {
    if (pattern.test(url)) {
      authTypes.push(type)
    }
  }
  return authTypes
}

function detectQualityIndicators(url: string): string[] {
  const detected: string[] = []
  for (const quality of QUALITY_INDICATORS) {
    if (url.toLowerCase().includes(quality)) {
      detected.push(quality)
    }
  }
  return detected
}

function analyzeStreamingFeatures(urls: string[]): {
  providers: Map<string, number>
  authTypes: Set<string>
  qualityIndicators: Set<string>
  hasDynamicTokens: boolean
  hasSessionIds: boolean
  commonPorts: Set<string>
} {
  const providers = new Map<string, number>()
  const authTypes = new Set<string>()
  const qualityIndicators = new Set<string>()
  let hasDynamicTokens = false
  let hasSessionIds = false
  const commonPorts = new Set<string>()

  urls.forEach(url => {
    const provider = detectProviderType(url)
    if (provider) {
      providers.set(provider, (providers.get(provider) || 0) + 1)
    }

    detectAuthenticationType(url).forEach(type => authTypes.add(type))
    detectQualityIndicators(url).forEach(q => qualityIndicators.add(q))

    if (/token|sid|session|timestamp|expires|nonce/i.test(url)) {
      hasDynamicTokens = true
    }

    if (/session[-_]?id|sid=/i.test(url)) {
      hasSessionIds = true
    }

    try {
      const urlObj = new URL(url)
      if (urlObj.port) {
        commonPorts.add(urlObj.port)
      }
    } catch {}
  })

  return {
    providers,
    authTypes,
    qualityIndicators,
    hasDynamicTokens,
    hasSessionIds,
    commonPorts
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function analyzeURLStructure(url: string): PatternAnalysis['structureAnalysis'] {
  try {
    const urlObj = new URL(url)
    return {
      hasAuth: !!(urlObj.username || urlObj.password),
      hasPort: !!urlObj.port,
      hasPath: urlObj.pathname !== '/' && urlObj.pathname !== '',
      hasQuery: urlObj.search !== '',
      hasFragment: urlObj.hash !== ''
    }
  } catch {
    return {
      hasAuth: false,
      hasPort: false,
      hasPath: false,
      hasQuery: false,
      hasFragment: false
    }
  }
}

function extractURLComponents(urls: string[]): PatternAnalysis {
  const protocols = new Set<string>()
  const domains = new Set<string>()
  const paths = new Set<string>()
  const extensions = new Set<string>()
  const parameters = new Set<string>()
  const ports = new Set<string>()
  
  let structureAnalysis = {
    hasAuth: false,
    hasPort: false,
    hasPath: false,
    hasQuery: false,
    hasFragment: false
  }

  urls.forEach(url => {
    try {
      const urlObj = new URL(url)
      
      protocols.add(urlObj.protocol.replace(':', ''))
      domains.add(urlObj.hostname)
      
      if (urlObj.port) {
        ports.add(urlObj.port)
      }
      
      const pathParts = urlObj.pathname.split('/').filter(p => p)
      pathParts.forEach(part => paths.add(part))
      
      const lastPathPart = pathParts[pathParts.length - 1]
      if (lastPathPart && lastPathPart.includes('.')) {
        const ext = lastPathPart.split('.').pop()
        if (ext) extensions.add(ext.toLowerCase())
      }
      
      urlObj.searchParams.forEach((_, key) => {
        parameters.add(key)
      })
      
      const structure = analyzeURLStructure(url)
      structureAnalysis.hasAuth = structureAnalysis.hasAuth || structure.hasAuth
      structureAnalysis.hasPort = structureAnalysis.hasPort || structure.hasPort
      structureAnalysis.hasPath = structureAnalysis.hasPath || structure.hasPath
      structureAnalysis.hasQuery = structureAnalysis.hasQuery || structure.hasQuery
      structureAnalysis.hasFragment = structureAnalysis.hasFragment || structure.hasFragment
    } catch (error) {
      console.error('Error parsing URL:', url, error)
    }
  })

  return {
    commonProtocols: Array.from(protocols),
    commonDomains: Array.from(domains),
    commonPaths: Array.from(paths),
    commonExtensions: Array.from(extensions),
    commonParameters: Array.from(parameters),
    portPatterns: Array.from(ports),
    structureAnalysis
  }
}

function findCommonSubstrings(strings: string[], minLength: number = 3): string[] {
  if (strings.length === 0) return []
  if (strings.length === 1) return [strings[0]]

  const substrings = new Map<string, number>()
  
  strings.forEach(str => {
    const seen = new Set<string>()
    for (let i = 0; i < str.length; i++) {
      for (let j = i + minLength; j <= str.length; j++) {
        const substr = str.substring(i, j)
        if (!seen.has(substr)) {
          seen.add(substr)
          substrings.set(substr, (substrings.get(substr) || 0) + 1)
        }
      }
    }
  })

  const threshold = Math.ceil(strings.length * 0.5)
  const common = Array.from(substrings.entries())
    .filter(([_, count]) => count >= threshold)
    .map(([substr]) => substr)
    .sort((a, b) => b.length - a.length)

  const result: string[] = []
  const used = new Set<string>()

  common.forEach(substr => {
    if (!Array.from(used).some(u => u.includes(substr) || substr.includes(u))) {
      result.push(substr)
      used.add(substr)
    }
  })

  return result.slice(0, 10)
}

function generateProtocolPattern(protocols: string[]): string {
  if (protocols.length === 0) return '(?:https?|rtmp|rtsp|mms|rtp|udp)'
  
  const uniqueProtocols = [...new Set(protocols)]
  if (uniqueProtocols.length === 1) {
    return escapeRegex(uniqueProtocols[0])
  }
  
  return `(?:${uniqueProtocols.map(escapeRegex).join('|')})`
}

function generateDomainPattern(domains: string[]): string {
  if (domains.length === 0) return '[a-zA-Z0-9.-]+'
  
  const uniqueDomains = [...new Set(domains)]
  
  if (uniqueDomains.length === 1) {
    return escapeRegex(uniqueDomains[0])
  }
  
  const commonParts = findCommonSubstrings(uniqueDomains, 3)
  if (commonParts.length > 0 && commonParts[0].length > 5) {
    const pattern = escapeRegex(commonParts[0])
    return `[a-zA-Z0-9.-]*${pattern}[a-zA-Z0-9.-]*`
  }
  
  const topLevelDomains = uniqueDomains.map(d => {
    const parts = d.split('.')
    return parts.slice(-2).join('.')
  })
  
  const uniqueTLDs = [...new Set(topLevelDomains)]
  if (uniqueTLDs.length === 1) {
    return `[a-zA-Z0-9.-]+\\.${escapeRegex(uniqueTLDs[0])}`
  }
  
  return '[a-zA-Z0-9.-]+'
}

function generatePathPattern(paths: string[], extensions: string[]): string {
  if (paths.length === 0 && extensions.length === 0) {
    return '(?:/[^?#]*)?'
  }
  
  let pattern = '/'
  
  const commonPaths = findCommonSubstrings(paths, 2)
  if (commonPaths.length > 0) {
    const segments = commonPaths[0].split('/').filter(s => s)
    if (segments.length > 0) {
      pattern += segments.map(s => `(?:${escapeRegex(s)}|[^/]+)`).join('/')
    } else {
      pattern += '[^?#]*'
    }
  } else {
    pattern += '[^?#]*'
  }
  
  if (extensions.length > 0) {
    const extPattern = extensions.length === 1 
      ? escapeRegex(extensions[0])
      : `(?:${extensions.map(escapeRegex).join('|')})`
    pattern += `\\.${extPattern}`
  }
  
  return pattern
}

function generateQueryPattern(parameters: string[]): string {
  if (parameters.length === 0) return '(?:\\?[^#]*)?'
  
  const paramPatterns = parameters.map(param => 
    `(?:${escapeRegex(param)}=[^&#]*)`
  ).join('|')
  
  return `(?:\\?(?:${paramPatterns})(?:&(?:${paramPatterns}))*)?`
}

export function generatePatternFromExamples(
  examples: PatternExample[],
  options: {
    strictness?: 'loose' | 'medium' | 'strict'
    includeProtocol?: boolean
    includeDomain?: boolean
    includePath?: boolean
    includeQuery?: boolean
  } = {}
): GeneratedPattern {
  const {
    strictness = 'medium',
    includeProtocol = true,
    includeDomain = true,
    includePath = true,
    includeQuery = false
  } = options

  const matchingURLs = examples.filter(e => e.shouldMatch).map(e => e.url)
  const nonMatchingURLs = examples.filter(e => !e.shouldMatch).map(e => e.url)

  if (matchingURLs.length === 0) {
    throw new Error('At least one matching example is required')
  }

  const analysis = extractURLComponents(matchingURLs)
  const streamingFeatures = analyzeStreamingFeatures(matchingURLs)
  
  let pattern = ''
  let description = 'Matches URLs with '
  const descParts: string[] = []
  
  const dominantProvider = Array.from(streamingFeatures.providers.entries())
    .sort((a, b) => b[1] - a[1])[0]
  
  if (dominantProvider) {
    descParts.push(`${dominantProvider[0]} provider`)
  }
  
  if (includeProtocol) {
    const protocolPattern = generateProtocolPattern(analysis.commonProtocols)
    pattern += `^${protocolPattern}://`
    descParts.push(`${analysis.commonProtocols.join(' or ')} protocol`)
  } else {
    pattern += '^(?:https?|rtmp|rtsp|mms|rtp|udp)://'
  }
  
  if (analysis.structureAnalysis.hasAuth || streamingFeatures.authTypes.size > 0) {
    pattern += '(?:[^@]+@)?'
    descParts.push('optional authentication')
  }
  
  if (includeDomain) {
    const domainPattern = generateDomainPattern(analysis.commonDomains)
    pattern += domainPattern
    
    if (analysis.commonDomains.length === 1) {
      descParts.push(`domain ${analysis.commonDomains[0]}`)
    } else {
      descParts.push('specific domains')
    }
  } else {
    pattern += '[a-zA-Z0-9.-]+'
  }
  
  if (analysis.structureAnalysis.hasPort && analysis.portPatterns.length > 0) {
    if (analysis.portPatterns.length === 1) {
      pattern += `:${analysis.portPatterns[0]}`
      descParts.push(`port ${analysis.portPatterns[0]}`)
    } else {
      pattern += `(?::(?:${analysis.portPatterns.join('|')}))?`
      descParts.push(`ports ${analysis.portPatterns.join(', ')}`)
    }
  } else if (analysis.structureAnalysis.hasPort || streamingFeatures.commonPorts.size > 0) {
    pattern += '(?::[0-9]+)?'
  }
  
  if (includePath) {
    const pathPattern = generatePathPattern(analysis.commonPaths, analysis.commonExtensions)
    pattern += pathPattern
    
    if (analysis.commonExtensions.length > 0) {
      descParts.push(`${analysis.commonExtensions.join(' or ')} extension`)
    }
  }
  
  if (streamingFeatures.qualityIndicators.size > 0) {
    descParts.push(`with quality indicators: ${Array.from(streamingFeatures.qualityIndicators).join(', ')}`)
  }
  
  if (includeQuery && analysis.commonParameters.length > 0) {
    const queryPattern = generateQueryPattern(analysis.commonParameters)
    pattern += queryPattern
    descParts.push(`query parameters: ${analysis.commonParameters.join(', ')}`)
  } else if (streamingFeatures.hasDynamicTokens) {
    pattern += '(?:\\?[^#]*)?'
    descParts.push('optional dynamic tokens')
  } else {
    pattern += '(?:\\?[^#]*)?'
  }
  
  pattern += '(?:#.*)?$'
  
  description += descParts.join(', ')

  const regex = new RegExp(pattern)
  let correctMatches = 0
  let correctNonMatches = 0

  matchingURLs.forEach(url => {
    if (regex.test(url)) correctMatches++
  })

  nonMatchingURLs.forEach(url => {
    if (!regex.test(url)) correctNonMatches++
  })

  const totalExamples = examples.length
  const correctPredictions = correctMatches + correctNonMatches
  const confidence = totalExamples > 0 ? (correctPredictions / totalExamples) * 100 : 0

  const suggestions: string[] = []
  
  if (confidence < 80) {
    suggestions.push('Consider providing more examples to improve pattern accuracy')
  }
  
  if (analysis.commonExtensions.length === 0) {
    suggestions.push('No file extensions detected - pattern may match non-media URLs')
  }
  
  if (analysis.commonDomains.length > 5) {
    suggestions.push('Many different domains detected - consider creating separate patterns per provider')
  }
  
  if (matchingURLs.length < 3) {
    suggestions.push('More matching examples recommended for better pattern generation')
  }

  if (nonMatchingURLs.length === 0) {
    suggestions.push('Add non-matching examples to help refine the pattern')
  }

  if (streamingFeatures.hasDynamicTokens) {
    suggestions.push('URLs contain dynamic tokens - pattern will match any query parameters')
  }

  if (streamingFeatures.authTypes.size > 0) {
    suggestions.push(`Detected authentication: ${Array.from(streamingFeatures.authTypes).join(', ')}`)
  }

  return {
    regex: pattern,
    description,
    confidence: Math.round(confidence),
    examples: {
      matching: matchingURLs.slice(0, 5),
      nonMatching: nonMatchingURLs.slice(0, 5)
    },
    suggestions
  }
}

export async function generatePatternWithAI(
  examples: PatternExample[],
  context?: string
): Promise<GeneratedPattern> {
  const matchingURLs = examples.filter(e => e.shouldMatch).map(e => e.url)
  const nonMatchingURLs = examples.filter(e => !e.shouldMatch).map(e => e.url)

  const promptText = `You are an expert in regular expressions, URL pattern matching, and streaming media protocols with deep knowledge of:
- IPTV providers (Xtream Codes, M3U playlists, HLS, DASH)
- Streaming protocols (HTTP, HTTPS, RTMP, RTSP, RTP, UDP, MMS)
- Common CDN patterns (Akamai, CloudFront, Cloudflare)
- Video streaming platforms (YouTube, Vimeo, Twitch, DailyMotion)
- IPTV repository patterns (GitHub IPTV lists, free-iptv.com)
- Kodi addon URL patterns
- APK/Android streaming app patterns

Analyze these example URLs and generate an intelligent regex pattern that understands streaming provider patterns.

MATCHING URLS (should match the pattern):
${matchingURLs.map((url, i) => `${i + 1}. ${url}`).join('\n')}

${nonMatchingURLs.length > 0 ? `NON-MATCHING URLS (should NOT match the pattern):
${nonMatchingURLs.map((url, i) => `${i + 1}. ${url}`).join('\n')}` : ''}

${context ? `Additional context: ${context}` : ''}

ANALYSIS REQUIREMENTS:
1. Identify the streaming provider/type from the URLs
2. Recognize common patterns like:
   - Xtream Codes API format: /player_api.php?username=X&password=Y&type=m3u_plus
   - HLS streams: .m3u8 files with quality indicators (720p, 1080p)
   - RTMP/RTSP streams with ports and authentication
   - GitHub raw content URLs for IPTV playlists
   - CDN patterns with token authentication
   - IPTV provider domains (iptv-org.github.io, etc.)
3. Consider URL structure variations (ports, authentication, query parameters)
4. Account for dynamic content (timestamps, tokens, session IDs)
5. Be flexible enough to match similar URLs from the same provider

Generate a regex pattern that:
1. Matches all the "matching" URLs with 100% accuracy
2. Does NOT match any of the "non-matching" URLs
3. Is intelligent about streaming provider patterns
4. Captures essential URL components while allowing flexibility
5. Handles authentication parameters, quality indicators, and CDN patterns

Return your response as a JSON object with:
{
  "regex": "the generated regex pattern as a string",
  "description": "plain English description including provider type and what the pattern matches",
  "confidence": number from 0-100 indicating pattern reliability,
  "providerType": "identified streaming provider or pattern type (e.g., 'Xtream Codes', 'HLS Stream', 'GitHub IPTV')",
  "reasoning": "detailed explanation of why you chose this pattern and what streaming patterns you identified",
  "suggestions": ["array of suggestions for improving the pattern or adding more examples"],
  "detectedFeatures": ["list of detected URL features like 'authentication', 'quality params', 'CDN tokens', etc."]
}`
  
  const prompt = window.spark.llmPrompt([promptText] as any)

  try {
    const response = await window.spark.llm(prompt, 'gpt-4o', true)
    const result = JSON.parse(response)
    
    const regex = new RegExp(result.regex)
    let correctMatches = 0
    let correctNonMatches = 0

    matchingURLs.forEach(url => {
      if (regex.test(url)) correctMatches++
    })

    nonMatchingURLs.forEach(url => {
      if (!regex.test(url)) correctNonMatches++
    })

    const totalExamples = examples.length
    const actualConfidence = totalExamples > 0 
      ? (correctMatches + correctNonMatches) / totalExamples * 100 
      : 0

    const enhancedDescription = result.providerType 
      ? `${result.providerType}: ${result.description}`
      : result.description

    const enhancedSuggestions = [
      ...(result.suggestions || []),
      ...(result.detectedFeatures ? [`Detected features: ${result.detectedFeatures.join(', ')}`] : [])
    ]

    return {
      regex: result.regex,
      description: enhancedDescription || 'AI-generated streaming pattern',
      confidence: Math.round(actualConfidence),
      examples: {
        matching: matchingURLs.slice(0, 5),
        nonMatching: nonMatchingURLs.slice(0, 5)
      },
      suggestions: enhancedSuggestions
    }
  } catch (error) {
    console.error('AI pattern generation failed, falling back to rule-based generation:', error)
    return generatePatternFromExamples(examples)
  }
}

export function testPattern(regex: string, testUrls: string[]): {
  url: string
  matches: boolean
  error?: string
}[] {
  try {
    const pattern = new RegExp(regex)
    return testUrls.map(url => ({
      url,
      matches: pattern.test(url)
    }))
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid regex pattern'
    return testUrls.map(url => ({
      url,
      matches: false,
      error: errorMessage
    }))
  }
}

export function optimizePattern(regex: string): {
  optimized: string
  improvements: string[]
} {
  let optimized = regex
  const improvements: string[] = []

  if (regex.includes('.*.*')) {
    optimized = optimized.replace(/\.\*\.\*/g, '.*')
    improvements.push('Removed redundant .* patterns')
  }

  if (regex.includes('[0-9]')) {
    optimized = optimized.replace(/\[0-9\]/g, '\\d')
    improvements.push('Replaced [0-9] with \\d for brevity')
  }

  if (regex.includes('(?:') && regex.includes(')?') && 
      regex.match(/\(\?:[^\)]*\)\?/g)?.length === 1) {
    const match = regex.match(/\(\?:([^\)]*)\)\?/)
    if (match && match[1].length === 1) {
      optimized = optimized.replace(/\(\?:([^\)]*)\)\?/, '$1?')
      improvements.push('Simplified single-character optional group')
    }
  }

  const redundantEscapes = /\\([a-zA-Z])/g
  const matches = regex.match(redundantEscapes)
  if (matches) {
    matches.forEach(match => {
      const char = match[1]
      if (!'dDwWsStrnfv'.includes(char)) {
        optimized = optimized.replace(`\\${char}`, char)
        improvements.push(`Removed unnecessary escape from ${char}`)
      }
    })
  }

  if (improvements.length === 0) {
    improvements.push('Pattern is already optimized')
  }

  return { optimized, improvements }
}

export function explainPattern(regex: string): {
  parts: { pattern: string; explanation: string }[]
  overall: string
  streamingInsights?: string[]
} {
  const parts: { pattern: string; explanation: string }[] = []
  const streamingInsights: string[] = []
  
  if (/player_api\.php/i.test(regex)) {
    streamingInsights.push('This pattern targets Xtream Codes API endpoints commonly used by IPTV providers')
  }
  
  if (/\.m3u8/i.test(regex)) {
    streamingInsights.push('Matches HLS (HTTP Live Streaming) playlists with .m3u8 extension')
  }
  
  if (/\.mpd/i.test(regex)) {
    streamingInsights.push('Targets MPEG-DASH streaming manifests with .mpd extension')
  }
  
  if (/rtmp[s]?/i.test(regex)) {
    streamingInsights.push('Includes RTMP/RTMPS protocols for Flash-based streaming')
  }
  
  if (/rtsp[s]?/i.test(regex)) {
    streamingInsights.push('Includes RTSP/RTSPS protocols for real-time streaming')
  }
  
  if (/github|githubusercontent/i.test(regex)) {
    streamingInsights.push('Matches GitHub raw content URLs often used for IPTV playlist repositories')
  }
  
  if (/username|password|token|auth/i.test(regex)) {
    streamingInsights.push('Pattern includes authentication parameters for secured streams')
  }
  
  if (/720p|1080p|4k|hd|uhd/i.test(regex)) {
    streamingInsights.push('Captures quality indicators in URLs (720p, 1080p, 4K, HD, etc.)')
  }
  
  if (/:[0-9]{4,5}/i.test(regex)) {
    streamingInsights.push('Includes port numbers commonly used for streaming servers (1935, 8080, etc.)')
  }
  
  const explanations: { pattern: RegExp; explanation: string }[] = [
    { pattern: /^\^/, explanation: 'Matches the start of the string' },
    { pattern: /\$$/, explanation: 'Matches the end of the string' },
    { pattern: /\\d\+/, explanation: 'Matches one or more digits' },
    { pattern: /\\d/, explanation: 'Matches a single digit' },
    { pattern: /\\w\+/, explanation: 'Matches one or more word characters' },
    { pattern: /\.\*/, explanation: 'Matches any character (except newline) zero or more times' },
    { pattern: /\.\+/, explanation: 'Matches any character (except newline) one or more times' },
    { pattern: /\[0-9\]\+/, explanation: 'Matches one or more digits' },
    { pattern: /\[a-zA-Z\]\+/, explanation: 'Matches one or more letters' },
    { pattern: /\(\?:([^)]+)\)/, explanation: 'Non-capturing group for alternatives: $1' },
    { pattern: /\\\\./, explanation: 'Matches a literal dot character' },
    { pattern: /\\\//, explanation: 'Matches a literal forward slash' },
    { pattern: /\?/, explanation: 'Makes the preceding element optional (0 or 1 times)' },
    { pattern: /\+/, explanation: 'Matches the preceding element one or more times' },
    { pattern: /\*/, explanation: 'Matches the preceding element zero or more times' }
  ]

  let remaining = regex
  while (remaining.length > 0) {
    let matched = false
    for (const { pattern, explanation } of explanations) {
      const match = remaining.match(pattern)
      if (match && match.index === 0) {
        parts.push({ pattern: match[0], explanation })
        remaining = remaining.slice(match[0].length)
        matched = true
        break
      }
    }
    if (!matched) {
      parts.push({ 
        pattern: remaining[0], 
        explanation: `Literal character: ${remaining[0]}` 
      })
      remaining = remaining.slice(1)
    }
  }

  const overall = `This pattern ${
    regex.startsWith('^') ? 'must match from the start' : 'can match anywhere'
  } and ${
    regex.endsWith('$') ? 'must match to the end' : 'can match partially'
  } of the string.`

  return { parts, overall, streamingInsights: streamingInsights.length > 0 ? streamingInsights : undefined }
}
