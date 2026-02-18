export interface GeminiQueryResult {
  answer: string
  suggestions?: string[]
  relatedLinks?: string[]
}

const MEDIA_EXPERT_PERSONA = `You are an expert media streaming and IPTV specialist with deep knowledge of:
- IPTV playlist formats (M3U, M3U8, XSPF, PLS, ASX, WPL, SMIL, etc.)
- Streaming protocols (HTTP, HTTPS, HLS, DASH, RTSP, RTMP, UDP, RTP, MMS, MMSH, etc.)
- Media file formats and containers (MP4, MKV, AVI, FLV, TS, MPG, WEBM, etc.)
- Xtream Codes API systems and authentication
- EPG (Electronic Program Guide) data and XML formats
- Kodi media center addons, repositories, and configurations
- Android IPTV applications and APK structures
- Repository structures on GitHub, GitLab, Bitbucket, etc.
- Where to find media links in various file types
- Common patterns in IPTV service URLs and endpoints
- Playlist authentication methods and credentials
- Content classification (movies, TV series, live TV, VOD)

When answering questions:
- Be specific and technical when discussing URLs, file formats, and protocols
- Provide actionable advice for finding or extracting media links
- Suggest common locations where media resources might be found
- Explain authentication requirements when relevant
- Help identify content types based on URL patterns or metadata
- Stay focused on media streaming, playlists, and IPTV topics

If asked about non-media-related topics, politely redirect to your area of expertise.`

export async function queryGemini(
  question: string,
  context?: {
    scannedFiles?: number
    foundLinks?: number
    contentTypes?: { movies: number; tvSeries: number; liveTV: number }
    recentUrls?: string[]
  }
): Promise<GeminiQueryResult> {
  const contextPrompt = context ? `

Current scan context:
${context.scannedFiles ? `- Scanned ${context.scannedFiles} files` : ''}
${context.foundLinks ? `- Found ${context.foundLinks} media links` : ''}
${context.contentTypes ? `- Content: ${context.contentTypes.movies} movies, ${context.contentTypes.tvSeries} TV series, ${context.contentTypes.liveTV} live TV` : ''}
${context.recentUrls && context.recentUrls.length > 0 ? `- Recent URLs found:\n${context.recentUrls.slice(0, 3).map(url => `  * ${url}`).join('\n')}` : ''}
` : ''

  const fullPrompt = `${MEDIA_EXPERT_PERSONA}

User question: ${question}${contextPrompt}

Provide a helpful, technical answer focused on media streaming and IPTV. If relevant, suggest specific actions the user can take with this scanner tool.`

  try {
    const response = await window.spark.llm(fullPrompt, 'gemini-2.5-flash')
    
    return {
      answer: response,
      suggestions: extractSuggestions(response),
      relatedLinks: extractLinks(response)
    }
  } catch (error) {
    console.error('Gemini query error:', error)
    throw new Error('Failed to query Gemini assistant')
  }
}

export async function analyzeUrl(url: string): Promise<GeminiQueryResult> {
  const prompt = `${MEDIA_EXPERT_PERSONA}

Analyze this URL and provide insights:
${url}

Tell me:
1. What type of media resource is this likely to be? (playlist, direct stream, API endpoint, etc.)
2. What protocol or format is being used?
3. Is this typically associated with movies, TV series, or live TV?
4. Are there any authentication requirements I should be aware of?
5. What would be the best way to access or scan this resource?

Be specific and technical.`

  try {
    const response = await window.spark.llm(prompt, 'gemini-2.5-flash')
    
    return {
      answer: response,
      suggestions: extractSuggestions(response)
    }
  } catch (error) {
    console.error('Gemini URL analysis error:', error)
    throw new Error('Failed to analyze URL')
  }
}

export async function suggestScanStrategy(
  fileType: string,
  fileName?: string
): Promise<GeminiQueryResult> {
  const prompt = `${MEDIA_EXPERT_PERSONA}

I have a ${fileType} file${fileName ? ` named "${fileName}"` : ''}.

What's the best strategy to extract media links from this type of file? Consider:
1. What patterns or formats should I look for?
2. Are there specific sections or fields where links are typically found?
3. What authentication or decoding might be required?
4. Are there any gotchas or edge cases I should watch for?

Provide specific, actionable guidance.`

  try {
    const response = await window.spark.llm(prompt, 'gemini-2.5-flash')
    
    return {
      answer: response,
      suggestions: extractSuggestions(response)
    }
  } catch (error) {
    console.error('Gemini scan strategy error:', error)
    throw new Error('Failed to get scan strategy')
  }
}

export async function explainContentType(
  url: string,
  detectedType?: string,
  metadata?: { title?: string; category?: string }
): Promise<GeminiQueryResult> {
  const metadataStr = metadata ? `
Title: ${metadata.title || 'unknown'}
Category: ${metadata.category || 'unknown'}` : ''

  const prompt = `${MEDIA_EXPERT_PERSONA}

I found this URL:
${url}

${detectedType ? `My scanner detected it as: ${detectedType}` : 'Type is unknown'}${metadataStr}

Based on the URL pattern and metadata, what type of content is this really (movie, TV series, or live TV)? 
Explain the reasoning behind your classification.
If my scanner got it wrong, what would be the correct classification and why?

Be specific about URL patterns and naming conventions.`

  try {
    const response = await window.spark.llm(prompt, 'gemini-2.5-flash')
    
    return {
      answer: response,
      suggestions: extractSuggestions(response)
    }
  } catch (error) {
    console.error('Gemini content type explanation error:', error)
    throw new Error('Failed to explain content type')
  }
}

export async function findPlaylistSources(query: string): Promise<GeminiQueryResult> {
  const prompt = `${MEDIA_EXPERT_PERSONA}

User is looking for: ${query}

Suggest specific places or methods to find playlists or media sources for this. Consider:
1. Common repository locations (GitHub, GitLab, etc.)
2. File extensions and naming patterns to search for
3. API endpoints or services that might provide this content
4. Kodi addons or repositories that specialize in this type of content
5. What authentication or credentials might be needed

Provide specific, actionable suggestions. Focus on legal and ethical sources.`

  try {
    const response = await window.spark.llm(prompt, 'gemini-2.5-flash')
    
    return {
      answer: response,
      suggestions: extractSuggestions(response),
      relatedLinks: extractLinks(response)
    }
  } catch (error) {
    console.error('Gemini playlist sources error:', error)
    throw new Error('Failed to find playlist sources')
  }
}

function extractSuggestions(text: string): string[] {
  const suggestions: string[] = []
  
  const numberedPattern = /^\d+\.\s+(.+)$/gm
  let match
  while ((match = numberedPattern.exec(text)) !== null) {
    if (match[1] && match[1].length > 10 && match[1].length < 200) {
      suggestions.push(match[1].trim())
    }
  }
  
  const bulletPattern = /^[•\-*]\s+(.+)$/gm
  while ((match = bulletPattern.exec(text)) !== null) {
    if (match[1] && match[1].length > 10 && match[1].length < 200) {
      suggestions.push(match[1].trim())
    }
  }
  
  return suggestions.slice(0, 5)
}

function extractLinks(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g
  const matches = text.match(urlPattern)
  return matches ? [...new Set(matches)].slice(0, 5) : []
}
