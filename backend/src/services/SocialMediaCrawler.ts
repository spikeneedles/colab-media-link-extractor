/**
 * Social Media Crawler Service
 *
 * Crawls Reddit, Telegram public channels, and paste sites for M3U/streaming links.
 */

import { EventEmitter } from 'events'
import axios, { AxiosInstance } from 'axios'

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface SocialPost {
  platform: 'reddit' | 'telegram' | 'pastebin' | 'rentry' | 'hastebin' | 'discord' | 'm3u4u' | 'iptvcat'
  subreddit?: string
  channel?: string
  url: string
  text: string
  foundLinks: string[]
  timestamp: number
}

export interface SocialCrawlConfig {
  subreddits: string[]
  telegramChannels: string[]
  enablePastebin: boolean
  enablePastebinRealtime: boolean
  enableDiscord: boolean
  enableM3u4u: boolean
  enableIptvCat: boolean
  discordInvites: string[]
  maxPostsPerSource: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SUBREDDITS = [
  'IPTV',
  'cordcutters',
  'Addons4Kodi',
  'animepiracy',
  'freemediaheckyeah',
  'illegaltorrents',
  'Piracy',
  'IPTVReviews',
  'livetv',
]

const DEFAULT_TELEGRAM_CHANNELS = [
  'iptvchannel',
  'freeiptv',
  'm3ulinks',
  'iptv_links',
  'streaming_links',
]

const USER_AGENTS = [
  'MediaLinkExtractor/1.0 (compatible; +https://github.com)',
  'Mozilla/5.0 (compatible; MediaBot/1.0)',
  'MediaLinkExtractor/1.0 (+https://github.com/media-link-extractor)',
]

const DEFAULT_DISCORD_INVITES: string[] = [
  // Public IPTV/media sharing Discord servers (invite codes)
  // Add your own via config.discordInvites
]

// IPTV Cat API endpoint (no auth required for public listings)
const IPTVCAT_SOURCES_URL = 'https://iptvcat.net/all/all/'

// m3u4u public listing page
const M3U4U_URL = 'https://m3u4u.com/'

// Regex patterns for stream/playlist URL extraction
const STREAM_PATTERNS = [
  /https?:\/\/[^\s"'<>]+\.m3u8?(?:[?#][^\s"'<>]*)?/gi,
  /https?:\/\/[^\s"'<>]+\/get\.php\?[^\s"'<>]*username=[^\s"'<>]*/gi,
  /rtmp:\/\/[^\s"'<>]+/gi,
  /rtsp:\/\/[^\s"'<>]+/gi,
  /srt:\/\/[^\s"'<>]+/gi,
  // SRT with port
  /srt:\/\/[^\s"'<>]+:\d+/gi,
  // WHEP/WHIP WebRTC streams
  /https?:\/\/[^\s"'<>]+\/whep(?:[?#][^\s"'<>]*)?/gi,
  /https?:\/\/[^\s"'<>]+\/whip(?:[?#][^\s"'<>]*)?/gi,
  // Smooth Streaming manifests
  /https?:\/\/[^\s"'<>]+\.ism\/manifest(?:[?#][^\s"'<>]*)?/gi,
  // HDS manifests
  /https?:\/\/[^\s"'<>]+\.f4m(?:[?#][^\s"'<>]*)?/gi,
  /https?:\/\/[^\s"'<>]+\.(?:ts|mp4)(?:[?#][^\s"'<>]*)?/gi,
  /https?:\/\/pastebin\.com\/[a-zA-Z0-9]+/gi,
  /https?:\/\/rentry\.co\/[a-zA-Z0-9]+/gi,
  /https?:\/\/hastebin\.com\/[a-zA-Z0-9]+/gi,
]

const BASE64_PATTERN = /(?:^|[\s"'])([A-Za-z0-9+/]{40,}={0,2})(?:[\s"']|$)/g

// ─── SocialMediaCrawler ───────────────────────────────────────────────────────

export class SocialMediaCrawler extends EventEmitter {
  private config: SocialCrawlConfig
  private http: AxiosInstance
  private stopped = false
  private uaIndex = 0

  constructor(config: Partial<SocialCrawlConfig> = {}) {
    super()
    this.config = {
      subreddits:             config.subreddits             ?? DEFAULT_SUBREDDITS,
      telegramChannels:       config.telegramChannels       ?? DEFAULT_TELEGRAM_CHANNELS,
      enablePastebin:         config.enablePastebin         ?? true,
      enablePastebinRealtime: config.enablePastebinRealtime ?? true,
      enableDiscord:          config.enableDiscord          ?? true,
      enableM3u4u:            config.enableM3u4u            ?? true,
      enableIptvCat:          config.enableIptvCat          ?? true,
      discordInvites:         config.discordInvites         ?? DEFAULT_DISCORD_INVITES,
      maxPostsPerSource:      config.maxPostsPerSource      ?? 100,
    }

    this.http = axios.create({
      timeout: 15_000,
      headers: { 'User-Agent': this.nextUserAgent() },
    })
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Run all crawlers in sequence. */
  async crawlAll(): Promise<SocialPost[]> {
    this.stopped = false
    const results: SocialPost[] = []

    for (const sub of this.config.subreddits) {
      if (this.stopped) break
      try {
        const posts = await this.crawlSubreddit(sub)
        results.push(...posts)
      } catch (err) {
        this.emit('error', { source: `reddit:${sub}`, error: err })
      }
    }

    for (const channel of this.config.telegramChannels) {
      if (this.stopped) break
      try {
        const posts = await this.crawlTelegramChannel(channel)
        results.push(...posts)
      } catch (err) {
        this.emit('error', { source: `telegram:${channel}`, error: err })
      }
    }

    if (this.config.enablePastebin && !this.stopped) {
      try {
        const posts = await this.crawlPastebin()
        results.push(...posts)
      } catch (err) {
        this.emit('error', { source: 'pastebin', error: err })
      }
    }

    if (this.config.enablePastebinRealtime && !this.stopped) {
      try {
        const posts = await this.crawlPastebinRealtime()
        results.push(...posts)
      } catch (err) {
        this.emit('error', { source: 'pastebin-realtime', error: err })
      }
    }

    if (this.config.enableM3u4u && !this.stopped) {
      try {
        const posts = await this.crawlM3u4u()
        results.push(...posts)
      } catch (err) {
        this.emit('error', { source: 'm3u4u', error: err })
      }
    }

    if (this.config.enableIptvCat && !this.stopped) {
      try {
        const posts = await this.crawlIptvCat()
        results.push(...posts)
      } catch (err) {
        this.emit('error', { source: 'iptvcat', error: err })
      }
    }

    for (const invite of this.config.discordInvites) {
      if (this.stopped) break
      try {
        const posts = await this.crawlDiscord(invite)
        results.push(...posts)
      } catch (err) {
        this.emit('error', { source: `discord:${invite}`, error: err })
      }
    }

    return results
  }

  stop(): void {
    this.stopped = true
  }

  // ── Reddit ─────────────────────────────────────────────────────────────────

  async crawlSubreddit(subreddit: string): Promise<SocialPost[]> {
    const posts: SocialPost[] = []
    const sorts = ['new', 'hot', 'top'] as const

    for (const sort of sorts) {
      if (this.stopped) break
      let after: string | null = null
      let fetched = 0

      while (fetched < this.config.maxPostsPerSource && !this.stopped) {
        const url = this.redditUrl(subreddit, sort, after)
        const data = await this.redditFetch(url)
        if (!data?.data?.children?.length) break

        for (const child of data.data.children) {
          const post = child.data
          const text = [post.selftext ?? '', post.url ?? '', post.title ?? ''].join(' ')
          const foundLinks = this.extractStreamURLs(text)

          if (foundLinks.length > 0) {
            const sp: SocialPost = {
              platform: 'reddit',
              subreddit,
              url: `https://reddit.com${post.permalink}`,
              text: text.slice(0, 2000),
              foundLinks,
              timestamp: Math.floor((post.created_utc ?? Date.now() / 1000) * 1000),
            }
            posts.push(sp)
            this.emit('post', sp)
            this.emit('links', { source: `reddit:${subreddit}`, links: foundLinks })
          }
        }

        after = data.data.after ?? null
        fetched += data.data.children.length
        if (!after) break

        await this.delay(1_000) // Reddit rate limit: 1 req/sec
      }
    }

    // Also scan comments of top 5 posts
    await this.crawlSubredditComments(subreddit, posts)

    return posts
  }

  private async crawlSubredditComments(subreddit: string, posts: SocialPost[]): Promise<void> {
    const topUrl = this.redditUrl(subreddit, 'top', null)
    let topData: any
    try {
      topData = await this.redditFetch(topUrl)
    } catch {
      return
    }
    const topChildren = (topData?.data?.children ?? []).slice(0, 5)

    for (const child of topChildren) {
      if (this.stopped) break
      const post = child.data
      try {
        await this.delay(1_000)
        const commentsUrl = `https://www.reddit.com/r/${subreddit}/comments/${post.id}.json?limit=100`
        const commentsData = await this.redditFetch(commentsUrl)
        if (!Array.isArray(commentsData)) continue

        const commentListing = commentsData[1]?.data?.children ?? []
        for (const comment of commentListing) {
          const body = comment.data?.body ?? ''
          const foundLinks = this.extractStreamURLs(body)
          if (foundLinks.length > 0) {
            const sp: SocialPost = {
              platform: 'reddit',
              subreddit,
              url: `https://reddit.com${post.permalink}`,
              text: body.slice(0, 2000),
              foundLinks,
              timestamp: Date.now(),
            }
            posts.push(sp)
            this.emit('post', sp)
            this.emit('links', { source: `reddit:${subreddit}:comments`, links: foundLinks })
          }
        }
      } catch (err) {
        this.emit('error', { source: `reddit:${subreddit}:comments`, error: err })
      }
    }
  }

  private redditUrl(subreddit: string, sort: string, after: string | null): string {
    let url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=100`
    if (after) url += `&after=${after}`
    return url
  }

  private async redditFetch(url: string): Promise<any> {
    const res = await this.http.get(url, {
      headers: {
        'User-Agent': this.nextUserAgent(),
        Accept: 'application/json',
      },
    })
    return res.data
  }

  // ── Telegram ───────────────────────────────────────────────────────────────

  async crawlTelegramChannel(channelName: string): Promise<SocialPost[]> {
    const posts: SocialPost[] = []
    const url = `https://t.me/s/${channelName}`

    const res = await this.http.get(url, {
      headers: {
        'User-Agent': this.nextUserAgent(),
        Accept: 'text/html',
      },
    })

    const html: string = res.data
    const text = this.stripHtml(html)
    const foundLinks = this.extractStreamURLs(text)

    // Also extract href attributes directly
    const hrefMatches = [...html.matchAll(/href=["']([^"']+)["']/g)]
    for (const m of hrefMatches) {
      const href = m[1]
      if (this.isMediaLink(href)) foundLinks.push(href)
    }

    if (foundLinks.length > 0) {
      const sp: SocialPost = {
        platform: 'telegram',
        channel: channelName,
        url,
        text: text.slice(0, 2000),
        foundLinks: [...new Set(foundLinks)],
        timestamp: Date.now(),
      }
      posts.push(sp)
      this.emit('post', sp)
      this.emit('links', { source: `telegram:${channelName}`, links: sp.foundLinks })
    }

    await this.delay(2_000)
    return posts
  }

  // ── Pastebin ───────────────────────────────────────────────────────────────

  async crawlPastebin(): Promise<SocialPost[]> {
    const posts: SocialPost[] = []

    // Public scraping API returns up to 250 most recent public pastes
    const listRes = await this.http.get('https://scrape.pastebin.com/api_scraping.php?limit=250', {
      headers: { 'User-Agent': this.nextUserAgent() },
    })

    const pastes: Array<{ key: string; title: string; date: string }> = listRes.data ?? []

    for (const paste of pastes.slice(0, this.config.maxPostsPerSource)) {
      if (this.stopped) break
      try {
        await this.delay(500)
        const raw = await this.http.get(`https://pastebin.com/raw/${paste.key}`, {
          headers: { 'User-Agent': this.nextUserAgent() },
        })
        const content: string = typeof raw.data === 'string' ? raw.data : JSON.stringify(raw.data)
        const foundLinks = this.extractStreamURLs(content)

        if (foundLinks.length > 0 || content.includes('#EXTINF')) {
          const sp: SocialPost = {
            platform: 'pastebin',
            url: `https://pastebin.com/${paste.key}`,
            text: content.slice(0, 2000),
            foundLinks,
            timestamp: Date.now(),
          }
          posts.push(sp)
          this.emit('post', sp)
          this.emit('links', { source: 'pastebin', links: foundLinks })
        }
      } catch (err) {
        this.emit('error', { source: `pastebin:${paste.key}`, error: err })
      }
    }

    return posts
  }

  // ── Real-time Pastebin monitor ─────────────────────────────────────────────

  /**
   * Polls the Pastebin scraping API for the latest ~250 pastes and filters
   * for M3U keywords. More targeted than the general crawlPastebin() method.
   */
  async crawlPastebinRealtime(): Promise<SocialPost[]> {
    const posts: SocialPost[] = []
    const M3U_KEYWORDS = ['#EXTINF', 'm3u8', 'm3u', 'xtream', 'get.php', 'player_api', 'live stream', 'iptv']

    try {
      const listRes = await this.http.get(
        'https://scrape.pastebin.com/api_scraping.php?limit=250',
        { headers: { 'User-Agent': this.nextUserAgent() } }
      )
      const pastes: Array<{ key: string; title: string; size: number }> = listRes.data ?? []

      // Filter to likely IPTV pastes by title
      const candidates = pastes.filter(p =>
        M3U_KEYWORDS.some(kw => (p.title ?? '').toLowerCase().includes(kw))
      )

      for (const paste of candidates.slice(0, this.config.maxPostsPerSource)) {
        if (this.stopped) break
        try {
          await this.delay(300)
          const raw = await this.http.get(`https://pastebin.com/raw/${paste.key}`, {
            headers: { 'User-Agent': this.nextUserAgent() },
          })
          const content: string = typeof raw.data === 'string' ? raw.data : ''
          if (!content.includes('#EXTINF') && !this.extractStreamURLs(content).length) continue

          const foundLinks = this.extractStreamURLs(content)
          const sp: SocialPost = {
            platform: 'pastebin',
            url: `https://pastebin.com/${paste.key}`,
            text: content.slice(0, 2000),
            foundLinks,
            timestamp: Date.now(),
          }
          posts.push(sp)
          this.emit('post', sp)
          if (foundLinks.length) this.emit('links', { source: 'pastebin-realtime', links: foundLinks })
        } catch (err) {
          this.emit('error', { source: `pastebin-realtime:${paste.key}`, error: err })
        }
      }
    } catch (err: any) {
      this.emit('error', { source: 'pastebin-realtime', error: err })
    }

    return posts
  }

  // ── m3u4u.com ─────────────────────────────────────────────────────────────

  /**
   * Scrapes m3u4u.com for publicly listed M3U playlists.
   * m3u4u is a community playlist sharing site with searchable/filterable lists.
   */
  async crawlM3u4u(): Promise<SocialPost[]> {
    const posts: SocialPost[] = []

    // m3u4u exposes playlists as JSON via its /json endpoint
    const searchUrls = [
      `${M3U4U_URL}json/public`,
      `${M3U4U_URL}json/recent`,
    ]

    for (const url of searchUrls) {
      if (this.stopped) break
      try {
        const res = await this.http.get(url, {
          headers: { 'User-Agent': this.nextUserAgent(), Accept: 'application/json' },
          timeout: 12_000,
        })
        const data = res.data as any
        const items: any[] = Array.isArray(data) ? data : data?.playlists ?? data?.data ?? []

        for (const item of items.slice(0, 50)) {
          const playlistUrl = item.url ?? item.m3u_url ?? item.link
          if (!playlistUrl) continue
          const sp: SocialPost = {
            platform: 'm3u4u',
            url: playlistUrl,
            text: `m3u4u: ${item.name ?? item.title ?? 'Untitled'}`,
            foundLinks: [playlistUrl],
            timestamp: Date.now(),
          }
          posts.push(sp)
          this.emit('post', sp)
          this.emit('links', { source: 'm3u4u', links: [playlistUrl] })
        }
      } catch {
        // m3u4u may not have a JSON API — fall back to HTML scrape
        try {
          const res = await this.http.get(M3U4U_URL, {
            headers: { 'User-Agent': this.nextUserAgent() },
          })
          const html: string = res.data
          const m3uLinks = [...html.matchAll(/https?:\/\/[^"'\s<>]+\.m3u8?[^"'\s<>]*/gi)]
            .map(m => m[0])
            .filter(u => u.includes('m3u4u.com'))
          for (const link of [...new Set(m3uLinks)].slice(0, 30)) {
            const sp: SocialPost = {
              platform: 'm3u4u',
              url: link,
              text: `m3u4u playlist`,
              foundLinks: [link],
              timestamp: Date.now(),
            }
            posts.push(sp)
            this.emit('post', sp)
            this.emit('links', { source: 'm3u4u', links: [link] })
          }
        } catch {}
      }
      await this.delay(2_000)
    }

    return posts
  }

  // ── IPTV Cat ───────────────────────────────────────────────────────────────

  /**
   * Scrapes iptvcat.net for live stream listings.
   * IPTV Cat aggregates live streams with direct M3U8 links.
   */
  async crawlIptvCat(): Promise<SocialPost[]> {
    const posts: SocialPost[] = []

    // IPTV Cat provides a structured listing at /all/all/
    const pages = [
      'https://iptvcat.net/all/all/',
      'https://iptvcat.net/all/all/?p=2',
      'https://iptvcat.net/all/all/?p=3',
    ]

    for (const pageUrl of pages) {
      if (this.stopped) break
      try {
        const res = await this.http.get(pageUrl, {
          headers: { 'User-Agent': this.nextUserAgent(), Accept: 'text/html' },
          timeout: 15_000,
        })
        const html: string = res.data

        // Extract M3U8 links from the page
        const m3u8Links = [...html.matchAll(/https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/gi)]
          .map(m => m[0])
        // Also look for data-url or href attributes with stream URLs
        const dataUrls = [...html.matchAll(/(?:data-url|href)=["']([^"']*\.m3u8?[^"']*)/gi)]
          .map(m => m[1])
        const allLinks = [...new Set([...m3u8Links, ...dataUrls])].filter(u => u.startsWith('http'))

        if (allLinks.length > 0) {
          const sp: SocialPost = {
            platform: 'iptvcat',
            url: pageUrl,
            text: `iptvcat.net listing (${allLinks.length} streams)`,
            foundLinks: allLinks,
            timestamp: Date.now(),
          }
          posts.push(sp)
          this.emit('post', sp)
          this.emit('links', { source: 'iptvcat', links: allLinks })
        }
        await this.delay(3_000)
      } catch (err: any) {
        this.emit('error', { source: `iptvcat:${pageUrl}`, error: err })
      }
    }

    return posts
  }

  // ── Discord ────────────────────────────────────────────────────────────────

  /**
   * Scrapes public Discord server info via the Discord API (no auth required
   * for public invite resolution). Extracts any M3U/stream links visible in
   * the invite widget's description/channel names.
   *
   * Note: Full message history requires a bot token. This method only uses
   * the public invite endpoint which requires no credentials.
   */
  async crawlDiscord(inviteCode: string): Promise<SocialPost[]> {
    const posts: SocialPost[] = []
    const url = `https://discord.com/api/v9/invites/${inviteCode}?with_counts=true&with_expiration=true`

    try {
      const res = await this.http.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MediaLinkExtractor/1.0)',
          Accept: 'application/json',
        },
        timeout: 10_000,
      })

      const data = res.data as any
      const texts = [
        data.guild?.description ?? '',
        data.guild?.name ?? '',
        ...(data.guild?.channels ?? []).map((c: any) => c.name ?? ''),
      ].join(' ')

      const foundLinks = this.extractStreamURLs(texts)
      if (foundLinks.length > 0 || texts.length > 0) {
        const sp: SocialPost = {
          platform: 'discord',
          url: `https://discord.gg/${inviteCode}`,
          text: texts.slice(0, 2000),
          foundLinks,
          timestamp: Date.now(),
        }
        posts.push(sp)
        this.emit('post', sp)
        if (foundLinks.length) this.emit('links', { source: `discord:${inviteCode}`, links: foundLinks })
      }
      await this.delay(2_000)
    } catch (err: any) {
      this.emit('error', { source: `discord:${inviteCode}`, error: err })
    }

    return posts
  }

  // ── Content Extraction Utilities ───────────────────────────────────────────

  extractStreamURLs(text: string): string[] {
    const found = new Set<string>()

    for (const pattern of STREAM_PATTERNS) {
      pattern.lastIndex = 0
      const matches = text.matchAll(pattern)
      for (const m of matches) found.add(m[0])
    }

    // Detect and decode base64-encoded URLs
    BASE64_PATTERN.lastIndex = 0
    for (const m of text.matchAll(BASE64_PATTERN)) {
      try {
        const decoded = Buffer.from(m[1], 'base64').toString('utf8')
        if (decoded.startsWith('http') && this.isMediaLink(decoded)) {
          found.add(decoded.trim())
        }
      } catch {
        // not valid base64 — skip
      }
    }

    return [...found]
  }

  isMediaLink(url: string): boolean {
    if (!url) return false
    const lower = url.toLowerCase()
    return (
      lower.includes('.m3u') ||
      lower.includes('.m3u8') ||
      lower.includes('.ts') ||
      lower.includes('.mp4') ||
      lower.includes('.f4m') ||
      lower.includes('.ism/manifest') ||
      lower.includes('/whep') ||
      lower.includes('/whip') ||
      lower.includes('get.php?') ||
      lower.includes('xtream') ||
      lower.startsWith('rtmp://') ||
      lower.startsWith('rtsp://') ||
      lower.startsWith('srt://') ||
      lower.includes('/playlist') ||
      lower.includes('/stream') ||
      lower.includes('pastebin.com/') ||
      lower.includes('rentry.co/') ||
      lower.includes('hastebin.com/')
    )
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private stripHtml(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private nextUserAgent(): string {
    const ua = USER_AGENTS[this.uaIndex % USER_AGENTS.length]
    this.uaIndex++
    return ua
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createSocialMediaCrawler(config: Partial<SocialCrawlConfig> = {}): SocialMediaCrawler {
  return new SocialMediaCrawler(config)
}
