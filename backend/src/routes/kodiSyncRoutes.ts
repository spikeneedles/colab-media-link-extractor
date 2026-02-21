/**
 * Kodi Sync Routes - /api/kodi-sync
 * 
 * Receives media URLs from Kodi extension (Agent 1 - "The Bridge")
 * and immediately queues Repository Auto-Scrape jobs (The Harvester)
 * 
 * Workflow:
 * 1. Kodi Extension sends URL + metadata
 * 2. Endpoint detects repository type
 * 3. Auto-scrape job is queued immediately
 * 4. Client receives job_id for tracking
 */

import express, { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import {
  IntelligentIngestionController,
  Agent1Payload,
  IngestionResult,
  ContentIntelligenceRecord,
} from '../services/IntelligentIngestionController.js'

const router = Router()

/**
 * Initialize Intelligent Ingestion Controller
 */
const intelligentIngestion = new IntelligentIngestionController()

/**
 * Job Queue Storage (In-memory for now - can be replaced with Redis)
 */
type RepoType = 'github' | 'gitlab' | 'bitbucket' | 'gitea' | 'codeberg' | 'web' | 'unknown'

interface KodiSyncJob {
  job_id: string
  status: 'queued' | 'detecting' | 'scraping' | 'completed' | 'failed'
  progress: number
  source_url: string
  repo_type: RepoType
  repo_url?: string
  confidence_level: 'high' | 'medium' | 'low'
  created_at: Date
  updated_at: Date
  kodi_session_id?: string
  kodi_source?: string
  content_intelligence_tags: {
    media_type?: 'movie' | 'tv-series' | 'live-tv' | 'vod' | 'unknown'
    category?: string
    source_name?: string
    is_verified?: boolean
    last_validation?: Date
  }
  results?: {
    total_links_found?: number
    total_files_scanned?: number
    media_breakdown?: {
      video_count?: number
      audio_count?: number
      playlist_count?: number
    }
    file_types_found?: string[]
    error?: string
  }
}

const jobQueue: Map<string, KodiSyncJob> = new Map()
const jobsBySession: Map<string, string[]> = new Map()
let latestKodiSession: {
  session_id: string
  kodi_source?: string
  updated_at: Date
} | null = null

function normalizeParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param
}

function updateLatestKodiSession(session_id: string, kodi_source?: string) {
  latestKodiSession = {
    session_id,
    kodi_source,
    updated_at: new Date(),
  }
  return latestKodiSession
}

/**
 * POST /api/kodi-sync/announce
 *
 * Notify backend that Kodi has launched and provide the session id.
 */
router.post('/announce', (req: Request, res: Response) => {
  try {
    const { session_id, kodi_source } = req.body

    if (!session_id || typeof session_id !== 'string') {
      return res.status(400).json({
        error: 'session_id is required',
        code: 'MISSING_SESSION_ID',
      })
    }

    const latest = updateLatestKodiSession(session_id, kodi_source)

    res.json({
      success: true,
      session_id,
      kodi_source: kodi_source || null,
      updated_at: latest.updated_at,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to announce session',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'ANNOUNCE_FAILED',
    })
  }
})

/**
 * GET /api/kodi-sync/latest-session
 *
 * Returns the most recently announced Kodi session id with associated jobs.
 */
router.get('/latest-session', (_req: Request, res: Response) => {
  if (!latestKodiSession) {
    return res.json({ success: false })
  }

  // Get jobs for this session
  const sessionJobs = jobsBySession.get(latestKodiSession.session_id) || []
  const jobsData = sessionJobs.map(jobId => jobQueue.get(jobId)).filter(Boolean) as KodiSyncJob[]

  // Calculate summary
  const summary = {
    queued: jobsData.filter(j => j.status === 'queued').length,
    detecting: jobsData.filter(j => j.status === 'detecting').length,
    scraping: jobsData.filter(j => j.status === 'scraping').length,
    completed: jobsData.filter(j => j.status === 'completed').length,
    failed: jobsData.filter(j => j.status === 'failed').length,
  }

  res.json({
    success: true,
    session_id: latestKodiSession.session_id,
    kodi_source: latestKodiSession.kodi_source || null,
    updated_at: latestKodiSession.updated_at,
    jobs: jobsData.map(job => ({
      job_id: job.job_id,
      status: job.status,
      progress: job.progress,
      source_url: job.source_url,
      repo_type: job.repo_type,
      created_at: job.created_at,
      updated_at: job.updated_at,
    })),
    summary,
    total: jobsData.length,
  })
})

