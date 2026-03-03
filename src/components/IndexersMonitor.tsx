import { useState, useCallback, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { MagnifyingGlass, CheckCircle, WarningCircle, Clock, Pulse, Download, ArrowsClockwise, Database, Broadcast, CaretRight, Trash, Download as DownloadIcon, Upload, Television } from '@phosphor-icons/react'
import { MediaPlayer } from '@/components/MediaPlayer'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { 
  getAllStoredItems, 
  addStoredItems, 
  removeStoredItem, 
  clearAllStoredItems,
  getStorageStats,
  getStoredItemsByType,
  checkDuplicateMagnet,
  type StoredMediaItem,
  type StorageStats,
  exportStoredItems,
  importStoredItems,
} from '@/lib/storageManager'
import {
  generatePlaylist,
  downloadPlaylist,
  getFormatLabel,
  type PlaylistFormat,
  type ContentFilter,
} from '@/lib/playlistGenerator'

interface Indexer {
  id: string
  name: string
  privacy: 'Public' | 'Private'
  enable: boolean
  language: string
}

interface IndexerDefinition {
  id: string
  name: string
  implementation: string
  protocol?: string
  category?: string
  description?: string
  language?: string
  tags?: string[]
}

interface SearchResult {
  title: string
  size: number
  seeders: number
  leechers: number
  indexer: string
  publishDate?: string
  magnetUrl?: string
}

interface TestResults {
  indexers: Indexer[]
  availableProviders: IndexerDefinition[]
  searchResults: SearchResult[]
  searchTime: number
  totalResults: number
  status: 'idle' | 'testing' | 'searching' | 'complete' | 'error'
  error?: string
}

interface ExtractionJob {
  status: 'idle' | 'extracting' | 'complete'
  jobId?: string
  extractedCount: number
  message?: string
}

interface AggregatedResult {
  id: string
  title: string
  size: number
  seeders: number
  leechers: number
  indexer: string
  magnetUrl: string
  addedAt: number
}

interface CrawlSession {
  isRunning: boolean
  isCrawling: boolean
  searchCount: number
  startTime?: number
  lastSearchTime?: number
}

const BACKEND_URL = 'http://localhost:3002'
const PROWLARR_PROXY_URL = `${BACKEND_URL}/api/prowlarr`

const GENRES = [
  'All',
  'Movies',
  'Series',
  'Anime',
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Drama',
  'Family',
  'Fantasy',
  'Horror',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Thriller',
  'Western',
  'Documentary',
  'Sport',
  'Musical',
  'War',
  'XXX',
  'Adult Content',
]

const SEARCH_CATEGORIES = [
  'All',
  'Live TV',
  'Movies',
  'Series',
  'Extra Content',
]

const CONTENT_TYPES = [
  'All',
  'Torrent',
  'MP4',
  'MKV',
  'AVI',
  'WebM',
  'MOV',
  'FLV',
  'Direct Stream',
  'HTTP',
]

export function IndexersMonitor() {
  const [testResults, setTestResults] = useState<TestResults>({
    indexers: [],
    availableProviders: [],
    searchResults: [],
    searchTime: 0,
    totalResults: 0,
    status: 'idle',
  })
  const [selectedGenre, setSelectedGenre] = useState('Action')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedContentType, setSelectedContentType] = useState('All')
  const [customQuery, setCustomQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'genre' | 'custom'>('genre')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set())
  const [extractionJob, setExtractionJob] = useState<ExtractionJob>({ status: 'idle', extractedCount: 0 })
  
  // Continuous crawl state
  const [aggregatedResults, setAggregatedResults] = useState<AggregatedResult[]>([])
  const [crawlSession, setCrawlSession] = useState<CrawlSession>({
    isRunning: false,
    isCrawling: false,
    searchCount: 0,
  })
  const crawlIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const crawlTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Storage state for persistent processed results
  const [storedItems, setStoredItems] = useState<StoredMediaItem[]>([])
  const [storageStats, setStorageStats] = useState<StorageStats>({
    totalItems: 0,
    movies: 0,
    series: 0,
    liveTV: 0,
    totalIndexers: new Set(),
    oldestItem: 0,
    newestItem: 0,
  })
  const [storageFilter, setStorageFilter] = useState<'all' | 'movie' | 'series' | 'live-tv'>('all')
  const [playlistFormat, setPlaylistFormat] = useState<PlaylistFormat>('m3u8')
  
  // Track total files retrieved from indexers
  const [totalFilesRetrieved, setTotalFilesRetrieved] = useState(0)
  
  // Tab visibility tracking for background widget
  const [isTabVisible, setIsTabVisible] = useState(true)
  const [showBackgroundWidget, setShowBackgroundWidget] = useState(false)
  
  // Widget position and dragging - default to bottom-right with margin
  const [widgetPosition, setWidgetPosition] = useState({ 
    x: typeof window !== 'undefined' ? window.innerWidth - 400 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight - 300 : 0,
  })
  const [isDraggingWidget, setIsDraggingWidget] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  
  // Parallel processing jobs (up to 4 concurrent)
  type ProcessingJob = {
    id: string
    resultCount: number
    status: 'processing' | 'complete' | 'failed'
    progress: string
    startTime: number
  }
  
  // Initialize from localStorage
  const [activeProcessingJobs, setActiveProcessingJobs] = useState<ProcessingJob[]>(() => {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem('activeProcessingJobs')
    return stored ? JSON.parse(stored) : []
  })
  
  // Persistent polling interval for job status
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const MAX_PARALLEL_JOBS = 4
  
  // Auto-processing state
  const [autoProcess, setAutoProcess] = useState(true)
  const [autoProcessThreshold, setAutoProcessThreshold] = useState(10)
  const lastAutoProcessRef = useRef<number>(0)

  const testConnection = useCallback(async () => {
    console.log('[DEBUG-INDEXERS] testConnection called')
    setIsLoading(true)
    setTestResults(prev => ({ ...prev, status: 'testing' }))
    
    try {
      // Test health
      console.log('[DEBUG-INDEXERS] Testing Prowlarr health at', PROWLARR_PROXY_URL)
      const healthResponse = await fetch(`${PROWLARR_PROXY_URL}/api/v1/health`, {
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!healthResponse.ok) {
        console.error('[DEBUG-INDEXERS] Health check failed:', healthResponse.status)
        throw new Error('Prowlarr is not responding')
      }

      console.log('[DEBUG-INDEXERS] Health check passed, fetching indexers...')

      // Fetch indexers
      const indexersResponse = await fetch(`${PROWLARR_PROXY_URL}/api/v1/indexer`, {
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!indexersResponse.ok) {
        console.error('[DEBUG-INDEXERS] Indexer fetch failed:', indexersResponse.status)
        throw new Error('Failed to fetch indexers')
      }

      const indexers = await indexersResponse.json()
      console.log('[DEBUG-INDEXERS] Fetched indexers:', Array.isArray(indexers) ? indexers.length : 'not an array', indexers)
      
      setTestResults(prev => ({
        ...prev,
        indexers: Array.isArray(indexers) ? indexers : [],
        status: 'complete',
      }))
      
      toast.success(`Found ${indexers.length} indexers`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[DEBUG-INDEXERS] Connection error:', message, error)
      setTestResults(prev => ({
        ...prev,
        status: 'error',
        error: message,
      }))
      toast.error(`Connection failed: ${message}`)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const performSearch = useCallback(async () => {
    const query = searchMode === 'genre' ? selectedGenre : customQuery.trim()
    
    if (!query) {
      toast.error(`Please ${searchMode === 'genre' ? 'select a genre' : 'enter a search term'}`)
      return
    }

    setIsLoading(true)
    setTestResults(prev => ({ ...prev, status: 'searching' }))
    
    try {
      const startTime = Date.now()
      
      const response = await fetch(
        `${PROWLARR_PROXY_URL}/api/v1/search?query=${encodeURIComponent(query)}&type=search`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const results = await response.json()
      const searchTime = (Date.now() - startTime) / 1000

      const searchResults = Array.isArray(results)
        ? results.slice(0, 10).map((r: any) => ({
            title: r.title || 'Unknown',
            size: r.size || 0,
            seeders: r.seeders || 0,
            leechers: r.leechers || r.peers || 0,
            indexer: r.indexer || 'Unknown',
            publishDate: r.publishDate,
            magnetUrl: r.magnetUrl || r.downloadUrl,
          }))
        : []

      setTestResults(prev => ({
        ...prev,
        searchResults,
        searchTime,
        totalResults: Array.isArray(results) ? results.length : 0,
        status: 'complete',
      }))

      toast.success(`Found ${searchResults.length} results in ${searchTime.toFixed(2)}s`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setTestResults(prev => ({
        ...prev,
        status: 'error',
        error: message,
        searchResults: [],
      }))
      toast.error(`Search failed: ${message}`)
    } finally {
      setIsLoading(false)
    }
  }, [selectedGenre, customQuery, searchMode])

  const addResultsToAggregated = useCallback((newResults: SearchResult[]) => {
    console.log('[DEBUG-AGGREGATE] addResultsToAggregated called with', newResults.length, 'results')
    
    setAggregatedResults(prev => {
      // Filter and validate new results - only include those with magnetUrl
      const validNewResults = newResults
        .filter((r): r is SearchResult & { magnetUrl: string } => !!(r.magnetUrl && r.title))
        .map(r => ({
          id: `${r.indexer}-${r.title}-${r.magnetUrl}`.replace(/[^a-z0-9]/gi, ''),
          title: r.title,
          size: r.size,
          seeders: r.seeders,
          leechers: r.leechers,
          indexer: r.indexer,
          magnetUrl: r.magnetUrl,
          addedAt: Date.now(),
        }))

      console.log('[DEBUG-AGGREGATE] Valid results:', validNewResults.length)

      // Deduplicate against:
      // 1. Already aggregated results
      const existingUrls = new Set(prev.map(r => r.magnetUrl))
      
      // 2. Persistent storage (vault)
      const storedUrls = new Set(storedItems.map(item => item.url))
      
      const uniqueNew = validNewResults.filter(r => 
        !existingUrls.has(r.magnetUrl) && 
        !storedUrls.has(r.magnetUrl)
      )

      const deduplicatedCount = validNewResults.length - uniqueNew.length
      console.log('[DEBUG-AGGREGATE] After dedup: unique=', uniqueNew.length, 'skipped=', deduplicatedCount)
      
      if (uniqueNew.length > 0) {
        // Increment total files retrieved
        setTotalFilesRetrieved(prev => {
          const newTotal = prev + uniqueNew.length
          console.log('[DEBUG-AGGREGATE] Updated totalFilesRetrieved:', newTotal)
          return newTotal
        })
        
        const msg = deduplicatedCount > 0 
          ? `Added ${uniqueNew.length} new results (${deduplicatedCount} already in vault)`
          : `Added ${uniqueNew.length} new result(s)`
        toast.success(msg)
      } else if (deduplicatedCount > 0) {
        toast.info(`⏭️ All ${deduplicatedCount} results already in vault`)
      }

      return [...prev, ...uniqueNew].sort((a, b) => b.seeders - a.seeders)
    })
  }, [storedItems])

  const startContinuousCrawl = useCallback(async () => {
    const rawBaseQuery = searchMode === 'genre' ? selectedGenre : customQuery.trim()
    const baseQuery = rawBaseQuery === 'All' ? '' : rawBaseQuery
    const categoryTerm = selectedCategory !== 'All' ? selectedCategory : ''
    const contentTypeTerm = selectedContentType !== 'All' ? selectedContentType : ''
    const query = [categoryTerm, baseQuery, contentTypeTerm].filter(Boolean).join(' ').trim()
    console.log('[DEBUG-CRAWL] startContinuousCrawl called | mode:', searchMode, '| query:', query, '| category:', selectedCategory, '| contentType:', selectedContentType)
    
    if (!query) {
      console.log('[DEBUG-CRAWL] No query provided - aborting')
      toast.error(`Please ${searchMode === 'genre' ? 'select a genre' : 'enter a search term'}`)
      return
    }

    // Initial connection test
    if (testResults.indexers.length === 0) {
      console.log('[DEBUG-CRAWL] No indexers loaded, running testConnection')
      await testConnection()
    }

    // Reset counters for new crawl
    console.log('[DEBUG-CRAWL] Resetting counters')
    setTotalFilesRetrieved(0)
    setAggregatedResults([])
    
    const newCrawlSession = {
      isRunning: true,
      isCrawling: false,
      searchCount: 0,
      startTime: Date.now(),
      query: query,
      searchMode: searchMode,
      selectedCategory: selectedCategory,
      selectedGenre: selectedGenre,
      customQuery: customQuery,
      selectedContentType: selectedContentType,
    }
    
    setCrawlSession(newCrawlSession as any)

    // Persist crawl state to survive navigation and browser closure
    localStorage.setItem('activeCrawlState', JSON.stringify(newCrawlSession))
    console.log('[DEBUG-CRAWL] Persisted crawl state to localStorage')

    toast.info(`🚀 Starting continuous crawl for "${query}"...\n⏸️ Crawl will continue in background until stopped!`)

    // Perform immediate search
    const performCrawlSearch = async () => {
      console.log('[DEBUG-CRAWL] performCrawlSearch executing')
      setCrawlSession(prev => ({ ...prev, isCrawling: true }))

      try {
        const startTime = Date.now()
        console.log('[DEBUG-CRAWL] Querying Prowlarr with:', query)
        const response = await fetch(
          `${PROWLARR_PROXY_URL}/api/v1/search?query=${encodeURIComponent(query)}&type=search`,
          {
            headers: { 'Accept': 'application/json' },
          }
        )

        if (response.ok) {
          const results = await response.json()
          console.log('[DEBUG-CRAWL] Prowlarr response:', Array.isArray(results) ? results.length + ' results' : 'invalid format')
          
          const searchResults = Array.isArray(results)
            ? results.map((r: any) => ({
                title: r.title || 'Unknown',
                size: r.size || 0,
                seeders: r.seeders || 0,
                leechers: r.leechers || r.peers || 0,
                indexer: r.indexer || 'Unknown',
                publishDate: r.publishDate,
                magnetUrl: r.magnetUrl || r.downloadUrl,
              }))
            : []

          if (searchResults.length > 0) {
            console.log('[DEBUG-CRAWL] Adding', searchResults.length, 'results to aggregated')
            addResultsToAggregated(searchResults)
          }

          setCrawlSession(prev => ({
            ...prev,
            searchCount: prev.searchCount + 1,
            lastSearchTime: Date.now() - startTime,
          }))
        } else {
          console.error('[DEBUG-CRAWL] Prowlarr response failed:', response.status)
        }
      } catch (error) {
        console.error('[DEBUG-CRAWL] Search error:', error)
      } finally {
        setCrawlSession(prev => ({ ...prev, isCrawling: false }))
      }
    }

    // Perform immediate search
    await performCrawlSearch()

    // Set interval for continuous searches (every 30 seconds)
    console.log('[DEBUG-CRAWL] Setting up interval for continuous searches every 30s')
    crawlIntervalRef.current = setInterval(performCrawlSearch, 30000)
  }, [selectedGenre, selectedCategory, customQuery, searchMode, selectedContentType, testResults.indexers.length, testConnection, addResultsToAggregated])

  const stopContinuousCrawl = useCallback(() => {
    console.log('[DEBUG-CRAWL] stopContinuousCrawl called')
    if (crawlIntervalRef.current) {
      clearInterval(crawlIntervalRef.current)
      crawlIntervalRef.current = null
      console.log('[DEBUG-CRAWL] Cleared crawl interval')
    }
    setCrawlSession(prev => ({ ...prev, isRunning: false }))
    
    // Clear the persisted crawl state when explicitly stopped
    localStorage.removeItem('activeCrawlState')
    console.log('[DEBUG-CRAWL] Removed persisted crawl state from localStorage')
    
    toast.info('⏸️ Crawl stopped')
  }, [])

  const clearAllJobs = useCallback(() => {
    // Ask for confirmation before clearing
    if (window.confirm('Clear all queued and in-progress jobs? This action cannot be undone.')) {
      console.log('[DEBUG-CRAWL] clearAllJobs called - clearing activeProcessingJobs and aggregatedResults')
      
      // Clear the jobs and results
      setActiveProcessingJobs([])
      setAggregatedResults([])
      
      // Also stop the crawl if it's running
      if (crawlSession.isRunning) {
        if (crawlIntervalRef.current) {
          clearInterval(crawlIntervalRef.current)
          crawlIntervalRef.current = null
        }
        setCrawlSession(prev => ({ ...prev, isRunning: false }))
        localStorage.removeItem('activeCrawlState')
      }
      
      toast.success('🗑️ All jobs cleared')
    }
  }, [crawlSession.isRunning])

  const saveAndClearAggregated = useCallback(async () => {
    console.log('[DEBUG-SAVE] saveAndClearAggregated called, aggregatedResults:', aggregatedResults.length, '| active jobs:', activeProcessingJobs.length)
    
    if (aggregatedResults.length === 0) {
      return
    }

    // Check if we can start a new job (max 4 parallel)
    if (activeProcessingJobs.length >= MAX_PARALLEL_JOBS) {
      console.log('[DEBUG-SAVE] Max parallel jobs reached (4), queueing for next slot')
      return
    }

    // Create a temporary client ID; replace with backend job ID once received
    const tempJobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const processedCount = aggregatedResults.length
    
    const newJob: ProcessingJob = {
      id: tempJobId,
      resultCount: processedCount,
      status: 'processing',
      progress: 'Submitting...',
      startTime: Date.now(),
    }
    
    setActiveProcessingJobs(prev => [...prev, newJob])
    console.log('[DEBUG-SAVE] Started job:', tempJobId, '| batch size:', processedCount)
    
    // CLEAR AGGREGATED RESULTS IMMEDIATELY to start collecting next batch
    setAggregatedResults([])

    // Run processing in background (don't await at component level)
    const runBackgroundProcessing = async () => {
      try {
        console.log('[DEBUG-PROCESSING] Starting background processing for job:', tempJobId)
        
        // Send full item metadata with titles, not just URLs
        const itemsToProcess = aggregatedResults.map(r => ({
          url: r.magnetUrl,
          title: r.title,
          seeders: r.seeders,
          indexer: r.indexer,
          size: r.size,
          leechers: r.leechers,
        }))
        
        console.log('[DEBUG-PROCESSING] Job', tempJobId, 'submitting', processedCount, 'items with metadata')

        // Step 1: Submit to processing pipeline
        const response = await fetch(`${BACKEND_URL}/api/media/process-and-classify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsToProcess })
        })

        if (!response.ok) {
          throw new Error('Failed to process results')
        }

        const data = await response.json()
        const backendJobId: string = data.id

        // Replace temp ID with backend job ID for polling and storage
        setActiveProcessingJobs(prev => prev.map(j =>
          j.id === tempJobId ? { ...j, id: backendJobId } : j
        ))
        if (typeof window !== 'undefined') {
          localStorage.setItem('lastIndexerJobId', backendJobId)
        }

        toast.info(`📊 Processing batch (${processedCount} results)`)

        // Step 2: Poll for results with timeout (5 minutes)
        const maxWaitTime = 300000
        const startTime = Date.now()
        let processingComplete = false
        let processedResults: any = null

        while (!processingComplete && Date.now() - startTime < maxWaitTime) {
          const statusResponse = await fetch(`${BACKEND_URL}/api/media/process-and-classify/${backendJobId}/status`)
          if (!statusResponse.ok) {
            await new Promise(resolve => setTimeout(resolve, 500))
            continue
          }

          const status = await statusResponse.json()
          const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
          
          // Update job progress
          setActiveProcessingJobs(prev => prev.map(j => 
            j.id === backendJobId 
              ? { ...j, progress: `${elapsedSeconds}s | ${status.processed || 0}/${status.total || '?'}` }
              : j
          ))
          
          if (status.status === 'complete') {
            processingComplete = true
            const resultsResponse = await fetch(`${BACKEND_URL}/api/media/process-and-classify/${backendJobId}/results`)
            console.log('[DEBUG-SAVE] Results fetch response status:', resultsResponse.status)
            if (resultsResponse.ok) {
              processedResults = await resultsResponse.json()
              console.log('[DEBUG-SAVE] Successfully fetched results, response:', processedResults)
            } else {
              console.error('[DEBUG-SAVE] Results fetch failed with status:', resultsResponse.status, resultsResponse.statusText)
              const errorText = await resultsResponse.text()
              console.error('[DEBUG-SAVE] Error response body:', errorText)
            }
            break
          } else if (status.status === 'failed' || status.status === 'error') {
            throw new Error(`Processing failed: ${status.error || 'Unknown error'}`)
          }

          await new Promise(resolve => setTimeout(resolve, 1000))
        }

          if (!processingComplete) {
            throw new Error('Processing timeout')
          }

          // Step 3: Save to vault
          console.log('[DEBUG-PROCESSING] Job', backendJobId, 'processing complete, attempting to save')
          console.log('[DEBUG-SAVE] Full backend response:', processedResults)
          
          if (processedResults) {
            const itemsToStore: StoredMediaItem[] = []

            // Extract data from backend response structure (summary.movies.items format)
            const movies = processedResults.summary?.movies?.items || processedResults.movies || []
            const series = processedResults.summary?.series?.items || processedResults.series || []
            const liveTV = processedResults.summary?.liveTV?.items || processedResults.liveTV || []
            const extraContent = processedResults.summary?.extraContent?.items || processedResults.extraContent || []

            console.log('[DEBUG-SAVE] Extracted arrays:', {
              moviesArray: movies,
              seriesArray: series,
              liveTVArray: liveTV,
              extraContentArray: extraContent,
            })

            console.log('[DEBUG-SAVE] Extracted array types:', {
              moviesIsArray: Array.isArray(movies),
              seriesIsArray: Array.isArray(series),
              liveTVIsArray: Array.isArray(liveTV),
              extraContentIsArray: Array.isArray(extraContent),
            })

            console.log('[DEBUG-SAVE] Processing backend results:', {
              moviesCount: Array.isArray(movies) ? movies.length : 0,
              seriesCount: Array.isArray(series) ? series.length : 0,
            liveTVCount: Array.isArray(liveTV) ? liveTV.length : 0,
            extraContentCount: Array.isArray(extraContent) ? extraContent.length : 0,
            totalCount: (Array.isArray(movies) ? movies.length : 0) + 
                       (Array.isArray(series) ? series.length : 0) +
                       (Array.isArray(liveTV) ? liveTV.length : 0) +
                       (Array.isArray(extraContent) ? extraContent.length : 0),
          })

          // Process movies
          if (Array.isArray(movies)) {
            movies.forEach((movie: any) => {
              itemsToStore.push({
                id: `${backendJobId}-${movie.url}`.replace(/[^a-z0-9]/gi, ''),
                title: movie.title || 'Unknown',
                url: movie.url,
                indexer: movie.indexer || 'Unknown',
                size: movie.size || 0,
                seeders: movie.seeders || 0,
                leechers: movie.leechers || 0,
                contentType: 'movie',
                genre: movie.genre,
                confidence: movie.confidence,
                processedAt: Date.now(),
                jobId: backendJobId,
                source: movie.source,
              })
            })
          }

          // Process series
          if (Array.isArray(series)) {
            series.forEach((s: any) => {
              itemsToStore.push({
                id: `${backendJobId}-${s.url}`.replace(/[^a-z0-9]/gi, ''),
                title: s.title || 'Unknown',
                url: s.url,
                indexer: s.indexer || 'Unknown',
                size: s.size || 0,
                seeders: s.seeders || 0,
                leechers: s.leechers || 0,
                contentType: 'series',
                genre: s.genre,
                confidence: s.confidence,
                processedAt: Date.now(),
                jobId: backendJobId,
                source: s.source,
              })
            })
          }

          // Process live TV
          if (Array.isArray(liveTV)) {
            liveTV.forEach((tv: any) => {
              itemsToStore.push({
                id: `${backendJobId}-${tv.url}`.replace(/[^a-z0-9]/gi, ''),
                title: tv.title || 'Unknown',
                url: tv.url,
                indexer: tv.indexer || 'Unknown',
                size: tv.size || 0,
                seeders: tv.seeders || 0,
                leechers: tv.leechers || 0,
                contentType: 'live-tv',
                genre: tv.genre,
                confidence: tv.confidence,
                processedAt: Date.now(),
                jobId: backendJobId,
                source: tv.source,
              })
            })
          }

          // Process extra content
          if (Array.isArray(extraContent)) {
            extraContent.forEach((item: any) => {
              itemsToStore.push({
                id: `${backendJobId}-${item.url}`.replace(/[^a-z0-9]/gi, ''),
                title: item.title || 'Unknown',
                url: item.url,
                indexer: item.indexer || 'Unknown',
                size: item.size || 0,
                seeders: item.seeders || 0,
                leechers: item.leechers || 0,
                contentType: 'extra-content' as any,
                genre: item.genre,
                confidence: item.confidence,
                processedAt: Date.now(),
                jobId: backendJobId,
                source: item.source,
              })
            })
          }

          if (itemsToStore.length > 0) {
            addStoredItems(itemsToStore)
            const updatedItems = getAllStoredItems()
            const stats = getStorageStats()
            setStoredItems(updatedItems)
            setStorageStats(stats)
            console.log('[DEBUG-SAVE] Updated vault display with', itemsToStore.length, 'new items')
            console.log('[DEBUG-SAVE] Vault now has', updatedItems.length, 'total items')
            toast.success(`✅ Stored ${itemsToStore.length} items`)
          }
        }

        // Mark job as complete
        setActiveProcessingJobs(prev => prev.map(j => 
          j.id === backendJobId ? { ...j, status: 'complete', progress: 'Complete' } : j
        ))
        
        // Remove from active jobs after 2 seconds
        setTimeout(() => {
          setActiveProcessingJobs(prev => prev.filter(j => j.id !== backendJobId))
        }, 2000)

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('[DEBUG-SAVE] Job', tempJobId, 'failed:', message)
        toast.error(`Batch failed: ${message}`)
        
        setActiveProcessingJobs(prev => prev.map(j => 
          j.id === tempJobId ? { ...j, status: 'failed', progress: `Failed: ${message}` } : j
        ))
      }
    }

    // Start background processing immediately (don't await - let it run in background)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    runBackgroundProcessing()
  }, [aggregatedResults, activeProcessingJobs.length, addStoredItems])

  // Auto-processing effect: automatically process results when threshold is reached
  useEffect(() => {
    console.log('[AUTO-PROCESS] Effect running | autoProcess:', autoProcess, '| results:', aggregatedResults.length, '| active jobs:', activeProcessingJobs.length)
    
    if (!autoProcess || aggregatedResults.length === 0) {
      console.log('[AUTO-PROCESS] Skipping: autoProcess=', autoProcess, 'results=', aggregatedResults.length)
      return
    }

    // Debounce auto-processing (wait at least 5 seconds between attempts)
    const now = Date.now()
    const timeSinceLastProcess = now - lastAutoProcessRef.current
    
    if (timeSinceLastProcess < 5000) {
      console.log('[AUTO-PROCESS] Debounce: skipping (too soon)')
      return
    }

    // Check if we should auto-process
    const thresholdReached = aggregatedResults.length >= autoProcessThreshold
    const crawlStopped = !crawlSession.isRunning && aggregatedResults.length > 0
    const canStartJob = activeProcessingJobs.length < MAX_PARALLEL_JOBS
    const shouldAutoProcess = (thresholdReached || crawlStopped) && canStartJob
    
    console.log('[AUTO-PROCESS] Conditions:', {
      thresholdReached: thresholdReached + ' (' + aggregatedResults.length + '/' + autoProcessThreshold + ')',
      crawlStopped: crawlStopped,
      canStartJob: canStartJob + ' (' + activeProcessingJobs.length + '/' + MAX_PARALLEL_JOBS + ')',
    })

    if (shouldAutoProcess) {
      lastAutoProcessRef.current = now
      console.log('[AUTO-PROCESS] TRIGGERING: Processing', aggregatedResults.length, 'results')
      saveAndClearAggregated()
    }
  }, [autoProcess, aggregatedResults, autoProcessThreshold, crawlSession.isRunning, activeProcessingJobs.length, saveAndClearAggregated])

  // Sync processing jobs to localStorage and start persistent polling
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeProcessingJobs', JSON.stringify(activeProcessingJobs))
    }
  }, [activeProcessingJobs])
  
  // Persistent job status polling - continues even when component unmounts
  useEffect(() => {
    const pollJobStatus = async () => {
      const activeJobs = activeProcessingJobs.filter(j => j.status === 'processing')
      
      if (activeJobs.length === 0) {
        // No jobs to poll, check localStorage for any pending jobs
        const stored = typeof window !== 'undefined' ? localStorage.getItem('activeProcessingJobs') : null
        if (!stored) return
        
        try {
          const storedJobs = JSON.parse(stored) as ProcessingJob[]
          const pendingJobs = storedJobs.filter(j => j.status === 'processing')
          if (pendingJobs.length > 0) {
            console.log('[BACKGROUND-POLL] Found pending jobs in localStorage:', pendingJobs.length)
            setActiveProcessingJobs(storedJobs)
          }
        } catch (e) {
          console.error('[BACKGROUND-POLL] Failed to parse stored jobs:', e)
        }
        return
      }
      
      // Poll each active job
      for (const job of activeJobs) {
        try {
          const response = await fetch(`${BACKEND_URL}/api/media/process-and-classify/${job.id}/status`)
          if (response.ok) {
            const status = await response.json()
            const elapsedSeconds = Math.round((Date.now() - job.startTime) / 1000)
            
            if (status.status === 'complete') {
              console.log('[BACKGROUND-POLL] Job', job.id, 'completed')
              
              // Fetch and save results
              const resultsResponse = await fetch(`${BACKEND_URL}/api/media/process-and-classify/${job.id}/results`)
              if (resultsResponse.ok) {
                const resultsData = await resultsResponse.json()
                const summary = resultsData.summary || resultsData
                
                // Save to vault
                const itemsToStore: StoredMediaItem[] = []
                
                if (Array.isArray(summary.movies?.items || summary.movies)) {
                  (summary.movies?.items || summary.movies || []).forEach((movie: any) => {
                    itemsToStore.push({
                      id: `${job.id}-${movie.url}`.replace(/[^a-z0-9]/gi, ''),
                      title: movie.title || 'Unknown',
                      url: movie.url,
                      indexer: movie.source || 'Unknown',
                      size: movie.size || 0,
                      seeders: movie.seeders || 0,
                      leechers: movie.leechers || 0,
                      contentType: 'movie',
                      genre: movie.genre,
                      confidence: movie.confidence,
                      processedAt: Date.now(),
                      jobId: job.id,
                      source: movie.source,
                    })
                  })
                }
                
                if (Array.isArray(summary.series?.items || summary.series)) {
                  (summary.series?.items || summary.series || []).forEach((series: any) => {
                    itemsToStore.push({
                      id: `${job.id}-${series.url}`.replace(/[^a-z0-9]/gi, ''),
                      title: series.title || 'Unknown',
                      url: series.url,
                      indexer: series.source || 'Unknown',
                      size: series.size || 0,
                      seeders: series.seeders || 0,
                      leechers: series.leechers || 0,
                      contentType: 'series',
                      genre: series.genre,
                      confidence: series.confidence,
                      processedAt: Date.now(),
                      jobId: job.id,
                      source: series.source,
                    })
                  })
                }
                
                if (Array.isArray(summary.liveTV?.items || summary.liveTV)) {
                  (summary.liveTV?.items || summary.liveTV || []).forEach((tv: any) => {
                    itemsToStore.push({
                      id: `${job.id}-${tv.url}`.replace(/[^a-z0-9]/gi, ''),
                      title: tv.title || 'Unknown',
                      url: tv.url,
                      indexer: tv.source || 'Unknown',
                      size: tv.size || 0,
                      seeders: tv.seeders || 0,
                      leechers: tv.leechers || 0,
                      contentType: 'live-tv',
                      genre: tv.genre,
                      confidence: tv.confidence,
                      processedAt: Date.now(),
                      jobId: job.id,
                      source: tv.source,
                    })
                  })
                }
                
                if (Array.isArray(summary.extraContent?.items || summary.extraContent)) {
                  (summary.extraContent?.items || summary.extraContent || []).forEach((item: any) => {
                    itemsToStore.push({
                      id: `${job.id}-${item.url}`.replace(/[^a-z0-9]/gi, ''),
                      title: item.title || 'Unknown',
                      url: item.url,
                      indexer: item.source || 'Unknown',
                      size: item.size || 0,
                      seeders: item.seeders || 0,
                      leechers: item.leechers || 0,
                      contentType: 'extra-content' as any,
                      genre: item.genre,
                      confidence: item.confidence,
                      processedAt: Date.now(),
                      jobId: job.id,
                      source: item.source,
                    })
                  })
                }
                
                if (itemsToStore.length > 0) {
                  addStoredItems(itemsToStore)
                  console.log('[BACKGROUND-POLL] Saved', itemsToStore.length, 'items to vault')
                }
              }
              
              // Mark job as complete and remove after 2 seconds
              setActiveProcessingJobs(prev => prev.map(j => 
                j.id === job.id ? { ...j, status: 'complete', progress: 'Complete' } : j
              ))
              
              setTimeout(() => {
                setActiveProcessingJobs(prev => prev.filter(j => j.id !== job.id))
              }, 2000)
            } else if (status.status === 'failed' || status.status === 'error') {
              console.error('[BACKGROUND-POLL] Job', job.id, 'failed')
              setActiveProcessingJobs(prev => prev.map(j => 
                j.id === job.id ? { ...j, status: 'failed', progress: `Failed: ${status.error || 'Unknown error'}` } : j
              ))
            } else {
              // Still processing
              setActiveProcessingJobs(prev => prev.map(j => 
                j.id === job.id ? { ...j, progress: `${elapsedSeconds}s | Status: ${status.status}` } : j
              ))
            }
          }
        } catch (error) {
          console.warn('[BACKGROUND-POLL] Error polling job', job.id, ':', error)
        }
      }
    }
    
    // Start polling immediately
    pollJobStatus()
    // Poll every 2 seconds regardless of component visibility
    pollingIntervalRef.current = setInterval(pollJobStatus, 2000)
    
    return () => {
      // Keep polling even on unmount - don't clear the interval
      // if (!pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
    }
  }, [activeProcessingJobs])

  // Cleanup on unmount - only clear if crawl is NOT running (to persist background crawls)
  useEffect(() => {
    return () => {
      if (!crawlSession.isRunning) {
        console.log('[CLEANUP] Component unmounting and crawl is not running, clearing crawl intervals')
        if (crawlIntervalRef.current) {
          clearInterval(crawlIntervalRef.current)
        }
        if (crawlTimeoutRef.current) {
          clearTimeout(crawlTimeoutRef.current)
        }
      } else {
        console.log('[CLEANUP] Component unmounting but crawl is RUNNING - keeping intervals active in background')
      }
      // NOTE: pollingIntervalRef is NOT cleared - let polling continue in background
    }
  }, [crawlSession.isRunning])

  const toggleResultSelection = useCallback((index: number) => {
    setSelectedResults(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }, [])

  const selectAllResults = useCallback(() => {
    if (selectedResults.size === testResults.searchResults.length) {
      setSelectedResults(new Set())
    } else {
      setSelectedResults(new Set(testResults.searchResults.map((_, i) => i)))
    }
  }, [testResults.searchResults, selectedResults.size])

  const extractAndSendToMediaExtractor = useCallback(async () => {
    if (selectedResults.size === 0) {
      toast.error('Please select at least one result')
      return
    }

    setExtractionJob({ status: 'extracting', extractedCount: 0 })

    try {
      // Extract URLs from selected results
      const selectedData = Array.from(selectedResults)
        .map(idx => testResults.searchResults[idx])
        .filter(result => result.magnetUrl)

      if (selectedData.length === 0) {
        toast.error('No extractable links found in selected results')
        setExtractionJob({ status: 'idle', extractedCount: 0 })
        return
      }

      const urls = selectedData.map(result => result.magnetUrl || '').filter(url => url)

      if (urls.length === 0) {
        toast.error('No valid magnet URLs found in selected results')
        setExtractionJob({ status: 'idle', extractedCount: 0 })
        return
      }

      console.log('Sending URLs to backend:', urls)
      console.log('Backend URL:', BACKEND_URL)

      // Send to media extractor
      const response = await fetch(`${BACKEND_URL}/api/media/process-and-classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ urls })
      })

      console.log('Response status:', response.status)
      console.log('Response headers:', {
        'content-type': response.headers.get('content-type'),
        'access-control-allow-origin': response.headers.get('access-control-allow-origin')
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', errorText)
        throw new Error(`Backend returned ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      console.log('Backend response:', data)

      setExtractionJob({
        status: 'complete',
        jobId: data.id,
        extractedCount: selectedData.length,
        message: `Successfully sent ${selectedData.length} link(s) to media extractor (Job ID: ${data.id})`
      })
      // Save job ID to localStorage for MediaProcessingPanel to access
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastIndexerJobId', data.id)
      }
      toast.success(`Sent ${selectedData.length} link(s) to media extractor!`)
      setSelectedResults(new Set())

      // Reset after 3 seconds
      setTimeout(() => {
        setExtractionJob({ status: 'idle', extractedCount: 0 })
      }, 3000)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('Extraction error:', error)
      setExtractionJob({ status: 'idle', extractedCount: 0 })
      
      // Provide more helpful error message
      let userMessage = message
      if (message.includes('Failed to fetch')) {
        userMessage = 'Cannot connect to backend. Make sure the backend server is running on port 3002'
      }
      
      toast.error(`Extraction failed: ${userMessage}`)
    }
  }, [selectedResults, testResults.searchResults])

  // Only load indexers once on component mount
  useEffect(() => {
    if (testResults.indexers.length === 0) {
      console.log('[DEBUG-INIT] Initial load: fetching indexers')
      testConnection()
    }

    // Check if crawl was persisted from before unmounting/closing browser
    const persistedCrawlState = localStorage.getItem('activeCrawlState')
    if (persistedCrawlState) {
      try {
        const state = JSON.parse(persistedCrawlState)
        console.log('[DEBUG-INIT] Restoring persisted crawl state:', state)
        
        if (state.isRunning) {
          // Restore the crawl
          console.log('[DEBUG-INIT] Resuming background crawl with query:', state.query)
          setCrawlSession(state)
          
          // Restore search mode, category, and query
          setSearchMode(state.searchMode)
          if (state.selectedCategory) {
            setSelectedCategory(state.selectedCategory)
          }
          if (state.searchMode === 'genre') {
            setSelectedGenre(state.selectedGenre)
          } else {
            setCustomQuery(state.customQuery)
          }
          if (state.selectedContentType) {
            setSelectedContentType(state.selectedContentType)
          }

          // Restart the crawl interval
          const performCrawlSearch = async () => {
            const rawBaseQuery = state.searchMode === 'genre' ? state.selectedGenre : state.customQuery
            const baseQuery = rawBaseQuery === 'All' ? '' : rawBaseQuery
            const categoryTerm = state.selectedCategory && state.selectedCategory !== 'All' ? state.selectedCategory : ''
            const contentTypeTerm = state.selectedContentType && state.selectedContentType !== 'All' ? state.selectedContentType : ''
            const query = [categoryTerm, baseQuery, contentTypeTerm].filter(Boolean).join(' ').trim()
            console.log('[BACKGROUND-CRAWL] Executing background search:', query)
            
            try {
              const response = await fetch(
                `${PROWLARR_PROXY_URL}/api/v1/search?query=${encodeURIComponent(query)}&type=search`,
                {
                  headers: { 'Accept': 'application/json' },
                }
              )

              if (response.ok) {
                const results = await response.json()
                if (Array.isArray(results) && results.length > 0) {
                  const searchResults = results.map((r: any) => ({
                    title: r.title || 'Unknown',
                    size: r.size || 0,
                    seeders: r.seeders || 0,
                    leechers: r.leechers || r.peers || 0,
                    indexer: r.indexer || 'Unknown',
                    publishDate: r.publishDate,
                    magnetUrl: r.magnetUrl || r.downloadUrl,
                  }))
                  console.log('[BACKGROUND-CRAWL] Found', searchResults.length, 'results')
                }
              }
            } catch (error) {
              console.error('[BACKGROUND-CRAWL] Error:', error)
            }
          }

          crawlIntervalRef.current = setInterval(performCrawlSearch, 30000)
          console.log('[DEBUG-INIT] Background crawl interval restored')
        }
      } catch (error) {
        console.error('[DEBUG-INIT] Failed to restore crawl state:', error)
        localStorage.removeItem('activeCrawlState')
      }
    }
  }, []) // Empty dependency array - run once on mount only

  // Load storage on mount and refresh stats
  useEffect(() => {
    const loadStorage = () => {
      const items = getAllStoredItems()
      const stats = getStorageStats()
      setStoredItems(items)
      setStorageStats(stats)
    }
    
    loadStorage()
    // Refresh storage every 5 seconds to show updates
    const interval = setInterval(loadStorage, 5000)
    return () => clearInterval(interval)
  }, [])

  // Track tab visibility and show background widget when user leaves
  // Use ref to track current state values without recreating listeners
  const stateRef = useRef({ totalFilesRetrieved, aggregatedResults, storageStats })
  
  useEffect(() => {
    stateRef.current = { totalFilesRetrieved, aggregatedResults, storageStats }
  }, [totalFilesRetrieved, aggregatedResults, storageStats])

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden
      setIsTabVisible(isVisible)
      console.log('[WIDGET] Visibility change - isVisible:', isVisible, '| totalFiles:', stateRef.current.totalFilesRetrieved, '| aggregated:', stateRef.current.aggregatedResults.length, '| stored:', stateRef.current.storageStats.totalItems)
      // Show widget when user leaves tab
      if (!isVisible && (stateRef.current.totalFilesRetrieved > 0 || stateRef.current.aggregatedResults.length > 0 || stateRef.current.storageStats.totalItems > 0)) {
        console.log('[WIDGET] TRIGGERING WIDGET ON VISIBILITY CHANGE')
        setShowBackgroundWidget(true)
      }
    }

    const handleFocus = () => {
      console.log('[WIDGET] Window focus')
      setIsTabVisible(true)
      // Optionally hide widget when user returns
      setShowBackgroundWidget(false)
    }

    const handleBlur = () => {
      console.log('[WIDGET] Window blur')
      setIsTabVisible(false)
      // Show widget when window loses focus
      if (stateRef.current.totalFilesRetrieved > 0 || stateRef.current.aggregatedResults.length > 0 || stateRef.current.storageStats.totalItems > 0) {
        console.log('[WIDGET] TRIGGERING WIDGET ON BLUR')
        setShowBackgroundWidget(true)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  // Handle widget dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingWidget) return
      
      setWidgetPosition(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }))
    }

    const handleMouseUp = () => {
      setIsDraggingWidget(false)
    }

    if (isDraggingWidget) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDraggingWidget])

  const enabledCount = testResults.indexers.filter(i => i.enable).length
  const disabledCount = testResults.indexers.length - enabledCount

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
  }

  const statusColor = {
    idle: 'text-gray-500',
    testing: 'text-blue-500',
    searching: 'text-purple-500',
    complete: 'text-green-500',
    error: 'text-red-500',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Broadcast className="w-6 h-6" />
            Prowlarr Indexers
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Monitor and test torrent indexers
          </p>
        </div>
        <Button
          onClick={testConnection}
          disabled={isLoading}
          className="gap-2"
          variant="outline"
        >
          <Pulse className="w-4 h-4" />
          {isLoading ? 'Testing...' : 'Refresh'}
        </Button>
      </div>

      <Separator />

      {/* Status Card */}
      <Card className="p-4 border border-blue-500/20 bg-blue-500/5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${testResults.status === 'error' ? 'bg-red-500' : 'bg-green-500'}`} />
              <span className="font-medium">
                {testResults.status === 'error' ? 'Offline' : 'Online'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Enabled Indexers</span>
              <div className="font-semibold text-green-500 mt-1">{enabledCount}</div>
            </div>
            <div>
              <span className="text-gray-500">Disabled Indexers</span>
              <div className="font-semibold text-orange-500 mt-1">{disabledCount}</div>
            </div>
            <div>
              <span className="text-gray-500">Total Active</span>
              <div className="font-semibold text-blue-500 mt-1">{testResults.indexers.length}</div>
            </div>
            <div>
              <span className="text-gray-500">Available Providers</span>
              <div className="font-semibold text-amber-500 mt-1">{testResults.availableProviders.length}</div>
            </div>
          </div>
        </div>
      </Card>

      {testResults.error && (
        <Alert className="border-red-500/50 bg-red-500/5">
          <WarningCircle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-red-500">
            {testResults.error}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="indexers" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="indexers">
            <Database className="w-4 h-4 mr-2" />
            Active
          </TabsTrigger>
          <TabsTrigger value="crawl">
            <Pulse className="w-4 h-4 mr-2" />
            Crawl Mode
            {aggregatedResults.length > 0 && (
              <Badge className="ml-2 bg-purple-600">{aggregatedResults.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="vault">
            <Database className="w-4 h-4 mr-2" />
            Vault
            {storageStats.totalItems > 0 && (
              <Badge className="ml-2 bg-green-600">{storageStats.totalItems}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="test-media">
            <Television className="w-4 h-4 mr-2" />
            Test Media
          </TabsTrigger>
        </TabsList>

        {/* Indexers Tab */}
        <TabsContent value="indexers" className="space-y-4">
          {testResults.indexers.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <p className="text-gray-500">
                {testResults.status === 'testing' ? 'Loading indexers...' : 'No indexers found'}
              </p>
            </Card>
          ) : (
            <ScrollArea className="h-96 border rounded-lg">
              <div className="space-y-2 p-4">
                {testResults.indexers.map((indexer) => (
                  <motion.div
                    key={indexer.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-700 hover:border-blue-500/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {indexer.enable ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <WarningCircle className="w-5 h-5 text-orange-500" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{indexer.name}</div>
                        <div className="text-xs text-gray-500">{indexer.language}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={indexer.privacy === 'Private' ? 'destructive' : 'secondary'}>
                        {indexer.privacy}
                      </Badge>
                      <Badge variant={indexer.enable ? 'default' : 'outline'}>
                        {indexer.enable ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>


        {/* Continuous Crawl Tab */}
        <TabsContent value="crawl" className="space-y-3 overflow-y-auto max-h-[calc(100vh-300px)]">
          {/* Crawl Controls */}
          <Card className="p-3">
            <div className="space-y-2">
              <label className="block text-xs font-medium uppercase tracking-wide">Crawl Settings</label>
              
              {/* Search Mode Toggle */}
              <div className="flex gap-2">
                <Button
                  onClick={() => setSearchMode('genre')}
                  variant={searchMode === 'genre' ? 'default' : 'outline'}
                  className="flex-1"
                  size="sm"
                >
                  By Genre
                </Button>
                <Button
                  onClick={() => setSearchMode('custom')}
                  variant={searchMode === 'custom' ? 'default' : 'outline'}
                  className="flex-1"
                  size="sm"
                >
                  Custom Search
                </Button>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  disabled={crawlSession.isRunning}
                  className="w-full px-2 py-1 text-sm rounded-md border border-gray-700 bg-gray-900 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-[200px] overflow-y-auto"
                >
                  {SEARCH_CATEGORIES.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium">Content Type</label>
                <select
                  value={selectedContentType}
                  onChange={(e) => setSelectedContentType(e.target.value)}
                  disabled={crawlSession.isRunning}
                  className="w-full px-2 py-1 text-sm rounded-md border border-gray-700 bg-gray-900 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CONTENT_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                {searchMode === 'genre' ? (
                  <div className="space-y-1">
                    <label className="block text-xs font-medium">Genre</label>
                    <select
                      value={selectedGenre}
                      onChange={(e) => setSelectedGenre(e.target.value)}
                      disabled={crawlSession.isRunning}
                      className="w-full px-2 py-1 text-sm rounded-md border border-gray-700 bg-gray-900 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-[300px] overflow-y-auto"
                    >
                      {GENRES.map(genre => (
                        <option key={genre} value={genre}>
                          {genre}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="block text-xs font-medium">Search Query</label>
                    <Input
                      placeholder="e.g., Inception, Breaking Bad..."
                      value={customQuery}
                      onChange={(e) => setCustomQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && startContinuousCrawl()}
                      disabled={crawlSession.isRunning}
                      className="text-xs h-8"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={startContinuousCrawl}
                  disabled={crawlSession.isRunning}
                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Pulse className="w-4 h-4" />
                  {crawlSession.isRunning ? 'Crawling...' : 'Start Crawl'}
                </Button>
                <Button
                  onClick={stopContinuousCrawl}
                  disabled={!crawlSession.isRunning}
                  variant="outline"
                  className="flex-1 gap-2"
                >
                  Stop Crawl
                </Button>
                <Button
                  onClick={clearAllJobs}
                  disabled={activeProcessingJobs.length === 0 && aggregatedResults.length === 0}
                  variant="destructive"
                  className="flex-1 gap-2"
                >
                  🗑️ Clear All
                </Button>
              </div>

              {/* Auto-Processing Controls */}
              <div className="border-t pt-3 mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Auto-Process Results</label>
                  <Button
                    onClick={() => setAutoProcess(!autoProcess)}
                    variant={autoProcess ? 'default' : 'outline'}
                    size="sm"
                    className="gap-2"
                  >
                    {autoProcess ? '[ON]' : '[OFF]'} Auto-Process
                  </Button>
                </div>
                
                {autoProcess && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-400 flex-1">Process after collecting:</label>
                      <select
                        value={autoProcessThreshold}
                        onChange={(e) => setAutoProcessThreshold(parseInt(e.target.value))}
                        className="bg-gray-800 text-white text-xs rounded px-2 py-1"
                      >
                        <option value={5}>5 results</option>
                        <option value={10}>10 results</option>
                        <option value={20}>20 results</option>
                        <option value={30}>30 results</option>
                        <option value={50}>50 results</option>
                      </select>
                    </div>
                    <p className="text-xs text-gray-500">Also processes when crawl is stopped with results</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Crawl Stats */}
          {crawlSession.isRunning && (
            <Card className="p-4 border-blue-500/30 bg-blue-500/10">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-400">{crawlSession.searchCount}</p>
                  <p className="text-xs text-gray-500">Searches</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-400">{aggregatedResults.length}</p>
                  <p className="text-xs text-gray-500">Current Results</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-400">{totalFilesRetrieved}</p>
                  <p className="text-xs text-gray-500">Total Retrieved</p>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${crawlSession.isCrawling ? 'text-cyan-400 animate-pulse' : 'text-gray-400'}`}>
                    {crawlSession.isCrawling ? '[...]' : '[OK]'}
                  </p>
                  <p className="text-xs text-gray-500">{crawlSession.isCrawling ? 'Searching' : 'Ready'}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Parallel Processing Jobs */}
          {activeProcessingJobs.length > 0 && (
            <Card className="p-4 border-orange-500/30 bg-orange-500/10">
              <p className="text-sm font-semibold text-orange-400 mb-3">Parallel Processing ({activeProcessingJobs.length}/{MAX_PARALLEL_JOBS})</p>
              <div className="space-y-2">
                {activeProcessingJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between text-sm border border-orange-500/20 rounded p-2 bg-black/30">
                    <div className="flex-1">
                      <p className="text-gray-300">{job.resultCount} results</p>
                      <p className={`text-xs ${job.status === 'complete' ? 'text-green-400' : job.status === 'failed' ? 'text-red-400' : 'text-cyan-400'}`}>
                        {job.progress}
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-mono ${job.status === 'complete' ? 'bg-green-500/20 text-green-400' : job.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                      {job.status === 'processing' ? '⏳' : job.status === 'complete' ? '✅' : '❌'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Aggregated Results List */}
          {aggregatedResults.length > 0 ? (
            <>
              <Card className={`p-4 border ${autoProcess && aggregatedResults.length >= autoProcessThreshold ? 'border-green-500/50 bg-green-500/10' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-semibold ${autoProcess && aggregatedResults.length >= autoProcessThreshold ? 'text-green-400' : 'text-yellow-400'}`}>
                      {aggregatedResults.length} Results Collected
                      {autoProcess && aggregatedResults.length >= autoProcessThreshold && ' [AUTO-PROCESSING]'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {Math.max(...aggregatedResults.map(r => r.seeders), 0)} max seeders
                      {autoProcess && ` | Auto-process at ${autoProcessThreshold} results`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={saveAndClearAggregated}
                      disabled={crawlSession.isCrawling || activeProcessingJobs.length >= MAX_PARALLEL_JOBS}
                      className={`gap-2 ${activeProcessingJobs.length > 0 ? 'bg-orange-600' : 'bg-purple-600 hover:bg-purple-700'}`}
                    >
                      <CaretRight className="w-4 h-4" />
                      {activeProcessingJobs.length > 0 ? `Processing (${activeProcessingJobs.length}/${MAX_PARALLEL_JOBS})` : 'Save & Process'}
                    </Button>
                    <Button
                      onClick={() => setAggregatedResults([])}
                      variant="outline"
                      size="sm"
                      className="gap-1"
                    >
                      🗑️ Clear
                    </Button>
                  </div>
                </div>
              </Card>

              <ScrollArea className="h-96 border rounded-lg">
                <div className="space-y-2 p-4">
                  {aggregatedResults.map((result, idx) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-3 rounded-lg border border-gray-700 hover:border-purple-500/50 transition-colors bg-gray-900/50"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium line-clamp-2 text-sm">{result.title}</h4>
                          <p className="text-xs text-gray-500 mt-1">{result.indexer}</p>
                        </div>
                        <Badge className="ml-2" variant="secondary">
                          {formatBytes(result.size)}
                        </Badge>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          {result.seeders} seeders
                        </span>
                        <span className="flex items-center gap-1">
                          <WarningCircle className="w-3 h-3 text-orange-500" />
                          {result.leechers} leechers
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : (
            <Card className="p-8 text-center border-dashed">
              <p className="text-gray-500">
                {crawlSession.isRunning 
                  ? `Crawling... ${activeProcessingJobs.length > 0 ? `[Processing (${activeProcessingJobs.length}/${MAX_PARALLEL_JOBS} jobs)]` : 'Results will appear here before processing'}` 
                  : totalFilesRetrieved > 0
                  ? `Session complete: Retrieved ${totalFilesRetrieved} total files (all have been processed to Vault)`
                  : 'Start a continuous crawl to begin collecting results'}
              </p>
            </Card>
          )}
        </TabsContent>

        {/* Storage Vault Tab */}
        <TabsContent value="vault" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Media Vault</h3>
            <Button
              onClick={() => {
                const items = getAllStoredItems()
                const stats = getStorageStats()
                setStoredItems(items)
                setStorageStats(stats)
                console.log('[VAULT] Manual refresh triggered. Items:', items.length)
                toast.info(`Vault refreshed: ${items.length} items found`)
              }}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Pulse className="w-4 h-4" />
              Refresh
            </Button>
          </div>

          {/* Vault Stats */}
          <Card className="p-4 border border-green-500/20 bg-green-500/5">
            <div className="grid grid-cols-5 gap-3">
              <div>
                <p className="text-xs text-gray-500">Total Items</p>
                <p className="text-2xl font-bold text-green-500 mt-1">{storageStats.totalItems}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Movies</p>
                <p className="text-2xl font-bold text-blue-500 mt-1">{storageStats.movies}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Series</p>
                <p className="text-2xl font-bold text-purple-500 mt-1">{storageStats.series}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Live TV</p>
                <p className="text-2xl font-bold text-orange-500 mt-1">{storageStats.liveTV}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Indexers</p>
                <p className="text-2xl font-bold text-cyan-500 mt-1">{storageStats.totalIndexers.size}</p>
              </div>
            </div>
          </Card>

          {/* Vault Controls */}
          <Card className="p-4 border border-gray-700">
            <div className="space-y-3">
              {/* Playlist Format Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400">Download Format</label>
                <div className="grid grid-cols-5 gap-2">
                  {(['m3u8', 'm3u', 'txt', 'json', 'xml'] as const).map(format => (
                    <Button
                      key={format}
                      onClick={() => setPlaylistFormat(format)}
                      variant={playlistFormat === format ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs"
                    >
                      {format.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Category Download Buttons */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400">Download Lists</label>
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    onClick={() => {
                      if (storageStats.movies > 0) {
                        const filtered = storedItems.filter(item => item.contentType === 'movie')
                        const content = generatePlaylist(filtered, playlistFormat as any, 'movie')
                        const element = document.createElement('a')
                        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content))
                        element.setAttribute('download', `movies-${Date.now()}.${playlistFormat}`)
                        element.style.display = 'none'
                        document.body.appendChild(element)
                        element.click()
                        document.body.removeChild(element)
                        toast.success(`Movies list downloaded (${playlistFormat})`)
                      } else {
                        toast.error('No movies in vault')
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1"
                  >
                    <DownloadIcon className="w-3 h-3" />
                    🎬 Movies
                  </Button>
                  <Button
                    onClick={() => {
                      if (storageStats.series > 0) {
                        const filtered = storedItems.filter(item => item.contentType === 'series')
                        const content = generatePlaylist(filtered, playlistFormat as any, 'series')
                        const element = document.createElement('a')
                        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content))
                        element.setAttribute('download', `series-${Date.now()}.${playlistFormat}`)
                        element.style.display = 'none'
                        document.body.appendChild(element)
                        element.click()
                        document.body.removeChild(element)
                        toast.success(`Series list downloaded (${playlistFormat})`)
                      } else {
                        toast.error('No series in vault')
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1"
                  >
                    <DownloadIcon className="w-3 h-3" />
                    📺 Series
                  </Button>
                  <Button
                    onClick={() => {
                      if (storageStats.liveTV > 0) {
                        const filtered = storedItems.filter(item => item.contentType === 'live-tv')
                        const content = generatePlaylist(filtered, playlistFormat as any, 'live-tv')
                        const element = document.createElement('a')
                        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content))
                        element.setAttribute('download', `live-tv-${Date.now()}.${playlistFormat}`)
                        element.style.display = 'none'
                        document.body.appendChild(element)
                        element.click()
                        document.body.removeChild(element)
                        toast.success(`Live TV list downloaded (${playlistFormat})`)
                      } else {
                        toast.error('No live TV in vault')
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1"
                  >
                    <DownloadIcon className="w-3 h-3" />
                    📡 Live TV
                  </Button>
                  <Button
                    onClick={() => {
                      const extraItems = storedItems.filter(item => item.contentType && !['movie', 'series', 'live-tv'].includes(item.contentType))
                      if (extraItems.length > 0) {
                        const content = generatePlaylist(extraItems, playlistFormat as any, 'all')
                        const element = document.createElement('a')
                        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content))
                        element.setAttribute('download', `extra-content-${Date.now()}.${playlistFormat}`)
                        element.style.display = 'none'
                        document.body.appendChild(element)
                        element.click()
                        document.body.removeChild(element)
                        toast.success(`Extra content list downloaded (${playlistFormat})`)
                      } else {
                        toast.error('No extra content in vault')
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1"
                  >
                    <DownloadIcon className="w-3 h-3" />
                    🎁 Extra Content
                  </Button>
                </div>
              </div>

              {/* Backup Controls */}
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const json = exportStoredItems()
                    const element = document.createElement('a')
                    element.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(json))
                    element.setAttribute('download', `vault-backup-${Date.now()}.json`)
                    element.style.display = 'none'
                    document.body.appendChild(element)
                    element.click()
                    document.body.removeChild(element)
                    toast.success('Vault backed up')
                  }}
                  className="flex-1 gap-2"
                  variant="outline"
                  size="sm"
                >
                  <DownloadIcon className="w-4 h-4" />
                  Backup
                </Button>
                <Button
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = '.json'
                    input.addEventListener('change', (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          const result = importStoredItems(event.target?.result as string)
                          if (result.success) {
                            toast.success(result.message)
                            // Refresh storage
                            const items = getAllStoredItems()
                            const stats = getStorageStats()
                            setStoredItems(items)
                            setStorageStats(stats)
                          } else {
                            toast.error(result.message)
                          }
                        }
                        reader.readAsText(file)
                      }
                    })
                    input.click()
                  }}
                  className="flex-1 gap-2"
                  variant="outline"
                  size="sm"
                >
                  <Upload className="w-4 h-4" />
                  Restore
                </Button>
              </div>

              {/* Content Type Filter */}
              <div className="flex gap-2">
                {(['all', 'movie', 'series', 'live-tv'] as const).map(type => (
                  <Button
                    key={type}
                    onClick={() => setStorageFilter(type)}
                    variant={storageFilter === type ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 text-xs"
                  >
                    {type === 'all' && 'All'}
                    {type === 'movie' && `🎬 (${storageStats.movies})`}
                    {type === 'series' && `📺 (${storageStats.series})`}
                    {type === 'live-tv' && `📡 (${storageStats.liveTV})`}
                  </Button>
                ))}
              </div>

              {/* Clear Vault */}
              <Button
                onClick={() => {
                  if (window.confirm('Are you sure? This will delete ALL stored items.')) {
                    clearAllStoredItems()
                    setStoredItems([])
                    setStorageStats({
                      totalItems: 0,
                      movies: 0,
                      series: 0,
                      liveTV: 0,
                      totalIndexers: new Set(),
                      oldestItem: 0,
                      newestItem: 0,
                    })
                    toast.success('Vault cleared')
                  }
                }}
                variant="destructive"
                size="sm"
                className="w-full gap-2"
              >
                <Trash className="w-4 h-4" />
                Clear Vault
              </Button>
            </div>
          </Card>

          {/* Vault Items List */}
          {storedItems.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <p className="text-gray-500">No items in vault yet. Process results from the crawl!</p>
            </Card>
          ) : (
            <ScrollArea className="h-96 border rounded-lg">
              <div className="space-y-2 p-4">
                {getStoredItemsByType(storageFilter).map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 rounded-lg border border-gray-700 hover:border-green-500/50 transition-colors bg-gray-900/50"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium line-clamp-2 text-sm flex-1">{item.title}</h4>
                          <Badge variant="outline" className="text-xs ml-auto">
                            {item.contentType === 'movie' && '🎬'}
                            {item.contentType === 'series' && '📺'}
                            {item.contentType === 'live-tv' && '📡'}
                            {item.contentType}
                          </Badge>
                        </div>
                        <div className="flex gap-2 mt-1 text-xs text-gray-500">
                          <span>{item.indexer}</span>
                          <span>•</span>
                          <span>
                            {new Date(item.processedAt).toLocaleDateString()} {new Date(item.processedAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 text-xs text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        💾 {formatBytes(item.size)}
                      </span>
                      <span className="flex items-center gap-1">
                        ⬆️ {item.seeders}
                      </span>
                      <span className="flex items-center gap-1">
                        ⬇️ {item.leechers}
                      </span>
                      {item.confidence && (
                        <span className="flex items-center gap-1">
                          ✨ {item.confidence}
                        </span>
                      )}
                    </div>

                    <Button
                      onClick={() => {
                        removeStoredItem(item.url)
                        const items = getAllStoredItems()
                        const stats = getStorageStats()
                        setStoredItems(items)
                        setStorageStats(stats)
                        toast.success('Item removed from vault')
                      }}
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600 p-0 h-auto"
                    >
                      <Trash className="w-4 h-4" /> Remove
                    </Button>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Test Media Tab */}
        <TabsContent value="test-media" className="space-y-4">
          <div className="text-sm text-gray-400 text-center py-8">
            Use the SILAS Media Dashboard for media playback.
          </div>
        </TabsContent>
      </Tabs>

      {/* Background Widget - appears when user leaves tab */}
      <AnimatePresence>
        {showBackgroundWidget && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
            style={{
              position: 'fixed',
              left: `${widgetPosition.x}px`,
              top: `${widgetPosition.y}px`,
              right: 'auto',
              bottom: 'auto',
            }}
            className="z-9999 backdrop-blur-md bg-slate-900/95 border border-slate-700/50 rounded-xl p-6 shadow-2xl max-w-sm"
          >
            <div className="space-y-4">
              {/* Header - Draggable */}
              <div 
                className="flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
                onMouseDown={() => setIsDraggingWidget(true)}
              >
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Session Stats</h3>
                <button
                  onClick={() => setShowBackgroundWidget(false)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-auto"
                >
                  ✕
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                {/* Links Found */}
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                    <p className="text-xs text-gray-400 font-medium">Found</p>
                  </div>
                  <p className="text-2xl font-bold text-cyan-400">{totalFilesRetrieved + aggregatedResults.length}</p>
                  <p className="text-xs text-gray-500 mt-1">links found</p>
                </div>

                {/* Links Processing */}
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
                    <p className="text-xs text-gray-400 font-medium">Processing</p>
                  </div>
                  <p className="text-2xl font-bold text-yellow-400">{activeProcessingJobs.filter(j => j.status === 'processing').length}</p>
                  <p className="text-xs text-gray-500 mt-1">being processed</p>
                </div>

                {/* Links Secured */}
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                    <p className="text-xs text-gray-400 font-medium">Secured</p>
                  </div>
                  <p className="text-2xl font-bold text-green-400">{storageStats.totalItems}</p>
                  <p className="text-xs text-gray-500 mt-1">in vault</p>
                </div>
              </div>

              {/* Status Message */}
              <div className="pt-2 border-t border-slate-700/30">
                <p className="text-xs text-gray-400">
                  🔄 Indexers running in background. Get {totalFilesRetrieved + aggregatedResults.length > 0 ? 'more' : 'your'} results processing while you work elsewhere.
                </p>
              </div>

              {/* Return Button */}
              <button
                onClick={() => setShowBackgroundWidget(false)}
                className="w-full py-2 px-3 bg-slate-700/50 hover:bg-slate-600/50 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Return to Indexers
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
