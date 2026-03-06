/**
 * TraktService.ts
 *
 * Trakt.tv API integration for fetching trending/popular/watched media titles
 * and generating seed title lists for use by downstream crawlers.
 *
 * Features:
 *  - Trending, popular, and most-watched endpoints (movies + shows)
 *  - Full-text search with structured results
 *  - Webhook receiver support for new-episode notifications
 *  - Alternate title/alias extraction for semantic matching
 *  - In-memory TTL cache (15 min trending, 60 min popular)
 *  - EventEmitter: emits 'seeds', 'newEpisode', 'error'
 */

import { EventEmitter } from 'events'
import axios, { AxiosInstance } from 'axios'
import dotenv from 'dotenv'

dotenv.config()

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Configuration for TraktService */
export interface TraktConfig {
  /** Trakt client ID (required) */
  clientId: string
  /** Trakt client secret (optional — only needed for OAuth flows) */
  clientSecret?: string
  /** Legacy v2 API key alias (treated as clientId when present) */
  clientV2Key?: string
  /** Override default cache TTLs (in minutes) for all categories */
  cacheMinutes?: {
    trending?: number
    popular?: number
    watched?: number
    search?: number
  }
  /** Maximum results to return per endpoint call */
  maxResults?: number
}

/** A single normalised movie or show entry */
export interface TraktTitle {
  title: string
  year?: number
  type: 'movie' | 'show'
  traktId: number
  imdbId?: string
  tmdbId?: number
  slug: string
  /** All known alternate/alias names for this title */
  alternateNames: string[]
}

/** Flat seed list ready for crawler consumption */
export interface TraktSeedList {
  /** Deduplicated array of all title strings */
  titles: string[]
  /** Deduplicated array of IMDb IDs (where available) */
  imdbIds: string[]
  /** Unix timestamp (ms) when this list was generated */
  generated: number
}

/** Raw trending item returned by Trakt API */
interface TraktRawTrendingMovie {
  watchers: number
  movie: TraktRawMovie
}
interface TraktRawTrendingShow {
  watchers: number
  show: TraktRawShow
}

interface TraktRawMovie {
  title: string
  year: number
  ids: TraktRawIds
}
interface TraktRawShow {
  title: string
  year: number
  ids: TraktRawIds
}
interface TraktRawIds {
  trakt: number
  slug: string
  imdb?: string
  tmdb?: number
  tvdb?: number
}

/** Most-watched period variants */
export type WatchedPeriod = 'weekly' | 'monthly' | 'all'

/** Webhook payload Trakt sends for new-episode events */
export interface TraktWebhookPayload {
  event: string
  show?: TraktRawShow
  movie?: TraktRawMovie
  episode?: {
    season: number
    number: number
    title: string
    ids: TraktRawIds
  }
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Internal cache helpers
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

  invalidate(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}

// ---------------------------------------------------------------------------
// TraktService class
// ---------------------------------------------------------------------------

export class TraktService extends EventEmitter {
  private readonly http: AxiosInstance
  private readonly cache = new TTLCache()
  private readonly config: Required<TraktConfig> & {
    cacheMinutes: Required<NonNullable<TraktConfig['cacheMinutes']>>
  }

  constructor(config: TraktConfig) {
    super()

    const effectiveClientId = config.clientV2Key ?? config.clientId

    this.config = {
      clientId: effectiveClientId,
      clientSecret: config.clientSecret ?? '',
      clientV2Key: config.clientV2Key ?? '',
      cacheMinutes: {
        trending: config.cacheMinutes?.trending ?? 15,
        popular: config.cacheMinutes?.popular ?? 60,
        watched: config.cacheMinutes?.watched ?? 30,
        search: config.cacheMinutes?.search ?? 10,
      },
      maxResults: config.maxResults ?? 50,
    }

    this.http = axios.create({
      baseURL: 'https://api.trakt.tv',
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': effectiveClientId,
      },
      timeout: 15_000,
    })
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Wrapper that handles pagination, caching and error propagation
   * for all list-style Trakt endpoints.
   */
  private async fetchList<T>(
    path: string,
    cacheKey: string,
    ttlMinutes: number,
    page = 1,
    limit?: number,
  ): Promise<T[]> {
    const effectiveLimit = limit ?? this.config.maxResults
    const fullKey = `${cacheKey}:p${page}:l${effectiveLimit}`
    const cached = this.cache.get<T[]>(fullKey)
    if (cached) return cached

    try {
      const { data } = await this.http.get<T[]>(path, {
        params: { page, limit: effectiveLimit },
      })
      this.cache.set(fullKey, data, ttlMinutes)
      return data
    } catch (err) {
      this.emit('error', err)
      throw err
    }
  }

