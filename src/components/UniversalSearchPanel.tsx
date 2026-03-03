/**
 * UniversalSearchPanel — SILAS Universal Search
 * Three modes: Search Category | Search Keyword | Source Selector
 *
 * All three modes funnel into one POST /api/universal-search/run.
 * Results are displayed inline and can be auto-archived via the Archivist Protocol.
 */

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import {
  MagnifyingGlass, ArrowClockwise, Database, Globe,
  Broadcast, FilmSlate, Television, FunnelSimple,
  Archive, CheckCircle, XCircle, Warning, Spinner,
  ListChecks, DownloadSimple, Tag, Crosshair,
  Plus, Trash, Play, Lightning,
} from '@phosphor-icons/react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProwlarrIndexer {
  id:       number
  name:     string
  protocol: string
}

interface ProwlarrCategory {
  id:   string
  name: string
}

interface WebPreset {
  id:          string
  name:        string
  baseUrl:     string
  method:      string
  group?:      string
  description?: string
  custom?:     boolean
}

interface SourcesResponse {
  prowlarr: {
    connected:  boolean
    indexers:   ProwlarrIndexer[]
    categories: ProwlarrCategory[]
  }
  webPresets: WebPreset[]
}

interface ProwlarrResult {
  title:       string
  downloadUrl: string
  magnetUrl:   string
  seeders:     number
  leechers:    number
  size:        number
  indexer:     string
  category:    string
  publishDate: string
  source:      string
}

interface WebSourceResult {
  presetId:   string
  presetName: string
  error?:     string
  results:    { url: string; title?: string; mediaUrls?: string[] }[]
}

interface SearchResponse {
  mode:    string
  query:   string
  summary: {
    prowlarrResults: number
    webResults:      number
    archiveSummary?: { archived: number; flagged: number; rejected: number }
  }
  results: {
    prowlarr: ProwlarrResult[]
    web:      WebSourceResult[]
  }
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002'

// ── Category group definitions (starred parents = group headers) ─────────────

interface CategorySub  { id: string; name: string }
interface CategoryGroup {
  id:    string
  name:  string
  color: string
  subs:  CategorySub[]
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: '1000', name: 'Console', color: 'text-orange-400',
    subs: [
      { id: '1010', name: 'NDS' },        { id: '1020', name: 'PSP' },
      { id: '1030', name: 'Wii' },        { id: '1040', name: 'XBox' },
      { id: '1050', name: 'XBox 360' },   { id: '1060', name: 'Wiiware' },
      { id: '1070', name: 'XBox 360 DLC'},{ id: '1080', name: 'PS3' },
      { id: '1090', name: 'Other' },      { id: '1100', name: 'DS' },
      { id: '1110', name: 'PS Vita' },    { id: '1120', name: 'WiiU' },
      { id: '1130', name: 'XBox One' },   { id: '1140', name: 'PS4' },
      { id: '1180', name: 'PS5' },
    ],
  },
  {
    id: '2000', name: 'Movies', color: 'text-blue-400',
    subs: [
      { id: '2010', name: 'Foreign' }, { id: '2020', name: 'Other' },
      { id: '2030', name: 'SD' },      { id: '2040', name: 'HD' },
      { id: '2045', name: 'UHD' },     { id: '2050', name: 'BluRay' },
      { id: '2060', name: '3D' },      { id: '2070', name: 'DVD' },
      { id: '2080', name: 'WEB-DL' },  { id: '2090', name: 'x265' },
    ],
  },
  {
    id: '3000', name: 'Audio', color: 'text-green-400',
    subs: [
      { id: '3010', name: 'MP3' },       { id: '3020', name: 'Video' },
      { id: '3030', name: 'Audiobook' }, { id: '3040', name: 'Lossless' },
      { id: '3050', name: 'Other' },     { id: '3060', name: 'Foreign' },
    ],
  },
  {
    id: '4000', name: 'PC', color: 'text-cyan-400',
    subs: [
      { id: '4010', name: '0day' },          { id: '4020', name: 'ISO' },
      { id: '4030', name: 'Mac' },           { id: '4040', name: 'Mobile-Other' },
      { id: '4050', name: 'Games' },         { id: '4060', name: 'Mobile-iOS' },
      { id: '4070', name: 'Mobile-Android' },
    ],
  },
  {
    id: '5000', name: 'TV', color: 'text-purple-400',
    subs: [
      { id: '5010', name: 'WEB-DL' },     { id: '5020', name: 'Foreign' },
      { id: '5030', name: 'SD' },         { id: '5040', name: 'HD' },
      { id: '5045', name: 'UHD' },        { id: '5050', name: 'Other' },
      { id: '5060', name: 'Sport' },      { id: '5070', name: 'Anime' },
      { id: '5080', name: 'Documentary'},  { id: '5090', name: 'x265' },
    ],
  },
  {
    id: '6000', name: 'XXX', color: 'text-red-400',
    subs: [
      { id: '6010', name: 'DVD' },       { id: '6020', name: 'WMV' },
      { id: '6030', name: 'XviD' },      { id: '6040', name: 'x265' },
      { id: '6045', name: 'UHD' },       { id: '6050', name: 'Pack' },
      { id: '6060', name: 'ImageSet' },  { id: '6070', name: 'Other' },
      { id: '6080', name: 'SD' },        { id: '6090', name: 'WEB-DL' },
    ],
  },
  {
    id: '7000', name: 'Books', color: 'text-yellow-400',
    subs: [
      { id: '7010', name: 'Mags' },      { id: '7020', name: 'EBook' },
      { id: '7030', name: 'Comics' },    { id: '7040', name: 'Technical' },
      { id: '7050', name: 'Other' },     { id: '7060', name: 'Foreign' },
    ],
  },
  {
    id: '8000', name: 'Other', color: 'text-gray-400',
    subs: [
      { id: '8010', name: 'Misc' },
      { id: '8020', name: 'Hashed' },
    ],
  },
]

