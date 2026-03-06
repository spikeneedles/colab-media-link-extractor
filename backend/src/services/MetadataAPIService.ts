/**
 * MetadataAPIService.ts
 *
 * Aggregates show/movie title metadata from three sources:
 *  - TVDB v4  (authenticated, supports key rotation on 429)
 *  - TVMaze   (no auth, full show index + AKAs)
 *  - AniDB    (compressed XML titles dump, cached 24 h)
 *
 * Primary use-case: generate a comprehensive list of known show names
 * ("seed titles") for downstream crawler query generation.
 *
 * Export:
 *  - `MetadataAPIService` class
 *  - `metadataAPIService` singleton (env-driven)
 */

import axios, { AxiosInstance } from 'axios'
import * as zlib from 'zlib'
import { promisify } from 'util'
import * as xml2js from 'xml2js'
import dotenv from 'dotenv'

dotenv.config()

const gunzip = promisify(zlib.gunzip)

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** A normalised show/movie record from any source */
export interface MetadataTitle {
  /** Canonical title */
  name: string
  /** Alternate/alias names (localised titles, AKAs) */
  aliases: string[]
  /** Media type when known */
  type?: 'series' | 'movie' | 'anime' | 'other'
  /** First air / release year */
  year?: number
  /** TVDB numeric ID */
  tvdbId?: number
  /** TVMaze numeric ID */
  tvmazeId?: number
  /** AniDB numeric ID */
  anidbId?: number
  /** IMDb ID */
  imdbId?: string
  /** Source(s) this record was built from */
  sources: Array<'tvdb' | 'tvmaze' | 'anidb'>
}

/** Flat seed list emitted for downstream consumers */
export interface MetadataSeedList {
  titles: string[]
  generated: number
}

// ---- TVDB raw shapes -------------------------------------------------------

interface TvdbLoginResponse {
  data: { token: string }
}

interface TvdbSearchResult {
  objectID?: string
  name: string
  aliases?: string[]
  status?: string
  year?: string
  type?: string
  tvdb_id?: string
}

interface TvdbSearchResponse {
  data: TvdbSearchResult[]
}

interface TvdbSeriesExtendedResponse {
  data: {
    id: number
    name: string
    aliases?: Array<{ name: string; language: string }>
    [key: string]: unknown
  }
}

// ---- TVMaze raw shapes -----------------------------------------------------

interface TvMazeShow {
  id: number
  name: string
  type?: string
  premiered?: string
  externals?: {
    imdb?: string
    thetvdb?: number
    tvrage?: number
  }
}

interface TvMazeSearchResult {
  score: number
  show: TvMazeShow
}

interface TvMazeAka {
  name: string
  country?: { code: string; name: string; timezone: string } | null
}

// ---- AniDB raw shapes (xml2js output) -------------------------------------

interface AnidbXmlTitle {
  _: string
  $: { 'xml:lang': string; type: string }
}

interface AnidbXmlAnime {
  $: { aid: string }
  title: AnidbXmlTitle[]
}

interface AnidbXmlRoot {
  animetitles: { anime: AnidbXmlAnime[] }
}

// ---------------------------------------------------------------------------
// Internal TTL cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class TTLCache {
  private store = new Map<string, CacheEntry<unknown>>()

  set<T>(key: string, data: T, ttlMinutes: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMinutes * 60_000 })
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.data as T
  }

  clear(): void {
    this.store.clear()
  }
}

// ---------------------------------------------------------------------------
// MetadataAPIService
// ---------------------------------------------------------------------------

export class MetadataAPIService {
  // ---- TVDB state
  private readonly tvdbKeys: string[]
  private tvdbKeyIndex = 0
  private tvdbToken: string | null = null
  private tvdbTokenExpiry = 0
  private readonly tvdb: AxiosInstance

  // ---- TVMaze state
  private readonly tvmaze: AxiosInstance

  // ---- AniDB state
  private readonly anidbTitlesUrl: string
  private cachedAnidbTitles: MetadataTitle[] | null = null
  private anidbCacheExpiry = 0

  // ---- Shared cache
  private readonly cache = new TTLCache()

  /**
   * @param tvdbApiKeys - One or more TVDB API keys (rotated on 429)
   */
  constructor(tvdbApiKeys: string[] = []) {
    this.tvdbKeys = tvdbApiKeys.filter(Boolean)

    this.tvdb = axios.create({
      baseURL: 'https://api4.thetvdb.com/v4',
      timeout: 15_000,
    })

    this.tvmaze = axios.create({
      baseURL: 'https://api.tvmaze.com',
      timeout: 15_000,
    })

    this.anidbTitlesUrl = 'https://anidb.net/api/anime-titles.xml.gz'
  }

  // =========================================================================
  // TVDB — private helpers
  // =========================================================================

