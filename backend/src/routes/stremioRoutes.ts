/**
 * Routes for Stremio addon API
 */

import { Router } from 'express'
import {
  handleManifest,
  handleCatalog,
  handleStream,
  handleAddLinks,
  handleAddonInfo,
  handleClearLinks,
  handleUpdateManifest,
  handleStremioHealth,
  handleStartDiscovery,
  handleGetDiscoveryJob,
  handleGetAllDiscoveryJobs,
  handleGetAllPlaylists,
  handleDownloadPlaylist,
  handleAddDiscoveredLinks
} from '../stremioAddon.js'

const router = Router()

// Stremio addon protocol endpoints
router.get('/manifest.json', handleManifest)
router.get('/:config/manifest.json', handleManifest)
router.get('/catalog/:type/:id.json', handleCatalog)
router.get('/:config/catalog/:type/:id.json', handleCatalog)
router.get('/stream/:type/:id.json', handleStream)
router.get('/:config/stream/:type/:id.json', handleStream)

// Management API endpoints
router.post('/api/links', handleAddLinks)
router.get('/api/info', handleAddonInfo)
router.delete('/api/links', handleClearLinks)
router.put('/api/manifest', handleUpdateManifest)
router.get('/api/health', handleStremioHealth)

// Auto-Discovery API endpoints
router.post('/api/discovery/start', handleStartDiscovery)
router.get('/api/discovery/jobs/:jobId', handleGetDiscoveryJob)
router.get('/api/discovery/jobs', handleGetAllDiscoveryJobs)
router.get('/api/playlists', handleGetAllPlaylists)
router.get('/api/playlists/:playlistId/download', handleDownloadPlaylist)
router.post('/api/discovery/add-to-addon', handleAddDiscoveredLinks)

export default router
