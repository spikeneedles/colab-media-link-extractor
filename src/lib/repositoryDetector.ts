/**
 * Repository Detector & Auto-Scraper
 * 
 * Automatically detects the source repository of media links,
 * scrapes all media from that repository, and documents the source.
 */

import { scanGitRepository, type RepositoryScanResult } from './linkExtractor'
import { crawlWebsite, type CrawlResult } from './crawler'

export interface DetectedRepository {
  url: string
  type: 'github' | 'gitlab' | 'bitbucket' | 'gitea' | 'codeberg' | 'web' | 'cdn' | 'unknown'
  confidence: 'high' | 'medium' | 'low'
  reason: string
  originalMediaUrl: string
}

export interface RepositoryMetadata {
  repositoryUrl: string
  repositoryType: string
  detectedAt: Date
  totalMediaFound: number
  filesScanned: number
  autoScraped: boolean
}

export interface AutoScrapeResult {
  detectedRepo: DetectedRepository
  scrapeResult: RepositoryScanResult | CrawlResult | null
  allMediaLinks: string[]
  error?: string
}

/**
 * Detect the source repository from a media URL
 */
export function detectMediaSourceRepository(mediaUrl: string): DetectedRepository | null {
  try {
    const url = new URL(mediaUrl)
    const hostname = url.hostname.toLowerCase()
    const pathname = url.pathname.toLowerCase()

    // GitHub raw/blob URLs
    if (hostname.includes('github')) {
      // https://raw.githubusercontent.com/user/repo/branch/file.m3u
      // https://github.com/user/repo/blob/branch/file.m3u
      const rawMatch = mediaUrl.match(/github(?:usercontent)?\.com\/([^\/]+)\/([^\/]+)/)
      if (rawMatch) {
        const [, owner, repo] = rawMatch
        return {
          url: `https://github.com/${owner}/${repo}`,
          type: 'github',
          confidence: 'high',
          reason: 'Media URL is from GitHub repository',
          originalMediaUrl: mediaUrl
        }
      }
    }

    // GitLab raw URLs
    if (hostname.includes('gitlab')) {
      // https://gitlab.com/user/repo/-/raw/branch/file.m3u
      const gitlabMatch = mediaUrl.match(/gitlab\.com\/([^\/]+\/[^\/]+)/)
      if (gitlabMatch) {
        const repoPath = gitlabMatch[1].split('/-/')[0]
        return {
          url: `https://gitlab.com/${repoPath}`,
          type: 'gitlab',
          confidence: 'high',
          reason: 'Media URL is from GitLab repository',
          originalMediaUrl: mediaUrl
        }
      }
    }

    // Bitbucket raw URLs
    if (hostname.includes('bitbucket')) {
      // https://bitbucket.org/user/repo/raw/branch/file.m3u
      const bitbucketMatch = mediaUrl.match(/bitbucket\.org\/([^\/]+\/[^\/]+)/)
      if (bitbucketMatch) {
        const repoPath = bitbucketMatch[1].split('/raw/')[0].split('/src/')[0]
        return {
          url: `https://bitbucket.org/${repoPath}`,
          type: 'bitbucket',
          confidence: 'high',
          reason: 'Media URL is from Bitbucket repository',
          originalMediaUrl: mediaUrl
        }
      }
    }

    // Codeberg raw URLs
    if (hostname.includes('codeberg')) {
      // https://codeberg.org/user/repo/raw/branch/file.m3u
      const codebergMatch = mediaUrl.match(/codeberg\.org\/([^\/]+\/[^\/]+)/)
      if (codebergMatch) {
        const repoPath = codebergMatch[1].split('/raw/')[0].split('/src/')[0]
        return {
          url: `https://codeberg.org/${repoPath}`,
          type: 'codeberg',
          confidence: 'high',
          reason: 'Media URL is from Codeberg repository',
          originalMediaUrl: mediaUrl
        }
      }
    }

    // Gitea instances
    if (hostname.includes('gitea') || pathname.includes('/raw/')) {
      const giteaMatch = mediaUrl.match(/(https?:\/\/[^\/]+)\/([^\/]+\/[^\/]+)/)
      if (giteaMatch) {
        const [, baseUrl, repoPath] = giteaMatch
        const cleanPath = repoPath.split('/raw/')[0].split('/src/')[0]
        return {
          url: `${baseUrl}/${cleanPath}`,
          type: 'gitea',
          confidence: 'medium',
          reason: 'Media URL appears to be from Gitea instance',
          originalMediaUrl: mediaUrl
        }
      }
    }

    // CDN with repository hints
    // e.g., https://cdn.jsdelivr.net/gh/user/repo@branch/file.m3u
    if (hostname.includes('jsdelivr')) {
      const jsdelivrMatch = mediaUrl.match(/jsdelivr\.net\/(?:gh|npm|combine)\/([^\/\@]+)\/([^\/\@]+)/)
      if (jsdelivrMatch) {
        const [, owner, repo] = jsdelivrMatch
        return {
          url: `https://github.com/${owner}/${repo}`,
          type: 'github',
          confidence: 'high',
          reason: 'Media URL is served via jsDelivr CDN from GitHub',
          originalMediaUrl: mediaUrl
        }
      }
    }

    // UNPKG (npm packages often have GitHub repos)
    if (hostname.includes('unpkg')) {
      const unpkgMatch = mediaUrl.match(/unpkg\.com\/(@?[^\/\@]+\/[^\/\@]+)/)
      if (unpkgMatch) {
        return {
          url: `https://www.npmjs.com/package/${unpkgMatch[1]}`,
          type: 'web',
          confidence: 'medium',
          reason: 'Media URL from NPM package (may have linked GitHub repo)',
          originalMediaUrl: mediaUrl
        }
      }
    }

    // Common CDNs - try to find repository breadcrumbs
    if (hostname.includes('cdn') || hostname.includes('static') || hostname.includes('media')) {
      // Check for common repository patterns in path
      const repoPatternMatch = pathname.match(/\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\//)
      if (repoPatternMatch) {
        return {
          url: url.origin + pathname.split('/').slice(0, 3).join('/'),
          type: 'cdn',
          confidence: 'low',
          reason: 'Media URL from CDN - inferred base path',
          originalMediaUrl: mediaUrl
        }
      }
    }

    // Generic web source - use domain root
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      // For playlist files directly hosted
      if (pathname.match(/\.(m3u8?|pls|xspf|asx)$/i)) {
        const basePath = pathname.split('/').slice(0, -1).join('/')
        return {
          url: url.origin + basePath,
          type: 'web',
          confidence: 'medium',
          reason: 'Playlist file - will scan parent directory',
          originalMediaUrl: mediaUrl
        }
      }

      return {
        url: url.origin,
        type: 'web',
        confidence: 'low',
        reason: 'Generic web source - will scan website root',
        originalMediaUrl: mediaUrl
      }
    }

    return null
  } catch (error) {
    console.error('Error detecting repository:', error)
    return null
  }
}

