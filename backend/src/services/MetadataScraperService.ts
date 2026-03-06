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
import { omdbService, type OmdbMeta }        from './OmdbService.js'
import { jikanService, type JikanMeta }      from './JikanService.js'
import { fanArtTv, type FanArtMovieMeta, type FanArtTvMeta } from './FanArtTvService.js'
import { mdbList,  type MDBListMeta }        from './MDBListService.js'

// ── Quality ranking (ported from torrentiolike filter/filter.go) ──────────────
// Lower number = higher quality tier (used for sorting: best first)
export const QUALITY_RANK: Record<string, number> = {
  '4K':      0,
  '2160P':   0,
  'UHD':     0,
  '1080P':   1,
  'FHD':     1,
  '720P':    2,
  'HD':      2,
  '576P':    3,
  '480P':    3,
  'SD':      4,
  'CAM':     5,
  'UNKNOWN': 6,
}

/**
 * Composite stream rank — lower is better.
 * Matches torrentiolike's: qualityScore*10_000_000 + seederScore
 * quality: one of the QUALITY_RANK keys (case-insensitive)
 * seeders: number of seeders (0 if unknown / not applicable)
 */
export function rankStream(quality: string, seeders = 0): number {
  const tier = QUALITY_RANK[quality.toUpperCase()] ?? QUALITY_RANK['UNKNOWN']
  const qualityScore = tier * 10_000_000
  const seederScore  = seeders > 0 ? Math.max(0, 9_999_999 - seeders * 100) : 9_999_999
  return qualityScore + seederScore
}

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

// ── Cinemeta types (Stremio public API — no key required) ────────────────────

export interface CinemetaMeta {
  imdbId:     string
  type:       'movie' | 'series'
  title:      string
  year?:      number
  genres:     string[]
  rating:     number
  runtimeMin: number
  plot:       string
  poster:     string
  backdrop:   string
  cast:       string[]
  director:   string
  writer:     string
  language:   string
  country:    string
  awards:     string
  seasons:    number
}

// ── Torrentiolike sidecar types ──────────────────────────────────────────────

export interface TorrentiolikeMeta {
  imdbId:     string
  tmdbId?:    number
  type:       string
  title:      string
  year?:      number
  genres:     string[]
  rating:     number
  votes:      number
  runtimeMin: number
  plot:       string
  poster:     string
  backdrop:   string
  cast:       string[]
  director:   string
  writer:     string
  language:   string
  country:    string
  awards:     string
  seasons:    number
  metaSource: string
}

// ── Merged rich metadata — best field wins across all providers ───────────────

export interface RichMeta {
  imdbId?:    string
  tmdbId?:    number
  type?:      string
  title:      string
  year?:      number
  genres:     string[]
  rating:     number
  /** All source ratings keyed by source name (imdb, tmdb, trakt, rt, metacritic…) */
  allRatings: Record<string, number>
  runtimeMin: number
  plot:       string
  poster:     string
  backdrop:   string
  /** HD clear logo (transparent PNG) — from FanArt.tv; ideal for channel/show overlays */
  logo?:      string
  /** HD clearart / character art — from FanArt.tv */
  clearArt?:  string
  cast:       string[]
  director:   string
  writer:     string
  language:   string
  country:    string
  awards:     string
  seasons:    number
  sources:    string[]
}

export interface ScrapedMetadata {
  inputUrl:        string
  inputTitle:      string
  parsed:          ParsedTorrentTitle
  head?:           HttpHeadInfo
  tmdb?:           TmdbMatch
  cinemeta?:       CinemetaMeta
  torrentiolike?:  TorrentiolikeMeta
  omdb?:           OmdbMeta
  jikan?:          JikanMeta
  fanartMovie?:    FanArtMovieMeta
  fanartTv?:       FanArtTvMeta
  mdblist?:        MDBListMeta
  richMeta?:       RichMeta
  scrapedAt:       number
  durationMs:      number
  source:          'cache' | 'live'
}