// All leaf + parent IDs flattened (used for select-all)
const ALL_CATEGORY_IDS = CATEGORY_GROUPS.flatMap(g => [g.id, ...g.subs.map(s => s.id)])

const categoryColors: Record<string, string> = {
  '2000': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  '5000': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  '7000': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  '3000': 'bg-green-500/20 text-green-300 border-green-500/30',
  '8000': 'bg-red-500/20 text-red-300 border-red-500/30',
  '6000': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
}

function formatSize(bytes: number): string {
  if (!bytes) return '—'
  const gb = bytes / 1e9
  if (gb >= 1) return `${gb.toFixed(2)} GB`
  const mb = bytes / 1e6
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UniversalSearchPanel({ onPlay }: {
  onPlay?: (item: { url: string; title: string }) => void
} = {}) {
  // ── Sources ─────────────────────────────────────────────────────────────────
  const [sources, setSources]         = useState<SourcesResponse | null>(null)
  const [loadingSources, setLoadingSources] = useState(false)

  // ── Mode ────────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<'category' | 'keyword'>('keyword')

  // ── Source selection ────────────────────────────────────────────────────────
  const [selectedProwlarrIds, setSelectedProwlarrIds]   = useState<number[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds]   = useState<string[]>([])
  const [selectedWebPresetIds, setSelectedWebPresetIds] = useState<string[]>([])

  // ── Query ───────────────────────────────────────────────────────────────────
  const [keyword, setKeyword]   = useState('')
  const [maxPages, setMaxPages] = useState(2)
  const [maxResults, setMaxResults] = useState(50)
  const [archiveResults, setArchiveResults] = useState(false)

  // ── Search state ─────────────────────────────────────────────────────────────
  const [running, setRunning]   = useState(false)
  const [progress, setProgress] = useState(0)
  const [lastResponse, setLastResponse] = useState<SearchResponse | null>(null)
  const [error, setError]       = useState<string | null>(null)

  // ── Add Source form state ────────────────────────────────────────────────────
  const [showAddSource, setShowAddSource] = useState(false)
  const [addingSource, setAddingSource]   = useState(false)
  const [addForm, setAddForm] = useState({
    name:        '',
    baseUrl:     '',
    group:       'utility',
    urlTemplate: '',
    searchMethod: 'url' as 'url' | 'form',
  })

  // ── Category group expand/collapse ──────────────────────────────────────────
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // ── Per-row resolve state ────────────────────────────────────────────────────
  type ResolveState = { loading: boolean; resolved: string | null; title?: string; method?: string; error?: string }
  const [resolveStates, setResolveStates] = useState<Record<string, ResolveState>>({})

  const resolveUrl = useCallback(async (key: string, url: string, title: string) => {
    setResolveStates(prev => ({ ...prev, [key]: { loading: true, resolved: null } }))
    try {
      const params = new URLSearchParams({ url, title })
      const res = await fetch(`${BACKEND_URL}/api/archivist/resolve?${params}`)
      const data = await res.json()
      setResolveStates(prev => ({
        ...prev,
        [key]: { loading: false, resolved: data.resolved ?? null, title: data.title, method: data.method },
      }))
      if (!data.resolved) toast.error(`No stream found (${data.method})`)
    } catch (err: any) {
      setResolveStates(prev => ({ ...prev, [key]: { loading: false, resolved: null, error: err.message } }))
    }
  }, [])

  // ── Fetch available sources on mount ────────────────────────────────────────
  const loadSources = useCallback(async () => {
    setLoadingSources(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/universal-search/sources`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: SourcesResponse = await res.json()
      setSources(data)
    } catch (err: any) {
      toast.error(`Failed to load sources: ${err.message}`)
    } finally {
      setLoadingSources(false)
    }
  }, [])

  useEffect(() => { loadSources() }, [loadSources])

  // ── Add Source / Delete Source ───────────────────────────────────────────────

  const addCustomSource = useCallback(async () => {
    if (!addForm.name.trim() || !addForm.baseUrl.trim()) {
      toast.error('Name and Base URL are required')
      return
    }
    setAddingSource(true)
    try {
      const payload = {
        ...addForm,
        urlTemplate: addForm.urlTemplate || `${addForm.baseUrl.trim()}/search?q={query}`,
      }
      const res = await fetch(`${BACKEND_URL}/api/universal-search/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(`Source "${addForm.name}" added`)
      setAddForm({ name: '', baseUrl: '', group: 'utility', urlTemplate: '', searchMethod: 'url' })
      setShowAddSource(false)
      loadSources()
    } catch (err: any) {
      toast.error(`Failed to add source: ${err.message}`)
    } finally {
      setAddingSource(false)
    }
  }, [addForm, loadSources])

  const deleteCustomSource = useCallback(async (id: string, name: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/universal-search/sources/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(`Removed "${name}"`)
      loadSources()
    } catch (err: any) {
      toast.error(`Failed to remove source: ${err.message}`)
    }
  }, [loadSources])

  // ── Helpers for select-all ───────────────────────────────────────────────────
  const toggleAllProwlarrIndexers = () => {
    if (!sources) return
    setSelectedProwlarrIds(prev =>
      prev.length === sources.prowlarr.indexers.length
        ? []
        : sources.prowlarr.indexers.map(i => i.id)
    )
  }

  const toggleAllWebPresets = () => {
    if (!sources) return
    setSelectedWebPresetIds(prev =>
      prev.length === sources.webPresets.length
        ? []
        : sources.webPresets.map(p => p.id)
    )
  }

  const toggleAllCategories = () => {
    setSelectedCategoryIds(prev =>
      prev.length === ALL_CATEGORY_IDS.length ? [] : [...ALL_CATEGORY_IDS]
    )
  }

  // Toggle an entire group (parent + all subs)
  const toggleGroup = (group: CategoryGroup) => {
    const ids = [group.id, ...group.subs.map(s => s.id)]
    const allSelected = ids.every(id => selectedCategoryIds.includes(id))
    setSelectedCategoryIds(prev =>
      allSelected
        ? prev.filter(id => !ids.includes(id))
        : [...new Set([...prev, ...ids])]
    )
  }

  const groupState = (group: CategoryGroup): 'all' | 'some' | 'none' => {
    const ids = [group.id, ...group.subs.map(s => s.id)]
    const count = ids.filter(id => selectedCategoryIds.includes(id)).length
    if (count === ids.length) return 'all'
    if (count > 0) return 'some'
    return 'none'
  }

  // ── Run search ───────────────────────────────────────────────────────────────
  const runSearch = useCallback(async () => {
    if (mode === 'keyword' && !keyword.trim()) {
      toast.error('Enter a keyword first')
      return
    }
    if (selectedProwlarrIds.length === 0 && selectedWebPresetIds.length === 0) {
      toast.error('Select at least one source')
      return
    }

    setRunning(true)
    setError(null)
    setLastResponse(null)
    setProgress(10)

    const tick = setInterval(() => {
      setProgress(p => Math.min(p + 5, 85))
    }, 800)

    try {
      const res = await fetch(`${BACKEND_URL}/api/universal-search/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          query:              mode === 'keyword' ? keyword : '',
          categoryIds:        selectedCategoryIds,
          prowlarrIndexerIds: selectedProwlarrIds,
          webPresetIds:       selectedWebPresetIds,
          maxPages,
          maxResults,
          archiveResults,
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text}`)
      }
      const data: SearchResponse = await res.json()
      setLastResponse(data)
      clearInterval(tick)
      setProgress(100)

      const total = data.summary.prowlarrResults + data.summary.webResults
      toast.success(`Found ${total} results across all sources`)
      if (data.summary.archiveSummary) {
        const a = data.summary.archiveSummary
        toast.info(`Archived: ${a.archived} | Flagged: ${a.flagged} | Rejected: ${a.rejected}`)
      }
    } catch (err: any) {
      clearInterval(tick)
      setError(err.message)
      toast.error(`Search failed: ${err.message}`)
    } finally {
      setRunning(false)
      setTimeout(() => setProgress(0), 1200)
    }
  }, [mode, keyword, selectedProwlarrIds, selectedWebPresetIds, selectedCategoryIds, maxPages, maxResults, archiveResults])

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 p-4 h-full bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Crosshair weight="duotone" className="text-accent" size={24} />
            Universal Search
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Category Browse · Keyword Hunt · Source-Direct — all funnelled through the Archivist Protocol
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={loadSources} disabled={loadingSources}>
          <ArrowClockwise size={14} className={loadingSources ? 'animate-spin' : ''} />
        </Button>
      </div>

      {progress > 0 && (
        <Progress value={progress} className="h-1" />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4 flex-1 min-h-0">
        {/* ── Left: Source selector + options ─────────────────────────────── */}
        <div className="flex flex-col gap-3">
          {/* Mode tabs */}
          <Card className="p-3 bg-gray-900 border-gray-700">
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Search Mode</p>
            <div className="flex gap-2">
              <Button
                variant={mode === 'keyword' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setMode('keyword')}
              >
                <MagnifyingGlass size={13} className="mr-1" /> Keyword
              </Button>
              <Button
                variant={mode === 'category' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setMode('category')}
              >
                <Tag size={13} className="mr-1" /> Category
              </Button>
            </div>

            {mode === 'keyword' && (
              <div className="mt-3">
                <Input
                  placeholder="e.g. action 4K 2024"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runSearch()}
                />
              </div>
            )}
          </Card>

          {/* Source selector */}
          <Card className="p-3 flex-1 min-h-0 flex flex-col bg-gray-900 border-gray-700">
            <Tabs defaultValue="prowlarr" className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-2 mb-2">
                <TabsTrigger value="prowlarr" className="text-xs">
                  <Database size={12} className="mr-1" />
                  Prowlarr
                  {sources?.prowlarr.connected ? (
                    <span className="ml-1 w-2 h-2 rounded-full bg-green-500 inline-block" />
                  ) : (
                    <span className="ml-1 w-2 h-2 rounded-full bg-red-500 inline-block" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="web" className="text-xs">
                  <Globe size={12} className="mr-1" />
                  Web Scrapers
                </TabsTrigger>
              </TabsList>

              {/* Prowlarr indexers */}
              <TabsContent value="prowlarr" className="flex-1 flex flex-col min-h-0 mt-0">
                {loadingSources ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                    <Spinner size={14} className="animate-spin" /> Loading indexers…
                  </div>
                ) : !sources?.prowlarr.connected ? (
                  <Alert>
                    <Warning size={14} />
                    <AlertDescription className="text-xs">
                      Prowlarr not connected. Check PROWLARR_URL and PROWLARR_API_KEY in .env.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="flex flex-col gap-2 flex-1 min-h-0">
                    {/* Indexers */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-gray-400">Indexers</p>
                        <button className="text-xs text-accent hover:underline" onClick={toggleAllProwlarrIndexers}>
                          {selectedProwlarrIds.length === sources.prowlarr.indexers.length ? 'None' : 'All'}
                        </button>
                      </div>
                      <ScrollArea className="h-44">
                        <div className="flex flex-col gap-1">
                          {sources.prowlarr.indexers.map(idx => (
                            <label key={idx.id} className="flex items-center gap-2 text-xs cursor-pointer hover:text-foreground text-gray-400">
                              <Checkbox
                                checked={selectedProwlarrIds.includes(idx.id)}
                                onCheckedChange={checked => {
                                  setSelectedProwlarrIds(prev =>
                                    checked ? [...prev, idx.id] : prev.filter(id => id !== idx.id)
                                  )
                                }}
                              />
                              {idx.name}
                              <Badge variant="outline" className="ml-auto text-[9px] py-0">{idx.protocol}</Badge>
                            </label>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>

                    <Separator />

                    {/* Categories — hierarchical grouped */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-gray-400">
                          Categories
                          {selectedCategoryIds.length > 0 && (
                            <span className="ml-1 text-accent">({selectedCategoryIds.length})</span>
                          )}
                        </p>
                        <button className="text-xs text-accent hover:underline" onClick={toggleAllCategories}>
                          {selectedCategoryIds.length === ALL_CATEGORY_IDS.length ? 'None' : 'All'}
                        </button>
                      </div>
                      <ScrollArea className="h-64">
                        <div className="flex flex-col gap-0.5">
                          {CATEGORY_GROUPS.map(group => {
                            const state   = groupState(group)
                            const expanded = expandedGroups.has(group.id)
                            return (
                              <div key={group.id}>
                                {/* Group header row */}
                                <div className="flex items-center gap-1.5 py-0.5">
                                  <Checkbox
                                    checked={state === 'all'}
                                    // indeterminate visual via className when 'some'
                                    className={state === 'some' ? 'opacity-60' : ''}
                                    onCheckedChange={() => toggleGroup(group)}
                                  />
                                  <button
                                    className={`flex-1 flex items-center gap-1.5 text-xs font-semibold ${group.color} text-left`}
                                    onClick={() =>
                                      setExpandedGroups(prev => {
                                        const next = new Set(prev)
                                        next.has(group.id) ? next.delete(group.id) : next.add(group.id)
                                        return next
                                      })
                                    }
                                  >
                                    <span>{expanded ? '▾' : '▸'}</span>
                                    {group.name}
                                    <span className="text-[9px] text-gray-600 font-normal">
                                      {group.subs.filter(s => selectedCategoryIds.includes(s.id)).length}/{group.subs.length}
                                    </span>
                                  </button>
                                </div>

                                {/* Subcategory rows */}
                                {expanded && (
                                  <div className="ml-6 flex flex-col gap-0.5 mb-1">
                                    {group.subs.map(sub => (
                                      <label
                                        key={sub.id}
                                        className="flex items-center gap-1.5 text-[11px] cursor-pointer text-gray-400 hover:text-gray-200 py-0.5"
                                      >
                                        <Checkbox
                                          checked={selectedCategoryIds.includes(sub.id)}
                                          onCheckedChange={checked =>
                                            setSelectedCategoryIds(prev =>
                                              checked
                                                ? [...prev, sub.id]
                                                : prev.filter(id => id !== sub.id)
                                            )
                                          }
                                        />
                                        {sub.name}
                                        <span className="text-[9px] text-gray-700 ml-auto">{sub.id}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Web presets — grouped */}
              <TabsContent value="web" className="flex-1 min-h-0 mt-0">
                {loadingSources ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                    <Spinner size={14} className="animate-spin" /> Loading presets…
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-gray-400">{sources?.webPresets.length ?? 0} presets</p>
                      <div className="flex items-center gap-2">
                        <button className="text-xs text-cyan-400 hover:underline" onClick={toggleAllWebPresets}>
                          {selectedWebPresetIds.length === (sources?.webPresets.length ?? 0) ? 'None' : 'All'}
                        </button>
                        <button
                          className="flex items-center gap-0.5 text-[10px] text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded px-1.5 py-0.5"
                          onClick={() => setShowAddSource(s => !s)}
                        >
                          <Plus size={10} />
                          Add
                        </button>
                      </div>
                    </div>
                    <ScrollArea className="flex-1 min-h-0 h-[320px]">
                      {(() => {
                        const presets = sources?.webPresets ?? []
                        const GROUP_ORDER = ['torrent','streaming','iptv','video','anime','adult','utility'] as const
                        const GROUP_LABELS: Record<string, string> = {
                          torrent:   '⛓ Torrent Indexers',
                          streaming: '▶ Free Streaming',
                          iptv:      '📡 IPTV / Live TV',
                          video:     '🎬 Video Platforms',
                          anime:     '🎌 Anime',
                          adult:     '🔞 Adult',
                          utility:   '🔧 Utility',
                        }
                        const grouped = GROUP_ORDER.reduce<Record<string, typeof presets>>((acc, g) => {
                          acc[g] = presets.filter(p => (p as any).group === g)
                          return acc
                        }, {} as any)
                        return (
                          <div className="flex flex-col gap-2 pr-1">
                            {GROUP_ORDER.map(g => {
                              const items = grouped[g]
                              if (!items.length) return null
                              const allGroupChecked = items.every(p => selectedWebPresetIds.includes(p.id))
                              return (
                                <div key={g}>
                                  <div className="flex items-center justify-between py-0.5">
                                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                      {GROUP_LABELS[g]}
                                    </span>
                                    <button
                                      className="text-[10px] text-gray-500 hover:text-cyan-400"
                                      onClick={() => {
                                        const ids = items.map(p => p.id)
                                        setSelectedWebPresetIds(prev =>
                                          allGroupChecked
                                            ? prev.filter(id => !ids.includes(id))
                                            : [...new Set([...prev, ...ids])]
                                        )
                                      }}
                                    >
                                      {allGroupChecked ? 'none' : 'all'}
                                    </button>
                                  </div>
                                  {items.map(p => (
                                    <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer hover:text-white text-gray-400 py-0.5 pl-1">
                                      <Checkbox
                                        checked={selectedWebPresetIds.includes(p.id)}
                                        onCheckedChange={checked => {
                                          setSelectedWebPresetIds(prev =>
                                            checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                                          )
                                        }}
                                      />
                                      <span className="truncate flex-1">{p.name}</span>
                                      {p.custom ? (
                                        <button
                                          className="ml-auto text-red-500/60 hover:text-red-400 shrink-0"
                                          title="Remove custom source"
                                          onClick={e => { e.preventDefault(); deleteCustomSource(p.id, p.name) }}
                                        >
                                          <Trash size={10} />
                                        </button>
                                      ) : (
                                        p.description && (
                                          <span className="text-[9px] text-gray-600 truncate max-w-[100px] hidden xl:block" title={p.description}>
                                            {p.description}
                                          </span>
                                        )
                                      )}
                                    </label>
                                  ))}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </ScrollArea>

                    {/* ── Add Source inline form ─────────────────────────────── */}
                    {showAddSource && (
                      <div className="mt-2 border border-emerald-500/30 rounded p-2.5 bg-emerald-950/20 flex flex-col gap-2">
                        <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">New Source</p>
                        <Input
                          placeholder="Name (e.g. 123Movies)"
                          value={addForm.name}
                          onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                          className="h-7 text-xs bg-gray-900 border-gray-600"
                        />
                        <Input
                          placeholder="Base URL (e.g. https://123movies.to)"
                          value={addForm.baseUrl}
                          onChange={e => setAddForm(f => ({
                            ...f,
                            baseUrl: e.target.value,
                            urlTemplate: f.urlTemplate || `${e.target.value}/search?q={query}`,
                          }))}
                          className="h-7 text-xs bg-gray-900 border-gray-600"
                        />
                        <Input
                          placeholder={`Search URL template (default: ${addForm.baseUrl || '<baseUrl>'}/search?q={query})`}
                          value={addForm.urlTemplate}
                          onChange={e => setAddForm(f => ({ ...f, urlTemplate: e.target.value }))}
                          className="h-7 text-xs bg-gray-900 border-gray-600"
                        />
                        <div className="flex items-center gap-2">
                          <Select value={addForm.group} onValueChange={v => setAddForm(f => ({ ...f, group: v }))}>
                            <SelectTrigger className="h-7 text-xs bg-gray-900 border-gray-600 flex-1">
                              <SelectValue placeholder="Group" />
                            </SelectTrigger>
                            <SelectContent>
                              {['torrent','streaming','iptv','video','anime','adult','utility'].map(g => (
                                <SelectItem key={g} value={g} className="text-xs capitalize">{g}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={addForm.searchMethod} onValueChange={v => setAddForm(f => ({ ...f, searchMethod: v as 'url' | 'form' }))}>
                            <SelectTrigger className="h-7 text-xs bg-gray-900 border-gray-600 flex-1">
                              <SelectValue placeholder="Method" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="url" className="text-xs">URL</SelectItem>
                              <SelectItem value="form" className="text-xs">Form</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-500" onClick={addCustomSource} disabled={addingSource}>
                            {addingSource ? <Spinner size={12} className="animate-spin mr-1" /> : <Plus size={12} className="mr-1" />}
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddSource(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </Card>

          {/* Options */}
          <Card className="p-3 space-y-3 bg-gray-900 border-gray-700">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Options</p>
            <div className="flex items-center justify-between text-xs">
              <span>Max results per source</span>
              <input
                type="number" min={10} max={200} step={10}
                value={maxResults}
                onChange={e => setMaxResults(Number(e.target.value))}
                className="w-16 text-right bg-muted border border-border rounded px-2 py-0.5 text-xs"
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Max pages (web)</span>
              <input
                type="number" min={1} max={10} step={1}
                value={maxPages}
                onChange={e => setMaxPages(Number(e.target.value))}
                className="w-16 text-right bg-muted border border-border rounded px-2 py-0.5 text-xs"
              />
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox
                checked={archiveResults}
                onCheckedChange={v => setArchiveResults(!!v)}
              />
              <span>Auto-archive valid results</span>
              <Archive size={12} className="ml-auto text-accent" />
            </label>
          </Card>

          {/* Run button */}
          <Button
            className="w-full"
            onClick={runSearch}
            disabled={running}
          >
            {running ? (
              <><Spinner size={14} className="mr-2 animate-spin" /> Searching…</>
            ) : (
              <><Crosshair size={14} className="mr-2" /> Run Search</>
            )}
          </Button>
        </div>

        {/* ── Right: Results ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 min-h-0">
          {error && (
            <Alert variant="destructive">
              <XCircle size={14} />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {lastResponse && (
            <>
              {/* Summary bar */}
              <Card className="p-3 bg-gray-900 border-gray-700">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="font-medium">
                    {lastResponse.summary.prowlarrResults + lastResponse.summary.webResults} total results
                  </span>
                  <Badge variant="outline" className="gap-1">
                    <Database size={11} />
                    {lastResponse.summary.prowlarrResults} Prowlarr
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Globe size={11} />
                    {lastResponse.summary.webResults} Web
                  </Badge>
                  {lastResponse.summary.archiveSummary && (
                    <>
                      <Badge className="gap-1 bg-green-500/20 text-green-300 border-green-500/30">
                        <CheckCircle size={11} />
                        {lastResponse.summary.archiveSummary.archived} archived
                      </Badge>
                      {lastResponse.summary.archiveSummary.flagged > 0 && (
                        <Badge className="gap-1 bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                          <Warning size={11} />
                          {lastResponse.summary.archiveSummary.flagged} flagged
                        </Badge>
                      )}
                      {lastResponse.summary.archiveSummary.rejected > 0 && (
                        <Badge className="gap-1 bg-red-500/20 text-red-300 border-red-500/30">
                          <XCircle size={11} />
                          {lastResponse.summary.archiveSummary.rejected} rejected
                        </Badge>
                      )}
                    </>
                  )}
                  <span className="ml-auto text-xs text-gray-400">
                    Mode: <code className="text-accent">{lastResponse.mode}</code>
                    {lastResponse.query !== '.' && <> · query: <code className="text-accent">"{lastResponse.query}"</code></>}
                  </span>
                </div>
              </Card>

              {/* Results tabs */}
              <Tabs defaultValue="prowlarr" className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="prowlarr" className="text-xs">
                    <Database size={12} className="mr-1" />
                    Prowlarr ({lastResponse.summary.prowlarrResults})
                  </TabsTrigger>
                  <TabsTrigger value="web" className="text-xs">
                    <Globe size={12} className="mr-1" />
                    Web ({lastResponse.summary.webResults})
                  </TabsTrigger>
                </TabsList>

                {/* Prowlarr results table */}
                <TabsContent value="prowlarr" className="flex-1 min-h-0 mt-2">
                  <ScrollArea className="h-full">
                    {lastResponse.results.prowlarr.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">No Prowlarr results</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {lastResponse.results.prowlarr.map((r, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02 }}
                          >
                            <Card className="p-2.5 bg-gray-900 border-gray-700 hover:bg-gray-800/50 transition-colors">
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">{r.title}</p>
                                  <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="text-[10px] text-gray-400">{r.indexer}</span>
                                    {r.category && (
                                      <Badge variant="outline" className="text-[9px] py-0 px-1">{r.category}</Badge>
                                    )}
                                    <span className="text-[10px] text-gray-400">{formatSize(r.size)}</span>
                                    {r.seeders > 0 && (
                                      <span className="text-[10px] text-green-400">S:{r.seeders}</span>
                                    )}
                                  </div>
                                  {/* Resolve result inline */}
                                  {(() => {
                                    const rk = resolveStates[`${i}`]
                                    if (!rk) return null
                                    if (rk.loading) return (
                                      <div className="flex items-center gap-1 mt-1 text-[10px] text-yellow-400">
                                        <Spinner size={10} className="animate-spin" /> Resolving…
                                      </div>
                                    )
                                    if (rk.resolved) return (
                                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                                        <span className="text-[10px] text-green-400 truncate max-w-[200px]" title={rk.resolved}>{rk.resolved}</span>
                                        <Badge className="text-[9px] py-0 px-1 bg-green-500/20 text-green-300 border-green-500/30">{rk.method}</Badge>
                                        {onPlay && (
                                          <button
                                            className="flex items-center gap-0.5 text-[10px] text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 rounded px-1.5 py-0.5"
                                            onClick={() => onPlay({ url: rk.resolved!, title: rk.title ?? r.title })}
                                          >
                                            <Play size={9} weight="fill" /> Play
                                          </button>
                                        )}
                                      </div>
                                    )
                                    return (
                                      <div className="text-[10px] text-red-400 mt-1">
                                        No stream found ({rk.method ?? 'error'})
                                      </div>
                                    )
                                  })()}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Resolve button */}
                                  {(r.downloadUrl || r.magnetUrl) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-1.5 text-yellow-400 hover:text-yellow-300"
                                      title="Resolve to streamable URL"
                                      disabled={resolveStates[`${i}`]?.loading}
                                      onClick={() => resolveUrl(`${i}`, r.magnetUrl || r.downloadUrl, r.title)}
                                    >
                                      <Lightning size={12} />
                                    </Button>
                                  )}
                                  {r.downloadUrl && /^https?:\/\//.test(r.downloadUrl) && (
                                    <a href={r.downloadUrl} target="_blank" rel="noreferrer">
                                      <Button variant="ghost" size="sm" className="h-6 px-1.5">
                                        <DownloadSimple size={12} />
                                      </Button>
                                    </a>
                                  )}
                                </div>
                              </div>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                {/* Web results */}
                <TabsContent value="web" className="flex-1 min-h-0 mt-2">
                  <ScrollArea className="h-full">
                    {lastResponse.results.web.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">No web results</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {lastResponse.results.web.map((src, si) => (
                          <div key={si}>
                            <div className="flex items-center gap-2 mb-1">
                              <Globe size={12} className="text-accent" />
                              <span className="text-xs font-semibold">{src.presetName}</span>
                              <Badge variant="outline" className="text-[9px] py-0 ml-auto">
                                {src.results?.length ?? 0} results
                              </Badge>
                            </div>
                            {src.error ? (
                              <Alert className="py-1">
                                <XCircle size={12} />
                                <AlertDescription className="text-xs">{src.error}</AlertDescription>
                              </Alert>
                            ) : (
                              <div className="flex flex-col gap-1 pl-4">
                                {(src.results ?? []).slice(0, 20).map((item, ii) => (
                                  <Card key={ii} className="p-2 hover:bg-muted/50 transition-colors">
                                    <p className="text-xs font-medium truncate">{item.title ?? item.url}</p>
                                    {item.mediaUrls && item.mediaUrls.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {item.mediaUrls.slice(0, 4).map((u, ui) => (
                                          <button
                                            key={ui}
                                            className="flex items-center gap-0.5 text-[9px] text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 rounded px-1.5 py-0.5 max-w-[180px] truncate"
                                            title={u}
                                            onClick={() => onPlay?.({ url: u, title: item.title ?? item.url ?? 'Media' })}
                                          >
                                            <Play size={8} weight="fill" /> {u.split('/').pop()?.slice(0, 30) || `Video ${ui + 1}`}
                                          </button>
                                        ))}
                                        {item.mediaUrls.length > 4 && (
                                          <Badge variant="outline" className="text-[9px] py-0">
                                            +{item.mediaUrls.length - 4} more
                                          </Badge>
                                        )}
                                      </div>
                                    )}
                                  </Card>
                                ))}
                                {(src.results?.length ?? 0) > 20 && (
                                  <p className="text-xs text-gray-400 text-center py-1">
                                    +{src.results.length - 20} more not shown
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </>
          )}

          {!lastResponse && !running && !error && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
              <Crosshair size={48} weight="thin" />
              <p className="text-sm">Select sources and run a search</p>
              <div className="flex gap-2 text-xs">
                <Badge variant="outline" className="gap-1"><Tag size={10} /> Category</Badge>
                <Badge variant="outline" className="gap-1"><MagnifyingGlass size={10} /> Keyword</Badge>
                <Badge variant="outline" className="gap-1"><FunnelSimple size={10} /> Source-Direct</Badge>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