/**
 * POST /api/kodi-sync/receive
 * 
 * Receive media URL from Kodi extension and queue auto-scrape job
 * 
 * Request Body:
 * {
 *   "source_url": "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u",
 *   "kodi_session_id": "kodi-addon-abc123",
 *   "kodi_source": "My IPTV Addon",
 *   "media_type": "playlist",
 *   "metadata": {
 *     "title": "IPTV Channels",
 *     "category": "Live TV",
 *     "source_name": "IPTV-Org Repository"
 *   }
 * }
 */
router.post('/receive', (req: Request, res: Response) => {
  try {
    const {
      source_url,
      kodi_session_id,
      kodi_source,
      media_type,
      metadata = {},
    } = req.body

    if (kodi_session_id) {
      updateLatestKodiSession(kodi_session_id, kodi_source)
    }

    // Validate required fields
    if (!source_url) {
      return res.status(400).json({
        error: 'source_url is required',
        code: 'MISSING_URL',
      })
    }

    // Validate URL format
    let sourceUrlObj: URL
    try {
      sourceUrlObj = new URL(source_url)
    } catch {
      return res.status(400).json({
        error: 'Invalid URL format',
        code: 'INVALID_URL',
      })
    }

    // Step 1: Detect repository type
    const repoDetection = detectRepositoryType(source_url)

    // Step 2: Create job object
    const job: KodiSyncJob = {
      job_id: uuidv4(),
      status: 'queued',
      progress: 0,
      source_url,
      repo_type: repoDetection.type,
      repo_url: repoDetection.repo_url,
      confidence_level: repoDetection.confidence,
      created_at: new Date(),
      updated_at: new Date(),
      kodi_session_id,
      kodi_source,
      content_intelligence_tags: {
        media_type: media_type as any || 'unknown',
        category: metadata.category,
        source_name: metadata.source_name || kodi_source,
        is_verified: false,
      },
    }

    // Step 3: Store job in queue
    jobQueue.set(job.job_id, job)

    // Track jobs by session
    if (kodi_session_id) {
      const sessionJobs = jobsBySession.get(kodi_session_id) || []
      sessionJobs.push(job.job_id)
      jobsBySession.set(kodi_session_id, sessionJobs)
    }

    // Step 4: Queue the job (immediately transition to 'detecting')
    queueAutoScrapeJob(job)

    // Return response with job tracking info
    res.status(202).json({
      success: true,
      job_id: job.job_id,
      status: job.status,
      message: 'Auto-scrape job queued successfully',
      repository_detection: {
        detected_type: job.repo_type,
        repository_url: job.repo_url,
        confidence: job.confidence_level,
      },
      tracking: {
        status_endpoint: `/api/kodi-sync/status/${job.job_id}`,
        results_endpoint: `/api/kodi-sync/results/${job.job_id}`,
      },
      timestamp: job.created_at,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to queue sync job',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'JOB_QUEUE_ERROR',
    })
  }
})

/**
 * POST /api/kodi-sync/ingest
 * 
 * Intelligent Ingestion Endpoint
 * 
 * Processes payload from Agent 1 (The Harvester) with tiered logic:
 * 1. IF metadata.addon.sourceUrl exists → trigger Git Repository Scan
 * 2. ELSE IF metadata.headers.referer exists → trigger Automated Crawler
 * 3. ELSE → use metadata.addon.id for Octokit targeted search
 * 
 * All captured media automatically persisted to Content Intelligence database
 * 
 * Request Body: Agent1Payload interface
 * Response: IngestionResult with ingest_id for tracking
 */