  /** Normalise a raw movie object into a TraktTitle */
  private normaliseMovie(raw: TraktRawMovie): TraktTitle {
    return {
      title: raw.title,
      year: raw.year,
      type: 'movie',
      traktId: raw.ids.trakt,
      imdbId: raw.ids.imdb,
      tmdbId: raw.ids.tmdb,
      slug: raw.ids.slug,
      alternateNames: [],
    }
  }

  /** Normalise a raw show object into a TraktTitle */
  private normaliseShow(raw: TraktRawShow): TraktTitle {
    return {
      title: raw.title,
      year: raw.year,
      type: 'show',
      traktId: raw.ids.trakt,
      imdbId: raw.ids.imdb,
      tmdbId: raw.ids.tmdb,
      slug: raw.ids.slug,
      alternateNames: [],
    }
  }

  /**
   * Fetch Trakt aliases for a single item and attach them to a TraktTitle.
   * Silently swallows errors (aliases are best-effort).
   */
  private async attachAliases(item: TraktTitle): Promise<TraktTitle> {
    try {
      const endpoint =
        item.type === 'movie'
          ? `/movies/${item.slug}/aliases`
          : `/shows/${item.slug}/aliases`
      const { data } = await this.http.get<Array<{ title: string; country: string }>>(endpoint)
      item.alternateNames = data.map((a) => a.title).filter(Boolean)
    } catch {
      // alias enrichment is best-effort
    }
    return item
  }

  // -------------------------------------------------------------------------
  // Public API — Trending
  // -------------------------------------------------------------------------

  /**
   * Fetch currently trending movies.
   * @param page  - Page number (1-based)
   * @param limit - Override default maxResults
   */
  async getTrendingMovies(page = 1, limit?: number): Promise<TraktTitle[]> {
    const raw = await this.fetchList<TraktRawTrendingMovie>(
      '/movies/trending',
      'trending:movies',
      this.config.cacheMinutes.trending,
      page,
      limit,
    )
    return raw.map((r) => this.normaliseMovie(r.movie))
  }

  /**
   * Fetch currently trending TV shows.
   * @param page  - Page number (1-based)
   * @param limit - Override default maxResults
   */
  async getTrendingShows(page = 1, limit?: number): Promise<TraktTitle[]> {
    const raw = await this.fetchList<TraktRawTrendingShow>(
      '/shows/trending',
      'trending:shows',
      this.config.cacheMinutes.trending,
      page,
      limit,
    )
    return raw.map((r) => this.normaliseShow(r.show))
  }

  // -------------------------------------------------------------------------
  // Public API — Popular
  // -------------------------------------------------------------------------

  /**
   * Fetch popular movies (sorted by Trakt community popularity score).
   */
  async getPopularMovies(page = 1, limit?: number): Promise<TraktTitle[]> {
    const raw = await this.fetchList<TraktRawMovie>(
      '/movies/popular',
      'popular:movies',
      this.config.cacheMinutes.popular,
      page,
      limit,
    )
    return raw.map((r) => this.normaliseMovie(r))
  }

  /**
   * Fetch popular TV shows.
   */
  async getPopularShows(page = 1, limit?: number): Promise<TraktTitle[]> {
    const raw = await this.fetchList<TraktRawShow>(
      '/shows/popular',
      'popular:shows',
      this.config.cacheMinutes.popular,
      page,
      limit,
    )
    return raw.map((r) => this.normaliseShow(r))
  }

  // -------------------------------------------------------------------------
  // Public API — Most Watched
  // -------------------------------------------------------------------------

