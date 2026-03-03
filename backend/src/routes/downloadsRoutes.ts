/**
 * Downloads Routes
 * 
 * REST API endpoints for download monitoring, metadata extraction and management
 * - Monitor downloads in real-time
 * - Get download metadata and status
 * - Extract and manage images
 * - Enrich with metadata from providers
 */

import { Router, Request, Response } from 'express'
import { DownloadMonitor, type DownloadMetadata } from '../services/DownloadMonitor.js'
import { MediaExtractor } from '../services/MediaExtractor.js'
import * as path from 'path'
import * as fs from 'fs'

// Type for stored media items
interface StoredMediaItem {
  id: string
  title: string
  url: string
  indexer: string
  size: number
  seeders: number
  leechers: number
  contentType?: 'movie' | 'series' | 'live-tv'
  genre?: string[]
  confidence: 'high' | 'medium' | 'low'
  processedAt: number
  source?: string
}

const router = Router()

// Initialize download monitor (can be configured via env vars or request)
let downloadMonitor: DownloadMonitor | null = null
const mediaExtractor = new MediaExtractor()

/**
 * POST /api/downloads/start
 * Start monitoring downloads from a directory
 */
router.post('/start', (req: Request, res: Response) => {
  try {
    const { downloadDir, monitorInterval = 5000 } = req.body

    if (!downloadDir) {
      return res.status(400).json({ error: 'downloadDir is required' })
    }

    if (!fs.existsSync(downloadDir)) {
      return res.status(400).json({ error: `Directory does not exist: ${downloadDir}` })
    }

    // Stop existing monitor if running
    if (downloadMonitor) {
      downloadMonitor.stop()
    }

    // Create and start new monitor
    downloadMonitor = new DownloadMonitor({
      downloadDir,
      monitorInterval,
      maxConcurrentProcessing: 3,
      extractImages: true,
      enrichMetadata: true
    })

    // Set up event handlers
    downloadMonitor.on('fileDetected', (event: Record<string, unknown>) => {
      console.log('📥 File detected event:', event)
    })

    downloadMonitor.on('fileProcessed', (metadata: DownloadMetadata) => {
      console.log('✅ File processed:', metadata.filename)
      // Note: Storage is handled via POST /downloads/:id/store endpoint
    })

    downloadMonitor.start()

    res.json({
      message: 'Download monitoring started',
      directory: downloadDir,
      monitorInterval
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: errorMsg })
  }
})

/**
 * POST /api/downloads/stop
 * Stop monitoring downloads
 */
router.post('/stop', (req: Request, res: Response) => {
  if (!downloadMonitor) {
    return res.status(400).json({ error: 'Monitor not running' })
  }

  downloadMonitor.stop()
  downloadMonitor = null

  res.json({ message: 'Download monitoring stopped' })
})

/**
 * GET /api/downloads/status
 * Get current monitoring status and statistics
 */
router.get('/status', (req: Request, res: Response) => {
  if (!downloadMonitor) {
    return res.json({
      running: false,
      message: 'Monitor not running'
    })
  }

  const stats = downloadMonitor.getStats()

  res.json({
    running: true,
    stats
  })
})

/**
 * GET /api/downloads/list
 * Get all monitored downloads with metadata
 */
router.get('/list', (req: Request, res: Response) => {
  if (!downloadMonitor) {
    return res.json({ downloads: [] })
  }

  const metadata = downloadMonitor.getAllMetadata()

  res.json({
    total: metadata.length,
    processed: metadata.filter(m => m.processed).length,
    downloads: metadata
  })
})

/**
 * GET /api/downloads/processed
 * Get only processed downloads with full metadata
 */
router.get('/processed', (req: Request, res: Response) => {
  if (!downloadMonitor) {
    return res.json({ downloads: [] })
  }

  const metadata = downloadMonitor.getProcessedFiles()

  res.json({
    total: metadata.length,
    downloads: metadata
  })
})

/**
 * GET /api/downloads/:id
 * Get specific download metadata
 */
router.get('/:id', (req: Request, res: Response) => {
  if (!downloadMonitor) {
    return res.status(400).json({ error: 'Monitor not running' })
  }

  const { id } = req.params
  const all = downloadMonitor.getAllMetadata()
  const metadata = all.find(m => m.id === id)

  if (!metadata) {
    return res.status(404).json({ error: 'Download not found' })
  }

  res.json(metadata)
})

/**
 * POST /api/downloads/extract-metadata
 * Manually extract metadata from a file
 */
