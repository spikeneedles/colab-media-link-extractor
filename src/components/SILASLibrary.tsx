/**
 * SILASLibrary — Hulu-style media browser for the 3 master playlists.
 * Features: card grid, genre filter, sort, scrollbar, Adult tab with PIN gate.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FilmSlate, Television, Broadcast, Fire,
  Play, MagnifyingGlass, ArrowClockwise, Spinner, Crosshair,
  CaretDown, Lock, LockOpen, SortAscending, Eye, EyeSlash,
} from '@phosphor-icons/react'
import { ScrollArea } from '@/components/ui/scroll-area'  // kept for future use
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { AnimatePresence } from 'framer-motion'
import { getPlaylistUrl, getArchivistStats, fetchPoster, type ArchiveCategory, type PosterResult } from '@/lib/archivistClient'
import { FloatingPlayer, type PlayerMode } from './FloatingPlayer'

// ── Types ────────────────────────────────────────────────────────────────────

interface LibraryEntry {
  url:         string
  title:       string
  logo?:       string
  group:       string
  indexer:     string
  contentType: string
}

interface SILASLibraryProps {
  onCrawl?: () => void
}

type LibCat = ArchiveCategory | 'adult'
type SortKey = 'title-asc' | 'title-desc' | 'group-asc'

const ADULT_PIN = '1029'

// ── Category config ───────────────────────────────────────────────────────────

const CATS: Array<{ id: LibCat; label: string; Icon: React.ElementType; activeClass: string }> = [
  { id: 'movies',  label: 'Movies',  Icon: FilmSlate,  activeClass: 'text-amber-400  border-amber-400'  },
  { id: 'live_tv', label: 'Live TV', Icon: Broadcast,  activeClass: 'text-cyan-400   border-cyan-400'   },
  { id: 'series',  label: 'Series',  Icon: Television, activeClass: 'text-violet-400 border-violet-400' },
  { id: 'adult',   label: 'Adult',   Icon: Fire,       activeClass: 'text-rose-400   border-rose-400'   },
]

// Adult content detection — Prowlarr XXX category (100000) shows as indexer "Category 100000"
// Also catch common adult indexer name fragments
const ADULT_PATTERNS = [/100000/i, /xxx/i, /adult/i, /erotic/i, /porn/i, /nsfw/i]
function isAdult(entry: LibraryEntry) {
  return ADULT_PATTERNS.some(p => p.test(entry.indexer) || p.test(entry.group))
}

// ── M3U parser (preserves tvg-logo + indexer) ────────────────────────────────

function parseM3UFull(m3u: string): LibraryEntry[] {
  const lines = m3u.split('\n').map(l => l.trim()).filter(Boolean)
  const items: LibraryEntry[] = []
  let title = '', logo = '', group = '', indexer = '', ct = ''

  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      title   = line.includes(',') ? line.split(',').slice(1).join(',').trim() : 'Untitled'
      logo    = line.match(/tvg-logo="([^"]*)"/)?.[1]     ?? ''
      group   = line.match(/group-title="([^"]*)"/)?.[1]  ?? ''
      indexer = line.match(/indexer="([^"]*)"/)?.[1]      ?? ''
      ct      = line.match(/content-type="([^"]*)"/)?.[1] ?? ''
    } else if (!line.startsWith('#') && /^(https?|rtsp|rtmp):\/\//i.test(line)) {
      items.push({ url: line, title: title || 'Untitled', logo: logo || undefined, group, indexer, contentType: ct })
      title = ''; logo = ''; group = ''; indexer = ''; ct = ''
    }
  }
  return items
}

// ── Gradient palette ──────────────────────────────────────────────────────────

const GRADIENTS = [
  'from-purple-950 via-indigo-900  to-purple-900',
  'from-blue-950   via-cyan-900    to-blue-900',
  'from-rose-950   via-red-900     to-orange-900',
  'from-green-950  via-emerald-900 to-teal-900',
  'from-amber-950  via-yellow-900  to-orange-900',
  'from-pink-950   via-fuchsia-900 to-violet-900',
  'from-sky-950    via-blue-900    to-indigo-900',
  'from-teal-950   via-cyan-900    to-green-900',
]
function cardGradient(title: string) {
  return GRADIENTS[(title.charCodeAt(0) ?? 0) % GRADIENTS.length]
}

// ── MediaCard (lazy poster fetch via IntersectionObserver) ────────────────────

interface MediaCardProps {
  entry:   LibraryEntry
  index:   number
  cat:     LibCat
  onPlay:  (url: string, title: string) => void
}

function MediaCard({ entry, index, cat, onPlay }: MediaCardProps) {
  const cardRef                   = useRef<HTMLDivElement>(null)
  const [poster, setPoster]       = useState<PosterResult | null | 'loading'>('loading')
  const [imgErr,  setImgErr]      = useState(false)
  const [visible, setVisible]     = useState(false)
  const [vidThumb, setVidThumb]   = useState<string | null>(null)
  const thumbDone                 = useRef(false)

  // Trigger poster fetch once card scrolls into view
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { rootMargin: '200px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    if (cat === 'live_tv' && entry.logo) { setPoster(null); return }
    fetchPoster(entry.title).then(r => setPoster(r)).catch(() => setPoster(null))
  }, [visible, entry.title, entry.logo, cat])

  // Video frame extraction: fires only when TMDB came back null and there's no logo
  useEffect(() => {
    if (!visible)              return
    if (thumbDone.current)     return
    if (poster === 'loading')  return  // still waiting for TMDB
    if (poster?.posterUrl)     return  // TMDB found it
    if (entry.logo)            return  // M3U logo is fine
    if (!entry.url)            return  // no URL to extract from
    // Skip HLS manifests, DASH, RTSP/RTMP — can't seek reliably / no CORS
    if (/\.(m3u8|mpd)($|\?)/i.test(entry.url)) return
    if (/^(rtsp|rtmp):\/\//i.test(entry.url))  return
    // Skip anything that looks like a localhost/internal API URL (no real video content)
    if (/localhost|127\.0\.0\.1/i.test(entry.url)) return

    thumbDone.current = true

    const video  = document.createElement('video')
    const canvas = document.createElement('canvas')
    canvas.width  = 320
    canvas.height = 180
    video.crossOrigin = 'anonymous'
    video.muted       = true
    video.preload     = 'metadata'
    video.src         = entry.url

    // Use removeAttribute instead of src='' to avoid "Invalid URI" browser errors
    const cleanup = () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }

    // Abort after 12s to avoid dangling requests
    const timeout = setTimeout(() => { cleanup() }, 12_000)

    video.addEventListener('loadedmetadata', () => {
      // Seek to 10% of duration (min 5s, max 60s) — avoids black intros
      const seekTo = Math.min(Math.max(video.duration * 0.10, 5), 60)
      if (isNaN(seekTo) || seekTo <= 0) { cleanup(); clearTimeout(timeout); return }
      video.currentTime = seekTo
    })

    video.addEventListener('seeked', () => {
      clearTimeout(timeout)
      try {
        const ctx = canvas.getContext('2d')
        if (!ctx) return cleanup()
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        // Guard against tainted / blank frame (all-black dataURL is ~1.5KB)
        if (dataUrl.length > 5000) setVidThumb(dataUrl)
      } catch {
        // CORS tainted — silently fall back to gradient
      } finally {
        cleanup()
      }
    })

    video.addEventListener('error', () => { clearTimeout(timeout); cleanup() })
  }, [visible, poster, entry.logo, entry.url])

  // Priority: TMDB poster > video frame > M3U tvg-logo > gradient
  const resolvedPoster = poster === 'loading' ? null : poster
  const imgSrc = !imgErr
    ? (resolvedPoster?.posterUrl ?? vidThumb ?? entry.logo ?? null)
    : null

  return (
    <motion.div
      ref={cardRef}
      key={`${cat}-${index}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12, delay: Math.min(index * 0.006, 0.2) }}
      className="group relative cursor-pointer rounded-lg overflow-hidden bg-gray-900 hover:ring-2 hover:ring-purple-500/70 transition-all duration-200 hover:scale-[1.04] hover:z-10 shadow-md"
      onClick={() => onPlay(entry.url, entry.title)}
      title={entry.title}
    >
      {/* Poster area */}
      <div className={`aspect-video w-full relative bg-gradient-to-br ${cardGradient(entry.title)} flex items-center justify-center overflow-hidden`}>
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={entry.title}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <span className="text-4xl font-black text-white/15 select-none pointer-events-none">
            {entry.title.replace(/^(the|a|an)\s+/i, '').charAt(0).toUpperCase()}
          </span>
        )}
        {/* Hover play overlay */}
        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
          <div className="w-11 h-11 rounded-full bg-white shadow-xl flex items-center justify-center">
            <Play size={20} weight="fill" className="text-black ml-0.5" />
          </div>
        </div>
        {/* Rating badge (TMDB) */}
        {resolvedPoster?.rating != null && resolvedPoster.rating > 0 && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-bold text-yellow-400">
            ★ {resolvedPoster.rating.toFixed(1)}
          </div>
        )}
      </div>
      {/* Footer */}
      <div className="px-2 py-1.5">
        <p className="text-[11px] font-medium text-gray-200 line-clamp-2 leading-tight">
          {resolvedPoster?.tmdbTitle ?? entry.title}
          {resolvedPoster?.year && <span className="text-gray-500 font-normal ml-1">({resolvedPoster.year})</span>}
        </p>
        {entry.group && <p className="text-[9px] text-gray-600 mt-0.5 truncate">{entry.group}</p>}
      </div>
    </motion.div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SILASLibrary({ onCrawl }: SILASLibraryProps) {
  const [cat,           setCat]           = useState<LibCat>('movies')
  const [allEntries,    setAllEntries]    = useState<LibraryEntry[]>([])
  const [loading,       setLoading]       = useState(false)
  const [search,        setSearch]        = useState('')
  const [counts,        setCounts]        = useState<Partial<Record<ArchiveCategory, number>>>({})
  const [genre,         setGenre]         = useState('All')
  const [genreOpen,     setGenreOpen]     = useState(false)
  const [sortKey,       setSortKey]       = useState<SortKey>('title-asc')
  const [sortOpen,      setSortOpen]      = useState(false)
  const [adultUnlocked, setAdultUnlocked] = useState(false)
  const [pin,           setPin]           = useState('')
  const [pinError,      setPinError]      = useState(false)
  const [showPin,       setShowPin]       = useState(false)
  const pinRef = useRef<HTMLInputElement>(null)

  // ── Floating player state ───────────────────────────────────────────────────
  const [playerUrl,   setPlayerUrl]   = useState('')
  const [playerTitle, setPlayerTitle] = useState('')
  const [playerMode,  setPlayerMode]  = useState<PlayerMode>('closed')

  const openPlayer = useCallback((url: string, title: string) => {
    setPlayerUrl(url)
    setPlayerTitle(title)
    setPlayerMode('fullscreen')
  }, [])

  // ── Load playlists ──────────────────────────────────────────────────────────
  const loadCat = useCallback(async (category: LibCat) => {
    setLoading(true)
    setAllEntries([])
    setGenre('All')
    try {
      if (category === 'adult') {
        // Fetch from dedicated adult playlists
        const [m, t, s] = await Promise.all([
          fetch(getPlaylistUrl('adult_movies')).then(r => r.text()),
          fetch(getPlaylistUrl('adult_livetv')).then(r => r.text()),
          fetch(getPlaylistUrl('adult_series')).then(r => r.text()),
        ])
        const all = [...parseM3UFull(m), ...parseM3UFull(t), ...parseM3UFull(s)]
        setAllEntries(all)
      } else {
        const r = await fetch(getPlaylistUrl(category as ArchiveCategory))
        if (!r.ok) throw new Error()
        const entries = parseM3UFull(await r.text())
        setAllEntries(entries)
      }
    } catch { /* empty */ } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (cat === 'adult' && !adultUnlocked) return
    loadCat(cat)
  }, [cat, adultUnlocked, loadCat])

  // Load counts
  useEffect(() => {
    getArchivistStats().then(s => setCounts({
      movies:  s.playlists.movies.count,
      live_tv: s.playlists.live_tv.count,
      series:  s.playlists.series.count,
    })).catch(() => {})
  }, [])

  // Focus PIN input when adult tab selected
  useEffect(() => {
    if (cat === 'adult' && !adultUnlocked) {
      setTimeout(() => pinRef.current?.focus(), 50)
    }
  }, [cat, adultUnlocked])

  // ── Derived ─────────────────────────────────────────────────────────────────
  const genres = ['All', ...Array.from(new Set(allEntries.map(e => e.group).filter(Boolean))).sort()]

  const filtered = allEntries
    .filter(e => genre === 'All' || e.group === genre)
    .filter(e => !search.trim() || e.title.toLowerCase().includes(search.toLowerCase()) || e.group.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortKey === 'title-asc')  return a.title.localeCompare(b.title)
      if (sortKey === 'title-desc') return b.title.localeCompare(a.title)
      return a.group.localeCompare(b.group)
    })

  const handlePinSubmit = () => {
    if (pin === ADULT_PIN) {
      setAdultUnlocked(true)
      setPinError(false)
      setPin('')
    } else {
      setPinError(true)
      setPin('')
      setTimeout(() => setPinError(false), 1500)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-black text-white overflow-hidden">

      {/* ── Tab bar ── */}
      <div className="flex items-center border-b border-gray-800 px-4 shrink-0 bg-gray-950 gap-1">
        {CATS.map(c => (
          <button
            key={c.id}
            onClick={() => { setCat(c.id); setSearch('') }}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
              cat === c.id ? c.activeClass : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            <c.Icon size={15} weight={cat === c.id ? 'fill' : 'regular'} />
            {c.label}
            {c.id !== 'adult' && counts[c.id as ArchiveCategory] != null && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400 font-normal ml-0.5">
                {counts[c.id as ArchiveCategory]!.toLocaleString()}
              </span>
            )}
            {c.id === 'adult' && (
              adultUnlocked
                ? <LockOpen size={11} className="text-rose-400 ml-0.5" />
                : <Lock size={11} className="text-gray-600 ml-0.5" />
            )}
          </button>
        ))}

        <div className="flex-1" />

        {/* Genre dropdown */}
        {cat !== 'adult' || adultUnlocked ? (
          <div className="relative mr-2">
            <button
              onClick={() => { setGenreOpen(o => !o); setSortOpen(false) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <span>{genre === 'All' ? 'All Genres' : genre}</span>
              <CaretDown size={11} className={`transition-transform ${genreOpen ? 'rotate-180' : ''}`} />
            </button>
            {genreOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 max-h-64 overflow-y-auto bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
                {genres.map(g => (
                  <button
                    key={g}
                    onClick={() => { setGenre(g); setGenreOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors ${genre === g ? 'text-white font-semibold bg-white/5' : 'text-gray-400'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Sort dropdown */}
        {cat !== 'adult' || adultUnlocked ? (
          <div className="relative mr-2">
            <button
              onClick={() => { setSortOpen(o => !o); setGenreOpen(false) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <SortAscending size={13} />
              <CaretDown size={11} className={`transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
                {([['title-asc', 'Title A–Z'], ['title-desc', 'Title Z–A'], ['group-asc', 'By Genre']] as [SortKey, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setSortKey(key); setSortOpen(false) }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors ${sortKey === key ? 'text-white font-semibold bg-white/5' : 'text-gray-400'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Search */}
        {(cat !== 'adult' || adultUnlocked) && (
          <div className="relative w-48 mr-1">
            <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search library…"
              className="h-7 pl-7 text-xs bg-gray-900 border-gray-700 text-gray-100 placeholder:text-gray-600 focus-visible:ring-purple-500/40"
            />
          </div>
        )}

        <button onClick={() => cat !== 'adult' || adultUnlocked ? loadCat(cat) : undefined} title="Refresh" className="p-1.5 text-gray-500 hover:text-white transition-colors">
          <ArrowClockwise size={14} className={loading ? 'animate-spin' : ''} />
        </button>

        {onCrawl && (
          <Button variant="outline" size="sm" onClick={onCrawl} className="gap-1.5 text-xs border-green-700 text-green-400 hover:bg-green-500/10 ml-1">
            <Crosshair size={14} weight="bold" />
            Crawl
          </Button>
        )}
      </div>

      {/* ── Adult PIN gate ── */}
      {cat === 'adult' && !adultUnlocked ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          <div className="flex flex-col items-center gap-2 mb-2">
            <Lock size={44} className="text-rose-500/60" weight="duotone" />
            <p className="text-lg font-bold text-gray-200">Adult Content</p>
            <p className="text-xs text-gray-500">Enter your PIN to unlock</p>
          </div>
          <div className="relative">
            <Input
              ref={pinRef}
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
              placeholder="Password"
              maxLength={8}
              className={`w-52 h-10 text-center text-lg tracking-[0.4em] bg-gray-900 border-2 transition-colors pr-10 ${
                pinError ? 'border-red-500 animate-pulse' : 'border-gray-700 focus-visible:border-rose-500'
              }`}
            />
            <button
              onClick={() => setShowPin(s => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              {showPin ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {pinError && <p className="text-xs text-red-400 -mt-2">Incorrect PIN</p>}
          <Button onClick={handlePinSubmit} className="bg-rose-600 hover:bg-rose-500 text-white w-52">
            Unlock
          </Button>
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Spinner size={36} className="animate-spin text-purple-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-600">
          <FilmSlate size={52} weight="thin" />
          <p className="text-sm">{search ? 'No results for that search' : 'No entries yet — crawler is building your library…'}</p>
        </div>
      ) : (

        /* ── Grid with scrollbar ── */
        <div className="flex-1 overflow-y-auto overflow-x-hidden silas-scrollbar">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 p-4">
            {filtered.map((entry, i) => (
              <MediaCard key={`${cat}-${entry.url}-${i}`} entry={entry} index={i} cat={cat} onPlay={openPlayer} />
            ))}
          </div>
        </div>
      )}

      {/* ── Floating video player ── */}
      <AnimatePresence>
        {playerMode !== 'closed' && (
          <FloatingPlayer
            key="floating-player"
            url={playerUrl}
            title={playerTitle}
            mode={playerMode}
            onMode={setPlayerMode}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
