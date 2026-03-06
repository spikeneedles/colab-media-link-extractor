/**
 * Archive.org Crawler Service
 *
 * Discovers historical M3U/playlist files via the Wayback Machine CDX API,
 * Archive.org advanced search, and GitHub code search.
 */

import { EventEmitter } from 'events'
import axios, { AxiosInstance } from 'axios'

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ArchivedPlaylist {
  originalUrl: string
  waybackUrl?: string
  source: 'cdx' | 'archive' | 'github'
  discoveredAt: number
  title?: string
}

export interface ArchiveCrawlOptions {
  dateFrom?: string  // YYYYMMDD
  dateTo?: string    // YYYYMMDD
  maxResults?: number
  patterns?: string[]
}

interface CDXRow {
  original: string
  timestamp: string
  statuscode: string
}

interface ArchiveItem {
  identifier: string
  title?: string
  description?: string
}

interface ArchiveFile {
  name: string
  source?: string
  format?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CDX_BASE = 'http://web.archive.org/cdx/search/cdx'
const ARCHIVE_SEARCH = 'https://archive.org/advancedsearch.php'
const ARCHIVE_METADATA = 'https://archive.org/metadata'
const GITHUB_SEARCH = 'https://api.github.com/search/code'

const DEFAULT_CDX_PATTERNS = [
  '*.m3u',
  '*.m3u8',
  '*.pls',
  '*.xspf',
  '*/playlist*',
  '*/iptv*',
  '*/channels*',
  '*/get.php*username*',
]

const ARCHIVE_QUERIES = ['m3u8 playlist', 'iptv channels', 'm3u playlist']

const GITHUB_QUERIES = [
  'filename:.m3u8 channels',
  'filename:.m3u iptv',
  'filename:.m3u8 iptv',
  'filename:.m3u playlist',
]

const TWO_YEARS_AGO = (): string => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 2)
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

// ─── ArchiveOrgCrawler ────────────────────────────────────────────────────────

export class ArchiveOrgCrawler extends EventEmitter {
  private http: AxiosInstance
  private githubToken?: string

