/**
 * FanArtTvService
 *
 * Fetches high-quality HD artwork from FanArt.tv (free personal API key).
 * Returns clearlogos, clearart, posters, backgrounds, banners, and thumbnails
 * for movies (by TMDb ID) and TV shows (by TVDb ID).
 *
 * Env vars:
 *   FANART_TV_API_KEY  — personal API key from https://fanart.tv/get-an-api-key/
 *                        (free, requires signup, unlimited personal use)
 */

import axios from 'axios'

const BASE = 'https://webservice.fanart.tv/v3'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FanArtImage {
  id:    string
  url:   string
  lang:  string
  likes: string
}

export interface FanArtMovieMeta {
  hdmovielogo?:   string   // HD clear logo (transparent PNG) — best for overlays
  hdmovieclearart?: string // HD character/title art
  movieposter?:   string   // Theatrical poster
  moviebackground?: string // Full HD fanart background
  moviebanner?:   string   // Wide banner
  moviethumb?:    string   // Landscape thumbnail
  moviedisc?:     string   // Disc art (DVD/Blu-ray)
  allImages:      Record<string, string[]>
}

export interface FanArtTvMeta {
  hdtvlogo?:      string   // HD clear logo
  clearlogo?:     string   // Clear logo (older format)
  tvposter?:      string   // TV poster
  showbackground?: string  // Fanart background
  tvbanner?:      string   // Wide banner
  tvthumb?:       string   // Landscape thumbnail
  seasonposter?:  Record<number, string>  // season number → poster URL
  allImages:      Record<string, string[]>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Pick the best image: highest likes, prefer English, fall back to any. */
function pickBest(images: FanArtImage[] | undefined, langPref = 'en'): string | undefined {
  if (!images || images.length === 0) return undefined
  const sorted = [...images].sort((a, b) => parseInt(b.likes) - parseInt(a.likes))
  return (sorted.find(i => i.lang === langPref) ?? sorted.find(i => i.lang === '00') ?? sorted[0])?.url
}

function allUrls(images: FanArtImage[] | undefined): string[] {
  return (images ?? []).map(i => i.url)
}

// ── Service ───────────────────────────────────────────────────────────────────

export class FanArtTvService {
  private apiKey: string | undefined

  constructor() {
    this.apiKey = process.env.FANART_TV_API_KEY
  }

  get isAvailable(): boolean { return Boolean(this.apiKey) }

  /**
   * Fetch movie artwork by TMDb ID.
   */
  async getMovieArt(tmdbId: number, timeoutMs = 6000): Promise<FanArtMovieMeta | undefined> {
    if (!this.apiKey) return undefined
    try {
      const res = await axios.get(`${BASE}/movies/${tmdbId}`, {
        params: { api_key: this.apiKey },
        timeout: timeoutMs,
      })
      const d = res.data as Record<string, FanArtImage[]>
      const all: Record<string, string[]> = {}
      for (const [k, v] of Object.entries(d)) {
        if (Array.isArray(v)) all[k] = allUrls(v)
      }
      return {
        hdmovielogo:    pickBest(d.hdmovielogo),
        hdmovieclearart: pickBest(d.hdmovieclearart),
        movieposter:    pickBest(d.movieposter),
        moviebackground: pickBest(d.moviebackground),
        moviebanner:    pickBest(d.moviebanner),
        moviethumb:     pickBest(d.moviethumb),
        moviedisc:      pickBest(d.moviedisc),
        allImages:      all,
      }
    } catch {
      return undefined
    }
  }

  /**
   * Fetch TV show artwork by TVDb ID.
   */
  async getTvArt(tvdbId: number, timeoutMs = 6000): Promise<FanArtTvMeta | undefined> {
    if (!this.apiKey) return undefined
    try {
      const res = await axios.get(`${BASE}/tv/${tvdbId}`, {
        params: { api_key: this.apiKey },
        timeout: timeoutMs,
      })
      const d = res.data as Record<string, any>
      const all: Record<string, string[]> = {}
      for (const [k, v] of Object.entries(d)) {
        if (Array.isArray(v)) all[k] = allUrls(v as FanArtImage[])
      }

      // Season posters: { "1": [{url,..}], "2": [...] }
      const seasonPoster: Record<number, string> = {}
      if (d.seasonposter) {
        for (const [seasonStr, imgs] of Object.entries(d.seasonposter as Record<string, FanArtImage[]>)) {
          const best = pickBest(imgs)
          if (best) seasonPoster[parseInt(seasonStr)] = best
        }
      }

      return {
        hdtvlogo:       pickBest(d.hdtvlogo),
        clearlogo:      pickBest(d.clearlogo),
        tvposter:       pickBest(d.tvposter),
        showbackground: pickBest(d.showbackground),
        tvbanner:       pickBest(d.tvbanner),
        tvthumb:        pickBest(d.tvthumb),
        seasonposter:   Object.keys(seasonPoster).length > 0 ? seasonPoster : undefined,
        allImages:      all,
      }
    } catch {
      return undefined
    }
  }

  /**
   * Fetch the best available logo (clearlogo) for a channel/show by name search.
   * Tries TV first, then movie.
   */
  async getLogoByTmdbId(tmdbId: number): Promise<string | undefined> {
    const art = await this.getMovieArt(tmdbId)
    return art?.hdmovielogo ?? art?.hdmovieclearart
  }

  async getLogoByTvdbId(tvdbId: number): Promise<string | undefined> {
    const art = await this.getTvArt(tvdbId)
    return art?.hdtvlogo ?? art?.clearlogo
  }
}

export const fanArtTv = new FanArtTvService()
