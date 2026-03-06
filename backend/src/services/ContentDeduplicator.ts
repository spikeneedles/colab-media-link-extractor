import crypto from 'crypto'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface StreamRecord {
  url: string
  title: string
  bitrate?: number       // bits per second (from HLS manifest BANDWIDTH)
  resolution?: string    // e.g. "1920x1080"
  codec?: string
  source?: string        // BluRay, WEB-DL, etc.
  audioFormat?: string
  [key: string]: unknown
}

export interface NormalizedMeta {
  normalizedTitle: string
  season?: number
  episode?: number
  year?: number
}

export interface NFOResult {
  title: string
  year?: number
  imdbId?: string
  type: 'movie' | 'series' | 'unknown'
  season?: number
  episode?: number
  plot?: string
}

export interface DeduplicateOptions {
  keepBest?: boolean
  byTitle?: boolean
  byUrl?: boolean
  byFingerprint?: boolean
}

export interface DeduplicateBatchResult {
  unique: StreamRecord[]
  duplicates: StreamRecord[][]
  stats: {
    input: number
    output: number
    removed: number
    groups: number
  }
}

// ─── Quality scoring constants ────────────────────────────────────────────────

const CODEC_SCORE: Record<string, number> = {
  av1: 4, hevc: 3, 'h.265': 3, x265: 3,
  'h.264': 2, avc: 2, x264: 2,
  'h.262': 1, 'mpeg-2': 1, xvid: 1, divx: 1,
}

const RESOLUTION_SCORE: Record<string, number> = {
  '2160p': 10, '4k': 10, '1440p': 8,
  '1080p': 6, '720p': 4, '480p': 2, '360p': 1,
}

const SOURCE_SCORE: Record<string, number> = {
  bluray: 5, 'blu-ray': 5, bdrip: 5,
  'web-dl': 4, webrip: 3,
  hdtv: 2, dvdrip: 2,
  cam: 1, ts: 1, scr: 1,
}

const AUDIO_SCORE: Record<string, number> = {
  'truehd atmos': 5, 'dts:x': 5,
  'dts-hd ma': 4, dtshd: 4,
  dts: 3, 'dd5.1': 2, 'ac3': 2,
  aac: 1, mp3: 1,
}

// ─── Regex patterns ───────────────────────────────────────────────────────────

const SE_RE = /[Ss](\d{1,2})[Ee](\d{1,2})/
const SE_ALT_RE = /\b(\d{1,2})[xX](\d{1,2})\b/
const SE_VERBOSE_RE = /season\s*(\d{1,2})\s+episode\s*(\d{1,2})/i
const YEAR_RE = /\b(19[5-9]\d|20[0-3]\d)\b/
const HLS_BANDWIDTH_RE = /BANDWIDTH=(\d+)/i
const HLS_RESOLUTION_RE = /RESOLUTION=(\d+x\d+)/i
const RESOLUTION_LABEL_RE = /\b(4[Kk]|2160p|1440p|1080p|720p|480p|360p)\b/i

// ─── Service ──────────────────────────────────────────────────────────────────

export class ContentDeduplicator {

  // ── Title normalization ─────────────────────────────────────────────────────

  normalizeForDedup(title: string): NormalizedMeta {
    let s: number | undefined, e: number | undefined

    for (const re of [SE_RE, SE_ALT_RE, SE_VERBOSE_RE]) {
      const m = title.match(re)
      if (m) { s = parseInt(m[1], 10); e = parseInt(m[2], 10); break }
    }

    const year = title.match(YEAR_RE)?.[1] ? parseInt(title.match(YEAR_RE)![1], 10) : undefined

    // Strip season/episode, year, quality, codec, and common release tags
    let clean = title
      .replace(SE_RE, '').replace(SE_ALT_RE, '').replace(SE_VERBOSE_RE, '')
      .replace(YEAR_RE, '')
      .replace(/\b(4K|2160p|1440p|1080p|720p|480p|360p|BluRay|Blu-Ray|BDRip|BRRip|WEB-DL|WEBRip|HDTV|DVDRIP|CAM|TS|SCR|HEVC|H\.265|H\.264|AVC|AV1|x265|x264|xvid|divx|AAC|DTS|AC3|DD5\.1|TrueHD|REMUX)\b/gi, '')
      .replace(/-[A-Za-z0-9]+\s*$/, '')   // release group
      .replace(/[._\-[\](){}]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .trim()

    return { normalizedTitle: clean, season: s, episode: e, year }
  }

  // ── Quality scoring ─────────────────────────────────────────────────────────

  scoreStream(stream: StreamRecord): number {
    let score = 0

    // Resolution from explicit field or title
    const resLabel = stream.resolution?.toLowerCase() ?? stream.title.match(RESOLUTION_LABEL_RE)?.[0]?.toLowerCase() ?? ''
    const resKey = Object.keys(RESOLUTION_SCORE).find(k => resLabel.includes(k))
    score += (resKey ? RESOLUTION_SCORE[resKey] : 0) * 100

    // Codec
    const codecLower = (stream.codec ?? stream.title ?? '').toLowerCase()
    const codecKey = Object.keys(CODEC_SCORE).find(k => codecLower.includes(k))
    score += (codecKey ? CODEC_SCORE[codecKey] : 0) * 50

    // Source
    const sourceLower = (stream.source ?? stream.title ?? '').toLowerCase()
    const sourceKey = Object.keys(SOURCE_SCORE).find(k => sourceLower.includes(k))
    score += (sourceKey ? SOURCE_SCORE[sourceKey] : 0) * 20

    // Audio
    const audioLower = (stream.audioFormat ?? stream.title ?? '').toLowerCase()
    const audioKey = Object.keys(AUDIO_SCORE).find(k => audioLower.includes(k))
    score += (audioKey ? AUDIO_SCORE[audioKey] : 0) * 10

    // HLS bitrate (from manifest or stored field)
    const bitrate = stream.bitrate ?? 0
    score += Math.floor(bitrate / 1000 / 100) // bitrate_kbps / 100

    return score
  }

  getBestStream(streams: StreamRecord[]): StreamRecord {
    if (streams.length === 0) throw new Error('Empty streams array')
    return streams.reduce((best, s) => this.scoreStream(s) > this.scoreStream(best) ? s : best)
  }

  // ── HLS manifest bitrate extraction ────────────────────────────────────────

  parseHLSBitrate(manifestContent: string): number | undefined {
    const bwMatch = manifestContent.match(HLS_BANDWIDTH_RE)
    return bwMatch ? parseInt(bwMatch[1], 10) : undefined
  }

  parseHLSResolution(manifestContent: string): string | undefined {
    return manifestContent.match(HLS_RESOLUTION_RE)?.[1]
  }

  // ── NFO parser ─────────────────────────────────────────────────────────────

  parseNFO(content: string): NFOResult {
    const xml = (tag: string) => {
      const m = content.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, 'i'))
      return m?.[1]?.trim()
    }

