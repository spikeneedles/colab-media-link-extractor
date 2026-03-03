/**
 * Media Processing Routes
 * 
 * Orchestrates the complete media extraction, enrichment, and classification pipeline
 * Workflow: Load URLs → Validate → Extract playlists → Deduplicate → Enrich → Classify
 */

import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { playlistExtractor } from '../services/PlaylistExtractor.js'
import { mediaMetadataEnricher, EnrichedMedia } from '../services/MediaMetadataEnricher.js'

const router = Router()

// In-memory storage for processing jobs
const processingJobs = new Map<string, {
  id: string
  status: 'pending' | 'processing' | 'extracting' | 'enriching' | 'classifying' | 'complete' | 'error'
  progress: number
  totalUrls: number
  processedUrls: number
  extractedCount: number
  movies: EnrichedMedia[]
  series: EnrichedMedia[]
  liveTV: EnrichedMedia[]
  extraContent: EnrichedMedia[]
  error?: string
  startedAt: Date
  completedAt?: Date
}>()

/**
 * Process and classify media URLs
 * POST /api/media/process-and-classify
 * 
 * Body:
 * {
 *   urls?: string[],
 *   items?: Array<{ url: string, title?: string, seeders?: number, indexer?: string, size?: number, leechers?: number }>,
 *   jobId?: string
 * }
 */
