/**
 * FileSorterService — Parallel File Sorting
 *
 * Scans the downloads directory and any unsorted backup files, then uses
 * N parallel workers to categorize and move each file into the correct
 * backup subfolder (movies / series / live_tv).
 *
 * Every sorted file is also committed through ArchivistService so it
 * appears in the master M3U playlists.
 */

import { EventEmitter } from 'events'
import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { archivist } from './ArchivistService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const VIDEO_EXTS   = new Set(['.mp4','.mkv','.avi','.mov','.ts','.m2ts','.wmv','.flv','.webm','.m4v','.ogv','.3gp'])
const AUDIO_EXTS   = new Set(['.mp3','.flac','.aac','.ogg','.opus','.m4a','.wav','.wma','.ac3','.dts'])
const STREAM_EXTS  = new Set(['.m3u','.m3u8','.pls','.xspf','.asx','.wpl'])
const TORRENT_EXTS = new Set(['.torrent'])
const SKIP_EXTS    = new Set(['.json','.txt','.jpg','.jpeg','.png','.gif','.nfo','.srt','.sub','.idx'])

export type SortCategory = 'movies' | 'series' | 'live_tv'

export interface SortStats {
  scanned:    number
  moved:      number
  archived:   number
  skipped:    number
  errors:     number
  durationMs: number
}

export class FileSorterService extends EventEmitter {
  private readonly downloadsDir: string
  private readonly backupDir:    string
  private running = false

  constructor(opts?: { downloadsDir?: string; backupDir?: string }) {
    super()
    const base        = path.join(__dirname, '..', '..')
    this.downloadsDir = opts?.downloadsDir ?? path.join(base, 'downloads')
    this.backupDir    = opts?.backupDir    ?? path.join(base, 'backup')

    // Ensure destination dirs exist
    for (const d of ['movies', 'series', 'live_tv']) {
      fs.mkdirSync(path.join(this.backupDir, d), { recursive: true })
    }
  }

  /** Run one full sort pass with `concurrency` parallel workers. */
  async sortAll(concurrency = 8): Promise<SortStats> {
    const start = Date.now()
    const stats: SortStats = { scanned: 0, moved: 0, archived: 0, skipped: 0, errors: 0, durationMs: 0 }

    const files = this.collectUnsortedFiles()
    stats.scanned = files.length

    this.emit('sortStart', { total: files.length })

    // Process in parallel batches
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency)
      const results = await Promise.allSettled(batch.map(f => this.sortFile(f)))

      for (const outcome of results) {
        if (outcome.status === 'fulfilled') {
          const r = outcome.value
          if (r === 'moved')    { stats.moved++;   stats.archived++ }
          if (r === 'archived') { stats.archived++ }
          if (r === 'skipped')  { stats.skipped++ }
        } else {
          stats.errors++
          console.error('[FileSorter] Error:', outcome.reason)
        }
      }

      this.emit('sortProgress', {
        processed: Math.min(i + concurrency, files.length),
        total:     files.length,
        stats,
      })
    }

    stats.durationMs = Date.now() - start
    this.emit('sortComplete', stats)
    return stats
  }

  /** Classify and move one file, then pipe through Archivist. */
  private async sortFile(filePath: string): Promise<'moved' | 'archived' | 'skipped'> {
    const ext  = path.extname(filePath).toLowerCase()
    const base = path.basename(filePath)

    if (SKIP_EXTS.has(ext)) return 'skipped'
    if (!VIDEO_EXTS.has(ext) && !AUDIO_EXTS.has(ext) && !STREAM_EXTS.has(ext) && !TORRENT_EXTS.has(ext)) return 'skipped'

    const category = this.classifyByTitle(base)
    const destDir  = path.join(this.backupDir, category)
    const destPath = path.join(destDir, base)

    // Move file if it's not already in its destination
    if (filePath !== destPath && !fs.existsSync(destPath)) {
      try {
        fs.renameSync(filePath, destPath)
      } catch {
        // Cross-device move fallback
        fs.copyFileSync(filePath, destPath)
        fs.unlinkSync(filePath)
      }
    }

    // Pipe through Archivist (local file:// URL so validation is skipped for local paths)
    const fileUrl = `file://${destPath.replace(/\\/g, '/')}`
    let contentType = 'application/octet-stream'
    if (VIDEO_EXTS.has(ext))   contentType = 'video/mp4'
    else if (AUDIO_EXTS.has(ext))  contentType = 'audio/mpeg'
    else if (STREAM_EXTS.has(ext)) contentType = 'application/x-mpegurl'
    else if (TORRENT_EXTS.has(ext)) contentType = 'application/x-bittorrent'
    await archivist.archive({
      sourceUrl:   'file-sorter',
      mediaUrl:    fileUrl,
      title:       this.cleanTitle(base),
      contentType,
      category,
    }).catch(() => {/* non-fatal if already archived */})

    return 'moved'
  }

  /** Scan downloads dir + unsorted files in backup root. */
  private collectUnsortedFiles(): string[] {
    const files: string[] = []

    // Files in downloads/
    if (fs.existsSync(this.downloadsDir)) {
      for (const entry of fs.readdirSync(this.downloadsDir, { withFileTypes: true })) {
        if (entry.isFile()) files.push(path.join(this.downloadsDir, entry.name))
      }
    }

    // Files sitting loose in backup/ root (not in a category subdir)
    if (fs.existsSync(this.backupDir)) {
      for (const entry of fs.readdirSync(this.backupDir, { withFileTypes: true })) {
        if (entry.isFile()) files.push(path.join(this.backupDir, entry.name))
      }
    }

    return files
  }

  // ── Title-based classification ─────────────────────────────────────────────

  private classifyByTitle(filename: string): SortCategory {
    const name = filename.toLowerCase()

    // Live TV signals
    if (/\b(live|stream|channel|hdtv|sport|m3u8?|iptv|24h|broadcast)\b/.test(name)) return 'live_tv'

    // Series signals
    if (/\b(s\d{2}e\d{2}|season|episode|\d+x\d+|miniseries)\b/.test(name)) return 'series'

    // Movies: year pattern + common release keywords
    if (/\b(19|20)\d{2}\b.*\b(bluray|blu-ray|webrip|web-dl|hdcam|dvdrip|bdrip)\b/i.test(name)) return 'movies'
    if (/\b(19|20)\d{2}\b/.test(name)) return 'movies'

    // Default to movies for standalone video files
    return 'movies'
  }

  private cleanTitle(filename: string): string {
    return path.basename(filename, path.extname(filename))
      .replace(/[._-]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  isRunning() { return this.running }
}

// Singleton
export const fileSorter = new FileSorterService()
