/**
 * API Provider Service
 * 
 * Centralized service for integrating with external APIs discovered from M3U8 sources
 * Supports: TMDb, TVDb, Trakt, Debrid services, torrent databases
 */

import dotenv from 'dotenv'
import axios, { AxiosInstance } from 'axios'
import * as cheerio from 'cheerio'
import { BrowserPool } from '../browserPool.js'

// Load environment variables before instantiating service
dotenv.config()

export type ApiProviderType = 
  | 'metadata'      // TMDb, TVDb, Trakt, IMDb
  | 'debrid'        // Real-Debrid, AllDebrid, Premiumize
  | 'torrent-db'    // BTDb, torrentsdb
  | 'streaming'     // Various streaming APIs
  | 'playlist'      // M3U/playlist providers

export interface ApiProvider {
  name: string
  hostname: string
  type: ApiProviderType
  requiresAuth: boolean
  rateLimitPerMinute?: number
  baseUrl: string
  apiKey?: string
}

export interface MediaSearchResult {
  id: string
  title: string
  type: 'movie' | 'series' | 'episode'
  year?: number
  posterUrl?: string
  backdropUrl?: string
  overview?: string
  genres?: string[]
  rating?: number
  externalIds?: {
    imdb?: string
    tmdb?: string
    tvdb?: string
    trakt?: string
  }
}

export interface TorrentSearchResult {
  name: string
  infoHash: string
  magnetUrl: string
  size: number
  seeders: number
  leechers: number
  source: string
  addedDate?: Date
}

export interface DebridStreamResult {
  streamUrl: string
  quality: string
  fileSize: number
  filename: string
  cached: boolean
}

/**
 * Manages integrations with discovered API providers
 */
export class ApiProviderService {
  private providers: Map<string, ApiProvider> = new Map()
  private axiosInstances: Map<string, AxiosInstance> = new Map()
  private requestCounts: Map<string, number[]> = new Map()
  private browserPool: BrowserPool | null = null

  constructor(browserPool?: BrowserPool) {
    this.browserPool = browserPool || null
    this.initializeProviders()
  }

  /**
   * Load API keys from environment variables
   */
  private loadApiKeysFromEnv(): void {
    // Metadata providers
    if (process.env.TMDB_API_KEY) {
      this.setApiKey('api.themoviedb.org', process.env.TMDB_API_KEY)
      console.log('[ApiProviderService] ✅ TMDb API key loaded from environment')
    }
    if (process.env.TVDB_API_KEY) {
      this.setApiKey('api.thetvdb.com', process.env.TVDB_API_KEY)
      console.log('[ApiProviderService] ✅ TVDb API key loaded from environment')
    }
    if (process.env.TRAKT_API_KEY) {
      this.setApiKey('api.trakt.tv', process.env.TRAKT_API_KEY)
      console.log('[ApiProviderService] ✅ Trakt API key loaded from environment')
    }

    // Debrid services
    if (process.env.REAL_DEBRID_API_KEY) {
      this.setApiKey('api.real-debrid.com', process.env.REAL_DEBRID_API_KEY)
      console.log('[ApiProviderService] ✅ Real-Debrid API key loaded from environment')
    }
    if (process.env.ALLDEBRID_API_KEY) {
      this.setApiKey('api.alldebrid.com', process.env.ALLDEBRID_API_KEY)
      console.log('[ApiProviderService] ✅ AllDebrid API key loaded from environment')
    }
    if (process.env.PREMIUMIZE_API_KEY) {
      this.setApiKey('www.premiumize.me', process.env.PREMIUMIZE_API_KEY)
      console.log('[ApiProviderService] ✅ Premiumize API key loaded from environment')
    }

    // Prowlarr (Torrent indexer aggregator)
    if (process.env.PROWLARR_API_KEY) {
      this.setApiKey('localhost:9696', process.env.PROWLARR_API_KEY)
      console.log('[ApiProviderService] ✅ Prowlarr API key loaded from environment')
    }

    // Log configuration status
    const configured = Array.from(this.providers.values()).filter(p => p.apiKey || !p.requiresAuth).length
    const total = this.providers.size
    console.log(`[ApiProviderService] 📊 ${configured}/${total} providers configured`)
  }

  /**
   * Set browser pool for Puppeteer-based scraping
   */
  setBrowserPool(browserPool: BrowserPool): void {
    this.browserPool = browserPool
    console.log('[ApiProviderService] 🌐 Browser pool configured for torrent scraping')
  }

