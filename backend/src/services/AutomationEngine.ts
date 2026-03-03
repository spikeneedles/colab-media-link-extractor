/**
 * AutomationEngine — Continuous Parallel Search Automation
 *
 * Orchestrates an infinite loop of:
 *   1. Prowlarr indexer crawl  (via BackgroundCrawler)
 *   2. Web preset scrape        (all presets in parallel batches via SearchCrawler)
 *   3. File sort pass            (via FileSorterService)
 *
 * All results route through ArchivistService (resolve → validate → M3U commit).
 * Emits granular progress events consumed by the REST status endpoint + SSE stream.
 */

import { EventEmitter } from 'events'
import { BackgroundCrawler } from './BackgroundCrawler.js'
import { SearchCrawler }     from './SearchCrawler.js'
import { BrowserPool }       from '../browserPool.js'
import { fileSorter }        from './FileSorterService.js'
import { archivist }         from './ArchivistService.js'
import { getAllPresets }      from './searchSourcePresets.js'

export interface AutomationConfig {
  cycleIntervalMs:    number  // ms between cycles (default 5 min)
  prowlarrWorkers:    number  // parallel workers for Prowlarr (default 12)
  webPresetWorkers:   number  // parallel web scraper workers (default 6)
  fileSortWorkers:    number  // parallel file sort workers (default 8)
  enableProwlarr:     boolean
  enableWebScraper:   boolean
  enableFileSorter:   boolean
  enabledPresetIds:   string[]        // empty = all presets
  categories:         string[]
  searchQuery:        string          // empty = search everything
}

export interface CycleStats {
  cycleNumber:     number
  startedAt:       number
  completedAt?:    number
  prowlarr:        { archived: number; rejected: number; flagged: number }
  webScraper:      { archived: number; rejected: number; flagged: number }
  fileSorter:      { moved: number; archived: number }
  phase:           'idle' | 'prowlarr' | 'web' | 'sorting' | 'done' | 'error'
  error?:          string
}

export interface AutomationStatus {
  running:          boolean
  cycleInProgress:  boolean
  config:           AutomationConfig
  currentCycle:     CycleStats | null
  totalCyclesRun:   number
  lifetimeArchived: number
  nextCycleAt?:     number
  activeWorkers:    number
  recentCycles:     CycleStats[]
}

const DEFAULT_CONFIG: AutomationConfig = {
  cycleIntervalMs:  300_000, // 5 minutes
  prowlarrWorkers:  12,
  webPresetWorkers: 6,
  fileSortWorkers:  8,
  enableProwlarr:   true,
  enableWebScraper: true,
  enableFileSorter: true,
  enabledPresetIds: [],
  categories:       ['7000','2070','5070','2000','5000','8000'],
  searchQuery:      '',
}

export class AutomationEngine extends EventEmitter {
  private config: AutomationConfig
  private running = false
  private cycleInProgress = false
  private cycleTimer: NodeJS.Timeout | null = null
  private currentCycle: CycleStats | null = null
  private totalCyclesRun = 0
  private lifetimeArchived = 0
  private activeWorkers = 0
  private recentCycles: CycleStats[] = []
  private nextCycleAt: number | null = null

  // Injected collaborators
  private backgroundCrawler: BackgroundCrawler
  private searchCrawler: SearchCrawler | null = null
  private prowlarrUrl: string

  constructor(backgroundCrawler: BackgroundCrawler, opts?: Partial<AutomationConfig>) {
    super()
    this.backgroundCrawler = backgroundCrawler
    this.prowlarrUrl = process.env.PROWLARR_URL || 'http://localhost:9696'
    this.config = { ...DEFAULT_CONFIG, ...opts }
  }

  /** Start the continuous automation loop. */
  start(): void {
    if (this.running) return
    this.running = true
    console.log('🤖 AutomationEngine started — continuous mode ON')
    this.emit('started')
    this.runCycle()  // fire immediately
  }

  /** Stop the automation loop (current cycle completes gracefully). */
  stop(): void {
    this.running = false
    if (this.cycleTimer) {
      clearTimeout(this.cycleTimer)
      this.cycleTimer = null
    }
    this.nextCycleAt = null
    console.log('🤖 AutomationEngine stopped')
    this.emit('stopped')
  }

