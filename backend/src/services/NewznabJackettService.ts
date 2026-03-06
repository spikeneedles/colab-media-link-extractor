/**
 * NewznabJackettService
 *
 * Dual-stack indexer search: Newznab/NZBHydra2 + Jackett.
 * Works alongside the existing Prowlarr integration.
 *
 * Newznab protocol:
 *   GET {baseUrl}/api?apikey={key}&t=search&q={query}&cat={cats}&extended=1
 *   GET {baseUrl}/api?t=caps   → capabilities / category list
 *   Response: RSS/XML with <item> elements
 *
 * Jackett protocol:
 *   GET {jackettUrl}/api/v2.0/indexers/all/results?apikey={key}&Query={q}&Category[]={cat}
 *   GET {jackettUrl}/api/v2.0/indexers             → list all configured indexers
 *   Response: JSON { Results: [...] }
 */

import { EventEmitter } from 'events'
import axios, { AxiosInstance } from 'axios'

// ── Category constants (Newznab standard) ────────────────────────────────────

export const NEWZNAB_CATEGORIES: Record<string, number> = {
  TV: 5000,
  Movies: 2000,
  Anime: 7000,
  Audio: 3000,
  Books: 8000,
  Games: 4000,
  Other: 1000,
  XXX: 6000,
}

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface NewznabServerConfig {
  url: string
  /** Single key or array for rotation */
  apiKey: string | string[]
}

export interface NewznabConfig {
  servers: NewznabServerConfig[]
  defaultCategories: string[] // e.g. ['5000', '2000']
}

export interface JackettConfig {
  url: string
  /** Single key or array for rotation */
  apiKey: string | string[]
  /** Filter to specific Jackett indexer IDs; omit = use all */
  indexerIds?: string[]
}

export interface CombinedSearchOptions {
  categories?: string[]
  /** Max results per source per query */
  limit?: number
  /** Skip Jackett even if configured */
  skipJackett?: boolean
  /** Skip Newznab servers even if configured */
  skipNewznab?: boolean
}

/** Same shape as NormalizedResult in BackgroundCrawler */
export interface CombinedSearchResult {
  title: string
  size: number
  seeders: number
  leechers: number
  indexer: string
  indexerId: number
  category: string
  publishDate?: string
  downloadUrl?: string
  magnetUrl?: string
  infoHash?: string
  guid?: string
  score: number
  /** 'newznab' | 'jackett' */
  source: 'newznab' | 'jackett'
}

export interface IndexerInfo {
  id: string | number
  name: string
  source: 'newznab' | 'jackett'
  enabled: boolean
  categories?: string[]
}

// ── Rate-limit tracker per server ─────────────────────────────────────────────

interface RateLimitState {
  backoffUntil: number
  backoffMs: number
}

// ── NewznabJackettService ─────────────────────────────────────────────────────

export class NewznabJackettService extends EventEmitter {
  private newznabConfig: NewznabConfig | null
  private jackettConfig: JackettConfig | null
  private http: AxiosInstance
  private rateLimits: Map<string, RateLimitState> = new Map()

  // Per-server key rotation cursors
  private newznabKeyCursors: Map<string, number> = new Map()
  private jackettKeyCursor: number = 0

  constructor(newznab: NewznabConfig | null, jackett: JackettConfig | null) {
    super()
    this.newznabConfig = newznab
    this.jackettConfig = jackett
    this.http = axios.create({ timeout: 30_000 })
  }

  // ── Key rotation helpers ───────────────────────────────────────────────────

  private getNewznabKey(serverUrl: string, keys: string | string[]): string {
    if (typeof keys === 'string') return keys
    const cursor = this.newznabKeyCursors.get(serverUrl) ?? 0
    const key = keys[cursor % keys.length]
    this.newznabKeyCursors.set(serverUrl, cursor + 1)
    return key
  }

  private getJackettKey(): string {
    if (!this.jackettConfig) return ''
    const keys = this.jackettConfig.apiKey
    if (typeof keys === 'string') return keys
    const key = keys[this.jackettKeyCursor % keys.length]
    this.jackettKeyCursor++
    return key
  }

  // ── Rate-limit helpers ─────────────────────────────────────────────────────

  private isBackedOff(serverUrl: string): boolean {
    const state = this.rateLimits.get(serverUrl)
    if (!state) return false
    return Date.now() < state.backoffUntil
  }

  private recordRateLimit(serverUrl: string): void {
    const existing = this.rateLimits.get(serverUrl)
    const backoffMs = existing ? Math.min(existing.backoffMs * 2, 60_000) : 5_000
    this.rateLimits.set(serverUrl, {
      backoffUntil: Date.now() + backoffMs,
      backoffMs,
    })
    console.warn(`⏳ Rate-limited on ${serverUrl} — backing off ${backoffMs}ms`)
  }

  private clearRateLimit(serverUrl: string): void {
    if (this.rateLimits.has(serverUrl)) {
      this.rateLimits.set(serverUrl, { backoffUntil: 0, backoffMs: 5_000 })
    }
  }

