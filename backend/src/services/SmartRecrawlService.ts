/**
 * SmartRecrawlService
 *
 * ETag / Last-Modified–based intelligent recrawl scheduler.
 *
 * Instead of blindly re-fetching all sources on a fixed interval, this service
 * sends HTTP HEAD requests with If-None-Match and If-Modified-Since headers.
 * Only sources that return a non-304 response (i.e. actually changed) are
 * enqueued for a full re-crawl. This dramatically reduces bandwidth waste and
 * keeps archived playlists fresher.
 *
 * State is persisted to SQLite so recrawl schedules survive restarts.
 *
 * Env vars:
 *   SMART_RECRAWL_DB          — path to state DB (default: ./data/smart_recrawl.db)
 *   SMART_RECRAWL_INTERVAL_MS — check interval in ms (default: 1800000 = 30 min)
 *   SMART_RECRAWL_CONCURRENCY — parallel HEAD checks (default: 20)
 */

import Database     from 'better-sqlite3'
import axios        from 'axios'
import path         from 'path'
import { fileURLToPath } from 'url'
import { EventEmitter }  from 'events'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RecrawlEntry {
  url:           string
  etag?:         string
  lastModified?: string
  contentHash?:  string   // SHA-256 of last fetched body for content-based change detection
  lastChecked:   number
  lastChanged:   number
  checkCount:    number
  changeCount:   number
  nextCheck:     number
  intervalMs:    number   // per-source adaptive interval
}

export interface RecrawlCheckResult {
  url:     string
  changed: boolean
  reason:  'etag' | 'last-modified' | 'no-cache-headers' | 'error' | 'not-due'
}

// ── Semaphore ─────────────────────────────────────────────────────────────────

class Sem {
  private n: number; private q: (() => void)[] = []
  constructor(n: number) { this.n = n }
  acquire(): Promise<void> {
    if (this.n > 0) { this.n--; return Promise.resolve() }
    return new Promise(r => this.q.push(r))
  }
  release() { this.q.length ? this.q.shift()!() : this.n++ }
}

// ── Service ────────────────────────────────────────────────────────────────────

export class SmartRecrawlService extends EventEmitter {
  private db:          Database.Database
  private intervalMs:  number
  private concurrency: number
  private timer?:      ReturnType<typeof setInterval>