export interface BatchScrapeOptions {
  concurrency:    number        // default: 10
  includeTmdb:    boolean       // default: true if TMDB_API_KEY set
  includeHead:    boolean       // default: true
  includeOmdb:    boolean       // default: true if OMDB_API_KEY set
  includeJikan:   boolean       // default: true (no key needed)
  includeFanArt:  boolean       // default: true if FANART_TV_API_KEY set
  includeMdbList: boolean       // default: true if MDBLIST_API_KEY set
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

// ── Cinemeta lookup (Stremio public API — no key needed) ─────────────────────

const CINEMETA_BASE = 'https://v3-cinemeta.strem.io'

function parseCinemetaRuntime(s: string): number {
  if (!s) return 0
  const lower = s.toLowerCase()
  let total = 0
  const hIdx = lower.indexOf('h')
  if (hIdx > 0) {
    total += parseInt(lower.slice(0, hIdx).trim()) * 60
    s = lower.slice(hIdx + 1)
  }
  const mins = parseInt(s.replace(/min/i, '').trim())
  if (!isNaN(mins)) total += mins
  return total
}

function parseCinemetaYear(v: unknown): number | undefined {
  if (v == null) return undefined
  if (typeof v === 'number') return v > 0 ? v : undefined
  if (typeof v === 'string') {
    const y = parseInt(v.split(/[–\-]/)[0].trim())
    return isNaN(y) ? undefined : y
  }
  return undefined
}

async function lookupCinemeta(parsed: ParsedTorrentTitle, timeoutMs: number): Promise<CinemetaMeta | undefined> {
  if (!parsed.clean) return undefined
  try {
    const typeGuess = parsed.season !== undefined ? 'series' : 'movie'
    // Step 1: resolve title → imdbId via catalog search
    const searchUrl = `${CINEMETA_BASE}/catalog/${typeGuess}/top/search=${encodeURIComponent(parsed.clean)}.json`
    const searchRes = await axios.get(searchUrl, { timeout: timeoutMs })
    const metas: any[] = (searchRes.data as any).metas ?? []

    let imdbId: string | undefined
    for (const m of metas) {
      if (!String(m.id).startsWith('tt')) continue
      const metaYear = parseCinemetaYear(m.year)
      if (parsed.year && metaYear && Math.abs(metaYear - parsed.year) > 1) continue
      imdbId = m.id
      break
    }
    if (!imdbId) return undefined

    // Step 2: fetch full metadata by imdbId
    const metaUrl = `${CINEMETA_BASE}/meta/${typeGuess}/${imdbId}.json`
    const metaRes = await axios.get(metaUrl, { timeout: timeoutMs })
    const m = (metaRes.data as any).meta ?? {}

    return {
      imdbId,
      type:       typeGuess,
      title:      m.name ?? parsed.clean,
      year:       parseCinemetaYear(m.year),
      genres:     m.genres ?? [],
      rating:     parseFloat(m.imdbRating) || 0,
      runtimeMin: parseCinemetaRuntime(m.runtime ?? ''),
      plot:       m.description ?? '',
      poster:     m.poster ?? '',
      backdrop:   m.background ?? '',
      cast:       m.cast ?? [],
      director:   Array.isArray(m.director) ? m.director.join(', ') : (m.director ?? ''),
      writer:     Array.isArray(m.writer)   ? m.writer.join(', ')   : (m.writer ?? ''),
      language:   m.language ?? '',
      country:    m.country  ?? '',
      awards:     m.awards   ?? '',
      seasons:    m.totalSeasons ?? 0,
    }
  } catch {
    return undefined
  }
}

// ── Torrentiolike sidecar lookup ──────────────────────────────────────────────

async function lookupTorrentiolike(
  parsed: ParsedTorrentTitle,
  timeoutMs: number,
): Promise<TorrentiolikeMeta | undefined> {
  const baseUrl = process.env.TORRENTIOLIKE_URL
  if (!baseUrl || !parsed.clean) return undefined
  try {
    const typeGuess = parsed.season !== undefined ? 'series' : 'movie'
    const params: Record<string, string | number> = { title: parsed.clean, type: typeGuess }
    if (parsed.year) params.year = parsed.year
    const res = await axios.get(`${baseUrl}/meta`, { params, timeout: timeoutMs })
    const d = (res.data as any).meta
    if (!d) return undefined
    return {
      imdbId:     d.imdb_id     ?? '',
      tmdbId:     d.tmdb_id,
      type:       d.type        ?? typeGuess,
      title:      d.title       ?? parsed.clean,
      year:       d.year,
      genres:     d.genres      ?? [],
      rating:     d.rating      ?? 0,
      votes:      d.votes       ?? 0,
      runtimeMin: d.runtime_mins ?? 0,
      plot:       d.plot        ?? '',
      poster:     d.poster      ?? '',
      backdrop:   d.backdrop    ?? '',
      cast:       d.cast        ?? [],
      director:   d.director    ?? '',
      writer:     d.writer      ?? '',
      language:   d.language    ?? '',
      country:    d.country     ?? '',
      awards:     d.awards      ?? '',
      seasons:    d.seasons     ?? 0,
      metaSource: d.meta_source ?? 'torrentiolike',
    }
  } catch {
    return undefined
  }
}

// ── OMDB lookup ───────────────────────────────────────────────────────────────

async function lookupOmdb(parsed: ParsedTorrentTitle, imdbId?: string, timeoutMs = 8000): Promise<OmdbMeta | undefined> {
  if (!omdbService.isAvailable || !parsed.clean) return undefined
  if (imdbId) return omdbService.getByImdbId(imdbId, timeoutMs)
  const type = parsed.season !== undefined ? 'series' : 'movie'
  return omdbService.getByTitle(parsed.clean, parsed.year, type, timeoutMs)
}

// ── Jikan (MAL) lookup — detects anime content ────────────────────────────────

const ANIME_GENRE_HINTS = /\b(anime|manga|ova|ona|hentai|ecchi|shounen|shoujo|seinen|josei|mecha|isekai)\b/i

async function lookupJikan(parsed: ParsedTorrentTitle, genres: string[], timeoutMs = 8000): Promise<JikanMeta | undefined> {
  if (!parsed.clean) return undefined
  // Only query Jikan for likely-anime content (saves rate limit quota)
  const isLikelyAnime = ANIME_GENRE_HINTS.test(parsed.clean) ||
    genres.some(g => /anime|animation/i.test(g))
  if (!isLikelyAnime) return undefined
  return jikanService.search(parsed.clean, timeoutMs)
}

// ── FanArt.tv lookup ──────────────────────────────────────────────────────────

async function lookupFanArt(
  tmdbId?: number,
  tvdbId?: number,
  type:    'movie' | 'tv' = 'movie',
  timeoutMs = 8000,
): Promise<{ movie?: FanArtMovieMeta; tv?: FanArtTvMeta }> {
  if (type === 'tv' && tvdbId)  return { tv:    await fanArtTv.getTvArt(tvdbId, timeoutMs)    }
  if (type === 'movie' && tmdbId) return { movie: await fanArtTv.getMovieArt(tmdbId, timeoutMs) }
  // Try movie first, then TV if no movie result
  if (tmdbId) {
    const movie = await fanArtTv.getMovieArt(tmdbId, timeoutMs)
    if (movie?.movieposter || movie?.hdmovielogo) return { movie }
  }
  return {}
}

// ── MDBList lookup ────────────────────────────────────────────────────────────

async function lookupMDBList(parsed: ParsedTorrentTitle, imdbId?: string, timeoutMs = 8000): Promise<MDBListMeta | undefined> {
  if (!mdbList.isAvailable || !parsed.clean) return undefined
  if (imdbId) return mdbList.getByImdbId(imdbId, timeoutMs)
  const type = parsed.season !== undefined ? 'show' : 'movie'
  return mdbList.getByTitle(parsed.clean, parsed.year, type, timeoutMs)
}

// ── Rich metadata merger (best-field-wins across all providers) ───────────────
// Priority: torrentiolike (multi-source merged) > cinemeta (IMDb authoritative) > TMDb

function mergeRichMeta(
  parsed:  ParsedTorrentTitle,
  tmdb?:   TmdbMatch,
  cm?:     CinemetaMeta,
  tl?:     TorrentiolikeMeta,
  omdb?:   OmdbMeta,
  jikan?:  JikanMeta,
  fanartMovie?: FanArtMovieMeta,
  fanartTv?:    FanArtTvMeta,
  mdb?:    MDBListMeta,
): RichMeta {
  const sources: string[] = []
  if (tmdb)  sources.push('tmdb')
  if (cm)    sources.push('cinemeta')
  if (tl)    sources.push('torrentiolike')
  if (omdb)  sources.push('omdb')
  if (jikan) sources.push('jikan')
  if (fanartMovie || fanartTv) sources.push('fanart')
  if (mdb)   sources.push('mdblist')

  // pick: first non-empty value wins in priority order (tl > cm > omdb > tmdb > jikan)
  const str  = (...vs: (string  | undefined)[]) => vs.find(v => v && v.trim()) ?? ''
  const num  = (...vs: (number  | undefined)[]) => vs.find(v => v !== undefined && v > 0) ?? 0
  const arr  = (...vs: (string[] | undefined)[]) => vs.find(v => v && v.length > 0) ?? []

  const title = str(tl?.title, cm?.title, omdb?.title, tmdb?.title, jikan?.titleEnglish, jikan?.title, parsed.clean)

  // Build aggregate ratings map (MDBList is the richest source)
  const allRatings: Record<string, number> = {}
  if (mdb?.ratingMap) Object.assign(allRatings, mdb.ratingMap)
  if (omdb?.imdbRating)  allRatings.imdb      = allRatings.imdb  ?? omdb.imdbRating
  if (omdb?.metascore)   allRatings.metacritic = allRatings.metacritic ?? omdb.metascore
  if (tmdb?.rating)      allRatings.tmdb       = allRatings.tmdb  ?? tmdb.rating
  if (jikan?.score)      allRatings.mal        = allRatings.mal   ?? jikan.score

  // Best images: FanArt > torrentiolike > cinemeta > OMDB > TMDb > Jikan
  const poster  = str(fanartMovie?.movieposter, fanartTv?.tvposter, tl?.poster, cm?.poster, omdb?.poster, tmdb?.posterUrl, jikan?.imageUrl)
  const backdrop = str(fanartMovie?.moviebackground, fanartTv?.showbackground, tl?.backdrop, cm?.backdrop, tmdb?.backdropUrl)
  const logo    = str(fanartMovie?.hdmovielogo, fanartTv?.hdtvlogo, fanartTv?.clearlogo)
  const clearArt = str(fanartMovie?.hdmovieclearart)

  return {
    imdbId:    str(tl?.imdbId, cm?.imdbId, omdb?.imdbId, mdb?.imdbId) || undefined,
    tmdbId:    tl?.tmdbId ?? tmdb?.id ?? mdb?.tmdbId ?? undefined,
    type:      str(tl?.type, cm?.type, omdb?.type, jikan?.type, tmdb?.type === 'tv' ? 'series' : tmdb?.type) || undefined,
    title,
    year:      num(tl?.year, cm?.year, omdb?.year, tmdb?.year, jikan?.airedFrom ? parseInt(jikan.airedFrom.slice(0, 4)) : undefined) || undefined,
    genres:    arr(tl?.genres, cm?.genres, omdb?.genre, jikan?.genres, mdb?.genres),
    rating:    num(tl?.rating, cm?.rating, omdb?.imdbRating, tmdb?.rating, jikan?.score),
    allRatings,
    runtimeMin:num(tl?.runtimeMin, cm?.runtimeMin, omdb?.runtime, jikan?.duration ? parseInt(jikan.duration) : undefined),
    plot:      str(tl?.plot, cm?.plot, omdb?.plot, jikan?.synopsis, tmdb?.overview),
    poster,
    backdrop,
    logo:      logo || undefined,
    clearArt:  clearArt || undefined,
    cast:      arr(tl?.cast, cm?.cast, omdb?.actors, mdb?.cast, jikan ? [jikan.studios.join(', ')] : undefined),
    director:  str(tl?.director, cm?.director, omdb?.director),
    writer:    str(tl?.writer, cm?.writer, omdb?.writer),
    language:  str(tl?.language, cm?.language, omdb?.language, mdb?.language),
    country:   str(tl?.country, cm?.country, omdb?.country, mdb?.country),
    awards:    str(tl?.awards, cm?.awards, omdb?.awards),
    seasons:   num(tl?.seasons, cm?.seasons, omdb?.totalSeasons, tmdb?.seasons),
    sources,
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
      includeOmdb:    Boolean(process.env.OMDB_API_KEY),
      includeJikan:   true,
      includeFanArt:  Boolean(process.env.FANART_TV_API_KEY),
      includeMdbList: Boolean(process.env.MDBLIST_API_KEY),
      timeoutMs:   8000,
      ...opts,
    }

    const t0     = Date.now()
    const parsed = parseTorrentTitle(title || url.split('/').pop() || '')

    // Run all providers in parallel
    const [head, tmdb, cinemeta, torrentiolike] = await Promise.all([
      o.includeHead ? probeHead(url, o.timeoutMs) : Promise.resolve(undefined),
      o.includeTmdb ? lookupTmdb(parsed, o.timeoutMs) : Promise.resolve(undefined),
      lookupCinemeta(parsed, o.timeoutMs),
      lookupTorrentiolike(parsed, o.timeoutMs),
    ])

    // Resolve IMDb ID from first-pass results for dependent lookups
    const resolvedImdbId = (cinemeta as CinemetaMeta | undefined)?.imdbId ||
      (torrentiolike as TorrentiolikeMeta | undefined)?.imdbId

    // Run enrichment sources (may use imdbId from first pass)
    const enrichedGenres = cinemeta?.genres ?? tmdb?.genres?.map(String) ?? []
    const fanartType: 'movie' | 'tv' = (parsed.season !== undefined || tmdb?.type === 'tv') ? 'tv' : 'movie'

    const [omdb, jikan, fanartResult, mdblist] = await Promise.all([
      o.includeOmdb    ? lookupOmdb(parsed, resolvedImdbId, o.timeoutMs)    : Promise.resolve(undefined),
      o.includeJikan   ? lookupJikan(parsed, enrichedGenres, o.timeoutMs)   : Promise.resolve(undefined),
      o.includeFanArt  ? lookupFanArt(tmdb?.id, undefined, fanartType, o.timeoutMs) : Promise.resolve({} as { movie?: FanArtMovieMeta; tv?: FanArtTvMeta }),
      o.includeMdbList ? lookupMDBList(parsed, resolvedImdbId, o.timeoutMs) : Promise.resolve(undefined),
    ])

    const richMeta = mergeRichMeta(
      parsed, tmdb, cinemeta ?? undefined, torrentiolike ?? undefined,
      omdb ?? undefined, jikan ?? undefined,
      fanartResult.movie, fanartResult.tv,
      mdblist ?? undefined,
    )

    const result: ScrapedMetadata = {
      inputUrl:   url,
      inputTitle: title,
      parsed,
      head,
      tmdb,
      cinemeta:       cinemeta       ?? undefined,
      torrentiolike:  torrentiolike  ?? undefined,
      omdb:           omdb           ?? undefined,
      jikan:          jikan          ?? undefined,
      fanartMovie:    fanartResult.movie,
      fanartTv:       fanartResult.tv,
      mdblist:        mdblist        ?? undefined,
      richMeta:       richMeta.sources.length > 0 ? richMeta : undefined,
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
      includeOmdb:    Boolean(process.env.OMDB_API_KEY),
      includeJikan:   true,
      includeFanArt:  Boolean(process.env.FANART_TV_API_KEY),
      includeMdbList: Boolean(process.env.MDBLIST_API_KEY),
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