router.post('/ingest', async (req: Request, res: Response) => {
  try {
    const payload: Agent1Payload = req.body

    // Validate required fields
    if (!payload.job_id || !payload.source_url) {
      return res.status(400).json({
        error: 'job_id and source_url are required',
        code: 'MISSING_PAYLOAD_FIELDS',
      })
    }

    // Log ingestion attempt
    console.log(`[IngestingEndpoint] Processing job ${payload.job_id}`)
    console.log(
      `[IngestionLogic] Tiered Logic Check:`,
      payload.metadata?.addon?.sourceUrl ? 'sourceUrl detected (Tier 1)' : 
      payload.metadata?.headers?.referer ? 'referer detected (Tier 2)' :
      payload.metadata?.addon?.id ? 'addon.id detected (Tier 3)' :
      'fallback to direct URL'
    )

    // Process ingestion with tiered logic controller
    const result = await intelligentIngestion.ingest(payload)

    // Return result with 202 Accepted (processing) or 200 OK (completed)
    const statusCode = result.status === 'completed' ? 200 : 202

    res.status(statusCode).json(result)
  } catch (error) {
    res.status(500).json({
      error: 'Failed to process ingestion',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'INGESTION_ERROR',
    })
  }
})

/**
 * GET /api/kodi-sync/ingest/:ingestId
 * 
 * Retrieve Content Intelligence record and extracted media
 */
router.get('/ingest/:ingestId', (req: Request, res: Response) => {
  try {
    const ingestId = normalizeParam(req.params.ingestId)
    const record = intelligentIngestion.getContentIntelligenceRecord(ingestId)

    if (!record) {
      return res.status(404).json({
        error: 'Ingestion record not found',
        code: 'INGEST_NOT_FOUND',
        ingest_id: ingestId,
      })
    }

    const extractedMedia = intelligentIngestion.getExtractedMedia(ingestId)

    res.json({
      success: true,
      ingest_id: ingestId,
      record,
      extracted_media: extractedMedia || [],
      media_count: extractedMedia?.length || 0,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve ingestion record',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'INGEST_RETRIEVE_ERROR',
    })
  }
})

/**
 * GET /api/kodi-sync/intelligence
 * 
 * Get Content Intelligence database statistics
 */
router.get('/intelligence', (req: Request, res: Response) => {
  try {
    const stats = intelligentIngestion.getDatabaseStats()

    res.json({
      success: true,
      status: 'operational',
      content_intelligence_stats: stats,
      timestamp: new Date(),
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve intelligence stats',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTELLIGENCE_STATS_ERROR',
    })
  }
})

/**
 * GET /api/kodi-sync/status/:jobId
 * 
 * Get the current status and progress of a sync job
 */
router.get('/status/:jobId', (req: Request, res: Response) => {
  try {
    const jobId = normalizeParam(req.params.jobId)
    const job = jobQueue.get(jobId)

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        code: 'JOB_NOT_FOUND',
        job_id: jobId,
      })
    }

    res.json({
      success: true,
      job_id: job.job_id,
      status: job.status,
      progress: job.progress,
      repository_detection: {
        type: job.repo_type,
        url: job.repo_url,
        confidence: job.confidence_level,
      },
      content_intelligence: job.content_intelligence_tags,
      timestamps: {
        created_at: job.created_at,
        updated_at: job.updated_at,
      },
      kodi_info: {
        session_id: job.kodi_session_id,
        source: job.kodi_source,
      },
      results_summary: job.results ? {
        total_links_found: job.results.total_links_found,
        total_files_scanned: job.results.total_files_scanned,
        file_types_found: job.results.file_types_found,
      } : null,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get job status',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'STATUS_FETCH_ERROR',
    })
  }
})

/**
 * GET /api/kodi-sync/results/:jobId
 * 
 * Get the full results of a completed sync job
 */
