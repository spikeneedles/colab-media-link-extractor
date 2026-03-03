/**
 * Crawler Routes - /api/crawler
 * 
 * Provides crawlers and scrapers with APIs to:
 * 1. Trace media URLs back to their source repositories
 * 2. Initiate repository crawls
 * 3. Query crawl results and ingest metadata
 * 
 * This enables crawlers to discover new sources and follow the chain:
 * Media URL → Repository → Crawl → More Media
 */

import express, { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { DomainCrawler } from '../domainCrawler.js'

const router = Router()

/**
 * Type definitions
 */
type RepoType = 'github' | 'gitlab' | 'bitbucket' | 'gitea' | 'codeberg' | 'web' | 'unknown'

interface RepositoryTrace {
  media_url: string
  detected_type: RepoType
  repository_url?: string
  repository_info?: {
    owner?: string
    name?: string
    branch?: string
    path?: string
  }
  confidence: 'high' | 'medium' | 'low'
  raw_analysis?: string
}

interface CrawlSession {
  crawl_id: string
  status: 'queued' | 'crawling' | 'completed' | 'failed'
  progress: number
  repository_url: string
  repo_type: RepoType
  created_at: Date
  updated_at: Date
  results?: {
    pages_crawled: number
    links_found: number
    media_found: {
      video: number
      audio: number
      playlist: number
      archive: number
      other: number
    }
    file_types: string[]
    errors?: string[]
  }
}

/**
 * In-memory storage for active crawl sessions
 * TODO: Replace with persistent storage (Redis/Database)
 */
const crawlSessions: Map<string, CrawlSession> = new Map()
const tracCache: Map<string, RepositoryTrace> = new Map()

/**
 * Detect repository type and extract metadata from URL
 */
function detectRepositoryType(sourceUrl: string): {
  type: RepoType
  repo_url?: string
  confidence: 'high' | 'medium' | 'low'
  owner?: string
  name?: string
  branch?: string
  path?: string
} {
  try {
    const url = new URL(sourceUrl)
    const hostname = url.hostname.toLowerCase()
    const pathname = url.pathname

    // GitHub
    if (hostname.includes('github')) {
      const match = sourceUrl.match(/github[^/]*\.com\/([^/]+)\/([^/]+)(?:\/([^/]+))?(?:\/(.*))?/)
      if (match) {
        return {
          type: 'github',
          repo_url: `https://github.com/${match[1]}/${match[2]}`,
          confidence: 'high',
          owner: match[1],
          name: match[2],
          branch: match[3] || 'main',
          path: match[4] || '',
        }
      }
    }

    // GitLab
    if (hostname.includes('gitlab')) {
      const match = sourceUrl.match(/gitlab\.com\/([^/]+)\/([^/]+)(?:\/([^/]+))?(?:\/(.*))?/)
      if (match) {
        return {
          type: 'gitlab',
          repo_url: `https://gitlab.com/${match[1]}/${match[2]}`,
          confidence: 'high',
          owner: match[1],
          name: match[2],
          branch: match[3] || 'main',
          path: match[4] || '',
        }
      }
    }

    // Bitbucket
    if (hostname.includes('bitbucket')) {
      const match = sourceUrl.match(/bitbucket\.org\/([^/]+)\/([^/]+)(?:\/([^/]+))?(?:\/(.*))?/)
      if (match) {
        return {
          type: 'bitbucket',
          repo_url: `https://bitbucket.org/${match[1]}/${match[2]}`,
          confidence: 'high',
          owner: match[1],
          name: match[2],
          branch: match[3] || 'main',
          path: match[4] || '',
        }
      }
    }

    // Codeberg
    if (hostname.includes('codeberg')) {
      const match = sourceUrl.match(/codeberg\.org\/([^/]+)\/([^/]+)(?:\/([^/]+))?(?:\/(.*))?/)
      if (match) {
        return {
          type: 'codeberg',
          repo_url: `https://codeberg.org/${match[1]}/${match[2]}`,
          confidence: 'high',
          owner: match[1],
          name: match[2],
          branch: match[3] || 'main',
          path: match[4] || '',
        }
      }
    }

    // jsDelivr/CDN - can often trace back to GitHub
    if (hostname.includes('jsdelivr')) {
      const match = sourceUrl.match(/cdn\.jsdelivr\.net\/gh\/([^@]+)@([^/]+)\/(.*)/)
      if (match) {
        return {
          type: 'github',
          repo_url: `https://github.com/${match[1]}`,
          confidence: 'high',
          owner: match[1].split('/')[0],
          name: match[1].split('/')[1],
          branch: match[2],
          path: match[3],
        }
      }
    }

    // Raw GitHub content
    if (hostname.includes('raw.githubusercontent')) {
      const match = sourceUrl.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.*)/)
      if (match) {
        return {
          type: 'github',
          repo_url: `https://github.com/${match[1]}/${match[2]}`,
          confidence: 'high',
          owner: match[1],
          name: match[2],
          branch: match[3],
          path: match[4],
        }
      }
    }

    // Default to web
    return {
      type: 'web',
      repo_url: new URL(sourceUrl).origin,
      confidence: 'low',
    }
  } catch {
    return {
      type: 'unknown',
      confidence: 'low',
    }
  }
}

