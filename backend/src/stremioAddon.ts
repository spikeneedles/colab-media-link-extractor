/**
 * Stremio Addon Implementation
 * 
 * Implements the Stremio addon protocol to serve extracted media links to Stremio
 * https://github.com/Stremio/stremio-addon-sdk
 */

import { Request, Response } from 'express'
import { autoDiscoveryManager } from './autoDiscovery.js'

export interface StreamioLink {
  url: string
  title?: string
  category?: string
  type?: 'movie' | 'series' | 'tv' | 'channel'
  imdbId?: string
  season?: number
  episode?: number
}

export interface StremioManifest {
  id: string
  version: string
  name: string
  description: string
  resources: string[]
  types: string[]
  catalogs: Array<{
    type: string
    id: string
    name: string
    extra?: Array<{ name: string; isRequired?: boolean }>
  }>
  idPrefixes?: string[]
  logo?: string
  background?: string
  contactEmail?: string
}

/**
 * In-memory storage for addon state
 * In production, you'd want to use a database
 */
class StremioAddonManager {
  private links: Map<string, StreamioLink[]> = new Map()
  private manifests: Map<string, StremioManifest> = new Map()
  
  constructor() {
    // Create default addon manifest
    const defaultManifest: StremioManifest = {
      id: 'org.medialink.extractor',
      version: '1.0.0',
      name: 'Media Link Extractor',
      description: 'Stream extracted media links in Stremio. Supports IPTV, M3U playlists, and various streaming sources.',
      resources: ['catalog', 'stream'],
      types: ['movie', 'series', 'tv', 'channel'],
      catalogs: [
        {
          type: 'movie',
          id: 'extracted-movies',
          name: 'Extracted Movies'
        },
        {
          type: 'series',
          id: 'extracted-series',
          name: 'Extracted Series'
        },
        {
          type: 'tv',
          id: 'extracted-tv',
          name: 'Extracted Live TV'
        },
        {
          type: 'channel',
          id: 'extracted-channels',
          name: 'Extracted Channels'
        }
      ],
      idPrefixes: ['mle'],
      logo: 'https://via.placeholder.com/256x256?text=MLE',
      background: 'https://via.placeholder.com/1920x1080?text=Media+Link+Extractor',
      contactEmail: 'support@example.com'
    }
    
    this.manifests.set('default', defaultManifest)
  }
  
  /**
   * Add extracted links to the addon
   */
  addLinks(category: string, links: StreamioLink[]): void {
    const existing = this.links.get(category) || []
    this.links.set(category, [...existing, ...links])
  }
  
  /**
   * Get all links for a category
   */
  getLinks(category: string): StreamioLink[] {
    return this.links.get(category) || []
  }
  
  /**
   * Get all links
   */
  getAllLinks(): StreamioLink[] {
    const allLinks: StreamioLink[] = []
    this.links.forEach(links => allLinks.push(...links))
    return allLinks
  }
  
  /**
   * Clear all links
   */
  clearLinks(): void {
    this.links.clear()
  }
  
  /**
   * Get manifest
   */
  getManifest(): StremioManifest {
    return this.manifests.get('default')!
  }
  
  /**
   * Update manifest
   */
  updateManifest(manifest: Partial<StremioManifest>): void {
    const current = this.getManifest()
    this.manifests.set('default', { ...current, ...manifest })
  }
  
  /**
   * Generate catalog response
   */
  getCatalog(type: string, id: string): any {
    const links = this.getAllLinks()
    const filtered = links.filter(link => {
      if (!link.type) return type === 'tv' || type === 'channel'
      return link.type === type
    })
    
    const metas = filtered.map((link, index) => {
      const metaId = `mle:${type}:${index}`
      return {
        id: metaId,
        type: type,
        name: link.title || `Item ${index + 1}`,
        poster: 'https://via.placeholder.com/300x450?text=' + encodeURIComponent(link.title || 'Stream'),
        posterShape: type === 'tv' || type === 'channel' ? 'landscape' : 'poster',
        background: 'https://via.placeholder.com/1920x1080',
        description: `Stream: ${link.url}`,
        genre: [link.category || 'General'],
        links: [link.url]
      }
    })
    
    return { metas }
  }
  