router.get('/results/:jobId', (req: Request, res: Response) => {
  try {
    const jobId = normalizeParam(req.params.jobId)
    const { format = 'json' } = req.query
    const job = jobQueue.get(jobId)

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        code: 'JOB_NOT_FOUND',
      })
    }

    if (job.status !== 'completed' && job.status !== 'failed') {
      return res.status(202).json({
        error: 'Job still processing',
        code: 'JOB_IN_PROGRESS',
        current_status: job.status,
        progress: job.progress,
      })
    }

    // Return format-specific results
    if (format === 'm3u') {
      // Export as M3U playlist
      const m3uContent = generateM3UFromResults(job)
      res.set('Content-Type', 'application/vnd.apple.mpegurl')
      res.set('Content-Disposition', `attachment; filename="kodi-sync-${job.job_id}.m3u"`)
      return res.send(m3uContent)
    }

    if (format === 'csv') {
      // Export as CSV
      const csvContent = generateCSVFromResults(job)
      res.set('Content-Type', 'text/csv')
      res.set('Content-Disposition', `attachment; filename="kodi-sync-${job.job_id}.csv"`)
      return res.send(csvContent)
    }

    // Fetch ingested URLs from intelligent ingest system
    const ingestedMedia = intelligentIngestion.getMediaUrlsByJobId(jobId)
    const urls = ingestedMedia.map(media => ({
      id: media.id,
      url: media.url,
      type: media.type,
      contentType: job.content_intelligence_tags.media_type, // Use job's media_type for filtering
      name: media.name,
      mime_type: media.mime_type,
      file_size: media.file_size,
      extracted_from: media.extracted_from,
      extraction_metadata: media.extraction_metadata,
    }))

    // Default: JSON
    res.json({
      success: true,
      job_id: job.job_id,
      status: job.status,
      repository: {
        source_url: job.source_url,
        detected_type: job.repo_type,
        repository_url: job.repo_url,
        confidence: job.confidence_level,
      },
      content_intelligence: job.content_intelligence_tags,
      results: job.results,
      urls: urls,
      total_ingested_urls: urls.length,
      metadata: {
        kodi_session: job.kodi_session_id,
        kodi_source: job.kodi_source,
        created_at: job.created_at,
        completed_at: job.updated_at,
        processing_time_ms: job.updated_at.getTime() - job.created_at.getTime(),
      },
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get job results',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'RESULTS_FETCH_ERROR',
    })
  }
})

/**
 * GET /api/kodi-sync/session/:sessionId
 * 
 * Get all jobs associated with a Kodi session
 */
router.get('/session/:sessionId', (req: Request, res: Response) => {
  try {
    const sessionId = normalizeParam(req.params.sessionId)
    const jobIds = jobsBySession.get(sessionId) || []
    const jobs = jobIds
      .map(id => jobQueue.get(id))
      .filter((job): job is KodiSyncJob => job !== undefined)

    res.json({
      success: true,
      session_id: sessionId,
      jobs: jobs.map(job => ({
        job_id: job.job_id,
        status: job.status,
        progress: job.progress,
        source_url: job.source_url,
        repo_type: job.repo_type,
        created_at: job.created_at,
        updated_at: job.updated_at,
      })),
      total: jobs.length,
      summary: {
        queued: jobs.filter(j => j.status === 'queued').length,
        detecting: jobs.filter(j => j.status === 'detecting').length,
        scraping: jobs.filter(j => j.status === 'scraping').length,
        completed: jobs.filter(j => j.status === 'completed').length,
        failed: jobs.filter(j => j.status === 'failed').length,
      },
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get session jobs',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'SESSION_FETCH_ERROR',
    })
  }
})

/**
 * POST /api/kodi-sync/batch
 * 
 * Queue multiple URLs for batch processing
 */
