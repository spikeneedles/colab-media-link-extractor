/**
 * IPTVOrgService
 *
 * Aggregates IPTV channel and playlist data from:
 *  - iptv-org/iptv  — 150,000+ channels (https://github.com/iptv-org/iptv)
 *  - iptv-org/database — structured channels.json / streams.json
 *  - Awesome-IPTV and other curated GitHub "awesome" lists
 *  - Docker Hub images for Kodi / media-server configs
 *
 * All remote data is cached in-memory with a configurable TTL (default 6 h).
 * Emits 'channels', 'playlists', 'error' events.
 */

import { EventEmitter } from 'events'
import axios, { AxiosInstance } from 'axios'
import { Octokit } from '@octokit/rest'

// ── Constants ─────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 6 * 60 * 60 * 1_000 // 6 hours

const IPTV_ORG_RAW =
  'https://raw.githubusercontent.com/iptv-org/database/master'

const IPTV_ORG_MAIN_PLAYLIST =
  'https://iptv-org.github.io/iptv/index.m3u'

/** GitHub "awesome" repos to crawl for playlist URLs */
const AWESOME_REPOS: { owner: string; repo: string }[] = [
  { owner: 'iptv-org', repo: 'awesome-iptv' },
  { owner: 'junguler', repo: 'awesome-streaming' },
  { owner: 'awesome-selfhosted', repo: 'awesome-selfhosted' },
]