  // ── XML / RSS parsing (no external lib required) ──────────────────────────

  private parseNewznabXml(xml: string, serverUrl: string): CombinedSearchResult[] {
    const results: CombinedSearchResult[] = []

    // Extract all <item> blocks
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let itemMatch: RegExpExecArray | null

    while ((itemMatch = itemRegex.exec(xml)) !== null) {
      const block = itemMatch[1]

      const getText = (tag: string): string => {
        const m = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`).exec(block)
        return m ? (m[1] ?? m[2] ?? '').trim() : ''
      }

      const getAttr = (name: string): string => {
        const m = new RegExp(`<newznab:attr\\s+name="${name}"\\s+value="([^"]*)"`, 'i').exec(block)
        return m ? m[1] : ''
      }

      const enclosureUrl = (() => {
        const m = /<enclosure[^>]+url="([^"]+)"/.exec(block)
        return m ? m[1] : ''
      })()

      const enclosureLength = (() => {
        const m = /<enclosure[^>]+length="([^"]+)"/.exec(block)
        return m ? parseInt(m[1], 10) : 0
      })()

      const title = getText('title')
      if (!title) continue

      results.push({
        title,
        size: enclosureLength || parseInt(getAttr('size'), 10) || 0,
        seeders: parseInt(getAttr('seeders'), 10) || 0,
        leechers: parseInt(getAttr('peers'), 10) || 0,
        indexer: serverUrl,
        indexerId: 0,
        category: getAttr('category') || getText('category'),
        publishDate: getText('pubDate'),
        downloadUrl: enclosureUrl || getText('link'),
        magnetUrl: getAttr('magneturl') || undefined,
        infoHash: getAttr('infohash') || undefined,
        guid: getText('guid') || undefined,
        score: parseInt(getAttr('seeders'), 10) || 0,
        source: 'newznab',
      })
    }

    return results
  }

  // ── Newznab methods ───────────────────────────────────────────────────────

  async newznabCaps(serverUrl: string, apiKey: string): Promise<string> {
    const url = `${serverUrl}/api?t=caps&apikey=${encodeURIComponent(apiKey)}`
    const { data } = await this.http.get<string>(url, { responseType: 'text' })
    return data
  }

  private async searchOneNewznabServer(
    server: NewznabServerConfig,
    query: string,
    categories: string[],
    limit: number,
  ): Promise<CombinedSearchResult[]> {
    const serverUrl = server.url.replace(/\/$/, '')

    if (this.isBackedOff(serverUrl)) {
      console.log(`⏩ Skipping ${serverUrl} (rate-limit backoff active)`)
      return []
    }

    const apiKey = this.getNewznabKey(serverUrl, server.apiKey)
    const cat = categories.join(',')
    const url =
      `${serverUrl}/api?apikey=${encodeURIComponent(apiKey)}&t=search` +
      `&q=${encodeURIComponent(query)}&cat=${encodeURIComponent(cat)}&extended=1&limit=${limit}`

    try {
      const { data } = await this.http.get<string>(url, { responseType: 'text' })
      this.clearRateLimit(serverUrl)
      const parsed = this.parseNewznabXml(data, serverUrl)
      this.emit('result', { source: 'newznab', server: serverUrl, count: parsed.length })
      return parsed
    } catch (err: any) {
      if (err?.response?.status === 429) {
        this.recordRateLimit(serverUrl)
      }
      this.emit('error', { source: 'newznab', server: serverUrl, error: err?.message })
      return []
    }
  }

  // ── Jackett methods ───────────────────────────────────────────────────────

  private async searchJackett(
    query: string,
    categories: string[],
    limit: number,
  ): Promise<CombinedSearchResult[]> {
    if (!this.jackettConfig) return []

    const baseUrl = this.jackettConfig.url.replace(/\/$/, '')

    if (this.isBackedOff(baseUrl)) {
      console.log(`⏩ Skipping Jackett (rate-limit backoff active)`)
      return []
    }

    const apiKey = this.getJackettKey()
    const params = new URLSearchParams({
      apikey: apiKey,
      Query: query,
    })
    for (const cat of categories) {
      params.append('Category[]', cat)
    }
    if (this.jackettConfig.indexerIds?.length) {
      for (const id of this.jackettConfig.indexerIds) {
        params.append('Tracker[]', id)
      }
    }

    const url = `${baseUrl}/api/v2.0/indexers/all/results?${params.toString()}`

    try {
      const { data } = await this.http.get<{ Results: any[] }>(url)
      this.clearRateLimit(baseUrl)

      const items: any[] = Array.isArray(data?.Results) ? data.Results : []
      const results: CombinedSearchResult[] = items.slice(0, limit).map((r) => ({
        title: r.Title ?? '',
        size: r.Size ?? 0,
        seeders: r.Seeders ?? 0,
        leechers: r.Peers ?? 0,
        indexer: r.Tracker ?? 'Jackett',
        indexerId: 0,
        category: Array.isArray(r.Category) ? r.Category.join(',') : String(r.Category ?? ''),
        publishDate: r.PublishDate ?? undefined,
        downloadUrl: r.Link ?? r.Guid ?? undefined,
        magnetUrl: r.MagnetUri ?? undefined,
        infoHash: r.InfoHash ?? undefined,
        guid: r.Guid ?? undefined,
        score: r.Seeders ?? 0,
        source: 'jackett' as const,
      }))

      this.emit('result', { source: 'jackett', count: results.length })
      return results
    } catch (err: any) {
      if (err?.response?.status === 429) {
        this.recordRateLimit(baseUrl)
      }
      this.emit('error', { source: 'jackett', error: err?.message })
      return []
    }
  }

  // ── Deduplication ─────────────────────────────────────────────────────────

  private deduplicate(results: CombinedSearchResult[]): CombinedSearchResult[] {
    const seen = new Map<string, CombinedSearchResult>()

    for (const r of results) {
      // Prefer infoHash as the dedupe key; fall back to normalised title
      const key = r.infoHash?.toLowerCase() || r.title.toLowerCase().replace(/\s+/g, ' ').trim()
      const existing = seen.get(key)
      if (!existing || r.seeders > existing.seeders) {
        seen.set(key, r)
      }
    }

    return Array.from(seen.values())
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Search Jackett + all Newznab servers in parallel, merge & deduplicate results.
   */
  async search(query: string, options: CombinedSearchOptions = {}): Promise<CombinedSearchResult[]> {
    const categories = options.categories ?? this.newznabConfig?.defaultCategories ?? ['5000', '2000']
    const limit = options.limit ?? 100

    const promises: Promise<CombinedSearchResult[]>[] = []

    if (!options.skipNewznab && this.newznabConfig?.servers.length) {
      for (const server of this.newznabConfig.servers) {
        promises.push(this.searchOneNewznabServer(server, query, categories, limit))
      }
    }

    if (!options.skipJackett && this.jackettConfig) {
      promises.push(this.searchJackett(query, categories, limit))
    }

    if (!promises.length) return []

    const settled = await Promise.allSettled(promises)
    const merged: CombinedSearchResult[] = []

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        merged.push(...outcome.value)
      }
    }

    return this.deduplicate(merged)
  }

  /**
   * Category-targeted search using NEWZNAB_CATEGORIES keys (e.g. 'TV', 'Movies').
   */
  async searchByCategory(
    category: keyof typeof NEWZNAB_CATEGORIES,
    query: string = '',
    options: Omit<CombinedSearchOptions, 'categories'> = {},
  ): Promise<CombinedSearchResult[]> {
    const catId = String(NEWZNAB_CATEGORIES[category] ?? NEWZNAB_CATEGORIES.Other)
    return this.search(query, { ...options, categories: [catId] })
  }

  /**
   * List all available indexers from Jackett and Newznab caps.
   */
  async getIndexers(): Promise<IndexerInfo[]> {
    const indexers: IndexerInfo[] = []

    // Jackett indexers
    if (this.jackettConfig) {
      const baseUrl = this.jackettConfig.url.replace(/\/$/, '')
      const apiKey = this.getJackettKey()
      try {
        const { data } = await this.http.get<any[]>(
          `${baseUrl}/api/v2.0/indexers?apikey=${encodeURIComponent(apiKey)}`,
        )
        if (Array.isArray(data)) {
          for (const idx of data) {
            indexers.push({
              id: idx.id ?? idx.name,
              name: idx.name ?? idx.id,
              source: 'jackett',
              enabled: idx.configured ?? true,
              categories: idx.caps?.categories ?? [],
            })
          }
        }
      } catch (err: any) {
        this.emit('error', { source: 'jackett', context: 'getIndexers', error: err?.message })
      }
    }

    // Newznab caps
    if (this.newznabConfig?.servers.length) {
      for (const server of this.newznabConfig.servers) {
        const serverUrl = server.url.replace(/\/$/, '')
        const apiKey = this.getNewznabKey(serverUrl, server.apiKey)
        try {
          const xml = await this.newznabCaps(serverUrl, apiKey)
          // Extract <indexer> or treat whole server as one indexer
          const nameMatch = /<title>([^<]+)<\/title>/i.exec(xml)
          indexers.push({
            id: serverUrl,
            name: nameMatch?.[1] ?? serverUrl,
            source: 'newznab',
            enabled: true,
          })
        } catch (err: any) {
          this.emit('error', { source: 'newznab', server: serverUrl, context: 'getIndexers', error: err?.message })
        }
      }
    }

    return indexers
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export interface NewznabJackettServiceConfig {
  newznab?: NewznabConfig
  jackett?: JackettConfig
}

export function createNewznabJackettService(
  config: NewznabJackettServiceConfig,
): NewznabJackettService {
  return new NewznabJackettService(config.newznab ?? null, config.jackett ?? null)
}
