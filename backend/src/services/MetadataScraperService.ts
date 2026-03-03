/**
 * MetadataScraperService
 *
 * Lightning-fast parallel metadata extraction for media URLs and torrent titles.
 *
 * Features:
 *  - Configurable concurrency (default 10 parallel workers)
 *  - Torrent title parser (title, year, resolution, codec, source, group)
 *  - HTTP HEAD batch: content-type, content-length, server
 *  - TMDb API enrichment (poster, genres, rating, overview, cast)
 *  - LRU in-memory cache (configurable TTL)
 *  - EventEmitter progress streaming
 *  - Graceful timeout per item
 */

import { EventEmitter }  from 'events'
import axios             from 'axios'
import { flareSolverr, isCloudflareBlocked } from './FlareSolverrClient.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedTorrentTitle {
  clean:       string          // human-readable title without tags
  year?:       number
  resolution?: string          // e.g. '1080p', '4K', '720p'
  codec?:      string          // e.g. 'x265', 'x264', 'HEVC', 'AVC'
  source?:     string          // e.g. 'BluRay', 'WEB-DL', 'WEBRip', 'HDTV'
  audio?:      string          // e.g. 'DTS', 'AAC', 'DD5.1', 'Atmos'
  group?:      string          // release group
  season?:     number
  episode?:    number
  quality:     'UHD' | 'HD' | 'SD' | 'CAM' | 'unknown'
}

export interface HttpHeadInfo {
  contentType?:   string
  contentLength?: number
  server?:        string
  lastModified?:  string
  acceptRanges?:  boolean
  isStream:       boolean      // true if HLS / DASH manifest or streamable type
  isVideo:        boolean
  isAudio:        boolean
}

export interface TmdbMatch {
  id:          number
  title:       string
  originalTitle: string
  overview:    string
  year?:       number
  rating:      number
  voteCount:   number
  genres:      string[]
  posterUrl?:  string
  backdropUrl?: string
  type:        'movie' | 'tv'
  seasons?:    number          // TV only
}

export interface ScrapedMetadata {
  inputUrl:       string
  inputTitle:     string
  parsed:         ParsedTorrentTitle
  head?:          HttpHeadInfo
  tmdb?:          TmdbMatch
  scrapedAt:      number
  durationMs:     number
  source:         'cache' | 'live'
}

export interface BatchScrapeOptions {
  concurrency:    number        // default: 10
  includeTmdb:    boolean       // default: true if TMDB_API_KEY set
  includeHead:    boolean       // default: true
  timeoutMs:      number        // per-item timeout, default: 8000
}

// ── Torrent title parser ──────────────────────────────────────────────────────

