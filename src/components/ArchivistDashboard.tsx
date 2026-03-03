/**
 * ArchivistDashboard — The Archivist Protocol UI
 * Three Pillars: Movies | Live TV | Series
 * Shows stats, integrated player, flagged review, and manual archive form.
 */

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  FilmSlate, Broadcast, Television, Archive, CheckCircle,
  XCircle, Warning, Play, DownloadSimple, ArrowClockwise,
  Database, ListChecks, MagnifyingGlass, Trash, CaretRight,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { MediaPlayer, type QueueItem } from '@/components/MediaPlayer'
import {
  getArchivistStats,
  getFlaggedItems,
  resolveFlaggedItem,
  validateUrl,
  archiveEntry,
  archiveBatch,
  fetchPlaylistAsQueue,
  getPlaylistUrl,
  parseM3UContent,
  formatBytes,
  type ArchivistStats,
  type ArchivistEntry,
  type ArchiveCategory,
  type PlaylistQueueItem,
} from '@/lib/archivistClient'

// ── Pillar config ─────────────────────────────────────────────────────────────

const PILLARS: Array<{
  id:       ArchiveCategory
  label:    string
  icon:     React.ReactNode
  color:    string
  ring:     string
  playlist: string
}> = [
  {
    id:       'movies',
    label:    'Movies',
    icon:     <FilmSlate size={28} weight="duotone" />,
    color:    'text-amber-400',
    ring:     'ring-amber-400/40',
    playlist: 'movies_master.m3u',
  },
  {
    id:       'live_tv',
    label:    'Live TV',
    icon:     <Broadcast size={28} weight="duotone" />,
    color:    'text-cyan-400',
    ring:     'ring-cyan-400/40',
    playlist: 'livetv_master.m3u',
  },
  {
    id:       'series',
    label:    'Series',
    icon:     <Television size={28} weight="duotone" />,
    color:    'text-violet-400',
    ring:     'ring-violet-400/40',
    playlist: 'series_master.m3u',
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function ArchivistDashboard() {
  const [stats, setStats]           = useState<ArchivistStats | null>(null)
  const [flagged, setFlagged]       = useState<ArchivistEntry[]>([])
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [activeTab, setActiveTab]   = useState('pillars')

  // Player state
  const [playerOpen, setPlayerOpen]     = useState(false)
  const [playerQueue, setPlayerQueue]   = useState<QueueItem[]>([])
  const [playerIndex, setPlayerIndex]   = useState(0)
  const [loadingCategory, setLoadingCategory] = useState<ArchiveCategory | null>(null)

  // Manual archive form
  const [archiveForm, setArchiveForm] = useState({
    mediaUrl:    '',
    sourceUrl:   '',
    title:       '',
    contentType: 'unknown',
    category:    '',
    resolution:  '',
    indexer:     '',
  })
  const [archiveResult, setArchiveResult] = useState<{
    status: string; code?: string; category?: string
  } | null>(null)
  const [isArchiving, setIsArchiving]     = useState(false)
  const [isValidating, setIsValidating]   = useState(false)
  const [validationResult, setValidationResult] = useState<{
    valid: boolean; statusCode?: number; error?: string; detectedContentType?: string
  } | null>(null)

  // Batch archive
  const [batchText, setBatchText]       = useState('')
  const [batchResult, setBatchResult]   = useState<{
    archived: number; flagged: number; rejected: number; total: number
  } | null>(null)
  const [isBatching, setIsBatching]     = useState(false)

  // ── Load data ───────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    setIsLoadingStats(true)
    try {
      const [s, f] = await Promise.all([getArchivistStats(), getFlaggedItems()])
      setStats(s)
      setFlagged(f)
    } catch (err) {
      toast.error('Could not reach Archivist backend')
    } finally {
      setIsLoadingStats(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  // ── Player loading ──────────────────────────────────────────────────────────

  const loadCategoryIntoPlayer = useCallback(async (cat: ArchiveCategory) => {
    setLoadingCategory(cat)
    try {
      const items = await fetchPlaylistAsQueue(cat)
      if (items.length === 0) {
        toast.info(`No entries archived in ${cat} yet`)
        return
      }
      const queue: QueueItem[] = items.map(i => ({
        url:       i.url,
        title:     i.title,
        mediaType: i.type,
      }))
      setPlayerQueue(queue)
      setPlayerIndex(0)
      setPlayerOpen(true)
      toast.success(`Loaded ${queue.length} items from ${cat}`)
    } catch {
      toast.error(`Failed to load ${cat} playlist`)
    } finally {
      setLoadingCategory(null)
    }
  }, [])

  // ── Manual archive ──────────────────────────────────────────────────────────

  const handleValidate = async () => {
    if (!archiveForm.mediaUrl) return
    setIsValidating(true)
    setValidationResult(null)
    try {
      const r = await validateUrl(archiveForm.mediaUrl)
      setValidationResult(r)
    } catch {
      toast.error('Validation request failed')
    } finally {
      setIsValidating(false)
    }
  }

  const handleArchive = async () => {
    if (!archiveForm.mediaUrl || !archiveForm.sourceUrl) {
      toast.error('sourceUrl and mediaUrl are required (Meta-Minimum)')
      return
    }
    setIsArchiving(true)
    setArchiveResult(null)
    try {
      const result = await archiveEntry({
        mediaUrl:    archiveForm.mediaUrl,
        sourceUrl:   archiveForm.sourceUrl,
        title:       archiveForm.title || new URL(archiveForm.mediaUrl).pathname.split('/').pop() || 'Untitled',
        contentType: archiveForm.contentType || 'unknown',
        category:    archiveForm.category || undefined,
        resolution:  archiveForm.resolution || undefined,
        indexer:     archiveForm.indexer || undefined,
      })
      setArchiveResult({ status: result.status, code: result.code, category: result.category })

      if (result.status === 'archived') {
        toast.success(`Archived → ${result.category}`)
        setArchiveForm(f => ({ ...f, mediaUrl: '', title: '', resolution: '' }))
        loadStats()
      } else if (result.status === 'flagged') {
        toast.warning('Flagged for review — ambiguous category')
        loadStats()
      } else {
        toast.error(`Rejected: ${result.code}`)
      }
    } catch {
      toast.error('Archive request failed')
    } finally {
      setIsArchiving(false)
    }
  }

  // ── Batch archive ───────────────────────────────────────────────────────────

  const handleBatch = async () => {
    const urls = batchText.split('\n').map(l => l.trim()).filter(l => /^https?:\/\//.test(l))
    if (urls.length === 0) {
      toast.error('No valid HTTP(S) URLs found')
      return
    }
    setIsBatching(true)
    setBatchResult(null)
    try {
      const entries: ArchivistEntry[] = urls.map(url => ({
        mediaUrl:    url,
        sourceUrl:   archiveForm.sourceUrl || 'manual-batch',
        title:       new URL(url).pathname.split('/').pop() || 'Untitled',
        contentType: 'unknown',
      }))
      const r = await archiveBatch(entries)
      setBatchResult(r.summary)
      toast.success(`Batch: ${r.summary.archived} archived, ${r.summary.flagged} flagged, ${r.summary.rejected} rejected`)
      loadStats()
    } catch {
      toast.error('Batch request failed')
    } finally {
      setIsBatching(false)
    }
  }

  // ── Resolve flagged ─────────────────────────────────────────────────────────

  const handleResolveFlagged = async (entry: ArchivistEntry, category: ArchiveCategory) => {
    try {
      await resolveFlaggedItem(entry.mediaUrl, category)
      toast.success(`Resolved → ${category}`)
      setFlagged(f => f.filter(x => x.mediaUrl !== entry.mediaUrl))
      loadStats()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-8">
      {/* Header banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Archive size={24} className="text-accent" weight="duotone" />
          <div>
            <p className="text-sm text-muted-foreground font-mono">
              SILAS — Systematic Intelligent Link Acquisition &amp; Sorting
            </p>
            <p className="text-xs text-muted-foreground/60">
              Integrity First · Categorization Mandate · Redundancy Clause · Meta-Minimum
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadStats} disabled={isLoadingStats}>
          <ArrowClockwise size={14} className={isLoadingStats ? 'animate-spin' : ''} />
          <span className="ml-1">Refresh</span>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="pillars">
            <Database size={14} className="mr-1" /> Three Pillars
          </TabsTrigger>
          <TabsTrigger value="archive">
            <Archive size={14} className="mr-1" /> Archive
          </TabsTrigger>
          <TabsTrigger value="flagged">
            <Warning size={14} className="mr-1" />
            Flagged
            {(stats?.flaggedPending ?? 0) > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1">
                {stats!.flaggedPending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="batch">
            <ListChecks size={14} className="mr-1" /> Batch
          </TabsTrigger>
        </TabsList>

        {/* ── Three Pillars ─────────────────────────────────────────────────── */}
        <TabsContent value="pillars" className="mt-4 space-y-4">
          {/* Session stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <Card className="p-3 bg-green-500/10 border-green-500/20">
                <p className="text-2xl font-bold text-green-400">{stats.archived}</p>
                <p className="text-xs text-muted-foreground">Archived (session)</p>
              </Card>
              <Card className="p-3 bg-yellow-500/10 border-yellow-500/20">
                <p className="text-2xl font-bold text-yellow-400">{stats.flaggedPending}</p>
                <p className="text-xs text-muted-foreground">Flagged (pending)</p>
              </Card>
              <Card className="p-3 bg-red-500/10 border-red-500/20">
                <p className="text-2xl font-bold text-red-400">{stats.rejected}</p>
                <p className="text-xs text-muted-foreground">Rejected (session)</p>
              </Card>
            </div>
          )}

          {/* Pillar cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PILLARS.map(pillar => {
              const pStats = stats?.playlists[pillar.id]
              return (
                <motion.div
                  key={pillar.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: PILLARS.indexOf(pillar) * 0.07 }}
                >
                  <Card
                    className={`p-5 space-y-4 ring-2 ${pillar.ring} bg-card/80 hover:bg-card transition-colors`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={pillar.color}>{pillar.icon}</span>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {pillar.playlist}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold">{pillar.label}</h3>
                      {pStats ? (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">{pStats.count.toLocaleString()}</span> entries
                          &nbsp;·&nbsp;{formatBytes(pStats.sizeBytes)}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Loading…</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => loadCategoryIntoPlayer(pillar.id)}
                        disabled={loadingCategory === pillar.id || (pStats?.count ?? 0) === 0}
                      >
                        {loadingCategory === pillar.id
                          ? <ArrowClockwise size={14} className="animate-spin mr-1" />
                          : <Play size={14} className="mr-1" />
                        }
                        Play All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        title="Download master playlist"
                      >
                        <a href={getPlaylistUrl(pillar.id)} download={pillar.playlist}>
                          <DownloadSimple size={14} />
                        </a>
                      </Button>
                    </div>

                    {/* Progress bar relative to total */}
                    {stats && stats.totalUnique > 0 && pStats && (
                      <div className="space-y-1">
                        <Progress
                          value={(pStats.count / stats.totalUnique) * 100}
                          className="h-1"
                        />
                        <p className="text-[10px] text-muted-foreground text-right">
                          {stats.totalUnique > 0
                            ? `${((pStats.count / stats.totalUnique) * 100).toFixed(1)}% of archive`
                            : ''}
                        </p>
                      </div>
                    )}
                  </Card>
                </motion.div>
              )
            })}
          </div>

          {/* Total archive size */}
          {stats && (
            <Card className="p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Database size={14} /> Total Unique Entries
                </span>
                <span className="text-xl font-bold">{stats.totalUnique.toLocaleString()}</span>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ── Manual Archive ────────────────────────────────────────────────── */}
        <TabsContent value="archive" className="mt-4">
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Archive size={16} /> Manual Entry — Archivist Protocol
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Media URL *</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/stream.m3u8"
                    value={archiveForm.mediaUrl}
                    onChange={e => setArchiveForm(f => ({ ...f, mediaUrl: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleValidate}
                    disabled={!archiveForm.mediaUrl || isValidating}
                    title="Validate URL (Rule 1)"
                  >
                    <MagnifyingGlass size={14} className={isValidating ? 'animate-pulse' : ''} />
                  </Button>
                </div>
                {validationResult && (
                  <p className={`text-xs flex items-center gap-1 ${validationResult.valid ? 'text-green-400' : 'text-red-400'}`}>
                    {validationResult.valid
                      ? <><CheckCircle size={12} /> {validationResult.statusCode} — {validationResult.detectedContentType ?? 'OK'}</>
                      : <><XCircle size={12} /> {validationResult.error ?? 'Failed'}</>}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Source URL * (where the link was found)</label>
                <Input
                  placeholder="https://example.com/page"
                  value={archiveForm.sourceUrl}
                  onChange={e => setArchiveForm(f => ({ ...f, sourceUrl: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Title</label>
                <Input
                  placeholder="Auto-detected if empty"
                  value={archiveForm.title}
                  onChange={e => setArchiveForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Category hint (assists Rule 2)</label>
                <Select
                  value={archiveForm.category}
                  onValueChange={v => setArchiveForm(f => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auto-detect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Auto-detect</SelectItem>
                    <SelectItem value="movie">Movie</SelectItem>
                    <SelectItem value="live">Live TV</SelectItem>
                    <SelectItem value="series">Series</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Content Type</label>
                <Input
                  placeholder="video/mp4 or unknown"
                  value={archiveForm.contentType}
                  onChange={e => setArchiveForm(f => ({ ...f, contentType: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Resolution (optional)</label>
                <Input
                  placeholder="1920x1080"
                  value={archiveForm.resolution}
                  onChange={e => setArchiveForm(f => ({ ...f, resolution: e.target.value }))}
                />
              </div>
            </div>

            {archiveResult && (
              <Alert className={
                archiveResult.status === 'archived' ? 'border-green-500/40 bg-green-500/10' :
                archiveResult.status === 'flagged'  ? 'border-yellow-500/40 bg-yellow-500/10' :
                                                      'border-red-500/40 bg-red-500/10'
              }>
                <AlertDescription className="flex items-center gap-2 text-sm">
                  {archiveResult.status === 'archived' && <CheckCircle size={14} className="text-green-400" />}
                  {archiveResult.status === 'flagged'  && <Warning size={14} className="text-yellow-400" />}
                  {archiveResult.status === 'rejected' && <XCircle size={14} className="text-red-400" />}
                  <span className="font-medium capitalize">{archiveResult.status}</span>
                  {archiveResult.category && <Badge variant="outline">{archiveResult.category}</Badge>}
                  {archiveResult.code     && <span className="text-muted-foreground font-mono text-xs">{archiveResult.code}</span>}
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full"
              onClick={handleArchive}
              disabled={isArchiving || !archiveForm.mediaUrl || !archiveForm.sourceUrl}
            >
              {isArchiving
                ? <><ArrowClockwise size={14} className="animate-spin mr-2" /> Validating &amp; Archiving…</>
                : <><Archive size={14} className="mr-2" /> Commit to Archive</>
              }
            </Button>
          </Card>
        </TabsContent>

        {/* ── Flagged Review ────────────────────────────────────────────────── */}
        <TabsContent value="flagged" className="mt-4">
          {flagged.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
              <p className="font-medium">No flagged items — archive integrity intact.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {flagged.length} item{flagged.length !== 1 ? 's' : ''} require manual categorisation (Rule 2).
              </p>
              <ScrollArea className="max-h-[480px]">
                <div className="space-y-2 pr-2">
                  {flagged.map((item, idx) => (
                    <Card key={`${item.mediaUrl}-${idx}`} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate font-mono">{item.mediaUrl}</p>
                          <p className="text-xs text-muted-foreground/70 truncate">
                            Source: {item.sourceUrl}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-yellow-400 border-yellow-400/40 shrink-0">
                          <Warning size={10} className="mr-1" />
                          AMBIGUOUS
                        </Badge>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {(['movies', 'live_tv', 'series'] as ArchiveCategory[]).map(cat => (
                          <Button
                            key={cat}
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => handleResolveFlagged(item, cat)}
                          >
                            <CaretRight size={10} className="mr-1" />
                            {cat.replace('_', ' ')}
                          </Button>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </TabsContent>

        {/* ── Batch Archive ─────────────────────────────────────────────────── */}
        <TabsContent value="batch" className="mt-4">
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <ListChecks size={16} /> Batch Archive — one URL per line
            </h3>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Source URL (applied to all entries)</label>
              <Input
                placeholder="https://origin-site.com"
                value={archiveForm.sourceUrl}
                onChange={e => setArchiveForm(f => ({ ...f, sourceUrl: e.target.value }))}
              />
            </div>
            <Textarea
              placeholder={'https://stream1.example.com/live.m3u8\nhttps://stream2.example.com/movie.mp4\n…'}
              className="font-mono text-xs min-h-[180px]"
              value={batchText}
              onChange={e => setBatchText(e.target.value)}
            />

            {batchResult && (
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <Card className="p-2 bg-green-500/10 border-green-500/20">
                  <p className="font-bold text-green-400">{batchResult.archived}</p>
                  <p className="text-xs text-muted-foreground">Archived</p>
                </Card>
                <Card className="p-2 bg-yellow-500/10 border-yellow-500/20">
                  <p className="font-bold text-yellow-400">{batchResult.flagged}</p>
                  <p className="text-xs text-muted-foreground">Flagged</p>
                </Card>
                <Card className="p-2 bg-red-500/10 border-red-500/20">
                  <p className="font-bold text-red-400">{batchResult.rejected}</p>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                </Card>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleBatch}
              disabled={isBatching || !batchText.trim()}
            >
              {isBatching
                ? <><ArrowClockwise size={14} className="animate-spin mr-2" /> Processing batch…</>
                : <><Archive size={14} className="mr-2" /> Run Batch Archive</>
              }
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Embedded MediaPlayer ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {playerOpen && playerQueue.length > 0 && (
          <MediaPlayer
            url={playerQueue[playerIndex]?.url ?? ''}
            title={playerQueue[playerIndex]?.title ?? ''}
            mediaType={playerQueue[playerIndex]?.mediaType ?? 'video'}
            onClose={() => setPlayerOpen(false)}
            queue={playerQueue}
            currentIndex={playerIndex}
            onQueueChange={(q, i) => {
              setPlayerQueue(q)
              setPlayerIndex(i)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
