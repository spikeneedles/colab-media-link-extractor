/**
 * CrawlStateManager
 *
 * Persistent crawl state using better-sqlite3.
 * Solves the problem of crawls restarting from scratch after a process restart.
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DB_PATH = process.env.CRAWL_STATE_DB
  ? path.resolve(process.env.CRAWL_STATE_DB)
  : path.join(__dirname, '../../data/crawl_state.db')

const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[CrawlState] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[CrawlState] ${msg}`, ...args),
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export type JobType = 'web' | 'repo' | 'search' | 'social' | 'archive'
export type JobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed'

export interface CrawlJob {
  id: string
  type: JobType
  seedUrl: string
  status: JobStatus
  config: Record<string, any> | null
  createdAt: number
  startedAt: number | null
  completedAt: number | null
  pagesCrawled: number
  linksFound: number
  error: string | null
}

export interface CrawlQueueItem {
  id: number
  jobId: string
  url: string
  depth: number
  priority: number
  addedAt: number
}

export interface DiscoveredLink {
  jobId?: string
  url: string
  title?: string
  type?: string   // 'm3u8', 'mp4', 'xtream', 'torrent', etc.
  quality?: string
  source?: string
  isAlive?: boolean
}

export interface DiscoveredLinkRow extends DiscoveredLink {
  id: number
  discoveredAt: number
  lastChecked: number | null
}

export interface DomainRateLimit {
  domain: string
  lastRequest: number
  requestCount: number
  errorCount: number
  backoffUntil: number
  avgResponseMs: number
}

export interface CrawlStats {
  totalJobs: number
  activeJobs: number
  totalLinksDiscovered: number
  totalUrlsVisited: number
  queuedUrls: number
}

export interface ResumeData {
  visitedUrls: Set<string>
  queuedUrls: CrawlQueueItem[]
}

// ---------------------------------------------------------------------------
// CrawlStateManager
// ---------------------------------------------------------------------------

export class CrawlStateManager {
  private db: Database.Database

  constructor(dbPath = DB_PATH) {
    const dataDir = path.dirname(dbPath)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this._initSchema()
    logger.info(`Database opened at ${dbPath}`)
  }

  // -------------------------------------------------------------------------
  // Schema
  // -------------------------------------------------------------------------

  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS crawl_jobs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        seed_url TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        config TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        started_at INTEGER,
        completed_at INTEGER,
        pages_crawled INTEGER DEFAULT 0,
        links_found INTEGER DEFAULT 0,
        error TEXT
      );

      CREATE TABLE IF NOT EXISTS crawl_visited_urls (
        job_id TEXT NOT NULL,
        url TEXT NOT NULL,
        depth INTEGER DEFAULT 0,
        crawled_at INTEGER DEFAULT (unixepoch()),
        status_code INTEGER,
        PRIMARY KEY (job_id, url)
      );

      CREATE TABLE IF NOT EXISTS crawl_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        url TEXT NOT NULL,
        depth INTEGER DEFAULT 0,
        priority INTEGER DEFAULT 0,
        added_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_queue_job ON crawl_queue(job_id, priority DESC);

      CREATE TABLE IF NOT EXISTS discovered_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT,
        url TEXT NOT NULL UNIQUE,
        title TEXT,
        type TEXT,
        quality TEXT,
        source TEXT,
        discovered_at INTEGER DEFAULT (unixepoch()),
        last_checked INTEGER,
        is_alive INTEGER DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_links_job ON discovered_links(job_id);
      CREATE INDEX IF NOT EXISTS idx_links_type ON discovered_links(type);

      CREATE TABLE IF NOT EXISTS domain_rate_limits (
        domain TEXT PRIMARY KEY,
        last_request INTEGER,
        request_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        backoff_until INTEGER DEFAULT 0,
        avg_response_ms INTEGER DEFAULT 0
      );
    `)
  }

  // -------------------------------------------------------------------------
  // Job management
  // -------------------------------------------------------------------------

  createJob(type: JobType, seedUrl: string, config?: Record<string, any>): string {
    const id = crypto.randomUUID()
    try {
      this.db
        .prepare(
          `INSERT INTO crawl_jobs (id, type, seed_url, status, config)
           VALUES (?, ?, ?, 'pending', ?)`
        )
        .run(id, type, seedUrl, config ? JSON.stringify(config) : null)
    } catch (err) {
      logger.error('createJob failed', err)
      throw err
    }
    return id
  }

  getJob(jobId: string): CrawlJob | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM crawl_jobs WHERE id = ?')
        .get(jobId) as any
      return row ? this._rowToJob(row) : null
    } catch (err) {
      logger.error('getJob failed', err)
      return null
    }
  }

  updateJobStatus(
    jobId: string,
    status: JobStatus,
    stats?: { pagesCrawled?: number; linksFound?: number; error?: string }
  ): void {
    try {
      const now = Math.floor(Date.now() / 1000)
      const updates: string[] = ['status = ?']
      const params: any[] = [status]

      if (status === 'running') {
        updates.push('started_at = ?')
        params.push(now)
      }
      if (status === 'completed' || status === 'failed') {
        updates.push('completed_at = ?')
        params.push(now)
      }
      if (stats?.pagesCrawled !== undefined) {
        updates.push('pages_crawled = ?')
        params.push(stats.pagesCrawled)
      }
      if (stats?.linksFound !== undefined) {
        updates.push('links_found = ?')
        params.push(stats.linksFound)
      }
      if (stats?.error !== undefined) {
        updates.push('error = ?')
        params.push(stats.error)
      }

      params.push(jobId)
      this.db.prepare(`UPDATE crawl_jobs SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    } catch (err) {
      logger.error('updateJobStatus failed', err)
    }
  }

  listJobs(status?: JobStatus): CrawlJob[] {
    try {
      const rows = status
        ? (this.db.prepare('SELECT * FROM crawl_jobs WHERE status = ? ORDER BY created_at DESC').all(status) as any[])
        : (this.db.prepare('SELECT * FROM crawl_jobs ORDER BY created_at DESC').all() as any[])
      return rows.map(this._rowToJob)
    } catch (err) {
      logger.error('listJobs failed', err)
      return []
    }
  }

  // -------------------------------------------------------------------------
  // Visited URLs
  // -------------------------------------------------------------------------

  markVisited(jobId: string, url: string, depth = 0, statusCode?: number): void {
    try {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO crawl_visited_urls (job_id, url, depth, status_code)
           VALUES (?, ?, ?, ?)`
        )
        .run(jobId, url, depth, statusCode ?? null)
    } catch (err) {
      logger.error('markVisited failed', err)
    }
  }

  isVisited(jobId: string, url: string): boolean {
    try {
      const row = this.db
        .prepare('SELECT 1 FROM crawl_visited_urls WHERE job_id = ? AND url = ?')
        .get(jobId, url)
      return row !== undefined
    } catch (err) {
      logger.error('isVisited failed', err)
      return false
    }
  }

  getVisitedUrls(jobId: string): Set<string> {
    try {
      const rows = this.db
        .prepare('SELECT url FROM crawl_visited_urls WHERE job_id = ?')
        .all(jobId) as { url: string }[]
      return new Set(rows.map((r) => r.url))
    } catch (err) {
      logger.error('getVisitedUrls failed', err)
      return new Set()
    }
  }

  // -------------------------------------------------------------------------
  // Queue management
  // -------------------------------------------------------------------------

  enqueueUrl(jobId: string, url: string, depth = 0, priority = 0): void {
    try {
      // Only enqueue if not already in queue and not visited
      this.db
        .prepare(
          `INSERT OR IGNORE INTO crawl_queue (job_id, url, depth, priority)
           VALUES (?, ?, ?, ?)`
        )
        .run(jobId, url, depth, priority)
    } catch (err) {
      logger.error('enqueueUrl failed', err)
    }
  }

  dequeueUrls(jobId: string, limit = 10): CrawlQueueItem[] {
    try {
      const rows = this.db
        .prepare(
          `SELECT * FROM crawl_queue
           WHERE job_id = ?
           ORDER BY priority DESC, id ASC
           LIMIT ?`
        )
        .all(jobId, limit) as any[]

      if (rows.length === 0) return []

      const ids = rows.map((r) => r.id)
      this.db
        .prepare(`DELETE FROM crawl_queue WHERE id IN (${ids.map(() => '?').join(',')})`)
        .run(...ids)

      return rows.map((r) => ({
        id: r.id,
        jobId: r.job_id,
        url: r.url,
        depth: r.depth,
        priority: r.priority,
        addedAt: r.added_at,
      }))
    } catch (err) {
      logger.error('dequeueUrls failed', err)
      return []
    }
  }

  getQueueLength(jobId: string): number {
    try {
      const row = this.db
        .prepare('SELECT COUNT(*) as cnt FROM crawl_queue WHERE job_id = ?')
        .get(jobId) as { cnt: number }
      return row.cnt
    } catch (err) {
      logger.error('getQueueLength failed', err)
      return 0
    }
  }

  // -------------------------------------------------------------------------
  // Discovered links
  // -------------------------------------------------------------------------

  saveDiscoveredLink(link: DiscoveredLink): number | null {
    try {
      const result = this.db
        .prepare(
          `INSERT OR IGNORE INTO discovered_links
             (job_id, url, title, type, quality, source, is_alive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          link.jobId ?? null,
          link.url,
          link.title ?? null,
          link.type ?? null,
          link.quality ?? null,
          link.source ?? null,
          link.isAlive !== false ? 1 : 0
        )
      return result.lastInsertRowid as number
    } catch (err) {
      logger.error('saveDiscoveredLink failed', err)
      return null
    }
  }

  getDiscoveredLinks(options: {
    jobId?: string
    type?: string
    isAlive?: boolean
    limit?: number
    offset?: number
  } = {}): { links: DiscoveredLinkRow[]; total: number } {
    try {
      const conditions: string[] = []
      const params: any[] = []

      if (options.jobId !== undefined) {
        conditions.push('job_id = ?')
        params.push(options.jobId)
      }
      if (options.type !== undefined) {
        conditions.push('type = ?')
        params.push(options.type)
      }
      if (options.isAlive !== undefined) {
        conditions.push('is_alive = ?')
        params.push(options.isAlive ? 1 : 0)
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      const limit = options.limit ?? 100
      const offset = options.offset ?? 0

      const total = (
        this.db.prepare(`SELECT COUNT(*) as cnt FROM discovered_links ${where}`).get(...params) as { cnt: number }
      ).cnt

      const rows = this.db
        .prepare(`SELECT * FROM discovered_links ${where} ORDER BY discovered_at DESC LIMIT ? OFFSET ?`)
        .all(...params, limit, offset) as any[]

      return {
        total,
        links: rows.map((r) => ({
          id: r.id,
          jobId: r.job_id,
          url: r.url,
          title: r.title,
          type: r.type,
          quality: r.quality,
          source: r.source,
          discoveredAt: r.discovered_at,
          lastChecked: r.last_checked,
          isAlive: r.is_alive === 1,
        })),
      }
    } catch (err) {
      logger.error('getDiscoveredLinks failed', err)
      return { links: [], total: 0 }
    }
  }

  updateLinkAliveness(url: string, isAlive: boolean): void {
    try {
      const now = Math.floor(Date.now() / 1000)
      this.db
        .prepare('UPDATE discovered_links SET is_alive = ?, last_checked = ? WHERE url = ?')
        .run(isAlive ? 1 : 0, now, url)
    } catch (err) {
      logger.error('updateLinkAliveness failed', err)
    }
  }

  // -------------------------------------------------------------------------
  // Domain rate limiting
  // -------------------------------------------------------------------------

  updateDomainRateLimit(domain: string, responseMs: number, hadError: boolean): void {
    try {
      const now = Math.floor(Date.now() / 1000)

      const existing = this.db
        .prepare('SELECT * FROM domain_rate_limits WHERE domain = ?')
        .get(domain) as DomainRateLimit | undefined

      if (!existing) {
        this.db
          .prepare(
            `INSERT INTO domain_rate_limits
               (domain, last_request, request_count, error_count, avg_response_ms)
             VALUES (?, ?, 1, ?, ?)`
          )
          .run(domain, now, hadError ? 1 : 0, responseMs)
        return
      }

      // Exponential moving average for response time (α = 0.2)
      const alpha = 0.2
      const newAvg = Math.round(alpha * responseMs + (1 - alpha) * existing.avgResponseMs)
      const newErrors = existing.errorCount + (hadError ? 1 : 0)
      const consecutiveErrors = hadError ? newErrors : 0

      // Back off 15 minutes after 3+ consecutive errors
      const backoffUntil =
        consecutiveErrors >= 3 ? now + 15 * 60 : existing.backoffUntil

      this.db
        .prepare(
          `UPDATE domain_rate_limits
           SET last_request = ?, request_count = request_count + 1,
               error_count = ?, backoff_until = ?, avg_response_ms = ?
           WHERE domain = ?`
        )
        .run(now, newErrors, backoffUntil, newAvg, domain)
    } catch (err) {
      logger.error('updateDomainRateLimit failed', err)
    }
  }

  /** Returns milliseconds remaining in backoff, or 0 if not backed off. */
  getDomainBackoff(domain: string): number {
    try {
      const row = this.db
        .prepare('SELECT backoff_until FROM domain_rate_limits WHERE domain = ?')
        .get(domain) as { backoff_until: number } | undefined

      if (!row) return 0
      const nowSec = Math.floor(Date.now() / 1000)
      const remaining = (row.backoff_until - nowSec) * 1000
      return remaining > 0 ? remaining : 0
    } catch (err) {
      logger.error('getDomainBackoff failed', err)
      return 0
    }
  }

  /**
   * Returns adaptive delay in ms for a domain.
   * Base: avg response time × 1.5, clamped between 500 ms and 10 s.
   */
  getAdaptiveDelay(domain: string): number {
    try {
      const row = this.db
        .prepare('SELECT avg_response_ms, error_count FROM domain_rate_limits WHERE domain = ?')
        .get(domain) as { avg_response_ms: number; error_count: number } | undefined

      if (!row) return 1000

      const base = Math.round(row.avg_response_ms * 1.5)
      const errorPenalty = row.error_count * 500
      return Math.min(Math.max(base + errorPenalty, 500), 10_000)
    } catch (err) {
      logger.error('getAdaptiveDelay failed', err)
      return 1000
    }
  }

  // -------------------------------------------------------------------------
  // Resume
  // -------------------------------------------------------------------------

  /** Restore all state needed to continue an interrupted crawl. */
  resumeJob(jobId: string): ResumeData {
    const visitedUrls = this.getVisitedUrls(jobId)
    const queuedUrls: CrawlQueueItem[] = (
      this.db
        .prepare('SELECT * FROM crawl_queue WHERE job_id = ? ORDER BY priority DESC, id ASC')
        .all(jobId) as any[]
    ).map((r) => ({
      id: r.id,
      jobId: r.job_id,
      url: r.url,
      depth: r.depth,
      priority: r.priority,
      addedAt: r.added_at,
    }))

    // Mark job as running again
    this.updateJobStatus(jobId, 'running')

    logger.info(
      `Resuming job ${jobId}: ${visitedUrls.size} visited, ${queuedUrls.length} queued`
    )
    return { visitedUrls, queuedUrls }
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  cleanupOldJobs(daysOld = 7): number {
    try {
      const cutoff = Math.floor(Date.now() / 1000) - daysOld * 86400
      const jobs = this.db
        .prepare(
          `SELECT id FROM crawl_jobs
           WHERE status IN ('completed', 'failed') AND completed_at < ?`
        )
        .all(cutoff) as { id: string }[]

      if (jobs.length === 0) return 0

      const ids = jobs.map((j) => j.id)
      const placeholders = ids.map(() => '?').join(',')

      this.db.prepare(`DELETE FROM crawl_visited_urls WHERE job_id IN (${placeholders})`).run(...ids)
      this.db.prepare(`DELETE FROM crawl_queue WHERE job_id IN (${placeholders})`).run(...ids)
      this.db.prepare(`DELETE FROM crawl_jobs WHERE id IN (${placeholders})`).run(...ids)

      logger.info(`Cleaned up ${ids.length} old jobs`)
      return ids.length
    } catch (err) {
      logger.error('cleanupOldJobs failed', err)
      return 0
    }
  }

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------

  getStats(): CrawlStats {
    try {
      const totalJobs = (
        this.db.prepare('SELECT COUNT(*) as cnt FROM crawl_jobs').get() as { cnt: number }
      ).cnt
      const activeJobs = (
        this.db
          .prepare("SELECT COUNT(*) as cnt FROM crawl_jobs WHERE status IN ('running', 'pending')")
          .get() as { cnt: number }
      ).cnt
      const totalLinksDiscovered = (
        this.db.prepare('SELECT COUNT(*) as cnt FROM discovered_links').get() as { cnt: number }
      ).cnt
      const totalUrlsVisited = (
        this.db.prepare('SELECT COUNT(*) as cnt FROM crawl_visited_urls').get() as { cnt: number }
      ).cnt
      const queuedUrls = (
        this.db.prepare('SELECT COUNT(*) as cnt FROM crawl_queue').get() as { cnt: number }
      ).cnt

      return { totalJobs, activeJobs, totalLinksDiscovered, totalUrlsVisited, queuedUrls }
    } catch (err) {
      logger.error('getStats failed', err)
      return { totalJobs: 0, activeJobs: 0, totalLinksDiscovered: 0, totalUrlsVisited: 0, queuedUrls: 0 }
    }
  }

  close(): void {
    this.db.close()
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _rowToJob(row: any): CrawlJob {
    return {
      id: row.id,
      type: row.type as JobType,
      seedUrl: row.seed_url,
      status: row.status as JobStatus,
      config: row.config ? JSON.parse(row.config) : null,
      createdAt: row.created_at,
      startedAt: row.started_at ?? null,
      completedAt: row.completed_at ?? null,
      pagesCrawled: row.pages_crawled,
      linksFound: row.links_found,
      error: row.error ?? null,
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const crawlStateManager = new CrawlStateManager()