const RESOLUTION_RE  = /\b(4k|2160p|uhd|1080p|fhd|720p|hd|576p|480p|360p|sd)\b/i
const CODEC_RE       = /\b(x265|hevc|x264|avc|xvid|divx|vp9|av1|h\.?265|h\.?264)\b/i
const SOURCE_RE      = /\b(blu[\s-]?ray|bluray|bdrip|brrip|web[\s-]?dl|webrip|web[\s-]?rip|hdtv|dvdrip|dvd|hdrip|hdcam|cam|ts|scr|vodrip)\b/i
const AUDIO_RE       = /\b(dts[\s-]?hd|dts|truehd|atmos|ddp|dd\+|dd5\.1|aac|mp3|flac|opus|ac3|eac3|pcm)\b/i
const GROUP_RE       = /-([A-Za-z0-9]{2,12})\s*(?:\[|$)/
const YEAR_RE        = /[\[(]?(19\d{2}|20\d{2})[\])]?/
const SXE_RE         = /\bS(\d{1,2})E(\d{1,2})\b/i
const SEASON_RE      = /\bS(?:eason[\s.]?)?(\d{1,2})\b/i
const TAGS_RE        = /[\[(].*?[\])]/g
const PUNC_RE        = /[.\-_]+/g
const MULTI_SPACE_RE = /\s{2,}/g

export function parseTorrentTitle(raw: string): ParsedTorrentTitle {
  const resM    = raw.match(RESOLUTION_RE)
  const codecM  = raw.match(CODEC_RE)
  const srcM    = raw.match(SOURCE_RE)
  const audioM  = raw.match(AUDIO_RE)
  const groupM  = raw.match(GROUP_RE)
  const yearM   = raw.match(YEAR_RE)
  const sxeM    = raw.match(SXE_RE)
  const seasonM = !sxeM ? raw.match(SEASON_RE) : null

  // Clean the title: remove resolution/codec/source/audio/year/tags/punctuation
  let clean = raw
  if (yearM)   clean = clean.slice(0, raw.indexOf(yearM[0]))
  if (resM)    clean = clean.slice(0, clean.indexOf(resM[0]))
  if (srcM)    clean = clean.slice(0, clean.indexOf(srcM[0]))
  if (sxeM)    clean = clean.slice(0, clean.indexOf(sxeM[0]))
  if (seasonM) clean = clean.slice(0, clean.indexOf(seasonM[0]))
  clean = clean
    .replace(TAGS_RE, '')
    .replace(PUNC_RE, ' ')
    .replace(MULTI_SPACE_RE, ' ')
    .trim()

  const resStr = (resM?.[1] ?? '').toLowerCase()
  const quality: ParsedTorrentTitle['quality'] =
    /4k|2160p|uhd/.test(resStr)       ? 'UHD'     :
    /1080p|720p|fhd|hd/.test(resStr)  ? 'HD'      :
    /480p|576p|360p|sd/.test(resStr)  ? 'SD'      :
    /cam|ts|scr/.test((srcM?.[1] ?? '').toLowerCase()) ? 'CAM' :
    'unknown'

  return {
    clean,
    year:       yearM  ? parseInt(yearM[1])            : undefined,
    resolution: resM   ? resM[1].toUpperCase()         : undefined,
    codec:      codecM ? codecM[1].toUpperCase()       : undefined,
    source:     srcM   ? srcM[1].replace(/[\s-]+/g,' '): undefined,
    audio:      audioM ? audioM[1].toUpperCase()       : undefined,
    group:      groupM ? groupM[1]                     : undefined,
    season:     sxeM   ? parseInt(sxeM[1]) : seasonM ? parseInt(seasonM[1]) : undefined,
    episode:    sxeM   ? parseInt(sxeM[2])             : undefined,
    quality,
  }
}

// ── HTTP HEAD probe ───────────────────────────────────────────────────────────

async function probeHead(url: string, timeoutMs: number): Promise<HttpHeadInfo> {
  const STREAM_TYPES  = /\b(mpegurl|x-mpegurl|dash\+xml|mp2t|ogg|webm|mp4|x-matroska)\b/i
  const VIDEO_TYPES   = /^video\//i
  const AUDIO_TYPES   = /^audio\//i

  try {
    const res = await axios.head(url, {
      timeout: timeoutMs,
      validateStatus: () => true,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SILAS-Archivist/1.0)',
      },
    })
    const ct = (res.headers['content-type'] ?? '') as string
    const cl = res.headers['content-length']
    return {
      contentType:   ct || undefined,
      contentLength: cl ? parseInt(cl) : undefined,
      server:        (res.headers['server'] as string) || undefined,
      lastModified:  (res.headers['last-modified'] as string) || undefined,
      acceptRanges:  res.headers['accept-ranges'] === 'bytes',
      isStream:      STREAM_TYPES.test(ct) || url.includes('.m3u8') || url.includes('.mpd'),
      isVideo:       VIDEO_TYPES.test(ct),
      isAudio:       AUDIO_TYPES.test(ct),
    }
  } catch {
    return { isStream: false, isVideo: false, isAudio: false }
  }
}

// ── TMDb lookup ───────────────────────────────────────────────────────────────

const TMDB_IMG = 'https://image.tmdb.org/t/p/w500'

async function lookupTmdb(parsed: ParsedTorrentTitle, timeoutMs: number): Promise<TmdbMatch | undefined> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey || !parsed.clean) return undefined

  try {
    const typeGuess = (parsed.season !== undefined) ? 'tv' : 'movie'
    const endpoint  = typeGuess === 'tv' ? 'search/tv' : 'search/movie'
    const params: Record<string, string | number> = { api_key: apiKey, query: parsed.clean, page: 1 }
    if (parsed.year && typeGuess === 'movie') params.year = parsed.year

    const res = await axios.get(`https://api.themoviedb.org/3/${endpoint}`, {
      params,
      timeout: timeoutMs,
    })
    const results = (res.data as any).results ?? []
    if (results.length === 0) return undefined

    const top = results[0]
    const title = top.title ?? top.name ?? ''
    const genres = ((top.genre_ids ?? []) as number[]).map(String) // IDs only (no extra lookup)

    return {
      id:            top.id,
      title,
      originalTitle: top.original_title ?? top.original_name ?? title,
      overview:      top.overview ?? '',
      year:          top.release_date ? parseInt(top.release_date.substring(0, 4)) : undefined,
      rating:        top.vote_average ?? 0,
      voteCount:     top.vote_count   ?? 0,
      genres,
      posterUrl:     top.poster_path   ? `${TMDB_IMG}${top.poster_path}`   : undefined,
      backdropUrl:   top.backdrop_path ? `${TMDB_IMG}${top.backdrop_path}` : undefined,
      type:          typeGuess,
      seasons:       top.number_of_seasons,
    }
  } catch {
    return undefined
  }
}

