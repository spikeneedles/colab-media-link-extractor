/**
 * JikanService
 *
 * Wrapper for Jikan v4 — the unofficial MyAnimeList REST API.
 * Completely FREE, no API key required.
 * Rate limits: 3 requests/second, 60 requests/minute.
 *
 * Returns: full anime metadata, HD images (poster + cover + WebP variants),
 * genres, studios, episodes count, airing status, MAL score, synopsis.
 *
 * Docs: https://docs.api.jikan.moe/
 */

import axios from 'axios'

const BASE = 'https://api.jikan.moe/v4'
const DEFAULT_TIMEOUT = 8000

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JikanImage {
  image_url?:       string   // Standard JPG
  small_image_url?: string
  large_image_url?: string   // Best quality JPG
  webp?: {
    image_url?:       string
    small_image_url?: string
    large_image_url?: string
  }
}

export interface JikanGenre {
  mal_id: number
  name:   string
}

export interface JikanStudio {
  mal_id: number
  name:   string
}

export interface JikanMeta {
  malId:       number
  type:        'TV' | 'Movie' | 'OVA' | 'Special' | 'ONA' | 'Music' | string
  title:       string
  titleEnglish?: string
  titleJapanese?: string
  synonyms:    string[]
  episodes?:   number
  status:      string        // "Finished Airing" | "Currently Airing" | "Not yet aired"
  airing:      boolean
  airedFrom?:  string
  airedTo?:    string
  duration?:   string        // "24 min per ep"
  rating?:     string        // "PG-13 - Teens 13 or older"
  score?:      number        // MAL score (0-10)
  scoredBy?:   number
  rank?:       number
  popularity?: number
  synopsis?:   string
  genres:      string[]
  studios:     string[]
  imageUrl?:   string        // Best quality poster
  coverUrl?:   string        // Landscape cover (if available)
  trailer?:    string        // YouTube embed URL
  source: 'jikan'
}

// ── Rate-limit queue ──────────────────────────────────────────────────────────
// Simple 3 req/s throttle with a queue

class RateLimiter {
  private queue: Array<() => void> = []
  private running = 0
  private readonly maxPerSec: number

  constructor(maxPerSec = 3) {
    this.maxPerSec = maxPerSec
  }

  async acquire(): Promise<void> {
    return new Promise(resolve => {
      this.queue.push(resolve)
      this._drain()
    })
  }

  private _drain() {
    if (this.running >= this.maxPerSec || this.queue.length === 0) return
    const next = this.queue.shift()!
    this.running++
    next()
    setTimeout(() => {
      this.running--
      this._drain()
    }, 1000 / this.maxPerSec)
  }
}

const limiter = new RateLimiter(3)

async function jikanGet(path: string, params: Record<string, any> = {}, timeoutMs = DEFAULT_TIMEOUT) {
  await limiter.acquire()
  return axios.get(`${BASE}${path}`, { params, timeout: timeoutMs })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bestImage(img: JikanImage | undefined): string | undefined {
  if (!img) return undefined
  return img.webp?.large_image_url ?? img.large_image_url ?? img.image_url
}

function mapAnime(a: any): JikanMeta {
  return {
    malId:          a.mal_id,
    type:           a.type  ?? 'TV',
    title:          a.title ?? '',
    titleEnglish:   a.title_english ?? undefined,
    titleJapanese:  a.title_japanese ?? undefined,
    synonyms:       a.title_synonyms ?? [],
    episodes:       a.episodes ?? undefined,
    status:         a.status ?? '',
    airing:         a.airing ?? false,
    airedFrom:      a.aired?.from ?? undefined,
    airedTo:        a.aired?.to   ?? undefined,
    duration:       a.duration ?? undefined,
    rating:         a.rating  ?? undefined,
    score:          a.score   ?? undefined,
    scoredBy:       a.scored_by ?? undefined,
    rank:           a.rank    ?? undefined,
    popularity:     a.popularity ?? undefined,
    synopsis:       a.synopsis ?? undefined,
    genres:         (a.genres  ?? []).map((g: JikanGenre)  => g.name),
    studios:        (a.studios ?? []).map((s: JikanStudio) => s.name),
    imageUrl:       bestImage(a.images?.jpg) ?? bestImage(a.images?.webp),
    trailer:        a.trailer?.embed_url ?? undefined,
    source:         'jikan',
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

export class JikanService {
  /**
   * Search anime by title. Returns the best match or undefined.
   */
  async search(title: string, timeoutMs = DEFAULT_TIMEOUT): Promise<JikanMeta | undefined> {
    try {
      const res = await jikanGet('/anime', { q: title, limit: 5, sfw: false }, timeoutMs)
      const data: any[] = (res.data as any).data ?? []
      if (!data.length) return undefined
      // Pick best match: exact title match first, then highest score
      const exactMatch = data.find(a =>
        (a.title ?? '').toLowerCase() === title.toLowerCase() ||
        (a.title_english ?? '').toLowerCase() === title.toLowerCase()
      )
      const best = exactMatch ?? data.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
      return mapAnime(best)
    } catch {
      return undefined
    }
  }

  /**
   * Get full anime details by MAL ID.
   */
  async getById(malId: number, timeoutMs = DEFAULT_TIMEOUT): Promise<JikanMeta | undefined> {
    try {
      const res = await jikanGet(`/anime/${malId}`, {}, timeoutMs)
      const data = (res.data as any).data
      if (!data) return undefined
      return mapAnime(data)
    } catch {
      return undefined
    }
  }

  /**
   * Get additional pictures for a given MAL ID.
   * Useful for fetching alternate poster/art images.
   */
  async getPictures(malId: number, timeoutMs = DEFAULT_TIMEOUT): Promise<string[]> {
    try {
      const res = await jikanGet(`/anime/${malId}/pictures`, {}, timeoutMs)
      const data: any[] = (res.data as any).data ?? []
      return data.flatMap(p => [
        p.webp?.large_image_url,
        p.jpg?.large_image_url,
      ]).filter(Boolean) as string[]
    } catch {
      return []
    }
  }

  /**
   * Search manga by title.
   */
  async searchManga(title: string, timeoutMs = DEFAULT_TIMEOUT): Promise<JikanMeta | undefined> {
    try {
      const res = await jikanGet('/manga', { q: title, limit: 3 }, timeoutMs)
      const data: any[] = (res.data as any).data ?? []
      if (!data.length) return undefined
      const best = data[0]
      return {
        malId:         best.mal_id,
        type:          best.type ?? 'Manga',
        title:         best.title ?? '',
        titleEnglish:  best.title_english ?? undefined,
        titleJapanese: best.title_japanese ?? undefined,
        synonyms:      best.title_synonyms ?? [],
        episodes:      best.chapters ?? undefined,
        status:        best.status ?? '',
        airing:        best.publishing ?? false,
        synopsis:      best.synopsis ?? undefined,
        genres:        (best.genres ?? []).map((g: JikanGenre) => g.name),
        studios:       [],
        imageUrl:      bestImage(best.images?.jpg),
        source:        'jikan',
      }
    } catch {
      return undefined
    }
  }
}

export const jikanService = new JikanService()
