/**
 * MDBListService
 *
 * MDBList.com API wrapper — free tier (1,000 req/day).
 * Register at https://mdblist.com/api/
 *
 * Returns: aggregate ratings from IMDb, TMDb, Trakt, Letterboxd, Metacritic,
 * Rotten Tomatoes, Tomato Audience, and more — in a single API call.
 * Also returns: score, type, year, genres, cast, poster, backdrop.
 *
 * Env vars:
 *   MDBLIST_API_KEY — free key from mdblist.com
 */

import axios from 'axios'

const BASE = 'https://mdblist.com/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MDBListRating {
  source: string   // "imdb" | "tmdb" | "trakt" | "letterboxd" | "metacritic" | "tomatoes" | ...
  score:  number   // 0-100 (normalised)
  votes?: number
  popular?: number
}

export interface MDBListMeta {
  imdbId?:    string
  tmdbId?:    number
  traktId?:   number
  type:       'movie' | 'show' | string
  title:      string
  year?:      number
  released?:  string
  description?: string
  runtime?:   number    // minutes
  genres?:    string[]
  cast?:      string[]
  language?:  string
  country?:   string
  certification?: string  // "PG-13"
  poster?:    string
  backdrop?:  string
  score?:     number      // MDBList aggregated score 0-100
  ratings:    MDBListRating[]
  /** Convenience: ratings keyed by source name for easy lookup */
  ratingMap:  Record<string, number>
  source: 'mdblist'
}

// ── Service ───────────────────────────────────────────────────────────────────

export class MDBListService {
  private apiKey: string | undefined

  constructor() {
    this.apiKey = process.env.MDBLIST_API_KEY
  }

  get isAvailable(): boolean { return Boolean(this.apiKey) }

  /** Fetch by IMDb ID (most precise, no title ambiguity). */
  async getByImdbId(imdbId: string, timeoutMs = 6000): Promise<MDBListMeta | undefined> {
    return this._fetch({ i: imdbId }, timeoutMs)
  }

  /** Fetch by title (and optional year/type). */
  async getByTitle(title: string, year?: number, type?: 'movie' | 'show', timeoutMs = 6000): Promise<MDBListMeta | undefined> {
    const params: Record<string, string | number> = { s: title }
    if (year) params.y    = year
    if (type) params.m    = type
    // MDBList /api/?s=title returns list — pick the first match
    if (!this.apiKey) return undefined
    try {
      const res = await axios.get(`${BASE}/`, {
        params: { ...params, apikey: this.apiKey },
        timeout: timeoutMs,
      })
      const results: any[] = (res.data as any).search ?? []
      if (!results.length) return undefined
      // Prefer exact year match if given
      const match = year
        ? (results.find((r: any) => r.year === year) ?? results[0])
        : results[0]
      // Fetch full details by imdb id if available
      if (match.imdbid) return this.getByImdbId(match.imdbid, timeoutMs)
      return this._mapResult(match)
    } catch {
      return undefined
    }
  }

  /** Fetch by TMDb ID. */
  async getByTmdbId(tmdbId: number, mediaType: 'movie' | 'show' = 'movie', timeoutMs = 6000): Promise<MDBListMeta | undefined> {
    return this._fetch({ tm: tmdbId, m: mediaType }, timeoutMs)
  }

  private async _fetch(params: Record<string, string | number>, timeoutMs: number): Promise<MDBListMeta | undefined> {
    if (!this.apiKey) return undefined
    try {
      const res = await axios.get(`${BASE}/`, {
        params: { ...params, apikey: this.apiKey },
        timeout: timeoutMs,
      })
      const d = res.data as any
      if (!d || d.error) return undefined
      return this._mapResult(d)
    } catch {
      return undefined
    }
  }

  private _mapResult(d: any): MDBListMeta {
    const rawRatings: any[] = d.ratings ?? []
    const ratings: MDBListRating[] = rawRatings.map(r => ({
      source:  r.source ?? '',
      score:   r.score  ?? 0,
      votes:   r.votes  ?? undefined,
      popular: r.popular ?? undefined,
    }))
    const ratingMap: Record<string, number> = {}
    for (const r of ratings) {
      ratingMap[r.source.toLowerCase()] = r.score
    }

    return {
      imdbId:   d.imdbid  ?? undefined,
      tmdbId:   d.tmdbid  ?? undefined,
      traktId:  d.traktid ?? undefined,
      type:     d.type    ?? 'movie',
      title:    d.title   ?? '',
      year:     d.year    ?? undefined,
      released: d.released ?? undefined,
      description: d.description ?? undefined,
      runtime:  d.runtime ?? undefined,
      genres:   Array.isArray(d.genres) ? d.genres.map((g: any) => g.genre ?? g) : [],
      cast:     Array.isArray(d.cast)   ? d.cast.map((c: any) => c.actor ?? c)   : [],
      language: d.language      ?? undefined,
      country:  d.country       ?? undefined,
      certification: d.certification ?? undefined,
      poster:   d.poster        ?? undefined,
      backdrop: d.backdrop       ?? undefined,
      score:    d.score         ?? undefined,
      ratings,
      ratingMap,
      source: 'mdblist',
    }
  }
}

export const mdbList = new MDBListService()