  /** Return the current TVDB API key, rotating when needed */
  private get currentTvdbKey(): string {
    return this.tvdbKeys[this.tvdbKeyIndex % this.tvdbKeys.length] ?? ''
  }

  /** Rotate to the next available TVDB key (called on 429) */
  private rotateTvdbKey(): void {
    if (this.tvdbKeys.length > 1) {
      this.tvdbKeyIndex = (this.tvdbKeyIndex + 1) % this.tvdbKeys.length
      // Invalidate token so next request re-authenticates with the new key
      this.tvdbToken = null
      this.tvdbTokenExpiry = 0
    }
  }

  /**
   * Authenticate with TVDB and cache the token.
   * Re-auths automatically when the token is within 60 seconds of expiry.
   */
  private async ensureTvdbAuth(): Promise<void> {
    if (!this.currentTvdbKey) return
    // Token valid for ~30 days; refresh when within 60 s of expiry or missing
    if (this.tvdbToken && Date.now() < this.tvdbTokenExpiry - 60_000) return

    try {
      const { data } = await this.tvdb.post<TvdbLoginResponse>('/login', {
        apikey: this.currentTvdbKey,
      })
      this.tvdbToken = data.data.token
      // TVDB tokens expire after 30 days; store expiry as 29 days from now
      this.tvdbTokenExpiry = Date.now() + 29 * 24 * 60 * 60_000
      this.tvdb.defaults.headers.common['Authorization'] = `Bearer ${this.tvdbToken}`
    } catch (err) {
      console.error('[MetadataAPIService] TVDB auth failed:', err)
      throw err
    }
  }

  /**
   * Wrapper for TVDB GET requests with automatic 429 key rotation and retry.
   */
  private async tvdbGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    await this.ensureTvdbAuth()