  /**
   * Fetch most-watched movies for a given period.
   * @param period - 'weekly' | 'monthly' | 'all'
   */
  async getMostWatchedMovies(
    period: WatchedPeriod = 'weekly',
    page = 1,
    limit?: number,
  ): Promise<TraktTitle[]> {
    const raw = await this.fetchList<{ watcher_count: number; movie: TraktRawMovie }>(
      `/movies/watched/${period}`,
      `watched:movies:${period}`,
      this.config.cacheMinutes.watched,
      page,
      limit,
    )
    return raw.map((r) => this.normaliseMovie(r.movie))
  }

  /**
   * Fetch most-watched shows for a given period.
   * @param period - 'weekly' | 'monthly' | 'all'
   */
  async getMostWatchedShows(
    period: WatchedPeriod = 'weekly',
    page = 1,
    limit?: number,
  ): Promise<TraktTitle[]> {
    const raw = await this.fetchList<{ watcher_count: number; show: TraktRawShow }>(
      `/shows/watched/${period}`,
      `watched:shows:${period}`,
      this.config.cacheMinutes.watched,
      page,
      limit,
    )
    return raw.map((r) => this.normaliseShow(r.show))
  }

  // -------------------------------------------------------------------------
  // Public API — Search
  // -------------------------------------------------------------------------

  /**
   * Search Trakt for a specific title across movies and shows.
   * Results are cached for a short TTL to avoid hammering the API during
   * rapid successive lookups.
   *
   * @param query  - Free-text search query
   * @param types  - Which media types to include (default: both)
   * @param limit  - Maximum results to return
   */
  async search(
    query: string,
    types: Array<'movie' | 'show'> = ['movie', 'show'],
    limit?: number,
  ): Promise<TraktTitle[]> {
    const typeParam = types.join(',')
    const cacheKey = `search:${typeParam}:${query}`
    const effectiveLimit = limit ?? this.config.maxResults

    const cached = this.cache.get<TraktTitle[]>(cacheKey)
    if (cached) return cached

    try {
      const { data } = await this.http.get<Array<{ type: string; movie?: TraktRawMovie; show?: TraktRawShow }>>(
        `/search/${typeParam}`,
        { params: { query, limit: effectiveLimit } },
      )

      const results: TraktTitle[] = data.map((item) => {
        if (item.type === 'movie' && item.movie) return this.normaliseMovie(item.movie)
        if (item.type === 'show' && item.show) return this.normaliseShow(item.show)
        throw new Error(`Unexpected search result type: ${item.type}`)
      })

      this.cache.set(cacheKey, results, this.config.cacheMinutes.search)
      return results
    } catch (err) {
      this.emit('error', err)
      throw err
    }
  }

  // -------------------------------------------------------------------------
  // Public API — Alternate title enrichment
  // -------------------------------------------------------------------------

  /**
   * Attach Trakt alias names to an array of TraktTitle objects.
   * Makes one API call per title — use sparingly (rate limits apply).
   *
   * @param titles   - TraktTitle objects to enrich
   * @param concurrency - Max parallel requests (default: 5)
   */
  async enrichWithAliases(titles: TraktTitle[], concurrency = 5): Promise<TraktTitle[]> {
    const enriched: TraktTitle[] = []
    // Process in batches to respect rate limits
    for (let i = 0; i < titles.length; i += concurrency) {
      const batch = titles.slice(i, i + concurrency)
      const results = await Promise.all(batch.map((t) => this.attachAliases(t)))
      enriched.push(...results)
    }
    return enriched
  }

  // -------------------------------------------------------------------------
  // Public API — Seed generation
  // -------------------------------------------------------------------------