/**
 * Automatically scrape the detected repository and extract all media
 */
export async function autoScrapeRepository(
  detectedRepo: DetectedRepository,
  onProgress?: (message: string, current?: number, total?: number) => void
): Promise<AutoScrapeResult> {
  const result: AutoScrapeResult = {
    detectedRepo,
    scrapeResult: null,
    allMediaLinks: [],
    error: undefined
  }

  try {
    onProgress?.(`Detected ${detectedRepo.type} repository: ${detectedRepo.url}`, 0, 100)

    // Scrape based on repository type
    if (['github', 'gitlab', 'bitbucket', 'gitea', 'codeberg'].includes(detectedRepo.type)) {
      onProgress?.('Scanning Git repository...', 10, 100)
      
      const repoScanResult = await scanGitRepository(
        detectedRepo.url,
        (current, total) => {
          const progress = 10 + Math.floor((current / total) * 80)
          onProgress?.(`Scanning files (${current}/${total})...`, progress, 100)
        }
      )

      result.scrapeResult = repoScanResult
      result.allMediaLinks = repoScanResult.links

      onProgress?.(`Repository scan complete: ${repoScanResult.totalLinks} media links found`, 100, 100)
    } else if (detectedRepo.type === 'web') {
      onProgress?.('Crawling website...', 10, 100)

      const crawlResult = await crawlWebsite(
        detectedRepo.url,
        2, // max depth
        50, // max pages
        (current, total, currentUrl) => {
          const progress = 10 + Math.floor((current / total) * 80)
          onProgress?.(`Crawling pages (${current}/${total})...`, progress, 100)
        }
      )

      result.scrapeResult = crawlResult
      result.allMediaLinks = crawlResult.links

      onProgress?.(`Website crawl complete: ${crawlResult.links.length} media links found`, 100, 100)
    } else if (detectedRepo.type === 'cdn') {
      // For CDNs, try to fetch the directory listing or related files
      onProgress?.('Attempting to discover CDN media files...', 10, 100)
      
      try {
        const response = await fetch(detectedRepo.url)
        if (response.ok) {
          const content = await response.text()
          // Simple link extraction from potential directory listing
          const linkPattern = /href=["']([^"']+\.(m3u8?|ts|mp4|mkv|avi|mp3|aac|flac)[^"']*)["']/gi
          const matches = content.matchAll(linkPattern)
          const links = Array.from(matches).map(m => {
            const link = m[1]
            return link.startsWith('http') ? link : new URL(link, detectedRepo.url).toString()
          })
          
          result.allMediaLinks = Array.from(new Set(links))
          onProgress?.(`CDN scan complete: ${result.allMediaLinks.length} media links found`, 100, 100)
        } else {
          result.error = 'CDN does not expose directory listing'
        }
      } catch (error) {
        result.error = `CDN scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    } else {
      result.error = 'Unsupported repository type for auto-scraping'
    }
  } catch (error) {
    result.error = `Auto-scrape failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.error('Auto-scrape error:', error)
  }

  return result
}

/**
 * Batch process multiple media URLs and detect/scrape their repositories
 */
export async function batchDetectAndScrape(
  mediaUrls: string[],
  onProgress?: (index: number, total: number, currentUrl: string, status: string) => void
): Promise<Map<string, AutoScrapeResult>> {
  const results = new Map<string, AutoScrapeResult>()
  const processedRepos = new Set<string>()

  for (let i = 0; i < mediaUrls.length; i++) {
    const mediaUrl = mediaUrls[i]
    
    try {
      onProgress?.(i, mediaUrls.length, mediaUrl, 'Detecting repository...')

      const detected = detectMediaSourceRepository(mediaUrl)
      if (!detected) {
        onProgress?.(i, mediaUrls.length, mediaUrl, 'No repository detected')
        continue
      }

      // Skip if we already processed this repository
      if (processedRepos.has(detected.url)) {
        onProgress?.(i, mediaUrls.length, mediaUrl, 'Repository already processed')
        continue
      }

      onProgress?.(i, mediaUrls.length, mediaUrl, 'Scraping repository...')
      
      const scrapeResult = await autoScrapeRepository(
        detected,
        (message) => {
          onProgress?.(i, mediaUrls.length, mediaUrl, message)
        }
      )

      results.set(detected.url, scrapeResult)
      processedRepos.add(detected.url)

      onProgress?.(i, mediaUrls.length, mediaUrl, 'Complete')
    } catch (error) {
      console.error(`Error processing ${mediaUrl}:`, error)
      onProgress?.(i, mediaUrls.length, mediaUrl, 'Error')
    }
  }

  return results
}

/**
 * Create a detailed report of repository detection and scraping results
 */
export function generateRepositoryReport(result: AutoScrapeResult): string {
  const lines: string[] = []

  lines.push('='.repeat(80))
  lines.push('AUTO-SCRAPE REPOSITORY REPORT')
  lines.push('='.repeat(80))
  lines.push('')
  
  lines.push('DETECTED REPOSITORY:')
  lines.push(`  URL: ${result.detectedRepo.url}`)
  lines.push(`  Type: ${result.detectedRepo.type.toUpperCase()}`)
  lines.push(`  Confidence: ${result.detectedRepo.confidence.toUpperCase()}`)
  lines.push(`  Reason: ${result.detectedRepo.reason}`)
  lines.push(`  Original Media URL: ${result.detectedRepo.originalMediaUrl}`)
  lines.push('')

  if (result.error) {
    lines.push('ERROR:')
    lines.push(`  ${result.error}`)
    lines.push('')
  }

  if (result.scrapeResult) {
    lines.push('SCRAPE RESULTS:')
    if ('platform' in result.scrapeResult) {
      // Git repository result
      lines.push(`  Repository: ${result.scrapeResult.owner}/${result.scrapeResult.repoName}`)
      lines.push(`  Platform: ${result.scrapeResult.platform}`)
      lines.push(`  Files Scanned: ${result.scrapeResult.filesScanned}`)
      lines.push(`  Total Media Links: ${result.scrapeResult.totalLinks}`)
      lines.push(`  Video Links: ${result.scrapeResult.videoLinks}`)
      lines.push(`  Audio Links: ${result.scrapeResult.audioLinks}`)
      lines.push(`  Config Files: ${result.scrapeResult.configFiles.length}`)
    } else {
      // Web crawl result
      lines.push(`  Target: ${result.scrapeResult.target.url}`)
      lines.push(`  Type: ${result.scrapeResult.target.type}`)
      lines.push(`  Files Scanned: ${result.scrapeResult.filesScanned}`)
      lines.push(`  Links Found: ${result.scrapeResult.links.length}`)
      lines.push(`  Status: ${result.scrapeResult.status}`)
    }
    lines.push('')
  }

  if (result.allMediaLinks.length > 0) {
    lines.push(`DISCOVERED MEDIA (${result.allMediaLinks.length} links):`)
    lines.push('-'.repeat(80))
    result.allMediaLinks.slice(0, 100).forEach((link, index) => {
      lines.push(`${index + 1}. ${link}`)
    })
    if (result.allMediaLinks.length > 100) {
      lines.push(`... and ${result.allMediaLinks.length - 100} more`)
    }
    lines.push('')
  }

  lines.push('='.repeat(80))
  
  return lines.join('\n')
}

/**
 * Export repository metadata in JSON format
 */
export function exportRepositoryMetadata(results: Map<string, AutoScrapeResult>): string {
  const metadata = Array.from(results.entries()).map(([repoUrl, result]) => ({
    repositoryUrl: repoUrl,
    repositoryType: result.detectedRepo.type,
    confidence: result.detectedRepo.confidence,
    reason: result.detectedRepo.reason,
    originalMediaUrl: result.detectedRepo.originalMediaUrl,
    detectedAt: new Date().toISOString(),
    totalMediaFound: result.allMediaLinks.length,
    filesScanned: result.scrapeResult ? 
      ('filesScanned' in result.scrapeResult ? result.scrapeResult.filesScanned : 0) : 0,
    autoScraped: true,
    error: result.error,
    allMediaLinks: result.allMediaLinks
  }))

  return JSON.stringify(metadata, null, 2)
}
