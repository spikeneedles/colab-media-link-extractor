import { useState, useCallback, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Globe, Package, FolderOpen, Play, StopCircle, Download, Trash, Database, CheckCircle, Warning, Clock, ArrowRight, FileText, Sparkle, Pause, Plus, X, List, CalendarBlank, ClockCountdown, Repeat, Bell, BellSlash, PencilSimple, SpeakerHigh, SpeakerSlash, SpeakerSimpleHigh, Eye, Browsers, Lightning, Code, ArrowsClockwise } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { crawlRepository, crawlWebsite, crawlDirectory, type CrawlResult, type CrawlTarget } from '@/lib/crawler'
import { useCrawlerStorage, downloadCrawlResultAsZip } from '@/lib/crawlerStorage'
import { useKV } from '@github/spark/hooks'
import { playNotificationSound, previewNotificationSound, notificationSounds, type NotificationTone, getAllNotificationTones } from '@/lib/notificationSounds'
import { createHeadlessBrowser, type BrowserOptions } from '@/lib/headlessBrowser'
import { ScrapingRulesManager } from '@/components/ScrapingRulesManager'
import { PaginationManager } from '@/components/PaginationManager'

type QueuedTarget = {
  id: string
  target: CrawlTarget
  addedAt: Date
}

type ActiveCrawl = {
  id: string
  target: CrawlTarget
  progress: number
  currentFile?: string
  abortController: AbortController
}

type RecurrencePattern = 'once' | 'hourly' | 'daily' | 'weekly'

type ScheduledTarget = {
  id: string
  target: CrawlTarget
  scheduledTime: Date
  recurrence: RecurrencePattern
  enabled: boolean
  lastRun?: Date
  nextRun?: Date
  runCount: number
}

