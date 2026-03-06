import { GoogleGenerativeAI } from '@google/generative-ai'

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ParsedTitle {
  title: string
  year?: number
  season?: number
  episode?: number
  quality?: string
  codec?: string
  source?: string
  group?: string
  type: 'movie' | 'series' | 'unknown'
}

export interface DiscoverySeed {
  term: string
  priority: number
  source: string
  aliases: string[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GENRE_SEEDS: Record<string, string[]> = {
  anime: ['Naruto', 'One Piece', 'Attack on Titan', 'Dragon Ball Z', 'Death Note'],
  drama: ['Breaking Bad', 'The Wire', 'Succession', 'The Crown', 'Ozark'],
  comedy: ['Seinfeld', 'The Office', 'Friends', 'Parks and Recreation', 'Arrested Development'],
  'sci-fi': ['Westworld', 'Black Mirror', 'The Expanse', 'Battlestar Galactica', 'Stranger Things'],
  action: ['24', 'Homeland', '24 Hours', 'Prison Break', 'Strike Back'],
  horror: ['The Walking Dead', 'American Horror Story', 'Haunting of Hill House', 'Penny Dreadful', 'Hannibal'],
  documentary: ['Planet Earth', 'Blue Planet', 'Making a Murderer', 'The Last Dance', 'Free Solo'],
  reality: ['Survivor', 'The Amazing Race', 'Big Brother', 'Top Chef', 'RuPaul\'s Drag Race'],
  sports: ['ESPN 30 for 30', 'Formula 1 Drive to Survive', 'The Last Dance', 'Icarus', 'Senna'],
  news: ['CNN', 'BBC News', 'Al Jazeera', 'NBC Nightly News', 'Fox News'],
  kids: ['Peppa Pig', 'PAW Patrol', 'SpongeBob SquarePants', 'Avatar The Last Airbender', 'Adventure Time'],
}

// Regex patterns for fast-path title parsing
const SEASON_EPISODE_RE = /[Ss](\d{1,2})[Ee](\d{1,2})/
const EPISODE_ALT_RE = /(\d{1,2})[xX](\d{1,2})/
const YEAR_RE = /\b(19[5-9]\d|20[0-3]\d)\b/
const QUALITY_RE = /\b(4K|2160p|1080p|720p|480p|360p)\b/i
const CODEC_RE = /\b(AV1|HEVC|H\.265|H\.264|AVC|x265|x264|xvid|divx|MPEG-2)\b/i
const SOURCE_RE = /\b(BluRay|Blu-Ray|BDRip|BRRip|WEB-DL|WEBRip|HDTV|DVDRIP|CAM|TS|SCR)\b/i
const GROUP_RE = /-([A-Za-z0-9]+)\s*$/

// ─── Cache helper ─────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>()

  set(key: string, value: T, ttlMs: number) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class AIDiscoveryService {
  private genAI: GoogleGenerativeAI
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>
  private aliasCache = new TTLCache<string[]>()
  private genreCache = new TTLCache<string[]>()
  private priorityMap = new Map<string, number>()
  private lastGeminiCall = 0

  constructor(apiKey: string = process.env.GEMINI_API_KEY ?? '') {
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  }

  // ── Rate-limited Gemini call ────────────────────────────────────────────────

  private async callGemini(prompt: string): Promise<string> {
    const now = Date.now()
    const wait = 200 - (now - this.lastGeminiCall)
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    this.lastGeminiCall = Date.now()

    const result = await this.model.generateContent(prompt)
    return result.response.text()
  }

  // ── Title normalization ─────────────────────────────────────────────────────

  normalizeTitle(rawTitle: string): ParsedTitle {
    const seMatch = rawTitle.match(SEASON_EPISODE_RE) ?? rawTitle.match(EPISODE_ALT_RE)
    const season = seMatch ? parseInt(seMatch[1], 10) : undefined
    const episode = seMatch ? parseInt(seMatch[2], 10) : undefined
    const year = rawTitle.match(YEAR_RE)?.[1] ? parseInt(rawTitle.match(YEAR_RE)![1], 10) : undefined
    const quality = rawTitle.match(QUALITY_RE)?.[0]
    const codec = rawTitle.match(CODEC_RE)?.[0]
    const source = rawTitle.match(SOURCE_RE)?.[0]
    const group = rawTitle.match(GROUP_RE)?.[1]

    // Extract clean title: strip everything from the season/episode marker onward
    let cleanTitle = rawTitle
    const stripAt = seMatch ? rawTitle.indexOf(seMatch[0]) : rawTitle.search(QUALITY_RE)
    if (stripAt > 0) cleanTitle = rawTitle.slice(0, stripAt)

    // Normalise separators
    cleanTitle = cleanTitle.replace(/[._-]+/g, ' ').trim()

    const type: ParsedTitle['type'] = season !== undefined ? 'series' : year ? 'movie' : 'unknown'

    return { title: cleanTitle, year, season, episode, quality, codec, source, group, type }
  }

  async normalizeTitles(titles: string[]): Promise<ParsedTitle[]> {
    // Fast regex pass — only call Gemini for entries that remain 'unknown'
    const parsed = titles.map(t => this.normalizeTitle(t))
    const ambiguous = parsed
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.type === 'unknown' && p.title.split(' ').length > 1)

    if (ambiguous.length === 0) return parsed

    const prompt = `For each of these media titles, reply with a JSON array where each element has: title (clean name), year (number or null), type ("movie"|"series"). Titles:\n${ambiguous.map(a => a.p.title).join('\n')}\nRespond ONLY with valid JSON.`

    try {
      const raw = await this.callGemini(prompt)
      const json = JSON.parse(raw.replace(/```json|```/g, '').trim()) as Array<{ title: string; year?: number; type: string }>
      json.forEach((item, idx) => {
        if (idx < ambiguous.length) {
          const { p, i } = ambiguous[idx]
          parsed[i] = { ...p, title: item.title ?? p.title, year: item.year ?? p.year, type: (item.type as ParsedTitle['type']) ?? p.type }
        }
      })
    } catch {
      // Fall back to regex results on parse error
    }

    return parsed
  }

  // ── Alias generation ────────────────────────────────────────────────────────

  async getAliases(title: string): Promise<string[]> {
    const cached = this.aliasCache.get(title)
    if (cached) return cached

    const prompt = `List all alternate titles, translations, abbreviations, and common search terms for: "${title}". Include foreign language titles, common abbreviations, sequel naming variants, and regional title differences. Reply ONLY as a JSON string array.`

    let aliases: string[] = []
    try {
      const raw = await this.callGemini(prompt)
      aliases = JSON.parse(raw.replace(/```json|```/g, '').trim()) as string[]
    } catch {
      aliases = []
    }

    const result = [title, ...aliases.filter(a => a !== title)]
    this.aliasCache.set(title, result, 24 * 60 * 60 * 1000)
    return result
  }

  async isSameContent(title1: string, title2: string): Promise<boolean> {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (normalize(title1) === normalize(title2)) return true

    const aliases1 = await this.getAliases(title1)
    if (aliases1.map(a => normalize(a)).includes(normalize(title2))) return true

    const prompt = `Are "${title1}" and "${title2}" the same movie or TV show (including alternate titles or translations)? Reply with only "yes" or "no".`
    try {
      const response = await this.callGemini(prompt)
      return response.toLowerCase().trim().startsWith('yes')
    } catch {
      return false
    }
  }

  // ── Genre expansion ─────────────────────────────────────────────────────────

  async expandGenre(genre: string, limit = 50): Promise<string[]> {
    const cacheKey = `${genre}:${limit}`
    const cached = this.genreCache.get(cacheKey)
    if (cached) return cached

    const seeds = GENRE_SEEDS[genre.toLowerCase()] ?? []
    const prompt = `List ${limit} popular ${genre} TV shows and movies with their years. Reply ONLY as a JSON array of strings in the format "Title (Year)".`

    let titles: string[] = [...seeds]
    try {
      const raw = await this.callGemini(prompt)
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()) as string[]
      titles = Array.from(new Set([...seeds, ...parsed])).slice(0, limit)
    } catch {
      titles = seeds
    }

    this.genreCache.set(cacheKey, titles, 24 * 60 * 60 * 1000)
    return titles
  }

