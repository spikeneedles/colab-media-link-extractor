/**
 * YtDlpService
 *
 * Integrates yt-dlp (https://github.com/yt-dlp/yt-dlp) to extract direct
 * stream URLs from 1,000+ supported sites (YouTube, Twitch, Dailymotion,
 * Vimeo, TikTok, Twitter/X, Instagram, and hundreds more).
 *
 * Prerequisites: yt-dlp must be installed and on PATH.
 *   Windows: winget install yt-dlp  (or pip install yt-dlp)
 *   Linux:   pip install yt-dlp  (or apt/brew install yt-dlp)
 *
 * Env vars:
 *   YTDLP_BIN         — path to yt-dlp binary (default: "yt-dlp")
 *   YTDLP_TIMEOUT     — max seconds per extraction (default: 60)
 *   YTDLP_COOKIES     — path to Netscape cookie file (optional)
 *   YTDLP_PROXY       — proxy URL to pass to yt-dlp (optional)
 */

import { spawn }         from 'child_process'
import { EventEmitter }  from 'events'
import { archivist }     from './ArchivistService.js'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface YtDlpFormat {
  format_id:    string
  ext:          string
  url:          string
  quality?:     string
  fps?:         number
  width?:       number
  height?:      number
  tbr?:         number   // total bitrate kbps
  vcodec?:      string
  acodec?:      string
  filesize?:    number
  protocol:     string
}

export interface YtDlpEntry {
  id:           string
  title:        string
  url:          string          // best direct URL
  webpage_url:  string          // original page URL
  extractor:    string          // site name (e.g. "youtube")
  duration?:    number
  thumbnail?:   string
  description?: string
  formats?:     YtDlpFormat[]
  is_live?:     boolean
  channel?:     string
  uploader?:    string
}

export interface YtDlpResult {
  success:      boolean
  entries:      YtDlpEntry[]
  error?:       string
  sourceUrl:    string
}

// ── Service ────────────────────────────────────────────────────────────────────

export class YtDlpService extends EventEmitter {
  private bin:     string
  private timeout: number
  private cookies: string | undefined
  private proxy:   string | undefined

  constructor() {
    super()
    this.bin     = process.env.YTDLP_BIN     ?? 'yt-dlp'
    this.timeout = parseInt(process.env.YTDLP_TIMEOUT ?? '60', 10) * 1000
    this.cookies = process.env.YTDLP_COOKIES
    this.proxy   = process.env.YTDLP_PROXY
  }

  // ── Core extraction ─────────────────────────────────────────────────────────

  /** Extract a single URL — returns the best direct stream URL + metadata. */
  async extract(url: string): Promise<YtDlpResult> {
    const args = this._baseArgs()
    args.push('--no-playlist', '-j', url)
    return this._run(args, url, false)
  }

  /** Extract all entries from a playlist/channel URL. */
  async extractPlaylist(url: string, maxItems = 200): Promise<YtDlpResult> {
    const args = this._baseArgs()
    args.push('--yes-playlist', '-j', '--flat-playlist',
              '--playlist-end', String(maxItems), url)
    return this._run(args, url, true)
  }

  /** Get the best direct stream URL for a video (fastest — no full metadata). */
  async getBestUrl(url: string): Promise<string | null> {
    const args = this._baseArgs()
    args.push('-g', '--no-playlist', '-f', 'bestvideo+bestaudio/best', url)
    const output = await this._runRaw(args)
    if (!output) return null
    const lines = output.trim().split('\n').filter(Boolean)
    return lines[0] ?? null
  }

  /** List all available formats for a URL. */
  async getFormats(url: string): Promise<YtDlpFormat[]> {
    const result = await this.extract(url)
    if (!result.success || !result.entries[0]?.formats) return []
    return result.entries[0].formats
  }

  /**
   * Extract and auto-archive all media found at url into ArchivistService.
   * Returns count of archived entries.
   */
  async extractAndArchive(url: string, isPlaylist = false): Promise<number> {
    const result = isPlaylist
      ? await this.extractPlaylist(url)
      : await this.extract(url)

    if (!result.success || result.entries.length === 0) return 0

    const entries = result.entries.map(e => ({
      sourceUrl:    url,
      mediaUrl:     e.url,
      title:        e.title,
      contentType:  e.is_live ? 'video/stream' : 'video/mp4',
      duration:     e.duration,
      tvgLogo:      e.thumbnail,
      indexer:      `ytdlp:${e.extractor}`,
      skipValidation: e.is_live, // live streams don't validate via HEAD
    }))

    const results = await archivist.archiveBatch(entries)
    const archived = results.filter(r => r.status === 'archived').length
    this.emit('archived', { url, count: archived, total: entries.length })
    console.log(`[YtDlp] Archived ${archived}/${entries.length} entries from ${url}`)
    return archived
  }

  /** Quick health-check — returns true if yt-dlp is installed and working. */
  async isAvailable(): Promise<boolean> {
    try {
      const output = await this._runRaw(['--version'])
      return Boolean(output?.trim())
    } catch {
      return false
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _baseArgs(): string[] {
    const args: string[] = [
      '--no-warnings',
      '--no-progress',
      '--socket-timeout', '30',
    ]
    if (this.cookies) args.push('--cookies', this.cookies)
    if (this.proxy)   args.push('--proxy', this.proxy)
    return args
  }

  private async _run(args: string[], sourceUrl: string, multiLine: boolean): Promise<YtDlpResult> {
    const raw = await this._runRaw(args)
    if (raw === null) {
      return { success: false, entries: [], error: 'yt-dlp execution failed or not installed', sourceUrl }
    }

    const entries: YtDlpEntry[] = []
    const lines = multiLine ? raw.trim().split('\n') : [raw.trim()]
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const data = JSON.parse(line) as Record<string, any>
        // flat-playlist entries have webpage_url but no direct url
        const directUrl = data.url ?? data.webpage_url ?? ''
        if (!directUrl) continue
        entries.push({
          id:          data.id ?? '',
          title:       data.title ?? data.fulltitle ?? 'Untitled',
          url:         directUrl,
          webpage_url: data.webpage_url ?? sourceUrl,
          extractor:   data.extractor ?? data.ie_key ?? 'unknown',
          duration:    data.duration,
          thumbnail:   data.thumbnail,
          description: data.description,
          formats:     data.formats,
          is_live:     data.is_live ?? false,
          channel:     data.channel ?? data.uploader_id,
          uploader:    data.uploader,
        })
      } catch {
        // not JSON — skip
      }
    }

    return { success: true, entries, sourceUrl }
  }

  private _runRaw(args: string[]): Promise<string | null> {
    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''
      let timedOut = false

      const proc = spawn(this.bin, args, { shell: false })

      const timer = setTimeout(() => {
        timedOut = true
        proc.kill('SIGTERM')
        console.warn(`[YtDlp] Timeout after ${this.timeout / 1000}s for: ${args.slice(-1)[0]}`)
        resolve(null)
      }, this.timeout)

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

      proc.on('close', (code) => {
        clearTimeout(timer)
        if (timedOut) return
        if (code !== 0) {
          console.warn(`[YtDlp] Exit ${code}: ${stderr.slice(0, 200)}`)
          resolve(null)
          return
        }
        resolve(stdout)
      })

      proc.on('error', (err) => {
        clearTimeout(timer)
        if (timedOut) return
        if ((err as any).code === 'ENOENT') {
          console.error('[YtDlp] yt-dlp not found — install it: pip install yt-dlp')
        } else {
          console.error(`[YtDlp] Spawn error: ${err.message}`)
        }
        resolve(null)
      })
    })
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

export const ytDlp = new YtDlpService()