  /**
   * Build a deduplicated flat seed list by combining all trending, popular,
   * and most-watched results for both movies and shows.
   *
   * Emits a 'seeds' event with the generated TraktSeedList.
   *
   * @param includeAliases - Whether to attach alternate names (makes extra API calls)
   */
  async generateSeeds(includeAliases = false): Promise<TraktSeedList> {
    const [
      trendingMovies,
      trendingShows,
      popularMovies,
      popularShows,
      watchedMoviesWeekly,
      watchedShowsWeekly,
      watchedMoviesMonthly,
      watchedShowsMonthly,
    ] = await Promise.all([
      this.getTrendingMovies(),
      this.getTrendingShows(),
      this.getPopularMovies(),
      this.getPopularShows(),
      this.getMostWatchedMovies('weekly'),
      this.getMostWatchedShows('weekly'),
      this.getMostWatchedMovies('monthly'),
      this.getMostWatchedShows('monthly'),
    ])

    let all: TraktTitle[] = [
      ...trendingMovies,
      ...trendingShows,
      ...popularMovies,
      ...popularShows,
      ...watchedMoviesWeekly,
      ...watchedShowsWeekly,
      ...watchedMoviesMonthly,
      ...watchedShowsMonthly,
    ]

    // Deduplicate by slug before optionally fetching aliases
    const seenSlugs = new Set<string>()
    all = all.filter((t) => {
      if (seenSlugs.has(t.slug)) return false
      seenSlugs.add(t.slug)
      return true
    })

    if (includeAliases) {
      all = await this.enrichWithAliases(all)
    }

    const titleSet = new Set<string>()
    const imdbSet = new Set<string>()

    for (const item of all) {
      titleSet.add(item.title)
      for (const alt of item.alternateNames) {
        titleSet.add(alt)
      }
      if (item.imdbId) imdbSet.add(item.imdbId)
    }

    const seedList: TraktSeedList = {
      titles: Array.from(titleSet),
      imdbIds: Array.from(imdbSet),
      generated: Date.now(),
    }

    this.emit('seeds', seedList)
    return seedList
  }

  // -------------------------------------------------------------------------
  // Webhook support
  // -------------------------------------------------------------------------

  /**
   * Process an inbound Trakt webhook payload.
   *
   * Call this from your Express route handler:
   * ```ts
   * app.post('/webhooks/trakt', (req, res) => {
   *   traktService.handleWebhook(req.body)
   *   res.sendStatus(200)
   * })
   * ```
   *
   * Emits 'newEpisode' when an episode.watching or scrobble.start event arrives.
   */
  handleWebhook(payload: TraktWebhookPayload): void {
    const episodeEvents = new Set([
      'episode.watching',
      'episode.scrobble',
      'scrobble.start',
      'scrobble.pause',
      'scrobble.stop',
    ])

    if (episodeEvents.has(payload.event) && payload.show && payload.episode) {
      const eventData = {
        showTitle: payload.show.title,
        showSlug: payload.show.ids?.slug,
        season: payload.episode.season,
        episode: payload.episode.number,
        episodeTitle: payload.episode.title,
        imdbId: payload.show.ids?.imdb,
        raw: payload,
      }
      this.emit('newEpisode', eventData)
    }
  }

  // -------------------------------------------------------------------------
  // Cache management
  // -------------------------------------------------------------------------

  /** Manually invalidate cache for a specific key prefix */
  invalidateCache(prefix?: string): void {
    if (prefix) {
      // TTLCache doesn't support prefix-based deletion; clear all when prefix given
      this.cache.clear()
    } else {
      this.cache.clear()
    }
  }
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a new TraktService instance with the provided configuration.
 *
 * @example
 * const trakt = createTraktService({ clientId: 'abc123' })
 * trakt.on('seeds', (list) => console.log(list.titles))
 * const seeds = await trakt.generateSeeds()
 */
export function createTraktService(config: TraktConfig): TraktService {
  return new TraktService(config)
}

// ---------------------------------------------------------------------------
// Singleton — initialised from environment variables
// ---------------------------------------------------------------------------

const _clientId = process.env.TRAKT_CLIENT_ID ?? ''
const _clientSecret = process.env.TRAKT_CLIENT_SECRET

/**
 * Pre-built singleton for use throughout the application.
 * Reads TRAKT_CLIENT_ID (and optionally TRAKT_CLIENT_SECRET) from env.
 */
export const traktService: TraktService = createTraktService({
  clientId: _clientId,
  clientSecret: _clientSecret,
  maxResults: Number(process.env.TRAKT_MAX_RESULTS ?? '50'),
})
