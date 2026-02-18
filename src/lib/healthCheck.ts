import https from 'https'
import { URL } from 'url'
import { TLSSocket } from 'tls'

export interface SSLCertificateInfo {
  subject: {
    CN?: string
    O?: string
    OU?: string
    C?: string
  }
  issuer: {
    CN?: string
    O?: string
    C?: string
  }
  validFrom: string
  validTo: string
  daysRemaining: number
  isValid: boolean
  isExpired: boolean
  isExpiringSoon: boolean
  serialNumber: string
  fingerprint: string
  fingerprint256: string
  subjectAltNames?: string[]
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  environment: string
  services: {
    api: ServiceHealth
    database: ServiceHealth
    crawler: ServiceHealth
    ssl?: SSLHealth
  }
  system: SystemHealth
  metrics: MetricsData
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded'
  responseTime?: number
  lastCheck: string
  message?: string
  details?: Record<string, any>
}

export interface SSLHealth {
  status: 'valid' | 'expiring' | 'expired' | 'invalid' | 'unavailable'
  certificates: SSLCertificateInfo[]
  warnings: string[]
  errors: string[]
}

export interface SystemHealth {
  memory: {
    total: number
    used: number
    free: number
    usagePercent: number
  }
  cpu: {
    loadAverage: number[]
    coresCount: number
  }
  process: {
    pid: number
    uptime: number
    memoryUsage: {
      rss: number
      heapTotal: number
      heapUsed: number
      external: number
    }
  }
}

export interface MetricsData {
  totalJobs: number
  activeJobs: number
  completedJobs: number
  failedJobs: number
  totalLinksScanned: number
  averageJobDuration: number
  requestsPerMinute: number
}

const startTime = Date.now()
let requestCount = 0
let lastRequestReset = Date.now()

export function incrementRequestCount(): void {
  requestCount++
  
  const now = Date.now()
  if (now - lastRequestReset >= 60000) {
    requestCount = 1
    lastRequestReset = now
  }
}