router.post('/batch', (req: Request, res: Response) => {
  try {
    const { urls, kodi_session_id, kodi_source, metadata = {} } = req.body

    if (kodi_session_id) {
      updateLatestKodiSession(kodi_session_id, kodi_source)
    }

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        error: 'urls array is required and must not be empty',
        code: 'INVALID_BATCH',
      })
    }

    const batchResults = urls.map(sourceUrl => {
      try {
        new URL(sourceUrl)
        const repoDetection = detectRepositoryType(sourceUrl)
        const job: KodiSyncJob = {
          job_id: uuidv4(),
          status: 'queued',
          progress: 0,
          source_url: sourceUrl,
          repo_type: repoDetection.type,
          repo_url: repoDetection.repo_url,
          confidence_level: repoDetection.confidence,
          created_at: new Date(),
          updated_at: new Date(),
          kodi_session_id,
          kodi_source,
          content_intelligence_tags: {
            media_type: metadata.media_type || 'unknown',
            category: metadata.category,
            source_name: metadata.source_name || kodi_source,
            is_verified: false,
          },
        }

        jobQueue.set(job.job_id, job)
        if (kodi_session_id) {
          const sessionJobs = jobsBySession.get(kodi_session_id) || []
          sessionJobs.push(job.job_id)
          jobsBySession.set(kodi_session_id, sessionJobs)
        }

        queueAutoScrapeJob(job)

        return {
          source_url: sourceUrl,
          job_id: job.job_id,
          status: 'queued',
          repo_type: job.repo_type,
        }
      } catch (e) {
        return {
          source_url: sourceUrl,
          status: 'error',
          error: e instanceof Error ? e.message : 'Invalid URL',
        }
      }
    })

    res.status(202).json({
      success: true,
      batch_size: batchResults.length,
      results: batchResults,
      session_id: kodi_session_id,
      tracking: {
        session_endpoint: `/api/kodi-sync/session/${kodi_session_id}`,
      },
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to queue batch jobs',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'BATCH_QUEUE_ERROR',
    })
  }
})

/**
 * DELETE /api/kodi-sync/jobs/:jobId
 * 
 * Cancel a pending or running job
 */
router.delete('/jobs/:jobId', (req: Request, res: Response) => {
  try {
    const jobId = normalizeParam(req.params.jobId)
    const job = jobQueue.get(jobId)

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        code: 'JOB_NOT_FOUND',
      })
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return res.status(400).json({
        error: `Cannot cancel ${job.status} job`,
        code: 'INVALID_JOB_STATE',
      })
    }

    job.status = 'failed'
    job.results = {
      error: 'Job cancelled by user',
    }
    job.updated_at = new Date()

    res.json({
      success: true,
      message: 'Job cancelled',
      job_id: jobId,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to cancel job',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'CANCEL_ERROR',
    })
  }
})

/**
 * GET /api/kodi-sync/health
 * 
 * Get sync service health and queue statistics
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const allJobs = Array.from(jobQueue.values())

    res.json({
      success: true,
      status: 'operational',
      queue_stats: {
        total_jobs: allJobs.length,
        queued: allJobs.filter(j => j.status === 'queued').length,
        detecting: allJobs.filter(j => j.status === 'detecting').length,
        scraping: allJobs.filter(j => j.status === 'scraping').length,
        completed: allJobs.filter(j => j.status === 'completed').length,
        failed: allJobs.filter(j => j.status === 'failed').length,
      },
      active_sessions: jobsBySession.size,
      uptime_ms: process.uptime() * 1000,
      timestamp: new Date(),
    })
  } catch (error) {
    res.status(500).json({
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Detect repository type from media URL
 */
