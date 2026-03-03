import { useState, useEffect, useCallback, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  FilmSlate, Broadcast, Television, Spinner,
  Play, Pause, SkipBack, SkipForward, SpeakerHigh,
  SpeakerSlash, ArrowsOut, X, List, Lightning, SquaresFour, Crosshair,
} from '@phosphor-icons/react'
import { UniversalSearchPanel } from '@/components/UniversalSearchPanel'
import { AutomationPanel }     from '@/components/AutomationPanel'
import { PlaylistHarvester }   from '@/components/PlaylistHarvester'
import { SeriesBrowser }       from '@/components/SeriesBrowser'
import { SILASLibrary }        from '@/components/SILASLibrary'
import { SiteIndexCrawler }    from '@/components/SiteIndexCrawler'
import { fetchPlaylistAsQueue, type ArchiveCategory, type PlaylistQueueItem } from '@/lib/archivistClient'
import { detectUrlType, fetchAndExpandPlaylist } from '@/lib/playlistParser'
import type { QueueItem } from '@/components/MediaPlayer'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3002'

function needsDebrid(url: string): boolean {
  if (!url) return false
  return (
    /^magnet:/i.test(url) ||
    /\.torrent(\?|$)/i.test(url) ||
    (/localhost:\d+\/.*download\?/.test(url) && url.includes('apikey'))
  )
}

async function resolveViaRD(url: string): Promise<string | null> {
  try {
    const type = detectUrlType(url)
    let endpoint: string
    let body: Record<string, string>

    if (type === 'magnet') {
      endpoint = '/api/realdebrid/resolve'
      body = { magnet: url }
    } else if (type === 'torrent') {
      endpoint = '/api/realdebrid/resolve-torrent'
      body = { torrentUrl: url }
    } else {
      endpoint = '/api/realdebrid/unrestrict'
      body = { link: url }
    }

    const r = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) return null
    const data = await r.json()
    return data.streamUrl ?? data.download ?? null
  } catch {
    return null
  }
}

// ── Inline player (no Dialog wrapper) ────────────────────────────────────────

