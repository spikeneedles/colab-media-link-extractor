/**
 * Playlist Push Routes
 * 
 * API endpoints for managing playlist syncing to mobile apps
 */

import { Router, Request, Response } from 'express'
import { playlistPushService } from '../services/PlaylistPushService.js'
import { firebaseAdmin } from '../services/FirebaseAdminService.js'

const router = Router()

/**
 * GET /api/playlist-push/status
 * Check Firebase connection status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const enabled = firebaseAdmin.isEnabled()
    
    res.json({
      enabled,
      message: enabled 
        ? 'Firebase playlist push is enabled and ready' 
        : 'Firebase not configured. Add firebase-service-account.json to enable.',
    })
  } catch (error: any) {
    res.status(500).json({
      enabled: false,
      error: error.message,
    })
  }
})

/**
 * POST /api/playlist-push/trigger
 * Manually trigger playlist push to all devices
 */
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    if (!firebaseAdmin.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'Firebase not enabled. Configure firebase-service-account.json first.',
      })
    }

    const stats = await playlistPushService.manualPush()
    
    res.json({
      success: stats.success,
      totalPushed: stats.totalPushed,
      categories: stats.categories,
      timestamp: stats.timestamp,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

/**
 * POST /api/playlist-push/category/:category
 * Push a specific category playlist
 */
router.post('/category/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params
    
    if (!firebaseAdmin.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'Firebase not enabled',
      })
    }

    if (typeof category !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid category parameter',
      })
    }

    const validCategories = ['movies', 'live_tv', 'series', 'adult_movies', 'adult_livetv', 'adult_series']
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      })
    }

    const success = await playlistPushService.pushCategory(category)
    
    res.json({
      success,
      category,
      timestamp: Date.now(),
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

/**
 * GET /api/playlist-push/metadata/:category
 * Get current playlist metadata from Firestore
 */
router.get('/metadata/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params
    
    if (!firebaseAdmin.isEnabled()) {
      return res.status(503).json({
        error: 'Firebase not enabled',
      })
    }

    if (typeof category !== 'string') {
      return res.status(400).json({
        error: 'Invalid category parameter',
      })
    }

    const metadata = await firebaseAdmin.getPlaylistMetadata(category)
    
    if (!metadata) {
      return res.status(404).json({
        error: 'Playlist metadata not found',
      })
    }

    res.json(metadata)
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
    })
  }
})

export default router