/** Regex to extract .m3u / .m3u8 / .pls URLs from markdown/plain text */
const PLAYLIST_URL_REGEX =
  /https?:\/\/[^\s"')>]+\.(?:m3u8?|pls|xspf)(?:\?[^\s"')>]*)?/gi

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface IPTVChannel {
  id: string
  name: string
  country?: string
  subdivision?: string
  city?: string
  broadcast_area?: string[]
  languages?: string[]
  categories?: string[]
  is_nsfw?: boolean
  launched?: string
  closed?: string
  replaced_by?: string
  website?: string
  logo?: string
}

export interface IPTVStream {
  channel?: string
  url: string
  http_referrer?: string
  user_agent?: string
  quality?: string
  status?: string
  timeshift?: string
  broadcast_area?: string[]
  languages?: string[]
  is_broken?: boolean
}

export interface AwesomeListResult {
  repo: string
  urls: string[]
}

export interface DockerHubImage {
  name: string
  namespace: string
  description: string
  pullCount: number
  tags: string[]
}

// ── Cache entry ───────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

// ── IPTVOrgService ────────────────────────────────────────────────────────────

export class IPTVOrgService extends EventEmitter {
  private http: AxiosInstance
  private octokit: Octokit | null

  // In-memory TTL cache
  private cache: Map<string, CacheEntry<unknown>> = new Map()

  constructor(githubToken?: string) {
    super()
    this.http = axios.create({
      timeout: 30_000,
      headers: { 'User-Agent': 'media-link-extractor/1.0' },
    })
    this.octokit = githubToken ? new Octokit({ auth: githubToken }) : new Octokit()
  }

  // ── Cache helpers ─────────────────────────────────────────────────────────

  private cacheGet<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    return entry.data
  }

  private cacheSet<T>(key: string, data: T, ttlMs = CACHE_TTL_MS): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs })
  }

  // ── iptv-org/database ─────────────────────────────────────────────────────

  /**
   * Fetch channels.json from iptv-org/database raw GitHub URL.
   * Returns a flat array of IPTVChannel objects.
   */
  async fetchIPTVOrgChannels(): Promise<IPTVChannel[]> {
    const CACHE_KEY = 'iptv-org:channels'
    const cached = this.cacheGet<IPTVChannel[]>(CACHE_KEY)
    if (cached) return cached

    try {
      const { data } = await this.http.get<IPTVChannel[]>(
        `${IPTV_ORG_RAW}/data/channels.json`,
      )
      const channels = Array.isArray(data) ? data : []
      this.cacheSet(CACHE_KEY, channels)
      this.emit('channels', channels)
      console.log(`✅ Fetched ${channels.length} channels from iptv-org/database`)
      return channels
    } catch (err: any) {
      this.emit('error', { context: 'fetchIPTVOrgChannels', error: err?.message })
      return []
    }
  }

  /**
   * Fetch streams.json from iptv-org/database.
   */
  async fetchIPTVOrgStreams(): Promise<IPTVStream[]> {
    const CACHE_KEY = 'iptv-org:streams'
    const cached = this.cacheGet<IPTVStream[]>(CACHE_KEY)
    if (cached) return cached

    try {
      const { data } = await this.http.get<IPTVStream[]>(
        `${IPTV_ORG_RAW}/data/streams.json`,
      )
      const streams = Array.isArray(data) ? data : []
      this.cacheSet(CACHE_KEY, streams)
      console.log(`✅ Fetched ${streams.length} streams from iptv-org/database`)
      return streams
    } catch (err: any) {
      this.emit('error', { context: 'fetchIPTVOrgStreams', error: err?.message })
      return []
    }
  }

  // ── Main M3U playlist ─────────────────────────────────────────────────────

  /**
   * Fetch the main M3U from https://iptv-org.github.io/iptv/index.m3u.
   * Returns the raw M3U text.
   */
  async fetchMainPlaylist(): Promise<string> {
    const CACHE_KEY = 'iptv-org:main-playlist'
    const cached = this.cacheGet<string>(CACHE_KEY)
    if (cached) return cached

    try {
      const { data } = await this.http.get<string>(IPTV_ORG_MAIN_PLAYLIST, {
        responseType: 'text',
      })
      this.cacheSet(CACHE_KEY, data)
      this.emit('playlists', [IPTV_ORG_MAIN_PLAYLIST])
      console.log(`✅ Fetched main iptv-org playlist (${data.length} bytes)`)
      return data
    } catch (err: any) {
      this.emit('error', { context: 'fetchMainPlaylist', error: err?.message })
      return ''
    }
  }

  // ── Awesome-list crawling ─────────────────────────────────────────────────

  /**
   * Generic GitHub awesome-list crawler.
   * Fetches README.md for the given repo and extracts all playlist URLs.
   * @param repoPath  "owner/repo" string
   */
  async fetchGitHubAwesomeList(repoPath: string): Promise<AwesomeListResult> {
    const CACHE_KEY = `awesome:${repoPath}`
    const cached = this.cacheGet<AwesomeListResult>(CACHE_KEY)
    if (cached) return cached

    const [owner, repo] = repoPath.split('/')
    if (!owner || !repo) {
      return { repo: repoPath, urls: [] }
    }

    try {
      // Try fetching README via GitHub API (avoids raw rate limits)
      const response = await this.octokit!.repos.getReadme({ owner, repo })
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8')
      const urls = this.extractPlaylistUrls(content)
      const result: AwesomeListResult = { repo: repoPath, urls }
      this.cacheSet(CACHE_KEY, result)
      console.log(`📋 ${repoPath}: found ${urls.length} playlist URLs`)
      return result
    } catch (err: any) {
      this.emit('error', { context: 'fetchGitHubAwesomeList', repo: repoPath, error: err?.message })
      return { repo: repoPath, urls: [] }
    }
  }

  /**
   * Crawl all configured awesome-IPTV lists in parallel.
   */
  async fetchAwesomeLists(): Promise<AwesomeListResult[]> {
    const CACHE_KEY = 'awesome:all'
    const cached = this.cacheGet<AwesomeListResult[]>(CACHE_KEY)
    if (cached) return cached

    const tasks = AWESOME_REPOS.map((r) =>
      this.fetchGitHubAwesomeList(`${r.owner}/${r.repo}`),
    )

    const results = await Promise.allSettled(tasks)
    const resolved: AwesomeListResult[] = []

    for (const outcome of results) {
      if (outcome.status === 'fulfilled') {
        resolved.push(outcome.value)
      }
    }

    this.cacheSet(CACHE_KEY, resolved)

    const allUrls = resolved.flatMap((r) => r.urls)
    if (allUrls.length) {
      this.emit('playlists', allUrls)
    }

    return resolved
  }

  // ── Aggregated helpers ────────────────────────────────────────────────────

  /**
   * Return the combined list of all discovered playlist URLs from:
   *  - iptv-org main playlist URL
   *  - all awesome-list crawls
   */
  async getAllPlaylistUrls(): Promise<string[]> {
    const [awesomeLists] = await Promise.all([this.fetchAwesomeLists()])

    const urlSet = new Set<string>()
    urlSet.add(IPTV_ORG_MAIN_PLAYLIST)

    for (const list of awesomeLists) {
      for (const url of list.urls) {
        urlSet.add(url)
      }
    }

    return Array.from(urlSet)
  }

  /**
   * Return all known channel / show names as search seeds.
   * Pulls from channels.json; names are deduplicated and trimmed.
   */
  async generateSeedTitles(): Promise<string[]> {
    const channels = await this.fetchIPTVOrgChannels()
    const seen = new Set<string>()

    for (const ch of channels) {
      const name = ch.name?.trim()
      if (name) seen.add(name)
    }

    return Array.from(seen)
  }

  // ── Docker Hub scanning ───────────────────────────────────────────────────

  /**
   * Scan Docker Hub for Kodi / media-server images.
   * Searches for 'kodi', 'jellyfin', 'emby', 'plex', 'tvheadend' namespaces.
   */
  async fetchDockerHubImages(): Promise<DockerHubImage[]> {
    const CACHE_KEY = 'dockerhub:media-images'
    const cached = this.cacheGet<DockerHubImage[]>(CACHE_KEY)
    if (cached) return cached

    const searchTerms = ['kodi', 'jellyfin', 'emby', 'plex', 'tvheadend', 'iptv']
    const images: DockerHubImage[] = []

    await Promise.allSettled(
      searchTerms.map(async (term) => {
        try {
          const { data } = await this.http.get<{ results: any[] }>(
            `https://hub.docker.com/v2/search/repositories/?query=${encodeURIComponent(term)}&page_size=10`,
          )
          for (const r of data?.results ?? []) {
            images.push({
              name: r.repo_name ?? r.name,
              namespace: r.namespace ?? r.repo_name?.split('/')[0] ?? '',
              description: r.short_description ?? '',
              pullCount: r.pull_count ?? 0,
              tags: [],
            })
          }
        } catch (err: any) {
          this.emit('error', { context: 'fetchDockerHubImages', term, error: err?.message })
        }
      }),
    )

    // Deduplicate by name
    const unique = Array.from(
      new Map(images.map((i) => [i.name, i])).values(),
    ).sort((a, b) => b.pullCount - a.pullCount)

    this.cacheSet(CACHE_KEY, unique)
    console.log(`🐳 Found ${unique.length} Docker Hub media images`)
    return unique
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private extractPlaylistUrls(text: string): string[] {
    const matches = text.match(PLAYLIST_URL_REGEX) ?? []
    return [...new Set(matches)]
  }

  /** Evict all expired cache entries */
  pruneCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  /** Clear the entire in-memory cache */
  clearCache(): void {
    this.cache.clear()
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const iptvOrgService = new IPTVOrgService(process.env.GITHUB_TOKEN)