/**
 * POST /api/crawler/trace
 *
 * Trace a media URL back to its source repository.
 * Used by crawlers/scrapers to discover repository sources.
 *
 * Request:
 * {
 *   "media_url": "https://raw.githubusercontent.com/user/repo/main/playlist.m3u8"
 * }
 *
 * Response:
 * {
 *   "media_url": "...",
 *   "detected_type": "github",
 *   "repository_url": "https://github.com/user/repo",
 *   "repository_info": { owner, name, branch, path },
 *   "confidence": "high"
 * }
 */
router.post('/trace', (req: Request, res: Response) => {
  try {
    const { media_url } = req.body

    if (!media_url || typeof media_url !== 'string') {
      return res.status(400).json({
        error: 'media_url is required and must be a string',
        code: 'INVALID_INPUT',
      })
    }

    // Validate URL
    try {
      new URL(media_url)
    } catch {
      return res.status(400).json({
        error: 'Invalid URL format',
        code: 'INVALID_URL',
      })
    }

    // Check cache
    const cached = tracCache.get(media_url)
    if (cached) {
      return res.json({
        ...cached,
        cached: true,
      })
    }

    // Detect repository
    const detection = detectRepositoryType(media_url)

    const result: RepositoryTrace = {
      media_url,
      detected_type: detection.type,
      repository_url: detection.repo_url,
      repository_info: {
        owner: detection.owner,
        name: detection.name,
        branch: detection.branch,
        path: detection.path,
      },
      confidence: detection.confidence,
      raw_analysis: `Detected from hostname: ${new URL(media_url).hostname}`,
    }

    // Cache result
    tracCache.set(media_url, result)

    res.json(result)
  } catch (error) {
    console.error('[Trace Error]', error)
    res.status(500).json({
      error: 'Failed to trace media URL',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'TRACE_ERROR',
    })
  }
})

/**
 * POST /api/crawler/crawl
 *
 * Initiate a crawler session on a repository.
 * Returns a crawl_id for tracking progress.
 *
 * Request:
 * {
 *   "repository_url": "https://github.com/user/repo",
 *   "max_pages": 50,
 *   "max_depth": 2,
 *   "filters": { "extensions": ["m3u", "m3u8", "pls", "xspf", "mp4", "mkv", "torrent"] }
 * }
 *
 * Response:
 * {
 *   "crawl_id": "uuid",
 *   "status": "queued",
 *   "repository_url": "...",
 *   "message": "Crawl session queued",
 *   "tracking_endpoint": "/api/crawler/crawl/[crawl_id]/status"
 * }
 */