  constructor(githubToken?: string) {
    super()
    this.githubToken = githubToken
    this.http = axios.create({
      timeout: 20_000,
      headers: {
        'User-Agent': 'MediaLinkExtractor/1.0 (compatible; +https://github.com)',
      },
    })
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Run CDX, Archive.org, and GitHub searches in parallel and deduplicate. */
  async crawlAll(options: ArchiveCrawlOptions = {}): Promise<ArchivedPlaylist[]> {
    const [cdxResults, archiveResults, githubResults] = await Promise.allSettled([
      this.searchCDXAll(options),
      this.searchArchiveOrgAll(options),
      this.searchGitHubAll(options),
    ])

    const all: ArchivedPlaylist[] = []
    const seen = new Set<string>()

    const addAll = (items: ArchivedPlaylist[]) => {
      for (const item of items) {
        const key = item.originalUrl
        if (!seen.has(key)) {
          seen.add(key)
          all.push(item)
          this.emit('found', item)
        }
      }
    }

    if (cdxResults.status === 'fulfilled') addAll(cdxResults.value)
    else this.emit('error', { source: 'cdx', error: cdxResults.reason })

    if (archiveResults.status === 'fulfilled') addAll(archiveResults.value)
    else this.emit('error', { source: 'archive', error: archiveResults.reason })

    if (githubResults.status === 'fulfilled') addAll(githubResults.value)
    else this.emit('error', { source: 'github', error: githubResults.reason })

    this.emit('complete', { total: all.length })
    return all
  }

  // ── CDX API ────────────────────────────────────────────────────────────────

  /** Search CDX for a single URL pattern with pagination. */
  async searchCDX(pattern: string, options: ArchiveCrawlOptions = {}): Promise<ArchivedPlaylist[]> {
    const results: ArchivedPlaylist[] = []
    const maxResults = options.maxResults ?? 1000
    const dateFrom = options.dateFrom ?? TWO_YEARS_AGO()
    const dateTo = options.dateTo ?? new Date().toISOString().slice(0, 10).replace(/-/g, '')

    let offset = 0
    const pageSize = Math.min(maxResults, 1000)

    while (results.length < maxResults) {
      const params = new URLSearchParams({
        url: pattern,
        output: 'json',
        fl: 'original,timestamp,statuscode',
        filter: 'statuscode:200',
        limit: String(pageSize),
        offset: String(offset),
        from: dateFrom,
        to: dateTo,
        collapse: 'original', // deduplicate by URL
      })

      const url = `${CDX_BASE}?${params}`
      let rows: any[][]

      try {
        const res = await this.http.get(url)
        rows = res.data
      } catch (err) {
        this.emit('error', { source: 'cdx', pattern, error: err })
        break
      }

      if (!Array.isArray(rows) || rows.length <= 1) break // first row is header

      const header: string[] = rows[0]
      const originalIdx = header.indexOf('original')
      const timestampIdx = header.indexOf('timestamp')

      for (const row of rows.slice(1)) {
        const originalUrl: string = row[originalIdx]
        const timestamp: string = row[timestampIdx]
        const waybackUrl = `https://web.archive.org/web/${timestamp}/${originalUrl}`

        const item: ArchivedPlaylist = {
          originalUrl,
          waybackUrl,
          source: 'cdx',
          discoveredAt: Date.now(),
        }
        results.push(item)
        if (results.length >= maxResults) break
      }

      if (rows.length - 1 < pageSize) break // last page
      offset += pageSize
      await this.delay(500)
    }

    return results
  }

  private async searchCDXAll(options: ArchiveCrawlOptions): Promise<ArchivedPlaylist[]> {
    const patterns = options.patterns ?? DEFAULT_CDX_PATTERNS
    const all: ArchivedPlaylist[] = []
    const seen = new Set<string>()
    const perPattern = Math.ceil((options.maxResults ?? 1000) / patterns.length)

    for (const pattern of patterns) {
      try {
        const results = await this.searchCDX(pattern, { ...options, maxResults: perPattern })
        for (const r of results) {
          if (!seen.has(r.originalUrl)) {
            seen.add(r.originalUrl)
            all.push(r)
          }
        }
      } catch (err) {
        this.emit('error', { source: 'cdx', pattern, error: err })
      }
      await this.delay(300)
    }

    return all
  }

  /** Get the latest Wayback Machine snapshot URL for any original URL. */
  async getWaybackUrl(originalUrl: string): Promise<string | null> {
    try {
      const params = new URLSearchParams({
        url: originalUrl,
        output: 'json',
        fl: 'timestamp',
        filter: 'statuscode:200',
        limit: '1',
        sort: 'timestamp',
        order: 'desc',
      })
      const res = await this.http.get(`${CDX_BASE}?${params}`)
      const rows: any[][] = res.data
      if (!Array.isArray(rows) || rows.length < 2) return null
      const timestamp = rows[1][0]
      return `https://web.archive.org/web/${timestamp}/${originalUrl}`
    } catch {
      return null
    }
  }

  // ── Archive.org Search ─────────────────────────────────────────────────────

  /** Search Archive.org advanced search for a single query. */
  async searchArchiveOrg(query: string, options: ArchiveCrawlOptions = {}): Promise<ArchivedPlaylist[]> {
    const results: ArchivedPlaylist[] = []
    const maxResults = options.maxResults ?? 100

    const params = new URLSearchParams({
      q: query,
      'fl[]': 'identifier,title,description',
      output: 'json',
      rows: String(Math.min(maxResults, 100)),
      page: '1',
    })

    let items: ArchiveItem[]
    try {
      const res = await this.http.get(`${ARCHIVE_SEARCH}?${params}`)
      items = res.data?.response?.docs ?? []
    } catch (err) {
      this.emit('error', { source: 'archive', query, error: err })
      return results
    }

    for (const item of items) {
      if (!item.identifier) continue
      try {
        await this.delay(300)
        const files = await this.fetchArchiveItemFiles(item.identifier)
        for (const file of files) {
          if (this.isPlaylistFile(file.name)) {
            results.push({
              originalUrl: `https://archive.org/download/${item.identifier}/${file.name}`,
              source: 'archive',
              discoveredAt: Date.now(),
              title: item.title,
            })
          }
        }
      } catch (err) {
        this.emit('error', { source: 'archive', identifier: item.identifier, error: err })
      }
    }

    return results
  }

  private async fetchArchiveItemFiles(identifier: string): Promise<ArchiveFile[]> {
    const res = await this.http.get(`${ARCHIVE_METADATA}/${identifier}`)
    return res.data?.files ?? []
  }

  private async searchArchiveOrgAll(options: ArchiveCrawlOptions): Promise<ArchivedPlaylist[]> {
    const all: ArchivedPlaylist[] = []
    const seen = new Set<string>()
    const perQuery = Math.ceil((options.maxResults ?? 300) / ARCHIVE_QUERIES.length)

    for (const query of ARCHIVE_QUERIES) {
      try {
        const results = await this.searchArchiveOrg(query, { ...options, maxResults: perQuery })
        for (const r of results) {
          if (!seen.has(r.originalUrl)) {
            seen.add(r.originalUrl)
            all.push(r)
          }
        }
      } catch (err) {
        this.emit('error', { source: 'archive', query, error: err })
      }
      await this.delay(500)
    }

    return all
  }

  // ── GitHub Search ──────────────────────────────────────────────────────────

  /** Search GitHub code search for playlist files. */
  async searchGitHub(query: string, options: ArchiveCrawlOptions = {}): Promise<ArchivedPlaylist[]> {
    const results: ArchivedPlaylist[] = []
    const maxResults = options.maxResults ?? 100
    const perPage = Math.min(maxResults, 30)
    const maxPages = Math.ceil(maxResults / perPage)

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    }
    if (this.githubToken) {
      headers['Authorization'] = `token ${this.githubToken}`
    }

    for (let page = 1; page <= maxPages; page++) {
      try {
        const res = await this.http.get(GITHUB_SEARCH, {
          headers,
          params: {
            q: query,
            per_page: perPage,
            page,
          },
        })

        const items: any[] = res.data?.items ?? []
        if (items.length === 0) break

        for (const item of items) {
          const rawUrl = item.html_url
            ?.replace('github.com', 'raw.githubusercontent.com')
            ?.replace('/blob/', '/')
          if (rawUrl) {
            results.push({
              originalUrl: rawUrl,
              source: 'github',
              discoveredAt: Date.now(),
              title: item.name,
            })
          }
        }

        if (items.length < perPage) break
        await this.delay(1_000) // GitHub rate limit: 30 req/min unauthenticated
      } catch (err: any) {
        // Stop gracefully on rate-limit (403/429) or search-unavailable (422)
        if ([403, 422, 429].includes(err?.response?.status)) {
          this.emit('error', { source: 'github', query, error: err })
          break
        }
        throw err
      }
    }

    return results
  }

  private async searchGitHubAll(options: ArchiveCrawlOptions): Promise<ArchivedPlaylist[]> {
    const all: ArchivedPlaylist[] = []
    const seen = new Set<string>()
    const perQuery = Math.ceil((options.maxResults ?? 100) / GITHUB_QUERIES.length)

    for (const query of GITHUB_QUERIES) {
      try {
        const results = await this.searchGitHub(query, { ...options, maxResults: perQuery })
        for (const r of results) {
          if (!seen.has(r.originalUrl)) {
            seen.add(r.originalUrl)
            all.push(r)
          }
        }
      } catch (err) {
        this.emit('error', { source: 'github', query, error: err })
      }
      await this.delay(2_000)
    }

    return all
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private isPlaylistFile(name: string): boolean {
    if (!name) return false
    const lower = name.toLowerCase()
    return (
      lower.endsWith('.m3u') ||
      lower.endsWith('.m3u8') ||
      lower.endsWith('.pls') ||
      lower.endsWith('.xspf') ||
      lower.includes('playlist') ||
      lower.includes('iptv') ||
      lower.includes('channels')
    )
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const archiveOrgCrawler = new ArchiveOrgCrawler(process.env.GITHUB_TOKEN)