    // Detect format: XML vs plain text
    const isXML = content.trim().startsWith('<')

    if (isXML) {
      const title = xml('title') ?? ''
      const year = xml('year') ? parseInt(xml('year')!, 10) : undefined
      const plot = xml('plot')
      const imdbMatch = content.match(/<uniqueid[^>]*type="imdb"[^>]*>([^<]+)<\/uniqueid>/i)
        ?? content.match(/<imdbid[^>]*>([^<]+)<\/imdbid>/i)
      const imdbId = imdbMatch?.[1]?.trim()

      const seasonStr = xml('season')
      const episodeStr = xml('episode')
      const season = seasonStr ? parseInt(seasonStr, 10) : undefined
      const episode = episodeStr ? parseInt(episodeStr, 10) : undefined

      // Determine type
      const isMovie = /<movie[\s>]/i.test(content)
      const isSeries = /<tvshow[\s>]/i.test(content) || /<episodedetails[\s>]/i.test(content)
      const type: NFOResult['type'] = isMovie ? 'movie' : isSeries ? 'series' : 'unknown'

      return { title, year, imdbId, type, season, episode, plot }
    }

    // Plain text: first non-empty line is title
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
    const title = lines[0] ?? ''
    const yearMatch = content.match(YEAR_RE)
    const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined
    return { title, year, type: 'unknown' }
  }

  // ── Stream fingerprinting ───────────────────────────────────────────────────

  fingerprint(stream: StreamRecord): string {
    const meta = this.normalizeForDedup(stream.title)
    const resLabel = stream.resolution?.toLowerCase() ?? stream.title.match(RESOLUTION_LABEL_RE)?.[0]?.toLowerCase() ?? ''
    const raw = [meta.normalizedTitle, meta.season ?? '', meta.episode ?? '', resLabel].join('|')
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16)
  }

  areDuplicates(stream1: StreamRecord, stream2: StreamRecord): boolean {
    // Fast URL check
    if (stream1.url === stream2.url) return true
    // Fingerprint check
    if (this.fingerprint(stream1) === this.fingerprint(stream2)) return true

    // Normalized title + season/episode check
    const m1 = this.normalizeForDedup(stream1.title)
    const m2 = this.normalizeForDedup(stream2.title)
    if (m1.normalizedTitle !== m2.normalizedTitle) return false
    if (m1.season !== m2.season || m1.episode !== m2.episode) return false
    return true
  }

  // ── Deduplication ──────────────────────────────────────────────────────────

  deduplicateStreams(streams: StreamRecord[]): StreamRecord[] {
    const groups = new Map<string, StreamRecord[]>()

    for (const stream of streams) {
      const fp = this.fingerprint(stream)
      const group = groups.get(fp) ?? []
      group.push(stream)
      groups.set(fp, group)
    }

    return Array.from(groups.values()).map(g => this.getBestStream(g))
  }

  deduplicateBatch(
    streams: StreamRecord[],
    options: DeduplicateOptions = {}
  ): DeduplicateBatchResult {
    const {
      keepBest = true,
      byTitle = true,
      byUrl = true,
      byFingerprint = true,
    } = options

    const groups = new Map<string, StreamRecord[]>()

    for (const stream of streams) {
      let key: string

      if (byFingerprint) {
        key = this.fingerprint(stream)
      } else if (byTitle) {
        const m = this.normalizeForDedup(stream.title)
        key = `${m.normalizedTitle}:${m.season ?? ''}:${m.episode ?? ''}`
      } else if (byUrl) {
        key = stream.url
      } else {
        key = stream.url // fallback
      }

      const group = groups.get(key) ?? []
      group.push(stream)
      groups.set(key, group)
    }

    const unique: StreamRecord[] = []
    const duplicates: StreamRecord[][] = []

    for (const group of groups.values()) {
      if (group.length === 1) {
        unique.push(group[0])
      } else {
        const best = keepBest ? this.getBestStream(group) : group[0]
        unique.push(best)
        duplicates.push(group.filter(s => s !== best))
      }
    }

    return {
      unique,
      duplicates,
      stats: {
        input: streams.length,
        output: unique.length,
        removed: streams.length - unique.length,
        groups: groups.size,
      },
    }
  }
}

export const contentDedup = new ContentDeduplicator()
