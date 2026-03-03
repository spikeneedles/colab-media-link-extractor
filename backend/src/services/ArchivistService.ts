/**
 * ArchivistService — Systematic Intelligent Link Acquisition & Sorting
 * Enforces the Archivist Protocol:
 *   Rule 1 – Integrity First:   Only 200 OK URLs enter the archive
 *   Rule 2 – Categorization:    Movies / Live TV / Series (ambiguous → flagged)
 *   Rule 3 – Redundancy Clause: Every commit writes to master M3U AND backup folder
 *   Rule 4 – Meta-Minimum:      sourceUrl, mediaUrl, timestamp, contentType required
 */

import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'
import axios from 'axios'
import Database from 'better-sqlite3'
import bencode from 'bencode'
import { flareSolverr, isCloudflareBlocked } from './FlareSolverrClient.js'
import { apiProviderService } from './ApiProviderService.js'
import { googleDrive } from './GoogleDriveService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PLAYLISTS_DIR = path.join(__dirname, '..', '..', 'playlists')
const BACKUP_DIR    = path.join(__dirname, '..', '..', 'backup')
const DATA_DIR      = path.join(__dirname, '..', '..', 'data')

export type ArchiveCategory = 'movies' | 'live_tv' | 'series' | 'adult_movies' | 'adult_livetv' | 'adult_series'
export type ArchiveStatus   = 'archived' | 'flagged' | 'rejected'

export interface ArchivistEntry {
  sourceUrl:      string
  mediaUrl:       string
  title:          string
  contentType:    string       // MIME type or 'video/stream'
  category?:      string       // hint from scraper
  duration?:      number       // seconds; -1 = unknown / live
  resolution?:    string
  tvgId?:         string
  tvgLogo?:       string
  groupTitle?:    string
  indexer?:       string       // which scraper found it
  /**
   * When true, skip live HTTP validation.
   * Use for entries sourced from trusted playlist files (M3U/M3U8/PLS/XSPF)
   * where the URL is already known to be a stream endpoint.
   */
  skipValidation?: boolean
}

export interface ArchivistResult {
  status:      ArchiveStatus
  category?:   ArchiveCategory
  code?:       string
  entry:       ArchivistEntry
  archivedAt?: string
}

export interface ArchivistStats {
  archived:       number
  rejected:       number
  flagged:        number
  totalUnique:    number
  flaggedPending: number
  playlists: Record<ArchiveCategory, { count: number; sizeBytes: number }>
}

// ── Adult content detection ───────────────────────────────────────────────────

const ADULT_KEYWORDS = [
  'xxx', 'porn', 'adult', 'erotic', 'nsfw', 'hentai', 'nude', 'naked',
  'milf', 'hardcore', 'softcore', 'fetish', 'lewd', 'explicit', 'xvideos',
  'pornhub', 'xnxx', 'brazzers', 'bangbros', 'playboy', 'penthouse',
  'x-rated', '18+', 'x rated',
]
// Prowlarr XXX category code (100000) or common adult group names
const ADULT_SIGNALS = /\b(100000|xxx|porn|adult|erotic|nsfw|hentai|x-rated)\b/i

function isAdultContent(entry: ArchivistEntry): boolean {
  const text = [
    entry.indexer    ?? '',
    entry.groupTitle ?? '',
    entry.category   ?? '',
    entry.title,
    entry.sourceUrl,
  ].join(' ').toLowerCase()
  return ADULT_KEYWORDS.some(kw => text.includes(kw)) || ADULT_SIGNALS.test(text)
}

// ── Real Debrid / debrid URL detection ────────────────────────────────────────

const DEBRID_URL_RE     = /real-debrid\.com|debrid-link\.fr|alldebrid\.com|premiumize\.me|offcloud\.com/i
const DEBRID_INDEXER_RE = /real.?debrid|alldebrid|premiumize/i

function isDebridUrl(url: string, indexer?: string): boolean {
  return DEBRID_URL_RE.test(url) || (!!indexer && DEBRID_INDEXER_RE.test(indexer))
}

// ── Category classification keywords ─────────────────────────────────────────

const LIVE_TV_WORDS = [
  'live', 'channel', 'stream', 'news', 'sport', 'broadcast', 'radio',
  'nbc', 'abc', 'cbs', 'cnn', 'fox', 'bbc', 'hbo', 'espn', 'mtv',
  'fm', 'am', 'iptv', '24/7', 'continuous', 'replay', 'feed',
]
const SERIES_WORDS = [
  's01', 's02', 's03', 's04', 's05', 's06', 's07', 's08',
  'e01', 'e02', 'e03', 'e04', 'season', 'episode', 'ep.', 'ep ',
  'complete series', 'tv show', 'tvshow', 'miniseries', 'pilot',
]
const MOVIE_WORDS = [
  'movie', 'film', 'dvdrip', 'bluray', 'blu-ray', 'bdrip', 'webrip',
  'web-dl', 'hdcam', 'theatrical', 'extended cut', 'directors cut',
  'unrated', '(2024)', '(2023)', '(2022)', '(2021)', '(2020)',
  '(2019)', '(2018)', '(2017)', '(2016)', '(2015)', '(19',
]