router.post('/process-and-classify', async (req: Request, res: Response) => {
  try {
    const { urls, items, jobId: requestJobId } = req.body

    // Support both old format (urls array) and new format (items with metadata)
    let inputItems: any[] = []
    if (Array.isArray(items) && items.length > 0) {
      inputItems = items
    } else if (Array.isArray(urls) && urls.length > 0) {
      inputItems = urls.map(url => ({ url }))
    } else {
      return res.status(400).json({
        error: 'Invalid input: urls or items must be a non-empty array',
      })
    }

    const jobId = requestJobId || uuidv4()
    const job = {
      id: jobId,
      status: 'processing' as const,
      progress: 0,
      totalUrls: inputItems.length,
      processedUrls: 0,
      extractedCount: 0,
      movies: [] as EnrichedMedia[],
      series: [] as EnrichedMedia[],
      liveTV: [] as EnrichedMedia[],
      extraContent: [] as EnrichedMedia[],
      startedAt: new Date(),
    }

    processingJobs.set(jobId, job)

    // Process asynchronously
    processMediaAsync(jobId, inputItems).catch(error => {
      const job = processingJobs.get(jobId)
      if (job) {
        job.status = 'error'
        job.error = error.message
        job.completedAt = new Date()
      }
    })

    res.json({
      id: jobId,
      status: job.status,
      progress: job.progress,
      message: 'Processing started',
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to start processing',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * Get processing job status
 * GET /api/media/process-and-classify/:id/status
 */
router.get('/process-and-classify/:id/status', (req: Request, res: Response) => {
  const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const job = processingJobs.get(jobId)

  if (!job) {
    return res.status(404).json({ error: 'Job not found' })
  }

  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    totalUrls: job.totalUrls,
    processedUrls: job.processedUrls,
    extractedCount: job.extractedCount,
    counts: {
      movies: job.movies.length,
      series: job.series.length,
      liveTV: job.liveTV.length,
      extraContent: job.extraContent.length,
    },
    error: job.error,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  })
})

/**
 * Get processing results
 * GET /api/media/process-and-classify/:id/results
 */
router.get('/process-and-classify/:id/results', (req: Request, res: Response) => {
  const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const job = processingJobs.get(jobId)

  if (!job) {
    return res.status(404).json({ error: 'Job not found' })
  }

  if (job.status !== 'complete') {
    return res.status(202).json({
      message: `Job is ${job.status}`,
      progress: job.progress,
      status: job.status,
    })
  }

  res.json({
    id: job.id,
    status: job.status,
    summary: {
      total: job.movies.length + job.series.length + job.liveTV.length + job.extraContent.length,
      movies: {
        count: job.movies.length,
        items: job.movies,
      },
      series: {
        count: job.series.length,
        items: job.series,
      },
      liveTV: {
        count: job.liveTV.length,
        items: job.liveTV,
      },
      extraContent: {
        count: job.extraContent.length,
        items: job.extraContent,
      },
    },
    processingTime: job.completedAt
      ? Math.round((job.completedAt.getTime() - job.startedAt.getTime()) / 1000)
      : undefined,
  })
})

/**
 * Generate M3U playlists from classified media
 * POST /api/media/generate-playlists/:id
 * 
 * Body:
 * {
 *   categories?: array of 'movies' | 'series' | 'live-tv' (defaults to all)
 *   includeEpg?: boolean (include EPG data in M3U)
 * }
 */
router.post('/generate-playlists/:id', (req: Request, res: Response) => {
  const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const job = processingJobs.get(jobId)

  if (!job) {
    return res.status(404).json({ error: 'Job not found' })
  }

  if (job.status !== 'complete') {
    return res.status(400).json({
      error: 'Job not complete',
      status: job.status,
    })
  }

  const { categories = ['movies', 'series', 'live-tv', 'extra-content'], includeEpg = true } = req.body

  const playlists: Record<string, string> = {}

  if (categories.includes('movies') && job.movies.length > 0) {
    playlists.movies = generateM3U(job.movies, 'Movies', includeEpg)
  }

  if (categories.includes('series') && job.series.length > 0) {
    playlists.series = generateM3U(job.series, 'Series', includeEpg)
  }

  if (categories.includes('live-tv') && job.liveTV.length > 0) {
    playlists['live-tv'] = generateM3U(job.liveTV, 'Live Television', includeEpg)
  }

  if (categories.includes('extra-content') && job.extraContent.length > 0) {
    playlists['extra-content'] = generateM3U(job.extraContent, 'Extra Content', includeEpg)
  }

  res.json({
    id: job.id,
    playlists,
  })
})

/**
 * Download playlist file
 * GET /api/media/download-playlist/:id/:category
 * category: movies | series | live-tv | extra-content
 */
router.get('/download-playlist/:id/:category', (req: Request, res: Response) => {
  const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const job = processingJobs.get(jobId)

  if (!job) {
    return res.status(404).json({ error: 'Job not found' })
  }

  const categoryParam = Array.isArray(req.params.category) ? req.params.category[0] : req.params.category
  const category = categoryParam as 'movies' | 'series' | 'live-tv' | 'extra-content'
  let playlist: string | null = null
  let label = ''

  if (category === 'movies') {
    playlist = generateM3U(job.movies, 'Movies')
    label = 'Movies'
  } else if (category === 'series') {
    playlist = generateM3U(job.series, 'Series')
    label = 'Series'
  } else if (category === 'live-tv') {
    playlist = generateM3U(job.liveTV, 'Live Television')
    label = 'Live TV'
  } else if (category === 'extra-content') {
    playlist = generateM3U(job.extraContent, 'Extra Content')
    label = 'Extra Content'
  }

  if (!playlist) {
    return res.status(404).json({
      error: `No ${category} found`,
    })
  }

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${label}.m3u8"`)
  res.send(playlist)
})

/**
 * Clear processing job (optional)
 * DELETE /api/media/process-and-classify/:id
 */
router.delete('/process-and-classify/:id', (req: Request, res: Response) => {
  const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const deleted = processingJobs.delete(jobId)

  res.json({
    success: deleted,
    message: deleted ? 'Job cleared' : 'Job not found',
  })
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Concurrency limiter - process promises in parallel with max concurrent limit
 */
async function promiseLimit<T>(
  promises: (() => Promise<T>)[],
  maxConcurrency: number
): Promise<T[]> {
  const results: T[] = []
  const executing: Promise<void>[] = []

  for (let i = 0; i < promises.length; i++) {
    const promise = promises[i]().then(
      result => {
        results[i] = result
      },
      error => {
        results[i] = error
      }
    )

    executing.push(promise)

    if (executing.length >= maxConcurrency) {
      await Promise.race(executing)
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      )
    }
  }

  await Promise.all(executing)
  return results
}

async function processMediaAsync(jobId: string, inputItems: any[]) {
  const job = processingJobs.get(jobId)
  if (!job) return

  try {
    job.status = 'extracting'

    // Step 1: Process items - either extract from URLs or use provided metadata
    const allExtractedMedia = []
    const MAX_CONCURRENT_EXTRACTIONS = 25

    // Create extraction tasks
    const extractionTasks = inputItems.map((item, index) => async () => {
      try {
        // If item has title metadata, use it directly
        if (typeof item === 'object' && item.title) {
          const mediaItem = {
            url: item.url,
            title: item.title,
            category: undefined,
            description: undefined,
            logo: undefined,
            seeders: item.seeders,
            indexer: item.indexer,
            size: item.size,
            leechers: item.leechers,
          }
          job.extractedCount += 1
          job.processedUrls = Math.min(job.processedUrls + 1, inputItems.length)
          job.progress = Math.round((job.processedUrls / job.totalUrls) * 50)
          return [mediaItem]
        }

        // Otherwise, try to extract media from playlist URLs
        const url = typeof item === 'string' ? item : item.url
        const extractedMedia = await playlistExtractor.extractFromPlaylist(url)

        if (extractedMedia && extractedMedia.length > 0) {
          job.extractedCount += extractedMedia.length
        } else {
          // If no extraction, treat URL itself as a media item
          extractedMedia.push({
            url,
            title: undefined,
            category: undefined,
            description: undefined,
            logo: undefined,
          })
        }

        // Update progress (first 50% is extraction)
        job.processedUrls = Math.min(job.processedUrls + 1, inputItems.length)
        job.progress = Math.round((job.processedUrls / job.totalUrls) * 50)

        return extractedMedia
      } catch (error) {
        console.error(`[Processing] Error extracting from item:`, error)
        const url = typeof item === 'string' ? item : item.url
        // If extraction fails, add the URL directly
        job.processedUrls = Math.min(job.processedUrls + 1, inputItems.length)
        job.progress = Math.round((job.processedUrls / job.totalUrls) * 50)

        return [
          {
            url,
            title: undefined,
            category: undefined,
            description: undefined,
            logo: undefined,
          },
        ]
      }
    })

    // Process extractions in parallel
    const extractionResults = await promiseLimit(extractionTasks, MAX_CONCURRENT_EXTRACTIONS)

    // Flatten results
    for (const result of extractionResults) {
      if (Array.isArray(result)) {
        allExtractedMedia.push(...result)
      }
    }

    // Step 2: Enrich and classify
    job.status = 'enriching'
    const enrichmentResult = mediaMetadataEnricher.enrich(allExtractedMedia)
    console.log('[MediaProcessing] Enrichment complete:', {
      totalExtracted: allExtractedMedia.length,
      totalEnriched: enrichmentResult.media.length,
      byType: enrichmentResult.byContentType,
    })

    job.status = 'classifying'
    const classified = mediaMetadataEnricher.sortByContentType(enrichmentResult.media)
    console.log('[MediaProcessing] Classified results:', {
      movies: classified.movies?.length || 0,
      series: classified.series?.length || 0,
      liveTV: classified.liveTV?.length || 0,
      total: (classified.movies?.length || 0) + (classified.series?.length || 0) + (classified.liveTV?.length || 0),
    })

    job.movies = classified.movies
    job.series = classified.series
    job.liveTV = classified.liveTV
    job.extraContent = classified.extraContent

    job.status = 'complete'
    job.progress = 100
    job.completedAt = new Date()
  } catch (error) {
    job.status = 'error'
    job.error = error instanceof Error ? error.message : 'Unknown error'
    job.completedAt = new Date()
  }
}

function generateM3U(
  media: EnrichedMedia[],
  title: string,
  includeEpg = true
): string {
  let m3u = '#EXTM3U'

  if (includeEpg) {
    m3u += ' x-tvg-url="http://epg.example.com/epg.xml" x-tvg-logo="https://example.com/logo.png"'
  }

  m3u += '\n'

  for (const item of media) {
    // Build EXTINF line
    let extinf = `#EXTINF:-1 `

    if (item.logo) {
      extinf += `tvg-logo="${item.logo}" `
    }

    if (item.category) {
      extinf += `group-title="${item.category}" `
    }

    if (item.genre && item.genre.length > 0) {
      extinf += `tvg-genre="${item.genre.join(',')}" `
    }

    // Add duration and title
    const duration = item.duration || -1
    extinf += `tvg-name="${item.title}",${item.title}\n`

    m3u += extinf
    m3u += `${item.url}\n`
  }

  return m3u
}

export default router
