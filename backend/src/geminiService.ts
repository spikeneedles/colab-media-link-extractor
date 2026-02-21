import { GoogleGenerativeAI, GenerativeModel, Content, Part } from '@google/generative-ai'

export interface GeminiAnalysisRequest {
  text: string
  context?: string
  analysisType?: 'links' | 'patterns' | 'content' | 'custom'
}

export interface GeminiAnalysisResponse {
  result: string
  model: string
  tokensUsed?: number
  timestamp: string
}

export interface GeminiGenerateRequest {
  prompt: string
  context?: string
  generationType?: 'patterns' | 'playlist' | 'description' | 'custom'
  temperature?: number
  maxTokens?: number
}

export interface GeminiGenerateResponse {
  content: string
  model: string
  timestamp: string
}

export class GeminiService {
  private client: GoogleGenerativeAI | null = null
  private model: GenerativeModel | null = null
  private apiKey: string
  private modelName: string

  constructor(apiKey?: string, modelName: string = 'gemini-2.5-flash') {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || ''
    this.modelName = modelName || process.env.GEMINI_MODEL || 'gemini-2.5-flash'

    if (this.apiKey) {
      this.client = new GoogleGenerativeAI(this.apiKey)
      this.model = this.client.getGenerativeModel({ model: this.modelName })
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && !!this.client && !!this.model
  }

  /**
   * Analyze text content using Gemini
   */
  async analyzeContent(request: GeminiAnalysisRequest): Promise<GeminiAnalysisResponse> {
    if (!this.model) {
      throw new Error('Gemini service not configured. Set GEMINI_API_KEY environment variable.')
    }

    const systemPrompt = this.getSystemPrompt(request.analysisType)
    const fullPrompt = request.context 
      ? `Context: ${request.context}\n\nContent to analyze:\n${request.text}`
      : request.text

    try {
      const result = await this.model.generateContent([
        { text: systemPrompt },
        { text: fullPrompt },
      ])

      const response = result.response.text()

      return {
        result: response,
        model: this.modelName,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      throw new Error(`Gemini analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate content using Gemini
   */
  async generateContent(request: GeminiGenerateRequest): Promise<GeminiGenerateResponse> {
    if (!this.model) {
      throw new Error('Gemini service not configured. Set GEMINI_API_KEY environment variable.')
    }

    const systemPrompt = this.getGenerationPrompt(request.generationType)
    const fullPrompt = request.context
      ? `Context: ${request.context}\n\nRequest: ${request.prompt}`
      : request.prompt

    try {
      const result = await this.model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'user', parts: [{ text: fullPrompt }] }
        ],
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens ?? 1024,
        }
      })

      const response = result.response.text()

      return {
        content: response,
        model: this.modelName,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      throw new Error(`Gemini generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Analyze links and extract patterns
   */
  async analyzeLinks(links: string[]): Promise<{
    patterns: string[]
    analysis: string
    timestamp: string
  }> {
    if (!this.model) {
      throw new Error('Gemini service not configured. Set GEMINI_API_KEY environment variable.')
    }

    const linksText = links.join('\n')
    const prompt = `Analyze these URLs and identify common patterns, URL structures, and naming conventions:

${linksText}

Provide:
1. List of identified patterns (regex patterns or wildcard patterns)
2. Analysis of the URL structure
3. Suggestions for pattern matching`

    try {
      const result = await this.model.generateContent(prompt)
      const response = result.response.text()

      // Try to extract patterns from the response
      const patternMatches = response.match(/pattern[s]?:?\s*(.+?)(?:\n|$)/gi) || []
      const patterns = patternMatches.map(p => p.replace(/pattern[s]?:?\s*/i, '').trim())

      return {
        patterns: patterns.length > 0 ? patterns : [response.split('\n')[0]],
        analysis: response,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      throw new Error(`Link analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate playlist metadata
   */
  async generatePlaylistMetadata(urls: string[], playlistName?: string): Promise<{
    description: string
    categories: string[]
    suggest: string
    timestamp: string
  }> {
    if (!this.model) {
      throw new Error('Gemini service not configured. Set GEMINI_API_KEY environment variable.')
    }

    const sampledUrls = urls.slice(0, 10).join('\n')
    const prompt = `Based on these media stream URLs, generate metadata:

${sampledUrls}

Provide:
1. A brief description of the playlist (1-2 sentences)
2. Suggested categories/genres (comma-separated)
3. Additional suggestions for playlist enhancement

${playlistName ? `\nPlaylist name: ${playlistName}` : ''}`

    try {
      const result = await this.model.generateContent(prompt)
      const response = result.response.text()
      const lines = response.split('\n').filter(l => l.trim())

      return {
        description: lines[0] || 'Media Playlist',
        categories: lines[1]?.split(',').map(c => c.trim()) || [],
        suggest: lines.slice(2).join('\n'),
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      throw new Error(`Playlist metadata generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Stream content generation (for real-time responses)
   */
  async *streamGenerateContent(prompt: string): AsyncGenerator<string> {
    if (!this.model) {
      throw new Error('Gemini service not configured. Set GEMINI_API_KEY environment variable.')
    }

    try {
      const result = await this.model.generateContentStream(prompt)

      for await (const chunk of result.stream) {
        const text = chunk.text()
        if (text) {
          yield text
        }
      }
    } catch (error) {
      throw new Error(`Stream generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private getSystemPrompt(analysisType?: string): string {
    const prompts: Record<string, string> = {
      links: 'You are an expert at analyzing URLs and media link patterns. Identify structures, common traits, and provide actionable insights.',
      patterns: 'You are a pattern recognition expert. Analyze the given content and identify meaningful patterns, rules, and regex expressions.',
      content: 'You are a content analyst. Analyze the provided content and extract key information, metadata, and insights.',
      custom: 'You are a helpful AI assistant specialized in media scanning and analysis.',
    }
    return prompts[analysisType || 'custom'] || prompts.custom
  }

  private getGenerationPrompt(generationType?: string): string {
    const prompts: Record<string, string> = {
      patterns: 'You are a URL pattern expert. Generate useful regex patterns and wildcard patterns based on the context provided.',
      playlist: 'You are a playlist curator. Generate helpful metadata, descriptions, and suggestions based on the provided media links.',
      description: 'You are a content writer. Generate clear, concise descriptions based on the provided context.',
      custom: 'You are a helpful AI assistant.',
    }
    return prompts[generationType || 'custom'] || prompts.custom
  }
}

export default GeminiService