const PLAYLIST_FILES: Record<ArchiveCategory, string> = {
  movies:        path.join(PLAYLISTS_DIR, 'movies_master.m3u'),
  live_tv:       path.join(PLAYLISTS_DIR, 'livetv_master.m3u'),
  series:        path.join(PLAYLISTS_DIR, 'series_master.m3u'),
  adult_movies:  path.join(PLAYLISTS_DIR, 'adult_movies_master.m3u'),
  adult_livetv:  path.join(PLAYLISTS_DIR, 'adult_livetv_master.m3u'),
  adult_series:  path.join(PLAYLISTS_DIR, 'adult_series_master.m3u'),
}

const BACKUP_DIRS: Record<ArchiveCategory, string> = {
  movies:        path.join(BACKUP_DIR, 'movies'),
  live_tv:       path.join(BACKUP_DIR, 'live_tv'),
  series:        path.join(BACKUP_DIR, 'series'),
  adult_movies:  path.join(BACKUP_DIR, 'adult_movies'),
  adult_livetv:  path.join(BACKUP_DIR, 'adult_livetv'),
  adult_series:  path.join(BACKUP_DIR, 'adult_series'),
}

// Normalize a title for fuzzy dedup: lowercase, strip articles/year/punctuation
function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, '')           // leading articles
    .replace(/\s*[\[(]\s*(?:19|20)\d{2}\s*[\])]/g, '')  // (year) or [year]
    .replace(/[^a-z0-9\s]/g, '')              // strip punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

// ── ArchivistService ──────────────────────────────────────────────────────────

export class ArchivistService {
  private db: Database.Database
  private sessionStats = { archived: 0, rejected: 0, flagged: 0 }
  private readonly validationTimeout: number
  private readonly batchConcurrency: number
  // Webhook calls run fully parallel — no queue needed (no rate limit on our own service)
  private resolveViaRdQueued(url: string, title?: string) {
    return this.resolveMediaUrl(url, title)
  }

  constructor() {
    this.validationTimeout  = parseInt(process.env.ARCHIVIST_VALIDATION_TIMEOUT ?? '12000', 10)
    this.batchConcurrency   = parseInt(process.env.ARCHIVIST_BATCH_CONCURRENCY  ?? '20', 10)
    this.ensureDirectories()
    this.db = this.openDb()
    this.initSchema()
    this.initMasterPlaylists()
    console.log(`🗂️  ArchivistService (SILAS) online — validation timeout: ${this.validationTimeout}ms | batch concurrency: ${this.batchConcurrency}`)
  }

  // ── Infrastructure ──────────────────────────────────────────────────────────

  private ensureDirectories() {
    const dirs = [PLAYLISTS_DIR, BACKUP_DIR, DATA_DIR, ...Object.values(BACKUP_DIRS)]
    for (const d of dirs) {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
    }
  }