export async function checkSSLCertificate(hostname: string, port: number = 443): Promise<SSLCertificateInfo> {
  return new Promise((resolve, reject) => {
    const options = {
      host: hostname,
      port: port,
      method: 'GET',
      rejectUnauthorized: false,
      agent: false
    }

    const req = https.request(options, (res) => {
      const socket = res.socket as TLSSocket
      const cert = socket.getPeerCertificate(true)
      
      if (!cert || Object.keys(cert).length === 0) {
        reject(new Error('No certificate found'))
        return
      }

      const validTo = new Date(cert.valid_to)
      const validFrom = new Date(cert.valid_from)
      const now = new Date()
      
      const daysRemaining = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const isExpired = now > validTo
      const isExpiringSoon = daysRemaining <= 30 && daysRemaining > 0
      const isValid = now >= validFrom && now <= validTo

      const subjectAltNames = cert.subjectaltname?.split(', ').map((name: string) => 
        name.replace('DNS:', '')
      ) || []

      const certInfo: SSLCertificateInfo = {
        subject: {
          CN: cert.subject?.CN,
          O: cert.subject?.O,
          OU: cert.subject?.OU,
          C: cert.subject?.C
        },
        issuer: {
          CN: cert.issuer?.CN,
          O: cert.issuer?.O,
          C: cert.issuer?.C
        },
        validFrom: validFrom.toISOString(),
        validTo: validTo.toISOString(),
        daysRemaining,
        isValid,
        isExpired,
        isExpiringSoon,
        serialNumber: cert.serialNumber,
        fingerprint: cert.fingerprint,
        fingerprint256: cert.fingerprint256 || '',
        subjectAltNames
      }

      resolve(certInfo)
      req.abort()
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.on('timeout', () => {
      req.abort()
      reject(new Error('SSL certificate check timeout'))
    })

    req.setTimeout(5000)
    req.end()
  })
}

export async function checkMultipleSSLCertificates(domains: string[]): Promise<Map<string, SSLCertificateInfo | Error>> {
  const results = new Map<string, SSLCertificateInfo | Error>()
  
  const promises = domains.map(async (domain) => {
    try {
      const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`)
      const hostname = url.hostname
      const port = url.port ? parseInt(url.port) : 443
      
      const certInfo = await checkSSLCertificate(hostname, port)
      results.set(domain, certInfo)
    } catch (error) {
      results.set(domain, error as Error)
    }
  })

  await Promise.all(promises)
  return results
}

export function getSystemHealth(): SystemHealth {
  const memUsage = process.memoryUsage()
  const cpuUsage = process.cpuUsage()
  const loadAvg = process.platform === 'win32' ? [0, 0, 0] : require('os').loadavg()
  const totalMem = require('os').totalmem()
  const freeMem = require('os').freemem()
  const usedMem = totalMem - freeMem

  return {
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      usagePercent: Math.round((usedMem / totalMem) * 100)
    },
    cpu: {
      loadAverage: loadAvg,
      coresCount: require('os').cpus().length
    },
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external
      }
    }
  }
}

export function calculateRequestsPerMinute(): number {
  const now = Date.now()
  const elapsedMinutes = (now - lastRequestReset) / 60000
  return elapsedMinutes > 0 ? Math.round(requestCount / elapsedMinutes) : 0
}

export function getUptime(): number {
  return Math.floor((Date.now() - startTime) / 1000)
}

export async function performHealthCheck(
  activeJobsMap: Map<string, any>,
  sslDomains?: string[]
): Promise<HealthCheckResult> {
  const apiCheckStart = Date.now()
  const apiStatus: ServiceHealth = {
    status: 'up',
    responseTime: Date.now() - apiCheckStart,
    lastCheck: new Date().toISOString(),
    message: 'API service is operational'
  }

  const dbStatus: ServiceHealth = {
    status: 'up',
    lastCheck: new Date().toISOString(),
    message: 'In-memory storage operational',
    details: {
      jobsStored: activeJobsMap.size
    }
  }

  const crawlerStatus: ServiceHealth = {
    status: 'up',
    lastCheck: new Date().toISOString(),
    message: 'Crawler service operational',
    details: {
      activeJobs: Array.from(activeJobsMap.values()).filter((j: any) => j.status === 'running').length
    }
  }

  let sslHealth: SSLHealth | undefined

  if (sslDomains && sslDomains.length > 0) {
    const sslResults = await checkMultipleSSLCertificates(sslDomains)
    const certificates: SSLCertificateInfo[] = []
    const warnings: string[] = []
    const errors: string[] = []

    sslResults.forEach((result, domain) => {
      if (result instanceof Error) {
        errors.push(`${domain}: ${result.message}`)
      } else {
        certificates.push(result)
        
        if (result.isExpired) {
          errors.push(`${domain}: Certificate expired on ${result.validTo}`)
        } else if (result.isExpiringSoon) {
          warnings.push(`${domain}: Certificate expires in ${result.daysRemaining} days`)
        }
        
        if (!result.isValid) {
          warnings.push(`${domain}: Certificate is not yet valid or has expired`)
        }
      }
    })

    let sslStatus: SSLHealth['status'] = 'valid'
    if (errors.length > 0) {
      sslStatus = 'expired'
    } else if (warnings.length > 0) {
      sslStatus = 'expiring'
    }

    sslHealth = {
      status: sslStatus,
      certificates,
      warnings,
      errors
    }
  }

  const systemHealth = getSystemHealth()

  const jobs = Array.from(activeJobsMap.values())
  const completedJobs = jobs.filter((j: any) => j.status === 'completed')
  const failedJobs = jobs.filter((j: any) => j.status === 'failed')
  const totalLinks = completedJobs.reduce((sum: number, j: any) => 
    sum + (j.result?.links?.length || 0), 0
  )
  
  const avgDuration = completedJobs.length > 0
    ? completedJobs.reduce((sum: number, j: any) => {
        if (j.startedAt && j.completedAt) {
          return sum + (new Date(j.completedAt).getTime() - new Date(j.startedAt).getTime())
        }
        return sum
      }, 0) / completedJobs.length / 1000
    : 0

  const metrics: MetricsData = {
    totalJobs: jobs.length,
    activeJobs: jobs.filter((j: any) => j.status === 'running').length,
    completedJobs: completedJobs.length,
    failedJobs: failedJobs.length,
    totalLinksScanned: totalLinks,
    averageJobDuration: Math.round(avgDuration * 100) / 100,
    requestsPerMinute: calculateRequestsPerMinute()
  }

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  
  if (sslHealth?.status === 'expired' || systemHealth.memory.usagePercent > 90) {
    overallStatus = 'unhealthy'
  } else if (sslHealth?.status === 'expiring' || systemHealth.memory.usagePercent > 75) {
    overallStatus = 'degraded'
  }

  const services: HealthCheckResult['services'] = {
    api: apiStatus,
    database: dbStatus,
    crawler: crawlerStatus
  }

  if (sslHealth) {
    services.ssl = sslHealth
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: getUptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services,
    system: systemHealth,
    metrics
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

export function getSSLStatusColor(status: SSLHealth['status']): string {
  switch (status) {
    case 'valid':
      return 'green'
    case 'expiring':
      return 'yellow'
    case 'expired':
    case 'invalid':
      return 'red'
    case 'unavailable':
      return 'gray'
    default:
      return 'gray'
  }
}

export function getHealthStatusColor(status: HealthCheckResult['status']): string {
  switch (status) {
    case 'healthy':
      return 'green'
    case 'degraded':
      return 'yellow'
    case 'unhealthy':
      return 'red'
    default:
      return 'gray'
  }
}
