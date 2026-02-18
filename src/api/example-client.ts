/**
 * Example client for the Media Link Scanner API
 * 
 * This demonstrates how to use the API programmatically from another application.
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001'

interface ScanJobRequest {
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

interface ScanJobResponse {
  job_id: string
  status: 'accepted' | 'error'
  message: string
  timestamp: string
}

interface JobStatus {
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

class MediaScannerClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  /**
   * Create a new scan job
   */
  async createScan(request: ScanJobRequest): Promise<ScanJobResponse> {
    const response = await fetch(`${this.baseUrl}/api/external-scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to create scan job')
    }

    return await response.json()
  }

  /**
   * Get the status of a scan job
   */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    const response = await fetch(`${this.baseUrl}/api/jobs/${jobId}`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get job status')
    }

    return await response.json()
  }

  /**
   * Wait for a job to complete with polling
   */
  async waitForCompletion(
    jobId: string,
    onProgress?: (progress: number) => void,
    pollInterval: number = 2000
  ): Promise<JobStatus> {
    while (true) {
      const status = await this.getJobStatus(jobId)

      if (onProgress) {
        onProgress(status.progress)
      }

      if (status.status === 'completed' || status.status === 'failed') {
        return status
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }

  /**
   * List all jobs
   */
  async listJobs(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/jobs`)

    if (!response.ok) {
      throw new Error('Failed to list jobs')
    }

    return await response.json()
  }

  /**
   * Delete a job
   */
  async deleteJob(jobId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/jobs/${jobId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to delete job')
    }
  }

  /**
   * Check API health
   */
  async healthCheck(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/health`)

    if (!response.ok) {
      throw new Error('API is not healthy')
    }

    return await response.json()
  }
}

// Example usage
async function exampleUsage() {
  const client = new MediaScannerClient()

  // Check if API is running
  try {
    const health = await client.healthCheck()
    console.log('API Health:', health)
  } catch (error) {
    console.error('API is not running:', error)
    return
  }

  // Create a scan job for a GitHub repository
  console.log('\n=== Creating Scan Job ===')
  const scanRequest: ScanJobRequest = {
    source_url: 'https://github.com/iptv-org/iptv',
    label: 'IPTV.org Repository',
    media_type: 'repository',
    depth: 2,
  }

  const scanResponse = await client.createScan(scanRequest)
  console.log('Job created:', scanResponse)

  // Wait for completion with progress updates
  console.log('\n=== Waiting for Completion ===')
  const result = await client.waitForCompletion(
    scanResponse.job_id,
    (progress) => {
      console.log(`Progress: ${progress.toFixed(2)}%`)
    }
  )

  if (result.status === 'completed') {
    console.log('\n=== Scan Complete ===')
    console.log(`Links found: ${result.result?.links_count}`)
    console.log(`Files scanned: ${result.result?.files_scanned}`)
    console.log(`Errors: ${result.result?.errors.length}`)
    
    // Display first 10 links
    if (result.result && result.result.links.length > 0) {
      console.log('\nFirst 10 links:')
      result.result.links.slice(0, 10).forEach((link, i) => {
        console.log(`  ${i + 1}. ${link}`)
      })
    }
  } else {
    console.error('\n=== Scan Failed ===')
    console.error('Error:', result.error)
  }

  // List all jobs
  console.log('\n=== All Jobs ===')
  const jobs = await client.listJobs()
  console.log(`Total jobs: ${jobs.total}`)
  jobs.jobs.forEach((job: any) => {
    console.log(`- ${job.job_id}: ${job.status} (${job.links_count} links)`)
  })
}

// Example: Scan a playlist with authentication
async function examplePlaylistScan() {
  const client = new MediaScannerClient()

  const scanRequest: ScanJobRequest = {
    source_url: 'http://provider.tv/playlist.m3u8',
    label: 'Protected Playlist',
    auth: {
      username: 'user123',
      password: 'pass456',
    },
  }

  try {
    const response = await client.createScan(scanRequest)
    console.log('Playlist scan started:', response.job_id)

    const result = await client.waitForCompletion(response.job_id)
    
    if (result.status === 'completed') {
      console.log('Playlist scan complete!')
      console.log(`Found ${result.result?.links_count} media links`)
    }
  } catch (error) {
    console.error('Playlist scan failed:', error)
  }
}

// Example: Batch scanning multiple repositories
async function exampleBatchScan() {
  const client = new MediaScannerClient()

  const repositories = [
    'https://github.com/iptv-org/iptv',
    'https://github.com/Free-TV/IPTV',
    'https://github.com/iptv-org/awesome-iptv',
  ]

  console.log(`Starting batch scan of ${repositories.length} repositories...`)

  const jobs = await Promise.all(
    repositories.map(url =>
      client.createScan({
        source_url: url,
        label: url.split('/').pop() || url,
        media_type: 'repository',
        depth: 2,
      })
    )
  )

  console.log(`Created ${jobs.length} scan jobs`)

  // Wait for all to complete
  const results = await Promise.all(
    jobs.map(job => client.waitForCompletion(job.job_id))
  )

  console.log('\n=== Batch Scan Results ===')
  results.forEach((result, i) => {
    console.log(`\nRepository ${i + 1}:`)
    console.log(`  Status: ${result.status}`)
    console.log(`  Links: ${result.result?.links_count || 0}`)
    console.log(`  Files: ${result.result?.files_scanned || 0}`)
  })

  const totalLinks = results.reduce(
    (sum, r) => sum + (r.result?.links_count || 0),
    0
  )
  console.log(`\nTotal links found: ${totalLinks}`)
}

// Export for use in other modules
export { MediaScannerClient, type ScanJobRequest, type ScanJobResponse, type JobStatus }

// Run example if executed directly
if (require.main === module) {
  exampleUsage().catch(console.error)
}