  private openDb(): Database.Database {
    const dbPath = path.join(DATA_DIR, 'media.db')
    return new Database(dbPath)
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS archivist_archive (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        media_url      TEXT    NOT NULL UNIQUE,
        source_url     TEXT    NOT NULL,
        title          TEXT    NOT NULL,
        title_norm     TEXT    NOT NULL DEFAULT '',
        content_type   TEXT    NOT NULL,
        category       TEXT    NOT NULL,
        indexer        TEXT,
        resolution     TEXT,
        archived_at    TEXT    NOT NULL
      );
      CREATE TABLE IF NOT EXISTS archivist_flagged (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        source_url  TEXT NOT NULL,
        media_url   TEXT NOT NULL UNIQUE,
        title       TEXT NOT NULL,
        content_type TEXT NOT NULL,
        raw_data    TEXT NOT NULL,
        flagged_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_archivist_archive_url       ON archivist_archive(media_url);
      CREATE INDEX IF NOT EXISTS idx_archivist_archive_cat       ON archivist_archive(category);
      CREATE INDEX IF NOT EXISTS idx_archivist_archive_title_norm ON archivist_archive(title_norm, category);
    `)
    // Migrate: add title_norm column to existing DBs that predate this schema
    try {
      this.db.exec(`ALTER TABLE archivist_archive ADD COLUMN title_norm TEXT NOT NULL DEFAULT ''`)
    } catch { /* column already exists — that's fine */ }
  }

  private initMasterPlaylists() {
    const headers: Record<ArchiveCategory, string> = {
      movies:       '#EXTM3U\n#PLAYLIST:Movies Master — Archivist Protocol\n\n',
      live_tv:      '#EXTM3U\n#PLAYLIST:Live TV Master — Archivist Protocol\n\n',
      series:       '#EXTM3U\n#PLAYLIST:Series Master — Archivist Protocol\n\n',
      adult_movies: '#EXTM3U\n#PLAYLIST:Adult Movies Master — Archivist Protocol\n\n',
      adult_livetv: '#EXTM3U\n#PLAYLIST:Adult Live TV Master — Archivist Protocol\n\n',
      adult_series: '#EXTM3U\n#PLAYLIST:Adult Series Master — Archivist Protocol\n\n',
    }
    for (const [cat, file] of Object.entries(PLAYLIST_FILES) as [ArchiveCategory, string][]) {
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, headers[cat], 'utf-8')
      }
    }
  }

  // ── Rule 1: Integrity First ─────────────────────────────────────────────────

  async validateUrl(url: string): Promise<{
    valid: boolean
    statusCode?: number
    error?: string
    detectedContentType?: string
  }> {
    // RTSP / RTMP / UDP streams cannot be validated via HTTP
    if (/^(rtsp|rtmp|rtmpe|rtmpt|rtp|udp):\/\//i.test(url)) {
      return { valid: true, statusCode: 0, detectedContentType: 'video/stream' }
    }

    const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; ArchivistSILAS/1.0)' }

    try {
      const res = await axios.head(url, {
        timeout: this.validationTimeout,
        maxRedirects: 5,
        headers,
        validateStatus: () => true,
      })
      if (res.status === 200 || res.status === 206) {
        return { valid: true, statusCode: res.status, detectedContentType: res.headers['content-type'] }
      }
      // Some servers reject HEAD — fall through to GET
      if (res.status !== 405 && res.status !== 501) {
        return { valid: false, statusCode: res.status, error: `HTTP_${res.status}` }
      }
    } catch {
      // network error on HEAD — attempt GET
    }

    try {
      const res = await axios.get(url, {
        timeout: this.validationTimeout,
        maxRedirects: 5,
        headers: { ...headers, Range: 'bytes=0-1023' },
        responseType: 'stream',
        validateStatus: () => true,
      })
      // Immediately destroy the stream to avoid consuming the body
      const stream = res.data as import('stream').Readable
      stream.destroy()
      if (res.status === 200 || res.status === 206) {
        return { valid: true, statusCode: res.status, detectedContentType: res.headers['content-type'] }
      }
      return { valid: false, statusCode: res.status, error: `HTTP_${res.status}` }
    } catch (err: any) {
      return { valid: false, error: err.code ?? err.message?.split('\n')[0] ?? 'NETWORK_ERROR' }
    }
  }

  // ── Rule 2: Categorization Mandate ─────────────────────────────────────────

  categorize(entry: ArchivistEntry): ArchiveCategory | 'ambiguous' {
    const text = [
      entry.title,
      entry.mediaUrl,
      entry.groupTitle ?? '',
      entry.category  ?? '',
    ].join(' ').toLowerCase()

    // Explicit category hint from scraper
    if (entry.category) {
      const c = entry.category.toLowerCase()
      if (c.includes('movie') || c.includes('film') || c === 'vod')                  return 'movies'
      if (c.includes('live') || c.includes('channel') || c === 'tv' || c === 'iptv') return 'live_tv'
      if (c.includes('series') || c.includes('episode') || c.includes('show'))       return 'series'
    }

    // Duration-based heuristics
    if (entry.duration !== undefined && entry.duration >= 0) {
      if (entry.duration >= 5400) return 'movies'    // ≥ 90 min
      if (entry.duration === 0)   {
        const liveHits = LIVE_TV_WORDS.filter(w => text.includes(w)).length
        if (liveHits >= 1) return 'live_tv'
      }
    }
    // duration === -1 or undefined → check keywords

    const movieScore  = MOVIE_WORDS.filter(w  => text.includes(w)).length
    const seriesScore = SERIES_WORDS.filter(w => text.includes(w)).length
    const liveScore   = LIVE_TV_WORDS.filter(w => text.includes(w)).length
    const max         = Math.max(movieScore, seriesScore, liveScore)

    if (max === 0) return 'ambiguous'
    if (movieScore  === max && movieScore  > seriesScore && movieScore  > liveScore) return 'movies'
    if (seriesScore === max && seriesScore > movieScore  && seriesScore > liveScore) return 'series'
    if (liveScore   === max && liveScore   > movieScore  && liveScore   > seriesScore) return 'live_tv'

    return 'ambiguous'
  }

  // ── Rule 4: Meta-Minimum check ──────────────────────────────────────────────

  private validateMetaMinimum(entry: ArchivistEntry): string | null {
    if (!entry.sourceUrl)   return 'MISSING_SOURCE_URL'
    if (!entry.mediaUrl)    return 'MISSING_MEDIA_URL'
    if (!entry.contentType) return 'MISSING_CONTENT_TYPE'
    if (!entry.title)       return 'MISSING_TITLE'
    return null
  }

  // ── M3U block builder ───────────────────────────────────────────────────────

  private buildExtinf(entry: ArchivistEntry, category: ArchiveCategory, archivedAt: string): string {
    const groupTitle =
      category === 'movies'       ? 'Movies' :
      category === 'live_tv'      ? 'Live TV' :
      category === 'series'       ? 'Series' :
      category === 'adult_movies' ? 'Adult Movies' :
      category === 'adult_livetv' ? 'Adult Live TV' :
                                    'Adult Series'
    const tvgId      = (entry.tvgId ?? entry.title).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64)
    const parts = [
      '#EXTINF:-1',
      `tvg-id="${tvgId}"`,
      `tvg-name="${entry.title.replace(/"/g, "'")}"`,
      `group-title="${groupTitle}"`,
      `source-url="${entry.sourceUrl}"`,
      `content-type="${entry.contentType}"`,
      `archived-at="${archivedAt}"`,
      entry.tvgLogo   ? `tvg-logo="${entry.tvgLogo}"` : '',
      entry.resolution ? `resolution="${entry.resolution}"` : '',
      entry.indexer   ? `indexer="${entry.indexer}"` : '',
    ]
    return `${parts.filter(Boolean).join(' ')},${entry.title}\n${entry.mediaUrl}\n`
  }

  // ── Rule 3: Redundancy Clause ───────────────────────────────────────────────

  private commitEntry(entry: ArchivistEntry, category: ArchiveCategory, archivedAt: string) {
    const block = this.buildExtinf(entry, category, archivedAt)

    // Primary: append to master playlist
    fs.appendFileSync(PLAYLIST_FILES[category], block, 'utf-8')

    // Backup: JSON + individual M3U file
    const safe      = entry.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 60)
    const stamp     = archivedAt.replace(/[:.]/g, '-')
    const base      = path.join(BACKUP_DIRS[category], `${stamp}_${safe}`)
    const backupMeta = { ...entry, category, archivedAt }
    fs.writeFileSync(`${base}.json`, JSON.stringify(backupMeta, null, 2), 'utf-8')
    fs.writeFileSync(`${base}.m3u`,  `#EXTM3U\n${block}`, 'utf-8')

    // Persist to SQLite for dedup + stats
    this.db.prepare(`
      INSERT OR IGNORE INTO archivist_archive
        (media_url, source_url, title, title_norm, content_type, category, indexer, resolution, archived_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.mediaUrl, entry.sourceUrl, entry.title,
      normalizeTitle(entry.title),
      entry.contentType, category,
      entry.indexer ?? null, entry.resolution ?? null, archivedAt,
    )
  }

  // ── Google Drive auto-sync (debounced 30s) ─────────────────────────────────

  private driveSyncTimer: NodeJS.Timeout | null = null

  private scheduleDriveSync() {
    if (!googleDrive.isConnected()) return
    if (this.driveSyncTimer) clearTimeout(this.driveSyncTimer)
    this.driveSyncTimer = setTimeout(async () => {
      try {
        const result = await googleDrive.syncMasterPlaylists(PLAYLISTS_DIR)
        if (result.synced.length > 0) {
          console.log(`[Archivist] ☁️  Drive sync: ${result.synced.join(', ')}`)
        }
        if (result.errors.length > 0) {
          console.warn('[Archivist] Drive sync errors:', result.errors)
        }
      } catch (err: any) {
        console.warn('[Archivist] Drive sync failed:', err.message)
      }
    }, 30_000) // 30-second debounce — batch many commits into one upload
  }

  // ── Main pipeline: Extract → Validate → Sort → Commit ──────────────────────

  async archive(entry: ArchivistEntry): Promise<ArchivistResult> {
    // Rule 4: Meta-Minimum
    const metaError = this.validateMetaMinimum(entry)
    if (metaError) {
      this.sessionStats.rejected++
      return { status: 'rejected', code: metaError, entry }
    }

    // Reject Real Debrid / debrid links — no longer supported
    if (isDebridUrl(entry.mediaUrl, entry.indexer)) {
      this.sessionStats.rejected++
      return { status: 'rejected', code: 'DEBRID_NOT_SUPPORTED', entry }
    }

    // ── Auto-Resolve: convert non-streamable URLs to direct streams ──────────
    // Runs before dedup/validation so we store the resolved URL, not the raw one.
    // Handles: magnet links, .torrent URLs, and Prowlarr proxy download URLs

    const isProwlarrProxy = /^https?:\/\/localhost:\d+\/.*download\?.*apikey=/i.test(entry.mediaUrl) ||
                            /^https?:\/\/127\.0\.0\.1:\d+\/.*download\?.*apikey=/i.test(entry.mediaUrl)

    if (/^(magnet:|infohash:)/i.test(entry.mediaUrl) || /\.torrent(\?|$)/i.test(entry.mediaUrl) || isProwlarrProxy) {
      console.log(`[Archivist] Auto-resolving via Webhook: ${entry.mediaUrl.substring(0, 80)}`)
      const resolved = await this.resolveViaRdQueued(entry.mediaUrl, entry.title)
      if (!resolved.resolved) {
        this.sessionStats.rejected++
        return { status: 'rejected', code: `RESOLVE_FAILED:${resolved.method}`, entry }
      }
      // Swap in the resolved direct stream URL
      entry.mediaUrl    = resolved.resolved
      entry.contentType = resolved.contentType ?? entry.contentType
      if (resolved.title && (entry.title === 'Untitled' || !entry.title)) {
        entry.title = resolved.title
      }
      console.log(`[Archivist] Resolved to: ${entry.mediaUrl.substring(0, 80)}`)
    }

    // Deduplication — URL exact match
    const existing = this.db.prepare(
      'SELECT id FROM archivist_archive WHERE media_url = ?'
    ).get(entry.mediaUrl)
    if (existing) {
      this.sessionStats.rejected++
      return { status: 'rejected', code: 'DUPLICATE_URL', entry }
    }

    // Deduplication — normalized title match (same show/movie, different stream URL)
    const titleNorm = normalizeTitle(entry.title)
    if (titleNorm.length > 3) {
      const dupTitle = this.db.prepare(
        `SELECT id FROM archivist_archive WHERE title_norm = ? AND category NOT IN ('live_tv', 'adult_livetv') LIMIT 1`
      ).get(titleNorm)
      if (dupTitle) {
        this.sessionStats.rejected++
        return { status: 'rejected', code: 'DUPLICATE_TITLE', entry }
      }
    }

    // Rule 1: Integrity First — validate the (now-resolved) URL
    // Entries from trusted playlist files skip live HTTP validation to avoid
    // false-rejecting streams that require specific clients or player headers.
    if (!entry.skipValidation) {
    const validation = await this.validateUrl(entry.mediaUrl)
    if (!validation.valid) {
      // One last chance: try page/stream extraction for HTTP URLs that failed HEAD
      if (/^https?:\/\//i.test(entry.mediaUrl)) {
        const fallback = await this.resolveMediaUrl(entry.mediaUrl, entry.title)
        if (fallback.resolved && fallback.resolved !== entry.mediaUrl) {
          entry.mediaUrl = fallback.resolved
          entry.contentType = fallback.contentType ?? entry.contentType
        } else {
          this.sessionStats.rejected++
          return { status: 'rejected', code: validation.error ?? `HTTP_${validation.statusCode}`, entry }
        }
      } else {
        this.sessionStats.rejected++
        return { status: 'rejected', code: validation.error ?? `HTTP_${validation.statusCode}`, entry }
      }
    }

    // Use detected MIME type as fallback
    if (entry.contentType === 'unknown' && validation.detectedContentType) {
      entry.contentType = validation.detectedContentType.split(';')[0].trim()
    }
    }

    // Rule 2: Categorization Mandate
    const resolved = this.categorize(entry)

    // Adult content override — routes to adult sub-category
    if (isAdultContent(entry)) {
      const adultCat: ArchiveCategory =
        resolved === 'live_tv' ? 'adult_livetv' :
        resolved === 'series'  ? 'adult_series' :
                                 'adult_movies'  // default (includes ambiguous)
      const archivedAt = new Date().toISOString()
      this.commitEntry(entry, adultCat, archivedAt)
      this.sessionStats.archived++
      this.scheduleDriveSync()
      return { status: 'archived', category: adultCat, entry, archivedAt }
    }

    if (resolved === 'ambiguous') {
      this.sessionStats.flagged++
      const flaggedAt = new Date().toISOString()
      this.db.prepare(`
        INSERT OR REPLACE INTO archivist_flagged
          (source_url, media_url, title, content_type, raw_data, flagged_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        entry.sourceUrl, entry.mediaUrl, entry.title,
        entry.contentType, JSON.stringify(entry), flaggedAt,
      )
      return { status: 'flagged', code: 'AMBIGUOUS_CATEGORY', entry }
    }

    // Rule 3: Redundancy Clause — commit to master + backup simultaneously
    const archivedAt = new Date().toISOString()
    this.commitEntry(entry, resolved, archivedAt)
    this.sessionStats.archived++
    this.scheduleDriveSync()

    return { status: 'archived', category: resolved, entry, archivedAt }
  }

  async archiveBatch(entries: ArchivistEntry[], concurrency?: number): Promise<ArchivistResult[]> {
    const limit = concurrency ?? this.batchConcurrency
    const results: ArchivistResult[] = []
    for (let i = 0; i < entries.length; i += limit) {
      const slice = entries.slice(i, i + limit)
      const batch = await Promise.all(slice.map(e => this.archive(e)))
      results.push(...batch)
    }
    return results
  }

  // ── Playlist serving ────────────────────────────────────────────────────────

  getPlaylistContent(category: ArchiveCategory): string {
    const file = PLAYLIST_FILES[category]
    if (!fs.existsSync(file)) return '#EXTM3U\n'
    return fs.readFileSync(file, 'utf-8')
  }

  getPlaylistPath(category: ArchiveCategory): string {
    return PLAYLIST_FILES[category]
  }

  // ── Flagged items management ────────────────────────────────────────────────

  getFlaggedItems(): ArchivistEntry[] {
    const rows = this.db.prepare('SELECT raw_data FROM archivist_flagged').all() as { raw_data: string }[]
    return rows.map(r => JSON.parse(r.raw_data))
  }

  resolveFlagged(mediaUrl: string, assignedCategory: ArchiveCategory): boolean {
    const row = this.db.prepare(
      'SELECT raw_data FROM archivist_flagged WHERE media_url = ?'
    ).get(mediaUrl) as { raw_data: string } | undefined
    if (!row) return false

    const entry: ArchivistEntry = JSON.parse(row.raw_data)
    entry.category = assignedCategory
    const archivedAt = new Date().toISOString()
    this.commitEntry(entry, assignedCategory, archivedAt)
    this.db.prepare('DELETE FROM archivist_flagged WHERE media_url = ?').run(mediaUrl)
    return true
  }

  // ── Stats ───────────────────────────────────────────────────────────────────

  getStats(): ArchivistStats {
    const totalRow   = this.db.prepare('SELECT COUNT(*) as n FROM archivist_archive').get() as { n: number }
    const flaggedRow = this.db.prepare('SELECT COUNT(*) as n FROM archivist_flagged').get() as { n: number }

    const playlists = {} as Record<ArchiveCategory, { count: number; sizeBytes: number }>
    for (const cat of ['movies', 'live_tv', 'series', 'adult_movies', 'adult_livetv', 'adult_series'] as ArchiveCategory[]) {
      const row = this.db.prepare(
        'SELECT COUNT(*) as n FROM archivist_archive WHERE category = ?'
      ).get(cat) as { n: number }
      const file = PLAYLIST_FILES[cat]
      playlists[cat] = {
        count: row.n,
        sizeBytes: fs.existsSync(file) ? fs.statSync(file).size : 0,
      }
    }

    return {
      archived:       this.sessionStats.archived,
      rejected:       this.sessionStats.rejected,
      flagged:        this.sessionStats.flagged,
      totalUnique:    totalRow.n,
      flaggedPending: flaggedRow.n,
      playlists,
    }
  }

  // ── Cross-component source processing ──────────────────────────────────────
  // Converts raw crawl results (from BackgroundCrawler / SearchCrawler) into
  // ArchivistEntry objects and runs the full pipeline.

  async processCrawlResults(
    results: Array<{
      title?: string
      downloadUrl?: string
      magnetUrl?: string
      guid?: string
      category?: string
      indexer?: string
      publishDate?: string
      infoHash?: string
    }>,
    sourceUrl: string,
    indexerName?: string,
  ): Promise<{ archived: number; rejected: number; flagged: number }> {
    const entries: ArchivistEntry[] = []

    for (const r of results) {
      // If we have an info hash, build a proper magnet — this is the cleanest input for TorrentIO
      const infoHashMagnet = r.infoHash
        ? `magnet:?xt=urn:btih:${r.infoHash}&dn=${encodeURIComponent(r.title ?? '')}`
        : undefined
      // Prefer real magnet (guid starting with magnet:) over Prowlarr proxy magnetUrl
      const guidMagnet = r.guid?.startsWith('magnet:') ? r.guid : undefined
      const realMagnet = r.magnetUrl?.startsWith('magnet:') ? r.magnetUrl : undefined
      // Priority: infoHash magnet > guid magnet > real magnetUrl > downloadUrl > other
      const url = infoHashMagnet || guidMagnet || realMagnet || r.downloadUrl || r.magnetUrl || r.guid
      if (!url) continue
      // Skip infohash-only identifiers with no title clue
      if (/^infohash:/i.test(url) && !r.title) continue
      // Must be a recognizable protocol
      if (
        !/^(magnet:|https?:\/\/|rtsp:\/\/|rtmp:\/\/|rtp:\/\/|udp:\/\/)/i.test(url) &&
        !/^infohash:/i.test(url)
      ) continue

      entries.push({
        sourceUrl:   sourceUrl,
        mediaUrl:    url,
        title:       r.title ?? new URL(url).pathname.split('/').pop() ?? 'Untitled',
        contentType: 'unknown',
        category:    r.category,
        indexer:     indexerName ?? r.indexer,
      })
    }

    const batchResults = await this.archiveBatch(entries)
    return {
      archived: batchResults.filter(r => r.status === 'archived').length,
      rejected: batchResults.filter(r => r.status === 'rejected').length,
      flagged:  batchResults.filter(r => r.status === 'flagged').length,
    }
  }

  async processSearchResults(
    mediaUrls: Array<{ url: string; title?: string; contentType?: string; sourcePageUrl?: string; indexer?: string }>,
    sourceUrl: string,
  ): Promise<{ archived: number; rejected: number; flagged: number }> {
    const entries: ArchivistEntry[] = mediaUrls.map(m => ({
      sourceUrl:   m.sourcePageUrl ?? sourceUrl,
      mediaUrl:    m.url,
      title:       m.title ?? new URL(m.url).pathname.split('/').pop() ?? 'Untitled',
      contentType: m.contentType ?? 'unknown',
      indexer:     m.indexer,
    }))

    const batchResults = await this.archiveBatch(entries)
    return {
      archived: batchResults.filter(r => r.status === 'archived').length,
      rejected: batchResults.filter(r => r.status === 'rejected').length,
      flagged:  batchResults.filter(r => r.status === 'flagged').length,
    }
  }

  // ── Auto-Resolve Pipeline ──────────────────────────────────────────────────
  // Detects non-playable URLs (magnets, torrents, mirrors, HTML pages with
  // embedded video) and attempts to extract a direct streamable media URL.

  async resolveMediaUrl(url: string, hintTitle?: string): Promise<{
    resolved: string | null
    method: string
    title?: string
    contentType?: string
    allStreams?: string[]
  }> {
    // ── Already-streamable native protocols ────────────────────────────────
    if (/^(rtsp|rtmp|rtmpe|rtmpt|rtp|udp):\/\//i.test(url)) {
      return { resolved: url, method: 'native_stream' }
    }

    // ── Magnet link ────────────────────────────────────────────────────────
    if (/^magnet:/i.test(url)) {
      // 1. Try TorrentIO (free, no API key, works without debrid)
      const hashMatch = url.match(/xt=urn:btih:([a-zA-Z0-9]+)/i)
      if (hashMatch) {
        const stream = await this.resolveTorrentIO(hashMatch[1], hintTitle)
        if (stream) return { resolved: stream, method: 'magnet→torrentio' }
      }
      // 2. Try torrent-to-m3u8 webhook
      const webhookUrl = process.env.TORRENT_WEBHOOK_URL
      const webhookKey = process.env.TORRENT_WEBHOOK_KEY
      if (webhookUrl && webhookKey) {
        try {
          console.log(`[Archivist] Magnet → Webhook: ${url.substring(0, 80)}`)
          const whResult = await axios.post(webhookUrl, { type: 'magnet', data: url, filter: 'all' }, {
            headers: { 'Content-Type': 'application/json', 'X-API-Key': webhookKey },
            timeout: 30000,
          })
          const streamUrl = whResult.data?.streamUrl ?? whResult.data?.url ?? whResult.data?.m3u8
          if (streamUrl) {
            console.log(`[Archivist] Webhook resolved magnet: ${streamUrl.substring(0, 80)}`)
            return { resolved: streamUrl, method: 'magnet→webhook', title: whResult.data?.title }
          }
        } catch { /* fall through to archive.org */ }
      }
      const qs   = url.includes('?') ? url.split('?')[1] : url.replace(/^magnet:/, '')
      const dn   = new URLSearchParams(qs).get('dn') ?? hintTitle ?? ''
      const clean = this.cleanTorrentTitle(decodeURIComponent(dn))
      if (clean) {
        const found = await this.searchArchiveOrg(clean)
        if (found) return { ...found, method: 'magnet→archive_org' }
      }
      return { resolved: null, method: 'magnet_no_stream', title: clean || dn }
    }

    // ── HTTP(S) URL — HEAD first ───────────────────────────────────────────
    if (/^https?:\/\//i.test(url)) {
      let finalUrl = url
      let ct       = ''

      try {
        const head = await axios.head(url, {
          timeout: 8000,
          maxRedirects: 10,
          validateStatus: () => true,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ArchivistSILAS/1.0)' },
        })
        ct       = (head.headers['content-type'] ?? '').toLowerCase()
        finalUrl = (head.request as any)?.res?.responseUrl ?? url

        // Already streamable
        if (/^(video\/|audio\/|application\/x-mpegurl|application\/vnd\.apple\.mpegurl)/i.test(ct)) {
          return { resolved: finalUrl, method: 'direct_stream', contentType: ct }
        }

        // Torrent file → extract info hash → TorrentIO → webhook → archive.org
        if (ct.includes('bittorrent') || ct.includes('x-torrent') || /\.torrent(\?|$)/i.test(finalUrl)) {
          // Download the small torrent binary and extract info hash
          try {
            const torrentBuf = await axios.get(finalUrl, {
              responseType: 'arraybuffer', timeout: 10000,
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ArchivistSILAS/1.0)' },
            })
            const infoHash = this.extractTorrentInfoHash(Buffer.from(torrentBuf.data))
            if (infoHash) {
              const stream = await this.resolveTorrentIO(infoHash, hintTitle)
              if (stream) return { resolved: stream, method: 'torrent→torrentio' }
            }
          } catch { /* fall through */ }
          const webhookUrl = process.env.TORRENT_WEBHOOK_URL
          const webhookKey = process.env.TORRENT_WEBHOOK_KEY
          if (webhookUrl && webhookKey) {
            try {
              console.log(`[Archivist] Torrent detected — sending to Webhook: ${finalUrl.substring(0, 80)}`)
              const whResult = await axios.post(webhookUrl, { type: 'torrent', data: finalUrl, filter: 'all' }, {
                headers: { 'Content-Type': 'application/json', 'X-API-Key': webhookKey },
                timeout: 30000,
              })
              const streamUrl = whResult.data?.streamUrl ?? whResult.data?.url ?? whResult.data?.m3u8
              if (streamUrl) {
                console.log(`[Archivist] Webhook resolved torrent: ${streamUrl.substring(0, 80)}`)
                return { resolved: streamUrl, method: 'torrent→webhook', title: whResult.data?.title }
              }
            } catch { /* fall through to archive.org */ }
          }
          const name  = hintTitle ?? this.cleanTorrentTitle(
            decodeURIComponent(finalUrl.split('/').pop() ?? '').replace(/\.torrent.*/i, '')
          )
          if (name) {
            const found = await this.searchArchiveOrg(name)
            if (found) return { ...found, method: 'torrent→archive_org' }
          }
          return { resolved: null, method: 'torrent_no_stream', title: name }
        }

        // HTML page → extract embedded streams
        if (ct.includes('text/html')) {
          const streams = await this.extractStreamsFromPage(finalUrl)
          if (streams.length > 0) {
            return { resolved: streams[0], allStreams: streams, method: 'page_extraction' }
          }
          // Title-based fallback for HTML pages
          if (hintTitle) {
            const found = await this.searchArchiveOrg(this.cleanTorrentTitle(hintTitle))
            if (found) return { ...found, method: 'page→archive_org' }
          }
          return { resolved: null, method: 'page_no_stream' }
        }
      } catch {
        // HEAD failed — attempt page extraction directly
      }

      // Unknown type or HEAD failed — try direct page extraction
      const streams = await this.extractStreamsFromPage(finalUrl)
      if (streams.length > 0) {
        return { resolved: streams[0], allStreams: streams, method: 'fallback_extraction' }
      }
    }

    return { resolved: null, method: 'unresolvable' }
  }

  private cleanTorrentTitle(raw: string): string {
    return raw
      .replace(/\.(mkv|mp4|avi|mov|ts|wmv|flv)$/i, '')
      .replace(
        /\b(1080p|720p|480p|4k|uhd|hdr|sdr|bluray|blu-ray|bdrip|webrip|web-dl|webdl|hdcam|hdts|cam|dvdrip|xvid|divx|x264|x265|hevc|avc|h264|h265|aac|ac3|dts|dd5|flac|yts|yify|rarbg|ettv|eztv|proper|repack|internal|extended|limited|readnfo)\b.*/gi,
        ''
      )
      .replace(/[._-]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  // ── TorrentIO resolver ──────────────────────────────────────────────────────

  private async resolveTorrentIO(infoHash: string, title?: string): Promise<string | null> {
    // Guess media type from title to hit the right endpoint
    const isEpisode = /s\d{2}e\d{2}|\bseason\b|\bepisode\b/i.test(title ?? '')
    const types = isEpisode ? ['series', 'movie'] : ['movie', 'series']
    for (const t of types) {
      for (const base of [
        'https://torrentio.stremio.now.sh',
        'https://torrentio.strem.fun',
      ]) {
        try {
          const res = await axios.get(`${base}/stream/${t}/${infoHash}.json`, { timeout: 12000 })
          const streams: any[] = res.data?.streams ?? []
          const http = streams.find(s => /^https?:\/\//i.test(s.url ?? ''))
          if (http?.url) {
            console.log(`[Archivist] TorrentIO ✓  ${http.url.substring(0, 80)}`)
            return http.url
          }
        } catch { /* try next endpoint */ }
      }
    }
    return null
  }

  // ── Extract SHA1 info hash from a .torrent binary (bencode) ─────────────────

  private extractTorrentInfoHash(buf: Buffer): string | null {
    try {
      const torrent = bencode.decode(buf) as any
      const infoEncoded = bencode.encode(torrent.info)
      return createHash('sha1').update(infoEncoded).digest('hex')
    } catch { return null }
  }

  private async searchArchiveOrg(title: string): Promise<{ resolved: string; title: string } | null> {
    if (!title || title.length < 3) return null
    try {
      const search = await axios.get('https://archive.org/advancedsearch.php', {
        params: {
          q:      `title:(${JSON.stringify(title)}) AND mediatype:movies`,
          fl:     'identifier,title',
          output: 'json',
          rows:   5,
          sort:   'downloads desc',
        },
        timeout: 10000,
      })
      const docs: Array<{ identifier: string; title: string }> = search.data?.response?.docs ?? []
      for (const doc of docs) {
        const filesRes = await axios.get(
          `https://archive.org/metadata/${doc.identifier}/files`, { timeout: 8000 }
        )
        const files: Array<{ name: string }> = filesRes.data?.result ?? []
        const video = files.find(f => /\.(mp4|mkv|ogv|avi|m4v|webm)$/i.test(f.name ?? ''))
        if (video) {
          return {
            resolved: `https://archive.org/download/${doc.identifier}/${encodeURIComponent(video.name)}`,
            title:    doc.title,
          }
        }
      }
    } catch { /* silent */ }
    return null
  }

  private async extractStreamsFromPage(url: string): Promise<string[]> {
    const streams: string[] = []
    try {
      let html: string

      // First attempt: plain axios
      try {
        const res = await axios.get(url, {
          timeout: 15000,
          maxRedirects: 5,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept':     'text/html,application/xhtml+xml',
          },
          responseType: 'text',
          validateStatus: () => true,
        })
        const blocked = isCloudflareBlocked({
          status:  res.status,
          headers: res.headers as Record<string, string>,
          body:    typeof res.data === 'string' ? res.data : '',
        })
        if (blocked) throw new Error('Cloudflare block detected')
        html = typeof res.data === 'string' ? res.data : String(res.data)
      } catch {
        // Escalate to FlareSolverr
        const solution = await flareSolverr.get(url)
        if (!solution) return []
        html = solution.response
      }

      // HLS manifest
      const m3u8 = [...html.matchAll(/["'`](https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*?)["'`\s]/gi)]
      streams.push(...m3u8.map(m => m[1]))

      // Direct video file
      const vids = [...html.matchAll(/["'`](https?:\/\/[^"'`\s]+\.(mp4|webm|mkv|ts|ogv|m4v)[^"'`\s]*?)["'`\s]/gi)]
      streams.push(...vids.map(m => m[1]))

      // video src attribute
      const vsrc = [...html.matchAll(/\bsrc=["'](https?:\/\/[^"']+\.(mp4|m3u8|webm|ts|ogv))["']/gi)]
      streams.push(...vsrc.map(m => m[1]))

      // OG video
      const og = html.match(/property=["']og:video["'][^>]*content=["'](https?:\/\/[^"']+)["']/i)
      if (og) streams.push(og[1])

      // Twitter / schema video
      const twit = html.match(/name=["']twitter:player:stream["'][^>]*content=["'](https?:\/\/[^"']+)["']/i)
      if (twit) streams.push(twit[1])
    } catch { /* silent */ }

    // Deduplicate and filter obviously invalid
    return [...new Set(streams)].filter(s => s && s.length > 10)
  }
}

// Singleton — shared across all routes and services
export const archivist = new ArchivistService()