  // ── Seed extraction from URLs / playlists ───────────────────────────────────

  extractSeedsFromUrl(url: string): string[] {
    const seeds: string[] = []
    try {
      const parsed = new URL(url)
      const params = parsed.searchParams

      // Common IPTV params
      for (const key of ['series', 'movie', 'stream', 'name', 'title', 'channel', 'show']) {
        const val = params.get(key)
        if (val) seeds.push(decodeURIComponent(val).replace(/\+/g, ' '))
      }

      // Extract from path segments
      const segments = parsed.pathname.split('/').filter(s => s.length > 2 && !/^\d+$/.test(s))
      seeds.push(...segments.map(s => s.replace(/[-_]/g, ' ')))
    } catch {
      // Invalid URL — ignore
    }
    return [...new Set(seeds)].filter(s => s.trim().length > 1)
  }

  extractSeedsFromPlaylist(m3uContent: string): string[] {
    const seeds: string[] = []
    const groupRe = /group-title="([^"]+)"/gi
    const nameRe = /,(.+)$/gm
    const tvgNameRe = /tvg-name="([^"]+)"/gi

    for (const re of [groupRe, tvgNameRe]) {
      let m: RegExpExecArray | null
      re.lastIndex = 0
      while ((m = re.exec(m3uContent)) !== null) {
        seeds.push(m[1])
      }
    }

    let m: RegExpExecArray | null
    nameRe.lastIndex = 0
    while ((m = nameRe.exec(m3uContent)) !== null) {
      const name = m[1].trim()
      if (name && !name.startsWith('#')) seeds.push(name)
    }

    return [...new Set(seeds)].filter(s => s.trim().length > 1)
  }

  async snowball(foundUrl: string, depth = 1): Promise<DiscoverySeed[]> {
    const urlSeeds = this.extractSeedsFromUrl(foundUrl)
    const result: DiscoverySeed[] = []

    for (const term of urlSeeds) {
      const aliases = depth > 0 ? await this.getAliases(term) : [term]
      result.push({ term, priority: 5, source: 'url-snowball', aliases })
    }

    if (depth > 1) {
      const expanded: DiscoverySeed[] = []
      for (const seed of result) {
        for (const alias of seed.aliases) {
          const deeper = await this.snowball(alias, depth - 1)
          expanded.push(...deeper)
        }
      }
      result.push(...expanded)
    }

    return result
  }

  // ── Priority seeding ────────────────────────────────────────────────────────

  boostPriority(title: string, reason: string): void {
    const boost = reason === 'current-season' ? 3 : reason === 'trending' ? 2 : 1
    const current = this.priorityMap.get(title) ?? 0
    this.priorityMap.set(title, current + boost)
  }

  getPrioritySeeds(count = 20): DiscoverySeed[] {
    const sorted = [...this.priorityMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, count)

    return sorted.map(([term, priority]) => ({
      term,
      priority,
      source: 'priority-map',
      aliases: [],
    }))
  }

  // ── EPG-driven discovery ────────────────────────────────────────────────────

  extractSeedsFromEPG(epgXmlContent: string): string[] {
    const titles: string[] = []
    const titleRe = /<title[^>]*>([^<]+)<\/title>/gi
    const channelRe = /display-name[^>]*>([^<]+)<\/display-name>/gi

    for (const re of [titleRe, channelRe]) {
      let m: RegExpExecArray | null
      re.lastIndex = 0
      while ((m = re.exec(epgXmlContent)) !== null) {
        const t = m[1].trim()
        if (t) titles.push(t)
      }
    }

    return [...new Set(titles)]
  }

  matchEPGToStreams(
    epgChannels: string[],
    foundStreams: Array<{ url: string; title: string }>
  ): Array<{ stream: { url: string; title: string }; epgChannel: string; score: number }> {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    const results = []

    for (const stream of foundStreams) {
      let bestChannel = ''
      let bestScore = 0

      for (const ch of epgChannels) {
        const ns = normalize(stream.title)
        const nc = normalize(ch)
        if (ns === nc) { bestChannel = ch; bestScore = 1; break }
        if (ns.includes(nc) || nc.includes(ns)) {
          const score = Math.min(ns.length, nc.length) / Math.max(ns.length, nc.length)
          if (score > bestScore) { bestScore = score; bestChannel = ch }
        }
      }

      if (bestChannel) results.push({ stream, epgChannel: bestChannel, score: bestScore })
    }

    return results
  }

  // ── Cross-reference enrichment ──────────────────────────────────────────────

  async crossReferenceStream(
    url: string,
    title: string
  ): Promise<{ confirmed: boolean; imdbId?: string; tmdbId?: string; type?: string }> {
    const parsed = this.normalizeTitle(title)
    if (!parsed.title) return { confirmed: false }

    const prompt = `For the media title "${parsed.title}"${parsed.year ? ` (${parsed.year})` : ''}, provide its IMDB ID (format: ttXXXXXXX), TMDB ID (number), and type (movie or series). Reply ONLY as JSON: {"imdbId":"ttXXXXXXX","tmdbId":"NNNNN","type":"movie|series"} or {"confirmed":false} if unknown.`

    try {
      const raw = await this.callGemini(prompt)
      const data = JSON.parse(raw.replace(/```json|```/g, '').trim()) as { imdbId?: string; tmdbId?: string; type?: string; confirmed?: boolean }
      if (data.confirmed === false) return { confirmed: false }
      return { confirmed: !!(data.imdbId || data.tmdbId), ...data }
    } catch {
      return { confirmed: false }
    }
  }
}

export const aiDiscovery = new AIDiscoveryService()
