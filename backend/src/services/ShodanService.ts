/**
 * ShodanService
 *
 * Uses the Shodan API (https://www.shodan.io/) to discover publicly exposed
 * Xtream Codes IPTV panels. Shodan continuously scans the internet and indexes
 * HTTP banners — we query it for hosts serving "player_api.php" responses on
 * common IPTV ports (8080, 25461, 80, 8096).
 *
 * Discovered panels are validated with a lightweight Xtream Codes probe before
 * being stored. No credentials are assumed — only panels that respond to the
 * unauthenticated /player_api.php endpoint are recorded.
 *
 * Env vars:
 *   SHODAN_API_KEY    — Shodan API key (required; get free key at account.shodan.io)
 *   CENSYS_API_ID     — Censys API ID (optional fallback)
 *   CENSYS_API_SECRET — Censys API secret (optional fallback)
 *   SHODAN_MAX_RESULTS — max panels to fetch per search (default: 100)
 */

import axios, { AxiosInstance } from 'axios'
import { EventEmitter }         from 'events'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ShodanHost {
  ip:       string
  port:     number
  hostnames: string[]
  org?:     string
  country?: string
  asn?:     string
  data?:    string   // raw banner snippet
}

export interface XtreamPanel {
  url:        string    // e.g. http://1.2.3.4:8080
  ip:         string
  port:       number
  hostname?:  string
  country?:   string
  org?:       string
  validated:  boolean   // true = responded to /player_api.php
  serverInfo?: Record<string, any>
  discoveredAt: number
  source:     'shodan' | 'censys' | 'manual'
}

export interface ShodanSearchResult {
  panels:     XtreamPanel[]
  total:      number
  error?:     string
}

// ── Common Xtream Codes ports ──────────────────────────────────────────────────

const XTREAM_PORTS = [8080, 25461, 8000, 80, 8096, 2082, 8888]

// Shodan queries that find Xtream Codes panels
const SHODAN_QUERIES = [
  'http.title:"Xtream Codes" port:8080',
  'http.html:"player_api.php" port:8080',
  'http.html:"get_vod_categories" port:8080',
  'http.favicon.hash:1225390040',            // common Xtream favicon hash
  '"player_api.php" port:25461',
  '"get_live_categories" port:8080',
]

// ── Service ────────────────────────────────────────────────────────────────────

export class ShodanService extends EventEmitter {
  private shodan:   AxiosInstance
  private apiKey:   string
  private maxResults: number
  private knownPanels = new Map<string, XtreamPanel>()

  // Censys credentials (optional)
  private censysId:     string | undefined
  private censysSecret: string | undefined

  constructor() {
    super()
    this.apiKey     = process.env.SHODAN_API_KEY ?? ''
    this.maxResults = parseInt(process.env.SHODAN_MAX_RESULTS ?? '100', 10)
    this.censysId     = process.env.CENSYS_API_ID
    this.censysSecret = process.env.CENSYS_API_SECRET

    this.shodan = axios.create({
      baseURL: 'https://api.shodan.io',
      timeout: 30_000,
      params:  { key: this.apiKey },
    })
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Run all Xtream-targeted Shodan queries and validate each discovered host. */
  async discoverXtreamPanels(): Promise<ShodanSearchResult> {
    if (!this.apiKey) {
      return { panels: [], total: 0, error: 'SHODAN_API_KEY not set' }
    }

    const allHosts: ShodanHost[] = []

    for (const query of SHODAN_QUERIES) {
      try {
        const hosts = await this.shodanSearch(query, Math.ceil(this.maxResults / SHODAN_QUERIES.length))
        allHosts.push(...hosts)
        this.emit('progress', { phase: 'shodan', query, found: hosts.length })
      } catch (err: any) {
        console.warn(`[Shodan] Query failed: "${query}" — ${err.message}`)
      }
    }

    // Deduplicate by IP:port
    const unique = this._deduplicateHosts(allHosts)
    console.log(`[Shodan] ${unique.length} unique hosts from ${allHosts.length} raw results`)

    // Validate each host
    const panels: XtreamPanel[] = []
    const concurrency = 10
    for (let i = 0; i < unique.length; i += concurrency) {
      const batch = unique.slice(i, i + concurrency)
      const results = await Promise.allSettled(batch.map(h => this._validateXtreamHost(h)))
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          panels.push(r.value)
          this.knownPanels.set(r.value.url, r.value)
          this.emit('panel', r.value)
        }
      }
    }

    // Also try Censys if available
    if (this.censysId && this.censysSecret) {
      try {
        const censysPanels = await this._censysSearch()
        panels.push(...censysPanels)
      } catch (err: any) {
        console.warn(`[Shodan] Censys search failed: ${err.message}`)
      }
    }

