/**
 * LibraryPanel — View all saved downloads and archived playlists (SILAS)
 *
 * Shows:
 *  1. Archivist M3U playlists (Movies / Live TV / Series) with entry counts
 *  2. Saved search result snapshots from backend/downloads/
 */

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FilmSlate, Television, MusicNote, Archive,
  DownloadSimple, Play, ArrowClockwise, FolderOpen,
  Image, Globe, Clock,
} from '@phosphor-icons/react'
import { toast } from 'sonner'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002'

// ── Types ────────────────────────────────────────────────────────────────────

interface PlaylistStats {
  count: number
  sizeBytes: number
}

interface ArchivistStats {
  archived: number
  rejected: number
  flagged: number
  playlists: {
    movies: PlaylistStats
    live_tv: PlaylistStats
    series: PlaylistStats
  }
}

interface DownloadEntry {
  id: string
  title: string
  source: string
  searchQuery: string
  downloadedAt: string
  totalItems: number
  withMedia: boolean
  exists: boolean
  actualSize: number
}

interface SearchResult {
  url: string
  title?: string
  thumbnail?: string
  metadata?: { duration?: string; title?: string }
  mediaUrls?: string[]
}

interface LibraryPanelProps {
  onPlay?: (url: string, title?: string) => void
}

// ── Pillar config ─────────────────────────────────────────────────────────────

const PILLARS = [
  { id: 'movies',  label: 'Movies',   icon: FilmSlate,   color: 'text-blue-400',   border: 'border-blue-500/30' },
  { id: 'live_tv', label: 'Live TV',  icon: Television,  color: 'text-green-400',  border: 'border-green-500/30' },
  { id: 'series',  label: 'Series',   icon: Television,  color: 'text-purple-400', border: 'border-purple-500/30' },
] as const

// ── Component ─────────────────────────────────────────────────────────────────