  /**
   * Generate stream response
   */
  getStream(type: string, id: string): any {
    const links = this.getAllLinks()
    const match = id.match(/^mle:([^:]+):(\d+)$/)
    
    if (!match) {
      return { streams: [] }
    }
    
    const index = parseInt(match[2])
    const filtered = links.filter(link => {
      if (!link.type) return type === 'tv' || type === 'channel'
      return link.type === type
    })
    
    if (index >= filtered.length) {
      return { streams: [] }
    }
    
    const link = filtered[index]
    const streams = [{
      name: 'Media Link Extractor',
      title: link.title || 'Stream',
      url: link.url,
      behaviorHints: {
        notWebReady: link.url.includes('.m3u8') || link.url.includes('rtsp://') || link.url.includes('rtmp://')
      }
    }]
    
    return { streams }
  }
}

export const stremioManager = new StremioAddonManager()

/**
 * Stremio addon manifest endpoint
 */
export function handleManifest(req: Request, res: Response): void {
  const manifest = stremioManager.getManifest()
  res.json(manifest)
}

/**
 * Stremio catalog endpoint
 */
export function handleCatalog(req: Request, res: Response): void {
  const { type, id } = req.params
  if (typeof type !== 'string' || typeof id !== 'string') {
    res.status(400).json({ error: 'Invalid parameters' })
    return
  }
  const catalog = stremioManager.getCatalog(type, id)
  res.json(catalog)
}

/**
 * Stremio stream endpoint
 * Triggers auto-discovery when a stream is requested
 */
export function handleStream(req: Request, res: Response): void {
  const { type, id } = req.params
  if (typeof type !== 'string' || typeof id !== 'string') {
    res.status(400).json({ error: 'Invalid parameters' })
    return
  }
  const stream = stremioManager.getStream(type, id)
  
  // AUTO-DISCOVERY: Capture stream request and trigger crawling
  if (stream.streams && stream.streams.length > 0) {
    const streamUrl = stream.streams[0].url
    const streamTitle = stream.streams[0].title
    
    // Trigger auto-discovery in background (don't await)
    autoDiscoveryManager.discoverFromStreamRequest(streamUrl, streamTitle, type)
      .catch(error => {
        console.error('Auto-discovery failed:', error)
      })
  }
  
  res.json(stream)
}

/**
 * API endpoint to add links to the addon
 */
export function handleAddLinks(req: Request, res: Response): void {
  const { links, category = 'default' } = req.body
  
  if (!links || !Array.isArray(links)) {
    res.status(400).json({ error: 'Links array is required' })
    return
  }
  
  // Convert simple URLs to StreamioLink objects
  const streamioLinks: StreamioLink[] = links.map(link => {
    if (typeof link === 'string') {
      return { url: link }
    }
    return link
  })
  
  stremioManager.addLinks(category, streamioLinks)
  
  res.json({
    success: true,
    message: `Added ${streamioLinks.length} links to category: ${category}`,
    totalLinks: stremioManager.getAllLinks().length
  })
}

/**
 * API endpoint to get addon info
 */
export function handleAddonInfo(req: Request, res: Response): void {
  const manifest = stremioManager.getManifest()
  const allLinks = stremioManager.getAllLinks()
  const serverUrl = `${req.protocol}://${req.get('host')}`
  
  res.json({
    manifest,
    totalLinks: allLinks.length,
    installUrl: `${serverUrl}/stremio/${Buffer.from(JSON.stringify(manifest)).toString('base64')}/manifest.json`,
    addonUrl: `${serverUrl}/stremio`,
    stremioUrl: `stremio://${req.get('host')}/stremio/${Buffer.from(JSON.stringify(manifest)).toString('base64')}/manifest.json`
  })
}

/**
 * API endpoint to clear all links
 */
export function handleClearLinks(req: Request, res: Response): void {
  stremioManager.clearLinks()
  res.json({
    success: true,
    message: 'All links cleared'
  })
}

/**
 * API endpoint to update manifest
 */
export function handleUpdateManifest(req: Request, res: Response): void {
  const { name, description, logo, background } = req.body
  
  const update: Partial<StremioManifest> = {}
  if (name) update.name = name
  if (description) update.description = description
  if (logo) update.logo = logo
  if (background) update.background = background
  
  stremioManager.updateManifest(update)
  
  res.json({
    success: true,
    manifest: stremioManager.getManifest()
  })
}

/**
 * Health check for Stremio addon
 */