  /**
   * Initialize discovered API providers from M3U8 analysis
   */
  private initializeProviders(): void {
    // Metadata APIs
    this.registerProvider({
      name: 'TMDb',
      hostname: 'api.themoviedb.org',
      type: 'metadata',
      requiresAuth: true,
      rateLimitPerMinute: 40,
      baseUrl: 'https://api.themoviedb.org/3',
    })

    this.registerProvider({
      name: 'TVDb',
      hostname: 'api.thetvdb.com',
      type: 'metadata',
      requiresAuth: true,
      rateLimitPerMinute: 30,
      baseUrl: 'https://api.thetvdb.com',
    })

    this.registerProvider({
      name: 'Trakt',
      hostname: 'api.trakt.tv',
      type: 'metadata',
      requiresAuth: true,
      rateLimitPerMinute: 60,
      baseUrl: 'https://api.trakt.tv',
    })

    this.registerProvider({
      name: 'TVMaze',
      hostname: 'api.tvmaze.com',
      type: 'metadata',
      requiresAuth: false,
      rateLimitPerMinute: 20,
      baseUrl: 'https://api.tvmaze.com',
    })

    // Debrid Services
    this.registerProvider({
      name: 'Real-Debrid',
      hostname: 'api.real-debrid.com',
      type: 'debrid',
      requiresAuth: true,
      rateLimitPerMinute: 60,
      baseUrl: 'https://api.real-debrid.com/rest/1.0',
    })

    this.registerProvider({
      name: 'AllDebrid',
      hostname: 'api.alldebrid.com',
      type: 'debrid',
      requiresAuth: true,
      rateLimitPerMinute: 60,
      baseUrl: 'https://api.alldebrid.com/v4',
    })

    this.registerProvider({
      name: 'Premiumize',
      hostname: 'www.premiumize.me',
      type: 'debrid',
      requiresAuth: true,
      rateLimitPerMinute: 100,
      baseUrl: 'https://www.premiumize.me/api',
    })

    // Torrent Databases
    this.registerProvider({
      name: 'BTDb.eu',
      hostname: 'btdb.eu',
      type: 'torrent-db',
      requiresAuth: false,
      baseUrl: 'https://btdb.eu',
    })

    this.registerProvider({
      name: 'BTDb.io',
      hostname: 'btdb.io',
      type: 'torrent-db',
      requiresAuth: false,
      baseUrl: 'https://btdb.io',
    })

    this.registerProvider({
      name: 'TorrentsDB',
      hostname: 'torrentsdb.com',
      type: 'torrent-db',
      requiresAuth: false,
      baseUrl: 'https://torrentsdb.com',
    })

    this.registerProvider({
      name: '1337x',
      hostname: '1337x.to',
      type: 'torrent-db',
      requiresAuth: false,
      baseUrl: 'https://1337x.to',
    })

    this.registerProvider({
      name: 'TorrentAPI',
      hostname: 'torrentapi.org',
      type: 'torrent-db',
      requiresAuth: false,
      baseUrl: 'https://torrentapi.org',
    })

    this.registerProvider({
      name: 'YTS',
      hostname: 'yts.mx',
      type: 'torrent-db',
      requiresAuth: false,
      baseUrl: 'https://yts.mx',
    })

    // Prowlarr (torrent indexer aggregator)
    this.registerProvider({
      name: 'Prowlarr',
      hostname: 'localhost:9696',
      type: 'torrent-db',
      requiresAuth: true,
      rateLimitPerMinute: 120,
      baseUrl: process.env.PROWLARR_URL || 'http://localhost:9696',
    })

    // Load API keys from environment
    this.loadApiKeysFromEnv()
  }

  /**
   * Register an API provider
   */
  registerProvider(provider: ApiProvider): void {
    this.providers.set(provider.hostname, provider)

    // Create axios instance with rate limiting
    const instance = axios.create({
      baseURL: provider.baseUrl,
      timeout: 15000,
      headers: {
        'User-Agent': 'MediaLinkExtractor/1.0',
        'Accept': 'application/json',
      },
    })

    // Add rate limiting interceptor
    instance.interceptors.request.use(async (config) => {
      await this.waitForRateLimit(provider.hostname, provider.rateLimitPerMinute)
      return config
    })

    this.axiosInstances.set(provider.hostname, instance)
  }

  /**
   * Set API key for a provider
   */
  setApiKey(hostname: string, apiKey: string): void {
    const provider = this.providers.get(hostname)
    if (provider) {
      provider.apiKey = apiKey
    }
  }

  /**
   * Get provider by hostname
   */
  getProvider(hostname: string): ApiProvider | undefined {
    return this.providers.get(hostname)
  }

  /**
   * Get all providers by type
   */
  getProvidersByType(type: ApiProviderType): ApiProvider[] {
    return Array.from(this.providers.values()).filter(p => p.type === type)
  }

