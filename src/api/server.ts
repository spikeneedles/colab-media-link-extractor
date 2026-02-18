import express, { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { crawlRepository, type CrawlTarget, type CrawlerJob, type CrawlResult } from '../lib/crawler'
import { scanWebUrls, scanPlaylistUrls, type PlaylistAuthCredentials } from '../lib/linkExtractor'
import { 
  performHealthCheck, 
  checkSSLCertificate, 
  checkMultipleSSLCertificates,
  incrementRequestCount,
  formatBytes,
  getSSLStatusColor,
  getHealthStatusColor,
  type HealthCheckResult,
  type SSLCertificateInfo
} from '../lib/healthCheck'

const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())
app.use((req, res, next) => {
  incrementRequestCount()
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

const activeJobs = new Map<string, CrawlerJob>()

type ExternalScanRequest = {
  source_url: string
  label?: string
  media_type?: 'repository' | 'web' | 'file' | 'directory'
  depth?: number
  auth?: {
    username?: string
    password?: string
    apiKey?: string
    token?: string
  }
}

type ExternalScanResponse = {
  job_id: string
  status: 'accepted' | 'error'
  message: string
  timestamp: string
}

type JobStatusResponse = {
  job_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  started_at?: string
  completed_at?: string
  result?: {
    links: string[]
    links_count: number
    files_scanned: number
    errors: string[]
  }
  error?: string
}

app.post('/api/external-scan', async (req: Request, res: Response) => {
  try {
    const { source_url, label, media_type, depth, auth }: ExternalScanRequest = req.body

    if (!source_url) {
      return res.status(400).json({
        status: 'error',
        message: 'source_url is required',
        timestamp: new Date().toISOString()
      } as ExternalScanResponse)
    }

    const jobId = uuidv4()
    
    let detectedType: CrawlTarget['type'] = media_type || 'web'
    
    if (!media_type) {
      if (source_url.includes('github.com') || source_url.includes('gitlab.com') || 
          source_url.includes('bitbucket.org') || source_url.includes('codeberg.org')) {
        detectedType = 'repository'
      } else if (source_url.endsWith('.m3u') || source_url.endsWith('.m3u8') || 
                 source_url.includes('playlist')) {
        detectedType = 'web'
      }
    }

    const crawlTarget: CrawlTarget = {
      url: source_url,
      type: detectedType,
      depth: depth || 3
    }

    const job: CrawlerJob = {
      id: jobId,
      target: crawlTarget,
      status: 'pending',
      progress: 0,
      startedAt: new Date()
    }

    activeJobs.set(jobId, job)

    res.status(202).json({
      job_id: jobId,
      status: 'accepted',
      message: `Scan job created for ${source_url}${label ? ` (${label})` : ''}`,
      timestamp: new Date().toISOString()
    } as ExternalScanResponse)

    processScanJob(jobId, crawlTarget, auth).catch(error => {
      console.error(`Error processing job ${jobId}:`, error)
      const job = activeJobs.get(jobId)
      if (job) {
        job.status = 'failed'
        job.error = error.message
        job.completedAt = new Date()
        activeJobs.set(jobId, job)
      }
    })

  } catch (error) {
    console.error('Error creating scan job:', error)
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    } as ExternalScanResponse)
  }
})

async function processScanJob(
  jobId: string, 
  target: CrawlTarget, 
  auth?: ExternalScanRequest['auth']
): Promise<void> {
  const job = activeJobs.get(jobId)
  if (!job) return

  job.status = 'running'
  activeJobs.set(jobId, job)

  try {
    if (target.type === 'repository') {
      const result = await crawlRepository(
        target.url,
        target.depth,
        (current, total, currentFile) => {
          const job = activeJobs.get(jobId)
          if (job) {
            job.progress = (current / total) * 100
            activeJobs.set(jobId, job)
          }
        }
      )

      job.status = 'completed'
      job.progress = 100
      job.result = result
      job.completedAt = new Date()
      activeJobs.set(jobId, job)

    } else if (target.type === 'web') {
      if (target.url.endsWith('.m3u') || target.url.endsWith('.m3u8') || target.url.includes('playlist')) {
        const authCredentials = new Map<string, PlaylistAuthCredentials>()
        if (auth) {
          const creds: PlaylistAuthCredentials = {}
          if (auth.username && auth.password) {
            creds.username = auth.username
            creds.password = auth.password
          }
          if (auth.apiKey) {
            creds.apiKey = auth.apiKey
          }
          if (auth.token) {
            creds.token = auth.token
          }
          if (Object.keys(creds).length > 0) {
            authCredentials.set(target.url, creds)
          }
        }

        const scanResults = await scanPlaylistUrls(
          [target.url],
          (current, total) => {
            const job = activeJobs.get(jobId)
            if (job) {
              job.progress = (current / total) * 100
              activeJobs.set(jobId, job)
            }
          },
          authCredentials
        )

        const result = scanResults[0]
        if (result.error) {
          throw new Error(result.error)
        }

        const crawlResult = {
          id: jobId,
          timestamp: new Date(),
          target,
          links: result.links,
          linksWithMetadata: result.linksWithMetadata,
          epgData: result.epgData,
          configFiles: [],
          filesScanned: 1,
          errors: [],
          status: 'completed' as const
        }

        job.status = 'completed'
        job.progress = 100
        job.result = crawlResult
        job.completedAt = new Date()
        activeJobs.set(jobId, job)

      } else {
        const scanResults = await scanWebUrls(
          [target.url],
          (current, total) => {
            const job = activeJobs.get(jobId)
            if (job) {
              job.progress = (current / total) * 100
              activeJobs.set(jobId, job)
            }
          }
        )

        const result = scanResults[0]
        if (result.error) {
          throw new Error(result.error)
        }

        const crawlResult = {
          id: jobId,
          timestamp: new Date(),
          target,
          links: result.links,
          linksWithMetadata: [],
          configFiles: [],
          filesScanned: 1,
          errors: [],
          status: 'completed' as const
        }

        job.status = 'completed'
        job.progress = 100
        job.result = crawlResult
        job.completedAt = new Date()
        activeJobs.set(jobId, job)
      }
    }

  } catch (error) {
    job.status = 'failed'
    job.error = error instanceof Error ? error.message : 'Unknown error'
    job.completedAt = new Date()
    activeJobs.set(jobId, job)
  }
}

