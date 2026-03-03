/**
 * Media Management Routes - /api/media-list
 *
 * Provides endpoints for managing media stored in Firebase Storage
 * Supports three categories: "live tv", "movies", and "series"
 */

import express, { Router, Request, Response } from 'express'
import FirebaseService, { MediaItem, MediaList } from '../services/sqliteService.js'

const router = Router()
const firebaseService = FirebaseService.getInstance()

/**
 * Initialize Firebase on first route call
 */
let firebaseInitialized = false

async function ensureFirebaseInitialized(req: Request, res: Response, next: Function) {
  if (!firebaseInitialized) {
    try {
      await firebaseService.initialize()
      await firebaseService.initializeMediaLists()
      firebaseInitialized = true
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Firebase initialization failed',
        details: (error as any).message,
      })
    }
  }
  next()
}

router.use(ensureFirebaseInitialized)

/**
 * GET /api/media-list/:category
 * Get all media items in a specific category
 * 
 * Categories: "live tv", "movies", "series"
 */
router.get('/:category', async (req: Request, res: Response) => {
  try {
    const category = req.params.category as 'live tv' | 'movies' | 'series'

    if (!['live tv', 'movies', 'series'].includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category. Must be one of: "live tv", "movies", "series"',
      })
    }

    const mediaList = await firebaseService.getMediaList(category)

    if (!mediaList) {
      return res.status(404).json({
        success: false,
        error: `Media list not found for category: ${category}`,
      })
    }

    res.json({
      success: true,
      data: mediaList,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch media list',
      details: (error as any).message,
    })
  }
})

/**
 * GET /api/media-list
 * Get all media lists from all categories
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const lists = await firebaseService.getAllMediaLists()

    res.json({
      success: true,
      data: lists,
      totalLists: lists.length,
      totalItems: lists.reduce((sum, list) => sum + list.itemCount, 0),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch media lists',
      details: (error as any).message,
    })
  }
})

/**
 * POST /api/media-list/:category
 * Add a single media item to a category
 *
 * Body:
 * {
 *   url: string,
 *   title: string,
 *   metadata?: {
 *     duration?: number,
 *     resolution?: string,
 *     format?: string,
 *     source?: string,
 *     [key: string]: any
 *   }
 * }
 */
router.post('/:category', async (req: Request, res: Response) => {
  try {
    const category = req.params.category as 'live tv' | 'movies' | 'series'
    const { url, title, metadata } = req.body

    if (!['live tv', 'movies', 'series'].includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category. Must be one of: "live tv", "movies", "series"',
      })
    }

    if (!url || !title) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: url, title',
      })
    }

    const mediaItem = await firebaseService.addMediaToList(category, {
      url,
      title,
      category,
      addedAt: Date.now(),
      metadata,
    })

    if (!mediaItem) {
      throw new Error('Failed to add media item')
    }

    res.status(201).json({
      success: true,
      data: mediaItem,
      message: `Media added to ${category}`,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add media',
      details: (error as any).message,
    })
  }
})

/**
 * POST /api/media-list/:category/bulk
 * Add multiple media items to a category at once
 *
 * Body:
 * {
 *   items: [
 *     {
 *       url: string,
 *       title: string,
 *       metadata?: {...}
 *     }
 *   ]
 * }
 */
router.post('/:category/bulk', async (req: Request, res: Response) => {
  try {
    const category = req.params.category as 'live tv' | 'movies' | 'series'
    const { items } = req.body

    if (!['live tv', 'movies', 'series'].includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category. Must be one of: "live tv", "movies", "series"',
      })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request. Expected array of items with at least one item',
      })
    }

    // Validate all items
    for (const item of items) {
      if (!item.url || !item.title) {
        return res.status(400).json({
          success: false,
          error: 'All items must have url and title fields',
        })
      }
    }

    const mediaItems = items.map((item: any) => ({
      url: item.url,
      title: item.title,
      category,
      addedAt: Date.now(),
      metadata: item.metadata,
    }))

    const addedItems = await firebaseService.bulkAddMedia(category, mediaItems)

    res.status(201).json({
      success: true,
      data: addedItems,
      message: `Added ${addedItems.length} media items to ${category}`,
      addedCount: addedItems.length,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to bulk add media',
      details: (error as any).message,
    })
  }
})

/**
 * DELETE /api/media-list/:category/:mediaId
 * Remove a specific media item from a category
 */
router.delete('/:category/:mediaId', async (req: Request, res: Response) => {
  try {
    const category = req.params.category as 'live tv' | 'movies' | 'series'
    const mediaId = req.params.mediaId as string

    if (!['live tv', 'movies', 'series'].includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category. Must be one of: "live tv", "movies", "series"',
      })
    }

    const success = await firebaseService.removeMediaFromList(category, mediaId)

    if (!success) {
      return res.status(404).json({
        success: false,
        error: `Media item not found: ${mediaId}`,
      })
    }

    res.json({
      success: true,
      message: `Media removed from ${category}`,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete media',
      details: (error as any).message,
    })
  }
})

/**
 * GET /api/media-list/search
 * Search for media items across all categories
 *
 * Query Parameters:
 * q: search query string
 */
router.get('/search/query', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameter: q',
      })
    }

    const results = await firebaseService.searchMedia(query)

    res.json({
      success: true,
      data: results,
      totalResults: results.length,
      query,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to search media',
      details: (error as any).message,
    })
  }
})

/**
 * GET /api/media-list/stats
 * Get statistics about all media lists
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const lists = await firebaseService.getAllMediaLists()

    const stats = {
      totalCategories: lists.length,
      categories: lists.map((list) => ({
        name: list.category,
        itemCount: list.itemCount,
        lastUpdated: list.lastUpdated,
      })),
      totalItems: lists.reduce((sum, list) => sum + list.itemCount, 0),
      timestamp: Date.now(),
    }

    res.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      details: (error as any).message,
    })
  }
})

export default router
