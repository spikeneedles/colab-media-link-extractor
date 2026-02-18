export type ValidationStatus = 'pending' | 'validating' | 'working' | 'broken' | 'timeout' | 'unknown'

export interface ValidationResult {
  url: string
  status: ValidationStatus
  statusCode?: number
  responseTime?: number
  error?: string
  contentType?: string
  contentLength?: number
}

const VALIDATION_TIMEOUT = 10000
export const DEFAULT_CONCURRENT_VALIDATIONS = 5
export const MIN_CONCURRENT_VALIDATIONS = 1
export const MAX_CONCURRENT_VALIDATIONS = 20

export async function validateUrl(url: string, signal?: AbortSignal): Promise<ValidationResult> {
  const startTime = Date.now()
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT)
    
    if (signal) {
      signal.addEventListener('abort', () => controller.abort())
    }
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'no-cors',
      cache: 'no-cache',
    })
    
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    
    const contentType = response.headers.get('content-type') || undefined
    const contentLength = response.headers.get('content-length') 
      ? parseInt(response.headers.get('content-length')!) 
      : undefined
    
    if (response.type === 'opaque') {
      return {
        url,
        status: 'working',
        responseTime,
        contentType,
        contentLength
      }
    }
    
    if (response.ok) {
      return {
        url,
        status: 'working',
        statusCode: response.status,
        responseTime,
        contentType,
        contentLength
      }
    } else {
      return {
        url,
        status: 'broken',
        statusCode: response.status,
        responseTime,
        error: `HTTP ${response.status} ${response.statusText}`
      }
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          url,
          status: 'timeout',
          responseTime,
          error: 'Request timeout'
        }
      }
      
      return {
        url,
        status: 'broken',
        responseTime,
        error: error.message
      }
    }
    
    return {
      url,
      status: 'unknown',
      responseTime,
      error: 'Unknown error'
    }
  }
}

export async function validateUrls(
  urls: string[],
  onProgress?: (completed: number, total: number, current: ValidationResult, rate: number, estimatedTimeRemaining: number) => void,
  signal?: AbortSignal,
  concurrentRequests: number = DEFAULT_CONCURRENT_VALIDATIONS
): Promise<Map<string, ValidationResult>> {
  const results = new Map<string, ValidationResult>()
  let completed = 0
  const total = urls.length
  const startTime = Date.now()
  
  const maxConcurrent = Math.min(
    Math.max(concurrentRequests, MIN_CONCURRENT_VALIDATIONS),
    MAX_CONCURRENT_VALIDATIONS
  )
  
  const queue = [...urls]
  const inProgress: Promise<void>[] = []
  
  while (queue.length > 0 || inProgress.length > 0) {
    if (signal?.aborted) {
      break
    }
    
    while (inProgress.length < maxConcurrent && queue.length > 0) {
      const url = queue.shift()!
      
      const task = validateUrl(url, signal).then((result) => {
        results.set(url, result)
        completed++
        
        const elapsedSeconds = (Date.now() - startTime) / 1000
        const rate = elapsedSeconds > 0 ? completed / elapsedSeconds : 0
        const remaining = total - completed
        const estimatedTimeRemaining = rate > 0 ? remaining / rate : 0
        
        onProgress?.(completed, total, result, rate, estimatedTimeRemaining)
      })
      
      inProgress.push(task)
    }
    
    if (inProgress.length > 0) {
      await Promise.race(inProgress)
      const finishedIndex = inProgress.findIndex(p => 
        results.size >= completed
      )
      if (finishedIndex !== -1) {
        inProgress.splice(finishedIndex, 1)
      }
    }
  }
  
  await Promise.all(inProgress)
  
  return results
}

export function generateValidationReport(results: Map<string, ValidationResult>): string {
  const working: ValidationResult[] = []
  const broken: ValidationResult[] = []
  const timeout: ValidationResult[] = []
  const unknown: ValidationResult[] = []
  
  results.forEach(result => {
    switch (result.status) {
      case 'working':
        working.push(result)
        break
      case 'broken':
        broken.push(result)
        break
      case 'timeout':
        timeout.push(result)
        break
      default:
        unknown.push(result)
    }
  })
  
  let report = '# URL Validation Report\n\n'
  report += `Total URLs tested: ${results.size}\n`
  report += `Working: ${working.length}\n`
  report += `Broken: ${broken.length}\n`
  report += `Timeout: ${timeout.length}\n`
  report += `Unknown: ${unknown.length}\n\n`
  
  if (working.length > 0) {
    report += '## Working URLs\n\n'
    working.forEach(result => {
      report += `✓ ${result.url}`
      if (result.responseTime) {
        report += ` (${result.responseTime}ms)`
      }
      if (result.statusCode) {
        report += ` [${result.statusCode}]`
      }
      if (result.contentType) {
        report += ` - ${result.contentType}`
      }
      report += '\n'
    })
    report += '\n'
  }
  
  if (broken.length > 0) {
    report += '## Broken URLs\n\n'
    broken.forEach(result => {
      report += `✗ ${result.url}`
      if (result.error) {
        report += ` - ${result.error}`
      }
      report += '\n'
    })
    report += '\n'
  }
  
  if (timeout.length > 0) {
    report += '## Timeout URLs\n\n'
    timeout.forEach(result => {
      report += `⏱ ${result.url} - Request timeout\n`
    })
    report += '\n'
  }
  
  if (unknown.length > 0) {
    report += '## Unknown Status URLs\n\n'
    unknown.forEach(result => {
      report += `? ${result.url}`
      if (result.error) {
        report += ` - ${result.error}`
      }
      report += '\n'
    })
    report += '\n'
  }
  
  return report
}

export function getValidationStats(results: Map<string, ValidationResult>) {
  const stats = {
    total: results.size,
    working: 0,
    broken: 0,
    timeout: 0,
    unknown: 0,
    avgResponseTime: 0
  }
  
  let totalResponseTime = 0
  let validResponseCount = 0
  
  results.forEach(result => {
    switch (result.status) {
      case 'working':
        stats.working++
        break
      case 'broken':
        stats.broken++
        break
      case 'timeout':
        stats.timeout++
        break
      default:
        stats.unknown++
    }
    
    if (result.responseTime) {
      totalResponseTime += result.responseTime
      validResponseCount++
    }
  })
  
  if (validResponseCount > 0) {
    stats.avgResponseTime = Math.round(totalResponseTime / validResponseCount)
  }
  
  return stats
}