app.get('/api/jobs/:jobId', (req: Request, res: Response) => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId
  const job = activeJobs.get(jobId)

  if (!job) {
    return res.status(404).json({
      status: 'error',
      message: `Job ${jobId} not found`,
      timestamp: new Date().toISOString()
    })
  }

  const response: JobStatusResponse = {
    job_id: job.id,
    status: job.status,
    progress: job.progress,
    started_at: job.startedAt?.toISOString(),
    completed_at: job.completedAt?.toISOString(),
    error: job.error
  }

  if (job.result) {
    response.result = {
      links: job.result.links,
      links_count: job.result.links.length,
      files_scanned: job.result.filesScanned,
      errors: job.result.errors
    }
  }

  res.json(response)
})

app.get('/api/jobs', (req: Request, res: Response) => {
  const jobs = Array.from(activeJobs.values()).map(job => ({
    job_id: job.id,
    status: job.status,
    progress: job.progress,
    target_url: job.target.url,
    target_type: job.target.type,
    started_at: job.startedAt?.toISOString(),
    completed_at: job.completedAt?.toISOString(),
    links_count: job.result?.links.length || 0
  }))

  res.json({
    jobs,
    total: jobs.length,
    timestamp: new Date().toISOString()
  })
})

app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const sslDomains = req.query.ssl_domains 
      ? (Array.isArray(req.query.ssl_domains) 
          ? req.query.ssl_domains as string[]
          : [req.query.ssl_domains as string])
      : undefined

    const healthCheck = await performHealthCheck(activeJobs, sslDomains)
    
    const statusCode = healthCheck.status === 'healthy' ? 200 
      : healthCheck.status === 'degraded' ? 200 
      : 503

    res.status(statusCode).json(healthCheck)
  } catch (error) {
    console.error('Health check error:', error)
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed'
    })
  }
})

app.get('/api/health/simple', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    active_jobs: activeJobs.size
  })
})

app.get('/api/health/ssl/:domain', async (req: Request, res: Response) => {
  try {
    const domain = Array.isArray(req.params.domain) ? req.params.domain[0] : req.params.domain
    
    if (!domain) {
      return res.status(400).json({
        status: 'error',
        message: 'Domain parameter is required',
        timestamp: new Date().toISOString()
      })
    }

    const certInfo = await checkSSLCertificate(domain)
    
    res.json({
      domain,
      certificate: certInfo,
      status: certInfo.isValid ? 'valid' : certInfo.isExpired ? 'expired' : 'invalid',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('SSL check error:', error)
    res.status(500).json({
      status: 'error',
      domain: req.params.domain,
      message: error instanceof Error ? error.message : 'SSL check failed',
      timestamp: new Date().toISOString()
    })
  }
})

app.post('/api/health/ssl/batch', async (req: Request, res: Response) => {
  try {
    const { domains }: { domains: string[] } = req.body

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'domains array is required',
        timestamp: new Date().toISOString()
      })
    }

    const results = await checkMultipleSSLCertificates(domains)
    
    const response: Record<string, any> = {
      timestamp: new Date().toISOString(),
      total_domains: domains.length,
      certificates: {}
    }

    results.forEach((result, domain) => {
      if (result instanceof Error) {
        response.certificates[domain] = {
          status: 'error',
          message: result.message
        }
      } else {
        response.certificates[domain] = {
          status: result.isValid ? 'valid' : result.isExpired ? 'expired' : 'invalid',
          certificate: result
        }
      }
    })

    res.json(response)
  } catch (error) {
    console.error('Batch SSL check error:', error)
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Batch SSL check failed',
      timestamp: new Date().toISOString()
    })
  }
})

app.delete('/api/jobs/:jobId', (req: Request, res: Response) => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId
  const job = activeJobs.get(jobId)

  if (!job) {
    return res.status(404).json({
      status: 'error',
      message: `Job ${jobId} not found`,
      timestamp: new Date().toISOString()
    })
  }

  if (job.status === 'running') {
    return res.status(400).json({
      status: 'error',
      message: 'Cannot delete a running job',
      timestamp: new Date().toISOString()
    })
  }

  activeJobs.delete(jobId)

  res.json({
    status: 'success',
    message: `Job ${jobId} deleted`,
    timestamp: new Date().toISOString()
  })
})

export function startServer(): void {
  app.listen(PORT, () => {
    console.log(`🚀 Media Link Scanner API running on port ${PORT}`)
    console.log(`📡 Health check: http://localhost:${PORT}/api/health`)
    console.log(`📡 Simple health: http://localhost:${PORT}/api/health/simple`)
    console.log(`🔒 SSL check: http://localhost:${PORT}/api/health/ssl/:domain`)
    console.log(`🔒 Batch SSL: http://localhost:${PORT}/api/health/ssl/batch`)
    console.log(`📋 POST endpoint: http://localhost:${PORT}/api/external-scan`)
  })
}

if (require.main === module) {
  startServer()
}

export default app
