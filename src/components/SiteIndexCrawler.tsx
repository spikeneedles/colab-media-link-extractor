/**
 * SiteIndexCrawler.tsx — Full-Force site indexer UI
 *
 * Live visualisation:
 *   • 4 stat cards  (pages visited / queued / media found / archived)
 *   • Pie chart     (categories: movies / livetv / series / unknown)
 *   • Area chart    (timeline: pages + media over elapsed seconds)
 *   • 7 crawler rows with activity dots + live stats
 *   • Last crawled URL + overall progress bar
 *   • Past-job history list
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button }    from '@/components/ui/button'
import { Input }     from '@/components/ui/input'
import { Textarea }  from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Globe, StopCircle, CheckCircle, XCircle, ArrowClockwise, Cookie, CaretDown, CaretRight, Trash } from '@phosphor-icons/react'
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as RechartsTip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3002'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CrawlerStats {
  bfs:       { pages: number; media: number; active: boolean }
  sitemap:   { urlsFound: number; sitemapsChecked: number; active: boolean }
  playlists: { pathsTried: number; found: number; entries: number; active: boolean }
  apiPaths:  { tried: number; found: number; media: number; active: boolean }
  rss:       { feedsTried: number; feedsFound: number; entries: number; media: number; active: boolean }
  search:    { presetsSearched: number; resultsFound: number; media: number; active: boolean }
  parallel:  { pages: number; media: number; active: boolean }
}

interface Categories { movies: number; livetv: number; series: number; unknown: number }
interface TimelinePoint { elapsed: number; pages: number; media: number; archived: number }

interface JobSummary {
  id:            string
  domain:        string
  baseUrl:       string
  status:        'running' | 'stopping' | 'completed' | 'error'
  pagesVisited:  number
  pagesQueued:   number
  mediaFound:    number
  mediaArchived: number
  startedAt:     string
  completedAt?:  string
  error?:        string
  crawlerStats?: CrawlerStats
  categories?:   Categories
}

interface LiveStats extends JobSummary { lastUrl?: string }

// ── Palette ────────────────────────────────────────────────────────────────────

const CAT_COLORS: Record<keyof Categories, string> = {
  movies:  '#8b5cf6',
  livetv:  '#3b82f6',
  series:  '#10b981',
  unknown: '#6b7280',
}

const CRAWLER_META: Array<{
  key:   keyof CrawlerStats
  label: string
  icon:  string
  stat:  (cs: CrawlerStats) => string
}> = [
  { key: 'bfs',       label: 'Puppeteer BFS',     icon: '🖥',  stat: cs => `${cs.bfs.pages} pages · ${cs.bfs.media} media` },
  { key: 'sitemap',   label: 'Sitemap Seeder',     icon: '🗺',  stat: cs => `${cs.sitemap.urlsFound} URLs · ${cs.sitemap.sitemapsChecked} maps` },
  { key: 'playlists', label: 'Playlist Hunter',    icon: '🎵',  stat: cs => `${cs.playlists.found}/${cs.playlists.pathsTried} paths · ${cs.playlists.entries} items` },
  { key: 'apiPaths',  label: 'API Path Hunter',    icon: '⚡',  stat: cs => `${cs.apiPaths.found}/${cs.apiPaths.tried} paths · ${cs.apiPaths.media} media` },
  { key: 'rss',       label: 'RSS / Atom Feeds',   icon: '📡',  stat: cs => `${cs.rss.feedsFound} feeds · ${cs.rss.media} media` },
  { key: 'search',    label: 'SearchCrawler (62)', icon: '🔍',  stat: cs => `${cs.search.presetsSearched} presets · ${cs.search.resultsFound} results` },
  { key: 'parallel',  label: 'ParallelWebCrawler', icon: '⚙️', stat: cs => `${cs.parallel.pages} pages · ${cs.parallel.media} media` },
]

const EMPTY_CS: CrawlerStats = {
  bfs:       { pages: 0, media: 0, active: false },
  sitemap:   { urlsFound: 0, sitemapsChecked: 0, active: false },
  playlists: { pathsTried: 0, found: 0, entries: 0, active: false },
  apiPaths:  { tried: 0, found: 0, media: 0, active: false },
  rss:       { feedsTried: 0, feedsFound: 0, entries: 0, media: 0, active: false },
  search:    { presetsSearched: 0, resultsFound: 0, media: 0, active: false },
  parallel:  { pages: 0, media: 0, active: false },
}

// ── Component ──────────────────────────────────────────────────────────────────

export function SiteIndexCrawler() {
  const [url,      setUrl]      = useState('')
  const [jobId,    setJobId]    = useState<string | null>(null)
  const [stats,    setStats]    = useState<LiveStats | null>(null)
  const [history,  setHistory]  = useState<JobSummary[]>([])
  const [loading,  setLoading]  = useState(false)
  const [errMsg,   setErrMsg]   = useState<string | null>(null)
  const [timeline, setTimeline] = useState<TimelinePoint[]>([])
  const esRef = useRef<EventSource | null>(null)

  // Cookie manager state
  const [cookieOpen,    setCookieOpen]    = useState(false)
  const [cookieDomain,  setCookieDomain]  = useState('')
  const [cookieText,    setCookieText]    = useState('')
  const [cookieSaved,   setCookieSaved]   = useState(false)
  const [cookieList,    setCookieList]    = useState<{ domain: string; count: number }[]>([])

  const refreshCookieList = useCallback(() => {
    fetch(`${BACKEND_URL}/api/site-crawler/cookies`).then(r => r.json())
      .then((d: any) => setCookieList(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  useEffect(() => { if (cookieOpen) refreshCookieList() }, [cookieOpen, refreshCookieList])

  const handleSaveCookies = async () => {
    const domain = (cookieDomain || (url ? new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname : '')).trim()
    if (!domain || !cookieText.trim()) return
    // Accept JSON array or raw "name=value; ..." string
    let parsed: any = cookieText.trim()
    try { parsed = JSON.parse(cookieText.trim()) } catch { /* treat as raw string */ }
    await fetch(`${BACKEND_URL}/api/site-crawler/cookies/${encodeURIComponent(domain)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookies: parsed }),
    })
    setCookieSaved(true); setTimeout(() => setCookieSaved(false), 2000)
    refreshCookieList()
  }

  const handleDeleteCookies = async (domain: string) => {
    await fetch(`${BACKEND_URL}/api/site-crawler/cookies/${encodeURIComponent(domain)}`, { method: 'DELETE' })
    refreshCookieList()
  }

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/site-crawler/jobs`)
      .then(r => r.json()).then(j => setHistory(j as JobSummary[])).catch(() => {})
  }, [])

  const subscribe = useCallback((id: string) => {
    esRef.current?.close()
    setTimeline([])
    const es = new EventSource(`${BACKEND_URL}/api/site-crawler/status/${id}`)
    esRef.current = es

    es.onmessage = (e) => {
      const d = JSON.parse(e.data)
      if (d.type === 'progress' || d.type === 'status') {
        setStats(prev => ({
          ...(prev ?? {} as LiveStats),
          id,
          domain:        prev?.domain        ?? '',
          baseUrl:       prev?.baseUrl       ?? '',
          startedAt:     prev?.startedAt     ?? new Date().toISOString(),
          status:        d.status            ?? prev?.status       ?? 'running',
          pagesVisited:  d.visited           ?? prev?.pagesVisited  ?? 0,
          pagesQueued:   d.queued            ?? prev?.pagesQueued   ?? 0,
          mediaFound:    d.media             ?? prev?.mediaFound    ?? 0,
          mediaArchived: d.archived          ?? prev?.mediaArchived ?? 0,
          lastUrl:       d.lastUrl           ?? prev?.lastUrl,
          crawlerStats:  d.crawlerStats      ?? prev?.crawlerStats,
          categories:    d.categories        ?? prev?.categories,
        }))
      } else if (d.type === 'timeline_point') {
        setTimeline(prev => [...prev, { elapsed: d.elapsed, pages: d.pages, media: d.media, archived: d.archived }])
      } else if (d.type === 'complete') {
        setStats(prev => prev ? { ...prev, status: 'completed' } : prev)
        es.close()
        fetch(`${BACKEND_URL}/api/site-crawler/jobs`).then(r => r.json()).then(setHistory).catch(() => {})
      } else if (d.type === 'error') {
        setStats(prev => prev ? { ...prev, status: 'error', error: d.error } : prev)
        es.close()
      }
    }
    es.onerror = () => {
      setStats(prev => prev?.status === 'running' ? { ...prev, status: 'error', error: 'Connection lost' } : prev)
      es.close()
    }
  }, [])

  useEffect(() => () => { esRef.current?.close() }, [])

  const handleStart = async () => {
    if (!url.trim()) return
    setLoading(true); setErrMsg(null); setTimeline([])
    try {
      const res  = await fetch(`${BACKEND_URL}/api/site-crawler/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to start')
      setJobId(data.jobId)
      setStats({
        id: data.jobId, domain: data.domain, baseUrl: url.trim(),
        status: 'running', pagesVisited: 0, pagesQueued: 1,
        mediaFound: 0, mediaArchived: 0, startedAt: data.startedAt,
      })
      subscribe(data.jobId)
    } catch (err: any) { setErrMsg(err.message) }
    finally { setLoading(false) }
  }

  const handleStop = async () => {
    if (!jobId) return
    await fetch(`${BACKEND_URL}/api/site-crawler/stop/${jobId}`, { method: 'POST' }).catch(() => {})
    setStats(prev => prev ? { ...prev, status: 'stopping' } : prev)
    esRef.current?.close()
  }

  const statusColor = (s: string) =>
    s === 'completed' ? 'text-green-400' : s === 'error' ? 'text-red-400' :
    s === 'stopping'  ? 'text-yellow-400' : 'text-blue-400'

  const cs = stats?.crawlerStats ?? EMPTY_CS

  const catData = stats?.categories
    ? (Object.entries(stats.categories) as [keyof Categories, number][])
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: k, value: v, color: CAT_COLORS[k] }))
    : []

  const pct = stats && stats.pagesQueued > 0
    ? Math.min(100, (stats.pagesVisited / (stats.pagesVisited + stats.pagesQueued)) * 100)
    : 0

  return (
    <div className="flex flex-col gap-3 h-full p-3 text-sm overflow-y-auto silas-scrollbar">

      {/* URL input */}
      <div className="flex gap-2">
        <Input
          placeholder="https://example.com"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleStart()}
          className="flex-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 text-xs"
        />
        <Button
          size="sm" onClick={handleStart}
          disabled={loading || stats?.status === 'running'}
          className="bg-purple-600 hover:bg-purple-700 text-white whitespace-nowrap px-3"
        >
          <Globe className="w-4 h-4 mr-1" />
          Full Index &amp; Map
        </Button>
        {stats?.status === 'running' && (
          <Button size="sm" variant="destructive" onClick={handleStop}>
            <StopCircle className="w-4 h-4 mr-1" />
            Stop
          </Button>
        )}
      </div>

      {/* Cookie Manager */}
      <div className="rounded-lg border border-gray-700 bg-gray-900 overflow-hidden">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          onClick={() => setCookieOpen(o => !o)}
        >
          <Cookie className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-medium">Cloudflare Cookie Bypass</span>
          {cookieList.length > 0 && (
            <span className="ml-1 text-[10px] bg-amber-500/20 text-amber-400 rounded px-1.5 py-0.5 font-mono">
              {cookieList.length} domain{cookieList.length !== 1 ? 's' : ''}
            </span>
          )}
          <span className="ml-auto">{cookieOpen ? <CaretDown className="w-3 h-3" /> : <CaretRight className="w-3 h-3" />}</span>
        </button>

        {cookieOpen && (
          <div className="flex flex-col gap-2 px-3 pb-3 border-t border-gray-800">
            <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
              Paste your <code className="text-amber-400 bg-gray-800 px-1 rounded">cf_clearance</code> cookie to bypass Cloudflare Enterprise.
              In Chrome: DevTools → Application → Cookies → right-click → copy all, paste below as JSON or <code className="text-gray-400">name=value; ...</code>
            </p>

            <Input
              placeholder="Domain (e.g. eporner.com) — auto-filled from URL above"
              value={cookieDomain}
              onChange={e => setCookieDomain(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 text-xs h-7"
            />

            <Textarea
              placeholder={'[{"name":"cf_clearance","value":"abc123..."}, ...]\nor: cf_clearance=abc123; __cf_bm=xyz...'}
              value={cookieText}
              onChange={e => setCookieText(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 text-xs font-mono min-h-[72px] resize-y"
            />

            <Button
              size="sm" onClick={handleSaveCookies}
              className={`self-start text-xs px-3 h-7 ${cookieSaved ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'} text-white`}
            >
              <Cookie className="w-3 h-3 mr-1" />
              {cookieSaved ? '✓ Saved' : 'Save Cookies'}
            </Button>

            {cookieList.length > 0 && (
              <div className="flex flex-col gap-1 mt-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Stored Domains</p>
                {cookieList.map(({ domain, count }) => (
                  <div key={domain} className="flex items-center justify-between rounded border border-gray-800 bg-gray-800/50 px-2 py-1 text-xs">
                    <span className="text-gray-200 font-mono">{domain}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-amber-400 font-mono">{count} cookie{count !== 1 ? 's' : ''}</span>
                      <button
                        onClick={() => handleDeleteCookies(domain)}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                        title="Remove cookies for this domain"
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {errMsg && <p className="text-red-400 text-xs">{errMsg}</p>}

      {stats && (<>
        {/* Domain header */}
        <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-900 px-3 py-2">
          <span className="font-bold text-white truncate">{stats.domain || url}</span>
          <span className={`text-xs font-mono font-bold uppercase flex items-center gap-1 ${statusColor(stats.status)}`}>
            {stats.status === 'completed' ? <CheckCircle weight="fill" className="w-3.5 h-3.5" /> :
             stats.status === 'error'     ? <XCircle     weight="fill" className="w-3.5 h-3.5" /> :
                                            <ArrowClockwise className="w-3.5 h-3.5 animate-spin" />}
            {stats.status}
          </span>
        </div>

        {/* 4 stat cards */}
        <div className="grid grid-cols-4 gap-2">
          {([
            { label: 'Pages Visited', value: stats.pagesVisited,  color: 'text-purple-400' },
            { label: 'Pages Queued',  value: stats.pagesQueued,   color: 'text-blue-400' },
            { label: 'Media Found',   value: stats.mediaFound,    color: 'text-amber-400' },
            { label: 'Archived',      value: stats.mediaArchived, color: 'text-green-400' },
          ] as const).map(c => (
            <div key={c.label} className="rounded-lg border border-gray-700 bg-gray-900 p-2 text-center">
              <div className={`text-xl font-bold font-mono ${c.color}`}>{c.value.toLocaleString()}</div>
              <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-3">
          {/* Pie — categories */}
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Media by Category</p>
            {catData.length > 0 ? (
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={catData} cx="50%" cy="50%" innerRadius={28} outerRadius={52} dataKey="value" paddingAngle={2}>
                    {catData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <RechartsTip
                    contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }}
                    formatter={(v: number, n: string) => [`${v} items`, n]}
                  />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[140px] flex items-center justify-center text-gray-600 text-xs">Waiting for media…</div>
            )}
          </div>

          {/* Area — timeline */}
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Crawl Progress Over Time</p>
            {timeline.length > 1 ? (
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={timeline} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                  <defs>
                    <linearGradient id="gPages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gMedia" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="elapsed" tick={{ fontSize: 9, fill: '#6b7280' }} tickFormatter={v => `${v}s`} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} />
                  <RechartsTip
                    contentStyle={{ background: '#111', border: '1px solid #374151', borderRadius: 6, fontSize: 11 }}
                    labelFormatter={v => `${v}s elapsed`}
                  />
                  <Area type="monotone" dataKey="pages"    name="Pages"   stroke="#8b5cf6" fill="url(#gPages)" strokeWidth={1.5} dot={false} />
                  <Area type="monotone" dataKey="media"    name="Media"   stroke="#f59e0b" fill="url(#gMedia)" strokeWidth={1.5} dot={false} />
                  <Area type="monotone" dataKey="archived" name="Archived" stroke="#10b981" fill="none"          strokeWidth={1}   dot={false} strokeDasharray="3 2" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[140px] flex items-center justify-center text-gray-600 text-xs">Collecting data…</div>
            )}
          </div>
        </div>

        {/* Overall progress bar */}
        {stats.status === 'running' && (
          <div>
            <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
              <span>Overall progress</span>
              <span>{pct.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 via-blue-500 to-green-500 transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            {stats.lastUrl && (
              <p className="text-gray-500 text-[10px] mt-0.5 truncate">↳ {stats.lastUrl}</p>
            )}
          </div>
        )}

        {/* 7 Crawler rows */}
        <div className="rounded-lg border border-gray-700 bg-gray-900 p-2.5 flex flex-col gap-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Active Crawlers</p>
          {CRAWLER_META.map(({ key, label, icon, stat }) => {
            const isActive = cs[key]?.active ?? false
            return (
              <div key={key} className="grid items-center gap-2" style={{ gridTemplateColumns: '20px 130px 1fr 160px 8px' }}>
                <span className="text-sm">{icon}</span>
                <span className={`text-xs truncate ${isActive ? 'text-white' : 'text-gray-500'}`}>{label}</span>
                <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${isActive ? 'bg-purple-500' : 'bg-gray-700'}`}
                    style={{ width: isActive ? '100%' : '40%' }}
                  />
                </div>
                <span className="text-[10px] font-mono text-gray-400 text-right truncate">{stat(cs)}</span>
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
              </div>
            )
          })}
        </div>

        {stats.error && <p className="text-red-400 text-xs">{stats.error}</p>}
      </>)}

      {/* Job history */}
      {history.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-gray-500 text-xs uppercase tracking-wide">Past Jobs</p>
          <ScrollArea className="max-h-40">
            <div className="flex flex-col gap-1">
              {[...history].reverse().map(job => (
                <div
                  key={job.id}
                  className="rounded border border-gray-800 bg-gray-900 p-2 text-xs flex items-center justify-between gap-2 cursor-pointer hover:border-gray-600 transition-colors"
                  onClick={() => {
                    setJobId(job.id); setStats({ ...job }); setTimeline([])
                    if (job.status === 'running') subscribe(job.id)
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="w-3 h-3 text-gray-500 shrink-0" />
                    <span className="truncate text-gray-200 font-medium">{job.domain}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-gray-500">
                    <span>{job.pagesVisited} pages</span>
                    <span className="text-amber-400">{job.mediaFound} media</span>
                    <span className={`uppercase font-bold text-[10px] ${
                      job.status === 'completed' ? 'text-green-400' :
                      job.status === 'error'     ? 'text-red-400'   : 'text-blue-400'}`}>
                      {job.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Hardware tags */}
      <div className="mt-auto flex flex-wrap gap-1 pt-1">
        {['RTX 2070 GPU·accel', 'Ryzen 3900X', '24 threads', '8 crawlers', 'BFS+Sitemap+Playlists+API+RSS+Search+Parallel'].map(tag => (
          <span key={tag} className="text-[9px] bg-gray-800 text-gray-500 rounded px-1.5 py-0.5 font-mono">{tag}</span>
        ))}
      </div>
    </div>
  )
}