  /** Trigger a single cycle regardless of running state.
   *  Returns a rejected promise if a cycle is already in progress. */
  async runOnce(): Promise<CycleStats> {
    if (this.cycleInProgress) {
      throw new Error('A cycle is already in progress — wait for it to complete')
    }
    return this.executeCycle()
  }

  updateConfig(partial: Partial<AutomationConfig>): void {
    this.config = { ...this.config, ...partial }
    // Reschedule if interval changed
    if (this.running && this.cycleTimer && partial.cycleIntervalMs) {
      this.scheduleCycleTimer()
    }
    this.emit('configUpdated', this.config)
  }

  getStatus(): AutomationStatus {
    return {
      running:          this.running,
      cycleInProgress:  this.cycleInProgress,
      config:           this.config,
      currentCycle:     this.currentCycle,
      totalCyclesRun:   this.totalCyclesRun,
      lifetimeArchived: this.lifetimeArchived,
      nextCycleAt:      this.nextCycleAt ?? undefined,
      activeWorkers:    this.activeWorkers,
      recentCycles:     this.recentCycles.slice(-20),
    }
  }

  // ── Internal ─────────────────────────────────────────────────────────────────

  private runCycle(): void {
    this.executeCycle().catch(err => {
      console.error('🤖 AutomationEngine cycle error:', err)
    }).finally(() => {
      if (this.running) this.scheduleCycleTimer()
    })
  }

  private scheduleCycleTimer(): void {
    if (this.cycleTimer) clearInterval(this.cycleTimer)
    this.nextCycleAt = Date.now() + this.config.cycleIntervalMs
    this.cycleTimer = setTimeout(() => {
      if (this.running) this.runCycle()
    }, this.config.cycleIntervalMs)
  }

  private async executeCycle(): Promise<CycleStats> {
    this.cycleInProgress = true
    this.totalCyclesRun++
    const cycle: CycleStats = {
      cycleNumber: this.totalCyclesRun,
      startedAt:   Date.now(),
      prowlarr:    { archived: 0, rejected: 0, flagged: 0 },
      webScraper:  { archived: 0, rejected: 0, flagged: 0 },
      fileSorter:  { moved: 0, archived: 0 },
      phase:       'idle',
    }
    this.currentCycle = cycle

    try {
      // ── Phase 1: Prowlarr parallel crawl ──────────────────────────────────
      if (this.config.enableProwlarr) {
        cycle.phase = 'prowlarr'
        this.emit('phaseStart', { phase: 'prowlarr', cycle: cycle.cycleNumber })

        // Update BackgroundCrawler workers before running
        this.backgroundCrawler.updateConfig({
          maxParallelWorkers: this.config.prowlarrWorkers,
          categories:         this.config.categories,
          queryString:        this.config.searchQuery,
        })

        // Capture archived count from the categoryComplete events this cycle
        const onCategoryComplete = (result: any) => {
          if (result?.results) {
            cycle.prowlarr.archived += (result.results as any[]).filter(r => r.downloadUrl || r.magnetUrl).length
          }
        }
        this.backgroundCrawler.on('categoryComplete', onCategoryComplete)

        // If BackgroundCrawler already has workers running, wait for the current cycle
        // to complete instead of starting a second concurrent cycle that would race.
        // A 5-minute timeout prevents hanging if the event never fires.
        const crawlerStatus = this.backgroundCrawler.getStatus()
        if (crawlerStatus.activeWorkers > 0) {
          await Promise.race([
            new Promise<void>(resolve => {
              this.backgroundCrawler.once('cycleComplete', () => resolve())
            }),
            new Promise<void>(resolve => setTimeout(resolve, 5 * 60 * 1000)),
          ])
        } else {
          await this.backgroundCrawler.runOnce()
        }

        this.backgroundCrawler.off('categoryComplete', onCategoryComplete)
        this.lifetimeArchived += cycle.prowlarr.archived
        this.emit('phaseComplete', { phase: 'prowlarr', cycle: cycle.cycleNumber })
      }

      // ── Phase 2: Web preset parallel scrape ───────────────────────────────
      if (this.config.enableWebScraper) {
        cycle.phase = 'web'
        this.emit('phaseStart', { phase: 'web', cycle: cycle.cycleNumber })

        const allPresets = getAllPresets()
        const activePresets = this.config.enabledPresetIds.length > 0
          ? allPresets.filter(p => this.config.enabledPresetIds.includes(p.id))
          : allPresets

        if (activePresets.length > 0) {
          const query = this.config.searchQuery || '.'
          const webStats = await this.runWebPresetsScrape(activePresets, query)
          cycle.webScraper = webStats
          this.lifetimeArchived += webStats.archived
        }

        this.emit('phaseComplete', { phase: 'web', cycle: cycle.cycleNumber, stats: cycle.webScraper })
      }

      // ── Phase 3: File sort pass ────────────────────────────────────────────
      if (this.config.enableFileSorter) {
        cycle.phase = 'sorting'
        this.emit('phaseStart', { phase: 'sorting', cycle: cycle.cycleNumber })

        const sortStats = await fileSorter.sortAll(this.config.fileSortWorkers)
        cycle.fileSorter = { moved: sortStats.moved, archived: sortStats.archived }
        this.lifetimeArchived += sortStats.archived

        this.emit('phaseComplete', { phase: 'sorting', cycle: cycle.cycleNumber, stats: cycle.fileSorter })
      }

      cycle.phase = 'done'
      cycle.completedAt = Date.now()

    } catch (err: any) {
      cycle.phase = 'error'
      cycle.error = err?.message ?? String(err)
      console.error(`🤖 Cycle ${cycle.cycleNumber} error:`, cycle.error)
    } finally {
      this.cycleInProgress = false
    }

    this.recentCycles.push(cycle)
    if (this.recentCycles.length > 50) this.recentCycles.shift()
    this.currentCycle = null
    this.emit('cycleComplete', cycle)
    return cycle
  }