  constructor() {
    super()
    const dbPath = process.env.SMART_RECRAWL_DB
      ?? path.join(__dirname, '..', '..', 'data', 'smart_recrawl.db')

    this.db          = new Database(dbPath)
    this.intervalMs  = parseInt(process.env.SMART_RECRAWL_INTERVAL_MS ?? '1800000', 10)
    this.concurrency = parseInt(process.env.SMART_RECRAWL_CONCURRENCY ?? '20', 10)
    this._initSchema()
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Add a URL to the smart recrawl watchlist. */
  addUrl(url: string, intervalMs?: number): void {
    const now = Date.now()
    this.db.prepare(`
      INSERT OR IGNORE INTO recrawl_state
        (url, last_checked, last_changed, check_count, change_count, next_check, interval_ms)
      VALUES (?, ?, ?, 0, 0, ?, ?)
    `).run(url, now, now, now, intervalMs ?? this.intervalMs)
  }

  /** Add multiple URLs at once. */
  addUrls(urls: string[], intervalMs?: number): void {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO recrawl_state
        (url, last_checked, last_changed, check_count, change_count, next_check, interval_ms)
      VALUES (?, ?, ?, 0, 0, ?, ?)
    `)
    const now = Date.now()
    const tx  = this.db.transaction((list: string[]) => {
      for (const url of list) insert.run(url, now, now, now, intervalMs ?? this.intervalMs)
    })
    tx(urls)
  }

  /** Remove a URL from the watchlist. */
  removeUrl(url: string): void {
    this.db.prepare('DELETE FROM recrawl_state WHERE url = ?').run(url)
  }

  /** Get the current state for a URL. */
  getEntry(url: string): RecrawlEntry | null {
    const row = this.db.prepare('SELECT * FROM recrawl_state WHERE url = ?').get(url) as any
    return row ? this._rowToEntry(row) : null
  }

  /** List all watched URLs. */
  listAll(): RecrawlEntry[] {
    return (this.db.prepare('SELECT * FROM recrawl_state ORDER BY next_check ASC').all() as any[])
      .map(this._rowToEntry)
  }

  /** Check which watched URLs are due and have actually changed. Returns changed URLs. */
  async checkDue(): Promise<RecrawlCheckResult[]> {
    const now = Date.now()
    const due = this.db.prepare('SELECT * FROM recrawl_state WHERE next_check <= ?').all(now) as any[]

    if (due.length === 0) return []
    console.log(`[SmartRecrawl] Checking ${due.length} due URLs…`)

    const sem = new Sem(this.concurrency)
    const results = await Promise.all(
      due.map(row => sem.acquire().then(() =>
        this._checkUrl(row.url).finally(() => sem.release())
      ))
    )

    const changed = results.filter(r => r.changed)
    if (changed.length > 0) {
      console.log(`[SmartRecrawl] ${changed.length}/${due.length} URLs changed`)
      this.emit('changed', changed.map(r => r.url))
    }

    return results
  }

  /** Force-check a specific URL regardless of schedule. */
  async forceCheck(url: string): Promise<RecrawlCheckResult> {
    return this._checkUrl(url)
  }

  /** Start the background check loop. */
  startWatcher(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.checkDue(), this.intervalMs)
    console.log(`[SmartRecrawl] Watcher started (interval: ${this.intervalMs / 60000} min)`)
  }

  /** Stop the background check loop. */
  stopWatcher(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = undefined }
  }

  getStats() {
    const total   = (this.db.prepare('SELECT COUNT(*) as c FROM recrawl_state').get() as any).c
    const due     = (this.db.prepare('SELECT COUNT(*) as c FROM recrawl_state WHERE next_check <= ?').get(Date.now()) as any).c
    const changed = (this.db.prepare('SELECT SUM(change_count) as s FROM recrawl_state').get() as any).s ?? 0
    return { total, due, totalChanges: changed }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _checkUrl(url: string): Promise<RecrawlCheckResult> {
    const entry = this.db.prepare('SELECT * FROM recrawl_state WHERE url = ?').get(url) as any

    const headers: Record<string, string> = {
      'User-Agent': 'MediaLinkExtractor/SmartRecrawl/1.0',
    }
    if (entry?.etag)          headers['If-None-Match']     = entry.etag
    if (entry?.last_modified) headers['If-Modified-Since'] = entry.last_modified

    const now = Date.now()
    let changed = false
    let reason: RecrawlCheckResult['reason'] = 'no-cache-headers'

    try {
      const res = await axios.head(url, {
        headers,
        timeout: 10_000,
        validateStatus: () => true,
        maxRedirects: 5,
      })

      if (res.status === 304) {
        // Not modified — update lastChecked, keep everything else
        changed = false
        reason  = entry?.etag ? 'etag' : 'last-modified'
      } else if (res.status >= 200 && res.status < 300) {
        const newEtag     = res.headers['etag'] as string | undefined
        const newLastMod  = res.headers['last-modified'] as string | undefined

        if (entry?.etag && newEtag && entry.etag !== newEtag) {
          changed = true; reason = 'etag'
        } else if (entry?.last_modified && newLastMod && entry.last_modified !== newLastMod) {
          changed = true; reason = 'last-modified'
        } else if (!entry?.etag && !entry?.last_modified) {
          // No cache headers — assume changed every time
          changed = true; reason = 'no-cache-headers'
        }

        // Update stored headers
        const interval = this._adaptInterval(entry?.interval_ms ?? this.intervalMs, changed)
        this.db.prepare(`
          UPDATE recrawl_state SET
            etag = ?, last_modified = ?,
            last_checked = ?, last_changed = ?,
            check_count  = check_count + 1,
            change_count = change_count + ?,
            next_check   = ?, interval_ms = ?
          WHERE url = ?
        `).run(
          newEtag ?? entry?.etag ?? null,
          newLastMod ?? entry?.last_modified ?? null,
          now,
          changed ? now : (entry?.last_changed ?? now),
          changed ? 1 : 0,
          now + interval,
          interval,
          url
        )
      }
    } catch (err: any) {
      reason = 'error'
      console.warn(`[SmartRecrawl] HEAD failed for ${url}: ${err.message}`)
      // Back off on error
      const backoff = Math.min((entry?.interval_ms ?? this.intervalMs) * 2, 24 * 3600 * 1000)
      this.db.prepare('UPDATE recrawl_state SET next_check = ?, interval_ms = ? WHERE url = ?')
        .run(now + backoff, backoff, url)
    }

    if (changed) this.emit('url_changed', url)

    return { url, changed, reason }
  }

  /** Adaptive interval: slow down stable sources, speed up volatile ones. */
  private _adaptInterval(currentMs: number, changed: boolean): number {
    const min = 5 * 60 * 1000          // 5 min
    const max = 24 * 60 * 60 * 1000    // 24 hours
    if (changed) {
      // Changed → check more frequently (halve interval, min 5 min)
      return Math.max(Math.floor(currentMs / 2), min)
    } else {
      // Stable → check less frequently (increase by 20%, max 24h)
      return Math.min(Math.floor(currentMs * 1.2), max)
    }
  }

  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS recrawl_state (
        url           TEXT PRIMARY KEY,
        etag          TEXT,
        last_modified TEXT,
        content_hash  TEXT,
        last_checked  INTEGER NOT NULL,
        last_changed  INTEGER NOT NULL,
        check_count   INTEGER NOT NULL DEFAULT 0,
        change_count  INTEGER NOT NULL DEFAULT 0,
        next_check    INTEGER NOT NULL,
        interval_ms   INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_next_check ON recrawl_state(next_check);
    `)
  }

  private _rowToEntry(row: any): RecrawlEntry {
    return {
      url:          row.url,
      etag:         row.etag ?? undefined,
      lastModified: row.last_modified ?? undefined,
      contentHash:  row.content_hash ?? undefined,
      lastChecked:  row.last_checked,
      lastChanged:  row.last_changed,
      checkCount:   row.check_count,
      changeCount:  row.change_count,
      nextCheck:    row.next_check,
      intervalMs:   row.interval_ms,
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

export const smartRecrawl = new SmartRecrawlService()