function detectRepositoryType(sourceUrl: string): {
  type: RepoType
  repo_url?: string
  confidence: 'high' | 'medium' | 'low'
} {
  try {
    const url = new URL(sourceUrl)
    const hostname = url.hostname.toLowerCase()

    // GitHub
    if (hostname.includes('github')) {
      const match = sourceUrl.match(/github[^/]*\.com\/([^/]+)\/([^/]+)/)
      if (match) {
        return {
          type: 'github',
          repo_url: `https://github.com/${match[1]}/${match[2]}`,
          confidence: 'high',
        }
      }
    }

    // GitLab
    if (hostname.includes('gitlab')) {
      const match = sourceUrl.match(/gitlab\.com\/([^/]+)\/([^/]+)/)
      if (match) {
        return {
          type: 'gitlab',
          repo_url: `https://gitlab.com/${match[1]}/${match[2]}`,
          confidence: 'high',
        }
      }
    }

    // Bitbucket
    if (hostname.includes('bitbucket')) {
      const match = sourceUrl.match(/bitbucket\.org\/([^/]+)\/([^/]+)/)
      if (match) {
        return {
          type: 'bitbucket',
          repo_url: `https://bitbucket.org/${match[1]}/${match[2]}`,
          confidence: 'high',
        }
      }
    }

    // Codeberg
    if (hostname.includes('codeberg')) {
      const match = sourceUrl.match(/codeberg\.org\/([^/]+)\/([^/]+)/)
      if (match) {
        return {
          type: 'codeberg',
          repo_url: `https://codeberg.org/${match[1]}/${match[2]}`,
          confidence: 'high',
        }
      }
    }

    // jsDelivr/CDN
    if (hostname.includes('jsdelivr') || hostname.includes('unpkg')) {
      return {
        type: 'web',
        repo_url: sourceUrl,
        confidence: 'medium',
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
 * Queue an auto-scrape job and trigger intelligent ingestion
 * This transitions the job from 'queued' to 'detecting' and begins processing
 */
async function queueAutoScrapeJob(job: KodiSyncJob) {
  // Simulate async job processing
  setTimeout(() => {
    job.status = 'detecting'
    job.updated_at = new Date()
    job.progress = 10
  }, 100)

  // Simulate scraping
  setTimeout(() => {
    job.status = 'scraping'
    job.progress = 30
    job.updated_at = new Date()
  }, 2000)

  // Simulate completion and trigger intelligent ingestion
  setTimeout(async () => {
    job.status = 'completed'
    job.progress = 100
    job.updated_at = new Date()
    job.results = {
      total_links_found: Math.floor(Math.random() * 500) + 50,
      total_files_scanned: Math.floor(Math.random() * 100) + 10,
      media_breakdown: {
        video_count: Math.floor(Math.random() * 300) + 20,
        audio_count: Math.floor(Math.random() * 100) + 5,
        playlist_count: Math.floor(Math.random() * 50) + 5,
      },
      file_types_found: ['m3u8', 'mp4', 'ts', 'xml', 'json'],
    }

    // Trigger intelligent ingestion automatically
    const ingestPayload: Agent1Payload = {
      job_id: job.job_id,
      source_url: job.source_url,
      repo_type: job.repo_type,
      repo_url: job.repo_url,
      confidence_level: job.confidence_level,
      kodi_session_id: job.kodi_session_id,
      kodi_source: job.kodi_source,
      metadata: {
        addon: {
          id: job.kodi_session_id,
          name: job.kodi_source,
          sourceUrl: job.repo_url // Will trigger Tier 1: Git Repository Scan
        },
        headers: {
          referer: job.source_url,
        },
        media_type: job.content_intelligence_tags.media_type,
        category: job.content_intelligence_tags.category,
        source_name: job.content_intelligence_tags.source_name,
      },
      results: job.results,
    }

    // Process ingestion (fire and forget for now)
    try {
      await intelligentIngestion.ingest(ingestPayload)
      console.log(
        `[AutoIngestion] Completed intelligent ingestion for job ${job.job_id}`
      )
    } catch (error) {
      console.error(
        `[AutoIngestion] Failed intelligent ingestion for job ${job.job_id}:`,
        error
      )
    }
  }, 5000)
}

/**
 * Generate M3U format from job results
 */
function generateM3UFromResults(job: KodiSyncJob): string {
  let m3u = '#EXTM3U\n'
  m3u += `#EXTINF:-1 group-title="Kodi Sync",${job.kodi_source || 'Kodi Sync'}\n`
  m3u += `${job.source_url}\n`
  return m3u
}

/**
 * Generate CSV format from job results
 */
function generateCSVFromResults(job: KodiSyncJob): string {
  const headers = [
    'job_id',
    'status',
    'source_url',
    'repo_type',
    'confidence',
    'total_links_found',
    'files_scanned',
    'created_at',
  ]

  const row = [
    job.job_id,
    job.status,
    job.source_url,
    job.repo_type,
    job.confidence_level,
    job.results?.total_links_found || 0,
    job.results?.total_files_scanned || 0,
    job.created_at.toISOString(),
  ]

  return headers.join(',') + '\n' + row.join(',') + '\n'
}

export default router