export function handleStremioHealth(req: Request, res: Response): void {
  const manifest = stremioManager.getManifest()
  const allLinks = stremioManager.getAllLinks()
  
  res.json({
    status: 'ok',
    addon: manifest.name,
    version: manifest.version,
    totalLinks: allLinks.length,
    resources: manifest.resources,
    types: manifest.types
  })
}

/**
 * AUTO-DISCOVERY: Manually trigger discovery for a URL
 */
export function handleStartDiscovery(req: Request, res: Response): void {
  const { url, title, category } = req.body
  
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'URL is required' })
    return
  }
  
  autoDiscoveryManager.discoverManually(url, title, category)
    .then(job => {
      res.json({
        success: true,
        job: {
          id: job.id,
          sourceUrl: job.sourceUrl,
          status: job.status,
          progress: job.progress,
          startedAt: job.startedAt
        }
      })
    })
    .catch(error => {
      res.status(500).json({
        error: 'Failed to start discovery',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    })
}

/**
 * AUTO-DISCOVERY: Get discovery job status
 */
export function handleGetDiscoveryJob(req: Request, res: Response): void {
  const { jobId } = req.params
  
  if (typeof jobId !== 'string') {
    res.status(400).json({ error: 'Invalid job ID' })
    return
  }
  
  const job = autoDiscoveryManager.getJob(jobId)
  
  if (!job) {
    res.status(404).json({ error: 'Job not found' })
    return
  }
  
  res.json({
    id: job.id,
    sourceUrl: job.sourceUrl,
    triggeredBy: job.triggeredBy,
    status: job.status,
    progress: job.progress,
    discoveredLinksCount: job.discoveredLinks.length,
    playlistUrl: job.playlistUrl,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    error: job.error
  })
}

/**
 * AUTO-DISCOVERY: Get all discovery jobs
 */
export function handleGetAllDiscoveryJobs(req: Request, res: Response): void {
  const jobs = autoDiscoveryManager.getAllJobs()
  
  res.json({
    total: jobs.length,
    jobs: jobs.map(job => ({
      id: job.id,
      sourceUrl: job.sourceUrl,
      triggeredBy: job.triggeredBy,
      status: job.status,
      progress: job.progress,
      discoveredLinksCount: job.discoveredLinks.length,
      playlistUrl: job.playlistUrl,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error
    }))
  })
}

/**
 * AUTO-DISCOVERY: Get all playlists
 */
export function handleGetAllPlaylists(req: Request, res: Response): void {
  const playlists = autoDiscoveryManager.getAllPlaylists()
  
  res.json({
    total: playlists.length,
    playlists: playlists.map(playlist => ({
      id: playlist.id,
      name: playlist.name,
      category: playlist.category,
      linksCount: playlist.links.length,
      format: playlist.format,
      createdAt: playlist.createdAt,
      sourceUrl: playlist.sourceUrl,
      downloadUrl: `/stremio/api/playlists/${playlist.id}/download`
    }))
  })
}

/**
 * AUTO-DISCOVERY: Download playlist
 */
export function handleDownloadPlaylist(req: Request, res: Response): void {
  const { playlistId } = req.params
  
  if (typeof playlistId !== 'string') {
    res.status(400).json({ error: 'Invalid playlist ID' })
    return
  }
  
  const playlist = autoDiscoveryManager.getPlaylist(playlistId)
  
  if (!playlist) {
    res.status(404).json({ error: 'Playlist not found' })
    return
  }
  
  const filename = `${playlist.name.replace(/[^a-z0-9]/gi, '_')}.m3u8`
  
  res.setHeader('Content-Type', 'audio/x-mpegurl')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(playlist.m3uContent)
}

/**
 * AUTO-DISCOVERY: Add discovered links to addon
 */
export function handleAddDiscoveredLinks(req: Request, res: Response): void {
  const { jobId } = req.body
  
  if (!jobId || typeof jobId !== 'string') {
    res.status(400).json({ error: 'Job ID is required' })
    return
  }
  
  const job = autoDiscoveryManager.getJob(jobId)
  
  if (!job) {
    res.status(404).json({ error: 'Job not found' })
    return
  }
  
  if (job.status !== 'completed') {
    res.status(400).json({ error: 'Job not completed yet' })
    return
  }
  
  // Add discovered links to Stremio addon
  stremioManager.addLinks('auto-discovered', job.discoveredLinks)
  
  res.json({
    success: true,
    message: `Added ${job.discoveredLinks.length} discovered links to addon`,
    totalLinks: stremioManager.getAllLinks().length
  })
}
