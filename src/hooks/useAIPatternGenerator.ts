import { useState, useCallback, useRef } from 'react'

interface Pattern {
  id: string
  name: string
  description: string
  category: 'url-filter' | 'scraping-rule' | 'pagination-rule' | 'provider-preset' | 'crawl-config'
  pattern: string | object
  tags: string[]
  exampleUrls: string[]
  confidence: number
  createdBy: string
  createdAt: string
}

export function useAIPatternGenerator() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedPatterns, setGeneratedPatterns] = useState<Pattern[]>([])
  const [error, setError] = useState<string | null>(null)
  const collectedUrlsRef = useRef<Set<string>>(new Set())

  /**
   * Add a URL to the learning pool
   */
  const addUrl = useCallback((url: string) => {
    if (url && url.startsWith('http')) {
      collectedUrlsRef.current.add(url)
    }
  }, [])

  /**
   * Add multiple URLs to the learning pool
   */
  const addUrls = useCallback((urls: string[]) => {
    urls.forEach((url) => addUrl(url))
  }, [addUrl])

  /**
   * Generate patterns from collected URLs using frontend Gemini integration
   */
  const generatePatterns = useCallback(async () => {
    if (collectedUrlsRef.current.size < 3) {
      setError('Need at least 3 unique URLs to generate meaningful patterns')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      // Use frontend pattern generation (no backend API call needed)
      const { generatePatternWithAI } = await import('@/lib/patternGenerator')
      const urls = Array.from(collectedUrlsRef.current)
      const examples = urls.map(url => ({ url, shouldMatch: true }))
      
      const generatedPattern = await generatePatternWithAI(
        examples,
        'Generate a pattern to match these media streaming URLs'
      )

      // Convert the single pattern to the expected format
      const pattern: Pattern = {
        id: `ai-gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: generatedPattern.description.split(':')[0] || 'AI Generated Pattern',
        description: generatedPattern.description,
        category: 'url-filter',
        pattern: generatedPattern.regex,
        tags: ['ai-generated', 'gemini'],
        exampleUrls: generatedPattern.examples.matching,
        confidence: generatedPattern.confidence,
        createdBy: 'ai-gemini',
        createdAt: new Date().toISOString(),
      }

      setGeneratedPatterns([pattern])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsGenerating(false)
    }
  }, [])

  /**
   * Save generated patterns to file
   */
  const savePatterns = useCallback(async (patterns: Pattern[]) => {
    try {
      const response = await fetch('/api/patterns/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ai-generated',
          patterns,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save patterns')
      }

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save patterns')
      return false
    }
  }, [])

  /**
   * Get statistics about collected URLs
   */
  const getStats = useCallback(() => {
    const urls = Array.from(collectedUrlsRef.current)
    const extensions: Record<string, number> = {}
    const protocols: Record<string, number> = {}
    const domains: Set<string> = new Set()

    urls.forEach((url) => {
      try {
        const urlObj = new URL(url)
        const ext = url.match(/\.([a-z0-9]{2,5})(?:\?|$)/i)?.[1] || 'no-ext'
        const protocol = urlObj.protocol.replace(':', '')

        extensions[ext] = (extensions[ext] || 0) + 1
        protocols[protocol] = (protocols[protocol] || 0) + 1
        domains.add(urlObj.hostname || 'unknown')
      } catch (error) {
        // Skip invalid URLs
      }
    })

    return {
      totalUrls: urls.length,
      uniqueDomains: domains.size,
      fileExtensions: extensions,
      protocols,
    }
  }, [])

  /**
   * Clear collected URLs
   */
  const clearUrls = useCallback(() => {
    collectedUrlsRef.current.clear()
  }, [])

  /**
   * Get all collected URLs
   */
  const getCollectedUrls = useCallback(() => {
    return Array.from(collectedUrlsRef.current)
  }, [])

  return {
    addUrl,
    addUrls,
    generatePatterns,
    savePatterns,
    getStats,
    clearUrls,
    getCollectedUrls,
    isGenerating,
    generatedPatterns,
    error,
  }
}

export default useAIPatternGenerator