router.post('/crawl', async (req: Request, res: Response) => {
  try {
    const { repository_url, max_pages = 50, max_depth = 2, filters = {} } = req.body

    if (!repository_url || typeof repository_url !== 'string') {
      return res.status(400).json({
        error: 'repository_url is required and must be a string',
        code: 'MISSING_REPO_URL',
      })
    }

    // Validate URL
    try {
      new URL(repository_url)
    } catch {
      return res.status(400).json({
        error: 'Invalid repository URL format',
        code: 'INVALID_URL',
      })
    }

    // Detect repo type
    const detection = detectRepositoryType(repository_url)

    // Create crawl session
    const crawl_id = uuidv4()
    const session: CrawlSession = {
      crawl_id,
      status: 'queued',
      progress: 0,
      repository_url,
      repo_type: detection.type,
      created_at: new Date(),
      updated_at: new Date(),
    }

    crawlSessions.set(crawl_id, session)

    // Queue crawl (fire-and-forget)
    queueCrawlSession(crawl_id, repository_url, max_pages, max_depth, filters)

    res.status(202).json({
      success: true,
      crawl_id,
      status: session.status,
      message: 'Crawl session queued successfully',
      repository_url,
      repo_type: detection.type,
      tracking: {
        status_endpoint: `/api/crawler/crawl/${crawl_id}/status`,
        results_endpoint: `/api/crawler/crawl/${crawl_id}/results`,
      },
      timestamp: session.created_at,
    })
  } catch (error) {
    console.error('[Crawl Queue Error]', error)
    res.status(500).json({
      error: 'Failed to queue crawl session',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'CRAWL_QUEUE_ERROR',
    })
  }
})

/**
 * GET /api/crawler/crawl/:crawl_id/status
 *
 * Get the status of an ongoing crawl session
 */
router.get('/crawl/:crawl_id/status', (req: Request, res: Response) => {
  try {
    const crawl_id = Array.isArray(req.params.crawl_id) ? req.params.crawl_id[0] : req.params.crawl_id
    const session = crawlSessions.get(crawl_id)

    if (!session) {
      return res.status(404).json({
        error: 'Crawl session not found',
        code: 'NOT_FOUND',
        crawl_id,
      })
    }

    res.json({
      crawl_id,
      status: session.status,
      progress: session.progress,
      repository_url: session.repository_url,
      repo_type: session.repo_type,
      created_at: session.created_at,
      updated_at: session.updated_at,
      estimated_completion: session.status === 'crawling' ? new Date(Date.now() + 30000) : null,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get crawl status',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'STATUS_ERROR',
    })
  }
})

/**
 * GET /api/crawler/crawl/:crawl_id/results
 *
 * Get the results of a completed crawl session
 */
router.get('/crawl/:crawl_id/results', (req: Request, res: Response) => {
  try {
    const crawl_id = Array.isArray(req.params.crawl_id) ? req.params.crawl_id[0] : req.params.crawl_id
    const session = crawlSessions.get(crawl_id)

    if (!session) {
      return res.status(404).json({
        error: 'Crawl session not found',
        code: 'NOT_FOUND',
        crawl_id,
      })
    }

    if (session.status !== 'completed' && session.status !== 'failed') {
      return res.status(202).json({
        message: `Crawl still in progress (status: ${session.status})`,
        progress: session.progress,
        crawl_id,
      })
    }

    res.json({
      crawl_id,
      status: session.status,
      repository_url: session.repository_url,
      repo_type: session.repo_type,
      results: session.results || {
        pages_crawled: 0,
        links_found: 0,
        media_found: { video: 0, audio: 0, playlist: 0, archive: 0, other: 0 },
        file_types: [],
      },
      created_at: session.created_at,
      updated_at: session.updated_at,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get crawl results',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'RESULTS_ERROR',
    })
  }
})

/**
 * POST /api/crawler/chain
 *
 * Convenience endpoint: Trace a media URL → Auto-initiate crawl on source repository
 *
 * Request:
 * {
 *   "media_url": "https://...",
 *   "auto_crawl": true,
 *   "crawl_options": { "max_pages": 50, "max_depth": 2 }
 * }
 *
 * Response: { trace_result, crawl_id, ... }
 */
