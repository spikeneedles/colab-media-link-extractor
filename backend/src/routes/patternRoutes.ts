import express, { Router, Request, Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'

const router = Router()

/**
 * POST /api/ai/generate-patterns
 * Pattern generation is now handled on the frontend using Gemini via Spark
 * This endpoint remains for backward compatibility but returns a helpful message
 */
router.post('/generate-patterns', async (req: Request, res: Response) => {
  res.status(410).json({
    error: 'This endpoint has been migrated to frontend',
    message: 'Pattern generation now uses Gemini AI on the frontend. Please update your client to use the frontend pattern generator.',
    migration: 'Frontend uses @/lib/patternGenerator with Gemini 2.5 Flash'
  })
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
        // Stats are now calculated on the frontend
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
 * Get statistics (now handled on frontend, kept for compatibility)
 */
router.get('/stats', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Stats are now calculated on the frontend',
    stats: { totalUrls: 0, uniqueDomains: 0, fileExtensions: {}, protocols: {} },
    collectedUrls: 0,
  })
})

/**
 * GET /api/patterns/collected
 * Get all collected URLs (now handled on frontend, kept for compatibility)
 */
router.get('/collected', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'URL collection is now handled on the frontend',
    urls: [],
    count: 0,
  })
})

/**
 * POST /api/patterns/add-urls
 * Add URLs (now handled on frontend, kept for compatibility)
 */
router.post('/add-urls', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'URL collection is now handled on the frontend',
    added: 0,
    totalCollected: 0,
  })
})

/**
 * POST /api/patterns/clear
 * Clear URLs (now handled on frontend, kept for compatibility)
 */
router.post('/clear', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'URL collection is now handled on the frontend',
  })
})

export default router
