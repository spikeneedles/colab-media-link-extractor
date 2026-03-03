/**
 * PlaylistHarvester — Search, crawl and scrape for M3U/M3U8/PLS/XSPF streaming playlists
 *
 * Lets the user:
 *   1. Select from preset IPTV sources (IPTV-ORG, Free-IPTV, etc.)
 *   2. Paste any custom URL (page to spider OR direct playlist file)
 *   3. Watch live progress as playlists are fetched, parsed, and archived
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  WifiHigh, Play, Stop, ArrowClockwise, Spinner, Plus, Trash,
  CheckCircle, XCircle, Archive, Globe, FilmStrip, MagnifyingGlass,
  DownloadSimple, Link, Warning,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002'

// ── Types ─────────────────────────────────────────────────────────────────────

interface HarvestPreset {
  id:          string
  name:        string
  url:         string
  description: string
  group:       string
  direct:      boolean
}

interface HarvestResult {
  sourceUrl:      string
  playlistsFound: number
  entriesParsed:  number
  archived:       number
  rejected:       number
  flagged:        number
  errors:         string[]
}

interface HarvestStatus {
  running:          boolean
  totalSources:     number
  completedSources: number
  currentSource:    string
  totalArchived:    number
  totalParsed:      number
  errors:           string[]
  results:          HarvestResult[]
  startedAt:        number | null
  completedAt:      number | null
}

interface ParsePreview {
  url:          string
  entriesFound: number
  preview:      { url: string; title: string; groupTitle: string }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlaylistHarvester() {
  const [presets, setPresets]             = useState<HarvestPreset[]>([])
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set(['iptv-org-all', 'iptv-org-movies', 'iptv-org-entertainment']))
  const [customUrls, setCustomUrls]       = useState<string[]>([''])
  const [status, setStatus]               = useState<HarvestStatus | null>(null)
  const [log, setLog]                     = useState<string[]>([])
  const [preview, setPreview]             = useState<ParsePreview | null>(null)
  const [previewUrl, setPreviewUrl]       = useState('')
  const [previewing, setPreviewing]       = useState(false)
  const sseRef = useRef<EventSource | null>(null)

  const addLog = (msg: string) =>
    setLog(l => [`${new Date().toLocaleTimeString()} ${msg}`, ...l].slice(0, 100))

  // ── Load presets ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/harvest/presets`)
      .then(r => r.json())
      .then(d => setPresets(d.presets ?? []))
      .catch(() => {})
    fetch(`${BACKEND_URL}/api/harvest/status`)
      .then(r => r.json())
      .then(d => setStatus(d))
      .catch(() => {})
  }, [])

  // ── SSE ───────────────────────────────────────────────────────────────────
  const connectSSE = useCallback(() => {
    sseRef.current?.close()
    const es = new EventSource(`${BACKEND_URL}/api/harvest/stream`)
    sseRef.current = es

    es.addEventListener('status',        e => setStatus(JSON.parse(e.data)))
    es.addEventListener('started',       e => { setStatus(JSON.parse(e.data)); addLog('▶ Harvest started') })
    es.addEventListener('stopped',       e => { setStatus(JSON.parse(e.data)); addLog('■ Harvest stopped') })
    es.addEventListener('progress',      e => {
      const d = JSON.parse(e.data)
      addLog(`⟳ ${d.source} — ${d.step}${d.count != null ? ` (${d.count} playlists found)` : ''}`)
    })
    es.addEventListener('sourceComplete',e => {
      const { source, result } = JSON.parse(e.data)
      addLog(`✓ ${source} — parsed:${result.entriesParsed} archived:${result.archived}`)
      setStatus(prev => prev ? { ...prev, completedSources: prev.completedSources + 1 } : prev)
    })
    es.addEventListener('batchComplete', e => {
      const d = JSON.parse(e.data)
      setStatus(prev => prev ? { ...prev, totalArchived: d.archived } : prev)
    })
    es.addEventListener('completed',     e => {
      const s = JSON.parse(e.data) as HarvestStatus
      setStatus(s)
      const dur = s.startedAt && s.completedAt ? fmtMs(s.completedAt - s.startedAt) : '?'
      addLog(`✅ Harvest complete in ${dur} — ${s.totalArchived} archived from ${s.totalParsed} entries`)
      toast.success(`Harvest complete — ${s.totalArchived} streams archived`)
    })
    es.onerror = () => setTimeout(connectSSE, 5000)
  }, [])

  useEffect(() => {
    connectSSE()
    return () => sseRef.current?.close()
  }, [connectSSE])

  // ── Start ─────────────────────────────────────────────────────────────────
  const startHarvest = async () => {
    const validCustom = customUrls.filter(u => u.trim())
    if (selectedIds.size === 0 && validCustom.length === 0) {
      toast.error('Select at least one source or enter a custom URL')
      return
    }
    try {
      const r = await fetch(`${BACKEND_URL}/api/harvest/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetIds: [...selectedIds], customUrls: validCustom }),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error); return }
      toast.success(`Harvesting ${d.totalSources} source(s)…`)
    } catch {
      toast.error('Failed to start harvest')
    }
  }

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stopHarvest = async () => {
    await fetch(`${BACKEND_URL}/api/harvest/stop`, { method: 'POST' })
    toast.info('Harvest stopped')
  }

  // ── Preview a URL ─────────────────────────────────────────────────────────
  const previewPlaylist = async () => {
    if (!previewUrl.trim()) return
    setPreviewing(true)
    setPreview(null)
    try {
      const r = await fetch(`${BACKEND_URL}/api/harvest/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: previewUrl.trim() }),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error); return }
      setPreview(d)
    } catch {
      toast.error('Could not fetch/parse URL')
    } finally {
      setPreviewing(false)
    }
  }

  // ── Toggle preset ─────────────────────────────────────────────────────────
  const togglePreset = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleGroup = (group: string) => {
    const groupIds = presets.filter(p => p.group === group).map(p => p.id)
    const allSelected = groupIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      groupIds.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }

  // ── Group presets ─────────────────────────────────────────────────────────
  const groups = [...new Set(presets.map(p => p.group))]
  const isRunning = status?.running ?? false
  const progress = status && status.totalSources > 0
    ? Math.round((status.completedSources / status.totalSources) * 100)
    : 0

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 p-3 h-full bg-gray-950 text-gray-100 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WifiHigh size={20} weight="duotone" className={isRunning ? 'text-emerald-400' : 'text-purple-400'} />
          <div>
            <h2 className="text-sm font-bold leading-none">Playlist Harvester</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Crawl & import M3U · M3U8 · PLS · XSPF</p>
          </div>
        </div>
        <Button
          size="sm"
          className={`px-4 font-bold ${isRunning
            ? 'bg-red-600 hover:bg-red-500'
            : 'bg-purple-600 hover:bg-purple-500'}`}
          onClick={isRunning ? stopHarvest : startHarvest}
        >
          {isRunning
            ? <><Stop size={13} className="mr-1.5" weight="fill" />Stop</>
            : <><Play size={13} className="mr-1.5" weight="fill" />Harvest</>
          }
        </Button>
      </div>

      {/* Progress */}
      {isRunning && (
        <Card className="p-3 bg-emerald-950/30 border-emerald-700/40 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-emerald-300">
              <Spinner size={12} className="animate-spin" />
              {status?.currentSource || 'Starting…'}
            </span>
            <span className="text-gray-500">{status?.completedSources}/{status?.totalSources}</span>
          </div>
          <Progress value={progress} className="h-1.5" />
          <div className="flex gap-3 text-[10px] text-gray-400">
            <span className="text-emerald-400 font-bold">{status?.totalArchived ?? 0} archived</span>
            <span>{status?.totalParsed ?? 0} parsed</span>
          </div>
        </Card>
      )}

      {/* Last harvest summary */}
      {!isRunning && status?.completedAt && (
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: 'Archived', value: status.totalArchived, color: 'text-emerald-400' },
            { label: 'Parsed',   value: status.totalParsed,   color: 'text-blue-400' },
            { label: 'Sources',  value: status.totalSources,  color: 'text-purple-400' },
          ].map(s => (
            <Card key={s.label} className="p-2 bg-gray-900 border-gray-700 text-center">
              <div className={`text-lg font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
              <div className="text-[9px] text-gray-500">{s.label}</div>
            </Card>
          ))}
        </div>
      )}

      <Separator className="border-gray-800" />

      {/* Preset sources */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Preset Sources</p>
          <button
            className="text-[9px] text-gray-600 hover:text-gray-400"
            onClick={() => setSelectedIds(selectedIds.size === presets.length ? new Set() : new Set(presets.map(p => p.id)))}
          >
            {selectedIds.size === presets.length ? 'none' : 'all'}
          </button>
        </div>
        <ScrollArea className="h-48 border border-gray-800 rounded">
          <div className="p-2 space-y-3">
            {groups.map(group => {
              const groupPresets = presets.filter(p => p.group === group)
              const allChecked = groupPresets.every(p => selectedIds.has(p.id))
              return (
                <div key={group}>
                  <button
                    onClick={() => toggleGroup(group)}
                    className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 hover:text-white"
                  >
                    <Globe size={9} />
                    {group}
                    {allChecked && <CheckCircle size={9} className="text-emerald-400" />}
                  </button>
                  <div className="space-y-1 pl-2">
                    {groupPresets.map(preset => (
                      <label key={preset.id} className="flex items-start gap-2 cursor-pointer group">
                        <Checkbox
                          checked={selectedIds.has(preset.id)}
                          onCheckedChange={() => togglePreset(preset.id)}
                          className="mt-0.5 h-3 w-3 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] text-gray-300 group-hover:text-white leading-tight">{preset.name}</p>
                          <p className="text-[9px] text-gray-600 truncate">{preset.description}</p>
                        </div>
                        {preset.direct && (
                          <Badge className="text-[8px] py-0 px-1 bg-blue-500/20 text-blue-400 border-blue-500/30 shrink-0 self-start mt-0.5">
                            direct
                          </Badge>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Custom URLs */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Custom URLs</p>
          <button
            className="flex items-center gap-1 text-[9px] text-gray-500 hover:text-gray-300"
            onClick={() => setCustomUrls(u => [...u, ''])}
          >
            <Plus size={9} /> Add
          </button>
        </div>
        <div className="space-y-1.5">
          {customUrls.map((url, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                value={url}
                onChange={e => setCustomUrls(u => u.map((v, j) => j === i ? e.target.value : v))}
                placeholder="https://example.com/playlist.m3u8 or page URL to spider"
                className="h-7 text-[11px] bg-gray-900 border-gray-700 text-gray-100 placeholder:text-gray-600 flex-1"
              />
              {customUrls.length > 1 && (
                <button onClick={() => setCustomUrls(u => u.filter((_, j) => j !== i))} className="text-gray-600 hover:text-red-400">
                  <Trash size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Preview tool */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Preview a Playlist</p>
        <div className="flex gap-1.5">
          <Input
            value={previewUrl}
            onChange={e => setPreviewUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && previewPlaylist()}
            placeholder="Paste any .m3u8 / .m3u URL to preview contents"
            className="h-7 text-[11px] bg-gray-900 border-gray-700 text-gray-100 placeholder:text-gray-600 flex-1"
          />
          <Button size="sm" variant="outline" className="h-7 px-2 border-gray-700" onClick={previewPlaylist} disabled={previewing}>
            {previewing ? <Spinner size={11} className="animate-spin" /> : <MagnifyingGlass size={11} />}
          </Button>
        </div>

        <AnimatePresence>
          {preview && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-emerald-400 font-semibold">
                  {preview.entriesFound} streams found
                </span>
                <button
                  className="text-[9px] text-purple-400 hover:text-purple-200"
                  onClick={() => {
                    const validCustom = customUrls.filter(u => u.trim())
                    if (!validCustom.includes(previewUrl)) {
                      setCustomUrls(u => [...u.filter(Boolean), previewUrl])
                    }
                    toast.success('URL added to custom list — click Harvest to import')
                  }}
                >
                  + Add to harvest
                </button>
              </div>
              <ScrollArea className="h-32 border border-gray-800 rounded">
                <div className="flex flex-col divide-y divide-gray-800">
                  {preview.preview.map((e, i) => (
                    <div key={i} className="px-2 py-1">
                      <p className="text-[10px] text-gray-300 truncate">{e.title || 'Untitled'}</p>
                      <p className="text-[9px] text-gray-600 truncate">{e.url}</p>
                      {e.groupTitle && <Badge className="text-[8px] py-0 px-1 mt-0.5 bg-gray-800 text-gray-500">{e.groupTitle}</Badge>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="border-gray-800" />

      {/* Per-source results */}
      {(status?.results?.length ?? 0) > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Last Harvest Results</p>
          <div className="flex flex-col gap-1">
            {(status?.results ?? []).map((r, i) => (
              <div key={i} className={`flex items-center gap-2 text-[10px] px-2 py-1.5 rounded bg-gray-900 ${r.errors.length ? 'border border-red-800/40' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-400 truncate">{r.sourceUrl.split('/').slice(-2).join('/')}</p>
                </div>
                <span className="text-emerald-400 shrink-0">+{r.archived}</span>
                <span className="text-gray-600 shrink-0">{r.entriesParsed}p</span>
                {r.errors.length > 0 && <Warning size={10} className="text-red-400 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live log */}
      <div className="flex-1 flex flex-col min-h-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Log</p>
        <ScrollArea className="flex-1 h-32 bg-gray-900 rounded border border-gray-800 p-2">
          {log.length === 0
            ? <p className="text-xs text-gray-600 text-center py-3">No activity yet</p>
            : log.map((line, i) => (
              <div key={i} className="text-[10px] font-mono text-gray-400 py-0.5 border-b border-gray-800/50 last:border-0 truncate">{line}</div>
            ))
          }
        </ScrollArea>
      </div>
    </div>
  )
}