router.post('/extract-metadata', async (req: Request, res: Response) => {
  try {
    const { filepath } = req.body

    if (!filepath || !fs.existsSync(filepath)) {
      return res.status(400).json({ error: 'Valid filepath required' })
    }

    const videoMetadata = await mediaExtractor.extractVideoMetadata(filepath)
    const query = mediaExtractor.buildMetadataQuery(filepath)
    const contentType = mediaExtractor.detectContentType(filepath)

    res.json({
      metadata: videoMetadata,
      query,
      contentType
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: errorMsg })
  }
})

/**
 * POST /api/downloads/:id/extract-screenshots
 * Extract screenshots from a downloaded video
 */
router.post('/:id/extract-screenshots', async (req: Request, res: Response) => {
  try {
    if (!downloadMonitor) {
      return res.status(400).json({ error: 'Monitor not running' })
    }

    const { id } = req.params
    const { count = 3 } = req.body

    const all = downloadMonitor.getAllMetadata()
    const metadata = all.find(m => m.id === id)

    if (!metadata) {
      return res.status(404).json({ error: 'Download not found' })
    }

    if (!fs.existsSync(metadata.filepath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    const outputDir = path.join(path.dirname(metadata.filepath), `.thumbnails/${id}`)
    const screenshots = await mediaExtractor.extractScreenshots(
      metadata.filepath,
      outputDir,
      count
    )

    metadata.screenshots = screenshots

    res.json({
      id,
      filename: metadata.filename,
      screenshots,
      count: screenshots.length
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: errorMsg })
  }
})

/**
 * GET /api/downloads/:id/screenshot/:index
 * Get specific screenshot
 */
router.get('/:id/screenshot/:index', (req: Request, res: Response) => {
  try {
    if (!downloadMonitor) {
      return res.status(400).json({ error: 'Monitor not running' })
    }

    const { id, index } = req.params
    const all = downloadMonitor.getAllMetadata()
    const metadata = all.find(m => m.id === id)

    if (!metadata || !metadata.screenshots) {
      return res.status(404).json({ error: 'Screenshot not found' })
    }

    const idx = parseInt(String(index)) - 1
    const screenshot = metadata.screenshots[idx]

    if (!screenshot || !fs.existsSync(screenshot)) {
      return res.status(404).json({ error: 'Screenshot not found' })
    }

    res.sendFile(screenshot)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: errorMsg })
  }
})

/**
 * POST /api/downloads/:id/store
 * Mark download as stored and return data for frontend to persist
 */
router.post('/:id/store', (req: Request, res: Response) => {
  try {
    if (!downloadMonitor) {
      return res.status(400).json({ error: 'Monitor not running' })
    }

    const { id } = req.params
    const all = downloadMonitor.getAllMetadata()
    const metadata = all.find(m => m.id === id)

    if (!metadata) {
      return res.status(404).json({ error: 'Download not found' })
    }

    // Mark as stored and return data for frontend to persist
    metadata.stored = true

    const storedItem: StoredMediaItem = {
      id: metadata.id,
      title: metadata.mediaTitle || metadata.filename,
      url: `file://${metadata.filepath}`,
      indexer: 'download-monitor',
      size: metadata.filesize,
      seeders: 0,
      leechers: 0,
      contentType: metadata.mediaType === 'series' ? 'series' :
                   metadata.mediaType === 'live-tv' ? 'live-tv' : 'movie',
      genre: metadata.genres,
      confidence: metadata.confidence,
      processedAt: metadata.completedAt,
      source: 'local-download'
    }

    res.json({
      message: 'Download metadata ready to store',
      id,
      title: metadata.mediaTitle,
      storedItem
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: errorMsg })
  }
})

/**
 * GET /api/downloads/stats/summary
 * Get comprehensive statistics about downloads
 */
router.get('/stats/summary', (req: Request, res: Response) => {
  if (!downloadMonitor) {
    return res.json({
      running: false,
      stats: { totalMonitored: 0 }
    })
  }

  const all = downloadMonitor.getAllMetadata()
  const stats = downloadMonitor.getStats()

  const byType = {
    movies: all.filter(m => m.mediaType === 'movie').length,
    series: all.filter(m => m.mediaType === 'series').length,
    liveTV: all.filter(m => m.mediaType === 'live-tv').length,
    unknown: all.filter(m => !m.mediaType).length
  }

  const totalSize = all.reduce((sum, m) => sum + m.filesize, 0)

  res.json({
    running: true,
    stats,
    byType,
    totalSize,
    averageSize: all.length > 0 ? totalSize / all.length : 0,
    hasProcessingErrors: all.some(m => m.errors && m.errors.length > 0)
  })
})

export default router
