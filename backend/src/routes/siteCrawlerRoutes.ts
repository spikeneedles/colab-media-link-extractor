/**
 * siteCrawlerRoutes.ts — REST + SSE endpoints for the full site indexer
 *
 *  POST /api/site-crawler/start           { url }  → { jobId }
 *  GET  /api/site-crawler/status/:id      SSE stream of progress events
 *  POST /api/site-crawler/stop/:id        stop a running job
 *  GET  /api/site-crawler/jobs            list all jobs (summary)
 */

import { Router, Request, Response } from 'express'
import { siteCrawler }               from '../services/SiteCrawlerService.js'

const router = Router()

// ── Start ─────────────────────────────────────────────────────────────────────

router.post('/start', async (req: Request, res: Response) => {
  const { url } = req.body
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' })
  }

  // Auto-prepend https:// if no protocol given (e.g. "www.eporner.com")
  const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`
  try { new URL(normalizedUrl) } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  const job = await siteCrawler.startCrawl(normalizedUrl)
  res.json({ jobId: job.id, domain: job.domain, startedAt: job.startedAt })
})

// ── SSE progress stream ───────────────────────────────────────────────────────

router.get('/status/:id', (req: Request, res: Response) => {
  const jobId = req.params.id as string
  const job = siteCrawler.getJob(jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })

  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  // Send current state immediately (include crawlerStats + categories)
  send({
    type:         'status',
    status:       job.status,
    visited:      job.pagesVisited,
    queued:       job.pagesQueued,
    media:        job.mediaFound,
    archived:     job.mediaArchived,
    crawlerStats: job.crawlerStats,
    categories:   job.categories,
  })

  if (job.status !== 'running') {
    res.end()
    return
  }

  // Subscribe to future events
  const onEvent = (event: object) => {
    send(event)
    if ((event as any).type === 'complete' || (event as any).type === 'error') {
      res.end()
      siteCrawler.removeListener(`job:${jobId}`, onEvent)
    }
  }

  siteCrawler.on(`job:${jobId}`, onEvent)
  req.on('close', () => siteCrawler.removeListener(`job:${jobId}`, onEvent))
})

// ── Stop ─────────────────────────────────────────────────────────────────────

router.post('/stop/:id', (req: Request, res: Response) => {
  const jobId = req.params.id as string
  const job = siteCrawler.getJob(jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  siteCrawler.stopCrawl(jobId)
  res.json({ stopped: true, jobId })
})

// ── List ─────────────────────────────────────────────────────────────────────

router.get('/jobs', (_req: Request, res: Response) => {
  const jobs = siteCrawler.listJobs().map(j => ({
    id:           j.id,
    domain:       j.domain,
    baseUrl:      j.baseUrl,
    status:       j.status,
    pagesVisited: j.pagesVisited,
    pagesQueued:  j.pagesQueued,
    mediaFound:   j.mediaFound,
    mediaArchived: j.mediaArchived,
    startedAt:    j.startedAt,
    completedAt:  j.completedAt,
    error:        j.error,
  }))
  res.json(jobs)
})

// ── Cookie store (per-domain, in-memory) ─────────────────────────────────────

router.get('/cookies', (_req: Request, res: Response) => {
  res.json(siteCrawler.listCookieDomains())
})

router.post('/cookies/:domain', (req: Request, res: Response) => {
  const domain  = req.params.domain as string
  const { cookies } = req.body
  if (!cookies) { res.status(400).json({ error: 'cookies required' }); return }
  siteCrawler.setCookies(domain, cookies)
  res.json({ ok: true, domain, count: Array.isArray(cookies) ? cookies.length : '(raw string)' })
})

router.get('/cookies/:domain', (req: Request, res: Response) => {
  const domain = req.params.domain as string
  res.json({ domain, cookies: siteCrawler.getCookies(domain) })
})

router.delete('/cookies/:domain', (req: Request, res: Response) => {
  siteCrawler.clearCookies(req.params.domain as string)
  res.json({ ok: true })
})

export default router