    try {
      const { data } = await this.tvdb.get<T>(path, { params })
      return data
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 429 && this.tvdbKeys.length > 1) {
        this.rotateTvdbKey()
        await this.ensureTvdbAuth()
        const { data } = await this.tvdb.get<T>(path, { params })
        return data
      }
      throw err
    }
  }

  // =========================================================================
  // TVDB — public methods
  // =========================================================================

  /**
   * Search TVDB for a series/movie by name.
   *
   * @param query - Title search string
   * @param type  - Filter by content type (default: 'series')
   */
  async searchTvdb(query: string, type = 'series'): Promise<MetadataTitle[]> {
    if (!this.currentTvdbKey) return []

    const cacheKey = `tvdb:search:${type}:${query}`
    const cached = this.cache.get<MetadataTitle[]>(cacheKey)
    if (cached) return cached

    try {
      const resp = await this.tvdbGet<TvdbSearchResponse>('/search', { query, type })
      const results: MetadataTitle[] = (resp.data ?? []).map((item) => ({
        name: item.name,
        aliases: item.aliases ?? [],
        type: type === 'series' ? 'series' : 'movie',
        year: item.year ? parseInt(item.year, 10) : undefined,
        tvdbId: item.tvdb_id ? parseInt(item.tvdb_id, 10) : undefined,
        sources: ['tvdb'],
      }))

      this.cache.set(cacheKey, results, 30)
      return results
    } catch (err) {
      console.error('[MetadataAPIService] TVDB search error:', err)
      return []
    }
  }

  /**
   * Fetch extended series info (including all aliases) by TVDB series ID.
   *
   * @param seriesId - TVDB numeric series ID
   */
  async getTvdbSeriesAliases(seriesId: number): Promise<string[]> {
    if (!this.currentTvdbKey) return []

    const cacheKey = `tvdb:aliases:${seriesId}`
    const cached = this.cache.get<string[]>(cacheKey)
    if (cached) return cached

    try {
      const resp = await this.tvdbGet<TvdbSeriesExtendedResponse>(`/series/${seriesId}/extended`)
      const aliases = (resp.data?.aliases ?? []).map((a) => a.name).filter(Boolean)
      this.cache.set(cacheKey, aliases, 60)
      return aliases
    } catch (err) {
      console.error(`[MetadataAPIService] TVDB aliases for ${seriesId} failed:`, err)
      return []
    }
  }

  // =========================================================================
  // TVMaze — private helpers
  // =========================================================================

  /**
   * Fetch AKAs (alternate known-as names) for a single TVMaze show ID.
   */
  private async getTvMazeAkas(showId: number): Promise<string[]> {
    const cacheKey = `tvmaze:akas:${showId}`
    const cached = this.cache.get<string[]>(cacheKey)
    if (cached) return cached

    try {
      const { data } = await this.tvmaze.get<TvMazeAka[]>(`/shows/${showId}/akas`)
      const names = data.map((a) => a.name).filter(Boolean)
      this.cache.set(cacheKey, names, 120)
      return names
    } catch {
      return []
    }
  }

  // =========================================================================
  // TVMaze — public methods
  // =========================================================================

  /**
   * Fetch a single page of the TVMaze show index (250 shows per page).
   * TVMaze paginates from page 0; returns an empty array when exhausted.
   *
   * @param page - Zero-based page number
   */
  async getAllTvShows(page = 0): Promise<MetadataTitle[]> {
    const cacheKey = `tvmaze:index:${page}`
    const cached = this.cache.get<MetadataTitle[]>(cacheKey)
    if (cached) return cached

    try {
      const { data } = await this.tvmaze.get<TvMazeShow[]>('/shows', { params: { page } })
      const results: MetadataTitle[] = data.map((show) => ({
        name: show.name,
        aliases: [],
        type: 'series',
        year: show.premiered ? parseInt(show.premiered.slice(0, 4), 10) : undefined,
        tvmazeId: show.id,
        imdbId: show.externals?.imdb ?? undefined,
        tvdbId: show.externals?.thetvdb ?? undefined,
        sources: ['tvmaze'],
      }))

      // Cache for 2 hours — the index doesn't change very often
      this.cache.set(cacheKey, results, 120)
      return results
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) return []
      console.error(`[MetadataAPIService] TVMaze page ${page} failed:`, err)
      return []
    }
  }

  /**
   * Search TVMaze for shows matching a query string.
   * Includes AKA enrichment for each result.
   *
   * @param query - Title search string
   */
  async searchTvMaze(query: string): Promise<MetadataTitle[]> {
    const cacheKey = `tvmaze:search:${query}`
    const cached = this.cache.get<MetadataTitle[]>(cacheKey)
    if (cached) return cached

    try {
      const { data } = await this.tvmaze.get<TvMazeSearchResult[]>('/search/shows', {
        params: { q: query },
      })

      const results = await Promise.all(
        data.map(async ({ show }) => {
          const akas = await this.getTvMazeAkas(show.id)
          return {
            name: show.name,
            aliases: akas,
            type: 'series' as const,
            year: show.premiered ? parseInt(show.premiered.slice(0, 4), 10) : undefined,
            tvmazeId: show.id,
            imdbId: show.externals?.imdb ?? undefined,
            tvdbId: show.externals?.thetvdb ?? undefined,
            sources: ['tvmaze' as const],
          } satisfies MetadataTitle
        }),
      )

      this.cache.set(cacheKey, results, 20)
      return results
    } catch (err) {
      console.error('[MetadataAPIService] TVMaze search error:', err)
      return []
    }
  }

  // =========================================================================
  // AniDB — private helpers
  // =========================================================================

  /**
   * Download, decompress, and parse the AniDB anime-titles.xml.gz file.
   * Result is cached in-memory for 24 hours.
   */
  private async loadAnidbTitles(): Promise<MetadataTitle[]> {
    if (this.cachedAnidbTitles && Date.now() < this.anidbCacheExpiry) {
      return this.cachedAnidbTitles
    }

    try {
      const response = await axios.get<ArrayBuffer>(this.anidbTitlesUrl, {
        responseType: 'arraybuffer',
        timeout: 30_000,
        headers: { 'User-Agent': 'MediaLinkExtractor/1.0' },
      })

      const decompressed = await gunzip(Buffer.from(response.data))
      const xmlString = decompressed.toString('utf-8')

      const parser = new xml2js.Parser({ explicitArray: true, mergeAttrs: false })
      const parsed = await parser.parseStringPromise(xmlString) as AnidbXmlRoot

      const titles: MetadataTitle[] = (parsed.animetitles?.anime ?? []).map((anime) => {
        const aid = parseInt(anime.$?.aid ?? '0', 10)
        const allTitles = anime.title ?? []

        // Find official title (prefer English, fall back to first official)
        const englishTitles = allTitles.filter(
          (t) => t.$?.['xml:lang'] === 'en' && t.$?.type === 'official',
        )
        const officialTitles = allTitles.filter((t) => t.$?.type === 'official')
        const primary =
          englishTitles[0]?._ ??
          officialTitles[0]?._ ??
          allTitles[0]?._ ??
          `AniDB:${aid}`

        const aliases = allTitles
          .map((t) => t._)
          .filter((t): t is string => Boolean(t) && t !== primary)

        return {
          name: primary,
          aliases,
          type: 'anime',
          anidbId: aid,
          sources: ['anidb'],
        } satisfies MetadataTitle
      })

      this.cachedAnidbTitles = titles
      this.anidbCacheExpiry = Date.now() + 24 * 60 * 60_000 // 24 hours
      return titles
    } catch (err) {
      console.error('[MetadataAPIService] AniDB titles load failed:', err)
      return []
    }
  }

  // =========================================================================
  // Cross-source methods
  // =========================================================================

  /**
   * Search all three sources (TVDB, TVMaze, AniDB) in parallel for a query.
   * Results are merged and deduplicated by canonical name.
   *
   * @param query - Title search string
   */
  async searchAllSources(query: string): Promise<MetadataTitle[]> {
    const [tvdbResults, tvmazeResults, anidbTitles] = await Promise.all([
      this.searchTvdb(query),
      this.searchTvMaze(query),
      this.loadAnidbTitles(),
    ])

    const lq = query.toLowerCase()
    const matchingAnidb = anidbTitles.filter(
      (t) =>
        t.name.toLowerCase().includes(lq) ||
        t.aliases.some((a) => a.toLowerCase().includes(lq)),
    )

    // Deduplicate by normalised name
    const seen = new Map<string, MetadataTitle>()

    const addAll = (items: MetadataTitle[]) => {
      for (const item of items) {
        const key = item.name.toLowerCase().trim()
        const existing = seen.get(key)
        if (existing) {
          // Merge sources and aliases
          existing.sources = Array.from(new Set([...existing.sources, ...item.sources])) as MetadataTitle['sources']
          existing.aliases = Array.from(new Set([...existing.aliases, ...item.aliases]))
          if (!existing.tvdbId && item.tvdbId) existing.tvdbId = item.tvdbId
          if (!existing.tvmazeId && item.tvmazeId) existing.tvmazeId = item.tvmazeId
          if (!existing.anidbId && item.anidbId) existing.anidbId = item.anidbId
          if (!existing.imdbId && item.imdbId) existing.imdbId = item.imdbId
        } else {
          seen.set(key, { ...item })
        }
      }
    }

    addAll(tvdbResults)
    addAll(tvmazeResults)
    addAll(matchingAnidb)

    return Array.from(seen.values())
  }

  /**
   * Return all known aliases for a title by searching across all sources.
   *
   * @param title - Canonical title to look up
   */
  async getAlternateNames(title: string): Promise<string[]> {
    const results = await this.searchAllSources(title)
    const allNames = new Set<string>()
    for (const r of results) {
      for (const alias of r.aliases) {
        allNames.add(alias)
      }
    }
    // Remove the query title itself
    allNames.delete(title)
    return Array.from(allNames)
  }

  /**
   * Generate a flat, deduplicated list of all known show names by:
   *  1. Iterating through the full TVMaze index (all pages)
   *  2. Loading all AniDB titles
   *
   * TVDB is not bulk-iterated (no full-dump endpoint); it contributes only
   * via `searchAllSources` calls.
   *
   * @param limit - Optional cap on the number of titles returned (0 = no limit)
   */
  async generateSeedTitles(limit = 0): Promise<MetadataSeedList> {
    // Load AniDB full dump in parallel with TVMaze first page
    const [anidbTitles, firstPage] = await Promise.all([
      this.loadAnidbTitles(),
      this.getAllTvShows(0),
    ])

    const allTvMaze: MetadataTitle[] = [...firstPage]

    // Paginate TVMaze until we get an empty page or hit the limit
    if (limit === 0 || allTvMaze.length < limit) {
      let page = 1
      while (true) {
        const pageData = await this.getAllTvShows(page)
        if (pageData.length === 0) break
        allTvMaze.push(...pageData)
        if (limit > 0 && allTvMaze.length >= limit * 2) break // over-fetch then trim
        page++
        // Throttle to avoid hammering TVMaze
        await new Promise((r) => setTimeout(r, 200))
      }
    }

    const titleSet = new Set<string>()

    const addTitles = (items: MetadataTitle[]) => {
      for (const item of items) {
        if (item.name) titleSet.add(item.name)
        for (const alias of item.aliases) {
          if (alias) titleSet.add(alias)
        }
      }
    }

    addTitles(allTvMaze)
    addTitles(anidbTitles)

    let titles = Array.from(titleSet)
    if (limit > 0) titles = titles.slice(0, limit)

    return { titles, generated: Date.now() }
  }

  // =========================================================================
  // Cache management
  // =========================================================================

  /** Clear all in-memory caches (TVDB token is preserved) */
  clearCache(): void {
    this.cache.clear()
    this.cachedAnidbTitles = null
    this.anidbCacheExpiry = 0
  }
}

// ---------------------------------------------------------------------------
// Singleton — initialised from environment variables
// ---------------------------------------------------------------------------

/** Parse comma-separated TVDB keys from env */
const _tvdbKeys = (process.env.TVDB_API_KEY ?? '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean)

/**
 * Pre-built singleton for use throughout the application.
 * Reads TVDB_API_KEY (comma-separated for rotation) from env.
 *
 * @example
 * import { metadataAPIService } from './services/MetadataAPIService.js'
 * const results = await metadataAPIService.searchAllSources('Breaking Bad')
 */
export const metadataAPIService = new MetadataAPIService(_tvdbKeys)
