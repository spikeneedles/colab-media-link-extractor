/**
 * OmdbService
 *
 * OMDb API wrapper — free tier (1,000 req/day).
 * Register at https://www.omdbapi.com/apikey.aspx
 *
 * Returns: poster, plot, multi-source ratings (IMDb/RT/Metacritic),
 * genre, director, actors, language, country, awards, box office, runtime.
 *
 * Env vars:
 *   OMDB_API_KEY — free key from omdbapi.com
 */

import axios from 'axios'

const BASE = 'https://www.omdbapi.com'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OmdbRating {
  source: string   // "Internet Movie Database" | "Rotten Tomatoes" | "Metacritic"
  value:  string   // "7.8/10" | "94%" | "82/100"
}

export interface OmdbMeta {
  imdbId:    string
  type:      'movie' | 'series' | 'episode' | string
  title:     string
  year?:     number
  rated?:    string     // "PG-13", "TV-MA", etc.
  released?: string     // "15 Jan 2021"
  runtime?:  number     // minutes
  genre?:    string[]
  director?: string
  writer?:   string
  actors?:   string[]
  plot?:     string
  language?: string
  country?:  string
  awards?:   string
  poster?:   string     // Full URL from OMDb
  ratings:   OmdbRating[]
  imdbRating?: number
  imdbVotes?:  number
  metascore?:  number
  boxOffice?:  string
  totalSeasons?: number
  source: 'omdb'
}

// ── Service ───────────────────────────────────────────────────────────────────

export class OmdbService {
  private apiKey: string | undefined

  constructor() {
    this.apiKey = process.env.OMDB_API_KEY
  }

  get isAvailable(): boolean { return Boolean(this.apiKey) }

  /** Look up by IMDb ID (most precise). */
  async getByImdbId(imdbId: string, timeoutMs = 6000): Promise<OmdbMeta | undefined> {
    if (!this.apiKey) return undefined
    return this._fetch({ i: imdbId, plot: 'full' }, timeoutMs)
  }

  /** Look up by title + optional year. Falls back gracefully when no key. */
  async getByTitle(title: string, year?: number, type?: 'movie' | 'series', timeoutMs = 6000): Promise<OmdbMeta | undefined> {
    if (!this.apiKey) return undefined
    const params: Record<string, string | number> = { t: title, plot: 'full' }
    if (year)  params.y    = year
    if (type)  params.type = type
    return this._fetch(params, timeoutMs)
  }

  /** Full-text search (returns first result). */
  async search(query: string, year?: number, type?: 'movie' | 'series', timeoutMs = 6000): Promise<OmdbMeta | undefined> {
    if (!this.apiKey) return undefined
    const params: Record<string, string | number> = { s: query }
    if (year)  params.y    = year
    if (type)  params.type = type
    try {
      const res = await axios.get(BASE, { params: { ...params, apikey: this.apiKey }, timeout: timeoutMs })
      const d = res.data as any
      if (d.Response === 'False' || !d.Search?.length) return undefined
      // Fetch full details for the first hit
      return this.getByImdbId(d.Search[0].imdbID, timeoutMs)
    } catch {
      return undefined
    }
  }

  private async _fetch(params: Record<string, string | number>, timeoutMs: number): Promise<OmdbMeta | undefined> {
    try {
      const res = await axios.get(BASE, {
        params: { ...params, apikey: this.apiKey },
        timeout: timeoutMs,
      })
      const d = res.data as any
      if (d.Response === 'False' || !d.imdbID) return undefined

      const ratings: OmdbRating[] = (d.Ratings ?? []).map((r: any) => ({
        source: r.Source,
        value:  r.Value,
      }))

      const imdbRatingRaw = parseFloat(d.imdbRating)
      const metascoreRaw  = parseInt(d.Metascore)
      const runtimeRaw    = d.Runtime?.replace(/\D/g, '')
      const votesRaw      = d.imdbVotes?.replace(/,/g, '')

      return {
        imdbId:       d.imdbID,
        type:         d.Type ?? 'movie',
        title:        d.Title ?? '',
        year:         parseInt(d.Year) || undefined,
        rated:        d.Rated !== 'N/A' ? d.Rated : undefined,
        released:     d.Released !== 'N/A' ? d.Released : undefined,
        runtime:      runtimeRaw ? parseInt(runtimeRaw) : undefined,
        genre:        d.Genre   !== 'N/A' ? d.Genre.split(', ')   : [],
        director:     d.Director !== 'N/A' ? d.Director : undefined,
        writer:       d.Writer   !== 'N/A' ? d.Writer   : undefined,
        actors:       d.Actors   !== 'N/A' ? d.Actors.split(', ') : [],
        plot:         d.Plot     !== 'N/A' ? d.Plot     : undefined,
        language:     d.Language !== 'N/A' ? d.Language : undefined,
        country:      d.Country  !== 'N/A' ? d.Country  : undefined,
        awards:       d.Awards   !== 'N/A' ? d.Awards   : undefined,
        poster:       d.Poster   !== 'N/A' ? d.Poster   : undefined,
        ratings,
        imdbRating:   !isNaN(imdbRatingRaw) ? imdbRatingRaw : undefined,
        imdbVotes:    votesRaw ? parseInt(votesRaw) : undefined,
        metascore:    !isNaN(metascoreRaw) ? metascoreRaw : undefined,
        boxOffice:    d.BoxOffice !== 'N/A' ? d.BoxOffice : undefined,
        totalSeasons: d.totalSeasons ? parseInt(d.totalSeasons) : undefined,
        source:       'omdb',
      }
    } catch {
      return undefined
    }
  }
}

export const omdbService = new OmdbService()
