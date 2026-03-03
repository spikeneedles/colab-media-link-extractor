/**
 * AutomationPanel — Continuous Search Automation Control
 *
 * A big ON/OFF toggle that drives the AutomationEngine's continuous
 * crawl → scrape → sort → archive pipeline.
 *
 * Connects to GET /api/automation/stream (SSE) for live updates.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Robot, Play, Stop, ArrowClockwise, Spinner,
  Database, Globe, Folder, CheckCircle, XCircle,
  Warning, Lightning, Archive, Timer, StackSimple,
  MagnifyingGlass, CaretDown, CaretUp,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3002'

import type { ReactNode } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AutomationConfig {
  cycleIntervalMs:  number
  prowlarrWorkers:  number
  webPresetWorkers: number
  fileSortWorkers:  number
  enableProwlarr:   boolean
  enableWebScraper: boolean
  enableFileSorter: boolean
  searchQuery:      string
  categories:       string[]
  enabledPresetIds: string[]
}

interface CycleStats {
  cycleNumber: number
  startedAt:   number
  completedAt?: number
  prowlarr:    { archived: number; rejected: number; flagged: number }
  webScraper:  { archived: number; rejected: number; flagged: number }
  fileSorter:  { moved: number; archived: number }
  phase:       string
  error?:      string
}

interface AutomationStatus {
  running:          boolean
  config:           AutomationConfig
  currentCycle:     CycleStats | null
  totalCyclesRun:   number
  lifetimeArchived: number
  nextCycleAt?:     number
  activeWorkers:    number
  recentCycles:     CycleStats[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

function useCountdown(targetMs: number | undefined): string {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!targetMs) return ''
  const rem = targetMs - now
  if (rem <= 0) return 'Starting…'
  return fmtMs(rem)
}

// ── Phase display ─────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, { label: string; icon: ReactNode; color: string }> = {
  idle:     { label: 'Idle',       icon: <Timer size={13} />,        color: 'text-gray-400' },
  prowlarr: { label: 'Prowlarr',   icon: <Database size={13} />,     color: 'text-blue-400' },
  web:      { label: 'Web Scrape', icon: <Globe size={13} />,        color: 'text-cyan-400' },
  sorting:  { label: 'Sorting',    icon: <Folder size={13} />,       color: 'text-yellow-400' },
  done:     { label: 'Done',       icon: <CheckCircle size={13} />,  color: 'text-green-400' },
  error:    { label: 'Error',      icon: <XCircle size={13} />,      color: 'text-red-400' },
}

// ── Category groups (group-level selectors) ───────────────────────────────────

const CAT_GROUPS = [
  { id: '2000', name: 'Movies',  color: 'text-blue-400' },
  { id: '5000', name: 'TV',      color: 'text-purple-400' },
  { id: '6000', name: 'XXX',     color: 'text-red-400' },
  { id: '3000', name: 'Audio',   color: 'text-green-400' },
  { id: '7000', name: 'Books',   color: 'text-yellow-400' },
  { id: '8000', name: 'Other',   color: 'text-gray-400' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function AutomationPanel() {
  const [status, setStatus]   = useState<AutomationStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [log, setLog]         = useState<string[]>([])
  const [showConfig, setShowConfig] = useState(false)
  const [webPresets, setWebPresets] = useState<{ id: string; name: string }[]>([])
  const [localQuery, setLocalQuery] = useState('')
  const sseRef = useRef<EventSource | null>(null)
  const countdown = useCountdown(status?.nextCycleAt)

  // Keep local query in sync with server config
  useEffect(() => {
    if (status?.config.searchQuery !== undefined && localQuery !== status.config.searchQuery) {
      setLocalQuery(status.config.searchQuery)
    }
  }, [status?.config.searchQuery])

  // Fetch web presets for indexer selector
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/universal-search/sources`)
      .then(r => r.json())
      .then((d: any) => setWebPresets((d.webPresets ?? []).map((p: any) => ({ id: p.id, name: p.name }))))
      .catch(() => {})
  }, [])

  const addLog = (msg: string) =>
    setLog(l => [`${new Date().toLocaleTimeString()} — ${msg}`, ...l].slice(0, 80))

  // ── SSE connection ────────────────────────────────────────────────────────
  const connectSSE = useCallback(() => {
    if (sseRef.current) sseRef.current.close()
    const es = new EventSource(`${BACKEND_URL}/api/automation/stream`)
    sseRef.current = es

    es.addEventListener('status',         e => setStatus(JSON.parse(e.data)))
    es.addEventListener('started',        e => { setStatus(JSON.parse(e.data)); addLog('▶ Automation started') })
    es.addEventListener('stopped',        e => { setStatus(JSON.parse(e.data)); addLog('■ Automation stopped') })
    es.addEventListener('phaseStart',     e => {
      const d = JSON.parse(e.data)
      addLog(`⚙ Cycle ${d.cycle} — phase: ${d.phase}`)
      setStatus(prev => prev ? { ...prev, currentCycle: prev.currentCycle ? { ...prev.currentCycle, phase: d.phase } : null } : prev)
    })
    es.addEventListener('phaseComplete',  e => {
      const d = JSON.parse(e.data)
      const s = d.stats
      if (s) addLog(`✓ ${d.phase} — archived:${s.archived ?? s.moved ?? 0} flagged:${s.flagged ?? 0}`)
    })
    es.addEventListener('cycleComplete',  e => {
      const cycle: CycleStats = JSON.parse(e.data)
      const dur = cycle.completedAt ? fmtMs(cycle.completedAt - cycle.startedAt) : '?'
      const tot = (cycle.prowlarr?.archived ?? 0) + (cycle.webScraper?.archived ?? 0) + (cycle.fileSorter?.archived ?? 0)
      addLog(`✅ Cycle ${cycle.cycleNumber} done in ${dur} — +${tot} archived`)
      setStatus(prev => prev ? {
        ...prev,
        totalCyclesRun:   cycle.cycleNumber,
        lifetimeArchived: (prev.lifetimeArchived ?? 0) + tot,
        recentCycles:     [cycle, ...(prev.recentCycles ?? [])].slice(0, 20),
        currentCycle:     null,
      } : prev)
    })
    es.addEventListener('webBatchComplete', e => {
      const d = JSON.parse(e.data)
      addLog(`  Web batch ${d.batchIndex + 1}/${d.totalBatches} — total archived: ${d.totals.archived}`)
    })
    es.onerror = () => {
      setTimeout(connectSSE, 5000) // auto-reconnect
    }
  }, [])

  useEffect(() => {
    connectSSE()
    return () => sseRef.current?.close()
  }, [connectSSE])

  // ── Fetch initial status ──────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/automation/status`)
      const data = await res.json()
      setStatus(data)
    } catch {
      toast.error('Failed to reach automation engine')
    } finally {
      setLoading(false)
    }
  }, [])

  const patchConfig = useCallback(async (patch: Record<string, any>) => {
    await fetch(`${BACKEND_URL}/api/automation/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  // ── Toggle ────────────────────────────────────────────────────────────────
  const toggle = async () => {
    if (!status) return
    setToggling(true)
    try {
      const endpoint = status.running ? '/api/automation/stop' : '/api/automation/start'
      const res = await fetch(`${BACKEND_URL}${endpoint}`, { method: 'POST' })
      const data = await res.json()
      setStatus(data.status)
      toast.success(status.running ? 'Automation stopped' : 'Automation started — running continuously')
    } catch {
      toast.error('Failed to toggle automation')
    } finally {
      setToggling(false)
    }
  }

  // ── Run once ──────────────────────────────────────────────────────────────
  const runOnce = async () => {
    setToggling(true)
    addLog('→ Manual cycle triggered')
    try {
      const res = await fetch(`${BACKEND_URL}/api/automation/run-once`, { method: 'POST' })
      const data = await res.json()
      if (data.ok) toast.success(`Cycle ${data.cycle?.cycleNumber} complete`)
      else toast.error(data.error)
    } catch {
      toast.error('Failed to run cycle')
    } finally {
      setToggling(false)
    }
  }

  const isRunning = status?.running ?? false
  const phase     = status?.currentCycle?.phase ?? (isRunning ? 'idle' : 'idle')
  const phaseInfo = PHASE_LABELS[phase] ?? PHASE_LABELS.idle

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 p-4 h-full bg-gray-950 text-gray-100 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Robot size={22} weight="duotone" className={isRunning ? 'text-emerald-400' : 'text-gray-500'} />
          <div>
            <h2 className="text-base font-bold leading-none">Continuous Automation</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Parallel crawl · scrape · sort · archive</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchStatus} disabled={loading}>
          <ArrowClockwise size={13} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* ── BIG TOGGLE ──────────────────────────────────────────────────────── */}
      <Card className={`p-4 border-2 transition-all duration-300 ${isRunning
        ? 'bg-emerald-950/40 border-emerald-500/50'
        : 'bg-gray-900 border-gray-700'
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className={`text-lg font-bold ${isRunning ? 'text-emerald-400' : 'text-gray-400'}`}>
              {isRunning ? '● RUNNING' : '○ STOPPED'}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {isRunning
                ? countdown ? `Next cycle in ${countdown}` : 'Cycle in progress…'
                : 'Click to start hands-free automation'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-gray-400"
              onClick={runOnce}
              disabled={toggling || loading}
              title="Run one cycle now"
            >
              <Lightning size={13} className="mr-1" /> Once
            </Button>

            <Button
              size="lg"
              className={`px-6 font-bold transition-all ${isRunning
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              onClick={toggle}
              disabled={toggling || loading}
            >
              {toggling ? (
                <Spinner size={16} className="animate-spin mr-2" />
              ) : isRunning ? (
                <Stop size={16} className="mr-2" weight="fill" />
              ) : (
                <Play size={16} className="mr-2" weight="fill" />
              )}
              {isRunning ? 'Stop' : 'Start'}
            </Button>
          </div>
        </div>

        {/* Current phase indicator */}
        {isRunning && (
          <div className={`flex items-center gap-1.5 mt-3 text-xs ${phaseInfo.color}`}>
            {status?.currentCycle ? (
              <><Spinner size={11} className="animate-spin" /> Cycle {status.currentCycle.cycleNumber} · {phaseInfo.label}</>
            ) : (
              <><Timer size={11} /> Waiting for next cycle</>
            )}
          </div>
        )}
      </Card>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Cycles Run',     value: status?.totalCyclesRun   ?? 0, icon: <StackSimple size={13} />, color: 'text-purple-400' },
          { label: 'Total Archived', value: status?.lifetimeArchived ?? 0, icon: <Archive size={13} />,     color: 'text-emerald-400' },
          { label: 'Active Workers', value: status?.activeWorkers    ?? 0, icon: <Lightning size={13} />,   color: 'text-yellow-400' },
        ].map(s => (
          <Card key={s.label} className="p-2 bg-gray-900 border-gray-700 text-center">
            <div className={`flex items-center justify-center gap-1 ${s.color} text-xs mb-0.5`}>
              {s.icon} {s.label}
            </div>
            <div className="text-xl font-bold">{s.value.toLocaleString()}</div>
          </Card>
        ))}
      </div>

      {/* Phase toggles */}
      {status?.config && (
        <Card className="p-3 bg-gray-900 border-gray-700 space-y-2">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Pipeline Stages</p>
          {[
            { key: 'enableProwlarr',   label: 'Prowlarr Indexers',  icon: <Database size={11} />,  workers: status.config.prowlarrWorkers,  color: 'text-blue-400' },
            { key: 'enableWebScraper', label: 'Web Scrapers',       icon: <Globe size={11} />,     workers: status.config.webPresetWorkers, color: 'text-cyan-400' },
            { key: 'enableFileSorter', label: 'File Sorter',        icon: <Folder size={11} />,    workers: status.config.fileSortWorkers,  color: 'text-yellow-400' },
          ].map(stage => (
            <div key={stage.key} className="flex items-center justify-between text-xs">
              <div className={`flex items-center gap-1.5 ${stage.color}`}>
                {stage.icon}
                <span>{stage.label}</span>
                <Badge className="text-[9px] py-0 px-1.5 bg-white/10 text-gray-400 ml-1">
                  {stage.workers}w
                </Badge>
              </div>
              <Switch
                checked={(status.config as any)[stage.key]}
                onCheckedChange={async (v) => {
                  await fetch(`${BACKEND_URL}/api/automation/config`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [stage.key]: v }),
                  })
                  fetchStatus()
                }}
              />
            </div>
          ))}
        </Card>
      )}

      {/* ── Search Configuration ───────────────────────────────────────────── */}
      <Card className="bg-gray-900 border-gray-700">
        <button
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors"
          onClick={() => setShowConfig(v => !v)}
        >
          <span className="flex items-center gap-1.5 uppercase tracking-wide">
            <MagnifyingGlass size={11} /> Search Configuration
          </span>
          {showConfig ? <CaretUp size={11} /> : <CaretDown size={11} />}
        </button>

        {showConfig && (
          <div className="px-3 pb-3 space-y-3 border-t border-gray-800 pt-2">
            {/* Keyword */}
            <div>
              <p className="text-[10px] text-gray-500 mb-1">Keyword / Title Filter</p>
              <Input
                value={localQuery}
                onChange={e => setLocalQuery(e.target.value)}
                onBlur={() => patchConfig({ searchQuery: localQuery })}
                onKeyDown={e => e.key === 'Enter' && patchConfig({ searchQuery: localQuery })}
                placeholder="e.g. avengers, breaking bad… (empty = all)"
                className="h-7 text-xs bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-600"
              />
            </div>

            {/* Categories */}
            <div>
              <p className="text-[10px] text-gray-500 mb-1">Prowlarr Categories</p>
              <div className="grid grid-cols-3 gap-1">
                {CAT_GROUPS.map(g => {
                  const active = (status?.config.categories ?? []).includes(g.id)
                  return (
                    <label key={g.id} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={active}
                        onCheckedChange={v => {
                          const cur = status?.config.categories ?? []
                          patchConfig({ categories: v ? [...cur, g.id] : cur.filter((c: string) => c !== g.id) })
                        }}
                        className="h-3 w-3"
                      />
                      <span className={`text-[10px] ${g.color}`}>{g.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Web Presets */}
            {webPresets.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-gray-500">Web Scrapers</p>
                  <button
                    className="text-[9px] text-gray-600 hover:text-gray-400"
                    onClick={() => {
                      const allIds = webPresets.map(p => p.id)
                      const cur = status?.config.enabledPresetIds ?? []
                      patchConfig({ enabledPresetIds: cur.length === allIds.length ? [] : allIds })
                    }}
                  >
                    {(status?.config.enabledPresetIds?.length ?? 0) === webPresets.length ? 'none' : 'all'}
                  </button>
                </div>
                <ScrollArea className="h-24 border border-gray-800 rounded p-1.5">
                  <div className="flex flex-col gap-1">
                    {webPresets.map(p => {
                      const enabledIds = status?.config.enabledPresetIds ?? []
                      const active = enabledIds.length === 0 || enabledIds.includes(p.id)
                      return (
                        <label key={p.id} className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={active}
                            onCheckedChange={v => {
                              const allIds = webPresets.map(x => x.id)
                              const cur: string[] = enabledIds.length === 0 ? allIds : [...enabledIds]
                              patchConfig({ enabledPresetIds: v ? [...new Set([...cur, p.id])] : cur.filter(id => id !== p.id) })
                            }}
                            className="h-3 w-3"
                          />
                          <span className="text-[10px] text-gray-400 truncate">{p.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </Card>

      <Separator className="border-gray-800" />

      {/* Recent cycles */}
      {(status?.recentCycles?.length ?? 0) > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Recent Cycles</p>
          <div className="flex flex-col gap-1">
            {(status?.recentCycles ?? []).slice(0, 5).map(c => {
              const tot = (c.prowlarr?.archived ?? 0) + (c.webScraper?.archived ?? 0) + (c.fileSorter?.archived ?? 0)
              const dur = c.completedAt ? fmtMs(c.completedAt - c.startedAt) : '…'
              return (
                <div key={c.cycleNumber} className={`flex items-center gap-2 text-[11px] px-2 py-1 rounded ${
                  c.phase === 'error' ? 'bg-red-900/20 text-red-300' : 'bg-gray-900 text-gray-400'
                }`}>
                  <span className="text-gray-600 w-14 shrink-0">#{c.cycleNumber}</span>
                  <span className="flex-1 truncate">
                    {c.phase === 'error' ? `⚠ ${c.error}` : `+${tot} archived`}
                  </span>
                  <span className="text-gray-600 shrink-0">{dur}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Live log */}
      <div className="flex-1 flex flex-col min-h-0">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Live Log</p>
        <ScrollArea className="flex-1 h-40 bg-gray-900 rounded border border-gray-800 p-2">
          <AnimatePresence initial={false}>
            {log.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-4">No activity yet</p>
            ) : (
              log.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-[10px] font-mono text-gray-400 py-0.5 border-b border-gray-800/50 last:border-0"
                >
                  {line}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </ScrollArea>
      </div>
    </div>
  )
}
