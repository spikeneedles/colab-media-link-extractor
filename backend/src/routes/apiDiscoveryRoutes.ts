/**
 * API Discovery Routes
 * 
 * Exposes endpoints for:
 * - Searching metadata APIs (TMDb, TVDb, Trakt)
 * - Discovering torrents from databases
 * - Resolving streams via debrid services
 * - Enhanced crawling with API integration
 */

import { Router, Request, Response } from 'express'
import { apiProviderService } from '../services/ApiProviderService.js'
import { enhancedMediaCrawler } from '../services/EnhancedMediaCrawler.js'

const router = Router()

// ==================== Provider Management ====================

/**
 * GET /api/discovery/providers
 * List all configured API providers
 */
router.get('/providers', (req: Request, res: Response) => {
  try {
    const stats = apiProviderService.getStats()
    const providers = [
      ...apiProviderService.getProvidersByType('metadata'),
      ...apiProviderService.getProvidersByType('debrid'),
      ...apiProviderService.getProvidersByType('torrent-db'),
    ]

    res.json({
      success: true,
      stats,
      providers: providers.map(p => ({
        name: p.name,
        hostname: p.hostname,
        type: p.type,
        requiresAuth: p.requiresAuth,
        configured: !!p.apiKey || !p.requiresAuth,
      })),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * POST /api/discovery/providers/:hostname/configure
 * Configure API key for a provider
 */
router.post('/providers/:hostname/configure', (req: Request, res: Response) => {
  try {
    const { hostname } = req.params as { hostname: string }
    const { apiKey } = req.body as { apiKey: string }

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key is required',
      })
    }

    // Handle both string and string array types
    apiProviderService.setApiKey(
      hostname, 
      (Array.isArray(apiKey) ? apiKey[0] : apiKey) as unknown as string
    )

    res.json({
      success: true,
      message: `API key configured for ${hostname}`,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// ==================== Metadata Search ====================

/**
 * GET /api/discovery/search/metadata
 * Search for media across metadata providers (TMDb, TVDb, Trakt)
 */
router.get('/search/metadata', async (req: Request, res: Response) => {
  try {
    const { q, type } = req.query

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
      })
    }

    const mediaType = type === 'movie' || type === 'series' ? type : undefined

    const results = await apiProviderService.searchMedia(q, mediaType)

    res.json({
      success: true,
      query: q,
      type: mediaType || 'all',
      count: results.length,
      results,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// ==================== Torrent Search ====================

/**
 * GET /api/discovery/search/torrents
 * Search for torrents across torrent databases
 */
router.get('/search/torrents', async (req: Request, res: Response) => {
  try {
    const { q } = req.query

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
      })
    }

    const results = await apiProviderService.searchTorrents(q)

    res.json({
      success: true,
      query: q,
      count: results.length,
      results: results.sort((a, b) => b.seeders - a.seeders), // Sort by seeders
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// ==================== Debrid Resolution ====================

/**
 * POST /api/discovery/resolve/debrid
 * Resolve magnet link through debrid service
 */
router.post('/resolve/debrid', async (req: Request, res: Response) => {
  try {
    const { magnetUrl, service } = req.body

    if (!magnetUrl) {
      return res.status(400).json({
        success: false,
        error: 'magnetUrl is required',
      })
    }

    const validServices = ['real-debrid', 'alldebrid', 'premiumize']
    if (service && !validServices.includes(service)) {
      return res.status(400).json({
        success: false,
        error: `Invalid service. Must be one of: ${validServices.join(', ')}`,
      })
    }

    const stream = await apiProviderService.resolveDebridStream(magnetUrl, service)

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Could not resolve stream. Check debrid service configuration.',
      })
    }

    res.json({
      success: true,
      stream,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// ==================== Enhanced Discovery ====================

/**
 * POST /api/discovery/discover
 * Discover content by title with full API integration
 */
router.post('/discover', async (req: Request, res: Response) => {
  try {
    const { title, includeMetadata, includeTorrents, resolveStreams, debridService } = req.body

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'title is required',
      })
    }

    const result = await enhancedMediaCrawler.discoverByTitle(title, {
      includeMetadata,
      includeTorrents,
      resolveStreams,
      debridService,
    })

    res.json({
      success: true,
      ...result,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * POST /api/discovery/crawl/enhanced
 * Start enhanced crawl with API integration
 */
router.post('/crawl/enhanced', async (req: Request, res: Response) => {
  try {
    const { url, title, enrichMetadata, discoverTorrents, resolveDebrid, debridService } = req.body

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'url is required',
      })
    }

    const sessionId = `enhanced-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Start crawl asynchronously
    enhancedMediaCrawler
      .startEnhancedCrawl(sessionId, url, title, {
        enrichMetadata,
        discoverTorrents,
        resolveDebrid,
        debridService,
      })
      .then((result) => {
        console.log(`[ApiDiscovery] Enhanced crawl completed: ${sessionId}`)
        console.log(`[ApiDiscovery] API calls made: ${result.apiCallsMade}`)
        console.log(`[ApiDiscovery] Media enriched: ${result.enrichedMedia.length}`)
      })
      .catch((error) => {
        console.error(`[ApiDiscovery] Enhanced crawl failed: ${sessionId}`, error)
      })

    res.json({
      success: true,
      sessionId,
      message: 'Enhanced crawl started. Check status endpoint for progress.',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * POST /api/discovery/batch/playlist
 * Batch discover content from M3U8 playlist entries
 */
router.post('/batch/playlist', async (req: Request, res: Response) => {
  try {
    const { entries, maxConcurrent, enrichMetadata, findTorrents } = req.body

    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({
        success: false,
        error: 'entries array is required',
      })
    }

    if (entries.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'entries array cannot be empty',
      })
    }

    // Validate entries
    for (const entry of entries) {
      if (!entry.title || !entry.url) {
        return res.status(400).json({
          success: false,
          error: 'Each entry must have "title" and "url" properties',
        })
      }
    }

    const results = await enhancedMediaCrawler.batchDiscoverFromPlaylist(entries, {
      maxConcurrent: maxConcurrent || 5,
      enrichMetadata,
      findTorrents,
    })

    const enrichedCount = results.filter(r => r.enriched).length

    res.json({
      success: true,
      totalProcessed: results.length,
      enrichedCount,
      enrichmentRate: ((enrichedCount / results.length) * 100).toFixed(1) + '%',
      results,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// ==================== Statistics ====================

/**
 * GET /api/discovery/stats
 * Get discovery and API integration statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = enhancedMediaCrawler.getStats()

    res.json({
      success: true,
      ...stats,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

export default router
