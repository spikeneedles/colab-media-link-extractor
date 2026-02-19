import express, { Router, Request, Response } from 'express'
import DomainCrawler from '../domainCrawler.js'

const router = Router()

// Initialize crawler
const crawler = new DomainCrawler(100, 3)

// In-memory store for connected extensions and captured media
const extensionSessions: Map<
  string,
  {
    id: string
    name: string
    connectedAt: Date
    lastHeartbeat: Date
    capturedMedia: Array<{
      id: string
      url: string
      title?: string
      timestamp: Date
      crawlSessionId?: string
      metadata?: Record<string, any>
    }>
  }
> = new Map()

const capturedMediaEvents: Array<{
  sessionId: string
  url: string
  title?: string
  timestamp: Date
  metadata?: Record<string, any>
}> = []

// Track crawl sessions
const crawlSessions: Map<
  string,
  {
    mediaId: string
    sessionId: string
    startedAt: Date
    status: string
    progress: number
  }
> = new Map()

/**
 * POST /api/extension/register
 * Register a new extension instance
 */
router.post('/register', (req: Request, res: Response) => {
  try {
    const { extensionId, name } = req.body

    if (!extensionId) {
      return res.status(400).json({ error: 'extensionId required' })
    }

    const sessionId = extensionId
    const session = {
      id: sessionId,
      name: name || `Extension-${sessionId.substring(0, 8)}`,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      capturedMedia: [],
    }

    extensionSessions.set(sessionId, session)

    res.json({
      success: true,
      sessionId,
      message: 'Extension registered successfully',
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to register extension',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * POST /api/extension/heartbeat
 * Keep-alive signal from extension
 */
router.post('/heartbeat', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body

    if (!sessionId || !extensionSessions.has(sessionId)) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const session = extensionSessions.get(sessionId)!
    session.lastHeartbeat = new Date()

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({
      error: 'Heartbeat failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * POST /api/extension/capture
 * Capture media URL from extension and auto-crawl the domain
 */
router.post('/capture', async (req: Request, res: Response) => {
  try {
    const { sessionId, url, title, metadata } = req.body

    if (!sessionId || !url) {
      return res.status(400).json({ error: 'sessionId and url required' })
    }

    if (!extensionSessions.has(sessionId)) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const session = extensionSessions.get(sessionId)!
    const mediaItem: {
      id: string
      url: string
      title?: string
      timestamp: Date
      crawlSessionId?: string
      metadata?: Record<string, any>
    } = {
      id: `${sessionId}-${Date.now()}`,
      url,
      title,
      timestamp: new Date(),
      metadata,
    }

    session.capturedMedia.push(mediaItem)
    capturedMediaEvents.push({
      sessionId,
      url,
      title,
      timestamp: new Date(),
      metadata,
    })

    // Keep only last 100 events in memory
    if (capturedMediaEvents.length > 100) {
      capturedMediaEvents.shift()
    }

    // AUTO-START DOMAIN CRAWL
    const crawlSessionId = `crawl-${mediaItem.id}`
    const crawlSession = await crawler.startCrawl(crawlSessionId, url, title || 'Media Crawl')

    mediaItem.crawlSessionId = crawlSessionId
    crawlSessions.set(crawlSessionId, {
      mediaId: mediaItem.id,
      sessionId,
      startedAt: new Date(),
      status: 'crawling',
      progress: 0,
    })

    res.json({
      success: true,
      mediaId: mediaItem.id,
      crawlSessionId,
      message: 'Media captured and domain crawl started',
      crawlStatus: {
        status: crawlSession.status,
        progress: crawlSession.progress,
        domain: crawlSession.domain,
      },
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to capture media',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * GET /api/extension/sessions
 * List all active extension sessions
 */
router.get('/sessions', (req: Request, res: Response) => {
  try {
    const sessions = Array.from(extensionSessions.values()).map((session) => ({
      id: session.id,
      name: session.name,
      connectedAt: session.connectedAt,
      lastHeartbeat: session.lastHeartbeat,
      capturedCount: session.capturedMedia.length,
      isAlive: Date.now() - session.lastHeartbeat.getTime() < 30000,
    }))

    res.json({
      success: true,
      sessions,
      totalActive: sessions.filter((s) => s.isAlive).length,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get sessions',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * GET /api/extension/sessions/:sessionId/media
 * Get captured media from a session
 */
router.get('/sessions/:sessionId/media', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params as { sessionId: string }
    const { limit = 50, offset = 0 } = req.query

    if (!extensionSessions.has(sessionId)) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const session = extensionSessions.get(sessionId)!
    const media = session.capturedMedia
      .slice(-(Number(limit) + Number(offset)))
      .reverse()

    res.json({
      success: true,
      sessionId,
      media,
      total: session.capturedMedia.length,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get media',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * GET /api/extension/media/all
 * Get all captured media from all sessions
 */
router.get('/media/all', (req: Request, res: Response) => {
  try {
    const { limit = 100, offset = 0 } = req.query

    const allMedia = Array.from(extensionSessions.values())
      .flatMap((session) =>
        session.capturedMedia.map((media) => ({
          ...media,
          sessionId: session.id,
          sessionName: session.name,
        }))
      )
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(Number(offset), Number(offset) + Number(limit))

    res.json({
      success: true,
      media: allMedia,
      total: capturedMediaEvents.length,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get media',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * DELETE /api/extension/sessions/:sessionId
 * Disconnect an extension session
 */
router.delete('/sessions/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params as { sessionId: string }

    if (!extensionSessions.has(sessionId)) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const removed = extensionSessions.delete(sessionId)

    res.json({
      success: removed,
      message: 'Session disconnected',
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to disconnect',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * POST /api/extension/process
 * Process captured media with patterns and crawlers
 */
router.post('/process', (req: Request, res: Response) => {
  try {
    const { sessionId, mediaId, patterns, crawlerConfig } = req.body

    if (!sessionId || !mediaId) {
      return res.status(400).json({ error: 'sessionId and mediaId required' })
    }

    const session = extensionSessions.get(sessionId)
    const media = session?.capturedMedia.find((m) => m.id === mediaId)

    if (!media) {
      return res.status(404).json({ error: 'Media not found' })
    }

    // This would integrate with the crawler and pattern system
    // For now, return the URL and metadata
    res.json({
      success: true,
      media,
      readyForProcessing: true,
      message: 'Media ready for crawler processing',
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to process media',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * GET /api/extension/config
 * Get current extension configuration
 */
router.get('/config', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      config: {
        apiVersion: '1.0.0',
        endpoints: {
          register: '/api/extension/register',
          heartbeat: '/api/extension/heartbeat',
          capture: '/api/extension/capture',
          sessions: '/api/extension/sessions',
          media: '/api/extension/media/all',
          crawlStatus: '/api/extension/crawl/:crawlSessionId',
          crawlResults: '/api/extension/crawl/:crawlSessionId/results',
        },
        maxCaptureSize: 100,
        heartbeatInterval: 30000,
      },
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get config',
    })
  }
})

/**
 * GET /api/extension/crawl/:crawlSessionId
 * Get crawl status and progress
 */
router.get('/crawl/:crawlSessionId', (req: Request, res: Response) => {
  try {
    const { crawlSessionId } = req.params as { crawlSessionId: string }

    const crawlSession = crawler.getSession(crawlSessionId)

    if (!crawlSession) {
      return res.status(404).json({ error: 'Crawl session not found' })
    }

    res.json({
      success: true,
      crawlSessionId,
      status: crawlSession.status,
      progress: crawlSession.progress,
      domain: crawlSession.domain,
      discoveredUrls: crawlSession.discoveredUrls.size,
      mediaLinksFound: crawlSession.mediaLinks.size,
      pagesProcessed: crawlSession.results.length,
      startedAt: crawlSession.startedAt,
      completedAt: crawlSession.completedAt,
      error: crawlSession.error,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get crawl status',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * GET /api/extension/crawl/:crawlSessionId/results
 * Get discovered media links from crawl
 */
router.get('/crawl/:crawlSessionId/results', (req: Request, res: Response) => {
  try {
    const { crawlSessionId } = req.params as { crawlSessionId: string }
    const { limit = 50, offset = 0 } = req.query

    const crawlSession = crawler.getSession(crawlSessionId)

    if (!crawlSession) {
      return res.status(404).json({ error: 'Crawl session not found' })
    }

    const mediaLinks = crawler.getAllMediaLinks(crawlSessionId)
    const paginatedLinks = mediaLinks.slice(Number(offset), Number(offset) + Number(limit))

    res.json({
      success: true,
      crawlSessionId,
      status: crawlSession.status,
      mediaLinks: paginatedLinks,
      total: mediaLinks.length,
      offset: Number(offset),
      limit: Number(limit),
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get crawl results',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * GET /api/extension/crawl/:crawlSessionId/pages
 * Get all pages processed during crawl
 */
router.get('/crawl/:crawlSessionId/pages', (req: Request, res: Response) => {
  try {
    const { crawlSessionId } = req.params as { crawlSessionId: string }
    const { limit = 20, offset = 0 } = req.query

    const crawlSession = crawler.getSession(crawlSessionId)

    if (!crawlSession) {
      return res.status(404).json({ error: 'Crawl session not found' })
    }

    const results = crawler.getResults(crawlSessionId)
    const paginatedResults = results.slice(Number(offset), Number(offset) + Number(limit))

    res.json({
      success: true,
      crawlSessionId,
      pages: paginatedResults.map((r) => ({
        url: r.url,
        title: r.title,
        timestamp: r.timestamp,
        mediaLinksFound: r.mediaLinks.length,
        mediaLinks: r.mediaLinks.slice(0, 5), // Show first 5
      })),
      total: results.length,
      offset: Number(offset),
      limit: Number(limit),
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get crawl pages',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * POST /api/extension/crawl/:crawlSessionId/cancel
 * Cancel a running crawl
 */
router.post('/crawl/:crawlSessionId/cancel', (req: Request, res: Response) => {
  try {
    const { crawlSessionId } = req.params as { crawlSessionId: string }

    const cancelled = crawler.cancelCrawl(crawlSessionId)

    if (!cancelled) {
      return res.status(404).json({ error: 'Crawl session not found' })
    }

    res.json({
      success: true,
      message: 'Crawl cancelled',
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to cancel crawl',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

export default router