export function CrawlerManager() {
  const [crawlUrl, setCrawlUrl] = useState('')
  const [bulkUrls, setBulkUrls] = useState('')
  const [crawlType, setCrawlType] = useState<'repository' | 'web'>('repository')
  const [maxDepth, setMaxDepth] = useState(3)
  const [maxPages, setMaxPages] = useState(50)
  const [targetQueue, setTargetQueue] = useState<QueuedTarget[]>([])
  const [activeCrawls, setActiveCrawls] = useState<ActiveCrawl[]>([])
  const [isProcessingQueue, setIsProcessingQueue] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedResult, setSelectedResult] = useState<CrawlResult | null>(null)
  const [showResultDialog, setShowResultDialog] = useState(false)
  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const queueProcessorRef = useRef<boolean>(false)
  
  const [scheduledTargets, setScheduledTargets] = useKV<ScheduledTarget[]>('crawler-scheduled-targets', [])
  const [showScheduler, setShowScheduler] = useState(false)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [scheduleUrl, setScheduleUrl] = useState('')
  const [scheduleType, setScheduleType] = useState<'repository' | 'web'>('repository')
  const [scheduleDepth, setScheduleDepth] = useState(3)
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('once')
  const [editingSchedule, setEditingSchedule] = useState<ScheduledTarget | null>(null)
  const [schedulerEnabled, setSchedulerEnabled] = useKV('crawler-scheduler-enabled', 'true')
  const schedulerIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [notificationSound, setNotificationSound] = useKV<NotificationTone>('crawler-notification-sound', 'chime')
  const [showSoundSettings, setShowSoundSettings] = useState(false)
  
  const [headlessBrowserEnabled, setHeadlessBrowserEnabled] = useKV('crawler-headless-browser-enabled', 'false')
  const [headlessBrowserBackend, setHeadlessBrowserBackend] = useKV('crawler-headless-backend-url', '')
  const [showHeadlessSettings, setShowHeadlessSettings] = useState(false)
  const [browserOptions, setBrowserOptions] = useState<BrowserOptions>({
    timeout: 30000,
    blockImages: true,
    blockStyles: false,
    blockFonts: true,
  })

  const {
    storageIndex,
    saveCrawlResult,
    getAllCrawlResults,
    deleteCrawlResult,
    clearAllResults,
    addJob,
    updateJobProgress,
    updateJobStatus,
    exportCrawlHistory,
    exportCrawlReport,
    getStorageStats
  } = useCrawlerStorage()

  const [crawlHistory, setCrawlHistory] = useState<CrawlResult[]>([])
  const [storageStats, setStorageStats] = useState({
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    totalLinks: 0,
    totalFiles: 0
  })

  useEffect(() => {
    loadHistory()
    loadStats()
  }, [storageIndex])

  useEffect(() => {
    if (isProcessingQueue && !isPaused && targetQueue.length > 0 && activeCrawls.length === 0) {
      processNextTarget()
    }
  }, [isProcessingQueue, isPaused, targetQueue.length, activeCrawls.length])

  useEffect(() => {
    if (schedulerEnabled === 'true') {
      schedulerIntervalRef.current = setInterval(() => {
        checkScheduledTargets()
      }, 60000)
      
      checkScheduledTargets()
      
      return () => {
        if (schedulerIntervalRef.current) {
          clearInterval(schedulerIntervalRef.current)
        }
      }
    } else {
      if (schedulerIntervalRef.current) {
        clearInterval(schedulerIntervalRef.current)
        schedulerIntervalRef.current = null
      }
    }
  }, [schedulerEnabled, scheduledTargets])

  const loadHistory = async () => {
    const results = await getAllCrawlResults()
    setCrawlHistory(results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()))
  }

  const loadStats = async () => {
    const stats = await getStorageStats()
    setStorageStats(stats)
  }

  const addTargetToQueue = useCallback((url: string, type: 'repository' | 'web', depth: number) => {
    if (!url.trim()) return

    const target: CrawlTarget = {
      url: url.trim(),
      type,
      depth
    }

    const queuedTarget: QueuedTarget = {
      id: `target-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      target,
      addedAt: new Date()
    }

    setTargetQueue(prev => [...prev, queuedTarget])
    toast.success(`Added target to queue: ${url}`)
  }, [])

  const handleAddToQueue = useCallback(() => {
    if (!crawlUrl.trim()) {
      toast.error('Please enter a URL')
      return
    }

    addTargetToQueue(crawlUrl, crawlType, maxDepth)
    setCrawlUrl('')
  }, [crawlUrl, crawlType, maxDepth, addTargetToQueue])

  const handleBulkAddToQueue = useCallback(() => {
    const urls = bulkUrls.split('\n').filter(url => url.trim())
    
    if (urls.length === 0) {
      toast.error('Please enter at least one URL')
      return
    }

    urls.forEach(url => {
      addTargetToQueue(url, crawlType, maxDepth)
    })

    toast.success(`Added ${urls.length} targets to queue`)
    setBulkUrls('')
    setShowBulkAdd(false)
  }, [bulkUrls, crawlType, maxDepth, addTargetToQueue])

  const handleRemoveFromQueue = useCallback((id: string) => {
    setTargetQueue(prev => prev.filter(t => t.id !== id))
    toast.info('Removed target from queue')
  }, [])

  const handleClearQueue = useCallback(() => {
    setTargetQueue([])
    toast.info('Queue cleared')
  }, [])

  const handleStartQueue = useCallback(() => {
    if (targetQueue.length === 0) {
      toast.error('Queue is empty. Add targets first.')
      return
    }

    setIsProcessingQueue(true)
    setIsPaused(false)
    toast.success('Started processing queue')
  }, [targetQueue.length])

  const handlePauseQueue = useCallback(() => {
    setIsPaused(true)
    toast.info('Queue paused')
  }, [])

  const handleResumeQueue = useCallback(() => {
    setIsPaused(false)
    toast.success('Queue resumed')
  }, [])

  const handleStopQueue = useCallback(() => {
    setIsProcessingQueue(false)
    setIsPaused(false)
    
    activeCrawls.forEach(crawl => {
      crawl.abortController.abort()
    })
    
    setActiveCrawls([])
    toast.info('Queue stopped')
  }, [activeCrawls])

  const processNextTarget = useCallback(async () => {
    if (queueProcessorRef.current || isPaused || targetQueue.length === 0) {
      return
    }

    queueProcessorRef.current = true
    const queuedTarget = targetQueue[0]
    
    setTargetQueue(prev => prev.slice(1))

    const id = `crawl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const abortController = new AbortController()

    addJob({
      id,
      target: queuedTarget.target,
      status: 'pending',
      progress: 0,
      startedAt: new Date()
    })

    const activeCrawl: ActiveCrawl = {
      id,
      target: queuedTarget.target,
      progress: 0,
      abortController
    }

    setActiveCrawls([activeCrawl])
    toast.loading(`Crawling ${queuedTarget.target.type}: ${queuedTarget.target.url}`, { id: `crawl-${id}` })

    try {
      let result: CrawlResult

      if (queuedTarget.target.type === 'repository') {
        result = await crawlRepository(
          queuedTarget.target.url,
          queuedTarget.target.depth,
          (current, total, currentFile) => {
            const progress = (current / total) * 100
            setActiveCrawls(prev =>
              prev.map(c =>
                c.id === id
                  ? { ...c, progress, currentFile }
                  : c
              )
            )
            updateJobProgress(id, progress)
          }
        )
      } else {
        result = await crawlWebsite(
          queuedTarget.target.url,
          queuedTarget.target.depth,
          maxPages,
          (current, total, currentUrl) => {
            const progress = (current / total) * 100
            setActiveCrawls(prev =>
              prev.map(c =>
                c.id === id
                  ? { ...c, progress, currentFile: currentUrl }
                  : c
              )
            )
            updateJobProgress(id, progress)
          }
        )
      }

      await saveCrawlResult(result)
      updateJobStatus(id, 'completed')
      setActiveCrawls([])

      toast.success(
        `Completed: ${result.links.length} links from ${result.filesScanned} files`,
        { id: `crawl-${id}` }
      )

      loadHistory()
      loadStats()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      updateJobStatus(id, 'failed', errorMessage)
      setActiveCrawls([])
      toast.error(`Failed: ${errorMessage}`, { id: `crawl-${id}` })
    } finally {
      queueProcessorRef.current = false
      
      if (targetQueue.length > 1) {
        toast.info(`${targetQueue.length - 1} targets remaining in queue`)
      } else if (targetQueue.length === 1) {
        toast.info('Processing last target in queue')
      } else {
        toast.success('Queue completed!')
        setIsProcessingQueue(false)
      }
    }
  }, [targetQueue, isPaused, maxPages, addJob, updateJobProgress, updateJobStatus, saveCrawlResult])

  const handleStartCrawl = useCallback(async () => {
    if (!crawlUrl.trim()) {
      toast.error('Please enter a URL to crawl')
      return
    }

    const id = `crawl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const abortController = new AbortController()

    const target: CrawlTarget = {
      url: crawlUrl,
      type: crawlType,
      depth: crawlType === 'web' ? maxDepth : maxDepth
    }

    addJob({
      id,
      target,
      status: 'pending',
      progress: 0,
      startedAt: new Date()
    })

    const activeCrawl: ActiveCrawl = {
      id,
      target,
      progress: 0,
      abortController
    }

    setActiveCrawls(prev => [...prev, activeCrawl])
    toast.loading(`Starting ${crawlType} crawl...`, { id: `crawl-${id}` })

    try {
      let result: CrawlResult

      if (crawlType === 'repository') {
        result = await crawlRepository(
          crawlUrl,
          maxDepth,
          (current, total, currentFile) => {
            const progress = (current / total) * 100
            setActiveCrawls(prev =>
              prev.map(c =>
                c.id === id
                  ? { ...c, progress, currentFile }
                  : c
              )
            )
            updateJobProgress(id, progress)
          }
        )
      } else {
        result = await crawlWebsite(
          crawlUrl,
          maxDepth,
          maxPages,
          (current, total, currentUrl) => {
            const progress = (current / total) * 100
            setActiveCrawls(prev =>
              prev.map(c =>
                c.id === id
                  ? { ...c, progress, currentFile: currentUrl }
                  : c
              )
            )
            updateJobProgress(id, progress)
          }
        )
      }

      await saveCrawlResult(result)
      updateJobStatus(id, 'completed')
      setActiveCrawls(prev => prev.filter(c => c.id !== id))

      toast.success(
        `Crawl completed: ${result.links.length} links found from ${result.filesScanned} files`,
        { id: `crawl-${id}` }
      )

      loadHistory()
      loadStats()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      updateJobStatus(id, 'failed', errorMessage)
      setActiveCrawls(prev => prev.filter(c => c.id !== id))
      toast.error(`Crawl failed: ${errorMessage}`, { id: `crawl-${id}` })
    }
  }, [crawlUrl, crawlType, maxDepth, maxPages, addJob, updateJobProgress, updateJobStatus, saveCrawlResult])

  const handleStopCrawl = useCallback((id: string) => {
    const crawl = activeCrawls.find(c => c.id === id)
    if (crawl) {
      crawl.abortController.abort()
      setActiveCrawls(prev => prev.filter(c => c.id !== id))
      updateJobStatus(id, 'failed', 'Cancelled by user')
      toast.info('Crawl stopped')
    }
  }, [activeCrawls, updateJobStatus])

  const handleViewResult = useCallback((result: CrawlResult) => {
    setSelectedResult(result)
    setShowResultDialog(true)
  }, [])

  const handleDownloadResult = useCallback(async (result: CrawlResult) => {
    try {
      toast.loading('Creating download package...', { id: 'download-result' })
      const blob = await downloadCrawlResultAsZip(result)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `crawl-${result.id}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Download complete', { id: 'download-result' })
    } catch (error) {
      toast.error('Download failed', { id: 'download-result' })
    }
  }, [])

  const handleDownloadReport = useCallback(async (result: CrawlResult) => {
    try {
      const blob = await exportCrawlReport(result.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `crawl-report-${result.id}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    } catch (error) {
      toast.error('Failed to download report')
    }
  }, [exportCrawlReport])

  const handleDeleteResult = useCallback(async (id: string) => {
    try {
      await deleteCrawlResult(id)
      loadHistory()
      loadStats()
      toast.success('Crawl result deleted')
    } catch (error) {
      toast.error('Failed to delete result')
    }
  }, [deleteCrawlResult])

  const handleClearHistory = useCallback(async () => {
    try {
      await clearAllResults()
      loadHistory()
      loadStats()
      toast.success('Crawl history cleared')
    } catch (error) {
      toast.error('Failed to clear history')
    }
  }, [clearAllResults])

  const handleExportHistory = useCallback(async () => {
    try {
      const blob = await exportCrawlHistory()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `crawler-history-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('History exported')
    } catch (error) {
      toast.error('Failed to export history')
    }
  }, [exportCrawlHistory])

  const checkScheduledTargets = useCallback(() => {
    if (!scheduledTargets || scheduledTargets.length === 0) return
    
    const now = new Date()
    const updatedSchedules: ScheduledTarget[] = []
    let hasChanges = false
    let completedSchedules = 0

    scheduledTargets.forEach(schedule => {
      if (!schedule.enabled) {
        updatedSchedules.push(schedule)
        return
      }

      const nextRun = schedule.nextRun ? new Date(schedule.nextRun) : new Date(schedule.scheduledTime)
      
      if (nextRun <= now) {
        const targetType = schedule.target.type === 'repository' || schedule.target.type === 'web' 
          ? schedule.target.type 
          : 'repository'
        addTargetToQueue(schedule.target.url, targetType, schedule.target.depth || 3)
        
        const updatedSchedule: ScheduledTarget = {
          ...schedule,
          lastRun: now,
          runCount: schedule.runCount + 1
        }

        if (schedule.recurrence === 'once') {
          updatedSchedule.enabled = false
          completedSchedules++
          toast.info(`Scheduled crawl completed: ${schedule.target.url}`)
        } else {
          const nextRunTime = calculateNextRun(now, schedule.recurrence)
          updatedSchedule.nextRun = nextRunTime
          toast.info(`Scheduled crawl started: ${schedule.target.url}`)
        }

        updatedSchedules.push(updatedSchedule)
        hasChanges = true
      } else {
        updatedSchedules.push(schedule)
      }
    })

    if (hasChanges) {
      setScheduledTargets(updatedSchedules)
      
      if (completedSchedules > 0 && notificationSound !== 'none') {
        playNotificationSound(notificationSound || 'chime')
        toast.success(`${completedSchedules} scheduled ${completedSchedules === 1 ? 'crawl' : 'crawls'} completed! 🔔`)
      }
      
      if (!isProcessingQueue && targetQueue.length > 0) {
        handleStartQueue()
      }
    }
  }, [scheduledTargets, addTargetToQueue, isProcessingQueue, targetQueue.length, notificationSound])

  const calculateNextRun = (lastRun: Date, recurrence: RecurrencePattern): Date => {
    const next = new Date(lastRun)
    
    switch (recurrence) {
      case 'hourly':
        next.setHours(next.getHours() + 1)
        break
      case 'daily':
        next.setDate(next.getDate() + 1)
        break
      case 'weekly':
        next.setDate(next.getDate() + 7)
        break
    }
    
    return next
  }

  const handleAddSchedule = useCallback(() => {
    if (!scheduleUrl.trim()) {
      toast.error('Please enter a URL')
      return
    }

    if (!scheduleDate || !scheduleTime) {
      toast.error('Please select a date and time')
      return
    }

    const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`)
    
    if (scheduledDateTime <= new Date()) {
      toast.error('Scheduled time must be in the future')
      return
    }

    const target: CrawlTarget = {
      url: scheduleUrl.trim(),
      type: scheduleType,
      depth: scheduleDepth
    }

    const newSchedule: ScheduledTarget = {
      id: `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      target,
      scheduledTime: scheduledDateTime,
      recurrence: recurrencePattern,
      enabled: true,
      nextRun: scheduledDateTime,
      runCount: 0
    }

    setScheduledTargets((current = []) => [...current, newSchedule])
    
    setScheduleUrl('')
    setScheduleDate('')
    setScheduleTime('')
    setRecurrencePattern('once')
    setShowScheduleDialog(false)
    
    toast.success(`Scheduled crawl for ${scheduledDateTime.toLocaleString()}`)
  }, [scheduleUrl, scheduleType, scheduleDepth, scheduleDate, scheduleTime, recurrencePattern])

  const handleUpdateSchedule = useCallback(() => {
    if (!editingSchedule) return

    if (!scheduleDate || !scheduleTime) {
      toast.error('Please select a date and time')
      return
    }

    const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`)
    
    if (scheduledDateTime <= new Date()) {
      toast.error('Scheduled time must be in the future')
      return
    }

    const updatedSchedule: ScheduledTarget = {
      ...editingSchedule,
      scheduledTime: scheduledDateTime,
      recurrence: recurrencePattern,
      nextRun: scheduledDateTime,
      target: {
        ...editingSchedule.target,
        url: scheduleUrl.trim(),
        type: scheduleType,
        depth: scheduleDepth
      }
    }

    setScheduledTargets((current = []) =>
      current.map(s => s.id === editingSchedule.id ? updatedSchedule : s)
    )
    
    setEditingSchedule(null)
    setScheduleUrl('')
    setScheduleDate('')
    setScheduleTime('')
    setRecurrencePattern('once')
    setShowScheduleDialog(false)
    
    toast.success('Schedule updated')
  }, [editingSchedule, scheduleUrl, scheduleType, scheduleDepth, scheduleDate, scheduleTime, recurrencePattern])

  const handleEditSchedule = useCallback((schedule: ScheduledTarget) => {
    setEditingSchedule(schedule)
    setScheduleUrl(schedule.target.url)
    const targetType = schedule.target.type === 'repository' || schedule.target.type === 'web' 
      ? schedule.target.type 
      : 'repository'
    setScheduleType(targetType)
    setScheduleDepth(schedule.target.depth !== undefined ? schedule.target.depth : 3)
    
    const nextRun = schedule.nextRun ? new Date(schedule.nextRun) : new Date(schedule.scheduledTime)
    setScheduleDate(nextRun.toISOString().split('T')[0])
    setScheduleTime(nextRun.toTimeString().slice(0, 5))
    setRecurrencePattern(schedule.recurrence)
    setShowScheduleDialog(true)
  }, [])

  const handleDeleteSchedule = useCallback((id: string) => {
    setScheduledTargets((current = []) => current.filter(s => s.id !== id))
    toast.success('Scheduled crawl deleted')
  }, [])

  const handleToggleSchedule = useCallback((id: string) => {
    setScheduledTargets((current = []) =>
      current.map(s =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      )
    )
  }, [])

  const handleClearSchedules = useCallback(() => {
    setScheduledTargets([])
    toast.success('All schedules cleared')
  }, [])

  const [showRules, setShowRules] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={28} className="text-accent" weight="fill" />
          <h2 className="text-2xl font-bold text-foreground">Advanced Crawler & Storage</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setShowRules(!showRules)}
            variant="outline"
            className="border-accent/30 hover:bg-accent/10 text-accent"
          >
            <Lightning size={18} className="mr-2" />
            {showRules ? 'Hide' : 'Show'} Scraping Rules
          </Button>
          <Button
            onClick={() => setShowScheduler(!showScheduler)}
            variant="outline"
            className="border-accent/30 hover:bg-accent/10 text-accent"
          >
            <CalendarBlank size={18} className="mr-2" />
            {showScheduler ? 'Hide' : 'Show'} Scheduler ({scheduledTargets?.length || 0})
          </Button>
          <Button
            onClick={() => setShowHistory(!showHistory)}
            variant="outline"
            className="border-accent/30 hover:bg-accent/10 text-accent"
          >
            <Database size={18} className="mr-2" />
            {showHistory ? 'Hide' : 'Show'} History ({storageStats.totalJobs})
          </Button>
        </div>
      </div>
      
      {showRules && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <Card className="bg-card border-border p-6">
            <ScrapingRulesManager />
          </Card>
        </motion.div>
      )}

      {storageStats.totalJobs > 0 && (
        <Card className="bg-card border-border p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Total Crawls</div>
              <div className="text-2xl font-bold text-foreground">{storageStats.totalJobs}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Completed</div>
              <div className="text-2xl font-bold text-green-500">{storageStats.completedJobs}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Failed</div>
              <div className="text-2xl font-bold text-destructive">{storageStats.failedJobs}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Total Links</div>
              <div className="text-2xl font-bold text-accent">{storageStats.totalLinks.toLocaleString()}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Files Scanned</div>
              <div className="text-2xl font-bold text-accent">{storageStats.totalFiles.toLocaleString()}</div>
            </div>
          </div>
        </Card>
      )}

      {showScheduler && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <Card className="bg-card border-border p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarBlank size={24} weight="fill" className="text-accent" />
                  <h3 className="text-lg font-bold text-foreground">Scheduled Crawls</h3>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => setShowSoundSettings(!showSoundSettings)}
                    variant="outline"
                    size="sm"
                    className="border-accent/30 hover:bg-accent/10 text-accent"
                    title="Configure notification sounds"
                  >
                    {notificationSound === 'none' ? (
                      <SpeakerSlash size={16} />
                    ) : (
                      <SpeakerSimpleHigh size={16} />
                    )}
                  </Button>
                  <Button
                    onClick={() => setShowHeadlessSettings(!showHeadlessSettings)}
                    variant="outline"
                    size="sm"
                    className={`border-accent/30 hover:bg-accent/10 ${headlessBrowserEnabled === 'true' ? 'text-accent ring-1 ring-accent/50' : 'text-muted-foreground'}`}
                    title="Configure headless browser for JavaScript rendering"
                  >
                    <Browsers size={16} />
                  </Button>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-foreground">Scheduler:</label>
                    <Button
                      onClick={() => setSchedulerEnabled((current = 'true') => current === 'true' ? 'false' : 'true')}
                      variant="outline"
                      size="sm"
                      className={schedulerEnabled === 'true' ? 'border-green-500/30 text-green-500' : 'border-destructive/30 text-destructive'}
                    >
                      {schedulerEnabled === 'true' ? (
                        <>
                          <Bell size={16} className="mr-1" weight="fill" />
                          Enabled
                        </>
                      ) : (
                        <>
                          <BellSlash size={16} className="mr-1" />
                          Disabled
                        </>
                      )}
                    </Button>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingSchedule(null)
                      setScheduleUrl('')
                      setScheduleDate('')
                      setScheduleTime('')
                      setScheduleType('repository')
                      setScheduleDepth(3)
                      setRecurrencePattern('once')
                      setShowScheduleDialog(true)
                    }}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    <Plus size={18} className="mr-2" />
                    New Schedule
                  </Button>
                </div>
              </div>

              {showSoundSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 p-4 bg-primary/30 rounded-lg border border-border"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SpeakerSimpleHigh size={20} className="text-accent" />
                      <span className="text-sm font-medium text-foreground">Notification Sound Settings</span>
                    </div>
                    <Button
                      onClick={() => setShowSoundSettings(false)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                    >
                      <X size={16} />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-foreground block mb-2">
                        Sound Type
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => setNotificationSound('chime')}
                          variant={notificationSound === 'chime' ? 'default' : 'outline'}
                          size="sm"
                          className={notificationSound === 'chime' ? 'bg-accent text-accent-foreground' : 'border-border'}
                        >
                          <SpeakerSimpleHigh size={16} className="mr-1" />
                          Chime
                        </Button>
                        <Button
                          onClick={() => setNotificationSound('bell')}
                          variant={notificationSound === 'bell' ? 'default' : 'outline'}
                          size="sm"
                          className={notificationSound === 'bell' ? 'bg-accent text-accent-foreground' : 'border-border'}
                        >
                          <Bell size={16} className="mr-1" />
                          Bell
                        </Button>
                        <Button
                          onClick={() => setNotificationSound('success')}
                          variant={notificationSound === 'success' ? 'default' : 'outline'}
                          size="sm"
                          className={notificationSound === 'success' ? 'bg-accent text-accent-foreground' : 'border-border'}
                        >
                          <CheckCircle size={16} className="mr-1" />
                          Success
                        </Button>
                        <Button
                          onClick={() => setNotificationSound('alert')}
                          variant={notificationSound === 'alert' ? 'default' : 'outline'}
                          size="sm"
                          className={notificationSound === 'alert' ? 'bg-accent text-accent-foreground' : 'border-border'}
                        >
                          <Warning size={16} className="mr-1" />
                          Alert
                        </Button>
                        <Button
                          onClick={() => setNotificationSound('complete')}
                          variant={notificationSound === 'complete' ? 'default' : 'outline'}
                          size="sm"
                          className={notificationSound === 'complete' ? 'bg-accent text-accent-foreground' : 'border-border'}
                        >
                          <Sparkle size={16} className="mr-1" />
                          Complete
                        </Button>
                        <Button
                          onClick={() => setNotificationSound('none')}
                          variant={notificationSound === 'none' ? 'default' : 'outline'}
                          size="sm"
                          className={notificationSound === 'none' ? 'bg-destructive text-destructive-foreground' : 'border-border'}
                        >
                          <SpeakerSlash size={16} className="mr-1" />
                          None
                        </Button>
                      </div>
                      {notificationSound && notificationSound !== 'none' && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {notificationSounds[notificationSound].description}
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={() => previewNotificationSound(notificationSound || 'chime')}
                      variant="outline"
                      className="w-full border-accent/30 hover:bg-accent/10 text-accent"
                      disabled={notificationSound === 'none'}
                    >
                      <Play size={16} className="mr-2" />
                      Test Sound
                    </Button>

                    <Alert className="border-accent/30 bg-accent/5">
                      <AlertDescription className="text-xs text-foreground">
                        <SpeakerSimpleHigh size={14} className="inline mr-1" />
                        Sound notifications will play when scheduled crawls complete automatically.
                      </AlertDescription>
                    </Alert>
                  </div>
                </motion.div>
              )}

              {schedulerEnabled !== 'true' && (
                <Alert className="border-yellow-500/30 bg-yellow-500/5">
                  <AlertDescription className="text-foreground text-sm flex items-center gap-2">
                    <BellSlash size={16} className="text-yellow-500" />
                    Scheduler is disabled. Scheduled crawls will not run automatically until you enable it.
                  </AlertDescription>
                </Alert>
              )}

              {scheduledTargets && scheduledTargets.length > 0 ? (
                <>
                  <ScrollArea className="h-[300px] rounded-md border border-border bg-primary/30 p-4">
                    <div className="space-y-3">
                      {[...(scheduledTargets || [])]
                        .sort((a, b) => {
                          const aTime = a.nextRun ? new Date(a.nextRun).getTime() : new Date(a.scheduledTime).getTime()
                          const bTime = b.nextRun ? new Date(b.nextRun).getTime() : new Date(b.scheduledTime).getTime()
                          return aTime - bTime
                        })
                        .map((schedule, index) => {
                          const nextRun = schedule.nextRun ? new Date(schedule.nextRun) : new Date(schedule.scheduledTime)
                          const isPast = nextRun <= new Date()
                          const timeUntil = nextRun.getTime() - new Date().getTime()
                          const hoursUntil = Math.floor(timeUntil / (1000 * 60 * 60))
                          const minutesUntil = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60))

                          return (
                            <motion.div
                              key={schedule.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.5) }}
                              className={`p-4 rounded-lg border ${schedule.enabled ? 'border-accent/30 bg-card' : 'border-border bg-muted/30 opacity-60'} hover:border-accent/50 transition-colors`}
                            >
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={schedule.enabled}
                                  onCheckedChange={() => handleToggleSchedule(schedule.id)}
                                  className="mt-1"
                                />
                                
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2">
                                    {schedule.target.type === 'repository' ? (
                                      <Package size={18} className="text-accent shrink-0" />
                                    ) : (
                                      <Globe size={18} className="text-accent shrink-0" />
                                    )}
                                    <span className="font-mono text-sm text-foreground break-all flex-1">
                                      {schedule.target.url}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className={isPast && schedule.enabled ? 'border-yellow-500/30 text-yellow-500 animate-pulse' : 'border-accent/30 text-accent'}>
                                      <ClockCountdown size={14} className="mr-1" weight="fill" />
                                      {isPast && schedule.enabled ? 'Running soon...' : nextRun.toLocaleString()}
                                    </Badge>
                                    
                                    {schedule.recurrence !== 'once' && (
                                      <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                                        <Repeat size={14} className="mr-1" />
                                        {schedule.recurrence}
                                      </Badge>
                                    )}
                                    
                                    {!isPast && schedule.enabled && timeUntil > 0 && (
                                      <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                                        <Clock size={14} className="mr-1" />
                                        {hoursUntil > 0 ? `${hoursUntil}h ${minutesUntil}m` : `${minutesUntil}m`}
                                      </Badge>
                                    )}

                                    {schedule.runCount > 0 && (
                                      <Badge variant="outline" className="border-green-500/30 text-green-500">
                                        ✓ {schedule.runCount} {schedule.runCount === 1 ? 'run' : 'runs'}
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="text-xs text-muted-foreground">
                                    Type: {schedule.target.type} • Depth: {schedule.target.depth}
                                    {schedule.lastRun && ` • Last run: ${new Date(schedule.lastRun).toLocaleString()}`}
                                  </div>
                                </div>

                                <div className="flex gap-1 shrink-0">
                                  <Button
                                    onClick={() => handleEditSchedule(schedule)}
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:bg-accent/20 text-accent"
                                  >
                                    <PencilSimple size={16} />
                                  </Button>
                                  <Button
                                    onClick={() => handleDeleteSchedule(schedule.id)}
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:bg-destructive/20 text-destructive"
                                  >
                                    <Trash size={16} />
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          )
                        })}
                    </div>
                  </ScrollArea>

                  <Button
                    onClick={handleClearSchedules}
                    variant="outline"
                    className="w-full border-destructive/30 hover:bg-destructive/10 text-destructive"
                  >
                    <Trash size={18} className="mr-2" />
                    Clear All Schedules
                  </Button>
                </>
              ) : (
                <Alert className="border-muted-foreground/30 bg-muted/30">
                  <AlertDescription className="text-center text-muted-foreground">
                    No scheduled crawls yet. Click "New Schedule" to create one.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      <Card className="bg-card border-border p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkle size={20} weight="fill" className="text-accent" />
              <h3 className="text-lg font-bold text-foreground">Target Queue</h3>
            </div>
            <Badge variant="outline" className="border-accent/30 text-accent font-mono">
              {targetQueue.length} {targetQueue.length === 1 ? 'target' : 'targets'} queued
            </Badge>
          </div>

          {targetQueue.length > 0 && (
            <Card className="bg-primary/30 border-accent/30 p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <List size={18} className="text-accent" />
                    <span className="text-sm font-medium text-foreground">Queued Targets</span>
                  </div>
                  <div className="flex gap-2">
                    {!isProcessingQueue ? (
                      <Button
                        onClick={handleStartQueue}
                        variant="default"
                        size="sm"
                        className="bg-accent text-accent-foreground hover:bg-accent/90"
                      >
                        <Play size={16} className="mr-1" weight="fill" />
                        Start Queue
                      </Button>
                    ) : isPaused ? (
                      <Button
                        onClick={handleResumeQueue}
                        variant="default"
                        size="sm"
                        className="bg-accent text-accent-foreground hover:bg-accent/90"
                      >
                        <Play size={16} className="mr-1" weight="fill" />
                        Resume
                      </Button>
                    ) : (
                      <Button
                        onClick={handlePauseQueue}
                        variant="outline"
                        size="sm"
                        className="border-yellow-500/30 hover:bg-yellow-500/10 text-yellow-500"
                      >
                        <Pause size={16} className="mr-1" weight="fill" />
                        Pause
                      </Button>
                    )}
                    {isProcessingQueue && (
                      <Button
                        onClick={handleStopQueue}
                        variant="destructive"
                        size="sm"
                      >
                        <StopCircle size={16} className="mr-1" />
                        Stop
                      </Button>
                    )}
                    <Button
                      onClick={handleClearQueue}
                      variant="outline"
                      size="sm"
                      className="border-destructive/30 hover:bg-destructive/10 text-destructive"
                      disabled={isProcessingQueue}
                    >
                      <Trash size={16} className="mr-1" />
                      Clear
                    </Button>
                  </div>
                </div>

                {isPaused && (
                  <Alert className="border-yellow-500/30 bg-yellow-500/5">
                    <AlertDescription className="text-foreground text-sm flex items-center gap-2">
                      <Pause size={16} className="text-yellow-500" />
                      Queue is paused. Click Resume to continue processing targets.
                    </AlertDescription>
                  </Alert>
                )}

                <ScrollArea className="h-[200px] rounded-md border border-border bg-card p-3">
                  <div className="space-y-2">
                    {targetQueue.map((queued, index) => (
                      <motion.div
                        key={queued.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className="flex items-start gap-2 p-2 rounded hover:bg-accent/10 transition-colors group"
                      >
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-xs border-muted-foreground/30">
                            #{index + 1}
                          </Badge>
                          {queued.target.type === 'repository' ? (
                            <Package size={16} className="text-accent" />
                          ) : (
                            <Globe size={16} className="text-accent" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm text-foreground break-all">
                            {queued.target.url}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Type: {queued.target.type} • Depth: {queued.target.depth}
                          </div>
                        </div>
                        <Button
                          onClick={() => handleRemoveFromQueue(queued.id)}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={isProcessingQueue && index === 0}
                        >
                          <X size={14} />
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </Card>
          )}

          <Separator className="bg-border" />

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">Crawl Type</label>
              <div className="flex gap-2">
                <Button
                  onClick={() => setCrawlType('repository')}
                  variant={crawlType === 'repository' ? 'default' : 'outline'}
                  className={crawlType === 'repository' ? 'bg-accent text-accent-foreground' : 'border-border'}
                >
                  <Package size={18} className="mr-2" />
                  Git Repository
                </Button>
                <Button
                  onClick={() => setCrawlType('web')}
                  variant={crawlType === 'web' ? 'default' : 'outline'}
                  className={crawlType === 'web' ? 'bg-accent text-accent-foreground' : 'border-border'}
                >
                  <Globe size={18} className="mr-2" />
                  Website
                </Button>
              </div>
            </div>

            <div>
              <label htmlFor="crawl-url" className="text-sm font-medium text-foreground block mb-2">
                {crawlType === 'repository' ? 'Repository URL' : 'Website URL'}
              </label>
              <Input
                id="crawl-url"
                placeholder={
                  crawlType === 'repository'
                    ? 'https://github.com/username/repository'
                    : 'https://example.com'
                }
                value={crawlUrl}
                onChange={(e) => setCrawlUrl(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Max Depth: {maxDepth}
              </label>
              <Slider
                value={[maxDepth]}
                onValueChange={(value) => setMaxDepth(value[0])}
                min={1}
                max={crawlType === 'web' ? 3 : 5}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1 level</span>
                <span>{crawlType === 'web' ? '3 levels' : '5 levels'}</span>
              </div>
            </div>

            {crawlType === 'web' && (
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Max Pages: {maxPages}
                </label>
                <Slider
                  value={[maxPages]}
                  onValueChange={(value) => setMaxPages(value[0])}
                  min={10}
                  max={100}
                  step={10}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>10 pages</span>
                  <span>100 pages</span>
                </div>
              </div>
            )}

            <Alert className="border-accent/30 bg-accent/5">
              <AlertDescription className="text-xs">
                <Sparkle size={14} className="inline mr-1" weight="fill" />
                {crawlType === 'repository'
                  ? 'Crawls recursively through repository files looking for media links, playlists, EPG data, and config files.'
                  : 'Follows links within the same domain to discover media content. Higher depth and page limits take longer.'}
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                onClick={handleAddToQueue}
                disabled={!crawlUrl.trim()}
                variant="outline"
                className="border-accent/30 hover:bg-accent/10 text-accent"
              >
                <Plus size={20} className="mr-2" />
                Add to Queue
              </Button>
              <Button
                onClick={() => setShowBulkAdd(true)}
                variant="outline"
                className="border-accent/30 hover:bg-accent/10 text-accent"
              >
                <List size={20} className="mr-2" />
                Bulk Add
              </Button>
            </div>

            <Button
              onClick={handleStartCrawl}
              disabled={!crawlUrl.trim() || activeCrawls.length > 0 || isProcessingQueue}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Play size={20} className="mr-2" weight="fill" />
              Start Single Crawl Now
            </Button>
          </div>
        </div>
      </Card>

      <AnimatePresence>
        {activeCrawls.map(crawl => (
          <motion.div
            key={crawl.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="bg-card border-accent/50 p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {crawl.target.type === 'repository' ? (
                      <Package size={20} className="text-accent" />
                    ) : (
                      <Globe size={20} className="text-accent" />
                    )}
                    <span className="font-semibold text-foreground">Crawling...</span>
                  </div>
                  <Button
                    onClick={() => handleStopCrawl(crawl.id)}
                    variant="destructive"
                    size="sm"
                  >
                    <StopCircle size={16} className="mr-1" />
                    Stop
                  </Button>
                </div>

                <div className="font-mono text-sm text-accent break-all">
                  {crawl.target.url}
                </div>

                {crawl.currentFile && (
                  <div className="text-xs text-muted-foreground truncate">
                    Current: {crawl.currentFile}
                  </div>
                )}

                <Progress value={crawl.progress} className="h-2" />
                <div className="text-xs text-muted-foreground text-right">
                  {Math.round(crawl.progress)}%
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

      {showHistory && crawlHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <Card className="bg-card border-border p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">Crawl History</h3>
                <div className="flex gap-2">
                  <Button
                    onClick={handleExportHistory}
                    variant="outline"
                    size="sm"
                    className="border-accent/30 hover:bg-accent/10 text-accent"
                  >
                    <Download size={16} className="mr-1" />
                    Export All
                  </Button>
                  <Button
                    onClick={handleClearHistory}
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 hover:bg-destructive/10 text-destructive"
                  >
                    <Trash size={16} className="mr-1" />
                    Clear All
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[400px] rounded-md border border-border bg-primary/30 p-4">
                <div className="space-y-3">
                  {crawlHistory.map((result, index) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.5) }}
                      className="p-4 rounded-lg border border-border hover:border-accent/50 transition-colors bg-card"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            {result.target.type === 'repository' ? (
                              <Package size={18} className="text-accent shrink-0" />
                            ) : result.target.type === 'web' ? (
                              <Globe size={18} className="text-accent shrink-0" />
                            ) : (
                              <FolderOpen size={18} className="text-accent shrink-0" />
                            )}
                            <span className="font-mono text-sm text-foreground break-all">
                              {result.target.url}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Badge
                              variant="outline"
                              className={
                                result.status === 'completed'
                                  ? 'border-green-500/30 text-green-500'
                                  : result.status === 'failed'
                                  ? 'border-destructive/30 text-destructive'
                                  : 'border-yellow-500/30 text-yellow-500'
                              }
                            >
                              {result.status === 'completed' && <CheckCircle size={14} className="mr-1" weight="fill" />}
                              {result.status === 'failed' && <Warning size={14} className="mr-1" weight="fill" />}
                              {result.status}
                            </Badge>
                            <Badge variant="outline" className="border-accent/30 text-accent">
                              {result.links.length} links
                            </Badge>
                            <Badge variant="outline" className="border-border text-muted-foreground">
                              {result.filesScanned} files
                            </Badge>
                            {result.epgData && (
                              <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                                EPG: {result.epgData.channelCount} ch
                              </Badge>
                            )}
                            {result.configFiles.length > 0 && (
                              <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                                {result.configFiles.length} configs
                              </Badge>
                            )}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            <Clock size={12} className="inline mr-1" />
                            {new Date(result.timestamp).toLocaleString()}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            onClick={() => handleViewResult(result)}
                            variant="outline"
                            size="sm"
                            className="border-accent/30 hover:bg-accent/10 text-accent"
                          >
                            <FileText size={16} />
                          </Button>
                          <Button
                            onClick={() => handleDownloadResult(result)}
                            variant="outline"
                            size="sm"
                            className="border-accent/30 hover:bg-accent/10 text-accent"
                          >
                            <Download size={16} />
                          </Button>
                          <Button
                            onClick={() => handleDeleteResult(result.id)}
                            variant="outline"
                            size="sm"
                            className="border-destructive/30 hover:bg-destructive/10 text-destructive"
                          >
                            <Trash size={16} />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </Card>
        </motion.div>
      )}

      <Dialog open={showBulkAdd} onOpenChange={setShowBulkAdd}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <List size={20} className="text-accent" />
              Bulk Add Targets to Queue
            </DialogTitle>
            <DialogDescription>
              Enter multiple URLs (one per line) to add them all to the crawl queue. All targets will use the same type and depth settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                URLs (one per line)
              </label>
              <Textarea
                placeholder={`https://github.com/user/repo1
https://github.com/user/repo2
https://example.com/media
https://example.org/playlists`}
                value={bulkUrls}
                onChange={(e) => setBulkUrls(e.target.value)}
                className="font-mono text-sm min-h-[200px]"
              />
              <div className="text-xs text-muted-foreground">
                {bulkUrls.split('\n').filter(url => url.trim()).length} URLs entered
              </div>
            </div>

            <Alert className="border-accent/30 bg-accent/5">
              <AlertDescription className="text-xs">
                <Sparkle size={14} className="inline mr-1" weight="fill" />
                All targets will be added with the currently selected crawl type ({crawlType}) and depth ({maxDepth}).
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowBulkAdd(false)}
              variant="outline"
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkAddToQueue}
              disabled={bulkUrls.split('\n').filter(url => url.trim()).length === 0}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Plus size={18} className="mr-2" />
              Add {bulkUrls.split('\n').filter(url => url.trim()).length} Targets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarBlank size={20} className="text-accent" weight="fill" />
              {editingSchedule ? 'Edit Scheduled Crawl' : 'Schedule New Crawl'}
            </DialogTitle>
            <DialogDescription>
              Schedule a crawl to run automatically at a specific time. Choose recurring patterns for regular automated crawls.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">Crawl Type</label>
              <div className="flex gap-2">
                <Button
                  onClick={() => setScheduleType('repository')}
                  variant={scheduleType === 'repository' ? 'default' : 'outline'}
                  size="sm"
                  className={scheduleType === 'repository' ? 'bg-accent text-accent-foreground' : 'border-border'}
                >
                  <Package size={16} className="mr-2" />
                  Repository
                </Button>
                <Button
                  onClick={() => setScheduleType('web')}
                  variant={scheduleType === 'web' ? 'default' : 'outline'}
                  size="sm"
                  className={scheduleType === 'web' ? 'bg-accent text-accent-foreground' : 'border-border'}
                >
                  <Globe size={16} className="mr-2" />
                  Website
                </Button>
              </div>
            </div>

            <div>
              <label htmlFor="schedule-url" className="text-sm font-medium text-foreground block mb-2">
                {scheduleType === 'repository' ? 'Repository URL' : 'Website URL'}
              </label>
              <Input
                id="schedule-url"
                placeholder={
                  scheduleType === 'repository'
                    ? 'https://github.com/username/repository'
                    : 'https://example.com'
                }
                value={scheduleUrl}
                onChange={(e) => setScheduleUrl(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Max Depth: {scheduleDepth}
              </label>
              <Slider
                value={[scheduleDepth]}
                onValueChange={(value) => setScheduleDepth(value[0])}
                min={1}
                max={scheduleType === 'web' ? 3 : 5}
                step={1}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="schedule-date" className="text-sm font-medium text-foreground block mb-2">
                  Date
                </label>
                <Input
                  id="schedule-date"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label htmlFor="schedule-time" className="text-sm font-medium text-foreground block mb-2">
                  Time
                </label>
                <Input
                  id="schedule-time"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-2">Recurrence Pattern</label>
              <Select value={recurrencePattern} onValueChange={(value) => setRecurrencePattern(value as RecurrencePattern)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">
                    <div className="flex items-center gap-2">
                      <Clock size={16} />
                      Once - Run one time only
                    </div>
                  </SelectItem>
                  <SelectItem value="hourly">
                    <div className="flex items-center gap-2">
                      <Repeat size={16} />
                      Hourly - Repeat every hour
                    </div>
                  </SelectItem>
                  <SelectItem value="daily">
                    <div className="flex items-center gap-2">
                      <Repeat size={16} />
                      Daily - Repeat every day
                    </div>
                  </SelectItem>
                  <SelectItem value="weekly">
                    <div className="flex items-center gap-2">
                      <Repeat size={16} />
                      Weekly - Repeat every week
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Alert className="border-accent/30 bg-accent/5">
              <AlertDescription className="text-xs">
                <Sparkle size={14} className="inline mr-1" weight="fill" />
                {recurrencePattern === 'once'
                  ? 'This crawl will run once at the scheduled time and then be automatically disabled.'
                  : `This crawl will run ${recurrencePattern} starting from the scheduled time. It will continue running until you disable or delete it.`}
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowScheduleDialog(false)
                setEditingSchedule(null)
                setScheduleUrl('')
                setScheduleDate('')
                setScheduleTime('')
                setRecurrencePattern('once')
              }}
              variant="outline"
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={editingSchedule ? handleUpdateSchedule : handleAddSchedule}
              disabled={!scheduleUrl.trim() || !scheduleDate || !scheduleTime}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <CalendarBlank size={18} className="mr-2" weight="fill" />
              {editingSchedule ? 'Update Schedule' : 'Add Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={20} className="text-accent" />
              Crawl Result Details
            </DialogTitle>
            <DialogDescription>
              View detailed information about this crawl
            </DialogDescription>
          </DialogHeader>

          {selectedResult && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-foreground mb-1">Target</div>
                  <div className="font-mono text-sm text-muted-foreground break-all bg-secondary/30 p-3 rounded">
                    {selectedResult.target.url}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-foreground mb-1">Type</div>
                    <Badge variant="outline" className="border-accent/30 text-accent">
                      {selectedResult.target.type}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground mb-1">Status</div>
                    <Badge
                      variant="outline"
                      className={
                        selectedResult.status === 'completed'
                          ? 'border-green-500/30 text-green-500'
                          : selectedResult.status === 'failed'
                          ? 'border-destructive/30 text-destructive'
                          : 'border-yellow-500/30 text-yellow-500'
                      }
                    >
                      {selectedResult.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-foreground mb-1">Links Found</div>
                    <div className="text-2xl font-bold text-accent">{selectedResult.links.length}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground mb-1">Files Scanned</div>
                    <div className="text-2xl font-bold text-foreground">{selectedResult.filesScanned}</div>
                  </div>
                </div>

                {selectedResult.epgData && (
                  <div className="p-3 rounded border border-purple-500/30 bg-purple-500/5">
                    <div className="text-sm font-medium text-foreground mb-2">EPG Data</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Channels: {selectedResult.epgData.channelCount}</div>
                      <div>Programmes: {selectedResult.epgData.programmeCount}</div>
                    </div>
                  </div>
                )}

                {selectedResult.configFiles.length > 0 && (
                  <div className="p-3 rounded border border-blue-500/30 bg-blue-500/5">
                    <div className="text-sm font-medium text-foreground mb-2">Config Files</div>
                    <div className="text-sm">{selectedResult.configFiles.length} configuration files extracted</div>
                  </div>
                )}

                {selectedResult.errors.length > 0 && (
                  <div className="p-3 rounded border border-destructive/30 bg-destructive/5">
                    <div className="text-sm font-medium text-foreground mb-2">Errors ({selectedResult.errors.length})</div>
                    <ScrollArea className="h-[100px]">
                      <div className="space-y-1">
                        {selectedResult.errors.map((error, i) => (
                          <div key={i} className="text-xs text-destructive">{error}</div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                <div>
                  <div className="text-sm font-medium text-foreground mb-2">Sample Links (first 10)</div>
                  <ScrollArea className="h-[150px] rounded border border-border bg-primary/30 p-3">
                    <div className="space-y-1 font-mono text-xs">
                      {selectedResult.links.slice(0, 10).map((link, i) => (
                        <div key={i} className="text-foreground break-all">{link}</div>
                      ))}
                      {selectedResult.links.length > 10 && (
                        <div className="text-muted-foreground italic">
                          ...and {selectedResult.links.length - 10} more links
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            {selectedResult && (
              <>
                <Button
                  onClick={() => handleDownloadReport(selectedResult)}
                  variant="outline"
                  className="border-accent/30 hover:bg-accent/10 text-accent"
                >
                  <FileText size={18} className="mr-2" />
                  Download Report
                </Button>
                <Button
                  onClick={() => handleDownloadResult(selectedResult)}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Download size={18} className="mr-2" />
                  Download All Files
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showHeadlessSettings} onOpenChange={setShowHeadlessSettings}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Browsers size={20} className="text-accent" />
              Headless Browser Settings
            </DialogTitle>
            <DialogDescription>
              Configure Puppeteer-powered headless browsing for JavaScript-heavy sites. Enables dynamic content extraction and advanced scraping capabilities.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card/50">
              <div className="flex items-center gap-3">
                <Browsers size={24} className={headlessBrowserEnabled === 'true' ? 'text-accent' : 'text-muted-foreground'} weight="fill" />
                <div>
                  <div className="text-sm font-medium text-foreground">Enable Headless Browser</div>
                  <div className="text-xs text-muted-foreground">
                    Use Puppeteer backend for JavaScript rendering
                  </div>
                </div>
              </div>
              <Button
                onClick={() => setHeadlessBrowserEnabled((current = 'false') => current === 'true' ? 'false' : 'true')}
                variant="outline"
                size="sm"
                className={headlessBrowserEnabled === 'true' ? 'border-accent/30 text-accent' : 'border-border'}
              >
                {headlessBrowserEnabled === 'true' ? (
                  <>
                    <Lightning size={16} className="mr-1" weight="fill" />
                    Enabled
                  </>
                ) : (
                  <>Disabled</>
                )}
              </Button>
            </div>

            {headlessBrowserEnabled === 'true' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Backend Service URL
                  </label>
                  <Input
                    value={headlessBrowserBackend || ''}
                    onChange={(e) => setHeadlessBrowserBackend(e.target.value)}
                    placeholder="http://localhost:3001"
                    className="font-mono text-sm"
                  />
                  <div className="text-xs text-muted-foreground">
                    Leave empty to use fallback browser methods (limited JavaScript support)
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="text-sm font-medium text-foreground">Performance Options</div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-foreground">Block Images</div>
                      <div className="text-xs text-muted-foreground">Faster loading, saves bandwidth</div>
                    </div>
                    <Checkbox
                      checked={browserOptions.blockImages}
                      onCheckedChange={(checked) => setBrowserOptions({...browserOptions, blockImages: checked as boolean})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-foreground">Block Stylesheets</div>
                      <div className="text-xs text-muted-foreground">Faster rendering, may break layouts</div>
                    </div>
                    <Checkbox
                      checked={browserOptions.blockStyles}
                      onCheckedChange={(checked) => setBrowserOptions({...browserOptions, blockStyles: checked as boolean})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-foreground">Block Fonts</div>
                      <div className="text-xs text-muted-foreground">Faster loading</div>
                    </div>
                    <Checkbox
                      checked={browserOptions.blockFonts}
                      onCheckedChange={(checked) => setBrowserOptions({...browserOptions, blockFonts: checked as boolean})}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-foreground">Page Timeout (seconds)</div>
                    <Input
                      type="number"
                      value={Math.floor((browserOptions.timeout || 30000) / 1000)}
                      onChange={(e) => setBrowserOptions({...browserOptions, timeout: parseInt(e.target.value) * 1000})}
                      min={5}
                      max={120}
                    />
                  </div>
                </div>

                <Alert className="border-accent/30 bg-accent/5">
                  <AlertDescription className="text-xs">
                    <Lightning size={14} className="inline mr-1" weight="fill" />
                    <strong>Performance tip:</strong> Block images, styles, and fonts for maximum speed. Only disable if you need visual elements or specific CSS-based content.
                  </AlertDescription>
                </Alert>

                <Alert className="border-blue-500/30 bg-blue-500/5">
                  <AlertDescription className="text-xs">
                    <Eye size={14} className="inline mr-1" />
                    <strong>Backend required:</strong> Install and run the Puppeteer backend service for full functionality. See PUPPETEER_BACKEND.md for setup instructions.
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowHeadlessSettings(false)}
              variant="outline"
              className="border-border"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