export function LibraryPanel({ onPlay }: LibraryPanelProps) {
  const [stats, setStats] = useState<ArchivistStats | null>(null)
  const [downloads, setDownloads] = useState<DownloadEntry[]>([])
  const [openDownload, setOpenDownload] = useState<string | null>(null)
  const [downloadResults, setDownloadResults] = useState<SearchResult[]>([])
  const [loadingDownload, setLoadingDownload] = useState(false)
  const [loadingStats, setLoadingStats] = useState(true)
  const [playlistEntries, setPlaylistEntries] = useState<Record<string, { title: string; url: string }[]>>({})
  const [loadingPlaylist, setLoadingPlaylist] = useState<string | null>(null)

  // ── Load archivist stats ───────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const [sRes, dRes] = await Promise.all([
        fetch(`${BACKEND}/api/archivist/stats`),
        fetch(`${BACKEND}/api/media/downloads`),
      ])
      if (sRes.ok) setStats(await sRes.json())
      if (dRes.ok) {
        const d = await dRes.json()
        setDownloads(d.downloads || [])
      }
    } catch {
      toast.error('Could not load library data')
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  // ── Load M3U playlist entries ──────────────────────────────────────────────

  const loadPlaylist = useCallback(async (category: string) => {
    if (playlistEntries[category]) return // already loaded
    setLoadingPlaylist(category)
    try {
      const r = await fetch(`${BACKEND}/api/archivist/playlist/${category}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const text = await r.text()
      const entries: { title: string; url: string }[] = []
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      let pendingTitle = ''
      for (const line of lines) {
        if (line.startsWith('#EXTINF')) {
          pendingTitle = line.includes(',') ? line.split(',').slice(1).join(',').trim() : 'Untitled'
        } else if (!line.startsWith('#') && line.startsWith('http')) {
          entries.push({ title: pendingTitle || 'Untitled', url: line })
          pendingTitle = ''
        }
      }
      setPlaylistEntries(prev => ({ ...prev, [category]: entries }))
    } catch {
      toast.error(`Failed to load ${category} playlist`)
    } finally {
      setLoadingPlaylist(null)
    }
  }, [playlistEntries])

  // ── Load saved search results ──────────────────────────────────────────────

  const openSavedSearch = useCallback(async (id: string) => {
    if (openDownload === id) { setOpenDownload(null); return }
    setLoadingDownload(true)
    setOpenDownload(id)
    try {
      const r = await fetch(`${BACKEND}/api/media/downloads/${id}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      setDownloadResults(data.results || [])
    } catch (e: any) {
      toast.error(`Failed to load: ${e.message}`)
      setDownloadResults([])
    } finally {
      setLoadingDownload(false)
    }
  }, [openDownload])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen size={18} className="text-amber-400" />
          <span className="font-semibold text-sm">Library</span>
          {stats && (
            <Badge variant="outline" className="text-[10px]">
              {(stats.playlists.movies.count + stats.playlists.live_tv.count + stats.playlists.series.count)} archived
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={loadStats} disabled={loadingStats}>
          <ArrowClockwise size={14} className={loadingStats ? 'animate-spin' : ''} />
        </Button>
      </div>

      <Tabs defaultValue="playlists" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid grid-cols-2 h-8">
          <TabsTrigger value="playlists" className="text-xs">
            <Archive size={12} className="mr-1" /> Archived Playlists
          </TabsTrigger>
          <TabsTrigger value="searches" className="text-xs">
            <DownloadSimple size={12} className="mr-1" /> Saved Searches ({downloads.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Archived Playlists tab ─────────────────────────────────────── */}
        <TabsContent value="playlists" className="flex-1 min-h-0 mt-2">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-3">
              {PILLARS.map(p => {
                const count = stats?.playlists[p.id as keyof typeof stats.playlists]?.count ?? 0
                const entries = playlistEntries[p.id]
                const Icon = p.icon
                return (
                  <Card key={p.id} className={`p-3 border ${p.border}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon size={16} className={p.color} />
                        <span className="text-sm font-medium">{p.label}</span>
                        <Badge variant="outline" className="text-[10px]">{count} entries</Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost" size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => loadPlaylist(p.id)}
                          disabled={loadingPlaylist === p.id || count === 0}
                        >
                          {loadingPlaylist === p.id ? (
                            <ArrowClockwise size={10} className="animate-spin mr-1" />
                          ) : (
                            <FolderOpen size={10} className="mr-1" />
                          )}
                          Browse
                        </Button>
                        <a href={`${BACKEND}/api/archivist/playlist/${p.id}`} download={`${p.id}_master.m3u`}>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                            <DownloadSimple size={10} className="mr-1" /> .m3u
                          </Button>
                        </a>
                      </div>
                    </div>

                    {count === 0 && (
                      <p className="text-xs text-muted-foreground">No items archived yet. Run a crawl cycle.</p>
                    )}

                    {entries && entries.length > 0 && (
                      <div className="flex flex-col gap-1 mt-1 max-h-48 overflow-y-auto">
                        {entries.map((e, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 py-0.5 px-1 rounded hover:bg-muted/40">
                            <span className="text-xs truncate flex-1 text-muted-foreground" title={e.title}>{e.title}</span>
                            {onPlay && (
                              <Button
                                variant="ghost" size="sm"
                                className="h-5 px-1 text-cyan-400 hover:text-cyan-300 shrink-0"
                                title="Resolve & Play via Real-Debrid"
                                onClick={() => onPlay(e.url, e.title)}
                              >
                                <Play size={10} weight="fill" />
                              </Button>
                            )}
                            <a href={e.url} target="_blank" rel="noreferrer" title="Download .torrent">
                              <Button variant="ghost" size="sm" className="h-5 px-1 shrink-0">
                                <DownloadSimple size={10} />
                              </Button>
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )
              })}

              <Card className="p-3 border border-yellow-500/20 bg-yellow-500/5">
                <p className="text-xs text-yellow-400 font-medium mb-1">ℹ️ About archived entries</p>
                <p className="text-[11px] text-muted-foreground">
                  Archived entries are Prowlarr torrent/magnet links. To stream them directly, configure
                  Real-Debrid in Settings → the ⚡ Resolve button will convert them to streamable URLs.
                </p>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ── Saved Searches tab ────────────────────────────────────────────── */}
        <TabsContent value="searches" className="flex-1 min-h-0 mt-2">
          <ScrollArea className="h-full">
            {downloads.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <DownloadSimple size={32} />
                <p className="text-sm">No saved searches yet</p>
                <p className="text-xs text-center max-w-xs">
                  Search results are saved here when you use Universal Search with auto-save enabled.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {downloads.map(dl => (
                  <Card key={dl.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium truncate">{dl.title}</span>
                          <Badge variant="outline" className="text-[9px] py-0">{dl.source}</Badge>
                          <Badge variant="outline" className="text-[9px] py-0">{dl.totalItems} items</Badge>
                          {dl.withMedia && <Badge className="text-[9px] py-0 bg-green-500/20 text-green-300 border-green-500/30">has media</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock size={9} /> {new Date(dl.downloadedAt).toLocaleDateString()}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {(dl.actualSize / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline" size="sm"
                        className="h-7 text-xs shrink-0"
                        onClick={() => openSavedSearch(dl.id)}
                        disabled={!dl.exists}
                      >
                        {loadingDownload && openDownload === dl.id ? (
                          <ArrowClockwise size={12} className="animate-spin" />
                        ) : (
                          <FolderOpen size={12} className="mr-1" />
                        )}
                        {openDownload === dl.id ? 'Close' : 'Open'}
                      </Button>
                    </div>

                    {/* Expanded results */}
                    {openDownload === dl.id && downloadResults.length > 0 && (
                      <div className="mt-3 flex flex-col gap-1 max-h-64 overflow-y-auto border-t pt-2">
                        {downloadResults.map((r, i) => (
                          <div key={i} className="flex items-center gap-2 py-1 hover:bg-muted/30 rounded px-1">
                            {r.thumbnail ? (
                              <img src={r.thumbnail} alt="" className="w-12 h-8 object-cover rounded shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                            ) : (
                              <div className="w-12 h-8 bg-muted rounded shrink-0 flex items-center justify-center">
                                <Image size={14} className="text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs truncate">{r.title || r.url}</p>
                              {r.metadata?.duration && (
                                <span className="text-[10px] text-muted-foreground">{r.metadata.duration}</span>
                              )}
                            </div>
                            {r.mediaUrls && r.mediaUrls.length > 0 ? (
                              onPlay && (
                                <Button
                                  variant="ghost" size="sm"
                                  className="h-6 px-1.5 text-cyan-400 hover:text-cyan-300 shrink-0"
                                  onClick={() => onPlay(r.mediaUrls![0], r.title)}
                                >
                                  <Play size={10} weight="fill" />
                                </Button>
                              )
                            ) : (
                              <a href={r.url} target="_blank" rel="noreferrer">
                                <Button variant="ghost" size="sm" className="h-6 px-1.5 shrink-0" title="Open page">
                                  <Globe size={10} />
                                </Button>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {openDownload === dl.id && downloadResults.length === 0 && !loadingDownload && (
                      <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">No results in this file.</p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
