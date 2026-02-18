import express, { Router, Request, Response } from 'express'
import AIPatternGenerator from '../aiPatternGenerator'
import * as fs from 'fs'
import * as path from 'path'

const router = Router()
const patternGenerator = new AIPatternGenerator()

/**
 * POST /api/ai/generate-patterns
 * Generate patterns from collected URLs
 */
router.post('/generate-patterns', async (req: Request, res: Response) => {
  try {
    const { urls } = req.body

    if (!Array.isArray(urls) || urls.length < 3) {
      return res.status(400).json({
        error: 'Need at least 3 URLs to generate patterns',
      })
    }

    // Add URLs to the generator
    patternGenerator.addUrls(urls)

    // Generate patterns
    const patterns = await patternGenerator.analyzeAndGeneratePatterns()

    res.json({
      success: true,
      patterns,
      stats: patternGenerator.getStats(),
    })
  } catch (error) {
    console.error('Pattern generation error:', error)
    res.status(500).json({
      error: 'Failed to generate patterns',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * POST /api/patterns/save
 * Save patterns to JSON file
 */
router.post('/save', async (req: Request, res: Response) => {
  try {
    const { type, patterns } = req.body

    if (!type || !Array.isArray(patterns)) {
      return res.status(400).json({
        error: 'Invalid request: type and patterns array required',
      })
    }

    const fileName = type === 'ai-generated' ? 'patterns-ai-generated.json' : 'patterns-human.json'
    const filePath = path.join(process.cwd(), 'data', fileName)

    // Ensure data directory exists
    const dataDir = path.dirname(filePath)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    // Load existing patterns
    let existingData = { metadata: {}, patterns: [] }
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        existingData = JSON.parse(content)
      } catch (error) {
        console.warn('Failed to parse existing patterns file')
      }
    }

    // Merge patterns (avoid duplicates)
    const patternIds = new Set((existingData.patterns || []).map((p: any) => p.id))
    const newPatterns = patterns.filter((p: any) => !patternIds.has(p.id))
    const allPatterns = [...(existingData.patterns || []), ...newPatterns]

    // Create the final structure
    const data = {
      version: '1.0.0',
      metadata: {
        type,
        lastUpdated: new Date().toISOString(),
        totalPatterns: allPatterns.length,
        description:
          type === 'ai-generated'
            ? 'AI-generated patterns learned from URLs'
            : 'Community and user-created patterns',
        learningStats:
          type === 'ai-generated' ? patternGenerator.getStats() : undefined,
      },
      patterns: allPatterns,
    }

    // Write to file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))

    res.json({
      success: true,
      savedCount: newPatterns.length,
      totalPatterns: allPatterns.length,
      filePath,
    })
  } catch (error) {
    console.error('Pattern save error:', error)
    res.status(500).json({
      error: 'Failed to save patterns',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * GET /api/patterns/stats
 * Get statistics about collected URLs
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = patternGenerator.getStats()
    res.json({
      success: true,
      stats,
      collectedUrls: patternGenerator.getCollectedUrls().length,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * GET /api/patterns/collected
 * Get all collected URLs
 */
router.get('/collected', (req: Request, res: Response) => {
  try {
    const urls = patternGenerator.getCollectedUrls()
    res.json({
      success: true,
      urls,
      count: urls.length,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get collected URLs',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * POST /api/patterns/add-urls
 * Add URLs to the collection
 */
router.post('/add-urls', (req: Request, res: Response) => {
  try {
    const { urls } = req.body

    if (!Array.isArray(urls)) {
      return res.status(400).json({
        error: 'URLs must be an array',
      })
    }

    patternGenerator.addUrls(urls)

    res.json({
      success: true,
      added: urls.length,
      totalCollected: patternGenerator.getCollectedUrls().length,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to add URLs',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * POST /api/patterns/clear
 * Clear collected URLs
 */
router.post('/clear', (req: Request, res: Response) => {
  try {
    patternGenerator.clearCollectedUrls()
    res.json({
      success: true,
      message: 'Collected URLs cleared',
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to clear URLs',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

export default router
