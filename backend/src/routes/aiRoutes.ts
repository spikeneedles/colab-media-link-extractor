import { Router, Request, Response } from 'express'
import { GeminiService } from '../geminiService.js'

const router = Router()
const geminiService = new GeminiService()

/**
 * POST /api/ai/analyze
 * Analyze content using Gemini 2.5 Flash
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    if (!geminiService.isConfigured()) {
      return res.status(503).json({
        error: 'Gemini service not configured',
        message: 'Set GEMINI_API_KEY environment variable to enable AI features',
      })
    }

    const { text, context, analysisType } = req.body

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text field is required and must be a string' })
    }

    const result = await geminiService.analyzeContent({
      text,
      context,
      analysisType,
    })

    res.json(result)
  } catch (error) {
    console.error('Analysis error:', error)
    res.status(500).json({
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * POST /api/ai/generate
 * Generate content using Gemini 2.5 Flash
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    if (!geminiService.isConfigured()) {
      return res.status(503).json({
        error: 'Gemini service not configured',
        message: 'Set GEMINI_API_KEY environment variable to enable AI features',
      })
    }

    const { prompt, context, generationType, temperature, maxTokens } = req.body

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt field is required and must be a string' })
    }

    const result = await geminiService.generateContent({
      prompt,
      context,
      generationType,
      temperature: temperature ? parseFloat(temperature) : undefined,
      maxTokens: maxTokens ? parseInt(maxTokens) : undefined,
    })

    res.json(result)
  } catch (error) {
    console.error('Generation error:', error)
    res.status(500).json({
      error: 'Generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * POST /api/ai/analyze-links
 * Analyze links and extract patterns
 */
router.post('/analyze-links', async (req: Request, res: Response) => {
  try {
    if (!geminiService.isConfigured()) {
      return res.status(503).json({
        error: 'Gemini service not configured',
        message: 'Set GEMINI_API_KEY environment variable to enable AI features',
      })
    }

    const { links } = req.body

    if (!Array.isArray(links) || links.length === 0) {
      return res.status(400).json({ error: 'links must be an array with at least one URL' })
    }

    const result = await geminiService.analyzeLinks(links)
    res.json(result)
  } catch (error) {
    console.error('Link analysis error:', error)
    res.status(500).json({
      error: 'Link analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * POST /api/ai/playlist-metadata
 * Generate playlist metadata using AI
 */
router.post('/playlist-metadata', async (req: Request, res: Response) => {
  try {
    if (!geminiService.isConfigured()) {
      return res.status(503).json({
        error: 'Gemini service not configured',
        message: 'Set GEMINI_API_KEY environment variable to enable AI features',
      })
    }

    const { urls, playlistName } = req.body

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'urls must be an array with at least one URL' })
    }

    const result = await geminiService.generatePlaylistMetadata(urls, playlistName)
    res.json(result)
  } catch (error) {
    console.error('Playlist metadata error:', error)
    res.status(500).json({
      error: 'Playlist metadata generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * GET /api/ai/status
 * Check Gemini service status
 */
router.get('/status', (req: Request, res: Response) => {
  const isConfigured = geminiService.isConfigured()

  res.json({
    service: 'Gemini 2.5 Flash',
    status: isConfigured ? 'configured' : 'not-configured',
    model: isConfigured ? 'gemini-2.5-flash' : null,
    configured: isConfigured,
    setupRequired: !isConfigured,
    setupSteps: !isConfigured ? [
      '1. Get your Gemini API key from https://aistudio.google.com/app/apikey',
      '2. Set GEMINI_API_KEY environment variable',
      '3. Restart the backend server',
      '4. AI endpoints will be available at /api/ai/*',
    ] : undefined,
    endpoints: isConfigured ? {
      'POST /api/ai/analyze': 'Analyze content using Gemini',
      'POST /api/ai/generate': 'Generate content using Gemini',
      'POST /api/ai/analyze-links': 'Analyze links and extract patterns',
      'POST /api/ai/playlist-metadata': 'Generate playlist metadata',
      'GET /api/ai/status': 'Service status',
    } : undefined,
  })
})

export default router
