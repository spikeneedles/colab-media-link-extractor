/**
 * SeriesBrowser — Netflix/Hulu-style TV series grid browser
 *
 * Fetches the archived series M3U playlist, groups entries by show name,
 * renders a card grid. Clicking a show reveals the episode list. Each
 * episode has a play button that fires onPlayEpisode.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Input }       from '@/components/ui/input'
import { Button }      from '@/components/ui/button'
import { Badge }       from '@/components/ui/badge'
import {
  Play, ArrowLeft, Television, MagnifyingGlass,
  ArrowClockwise, FilmStrip,
} from '@phosphor-icons/react'
import { toast } from 'sonner'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002'

// ── Deterministic card gradients ──────────────────────────────────────────────

const GRADIENTS = [
  ['#4c1d95', '#1e1b4b'], // violet → indigo
  ['#1e3a5f', '#0c4a6e'], // navy → sky
  ['#7f1d1d', '#4c0519'], // red → rose
  ['#14532d', '#064e3b'], // green → emerald
  ['#78350f', '#451a03'], // amber → orange
  ['#3b0764', '#500724'], // purple → rose
  ['#0f172a', '#1e3a5f'], // slate → navy
  ['#1a1a2e', '#16213e'], // dark blue
  ['#2d1b69', '#11998e'], // purple → teal
  ['#373b44', '#4286f4'], // charcoal → blue
]

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
function gradientFor(name: string) {
  return GRADIENTS[hashStr(name) % GRADIENTS.length]
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Episode {
  url:      string
  title:    string
  showName: string
  season:   number
  episode:  number
  epTitle:  string
}

interface Show {
  name:     string
  episodes: Episode[]
}

// ── M3U parser helpers ────────────────────────────────────────────────────────

function parseEpisode(title: string, url: string): Episode {
  // SxxExx
  const m = title.match(/^(.+?)\s*[Ss](\d{1,2})[Ee](\d{1,2})\s*[-–]?\s*(.*)$/)
  if (m) return { url, title, showName: m[1].trim(), season: +m[2], episode: +m[3], epTitle: m[4].trim() }
  // NxNN
  const m2 = title.match(/^(.+?)\s*(\d{1,2})[xX](\d{1,2})\s*[-–]?\s*(.*)$/)
  if (m2) return { url, title, showName: m2[1].trim(), season: +m2[2], episode: +m2[3], epTitle: m2[4].trim() }
  return { url, title, showName: title, season: 0, episode: 0, epTitle: '' }
}

function parseM3UToEpisodes(text: string): Episode[] {
  const episodes: Episode[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  let pendingTitle = ''
  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      pendingTitle = line.includes(',') ? line.split(',').slice(1).join(',').trim() : ''
    } else if (!line.startsWith('#') && /^https?:\/\//i.test(line)) {
      if (pendingTitle) episodes.push(parseEpisode(pendingTitle, line))
      pendingTitle = ''
    }
  }
  return episodes
}

function groupIntoShows(episodes: Episode[]): Show[] {
  const map = new Map<string, Episode[]>()
  for (const ep of episodes) {
    const arr = map.get(ep.showName) ?? []
    arr.push(ep)
    map.set(ep.showName, arr)
  }
  return Array.from(map.entries())
    .map(([name, eps]) => ({
      name,
      episodes: eps.sort((a, b) =>
        a.season !== b.season ? a.season - b.season : a.episode - b.episode,
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SeriesBrowserProps {
  onPlayEpisode: (url: string, title: string) => void
  currentUrl?:   string
}

export function SeriesBrowser({ onPlayEpisode, currentUrl }: SeriesBrowserProps) {
  const [shows,        setShows]        = useState<Show[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [selectedShow, setSelectedShow] = useState<Show | null>(null)
  const [epSearch,     setEpSearch]     = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${BACKEND}/api/archivist/playlist/series`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const text  = await r.text()
      const eps   = parseM3UToEpisodes(text)
      setShows(groupIntoShows(eps))
    } catch (e: any) {
      toast.error(`Series library: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filteredShows = useMemo(
    () => shows.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase())),
    [shows, search],
  )

  const filteredEps = useMemo(
    () => (selectedShow?.episodes ?? []).filter(e =>
      !epSearch || e.title.toLowerCase().includes(epSearch.toLowerCase()),
    ),
    [selectedShow, epSearch],
  )

  // ── Episode list ────────────────────────────────────────────────────────────

  if (selectedShow) {
    const [c1, c2] = gradientFor(selectedShow.name)
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-gray-950">
        {/* Show banner */}
        <div
          className="shrink-0 px-4 pt-4 pb-4 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelectedShow(null); setEpSearch('') }}
              className="h-7 px-2 mb-2 text-white/70 hover:text-white hover:bg-white/10 -ml-1"
            >
              <ArrowLeft size={13} className="mr-1" /> All Shows
            </Button>
            <h2 className="text-lg font-bold text-white leading-tight">{selectedShow.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="text-[9px] bg-white/10 text-white/70 border-white/20">
                {selectedShow.episodes.length} episodes
              </Badge>
              {selectedShow.episodes[0]?.season > 0 && (
                <Badge className="text-[9px] bg-white/10 text-white/70 border-white/20">
                  {[...new Set(selectedShow.episodes.map(e => e.season))].length} seasons
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Episode search */}
        <div className="shrink-0 px-3 py-2 border-b border-gray-800 bg-gray-900/50">
          <div className="relative">
            <MagnifyingGlass size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <Input
              value={epSearch}
              onChange={e => setEpSearch(e.target.value)}
              placeholder="Search episodes…"
              className="h-7 text-xs bg-gray-900 border-gray-700 pl-7"
            />
          </div>
        </div>

        {/* Episode rows */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-2 flex flex-col gap-0.5">
            {filteredEps.map((ep, i) => {
              const isPlaying = ep.url === currentUrl
              return (
                <button
                  key={i}
                  onClick={() => onPlayEpisode(ep.url, ep.title)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left group transition-all border ${
                    isPlaying
                      ? 'bg-purple-500/15 border-purple-500/30'
                      : 'border-transparent hover:bg-white/5 hover:border-white/10'
                  }`}
                >
                  {/* Ep number / play indicator */}
                  <div className={`shrink-0 w-9 h-9 rounded-md flex items-center justify-center transition-colors ${
                    isPlaying ? 'bg-purple-500/30' : 'bg-gray-800 group-hover:bg-purple-500/20'
                  }`}>
                    {isPlaying
                      ? <Play size={13} weight="fill" className="text-purple-400 ml-0.5" />
                      : ep.season > 0
                        ? <span className="text-[9px] font-bold text-gray-500 group-hover:text-purple-400">
                            {String(ep.episode).padStart(2, '0')}
                          </span>
                        : <FilmStrip size={13} className="text-gray-500 group-hover:text-purple-400" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    {ep.season > 0 && (
                      <span className={`text-[9px] font-mono mr-1.5 ${isPlaying ? 'text-purple-400' : 'text-gray-500'}`}>
                        S{String(ep.season).padStart(2,'0')}E{String(ep.episode).padStart(2,'0')}
                      </span>
                    )}
                    <span className={`text-xs font-medium truncate ${isPlaying ? 'text-purple-300' : 'text-gray-200'}`}>
                      {ep.epTitle || ep.title}
                    </span>
                  </div>

                  <Play
                    size={11}
                    weight="fill"
                    className={`shrink-0 transition-colors ${
                      isPlaying ? 'text-purple-400' : 'text-gray-700 group-hover:text-purple-400'
                    }`}
                  />
                </button>
              )
            })}

            {filteredEps.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-10">No episodes match</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Show grid ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-950">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Television size={15} className="text-purple-400" />
            <span className="text-sm font-semibold text-white">Series Library</span>
            {!loading && shows.length > 0 && (
              <Badge variant="outline" className="text-[9px] border-gray-700 text-gray-400">
                {shows.length} shows · {shows.reduce((n, s) => n + s.episodes.length, 0)} eps
              </Badge>
            )}
          </div>
          <Button
            variant="ghost" size="sm"
            onClick={load} disabled={loading}
            className="h-7 w-7 p-0 text-gray-500 hover:text-white"
          >
            <ArrowClockwise size={13} className={loading ? 'animate-spin text-purple-400' : ''} />
          </Button>
        </div>
        <div className="relative">
          <MagnifyingGlass size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search shows…"
            className="h-8 text-xs bg-gray-900 border-gray-700 pl-7 placeholder:text-gray-600"
          />
        </div>
      </div>

      {/* Card grid */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-500 text-xs gap-2">
            <ArrowClockwise size={15} className="animate-spin text-purple-400" />
            Loading series library…
          </div>
        ) : filteredShows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-600 px-6 text-center">
            <Television size={40} weight="thin" />
            <p className="text-sm text-gray-500">
              {search ? `No shows match "${search}"` : 'No series archived yet'}
            </p>
            {!search && (
              <p className="text-xs text-gray-700">
                Run the Harvest tab to populate your series library
              </p>
            )}
          </div>
        ) : (
          <div className="p-3 grid grid-cols-3 gap-2">
            {filteredShows.map(show => {
              const [c1, c2] = gradientFor(show.name)
              const seasons  = [...new Set(show.episodes.map(e => e.season))].filter(s => s > 0)
              return (
                <button
                  key={show.name}
                  onClick={() => setSelectedShow(show)}
                  className="group relative rounded-xl overflow-hidden aspect-video text-left
                             hover:ring-2 hover:ring-purple-500/70 transition-all duration-200
                             hover:scale-[1.03] hover:shadow-xl hover:shadow-purple-900/30 focus:outline-none"
                  style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
                >
                  {/* Subtle noise texture overlay */}
                  <div className="absolute inset-0 opacity-20"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")' }}
                  />
                  {/* Bottom gradient for text legibility */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                  {/* Hover play button */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center
                                    ring-2 ring-white/30 group-hover:scale-110 transition-transform">
                      <Play size={14} weight="fill" className="text-white ml-0.5" />
                    </div>
                  </div>

                  {/* Text overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-[10px] font-bold text-white leading-tight line-clamp-2 drop-shadow">
                      {show.name}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[8px] text-white/50">
                        {show.episodes.length} ep{show.episodes.length !== 1 ? 's' : ''}
                        {seasons.length > 0 ? ` · ${seasons.length} season${seasons.length !== 1 ? 's' : ''}` : ''}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