  /**
   * Wait for rate limit before making request
   */
  private async waitForRateLimit(hostname: string, rateLimitPerMinute?: number): Promise<void> {
    if (!rateLimitPerMinute) return

    const now = Date.now()
    const window = 60000 // 1 minute
    
    let requests = this.requestCounts.get(hostname) || []
    requests = requests.filter(timestamp => now - timestamp < window)

    if (requests.length >= rateLimitPerMinute) {
      const oldestRequest = requests[0]
      const waitTime = window - (now - oldestRequest)
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    requests.push(now)
    this.requestCounts.set(hostname, requests)
  }

  /**
   * Make authenticated request to provider
   */
  async makeRequest(
    hostname: string,
    endpoint: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
      params?: Record<string, any>
      data?: any
      headers?: Record<string, string>
    }
  ): Promise<any> {
    const provider = this.providers.get(hostname)
    if (!provider) {
      throw new Error(`Provider not found: ${hostname}`)
    }

    const instance = this.axiosInstances.get(hostname)
    if (!instance) {
      throw new Error(`Axios instance not found: ${hostname}`)
    }

    // Add authentication
    const headers = { ...options?.headers }
    const params = { ...options?.params }
    
    if (provider.requiresAuth && provider.apiKey) {
      if (provider.name === 'TMDb') {
        // TMDb uses api_key query parameter, not Bearer token
        params['api_key'] = provider.apiKey
      } else if (provider.name === 'Real-Debrid' || provider.name === 'AllDebrid') {
        headers['Authorization'] = `Bearer ${provider.apiKey}`
      } else if (provider.name === 'TVDb') {
        headers['Authorization'] = `Bearer ${provider.apiKey}`
      } else if (provider.name === 'Trakt') {
        headers['trakt-api-key'] = provider.apiKey
      }
    }

    // Real-Debrid requires application/x-www-form-urlencoded for POST requests
    const isRd = (provider.name === 'Real-Debrid' || provider.name === 'AllDebrid')
    const isRdPost = isRd && (options?.method === 'POST' || options?.method === 'PUT')
    let requestData = options?.data
    if (isRdPost && requestData && typeof requestData === 'object') {
      requestData = new URLSearchParams(requestData as Record<string, string>).toString()
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }

    // Retry with backoff on RD 429 rate-limits (POST only — GETs in polling loops should not retry)
    const maxAttempts = isRdPost ? 4 : 1
    let lastError: any
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await instance.request({
          method: options?.method || 'GET',
          url: endpoint,
          params,
          data: requestData,
          headers,
        })
        return response.data
      } catch (error: any) {
        lastError = error
        const status = error?.response?.status
        if (isRd && status === 429 && attempt < maxAttempts) {
          const retryAfter = parseInt(error.response?.headers?.['retry-after'] ?? '0', 10)
          const waitMs = retryAfter > 0 ? retryAfter * 1000 : attempt * 3000
          console.warn(`[ApiProviderService] RD rate-limited (429), retrying in ${waitMs}ms (attempt ${attempt}/${maxAttempts})`)
          await new Promise(r => setTimeout(r, waitMs))
          continue
        }
        console.error(`[ApiProviderService] Error calling ${hostname}${endpoint}:`, error)
        throw error
      }
    }
    throw lastError
  }

  /**
   * Search for media across metadata providers
   */
  async searchMedia(
    query: string,
    type?: 'movie' | 'series'
  ): Promise<MediaSearchResult[]> {
    const results: MediaSearchResult[] = []
    const metadataProviders = this.getProvidersByType('metadata')

    for (const provider of metadataProviders) {
      try {
        if (provider.name === 'TMDb') {
          const tmdbResults = await this.searchTMDb(query, type)
          results.push(...tmdbResults)
        } else if (provider.name === 'TVMaze') {
          const tvmazeResults = await this.searchTVMaze(query)
          results.push(...tvmazeResults)
        }
        // Add more providers as needed
      } catch (error) {
        console.warn(`[ApiProviderService] Failed to search ${provider.name}:`, error)
      }
    }

    // Deduplicate by title and year
    return this.deduplicateMediaResults(results)
  }

  /**
   * Search torrents across torrent databases
   */
  async searchTorrents(query: string): Promise<TorrentSearchResult[]> {
    const results: TorrentSearchResult[] = []
    const torrentProviders = this.getProvidersByType('torrent-db')

    // Try Prowlarr first if configured (it aggregates multiple indexers)
    // TEMPORARILY DISABLED: Prowlarr search times out with 10 indexers
    // const prowlarrProvider = torrentProviders.find(p => p.name === 'Prowlarr')
    // if (prowlarrProvider?.apiKey) {
    //   try {
    //     console.log('[ApiProviderService] Using Prowlarr for torrent search')
    //     const torrents = await this.searchProwlarr(query)
    //     if (torrents.length > 0) {
    //       console.log(`[ApiProviderService] Prowlarr found ${torrents.length} torrents`)
    //       return torrents // Return Prowlarr results exclusively if available
    //     }
    //   } catch (error) {
    //     console.warn('[ApiProviderService] Prowlarr search failed, falling back to direct scrapers:', error)
    //   }
    // }

    // Fall back to direct scraping if Prowlarr not configured or failed
    for (const provider of torrentProviders) {
      try {
        if (provider.name === 'Prowlarr') {
          continue // Already tried above
        } else if (provider.name === 'BTDb.eu' || provider.name === 'BTDb.io') {
          const torrents = await this.searchBTDb(query, provider.baseUrl)
          results.push(...torrents)
        } else if (provider.name === '1337x') {
          const torrents = await this.search1337x(query)
          results.push(...torrents)
        } else if (provider.name === 'TorrentAPI') {
          const torrents = await this.searchTorrentAPI(query)
          results.push(...torrents)
        } else if (provider.name === 'YTS') {
          const torrents = await this.searchYTS(query)
          results.push(...torrents)
        }
      } catch (error) {
        console.warn(`[ApiProviderService] Failed to search ${provider.name}:`, error)
      }
    }

    return results
  }

  /**
   * Resolve magnet link through debrid service
   */
  async resolveDebridStream(
    magnetUrl: string,
    preferredService?: 'real-debrid' | 'alldebrid' | 'premiumize'
  ): Promise<DebridStreamResult | null> {
    const debridProviders = this.getProvidersByType('debrid')
    const provider = preferredService
      ? debridProviders.find(p => p.name.toLowerCase().includes(preferredService))
      : debridProviders[0]

    if (!provider || !provider.apiKey) {
      console.warn('[ApiProviderService] No debrid service configured')
      return null
    }

    try {
      if (provider.name === 'Real-Debrid') {
        return await this.resolveRealDebrid(magnetUrl)
      } else if (provider.name === 'AllDebrid') {
        return await this.resolveAllDebrid(magnetUrl)
      }
    } catch (error) {
      console.error(`[ApiProviderService] Failed to resolve with ${provider.name}:`, error)
    }

    return null
  }

  // ==================== TMDb Implementation ====================

  private async searchTMDb(query: string, type?: 'movie' | 'series'): Promise<MediaSearchResult[]> {
    const results: MediaSearchResult[] = []
    const provider = this.getProvider('api.themoviedb.org')
    if (!provider?.apiKey) return results

    try {
      if (!type || type === 'movie') {
        const data = await this.makeRequest('api.themoviedb.org', '/search/movie', {
          params: { query, language: 'en-US' },
        })
        
        for (const item of data.results || []) {
          results.push({
            id: `tmdb-movie-${item.id}`,
            title: item.title,
            type: 'movie',
            year: item.release_date ? new Date(item.release_date).getFullYear() : undefined,
            posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
            backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : undefined,
            overview: item.overview,
            rating: item.vote_average,
            externalIds: { tmdb: item.id.toString() },
          })
        }
      }

      if (!type || type === 'series') {
        const data = await this.makeRequest('api.themoviedb.org', '/search/tv', {
          params: { query, language: 'en-US' },
        })

        for (const item of data.results || []) {
          results.push({
            id: `tmdb-series-${item.id}`,
            title: item.name,
            type: 'series',
            year: item.first_air_date ? new Date(item.first_air_date).getFullYear() : undefined,
            posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
            backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : undefined,
            overview: item.overview,
            rating: item.vote_average,
            externalIds: { tmdb: item.id.toString() },
          })
        }
      }
    } catch (error) {
      console.error('[ApiProviderService] TMDb search error:', error)
    }

    return results
  }

  // ==================== TVMaze Implementation ====================

  private async searchTVMaze(query: string): Promise<MediaSearchResult[]> {
    const results: MediaSearchResult[] = []

    try {
      const data = await this.makeRequest('api.tvmaze.com', '/search/shows', {
        params: { q: query },
      })

      for (const item of data || []) {
        const show = item.show
        if (!show) continue

        results.push({
          id: `tvmaze-${show.id}`,
          title: show.name,
          type: 'series',
          year: show.premiered ? new Date(show.premiered).getFullYear() : undefined,
          posterUrl: show.image?.medium,
          backdropUrl: show.image?.original,
          overview: show.summary?.replace(/<[^>]*>/g, ''), // Strip HTML
          genres: show.genres,
          rating: show.rating?.average,
          externalIds: {
            imdb: show.externals?.imdb,
            tvdb: show.externals?.thetvdb?.toString(),
          },
        })
      }
    } catch (error) {
      console.error('[ApiProviderService] TVMaze search error:', error)
    }

    return results
  }

  // ==================== BTDb Implementation ====================

  private async searchBTDb(query: string, baseUrl: string): Promise<TorrentSearchResult[]> {
    const results: TorrentSearchResult[] = []

    try {
      if (this.browserPool) {
        // Use Puppeteer for JavaScript-rendered pages
        return await this.searchBTDbWithPuppeteer(query, baseUrl)
      }

      // Fallback to axios + cheerio for static HTML
      const searchUrl = `${baseUrl}/q/${encodeURIComponent(query)}/`
      console.log(`[ApiProviderService] Searching BTDb: ${searchUrl}`)
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 15000,
        maxRedirects: 5,
      })

      const $ = cheerio.load(response.data)
      
      // BTDb.io structure: look for torrent items
      $('.item').each((i, element) => {
        try {
          const $elem = $(element)
          const titleElem = $elem.find('.item-title a')
          const name = titleElem.text().trim()
          const magnetLink = $elem.find('a[href^="magnet:"]').attr('href')
          
          if (name && magnetLink) {
            const hashMatch = magnetLink.match(/btih:([a-f0-9]{40})/i)
            if (hashMatch) {
              const infoHash = hashMatch[1].toLowerCase()
              
              // Extract size and seeders if available
              const sizeText = $elem.find('.item-size').text().trim()
              const size = this.parseSizeToBytes(sizeText)
              
              results.push({
                name,
                infoHash,
                magnetUrl: magnetLink,
                size,
                seeders: 0,
                leechers: 0,
                source: baseUrl,
              })
            }
          }
        } catch (err) {
          console.warn('[ApiProviderService] Failed to parse torrent item:', err)
        }
      })

      console.log(`[ApiProviderService] Found ${results.length} torrents from ${baseUrl}`)
    } catch (error: any) {
      console.error(`[ApiProviderService] BTDb search error for ${baseUrl}:`, error.message)
    }

    return results
  }

  private async searchBTDbWithPuppeteer(query: string, baseUrl: string): Promise<TorrentSearchResult[]> {
    const results: TorrentSearchResult[] = []
    if (!this.browserPool) return results

    let page = null
    try {
      const searchUrl = `${baseUrl}/q/${encodeURIComponent(query)}/`
      console.log(`[ApiProviderService] Puppeteer search: ${searchUrl}`)
      
      page = await this.browserPool.getPage()
      
      // Navigate and wait for fingerprint redirect
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
      
      // Wait for potential redirects and content to load (Puppeteer v23+ compatible)
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Try different selectors for BTDb
      const selectors = ['.item', '.search-result', '.torrent-item', 'tr.row', 'div[class*="result"]']
      let foundResults = false
      
      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 })
          foundResults = true
          console.log(`[ApiProviderService] Found elements with selector: ${selector}`)
          break
        } catch (e) {
          // Try next selector
        }
      }
      
      const html = await page.content()
      const $ = cheerio.load(html)
      
      // Try multiple parsing strategies
      // Strategy 1: .item class (BTDb modern)
      $('.item').each((i, element) => {
        try {
          const $elem = $(element)
          const titleElem = $elem.find('.item-title a, .torrent-name, a.title')
          const name = titleElem.text().trim()
          const magnetLink = $elem.find('a[href^="magnet:"]').attr('href')
          
          if (name && magnetLink) {
            const hashMatch = magnetLink.match(/btih:([a-f0-9]{40})/i)
            if (hashMatch) {
              const infoHash = hashMatch[1].toLowerCase()
              const sizeText = $elem.find('.item-size, .size, .torrent-size').text().trim()
              const size = this.parseSizeToBytes(sizeText)
              
              results.push({
                name,
                infoHash,
                magnetUrl: magnetLink,
                size,
                seeders: 0,
                leechers: 0,
                source: baseUrl,
              })
            }
          }
        } catch (err) {
          console.warn('[ApiProviderService] Failed to parse item:', err)
        }
      })
      
      // Strategy 2: Table rows
      if (results.length === 0) {
        $('tr.row, tr[class*="torrent"]').each((i, element) => {
          try {
            const $elem = $(element)
            const titleElem = $elem.find('a[href*="/torrent/"], a.torrent-name')
            const name = titleElem.text().trim()
            const magnetLink = $elem.find('a[href^="magnet:"]').attr('href')
            
            if (name && magnetLink) {
              const hashMatch = magnetLink.match(/btih:([a-f0-9]{40})/i)
              if (hashMatch) {
                results.push({
                  name,
                  infoHash: hashMatch[1].toLowerCase(),
                  magnetUrl: magnetLink,
                  size: 0,
                  seeders: 0,
                  leechers: 0,
                  source: baseUrl,
                })
              }
            }
          } catch (err) {
            console.warn('[ApiProviderService] Failed to parse row:', err)
          }
        })
      }
      
      // Strategy 3: Any magnet links
      if (results.length === 0) {
        $('a[href^="magnet:"]').each((i, element) => {
          try {
            const magnetLink = $(element).attr('href')
            if (!magnetLink) return
            
            const hashMatch = magnetLink.match(/btih:([a-f0-9]{40})/i)
            if (!hashMatch) return
            
            // Try to find name nearby
            const $parent = $(element).closest('div, tr, li')
            const name = $parent.find('a[href*="/torrent/"]').first().text().trim() || 
                        $parent.text().replace(/magnet.*/i, '').trim().slice(0, 100) ||
                        `Torrent ${hashMatch[1].slice(0, 8)}`
            
            results.push({
              name,
              infoHash: hashMatch[1].toLowerCase(),
              magnetUrl: magnetLink,
              size: 0,
              seeders: 0,
              leechers: 0,
              source: baseUrl,
            })
          } catch (err) {
            // ignore
          }
        })
      }

      console.log(`[ApiProviderService] Puppeteer found ${results.length} torrents from ${baseUrl}`)
      
      // Log HTML structure if no results for debugging
      if (results.length === 0) {
        const bodySnippet = $('body').html()?.slice(0, 500) || 'empty'
        console.log(`[ApiProviderService] No results. HTML snippet: ${bodySnippet}`)
      }
    } catch (error: any) {
      console.error(`[ApiProviderService] Puppeteer BTDb error:`, error.message)
    } finally {
      if (page) {
        await this.browserPool.releasePage(page)
      }
    }

    return results
  }

  private parseSizeToBytes(sizeText: string): number {
    if (!sizeText) return 0
    
    const match = sizeText.match(/([0-9.]+)\s*(GB|MB|KB|TB)/i)
    if (!match) return 0
    
    const value = parseFloat(match[1])
    const unit = match[2].toUpperCase()
    
    const multipliers: Record<string, number> = {
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024,
    }
    
    return Math.floor(value * (multipliers[unit] || 0))
  }

  // ==================== 1337x Implementation ====================

  private async search1337x(query: string): Promise<TorrentSearchResult[]> {
    const results: TorrentSearchResult[] = []
    if (!this.browserPool) {
      console.log('[ApiProviderService] No browser pool available for 1337x scraping')
      return results
    }

    let page = null
    try {
      const searchUrl = `https://1337x.to/search/${encodeURIComponent(query)}/1/`
      console.log(`[ApiProviderService] 1337x search: ${searchUrl}`)
      
      page = await this.browserPool.getPage()
      
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
      
      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const html = await page.content()
      const $ = cheerio.load(html)
      
      // 1337x uses table structure: .table-list tbody tr
      $('table.table-list tbody tr').each((i, element) => {
        try {
          const $row = $(element)
          
          // Get torrent name from first column link
          const nameLink = $row.find('td.coll-1 a:nth-of-type(2)')
          const name = nameLink.text().trim()
          const detailUrl = nameLink.attr('href')
          
          if (!name || !detailUrl) return
          
          // Get seeders and leechers
          const seedersText = $row.find('td.coll-2').text().trim()
          const leechersText = $row.find('td.coll-3').text().trim()
          const sizeText = $row.find('td.coll-4').text().trim()
          
          const seeders = parseInt(seedersText) || 0
          const leechers = parseInt(leechersText) || 0
          const size = this.parseSizeToBytes(sizeText)
          
          // We'll need to visit detail page to get magnet link
          // For now, construct a placeholder that can be resolved later
          // In production, you'd make a second request to get the magnet
          const infoHash = detailUrl.split('/').filter(Boolean).pop() || ''
          
          if (name && infoHash) {
            results.push({
              name,
              infoHash: infoHash.padEnd(40, '0'), // Placeholder until we fetch actual magnet
              magnetUrl: `https://1337x.to${detailUrl}`, // Store detail URL for now
              size,
              seeders,
              leechers,
              source: '1337x.to',
            })
          }
        } catch (err) {
          console.warn('[ApiProviderService] Failed to parse 1337x row:', err)
        }
      })
      
      console.log(`[ApiProviderService] Found ${results.length} torrents from 1337x`)
      
      if (results.length === 0) {
        const bodySnippet = $('body').html()?.slice(0, 500)
        console.log(`[ApiProviderService] No results from 1337x. HTML snippet:`, bodySnippet)
      }
    } catch (error: any) {
      console.error(`[ApiProviderService] 1337x search error:`, error.message)
    } finally {
      if (page) {
        await this.browserPool.releasePage(page)
      }
    }

    return results
  }

  // ==================== TorrentAPI (RARBG) Implementation ====================

  private torrentApiToken: string | null = null
  private torrentApiTokenExpiry: number = 0

  private async getTorrentAPIToken(): Promise<string | null> {
    try {
      // Check if token is still valid (tokens last 15 minutes)
      if (this.torrentApiToken && Date.now() < this.torrentApiTokenExpiry) {
        return this.torrentApiToken
      }

      // Get new token
      const response = await axios.get('https://torrentapi.org/pubapi_v2.php', {
        params: {
          get_token: 'get_token',
          app_id: 'MediaLinkExtractor',
        },
        timeout: 10000,
      })

      if (response.data?.token) {
        this.torrentApiToken = response.data.token
        this.torrentApiTokenExpiry = Date.now() + (14 * 60 * 1000) // 14 minutes
        console.log('[ApiProviderService] ✅ TorrentAPI token obtained')
        return this.torrentApiToken
      }
    } catch (error) {
      console.error('[ApiProviderService] Failed to get TorrentAPI token:', error)
    }
    return null
  }

  private async searchTorrentAPI(query: string): Promise<TorrentSearchResult[]> {
    const results: TorrentSearchResult[] = []

    try {
      const token = await this.getTorrentAPIToken()
      if (!token) {
        console.log('[ApiProviderService] No TorrentAPI token available')
        return results
      }

      // Wait 2 seconds between requests (API requirement)
      await new Promise(resolve => setTimeout(resolve, 2100))

      console.log(`[ApiProviderService] TorrentAPI search: ${query}`)

      const response = await axios.get('https://torrentapi.org/pubapi_v2.php', {
        params: {
          mode: 'search',
          search_string: query,
          token: token,
          format: 'json_extended',
          app_id: 'MediaLinkExtractor',
          limit: 25,
        },
        timeout: 15000,
      })

      const torrents = response.data?.torrent_results || []

      for (const torrent of torrents) {
        const magnetUrl = torrent.download
        if (!magnetUrl) continue

        const hashMatch = magnetUrl.match(/btih:([a-f0-9]{40})/i)
        if (!hashMatch) continue

        results.push({
          name: torrent.title || torrent.filename || 'Unknown',
          infoHash: hashMatch[1].toLowerCase(),
          magnetUrl: magnetUrl,
          size: torrent.size || 0,
          seeders: torrent.seeders || 0,
          leechers: torrent.leechers || 0,
          source: 'torrentapi.org',
          addedDate: torrent.pubdate ? new Date(torrent.pubdate) : undefined,
        })
      }

      console.log(`[ApiProviderService] Found ${results.length} torrents from TorrentAPI`)
    } catch (error: any) {
      if (error.response?.data?.error_code === 20) {
        console.log('[ApiProviderService] TorrentAPI: No results found')
      } else {
        console.error('[ApiProviderService] TorrentAPI search error:', error.message)
      }
    }

    return results
  }

  // ==================== YTS Implementation ====================

  private async searchYTS(query: string): Promise<TorrentSearchResult[]> {
    const results: TorrentSearchResult[] = []

    try {
      console.log(`[ApiProviderService] YTS search: ${query}`)

      const response = await axios.get('https://yts.mx/api/v2/list_movies.json', {
        params: {
          query_term: query,
          limit: 20,
          sort_by: 'seeds',
          order_by: 'desc',
        },
        timeout: 15000,
        headers: {
          'User-Agent': 'MediaLinkExtractor/1.0',
        },
      })

      const movies = response.data?.data?.movies || []

      for (const movie of movies) {
        const torrents = movie.torrents || []
        
        for (const torrent of torrents) {
          if (!torrent.hash) continue

          // Build magnet URL from hash
          const trackers = [
            'udp://open.demonii.com:1337/announce',
            'udp://tracker.openbittorrent.com:80',
            'udp://tracker.coppersurfer.tk:6969',
            'udp://glotorrents.pw:6969/announce',
            'udp://tracker.opentrackr.org:1337/announce',
          ]
          const trackerString = trackers.map(t => `&tr=${encodeURIComponent(t)}`).join('')
          const magnetUrl = `magnet:?xt=urn:btih:${torrent.hash}${trackerString}&dn=${encodeURIComponent(movie.title_long)}`

          results.push({
            name: `${movie.title_long} [${torrent.quality}] [${torrent.type}]`,
            infoHash: torrent.hash.toLowerCase(),
            magnetUrl: magnetUrl,
            size: parseInt(torrent.size_bytes) || 0,
            seeders: torrent.seeds || 0,
            leechers: torrent.peers || 0,
            source: 'yts.mx',
            addedDate: movie.date_uploaded ? new Date(movie.date_uploaded) : undefined,
          })
        }
      }

      console.log(`[ApiProviderService] Found ${results.length} torrents from YTS`)
    } catch (error: any) {
      console.error('[ApiProviderService] YTS search error:', error.message)
    }

    return results
  }

  /**
   * Search Prowlarr (torrent indexer aggregator)
   * Prowlarr aggregates multiple torrent indexers into a single API
   */
  private async searchProwlarr(query: string): Promise<TorrentSearchResult[]> {
    const results: TorrentSearchResult[] = []
    const provider = this.providers.get('localhost:9696')

    if (!provider?.apiKey) {
      console.warn('[ApiProviderService] Prowlarr API key not configured')
      return results
    }

    try {
      console.log(`[ApiProviderService] Prowlarr search: ${query}`)

      // Prepare headers
      const headers: any = {
        'X-Api-Key': provider.apiKey,
        'User-Agent': 'MediaLinkExtractor/1.0',
      }

      // Add basic auth if credentials are configured
      const username = process.env.PROWLARR_USERNAME
      const password = process.env.PROWLARR_PASSWORD
      if (username && password) {
        const credentials = Buffer.from(`${username}:${password}`).toString('base64')
        headers['Authorization'] = `Basic ${credentials}`
      }

      const response = await axios.get(`${provider.baseUrl}/api/v1/search`, {
        params: {
          query: query,
          type: 'search',
        },
        headers,
        timeout: 60000,  // Increased to 60 seconds for multi-indexer searches
      })

      const items = Array.isArray(response.data) ? response.data : []

      for (const item of items) {
        // Extract info hash from magnet link or GUID
        let infoHash = ''
        const magnetUrl = item.magnetUrl || item.downloadUrl
        
        if (magnetUrl && magnetUrl.includes('magnet:?')) {
          const hashMatch = magnetUrl.match(/btih:([a-f0-9]{40})/i)
          if (hashMatch) {
            infoHash = hashMatch[1].toLowerCase()
          }
        }

        if (!infoHash) continue

        results.push({
          name: item.title || 'Unknown',
          infoHash: infoHash,
          magnetUrl: magnetUrl,
          size: item.size || 0,
          seeders: item.seeders || 0,
          leechers: item.leechers || item.peers || 0,
          source: item.indexer || 'prowlarr',
          addedDate: item.publishDate ? new Date(item.publishDate) : undefined,
        })
      }

      console.log(`[ApiProviderService] Found ${results.length} torrents from Prowlarr`)
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        console.error('[ApiProviderService] Prowlarr not running - is it installed and started?')
      } else if (error.response?.status === 401) {
        console.error('[ApiProviderService] Prowlarr API key invalid')
      } else {
        console.error('[ApiProviderService] Prowlarr search error:', error.message)
      }
    }

    return results
  }

  // ==================== Real-Debrid Implementation ====================

  /** Verify RD API key and return user account info */
  async getRealDebridUser(): Promise<{ username: string; email: string; expiration: string; premium: number; type: string } | null> {
    try {
      const data = await this.makeRequest('api.real-debrid.com', '/user')
      return {
        username: data.username,
        email: data.email,
        expiration: data.expiration,
        premium: data.premium,
        type: data.type,
      }
    } catch {
      return null
    }
  }

  /** Unrestrict a direct hosters link (not a magnet) — e.g. a Rapidgator/Filelocker URL */
  async unrestrictLink(link: string): Promise<DebridStreamResult | null> {
    const provider = this.getProvider('api.real-debrid.com')
    if (!provider?.apiKey) return null
    try {
      const data = await this.makeRequest('api.real-debrid.com', '/unrestrict/link', {
        method: 'POST',
        data: { link },
      })
      if (!data?.download) {
        console.warn('[RealDebrid] unrestrictLink: no download URL in response', data)
        return null
      }
      return {
        streamUrl: data.download,
        quality: data.quality || 'unknown',
        fileSize: data.filesize || 0,
        filename: data.filename || 'stream',
        cached: false,
      }
    } catch (err: any) {
      const rdMsg = err?.response?.data?.error_code
        ? `RD error ${err.response.data.error_code}: ${err.response.data.error}`
        : String(err?.message ?? err)
      console.warn('[RealDebrid] unrestrictLink failed:', rdMsg)
      return null
    }
  }

  /**
   * Download a .torrent file from a URL and add it to Real-Debrid.
   * Polls until the torrent is downloaded, then returns a streamable direct URL.
   * Used by the automation pipeline for Prowlarr proxy download links.
   */
  async addTorrentFile(torrentUrl: string): Promise<DebridStreamResult | null> {
    const provider = this.getProvider('api.real-debrid.com')
    if (!provider?.apiKey) return null
    try {
      // Step 1: Download the .torrent file bytes
      const torrentResponse = await axios.get(torrentUrl, {
        responseType: 'arraybuffer',
        timeout: 20000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ArchivistSILAS/1.0)' },
        maxRedirects: 10,
      })
      const torrentBytes = Buffer.from(torrentResponse.data)

      // Step 2: Upload torrent to RD via multipart/form-data (native Node 18+ FormData)
      const form = new FormData()
      form.append('torrent', new Blob([torrentBytes], { type: 'application/x-bittorrent' }), 'file.torrent')

      const addResponse = await axios.post(
        'https://api.real-debrid.com/rest/1.0/torrents/addTorrent',
        form,
        {
          headers: { 'Authorization': `Bearer ${provider.apiKey}` },
          timeout: 20000,
        }
      )
      const torrentId: string = addResponse.data?.id
      if (!torrentId) {
        console.warn('[RealDebrid] addTorrentFile: no torrent ID returned', addResponse.data)
        return null
      }
      console.log(`[RealDebrid] addTorrentFile: torrent added, id=${torrentId}`)

      // Step 3: Select all files
      await axios.post(
        `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`,
        new URLSearchParams({ files: 'all' }).toString(),
        {
          headers: {
            'Authorization': `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        }
      )

      // Step 4: Poll until downloaded (30 attempts × 10s = 5 mins max)
      let torrentInfo: any = null
      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise(r => setTimeout(r, 10000))
        torrentInfo = await this.makeRequest('api.real-debrid.com', `/torrents/info/${torrentId}`)
        const st = torrentInfo.status as string
        console.log(`[RealDebrid] addTorrentFile: poll ${attempt + 1}/30 status=${st}`)
        if (st === 'downloaded') break
        if (['error', 'magnet_error', 'dead', 'virus'].includes(st)) {
          console.warn(`[RealDebrid] addTorrentFile: torrent ${torrentId} terminal status: ${st}`)
          return null
        }
      }

      if (!torrentInfo || torrentInfo.status !== 'downloaded') {
        console.warn(`[RealDebrid] addTorrentFile: torrent ${torrentId} not downloaded after polling (${torrentInfo?.status})`)
        return null
      }

      // Step 5: Find best video link, then unrestrict
      const videoLink: string | undefined =
        torrentInfo.links?.find((l: string) => /\.(mp4|mkv|avi|mov|ts|m2ts|webm)$/i.test(l)) ??
        torrentInfo.links?.[0]

      if (!videoLink) {
        console.warn('[RealDebrid] addTorrentFile: no links in torrent info')
        return null
      }

      const unrestrictData = await this.makeRequest('api.real-debrid.com', '/unrestrict/link', {
        method: 'POST',
        data: { link: videoLink },
      })

      console.log(`[RealDebrid] addTorrentFile: resolved → ${unrestrictData.download}`)
      return {
        streamUrl: unrestrictData.download,
        quality:   unrestrictData.quality   || 'unknown',
        fileSize:  unrestrictData.filesize  || torrentInfo.bytes || 0,
        filename:  unrestrictData.filename  || torrentInfo.filename || 'stream',
        cached:    true,
      }
    } catch (err: any) {
      const detail = err?.response?.data ? JSON.stringify(err.response.data) : err?.message
      console.warn('[RealDebrid] addTorrentFile failed:', detail)
      return null
    }
  }

  /** List active RD torrents */
  async getRealDebridTorrents(): Promise<any[]> {
    try {
      return await this.makeRequest('api.real-debrid.com', '/torrents')
    } catch {
      return []
    }
  }

  private async resolveRealDebrid(magnetUrl: string): Promise<DebridStreamResult | null> {
    try {
      // Add magnet to Real-Debrid
      const addResponse = await this.makeRequest('api.real-debrid.com', '/torrents/addMagnet', {
        method: 'POST',
        data: { magnet: magnetUrl },
      })

      const torrentId = addResponse.id
      if (!torrentId) return null

      // Select all files
      await this.makeRequest('api.real-debrid.com', `/torrents/selectFiles/${torrentId}`, {
        method: 'POST',
        data: { files: 'all' },
      })

      // Poll until downloaded (max 5 mins, 10s intervals — allows RD time to cache from seeders)
      let torrentInfo: any = null
      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise(r => setTimeout(r, 10000))
        torrentInfo = await this.makeRequest('api.real-debrid.com', `/torrents/info/${torrentId}`)
        const st = torrentInfo.status as string
        console.log(`[RealDebrid] torrent ${torrentId} status: ${st} (poll ${attempt + 1}/30)`)
        if (st === 'downloaded') break
        if (['error', 'magnet_error', 'dead', 'virus'].includes(st)) {
          console.warn(`[RealDebrid] torrent ${torrentId} terminal status: ${st}`)
          return null
        }
      }

      if (!torrentInfo || torrentInfo.status !== 'downloaded') {
        console.warn(`[RealDebrid] torrent ${torrentId} not downloaded after polling (status: ${torrentInfo?.status})`)
        return null
      }

      // Prefer video link, fall back to first link
      const videoLink: string | undefined =
        torrentInfo.links?.find((l: string) => /\.(mp4|mkv|avi|mov|ts|m2ts)$/i.test(l)) ??
        torrentInfo.links?.[0]

      if (!videoLink) return null

      const unrestrictResponse = await this.makeRequest('api.real-debrid.com', '/unrestrict/link', {
        method: 'POST',
        data: { link: videoLink },
      })

      return {
        streamUrl: unrestrictResponse.download,
        quality: unrestrictResponse.quality || 'unknown',
        fileSize: unrestrictResponse.filesize || 0,
        filename: unrestrictResponse.filename || 'stream',
        cached: torrentInfo.status === 'downloaded',
      }
    } catch (error) {
      console.error('[ApiProviderService] Real-Debrid error:', error)
      return null
    }
  }

  // ==================== AllDebrid Implementation ====================

  private async resolveAllDebrid(magnetUrl: string): Promise<DebridStreamResult | null> {
    try {
      // Upload magnet to AllDebrid
      const uploadResponse = await this.makeRequest('api.alldebrid.com', '/magnet/upload', {
        method: 'POST',
        data: { magnets: [magnetUrl] },
      })

      const magnetId = uploadResponse.data?.magnets?.[0]?.id
      if (!magnetId) return null

      // Get status
      const statusResponse = await this.makeRequest('api.alldebrid.com', '/magnet/status', {
        params: { id: magnetId },
      })

      const links = statusResponse.data?.magnets?.links
      if (!links || links.length === 0) return null

      // Unlock first video link
      const videoLink = links.find((link: any) => 
        /\.(mp4|mkv|avi|mov)$/i.test(link.filename)
      )

      if (!videoLink) return null

      const unlockResponse = await this.makeRequest('api.alldebrid.com', '/link/unlock', {
        method: 'POST',
        data: { link: videoLink.link },
      })

      return {
        streamUrl: unlockResponse.data?.link,
        quality: 'unknown',
        fileSize: videoLink.size || 0,
        filename: videoLink.filename,
        cached: true,
      }
    } catch (error) {
      console.error('[ApiProviderService] AllDebrid error:', error)
      return null
    }
  }

  // ==================== Utility Methods ====================

  private deduplicateMediaResults(results: MediaSearchResult[]): MediaSearchResult[] {
    const seen = new Map<string, MediaSearchResult>()

    for (const result of results) {
      const key = `${result.title}-${result.year}-${result.type}`
      if (!seen.has(key)) {
        seen.set(key, result)
      }
    }

    return Array.from(seen.values())
  }

  /**
   * Get statistics about configured providers
   */
  getStats(): {
    totalProviders: number
    byType: Record<ApiProviderType, number>
    configured: number
    requiresAuth: number
  } {
    const providers = Array.from(this.providers.values())

    return {
      totalProviders: providers.length,
      byType: {
        metadata: providers.filter(p => p.type === 'metadata').length,
        debrid: providers.filter(p => p.type === 'debrid').length,
        'torrent-db': providers.filter(p => p.type === 'torrent-db').length,
        streaming: providers.filter(p => p.type === 'streaming').length,
        playlist: providers.filter(p => p.type === 'playlist').length,
      },
      configured: providers.filter(p => p.apiKey || !p.requiresAuth).length,
      requiresAuth: providers.filter(p => p.requiresAuth).length,
    }
  }
}

export const apiProviderService = new ApiProviderService()