  /** Runs all web presets in parallel batches, routes results through Archivist. */
  private async runWebPresetsScrape(
    presets: ReturnType<typeof getAllPresets>,
    query: string,
  ): Promise<{ archived: number; rejected: number; flagged: number }> {
    const totals = { archived: 0, rejected: 0, flagged: 0 }
    const batchSize = this.config.webPresetWorkers
    const sourceUrl = 'automation-engine/web-scraper'

    // Create a lightweight SearchCrawler instance
    const pool = new BrowserPool({ maxConcurrent: batchSize })

    try {
      for (let i = 0; i < presets.length; i += batchSize) {
        const batch = presets.slice(i, i + batchSize)
        this.activeWorkers = batch.length

        const settled = await Promise.allSettled(
          batch.map(async preset => {
            try {
              const crawler = new SearchCrawler(pool)
              const result  = await crawler.search(preset, query, 2)
              return { preset, result }
            } catch (err: any) {
              console.warn(`[AutomationEngine] Web preset ${preset.name} failed:`, err.message)
              return { preset, result: null }
            }
          })
        )

        // Archive extracted media URLs
        const allEntries: any[] = []
        for (const outcome of settled) {
          if (outcome.status !== 'fulfilled' || !outcome.value.result) continue
          const { preset, result } = outcome.value
          for (const item of result.results ?? []) {
            // SearchResult has url + metadata; no mediaUrls — use url directly
            const url = item.url
            if (!url) continue
            allEntries.push({
              sourceUrl,
              mediaUrl:    url,
              title:       item.metadata?.title ?? item.title ?? 'Untitled',
              contentType: 'video/stream',
              indexer:     preset.name,
            })
          }
        }

        if (allEntries.length > 0) {
          const batchResults = await archivist.archiveBatch(allEntries)
          totals.archived  += batchResults.filter(r => r.status === 'archived').length
          totals.rejected  += batchResults.filter(r => r.status === 'rejected').length
          totals.flagged   += batchResults.filter(r => r.status === 'flagged').length
        }

        this.emit('webBatchComplete', {
          batchIndex: i / batchSize,
          totalBatches: Math.ceil(presets.length / batchSize),
          totals,
        })
      }
    } finally {
      this.activeWorkers = 0
      await pool.cleanup().catch(() => {})
    }

    return totals
  }
}

// Singleton — created after BackgroundCrawler is available (see index.ts)
let _engine: AutomationEngine | null = null

export function getAutomationEngine(): AutomationEngine {
  if (!_engine) throw new Error('AutomationEngine not yet initialized')
  return _engine
}

export function initAutomationEngine(crawler: BackgroundCrawler): AutomationEngine {
  _engine = new AutomationEngine(crawler)
  return _engine
}
