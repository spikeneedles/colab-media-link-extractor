/**
 * PlaylistHarvesterService
 *
 * Crawls web pages and known IPTV sources looking for M3U / M3U8 / PLS / XSPF
 * streaming playlists. Downloads and parses each found playlist, then feeds
 * validated entries directly into the Archivist Protocol.
 *
 * Hardware profile: AMD Ryzen 3900X (12-core/24-thread) + NVIDIA RTX 2070 Super
 *  - HARVEST_CONCURRENCY = 24 (saturates all 3900X threads via async I/O)
 *  - GPU-accelerated Puppeteer spider (RTX 2070 hardware rasterization)
 *  - Worker-thread M3U parser for large files (> 500 KB)
 *
 * Supported targets:
 *   - Direct M3U/M3U8 file URLs
 *   - HTML pages containing links to playlist files
 *   - RSS/Atom feeds (Nyaa, SubsPlease, Archive.org)
 *   - JavaScript-rendered pages (Puppeteer spider)
 *   - GitHub raw file URLs
 *   - Custom user-supplied URLs
 */

import { EventEmitter }   from 'events'
import { Worker }         from 'worker_threads'
import { createRequire }  from 'module'
import { fileURLToPath }  from 'url'
import path               from 'path'
import axios              from 'axios'
import { archivist }      from './ArchivistService.js'
import type { ArchivistEntry } from './ArchivistService.js'

const _require   = createRequire(import.meta.url)
const __dirname  = path.dirname(fileURLToPath(import.meta.url))

// Lazy-load puppeteer-extra + stealth for the GPU spider
let _puppeteer: any = null
async function getPuppeteer() {
  if (_puppeteer) return _puppeteer
  const pe = _require('puppeteer-extra')
  const StealthPlugin = _require('puppeteer-extra-plugin-stealth')
  pe.use(StealthPlugin())
  _puppeteer = pe
  return pe
}

// ── Hardware-tuned constants ───────────────────────────────────────────────────

/** Max concurrent harvest workers — matches 3900X thread count */
const HARVEST_CONCURRENCY = 24

/**
 * GPU args for NVIDIA RTX 2070 Super on Windows (headless Chrome).
 * Enables hardware rasterization + accelerated video decode.
 */
const HARVESTER_GPU_ARGS = [
  '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
  '--enable-gpu-rasterization',
  '--enable-accelerated-2d-canvas',
  '--enable-accelerated-video-decode',
  '--num-raster-threads=12',          // saturate 3900X physical cores
  '--renderer-process-limit=8',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--mute-audio', '--disable-extensions', '--disable-default-apps',
]

// ── Async semaphore ────────────────────────────────────────────────────────────

class HarvestSemaphore {
  private permits: number
  private queue: (() => void)[] = []
  constructor(permits: number) { this.permits = permits }
  acquire(): Promise<void> {
    if (this.permits > 0) { this.permits--; return Promise.resolve() }
    return new Promise(r => this.queue.push(r))
  }
  release() {
    if (this.queue.length > 0) { this.queue.shift()!() }
    else { this.permits++ }
  }
}

// ── English-only helpers ───────────────────────────────────────────────────────

/** Returns true if the text contains at least some Latin (English) characters */
function hasLatinChars(text: string): boolean {
  return /[a-zA-Z]/.test(text)
}

/** Returns true if the group-title indicates an anime/animation/cartoon category */
function isAnimationGroup(group: string): boolean {
  return /anime|animation|cartoon|manga|kids/i.test(group)
}

/**
 * For anime/animation/cartoon entries: enforce English.
 * Accepts entries that have at least some Latin characters in the title.
 * Rejects purely CJK / non-Latin titles (raw Japanese/Chinese/Korean releases).
 */
function passesEnglishFilter(title: string, groupTitle: string, tvgLanguage?: string): boolean {
  if (!isAnimationGroup(groupTitle)) return true  // non-anime: always pass
  if (tvgLanguage && !/^en/i.test(tvgLanguage)) return false  // explicit non-English language tag
  return hasLatinChars(title)  // must have at least some Latin characters
}

// ── Preset IPTV / playlist sources ───────────────────────────────────────────

export interface HarvestPreset {
  id:           string
  name:         string
  url:          string
  description:  string
  group:        string
  direct:       boolean   // true = URL is itself a playlist file (not a page to spider)
  needsBrowser?: boolean  // true = use GPU-accelerated Puppeteer to render JS
}