// ── LRU cache ─────────────────────────────────────────────────────────────────

class LRUCache<V> {
  private map: Map<string, { value: V; ts: number }>
  private maxSize: number
  private ttlMs:   number

  constructor(maxSize: number, ttlMs: number) {
    this.map     = new Map()
    this.maxSize = maxSize
    this.ttlMs   = ttlMs
  }

  get(key: string): V | undefined {
    const entry = this.map.get(key)
    if (!entry)                            return undefined
    if (Date.now() - entry.ts > this.ttlMs) { this.map.delete(key); return undefined }
    // Touch (move to end)
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.value
  }

  set(key: string, value: V) {
    if (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value
      if (oldest) this.map.delete(oldest)
    }
    this.map.set(key, { value, ts: Date.now() })
  }

  get size() { return this.map.size }
}

// ── Service ───────────────────────────────────────────────────────────────────

export class MetadataScraperService extends EventEmitter {
  private cache: LRUCache<ScrapedMetadata>

  constructor(cacheSize = 2000, cacheTtlMs = 3_600_000) {
    super()
    this.cache = new LRUCache(cacheSize, cacheTtlMs)
  }

  /**
   * Scrape metadata for a single (url, title) pair.
   * Checks cache first; falls back to live extraction.
   */
  async scrape(url: string, title: string, opts: Partial<BatchScrapeOptions> = {}): Promise<ScrapedMetadata> {
    const cacheKey = `${url}::${title}`
    const cached   = this.cache.get(cacheKey)
    if (cached) return { ...cached, source: 'cache' }

    const o: BatchScrapeOptions = {
      concurrency: 10,
      includeTmdb: Boolean(process.env.TMDB_API_KEY),
      includeHead: true,
      timeoutMs:   8000,
      ...opts,
    }

    const t0     = Date.now()
    const parsed = parseTorrentTitle(title || url.split('/').pop() || '')

    const [head, tmdb] = await Promise.all([
      o.includeHead ? probeHead(url, o.timeoutMs) : Promise.resolve(undefined),
      o.includeTmdb ? lookupTmdb(parsed, o.timeoutMs) : Promise.resolve(undefined),
    ])

    const result: ScrapedMetadata = {
      inputUrl:   url,
      inputTitle: title,
      parsed,
      head,
      tmdb,
      scrapedAt:  Date.now(),
      durationMs: Date.now() - t0,
      source:     'live',
    }
    this.cache.set(cacheKey, result)
    return result
  }

  /**
   * Batch scrape with configurable concurrency.
   * Emits 'progress' events as each item completes.
   * Returns all results (including failures as partial objects).
   */
  async scrapeBatch(
    items: Array<{ url: string; title: string }>,
    opts: Partial<BatchScrapeOptions> = {},
  ): Promise<ScrapedMetadata[]> {
    const o: BatchScrapeOptions = {
      concurrency: 10,
      includeTmdb: Boolean(process.env.TMDB_API_KEY),
      includeHead: true,
      timeoutMs:   8000,
      ...opts,
    }

    const results: ScrapedMetadata[] = new Array(items.length)
    let   completed = 0
    const total     = items.length

    // Semaphore-based concurrency (no extra package needed)
    let active = 0
    let idx    = 0

    await new Promise<void>((resolve) => {
      const next = () => {
        while (active < o.concurrency && idx < total) {
          const i      = idx++
          const item   = items[i]
          active++

          const raceTimeout = new Promise<ScrapedMetadata>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), o.timeoutMs + 2000)
          )

          Promise.race([this.scrape(item.url, item.title, o), raceTimeout])
            .then(r  => { results[i] = r })
            .catch(() => {
              results[i] = {
                inputUrl:   item.url,
                inputTitle: item.title,
                parsed:     parseTorrentTitle(item.title),
                scrapedAt:  Date.now(),
                durationMs: 0,
                source:     'live',
              }
            })
            .finally(() => {
              completed++
              active--
              this.emit('progress', { completed, total, item: results[i] })
              if (completed === total) resolve()
              else next()
            })
        }
      }
      next()
    })

    this.emit('batchDone', { total, results })
    return results
  }

  /** Convenience: parse a title without network calls (instant, sync). */
  parseTitle(title: string): ParsedTorrentTitle {
    return parseTorrentTitle(title)
  }

  get cacheSize(): number { return this.cache.size }

  clearCache() {
    this.cache = new LRUCache(2000, 3_600_000)
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const metadataScraper = new MetadataScraperService()