    console.log(`[Shodan] ✓ Found ${panels.length} validated Xtream panels`)
    return { panels, total: panels.length }
  }

  /**
   * Search Shodan for a custom query and return raw host entries.
   */
  async shodanSearch(query: string, limit = 100): Promise<ShodanHost[]> {
    const hosts: ShodanHost[] = []
    let page = 1
    let fetched = 0

    while (fetched < limit) {
      const res = await this.shodan.get('/shodan/host/search', {
        params: { query, page, minify: true },
      })

      const data = res.data as { matches?: any[]; total?: number }
      if (!data.matches?.length) break

      for (const m of data.matches) {
        hosts.push({
          ip:        m.ip_str,
          port:      m.port,
          hostnames: m.hostnames ?? [],
          org:       m.org,
          country:   m.location?.country_code,
          asn:       m.asn,
          data:      m.data,
        })
      }

      fetched += data.matches.length
      if (data.matches.length < 100) break
      page++
      await this._delay(1000) // Shodan rate limit
    }

    return hosts.slice(0, limit)
  }

  /**
   * Validate a specific IP:port as an Xtream Codes panel.
   * Returns XtreamPanel if valid, null otherwise.
   */
  async validatePanel(ip: string, port: number): Promise<XtreamPanel | null> {
    const host: ShodanHost = { ip, port, hostnames: [] }
    return this._validateXtreamHost(host)
  }

  /** Return all known validated panels discovered so far. */
  getKnownPanels(): XtreamPanel[] {
    return [...this.knownPanels.values()]
  }

  /** Check if Shodan API key is configured. */
  isConfigured(): boolean {
    return Boolean(this.apiKey)
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _validateXtreamHost(host: ShodanHost): Promise<XtreamPanel | null> {
    const portsToTry = host.port ? [host.port] : XTREAM_PORTS

    for (const port of portsToTry) {
      // Try IP first, then hostnames
      const candidates = [host.ip, ...(host.hostnames ?? [])].filter(Boolean)
      for (const candidate of candidates) {
        const baseUrl = `http://${candidate}:${port}`
        const panel = await this._probeXtreamUrl(baseUrl, host)
        if (panel) return panel
      }
    }
    return null
  }

  private async _probeXtreamUrl(baseUrl: string, host: ShodanHost): Promise<XtreamPanel | null> {
    try {
      // Unauthenticated probe — Xtream panels return server_info even without creds
      const res = await axios.get(`${baseUrl}/player_api.php`, {
        timeout: 8_000,
        params: { username: 'test', password: 'test', action: 'get_server_info' },
        validateStatus: () => true,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })

      const data = res.data
      // Xtream Codes always returns JSON with server_info or user_info
      if (res.status === 200 && typeof data === 'object' && data !== null) {
        const isXtream = (
          'server_info' in data ||
          'user_info' in data ||
          'available_channels' in data ||
          (typeof data.server_info === 'object')
        )
        if (isXtream) {
          return {
            url:         baseUrl,
            ip:          host.ip,
            port:        typeof host.port === 'number' ? host.port : parseInt(String(host.port), 10),
            hostname:    host.hostnames?.[0],
            country:     host.country,
            org:         host.org,
            validated:   true,
            serverInfo:  data.server_info ?? data,
            discoveredAt: Date.now(),
            source:      'shodan',
          }
        }
      }
    } catch {
      // connection refused or timeout — not an Xtream panel
    }
    return null
  }

  private async _censysSearch(): Promise<XtreamPanel[]> {
    const panels: XtreamPanel[] = []
    const query = 'services.http.response.body: "player_api.php"'
    const res = await axios.post(
      'https://search.censys.io/api/v2/hosts/search',
      { q: query, per_page: 100 },
      {
        auth: { username: this.censysId!, password: this.censysSecret! },
        timeout: 20_000,
        headers: { 'Content-Type': 'application/json' },
      }
    )

    const hits = res.data?.result?.hits ?? []
    for (const hit of hits) {
      const ip   = hit.ip
      const port = hit.services?.[0]?.port ?? 8080
      const panel = await this._probeXtreamUrl(`http://${ip}:${port}`, {
        ip, port, hostnames: hit.names ?? [],
        country: hit.location?.country_code,
        org: hit.autonomous_system?.name,
      })
      if (panel) {
        panel.source = 'censys'
        panels.push(panel)
      }
    }
    return panels
  }

  private _deduplicateHosts(hosts: ShodanHost[]): ShodanHost[] {
    const seen = new Set<string>()
    return hosts.filter(h => {
      const key = `${h.ip}:${h.port}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

export const shodanService = new ShodanService()