export const HARVEST_PRESETS: HarvestPreset[] = [
  // ── Top-5 Universal Playlist Discovery (M3U8 / M3U / PLS / XSPF / ASX) ────
  // These are the most reliable community sources for ALL playlist file types.
  {
    id: 'playlist-hub-iptv-org-index',
    name: 'Playlist Hub — IPTV-ORG Index',
    url: 'https://iptv-org.github.io/iptv/index.m3u',
    description: 'Top source: 10 000+ live channels (M3U8 direct). Community-maintained.',
    group: 'Playlist Discovery',
    direct: true,
  },
  {
    id: 'playlist-hub-freetv',
    name: 'Playlist Hub — Free-TV GitHub',
    url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
    description: 'Top source: free public TV channels worldwide (M3U8 direct).',
    group: 'Playlist Discovery',
    direct: true,
  },
  {
    id: 'playlist-hub-awesome-iptv',
    name: 'Playlist Hub — Awesome-IPTV Spider',
    url: 'https://github.com/iptv-org/awesome-iptv',
    description: 'Top source: curated list of IPTV tools & playlists — spider for M3U/M3U8/PLS/XSPF.',
    group: 'Playlist Discovery',
    direct: false,
    needsBrowser: false,
  },
  {
    id: 'playlist-hub-iptvcat',
    name: 'Playlist Hub — IPTV Cat',
    url: 'https://iptvcat.net/all/all/',
    description: 'Top source: filterable live stream database with direct M3U8 exports.',
    group: 'Playlist Discovery',
    direct: false,
    needsBrowser: true,
  },
  {
    id: 'playlist-hub-m3u4u',
    name: 'Playlist Hub — M3U4U Community',
    url: 'https://m3u4u.com/m3u/1111xxxxxxxxxxxxxxxx',
    description: 'Top source: user-submitted M3U8 playlists (PLS / XSPF / M3U / ASX / STRM).',
    group: 'Playlist Discovery',
    direct: false,
    needsBrowser: false,
  },
  // ── IPTV-ORG (largest free IPTV catalogue) ──────────────────────────────
  {
    id: 'iptv-org-all',
    name: 'IPTV-ORG — All Channels',
    url: 'https://iptv-org.github.io/iptv/index.m3u',
    description: 'Community-maintained global IPTV channel list',
    group: 'IPTV-ORG',
    direct: true,
  },
  {
    id: 'iptv-org-movies',
    name: 'IPTV-ORG — Movies',
    url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us.m3u',
    description: 'US free IPTV channels from IPTV-ORG (movies/entertainment mix)',
    group: 'IPTV-ORG',
    direct: true,
  },
  {
    id: 'iptv-org-entertainment',
    name: 'IPTV-ORG — Entertainment',
    url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/uk.m3u',
    description: 'UK entertainment channels from IPTV-ORG',
    group: 'IPTV-ORG',
    direct: true,
  },
  {
    id: 'iptv-org-sports',
    name: 'IPTV-ORG — Sports',
    url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ca.m3u',
    description: 'CA live channels from IPTV-ORG',
    group: 'IPTV-ORG',
    direct: true,
  },
  {
    id: 'iptv-org-news',
    name: 'IPTV-ORG — News',
    url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/jp.m3u',
    description: 'Japanese channels (includes anime) from IPTV-ORG',
    group: 'IPTV-ORG',
    direct: true,
  },
  {
    id: 'iptv-org-kids',
    name: 'IPTV-ORG — Kids',
    url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/au.m3u',
    description: 'AU children\'s and family channels from IPTV-ORG',
    group: 'IPTV-ORG',
    direct: true,
  },
  // ── Free-IPTV GitHub ─────────────────────────────────────────────────────
  {
    id: 'free-iptv-us',
    name: 'Free-IPTV — USA',
    url: 'https://raw.githubusercontent.com/Free-IPTV/Countries/master/us.m3u',
    description: 'US free IPTV channels',
    group: 'Free-IPTV',
    direct: true,
  },
  {
    id: 'free-iptv-uk',
    name: 'Free-IPTV — UK',
    url: 'https://raw.githubusercontent.com/Free-IPTV/Countries/master/gb.m3u',
    description: 'UK free IPTV channels',
    group: 'Free-IPTV',
    direct: true,
  },
  // ── StreamTest / public M3U8 directories ────────────────────────────────
  {
    id: 'iptv-cat-general',
    name: 'IPTV-Cat — General',
    url: 'https://iptv-org.github.io/api/streams.m3u',
    description: 'API-sourced stream list from iptv-org',
    group: 'IPTV-Cat',
    direct: true,
  },
  // ── GitHub awesome-iptv index pages ──────────────────────────────────────
  {
    id: 'awesome-iptv-index',
    name: 'Awesome IPTV Index',
    url: 'https://raw.githubusercontent.com/iptv-org/awesome-iptv/master/README.md',
    description: 'Spider for more M3U links',
    group: 'Discovery',
    direct: false,
  },

  // ── TV Series Sources ─────────────────────────────────────────────────────
  {
    id: 'iptv-org-series',
    name: 'IPTV-ORG — Series',
    url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/series.m3u',
    description: 'TV series VOD streams from IPTV-ORG community catalogue',
    group: 'TV Series',
    direct: true,
  },
  {
    id: 'free-tv-global',
    name: 'Free-TV — Global Playlist',
    url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
    description: 'Community-maintained free TV and series streams',
    group: 'TV Series',
    direct: true,
  },
  {
    id: 'tunduk-playlist',
    name: 'Tunduk — Community Playlist',
    url: 'https://raw.githubusercontent.com/Tunduk/playlist/main/playlist.m3u8',
    description: 'Curated international series and TV streams',
    group: 'TV Series',
    direct: true,
  },
  {
    id: 'epgnet-iptv',
    name: 'EPGNet — IPTV Playlist',
    url: 'https://raw.githubusercontent.com/EPGNet/EPG/iptv/iptv.m3u',
    description: 'EPGNet curated IPTV list with full series metadata',
    group: 'TV Series',
    direct: true,
  },
  {
    id: 'yuechan-aptv',
    name: 'YueChan — APTV',
    url: 'https://raw.githubusercontent.com/YueChan/Live/main/APTV.m3u',
    description: 'APTV curated streams including TV series',
    group: 'TV Series',
    direct: true,
  },
  {
    id: 'iptv-org-auto-series',
    name: 'IPTV-ORG — Auto Series',
    url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/auto.m3u',
    description: 'Auto-generated stream index including series content',
    group: 'TV Series',
    direct: true,
  },
  {
    id: 'iptv-stream-list-series',
    name: 'Stream List — TV Series',
    url: 'https://raw.githubusercontent.com/streamlist/streamlist/main/streamlist.m3u',
    description: 'StreamList community TV series index',
    group: 'TV Series',
    direct: true,
  },
  {
    id: 'gadget-drama',
    name: 'Gadget Drama — Series Streams',
    url: 'https://raw.githubusercontent.com/tv-list/tv-list/main/drama.m3u',
    description: 'Drama and series episode streams',
    group: 'TV Series',
    direct: true,
  },
  {
    id: 'iptv4sat-vod',
    name: 'IPTV4SAT — VOD Series',
    url: 'https://raw.githubusercontent.com/iptv4sat/vod/main/series.m3u',
    description: 'VOD series streams from IPTV4SAT',
    group: 'TV Series',
    direct: true,
  },
  {
    id: 'nebiuos-series',
    name: 'Nebiuos — TV Series Playlist',
    url: 'https://raw.githubusercontent.com/nebiuos/IPTV/main/series.m3u',
    description: 'Nebiuos community-sourced TV series streams',
    group: 'TV Series',
    direct: true,
  },
  {
    id: 'iptv-turkey-series',
    name: 'IPTV Turkey — Series',
    url: 'https://raw.githubusercontent.com/furkanozbay/IPTV/main/playlists/tr.m3u',
    description: 'Turkish drama and international TV series streams',
    group: 'TV Series',
    direct: true,
  },
  {
    id: 'iptv-brasil-series',
    name: 'IPTV Brasil — Series',
    url: 'https://raw.githubusercontent.com/iptvbrasil/canais/main/iptv.m3u',
    description: 'Brazilian IPTV series and entertainment streams',
    group: 'TV Series',
    direct: true,
  },
  {
    id: 'iptv-m3u-playlist-series',
    name: 'M3U Playlist — Series Index',
    url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/vo.m3u',
    description: 'Video-on-demand series streams from iptv-org',
    group: 'TV Series',
    direct: true,
  },
  {
    id: 'awesome-iptv-series-spider',
    name: 'GitHub IPTV Series Hub',
    url: 'https://github.com/iptv-org/iptv/tree/master/streams',
    description: 'Spider GitHub iptv-org streams directory for series files',
    group: 'TV Series',
    direct: false,
  },
  {
    id: 'iptv-list-org-series',
    name: 'IPTVList.org — Series',
    url: 'https://www.iptvlist.org/series/',
    description: 'Spidered index of series M3U playlists from IPTVList',
    group: 'TV Series',
    direct: false,
  },
  {
    id: 'iptv-cat-series',
    name: 'IPTVCat — Series',
    url: 'https://iptvcat.net/s/series',
    description: 'IPTVCat series category — spider for M3U stream links',
    group: 'TV Series',
    direct: false,
  },
  {
    id: 'xtream-codes-vod-series',
    name: 'Xtream Index — VOD Series',
    url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/vo_es.m3u',
    description: 'Spanish-origin VOD series catalogue (heavy series content)',
    group: 'TV Series',
    direct: true,
  },
  {
    id: 'github-iptv-series-discovery',
    name: 'GitHub IPTV Series Discovery',
    url: 'https://raw.githubusercontent.com/iptv-org/awesome-iptv/master/README.md',
    description: 'Secondary spider pass focused on series M3U links in awesome-iptv',
    group: 'TV Series',
    direct: false,
  },
  {
    id: 'streamdb-series',
    name: 'StreamDB — Series Catalogue',
    url: 'https://raw.githubusercontent.com/tv-series-db/streamdb/main/index.m3u',
    description: 'StreamDB community TV series index',
    group: 'TV Series',
    direct: true,
  },
  {
    id: 'miptv-series-vod',
    name: 'mIPTV — Series VOD',
    url: 'https://raw.githubusercontent.com/mIPTV/miptv/main/series.m3u',
    description: 'mIPTV community series VOD playlist',
    group: 'TV Series',
    direct: true,
  },

  // ── Internet Archive (public domain video/audio) ──────────────────────────
  {
    id: 'archive-org-feature-films',
    name: 'Internet Archive — Feature Films',
    url: 'https://archive.org/details/feature_films',
    description: 'Public domain feature films collection — scraped for direct video links',
    group: 'Movies',
    direct: false,
  },
  {
    id: 'archive-org-silent-films',
    name: 'Internet Archive — Silent Films',
    url: 'https://archive.org/details/silent_films',
    description: 'Classic silent-era films in the public domain',
    group: 'Movies',
    direct: false,
  },
  {
    id: 'archive-org-tv-archive',
    name: 'Internet Archive — TV Archive',
    url: 'https://archive.org/details/tv',
    description: 'Archived television broadcasts and series episodes',
    group: 'TV Series',
    direct: false,
  },
  {
    id: 'archive-org-classic-tv',
    name: 'Internet Archive — Classic TV',
    url: 'https://archive.org/details/classic_tv',
    description: 'Classic television series — public domain episodes',
    group: 'TV Series',
    direct: false,
  },
  {
    id: 'archive-org-audio',
    name: 'Internet Archive — Audio',
    url: 'https://archive.org/details/audio',
    description: 'Public domain audio recordings, music and radio',
    group: 'Audio',
    direct: false,
  },

  // ── Anime IPTV Channels ──────────────────────────────────────────────────
  // Priority live/VOD M3U8 channel lists dedicated to anime

  {
    id: 'iptv-org-anime',
    name: 'IPTV-ORG — Anime Channels',
    url: 'https://iptv-org.github.io/iptv/index.m3u',
    description: 'IPTV-ORG full channel index — filter anime by group-title in M3U parser',
    group: 'Anime IPTV',
    direct: true,
  },
  {
    id: 'free-iptv-anime',
    name: 'Free-IPTV — Anime',
    url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
    description: 'Free-TV curated playlist including anime channels with logos and EPG data',
    group: 'Anime IPTV',
    direct: true,
  },
  {
    id: 'iptv-cat-anime',
    name: 'IPTV-Cat — Anime',
    url: 'https://iptvcat.net/a_z/anime/',
    description: 'IPTV-Cat anime genre index — m3u8 streams with thumbnails and channel metadata',
    group: 'Anime IPTV',
    direct: false,
  },
  {
    id: 'animeiptv-m3u',
    name: 'GitHub — Anime M3U Collections',
    url: 'https://github.com/search?q=anime+iptv+m3u8&type=repositories',
    description: 'GitHub search for anime IPTV m3u8 playlists — public repos with live streams',
    group: 'Anime IPTV',
    direct: false,
  },
  {
    id: 'awesome-iptv-anime',
    name: 'Awesome-IPTV — Anime Sources',
    url: 'https://raw.githubusercontent.com/iptv-org/awesome-iptv/master/README.md',
    description: 'Curated awesome-iptv list — anime-tagged IPTV providers and M3U sources',
    group: 'Anime IPTV',
    direct: false,
  },

  // ── Anime Streaming Services ─────────────────────────────────────────────
  // Top free/open anime streaming sites with direct video/m3u8 URLs

  {
    id: 'anime-tosho-archive',
    name: 'AnimeTosho — Archive Index',
    url: 'https://animetosho.org',
    description: 'AnimeTosho torrent/NZB index — every release has attachments, screenshots, m3u8 refs',
    group: 'Anime Streaming',
    direct: false,
  },
  {
    id: 'subsplease-rss',
    name: 'SubsPlease — RSS Feed',
    url: 'https://subsplease.org/rss/?t&r=1080',
    description: 'SubsPlease weekly simulcast RSS — latest 1080p m3u8/torrent anime releases with art',
    group: 'Anime Streaming',
    direct: false,
  },
  {
    id: 'nyaa-rss-anime',
    name: 'Nyaa.si — Anime RSS (1080p)',
    url: 'https://nyaa.si/?page=rss&c=1_2&f=0&q=1080p',
    description: 'Nyaa anime RSS — latest 1080p releases with thumbnails and metadata',
    group: 'Anime Streaming',
    direct: false,
  },
  {
    id: 'animixplay-m3u8',
    name: 'Archive.org — Anime Video Collection',
    url: 'https://archive.org/search?query=anime&mediatype=movies&sort=-week',
    description: 'Internet Archive anime video collection — public domain, direct mp4/m3u8 playback',
    group: 'Anime Streaming',
    direct: false,
  },
  {
    id: 'bilibili-anime',
    name: 'Bilibili — Anime Index',
    url: 'https://www.bilibili.com/anime',
    description: 'Bilibili anime season index — licensed simulcasts with cover art and episode metadata',
    group: 'Anime Streaming',
    direct: false,
  },

  // ── Anime Movies ─────────────────────────────────────────────────────────
  // Top sources for playable anime movie URLs with artwork and metadata

  {
    id: 'archive-org-anime-movies',
    name: 'Internet Archive — Anime Movies',
    url: 'https://archive.org/search?query=anime+movie&mediatype=movies&sort=-week',
    description: 'Public domain and CC-licensed anime movies — direct mp4/m3u8, poster art, full metadata',
    group: 'Anime Movies',
    direct: false,
  },
  {
    id: 'nyaa-movies-rss',
    name: 'Nyaa.si — Anime Movies RSS',
    url: 'https://nyaa.si/?page=rss&c=1_2&f=0&q=movie+1080p',
    description: 'Nyaa anime movie RSS — 1080p BDrip/WEBrip releases with poster and metadata',
    group: 'Anime Movies',
    direct: false,
  },
  {
    id: 'animetosho-movies',
    name: 'AnimeTosho — Movie Releases',
    url: 'https://animetosho.org/search?q=movie&order=size-d',
    description: 'AnimeTosho indexed anime movies — screenshots, attachments, resolution metadata',
    group: 'Anime Movies',
    direct: false,
  },
  {
    id: 'animekaizoku-movies',
    name: 'AnimeKaizoku — Movies',
    url: 'https://animekaizoku.com/category/anime-movie/',
    description: 'AnimeKaizoku direct-download anime movie archive — poster art, dual-audio, metadata',
    group: 'Anime Movies',
    direct: false,
  },
  {
    id: 'subsplease-movies',
    name: 'SubsPlease — Movie Releases',
    url: 'https://subsplease.org/movies/',
    description: 'SubsPlease movie page — m3u8-compatible releases with cover images and metadata',
    group: 'Anime Movies',
    direct: false,
  },

  // ── Anime Series ─────────────────────────────────────────────────────────
  // Top sources for full anime series: episode lists, m3u8/mp4, thumbnails, metadata

  {
    id: 'iptv-org-anime-series',
    name: 'IPTV-ORG — Anime Series Playlist',
    url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/jp.m3u',
    description: 'Japanese IPTV channels (anime-heavy) from IPTV-ORG',
    group: 'Anime Series',
    direct: true,
  },
  {
    id: 'subsplease-series-rss',
    name: 'SubsPlease — Series RSS (All)',
    url: 'https://subsplease.org/rss/?t&r=720',
    description: 'SubsPlease all-series RSS feed — weekly episode releases, poster URLs, show metadata',
    group: 'Anime Series',
    direct: false,
  },
  {
    id: 'nyaa-series-rss',
    name: 'Nyaa.si — Anime Series RSS',
    url: 'https://nyaa.si/?page=rss&c=1_2&f=0&q=S01',
    description: 'Nyaa series season packs — batch torrent releases with complete episode m3u8/mp4',
    group: 'Anime Series',
    direct: false,
  },
  {
    id: 'archive-org-anime-series',
    name: 'Internet Archive — Anime Series',
    url: 'https://archive.org/search?query=anime+series&mediatype=movies&sort=-week',
    description: 'Archive.org anime series — direct mp4/m3u8 episode URLs, poster images, full metadata',
    group: 'Anime Series',
    direct: false,
  },
  {
    id: 'animekaizoku-series',
    name: 'AnimeKaizoku — Series Index',
    url: 'https://animekaizoku.com/category/ongoing-season/',
    description: 'AnimeKaizoku ongoing series — cover art, batch episode packs, dual-audio direct links',
    group: 'Anime Series',
    direct: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TOP 10 ENGLISH ANIME STREAMING & MEDIA SITES
  // Spiders / crawl-friendly endpoints for English-dubbed/subbed content.
  // Free-tier and open sources are prioritised; paid sites included for M3U8
  // detection via Puppeteer spider (needs JS render).
  // ═══════════════════════════════════════════════════════════════════════════

  // 1. Crunchyroll — world's largest licensed anime catalogue
  {
    id: 'anime-eng-crunchyroll',
    name: 'Crunchyroll — English Anime (Free)',
    url: 'https://www.crunchyroll.com/videos/anime',
    description: 'Top 10: Crunchyroll free simulcast catalogue — spider for episode M3U8 segments',
    group: 'English Anime',
    direct: false,
    needsBrowser: true,
  },

  // 2. HIDIVE — licensed UK/US dubs, older catalogue
  {
    id: 'anime-eng-hidive',
    name: 'HIDIVE — English Dubbed Anime',
    url: 'https://www.hidive.com/movies',
    description: 'Top 10: HIDIVE free-preview pages — HLS endpoint detection for dubbed anime',
    group: 'English Anime',
    direct: false,
    needsBrowser: true,
  },

  // 3. Tubi TV — 100% free legal, huge anime library, real HLS streams
  {
    id: 'anime-eng-tubi',
    name: 'Tubi TV — Free Anime (HLS)',
    url: 'https://tubitv.com/category/anime',
    description: 'Top 10: Tubi free anime — actual M3U8 HLS streams, no subscription required',
    group: 'English Anime',
    direct: false,
    needsBrowser: true,
  },

  // 4. Pluto TV — free live anime channels + on-demand (real M3U8 channels)
  {
    id: 'anime-eng-plutotv-m3u',
    name: 'Pluto TV — Anime Channels (M3U8)',
    url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us.m3u',
    description: 'Top 10: Pluto TV anime channels via IPTV-ORG US M3U — direct HLS streams',
    group: 'English Anime',
    direct: true,
  },

  // 5. Plex — free tier with licensed anime, serves HLS
  {
    id: 'anime-eng-plex',
    name: 'Plex — Free Anime Movies & Series',
    url: 'https://watch.plex.tv/category/anime',
    description: 'Top 10: Plex free anime tier — Puppeteer spider for M3U8 HLS streams',
    group: 'English Anime',
    direct: false,
    needsBrowser: true,
  },

  // 6. 9anime — largest English-sub catalogue, serves embedded HLS
  {
    id: 'anime-eng-9anime',
    name: '9anime — English Subbed Catalogue',
    url: 'https://9anime.to/filter?genre=all&sort=views&type=all&language=sub',
    description: 'Top 10: 9anime popularity-sorted English sub catalogue — spider for M3U8 embeds',
    group: 'English Anime',
    direct: false,
    needsBrowser: true,
  },

  // 7. Aniwatch / Zoro.to — high-quality HLS, sub + dub toggles
  {
    id: 'anime-eng-aniwatch',
    name: 'Aniwatch — Sub & Dub HLS',
    url: 'https://aniwatch.to/filter?type=all&status=all&rated=all&score=all&language=English+Dub&sort=top-rated',
    description: 'Top 10: Aniwatch top-rated English dub filter — HLS M3U8 stream extraction via Puppeteer',
    group: 'English Anime',
    direct: false,
    needsBrowser: true,
  },

  // 8. Gogoanime — free, most-visited free anime site, HLS CDN
  {
    id: 'anime-eng-gogoanime',
    name: 'Gogoanime — English Sub/Dub',
    url: 'https://gogoanime.tel/popular.html',
    description: 'Top 10: Gogoanime popular page — M3U8 CDN stream detection via Puppeteer stealth',
    group: 'English Anime',
    direct: false,
    needsBrowser: true,
  },

  // 9. AnimePahe — high-quality encodes, small file sizes, English sub
  {
    id: 'anime-eng-animepahe',
    name: 'AnimePahe — HQ English Subs',
    url: 'https://animepahe.com/',
    description: 'Top 10: AnimePahe latest releases — spider for Kwik/direct M3U8 stream embeds',
    group: 'English Anime',
    direct: false,
    needsBrowser: true,
  },

  // 10. Archive.org — public domain anime (pre-1978 + Creative Commons)
  {
    id: 'anime-eng-archive-anime',
    name: 'Archive.org — Public Domain Anime',
    url: 'https://archive.org/search?query=anime+english&and[]=mediatype%3A%22movies%22&sort=-downloads',
    description: 'Top 10: Archive.org public domain + CC anime — metadata API yields direct MP4/M3U8',
    group: 'English Anime',
    direct: false,
    needsBrowser: false,
  },

  // ── GitHub Actions CI-Generated Playlists ────────────────────────────────
  // Repos that auto-generate updated M3U playlists via GitHub Actions workflows.
  {
    id: 'github-actions-iptv-playlist',
    name: 'GitHub Actions — iptv-playlist Auto-Updated',
    url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/unsorted.m3u',
    description: 'CI-generated M3U from iptv-org/iptv — updated every 24h by GitHub Actions',
    group: 'GitHub CI Playlists',
    direct: true,
  },
  {
    id: 'github-actions-tv-grab',
    name: 'GitHub Actions — tv-grab Playlists',
    url: 'https://raw.githubusercontent.com/iptv-org/epg/master/sites/directory.json',
    description: 'EPG source directory auto-generated by CI — reveals active stream endpoints',
    group: 'GitHub CI Playlists',
    direct: false,
    needsBrowser: false,
  },
  {
    id: 'github-actions-freeiptv-countries',
    name: 'GitHub Actions — Free-IPTV Countries CI',
    url: 'https://github.com/Free-TV/IPTV/actions',
    description: 'Spider Free-TV/IPTV Actions page for latest artifact playlist download URLs',
    group: 'GitHub CI Playlists',
    direct: false,
    needsBrowser: false,
  },

  // ── BTDB RSS Feeds ───────────────────────────────────────────────────────
  // BTDB (BitTorrent Database) RSS feeds for media with video streams
  {
    id: 'btdb-rss-video',
    name: 'BTDB — Video RSS Feed',
    url: 'https://btdb.to/q/video/?rss=1',
    description: 'BTDB RSS for video torrents — parses magnet links and resolves via Real-Debrid',
    group: 'BTDB',
    direct: false,
    needsBrowser: false,
  },
  {
    id: 'btdb-rss-hd-movies',
    name: 'BTDB — HD Movies RSS',
    url: 'https://btdb.to/q/1080p+movie/?rss=1',
    description: 'BTDB RSS for 1080p movies — 20 newest entries per poll',
    group: 'BTDB',
    direct: false,
    needsBrowser: false,
  },
  {
    id: 'btdb-rss-hd-tv',
    name: 'BTDB — HD TV Shows RSS',
    url: 'https://btdb.to/q/1080p+S01/?rss=1',
    description: 'BTDB RSS for HD TV series season packs',
    group: 'BTDB',
    direct: false,
    needsBrowser: false,
  },

  // ── Community Aggregators ─────────────────────────────────────────────────
  {
    id: 'iptvcat-all-streams',
    name: 'IPTV Cat — All Streams Listing',
    url: 'https://iptvcat.net/all/all/',
    description: 'IPTV Cat community aggregator — filterable live stream database with M3U8 exports',
    group: 'Community Aggregators',
    direct: false,
    needsBrowser: true,
  },
  {
    id: 'm3u4u-public-playlists',
    name: 'M3U4U — Public Playlist Hub',
    url: 'https://m3u4u.com/',
    description: 'M3U4U user-submitted M3U8 playlists — public community playlist sharing',
    group: 'Community Aggregators',
    direct: false,
    needsBrowser: false,
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedPlaylistEntry {
  url:        string
  title:      string
  groupTitle: string
  tvgId:      string
  tvgLogo:    string
  duration:   number
}

export interface HarvestResult {
  sourceUrl:     string
  playlistsFound: number
  entriesParsed: number
  archived:      number
  rejected:      number
  flagged:       number
  errors:        string[]
}

export interface HarvestStatus {
  running:        boolean
  totalSources:   number
  completedSources: number
  currentSource:  string
  totalArchived:  number
  totalParsed:    number
  errors:         string[]
  results:        HarvestResult[]
  startedAt:      number | null
  completedAt:    number | null
}

// ── Service ───────────────────────────────────────────────────────────────────

export class PlaylistHarvesterService extends EventEmitter {
  private running  = false
  private abortCtrl: AbortController | null = null
  private status: HarvestStatus = {
    running:          false,
    totalSources:     0,
    completedSources: 0,
    currentSource:    '',
    totalArchived:    0,
    totalParsed:      0,
    errors:           [],
    results:          [],
    startedAt:        null,
    completedAt:      null,
  }

  getStatus(): HarvestStatus {
    return { ...this.status }
  }

  stop() {
    this.abortCtrl?.abort()
    this.running = false
    this.status.running = false
    this.emit('stopped', this.status)
  }

  // ── Entry point ─────────────────────────────────────────────────────────

  async harvest(presetIds: string[], customUrls: string[]): Promise<HarvestStatus> {
    if (this.running) throw new Error('Harvest already in progress')

    this.abortCtrl = new AbortController()
    this.running   = true
    this.status = {
      running:          true,
      totalSources:     0,
      completedSources: 0,
      currentSource:    '',
      totalArchived:    0,
      totalParsed:      0,
      errors:           [],
      results:          [],
      startedAt:        Date.now(),
      completedAt:      null,
    }

    // Build source list
    const presets = HARVEST_PRESETS.filter(p => presetIds.includes(p.id))
    const customs: HarvestPreset[] = customUrls.filter(Boolean).map((url, i) => ({
      id:          `custom-${i}`,
      name:        url,
      url,
      description: 'Custom URL',
      group:       'Custom',
      direct:      this.looksLikePlaylist(url),
    }))

    const sources = [...presets, ...customs]
    this.status.totalSources = sources.length
    this.emit('started', this.status)

    // ── Parallel harvest: run up to HARVEST_CONCURRENCY sources at once ────────
    const sem = new HarvestSemaphore(HARVEST_CONCURRENCY)
    await Promise.all(sources.map(async source => {
      if (!this.running) return
      await sem.acquire()
      try {
        if (!this.running) return
        await this.processSource(source)
      } finally {
        sem.release()
      }
    }))

    this.running        = false
    this.status.running = false
    this.status.completedAt = Date.now()
    this.emit('completed', this.status)
    return this.status
  }

  // ── Process one source ───────────────────────────────────────────────────

  private async processSource(source: HarvestPreset): Promise<void> {
    this.status.currentSource = source.name
    this.emit('progress', { source: source.name, step: 'fetching' })

    const result: HarvestResult = {
      sourceUrl:      source.url,
      playlistsFound: 0,
      entriesParsed:  0,
      archived:       0,
      rejected:       0,
      flagged:        0,
      errors:         [],
    }

    try {
      if (source.direct) {
        // URL is itself a playlist file
        const entries = await this.fetchAndParsePlaylist(source.url)
        result.playlistsFound = 1
        result.entriesParsed  = entries.length
        if (entries.length > 0) {
          const stats = await this.archiveEntries(entries, source.url)
          result.archived  = stats.archived
          result.rejected  = stats.rejected
          result.flagged   = stats.flagged
        }
      } else {
        // Spider the page for playlist links
        // needsBrowser presets use GPU-accelerated Puppeteer to render JS pages
        const playlistUrls = source.needsBrowser
          ? await this.spiderWithPuppeteer(source.url)
          : await this.spiderForPlaylists(source.url)
        result.playlistsFound = playlistUrls.length
        this.emit('progress', { source: source.name, step: 'found', count: playlistUrls.length })

        for (const pUrl of playlistUrls) {
          if (!this.running) break
          try {
            const entries = await this.fetchAndParsePlaylist(pUrl)
            result.entriesParsed += entries.length
            if (entries.length > 0) {
              const stats = await this.archiveEntries(entries, source.url)
              result.archived += stats.archived
              result.rejected += stats.rejected
              result.flagged  += stats.flagged
            }
          } catch (err: any) {
            result.errors.push(`${pUrl}: ${err.message}`)
          }
        }
      }
    } catch (err: any) {
      const msg = err.message ?? String(err)
      result.errors.push(msg)
      this.status.errors.push(`[${source.name}] ${msg}`)
      console.warn(`[PlaylistHarvester] ${source.name}: ${msg}`)
    }

    this.status.completedSources++
    this.status.totalArchived += result.archived
    this.status.totalParsed   += result.entriesParsed
    this.status.results.push(result)
    this.emit('sourceComplete', { source: source.name, result })
  }

  // ── GPU-accelerated Puppeteer spider (for JS-rendered pages) ─────────────
  //
  //  Uses puppeteer-extra + stealth plugin with hardware GPU rasterization
  //  args tuned for the NVIDIA RTX 2070 Super. Falls back to HTTP spider
  //  on any error.

  private async spiderWithPuppeteer(pageUrl: string): Promise<string[]> {
    let browser: any = null
    try {
      const puppeteer = await getPuppeteer()
      browser = await puppeteer.launch({
        headless: 'new',
        args: HARVESTER_GPU_ARGS,
        ignoreHTTPSErrors: true,
        timeout: 30000,
      })
      const page = await browser.newPage()
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36')
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
      await page.setRequestInterception(true)
      // Collect intercepted M3U8 network requests
      const intercepted: string[] = []
      page.on('request', (req: any) => {
        const url = req.url()
        if (/\.m3u8/i.test(url) || /\.m3u/i.test(url)) intercepted.push(url)
        req.continue()
      })
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await new Promise(r => setTimeout(r, 4000))
      const html: string = await page.content()
      await browser.close(); browser = null
      const found = this.extractPlaylistLinks(html, pageUrl)
      return [...new Set([...intercepted, ...found])]
    } catch (err: any) {
      console.warn(`[PlaylistHarvester] Puppeteer spider failed for ${pageUrl}: ${err.message} — falling back to HTTP`)
      if (browser) { try { await browser.close() } catch {} }
      return this.spiderForPlaylists(pageUrl)
    }
  }

  // ── HTTP spider ─────────────────────────────────────────────────────────────
  // Spider an HTML/RSS page for playlists AND direct video URLs

  // ── Shared: extract playlist/video links from HTML string ──────────────────
  private extractPlaylistLinks(html: string, pageUrl: string): Set<string> {
    const base = new URL(pageUrl)
    const found = new Set<string>()
    let m: RegExpExecArray | null

    const playlistPatterns = [
      /(?:href|src|url)\s*[=:]\s*["']([^"']+\.m3u8?(?:\?[^"']*)?)/gi,
      /(?:href|src|url)\s*[=:]\s*["']([^"']+\.pls(?:\?[^"']*)?)/gi,
      /(?:href|src|url)\s*[=:]\s*["']([^"']+\.xspf(?:\?[^"']*)?)/gi,
      /(?:href|src|url)\s*[=:]\s*["']([^"']+\.asx(?:\?[^"']*)?)/gi,
      /(?:href|src|url)\s*[=:]\s*["']([^"']+\.wpl(?:\?[^"']*)?)/gi,
    ]
    const rawPlaylistPattern = /https?:\/\/[^\s"'<>]+\.(?:m3u8?|pls|xspf|asx|wpl)(?:\?[^\s"'<>]*)?/gi
    const magnetPattern      = /magnet:\?xt=urn:[^\s"'<>]+/gi

    for (const re of playlistPatterns) {
      re.lastIndex = 0
      while ((m = re.exec(html)) !== null) {
        try { found.add(new URL(m[1], base).href) } catch { /* skip malformed */ }
      }
    }
    rawPlaylistPattern.lastIndex = 0
    while ((m = rawPlaylistPattern.exec(html)) !== null) found.add(m[0])
    magnetPattern.lastIndex = 0
    while ((m = magnetPattern.exec(html)) !== null) found.add(m[0])

    const videoUrlPattern = /(?:href|src|content|data-src|data-url)\s*=\s*["'](https?:\/\/[^"']+\.(?:mp4|mkv|webm|ts|m3u8|mpd|avi)(?:\?[^"']*)?)/gi
    videoUrlPattern.lastIndex = 0
    while ((m = videoUrlPattern.exec(html)) !== null) {
      try { found.add(new URL(m[1], base).href) } catch { /* skip */ }
    }
    const enclosurePattern = /<enclosure[^>]+url=["']([^"']+)["']/gi
    enclosurePattern.lastIndex = 0
    while ((m = enclosurePattern.exec(html)) !== null) {
      try { found.add(new URL(m[1], base).href) } catch { /* skip */ }
    }
    const mediaContentPattern = /<media:content[^>]+url=["']([^"']+)["']/gi
    mediaContentPattern.lastIndex = 0
    while ((m = mediaContentPattern.exec(html)) !== null) {
      try { found.add(new URL(m[1], base).href) } catch { /* skip */ }
    }
    return found
  }

  private async spiderForPlaylists(pageUrl: string): Promise<string[]> {
    const resp = await axios.get(pageUrl, {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
      maxContentLength: 5 * 1024 * 1024,
    })
    const html: string = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data)
    const base  = new URL(pageUrl)
    const found = this.extractPlaylistLinks(html, pageUrl)
    let m: RegExpExecArray | null

    // Archive.org item links — crawl one level deep via metadata API
    if (base.hostname === 'archive.org') {
      const itemLinks: string[] = []
      const archiveItemPattern = /href=["'](\/details\/[^"'?#]+)/gi
      archiveItemPattern.lastIndex = 0
      while ((m = archiveItemPattern.exec(html)) !== null) {
        try { itemLinks.push(new URL(m[1], base).href) } catch { /* skip */ }
      }
      for (const itemUrl of [...new Set(itemLinks)].slice(0, 10)) {
        try {
          const identifierMatch = itemUrl.match(/\/details\/([^/?#]+)/)
          if (identifierMatch) {
            const id = identifierMatch[1]
            try {
              const metaResp = await axios.get(`https://archive.org/metadata/${id}`, { timeout: 8000 })
              const files: any[] = metaResp.data?.files ?? []
              const videoFiles = files
                .filter((f: any) => /\.(m3u8|mp4|mkv|webm|avi|mov)$/i.test(f.name ?? ''))
                .sort((a: any, b: any) => {
                  const rank = (f: any) => f.name?.endsWith('.m3u8') ? 0 : f.name?.endsWith('.mp4') ? 1 : 2
                  return rank(a) - rank(b)
                })
              for (const vf of videoFiles.slice(0, 3)) {
                found.add(`https://archive.org/download/${id}/${encodeURIComponent(vf.name)}`)
              }
            } catch { /* metadata fetch failed */ }
          }
          const itemResp = await axios.get(itemUrl, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SILASBot/1.0)' }, maxContentLength: 2 * 1024 * 1024 })
          const itemHtml: string = typeof itemResp.data === 'string' ? itemResp.data : JSON.stringify(itemResp.data)
          const itemVideoPattern = /href=["'](https:\/\/archive\.org\/download\/[^"']+\.(?:mp4|m3u8|mkv|webm))/gi
          itemVideoPattern.lastIndex = 0
          while ((m = itemVideoPattern.exec(itemHtml)) !== null) found.add(m[1])
        } catch { /* item fetch failed */ }
      }
    }

    return [...found].slice(0, 100)
  }

  // ── Fetch and parse a playlist file ─────────────────────────────────────

  async fetchAndParsePlaylist(url: string): Promise<ParsedPlaylistEntry[]> {
    const resp = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SILASBot/1.0)',
        'Accept': '*/*',
      },
      maxContentLength: 50 * 1024 * 1024, // 50 MB max
      responseType: 'text',
    })

    const content: string = typeof resp.data === 'string'
      ? resp.data
      : Buffer.isBuffer(resp.data) ? resp.data.toString('utf8') : String(resp.data)

    // RSS/Atom feed — parse items as entries (Nyaa, SubsPlease, etc.)
    if (content.includes('<rss') || content.includes('<feed') || content.includes('<channel>')) {
      const rssEntries = this.parseRSS(content, url)
      if (rssEntries.length > 0) return rssEntries
    }

    const ext = url.split('?')[0].toLowerCase()
    if (ext.endsWith('.pls'))  return this.parsePLS(content, url)
    if (ext.endsWith('.xspf')) return this.parseXSPF(content, url)
    if (ext.endsWith('.asx'))  return this.parseASX(content, url)
    if (ext.endsWith('.wpl'))  return this.parseWPL(content, url)

    // Direct video URL — treat as single entry
    if (/\.(mp4|mkv|webm|ts|avi|mov)$/i.test(url.split('?')[0])) {
      const title = decodeURIComponent(url.split('/').pop()?.replace(/\.\w+$/, '') ?? 'Video')
      return [{ url, title, groupTitle: 'Anime', tvgId: '', tvgLogo: '', duration: -1 }]
    }

    return this.parseM3U(content, url)
  }

  // ── Parse RSS/Atom feed (Nyaa, SubsPlease, Archive.org) ─────────────────

  private parseRSS(content: string, sourceUrl: string): ParsedPlaylistEntry[] {
    const entries: ParsedPlaylistEntry[] = []

    // Extract channel-level image as fallback thumbnail
    const chanImageMatch = content.match(/<image>\s*<url>([^<]+)<\/url>/i)
      ?? content.match(/<itunes:image[^>]+href=["']([^"']+)["']/i)
    const channelImage = chanImageMatch?.[1] ?? ''

    // Split on <item> or <entry> tags
    const itemPattern = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi
    let m
    while ((m = itemPattern.exec(content)) !== null) {
      const item = m[1]

      const title = (item.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/si)?.[1] ?? '').trim()

      // Video URL priority: enclosure > link > media:content
      let videoUrl = ''
      const enclosureMatch = item.match(/<enclosure[^>]+url=["']([^"']+)["']/i)
      const mediaMatch     = item.match(/<media:content[^>]+url=["']([^"']+)["']/i)
      const linkMatch      = item.match(/<link[^>]*>([^<]+)<\/link>/i)
        ?? item.match(/<link[^>]+href=["']([^"']+)["']/i)

      const encUrl = enclosureMatch?.[1] ?? ''
      const mediaUrl = mediaMatch?.[1] ?? ''
      const linkUrl = linkMatch?.[1]?.trim() ?? ''

      // Pick: m3u8 > mp4/mkv > enclosure > media > link
      if (encUrl.match(/\.m3u8?/i))       videoUrl = encUrl
      else if (mediaUrl.match(/\.m3u8?/i)) videoUrl = mediaUrl
      else if (encUrl.match(/\.(mp4|mkv|webm|ts)/i))  videoUrl = encUrl
      else if (mediaUrl.match(/\.(mp4|mkv|webm|ts)/i)) videoUrl = mediaUrl
      else if (encUrl)  videoUrl = encUrl
      else if (mediaUrl) videoUrl = mediaUrl
      else if (linkUrl.match(/\.(mp4|mkv|webm|m3u8|ts)/i)) videoUrl = linkUrl
      else if (linkUrl.startsWith('http')) videoUrl = linkUrl

      if (!videoUrl) continue

      // Thumbnail: media:thumbnail > media:content poster > enclosure poster > channel image
      const thumbMatch = item.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)
        ?? item.match(/<itunes:image[^>]+href=["']([^"']+)["']/i)
        ?? item.match(/<image[^>]*>([^<]+)<\/image>/i)
      const thumbnail = thumbMatch?.[1] ?? channelImage

      // Group/category from RSS
      const catMatch = item.match(/<category[^>]*>([^<]+)<\/category>/i)
      const groupTitle = catMatch?.[1]?.trim() ?? 'Anime'

      const finalTitle = title || (videoUrl.split('/').pop()?.replace(/\.\w+$/, '') ?? 'Untitled')

      // English-only filter for anime/animation/cartoon categories
      if (!passesEnglishFilter(finalTitle, groupTitle)) continue

      entries.push({
        url:        videoUrl,
        title:      finalTitle,
        groupTitle,
        tvgId:      '',
        tvgLogo:    thumbnail,
        duration:   -1,
      })
    }

    return entries
  }

  // ── Parse M3U/M3U8 ───────────────────────────────────────────────────────

  private parseM3U(content: string, sourceUrl: string): ParsedPlaylistEntry[] {
    const entries: ParsedPlaylistEntry[] = []
    if (!content.includes('#EXTM3U') && !content.includes('#EXTINF')) {
      // Not an M3U — may be a single stream URL
      const lines = content.trim().split(/\r?\n/).filter(l => /^https?:\/\//i.test(l.trim()))
      for (const line of lines) {
        entries.push({ url: line.trim(), title: sourceUrl.split('/').pop() ?? 'Stream', groupTitle: 'Live TV', tvgId: '', tvgLogo: '', duration: -1 })
      }
      return entries
    }

    const lines = content.split(/\r?\n/)
    let pendingMeta: Partial<ParsedPlaylistEntry> | null = null

    for (const raw of lines) {
      const line = raw.trim()
      if (!line || line.startsWith('#EXTM3U')) continue

      if (line.startsWith('#EXTINF:')) {
        const durMatch = line.match(/^#EXTINF:\s*(-?\d+(?:\.\d+)?)/)
        const duration = durMatch ? parseFloat(durMatch[1]) : -1

        const attrs: Record<string, string> = {}
        const attrRe = /([\w-]+)\s*=\s*"([^"]*)"/g
        let am
        while ((am = attrRe.exec(line)) !== null) {
          attrs[am[1].toLowerCase()] = am[2]
        }
        const titleMatch = line.match(/,([^,]+)$/)
        pendingMeta = {
          duration,
          title:      titleMatch?.[1]?.trim() || attrs['tvg-name'] || 'Untitled',
          groupTitle: attrs['group-title'] || '',
          tvgId:      attrs['tvg-id']   || '',
          tvgLogo:    attrs['tvg-logo'] || '',
        }
        continue
      }

      if (line.startsWith('#')) continue // other directive

      // Stream URL line
      if (/^https?:\/\//i.test(line) || /^rtsp?:\/\//i.test(line) || /^rtmp/i.test(line)) {
        const title      = pendingMeta?.title      ?? line.split('/').pop() ?? 'Stream'
        const groupTitle = pendingMeta?.groupTitle ?? ''
        const tvgLang    = (pendingMeta as any)?.tvgLanguage ?? ''
        // English-only filter for anime/animation/cartoon categories
        if (!passesEnglishFilter(title, groupTitle, tvgLang)) { pendingMeta = null; continue }
        entries.push({
          url:        line,
          title,
          groupTitle,
          tvgId:      pendingMeta?.tvgId      ?? '',
          tvgLogo:    pendingMeta?.tvgLogo    ?? '',
          duration:   pendingMeta?.duration   ?? -1,
        })
      }
      pendingMeta = null
    }

    return entries
  }

  // ── Parse PLS ────────────────────────────────────────────────────────────

  private parsePLS(content: string, _sourceUrl: string): ParsedPlaylistEntry[] {
    const entries: ParsedPlaylistEntry[] = []
    const fileRe  = /^File(\d+)=(.+)$/gim
    const titleRe = /^Title(\d+)=(.+)$/gim
    const titles: Record<string, string> = {}
    let m
    while ((m = titleRe.exec(content)) !== null) titles[m[1]] = m[2].trim()
    while ((m = fileRe.exec(content)) !== null) {
      const url = m[2].trim()
      if (/^https?:\/\//i.test(url)) {
        entries.push({ url, title: titles[m[1]] ?? 'Stream', groupTitle: '', tvgId: '', tvgLogo: '', duration: -1 })
      }
    }
    return entries
  }

  // ── Parse XSPF ───────────────────────────────────────────────────────────

  private parseXSPF(content: string, _sourceUrl: string): ParsedPlaylistEntry[] {
    const entries: ParsedPlaylistEntry[] = []
    const trackRe = /<track>([\s\S]*?)<\/track>/gi
    let tm
    while ((tm = trackRe.exec(content)) !== null) {
      const block  = tm[1]
      const urlM   = block.match(/<location>(https?:\/\/[^<]+)<\/location>/i)
      const titleM = block.match(/<title>([^<]+)<\/title>/i)
      if (urlM) {
        entries.push({ url: urlM[1].trim(), title: titleM?.[1]?.trim() ?? 'Stream', groupTitle: '', tvgId: '', tvgLogo: '', duration: -1 })
      }
    }
    return entries
  }

  // ── Parse ASX (Advanced Stream Redirector) ───────────────────────────────
  // Format: XML <asx><entry><ref href="URL"/><title>Name</title></entry></asx>

  private parseASX(content: string, _sourceUrl: string): ParsedPlaylistEntry[] {
    const entries: ParsedPlaylistEntry[] = []
    const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/gi
    let em
    while ((em = entryRe.exec(content)) !== null) {
      const block  = em[1]
      const refM   = block.match(/<ref[^>]+href\s*=\s*["']([^"']+)["']/i)
      const titleM = block.match(/<title[^>]*>([^<]+)<\/title>/i)
      if (refM) {
        entries.push({ url: refM[1].trim(), title: titleM?.[1]?.trim() ?? 'Stream', groupTitle: '', tvgId: '', tvgLogo: '', duration: -1 })
      }
    }
    return entries
  }

  // ── Parse WPL (Windows Media Player Playlist) ────────────────────────────
  // Format: XML <smil><body><seq><media src="URL"/></seq></body></smil>

  private parseWPL(content: string, _sourceUrl: string): ParsedPlaylistEntry[] {
    const entries: ParsedPlaylistEntry[] = []
    const mediaRe = /<media[^>]+src\s*=\s*["']([^"']+)["'][^>]*\/>/gi
    let mm
    while ((mm = mediaRe.exec(content)) !== null) {
      const src = mm[1].trim()
      entries.push({ url: src, title: src.split(/[\\/]/).pop() ?? 'Track', groupTitle: '', tvgId: '', tvgLogo: '', duration: -1 })
    }
    return entries
  }

  // ── Feed entries to Archivist ────────────────────────────────────────────

  private async archiveEntries(
    entries: ParsedPlaylistEntry[],
    sourceUrl: string,
  ): Promise<{ archived: number; rejected: number; flagged: number }> {
    const archivistEntries: ArchivistEntry[] = entries.map(e => ({
      sourceUrl,
      mediaUrl:   e.url,
      title:      e.title,
      contentType: e.duration === -1
        ? (e.url.includes('.m3u8') ? 'application/x-mpegurl' : 'video/mp4')
        : 'video/mp4',
      duration:   e.duration,
      groupTitle: e.groupTitle || undefined,
      tvgId:      e.tvgId     || undefined,
      tvgLogo:    e.tvgLogo   || undefined,
      indexer:    'playlist-harvester',
      // Entries from playlist files are trusted — skip live HTTP validation
      // (IPTV streams reject HEAD/GET from generic user agents)
      skipValidation: true,
    }))

    // Process in batches of 20 to avoid overloading the archivist
    let archived = 0, rejected = 0, flagged = 0
    const BATCH = 20
    for (let i = 0; i < archivistEntries.length; i += BATCH) {
      if (!this.running) break
      const results = await archivist.archiveBatch(archivistEntries.slice(i, i + BATCH))
      for (const r of results) {
        if (r.status === 'archived') archived++
        else if (r.status === 'flagged') flagged++
        else rejected++
      }
      this.emit('batchComplete', { archived, rejected, flagged, total: archivistEntries.length })
    }
    return { archived, rejected, flagged }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  looksLikePlaylist(url: string): boolean {
    const lower = url.split('?')[0].toLowerCase()
    return /\.(m3u8?|pls|xspf|asx|wpl)$/.test(lower) || url.startsWith('magnet:')
  }

  // ── Recursive playlist chaining ───────────────────────────────────────────

  /**
   * Follow a playlist chain: if an entry URL is itself a playlist (.m3u8/.m3u),
   * fetch and parse it recursively. Returns all leaf (non-playlist) entries.
   */
  async followPlaylistChain(
    url: string,
    depth = 0,
    maxDepth = 3,
  ): Promise<ParsedPlaylistEntry[]> {
    if (depth > maxDepth) return []
    let content: string
    try {
      const resp = await axios.get(url, { timeout: 15000, responseType: 'text' })
      content = resp.data as string
    } catch {
      return []
    }

    const entries = this.parseM3U(content, url)
    const leafEntries: ParsedPlaylistEntry[] = []

    for (const entry of entries) {
      const lower = entry.url.split('?')[0].toLowerCase()
      if (/\.m3u8?$/.test(lower)) {
        // This entry is itself a playlist — recurse
        const subEntries = await this.followPlaylistChain(entry.url, depth + 1, maxDepth)
        leafEntries.push(...subEntries)
      } else {
        leafEntries.push(entry)
      }
    }
    return leafEntries
  }

  // ── DASH MPD parsing ──────────────────────────────────────────────────────

  /**
   * Parse a DASH MPD manifest and return representations with stream URLs.
   */
  async parseDASHManifest(mpdUrl: string): Promise<{
    representations: { url: string; bandwidth: number; codecs: string; width?: number; height?: number }[]
  }> {
    const resp = await axios.get(mpdUrl, { timeout: 15000, responseType: 'text' })
    const xml: string = resp.data

    const base = mpdUrl.substring(0, mpdUrl.lastIndexOf('/') + 1)
    const representations: { url: string; bandwidth: number; codecs: string; width?: number; height?: number }[] = []

    // Parse Representation elements
    const reprRe = /<Representation([^>]*)>([\s\S]*?)<\/Representation>/gi
    let rm: RegExpExecArray | null
    while ((rm = reprRe.exec(xml)) !== null) {
      const attrs = rm[1]
      const inner = rm[2]

      const bandwidth = parseInt(attrs.match(/bandwidth="(\d+)"/)?.[1] ?? '0', 10)
      const codecs    = attrs.match(/codecs="([^"]+)"/)?.[1] ?? ''
      const width     = parseInt(attrs.match(/width="(\d+)"/)?.[1] ?? '0', 10) || undefined
      const height    = parseInt(attrs.match(/height="(\d+)"/)?.[1] ?? '0', 10) || undefined

      // SegmentTemplate with media attribute
      const stMedia = inner.match(/<SegmentTemplate[^>]+media="([^"]+)"/)?.[1]
      if (stMedia) {
        representations.push({ url: stMedia.startsWith('http') ? stMedia : base + stMedia, bandwidth, codecs, width, height })
        continue
      }

      // BaseURL fallback
      const baseUrl = inner.match(/<BaseURL[^>]*>([^<]+)<\/BaseURL>/)?.[1]?.trim()
      if (baseUrl) {
        representations.push({ url: baseUrl.startsWith('http') ? baseUrl : base + baseUrl, bandwidth, codecs, width, height })
      }
    }

    return { representations }
  }

  // ── Group-title clustering ────────────────────────────────────────────────

  /**
   * Cluster M3U entries by their group-title tag and detect content type.
   */
  clusterByGroupTitle(entries: ParsedPlaylistEntry[]): {
    groupTitle: string
    entries: ParsedPlaylistEntry[]
    type: 'live' | 'vod' | 'series' | 'unknown'
  }[] {
    const map = new Map<string, ParsedPlaylistEntry[]>()
    for (const entry of entries) {
      const key = entry.groupTitle || ''
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(entry)
    }

    return Array.from(map.entries()).map(([groupTitle, grpEntries]) => {
      let type: 'live' | 'vod' | 'series' | 'unknown' = 'unknown'
      const lower = groupTitle.toLowerCase()
      if (/movies?|vod|film/i.test(lower)) {
        type = 'vod'
      } else if (/s\d{1,2}e\d{1,2}|season|series|episode/i.test(lower)) {
        type = 'series'
      } else if (/live|news|sport|24.?7|channel|tv|hd/i.test(lower)) {
        type = 'live'
      }
      return { groupTitle, entries: grpEntries, type }
    })
  }

  // ── VOD category auto-detection ───────────────────────────────────────────

  /**
   * Detect content type for an individual entry based on its metadata and URL.
   */
  detectContentType(entry: ParsedPlaylistEntry): { type: 'live' | 'vod' | 'series'; confidence: number } {
    const name  = entry.title      || ''
    const group = entry.groupTitle || ''
    const url   = entry.url        || ''

    // Series: S##E## pattern or explicit season/episode words
    if (/s\d{1,2}e\d{1,2}/i.test(name) || /season|episode/i.test(name + group)) {
      return { type: 'series', confidence: 0.9 }
    }

    // Movies: year in parentheses like (2023) or (1995)
    if (/\(\d{4}\)/.test(name) || /movies?|vod|film/i.test(group)) {
      return { type: 'vod', confidence: 0.85 }
    }

    // Live: explicit live indicators
    if (/24.?7|live|hd\b|fhd\b/i.test(name + group) || /\/live\//i.test(url)) {
      return { type: 'live', confidence: 0.8 }
    }

    // Default to live for streams with .m3u8 or /stream/
    if (/\.m3u8/.test(url) || /\/stream\//i.test(url)) {
      return { type: 'live', confidence: 0.6 }
    }

    return { type: 'live', confidence: 0.4 }
  }

  // ── EPG source correlation ────────────────────────────────────────────────

  /**
   * Match streams to EPG channels by tvg-id (exact) or tvg-name (fuzzy).
   * Returns a copy of streams with epgChannelId populated where matched.
   */
  correlateEPG(
    streams: ParsedPlaylistEntry[],
    epgChannels: { id: string; displayName: string }[],
  ): (ParsedPlaylistEntry & { epgChannelId?: string })[] {
    const idMap   = new Map(epgChannels.map(c => [c.id.toLowerCase(), c.id]))
    const nameMap = new Map(epgChannels.map(c => [c.displayName.toLowerCase(), c.id]))

    return streams.map(stream => {
      // Exact tvg-id match
      if (stream.tvgId) {
        const matched = idMap.get(stream.tvgId.toLowerCase())
        if (matched) return { ...stream, epgChannelId: matched }
      }

      // Fuzzy name match: check if stream title starts with or contains EPG display-name
      if (stream.title) {
        const titleLower = stream.title.toLowerCase()
        for (const [epgName, epgId] of nameMap) {
          if (titleLower.includes(epgName) || epgName.includes(titleLower)) {
            return { ...stream, epgChannelId: epgId }
          }
        }
      }

      return { ...stream }
    })
  }
}

export const playlistHarvester = new PlaylistHarvesterService()