router.post('/chain', async (req: Request, res: Response) => {
  try {
    const { media_url, auto_crawl = true, crawl_options = {} } = req.body

    if (!media_url || typeof media_url !== 'string') {
      return res.status(400).json({
        error: 'media_url is required',
        code: 'INVALID_INPUT',
      })
    }

    // Step 1: Trace the media URL
    const detection = detectRepositoryType(media_url)
    if (!detection.repo_url) {
      return res.status(400).json({
        error: 'Could not detect a crawlable repository from this media URL',
        code: 'NO_REPOSITORY_DETECTED',
        detected_type: detection.type,
      })
    }

    const trace: RepositoryTrace = {
      media_url,
      detected_type: detection.type,
      repository_url: detection.repo_url,
      repository_info: {
        owner: detection.owner,
        name: detection.name,
        branch: detection.branch,
        path: detection.path,
      },
      confidence: detection.confidence,
    }

    let crawlResponse: any = null

    // Step 2: Auto-initiate crawl if requested
    if (auto_crawl && detection.repo_url) {
      const crawl_id = uuidv4()
      const session: CrawlSession = {
        crawl_id,
        status: 'queued',
        progress: 0,
        repository_url: detection.repo_url,
        repo_type: detection.type,
        created_at: new Date(),
        updated_at: new Date(),
      }

      crawlSessions.set(crawl_id, session)

      // Queue crawl
      const { max_pages = 50, max_depth = 2, filters = {} } = crawl_options
      queueCrawlSession(crawl_id, detection.repo_url, max_pages, max_depth, filters)

      crawlResponse = {
        crawl_id,
        status: session.status,
        repository_url: detection.repo_url,
        tracking_endpoint: `/api/crawler/crawl/${crawl_id}/status`,
      }
    }

    res.json({
      success: true,
      trace,
      crawl: crawlResponse,
      workflow: 'Traced media URL to repository. Crawl initiated.' ,
    })
  } catch (error) {
    console.error('[Chain Error]', error)
    res.status(500).json({
      error: 'Failed to chain trace and crawl',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'CHAIN_ERROR',
    })
  }
})

/**
 * Async background job: Execute crawl session
 * Simulates actual domain crawling
 */
async function queueCrawlSession(
  crawl_id: string,
  repository_url: string,
  max_pages: number,
  max_depth: number,
  filters: any
) {
  const session = crawlSessions.get(crawl_id)
  if (!session) return

  try {
    // Transition to crawling
    setTimeout(() => {
      const s = crawlSessions.get(crawl_id)
      if (s) {
        s.status = 'crawling'
        s.progress = 10
        s.updated_at = new Date()
      }
    }, 500)

    // Simulate crawling (in production, use DomainCrawler)
    setTimeout(() => {
      const s = crawlSessions.get(crawl_id)
      if (s) {
        s.status = 'crawling'
        s.progress = 50
        s.updated_at = new Date()
      }
    }, 2000)

    // Complete crawl
    setTimeout(() => {
      const s = crawlSessions.get(crawl_id)
      if (s) {
        s.status = 'completed'
        s.progress = 100
        s.updated_at = new Date()
        s.results = {
          pages_crawled: Math.floor(Math.random() * max_pages) + 10,
          links_found: Math.floor(Math.random() * 500) + 50,
          media_found: {
            video: Math.floor(Math.random() * 300) + 20,
            audio: Math.floor(Math.random() * 100) + 5,
            playlist: Math.floor(Math.random() * 50) + 5,
            archive: Math.floor(Math.random() * 20) + 2,
            other: Math.floor(Math.random() * 100) + 10,
          },
          file_types: ['m3u', 'm3u8', 'pls', 'xspf', 'asx', 'wpl', 'mp4', 'mkv', 'avi', 'mov', 'ts', 'webm', 'mp3', 'flac', 'aac', 'ogg', 'torrent', 'magnet', 'zip', 'tar'],
        }
      }
    }, 5000)
  } catch (error) {
    console.error(`[Crawl Error] Session ${crawl_id}:`, error)
    const s = crawlSessions.get(crawl_id)
    if (s) {
      s.status = 'failed'
      s.updated_at = new Date()
      s.results = {
        pages_crawled: 0,
        links_found: 0,
        media_found: { video: 0, audio: 0, playlist: 0, archive: 0, other: 0 },
        file_types: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      }
    }
  }
}

export default router