function InlinePlayer({
  queue, index, onIndexChange, onClose,
}: {
  queue: QueueItem[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
}) {
  const item       = queue[index]
  const videoRef   = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying]   = useState(false)
  const [muted,   setMuted]     = useState(false)
  const [volume,  setVolume]    = useState(0.8)
  const [current, setCurrent]   = useState(0)
  const [dur,     setDur]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState<string | null>(null)
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [rdResolving, setRdResolving] = useState(false)

  // When item changes: reset state and auto-resolve via RD if needed
  useEffect(() => {
    setPlaying(false); setCurrent(0); setDur(0)
    setLoading(true);  setError(null); setResolvedUrl(null)

    const raw = item?.url ?? ''
    if (!raw) return

    if (needsDebrid(raw)) {
      setRdResolving(true)
      setLoading(true)
      resolveViaRD(raw).then(url => {
        setRdResolving(false)
        if (url) {
          setResolvedUrl(url)
        } else {
          setLoading(false)
          setError('Real-Debrid could not resolve this link. Check your RD API key or wait for the torrent to be cached.')
        }
      })
    }
  }, [index, item?.url])

  const playUrl = resolvedUrl ?? item?.url ?? ''

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00'
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    playing ? v.pause() : v.play().catch(() => {})
  }

  return (
    <div className="h-full flex flex-col bg-black text-white">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <FilmSlate size={14} className="text-purple-400 shrink-0" />
        <span className="text-xs font-medium truncate flex-1">{item?.title ?? 'Unknown'}</span>
        {resolvedUrl && (
          <Badge className="text-[9px] py-0 px-1 bg-yellow-500/20 text-yellow-300 border-yellow-500/30 shrink-0 flex items-center gap-0.5">
            <Lightning size={8} weight="fill" /> RD
          </Badge>
        )}
        <Badge className="text-[10px] py-0 px-1.5 bg-gray-700 text-gray-300 shrink-0">
          {index + 1}/{queue.length}
        </Badge>
        <button onClick={onClose} className="text-gray-500 hover:text-white shrink-0">
          <X size={14} />
        </button>
      </div>

      {/* Video */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {rdResolving && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 z-10">
            <Lightning size={28} className="text-yellow-400 animate-pulse" weight="fill" />
            <Spinner size={20} className="animate-spin text-yellow-400" />
            <span className="text-xs text-yellow-300">Resolving via Real-Debrid…</span>
          </div>
        )}
        {!rdResolving && loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 z-10">
            <Spinner size={28} className="animate-spin text-purple-400" />
            <span className="text-xs">Loading media…</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 z-10 px-4">
            <X size={28} className="text-red-400" />
            <span className="text-xs text-center text-red-300">{error}</span>
            <Button size="sm" variant="outline" className="text-xs mt-1" onClick={() => { setError(null); setLoading(true); videoRef.current?.load() }}>
              Retry
            </Button>
          </div>
        )}
        <video
          ref={videoRef}
          src={rdResolving ? undefined : playUrl}
          className="w-full h-full object-contain"
          style={{ opacity: rdResolving || loading || error ? 0 : 1 }}
          muted={muted}
          onLoadedMetadata={e => { setDur((e.target as HTMLVideoElement).duration); setLoading(false) }}
          onTimeUpdate={e => setCurrent((e.target as HTMLVideoElement).currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { if (index < queue.length - 1) onIndexChange(index + 1) }}
          onError={() => { setError('Could not load media — if this is a torrent/magnet, Real-Debrid may still be processing it'); setLoading(false) }}
          onWaiting={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
        />
      </div>

      {/* Controls */}
      <div className="shrink-0 bg-gray-900 border-t border-gray-800 px-3 py-2 space-y-2">
        {/* Progress */}
        <div className="flex items-center gap-2 text-[10px] text-gray-400">
          <span className="w-8 text-right">{fmt(current)}</span>
          <Slider
            value={[current]}
            min={0} max={dur || 100} step={0.5}
            onValueChange={([v]) => { const vid = videoRef.current; if (vid) vid.currentTime = v; setCurrent(v) }}
            className="flex-1 h-1"
          />
          <span className="w-8">{fmt(dur)}</span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* volume */}
            <button onClick={() => { setMuted(m => !m); const v = videoRef.current; if (v) v.muted = !muted }} className="text-gray-400 hover:text-white p-1">
              {muted ? <SpeakerSlash size={14} /> : <SpeakerHigh size={14} />}
            </button>
            <Slider
              value={[muted ? 0 : volume]}
              min={0} max={1} step={0.05}
              onValueChange={([v]) => { setVolume(v); const vid = videoRef.current; if (vid) { vid.volume = v; vid.muted = v === 0 }; setMuted(v === 0) }}
              className="w-16 h-1"
            />
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={index === 0} onClick={() => onIndexChange(index - 1)}>
              <SkipBack size={14} />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={togglePlay}>
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={index >= queue.length - 1} onClick={() => onIndexChange(index + 1)}>
              <SkipForward size={14} />
            </Button>
          </div>

          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-gray-400 hover:text-white"
            onClick={() => videoRef.current?.requestFullscreen().catch(() => {})}>
            <ArrowsOut size={14} />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Pillar config ─────────────────────────────────────────────────────────────

const PILLARS: Array<{
  id:    ArchiveCategory
  label: string
  icon:  React.ReactNode
  color: string
  ring:  string
}> = [
  { id: 'movies',  label: 'Movies',  icon: <FilmSlate  size={14} />, color: 'border-amber-500/50 text-amber-300 hover:bg-amber-500/10',  ring: 'ring-amber-400/50'  },
  { id: 'live_tv', label: 'Live TV', icon: <Broadcast  size={14} />, color: 'border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10',     ring: 'ring-cyan-400/50'   },
  { id: 'series',  label: 'Series',  icon: <Television size={14} />, color: 'border-violet-500/50 text-violet-300 hover:bg-violet-500/10', ring: 'ring-violet-400/50' },
]

// ── HomePage ──────────────────────────────────────────────────────────────────

export function HomePage() {
  const [queue, setQueue]                       = useState<QueueItem[]>([])
  const [playlistItems, setPlaylistItems]       = useState<PlaylistQueueItem[]>([])
  const [queueIndex, setQueueIndex]             = useState(0)
  const [activePlaylist, setActivePlaylist]     = useState<ArchiveCategory | null>(null)
  const [loadingPlaylist, setLoadingPlaylist]   = useState<ArchiveCategory | null>(null)
  const [showList, setShowList]                 = useState(false)
  const [filterText, setFilterText]             = useState('')
  const [rightTab, setRightTab] = useState<'search' | 'automation' | 'harvest' | 'series' | 'site'>('search')
  const [view, setView] = useState<'crawl' | 'library'>('crawl')

  // ── Universal play handler — expands playlists, passes others straight to queue
  const handlePlayUrl = useCallback(async (url: string, title?: string) => {
    const type = detectUrlType(url)

    // Playlist URL → fetch, parse, load as queue
    if (type === 'm3u' || type === 'pls' || type === 'xspf') {
      toast.info(`Fetching ${type.toUpperCase()} playlist…`)
      const expanded = await fetchAndExpandPlaylist(url)
      if (expanded && expanded.length > 0) {
        setQueue(expanded)
        setQueueIndex(0)
        setActivePlaylist(null)
        setShowList(false)
        toast.success(`Loaded ${expanded.length} tracks from ${type.toUpperCase()} playlist`)
      } else {
        // Couldn't parse — try playing directly as a stream
        setQueue([{ url, title: title || url, mediaType: 'video' }])
        setQueueIndex(0)
        setActivePlaylist(null)
        setShowList(false)
        toast.warning('Could not parse playlist — attempting direct playback')
      }
      return
    }

    // Magnet / torrent / direct stream → let InlinePlayer handle RD resolution
    setQueue(q => {
      const exists = q.findIndex(i => i.url === url)
      if (exists >= 0) { setQueueIndex(exists); return q }
      const next = [...q, { url, title: title || url, mediaType: 'video' as const }]
      setQueueIndex(next.length - 1)
      return next
    })
    setActivePlaylist(null)
    setShowList(false)
  }, [])

  const loadPlaylist = useCallback(async (cat: ArchiveCategory) => {
    // If already active, toggle list view
    if (activePlaylist === cat && queue.length > 0) {
      setShowList(s => !s)
      return
    }
    setLoadingPlaylist(cat)
    try {
      const items = await fetchPlaylistAsQueue(cat)
      if (items.length === 0) {
        toast.info(`No entries archived in ${cat} yet — archive media to populate this playlist`)
        setPlaylistItems([])
        return
      }
      setPlaylistItems(items)
      setQueue(items.map(i => ({ url: i.url, title: i.title, mediaType: i.type })))
      setQueueIndex(0)
      setActivePlaylist(cat)
      setShowList(true)
      toast.success(`Loaded ${items.length} items from ${cat}`)
    } catch {
      toast.error(`Failed to load ${cat} playlist`)
    } finally {
      setLoadingPlaylist(null)
    }
  }, [activePlaylist, queue.length])

  useEffect(() => { loadPlaylist('movies') }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full h-screen bg-black text-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-5 py-3 bg-gray-950 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <FilmSlate size={28} className="text-purple-500" weight="duotone" />
          <div>
            <h1 className="text-xl font-bold bg-linear-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent leading-none">
              SILAS — Media Dashboard
            </h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Archivist Protocol · Three Pillars · Universal Search</p>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {/* Library toggle — switches full window to browse view */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView(v => v === 'library' ? 'crawl' : 'library')}
            className={`gap-1.5 text-xs border transition-colors ${
              view === 'library'
                ? 'border-purple-500 text-purple-300 bg-purple-500/10 ring-1 ring-purple-400/50'
                : 'border-gray-700 text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <SquaresFour size={14} weight={view === 'library' ? 'fill' : 'regular'} />
            Library
          </Button>

          <div className="w-px h-4 bg-gray-700 mx-1" />
          {PILLARS.map(p => (
            <Button
              key={p.id}
              variant="outline"
              size="sm"
              className={`gap-1.5 text-xs border ${p.color} ${activePlaylist === p.id ? `ring-1 ${p.ring}` : ''}`}
              onClick={() => loadPlaylist(p.id)}
              disabled={loadingPlaylist === p.id}
            >
              {loadingPlaylist === p.id ? <Spinner size={12} className="animate-spin" /> : p.icon}
              {p.label}
              {activePlaylist === p.id && queue.length > 0 && (
                <Badge className="ml-1 text-[9px] py-0 px-1 bg-white/10">{queue.length}</Badge>
              )}
            </Button>
          ))}
          {queue.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className={`gap-1 text-xs px-2 ${showList ? 'text-white' : 'text-gray-500'}`}
              onClick={() => setShowList(s => !s)}
              title="Toggle playlist list"
            >
              <List size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Body — switches between Library (full window) and Crawl (split) */}
      {view === 'library' ? (
        <SILASLibrary
          onCrawl={() => setView('crawl')}
        />
      ) : (
      <div className="flex-1 overflow-hidden grid grid-cols-2 gap-0">
        {/* Left: player + optional playlist list */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="h-full border-r border-gray-800 overflow-hidden flex flex-col"
        >
          {queue.length > 0 ? (
            <>
              {/* Player — shrinks when list is shown */}
              <div className={`${showList ? 'flex-[0_0_55%]' : 'flex-1'} overflow-hidden min-h-0`}>
                <InlinePlayer
                  queue={queue}
                  index={queueIndex}
                  onIndexChange={setQueueIndex}
                  onClose={() => { setQueue([]); setActivePlaylist(null); setShowList(false) }}
                />
              </div>

              {/* Playlist list panel */}
              {showList && (
                <div className="flex-1 min-h-0 border-t border-gray-800 bg-gray-950 flex flex-col">
                  <div className="px-3 py-1.5 border-b border-gray-800 flex items-center justify-between shrink-0">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      {PILLARS.find(p => p.id === activePlaylist)?.label ?? 'Playlist'} — {playlistItems.length} items
                    </span>
                    <button onClick={() => setShowList(false)} className="text-gray-600 hover:text-white">
                      <X size={12} />
                    </button>
                  </div>
                  {/* Title filter */}
                  <div className="px-2 py-1.5 border-b border-gray-800 shrink-0">
                    <Input
                      value={filterText}
                      onChange={e => setFilterText(e.target.value)}
                      placeholder="Filter by title…"
                      className="h-6 text-[11px] bg-gray-900 border-gray-700 text-gray-100 placeholder:text-gray-600"
                    />
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="flex flex-col">
                      {playlistItems
                        .map((item, i) => ({ item, i }))
                        .filter(({ item }) => !filterText || item.title.toLowerCase().includes(filterText.toLowerCase()))
                        .map(({ item, i }) => (
                        <button
                          key={i}
                          onClick={() => setQueueIndex(i)}
                          className={`flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5 border-b border-gray-800/50 ${
                            i === queueIndex ? 'bg-white/10' : ''
                          }`}
                        >
                          <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                            i === queueIndex ? 'bg-purple-500 text-white' : 'bg-gray-800 text-gray-500'
                          }`}>
                            {i === queueIndex ? <Play size={8} weight="fill" /> : i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate text-gray-200">{item.title}</p>
                            {item.category && (
                              <p className="text-[9px] text-gray-600 truncate">{item.category}</p>
                            )}
                          </div>
                          {needsDebrid(item.url) && (
                            <Lightning size={10} className="text-yellow-400 shrink-0" weight="fill" />
                          )}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-600 px-8">
              <FilmSlate size={56} weight="thin" />
              <p className="text-sm text-center">Select Movies, Live TV, or Series above to start playback</p>
              <p className="text-xs text-gray-700 text-center">
                Archive media via the Archivist Protocol to populate these playlists
              </p>
            </div>
          )}
        </motion.div>

        {/* Right: tabs */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 }}
          className="h-full overflow-hidden bg-gray-950 flex flex-col"
        >
          {/* Tab bar */}
          <div className="flex border-b border-gray-800 shrink-0">
            {(['search', 'automation', 'harvest', 'series', 'site'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  rightTab === tab
                    ? 'text-white border-b-2 border-purple-500'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab === 'search' ? '🔍 Search' : tab === 'automation' ? '⚙ Auto' : tab === 'harvest' ? '📡 Harvest' : tab === 'series' ? '📺 Series' : '🌐 Site'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {rightTab === 'search' ? (
              <UniversalSearchPanel
                onPlay={(item) => handlePlayUrl(item.url, item.title)}
              />
            ) : rightTab === 'automation' ? (
              <AutomationPanel />
            ) : rightTab === 'harvest' ? (
              <PlaylistHarvester />
            ) : rightTab === 'site' ? (
              <SiteIndexCrawler />
            ) : (
              <SeriesBrowser
                currentUrl={queue[queueIndex]?.url}
                onPlayEpisode={(url, title) => handlePlayUrl(url, title)}
              />
            )}
          </div>
        </motion.div>
      </div>
      )} {/* end view === 'crawl' */}
    </div>
  )
}
