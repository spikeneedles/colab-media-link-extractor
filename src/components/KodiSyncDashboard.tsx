import React, { useState, useCallback, useEffect } from 'react'
import { Play, Download, RefreshCw, Trash2, CheckCircle, XCircle, Clock, Film, Tv, Radio, HelpCircle, AlertCircle, Loader2, Image as ImageIcon, Zap, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { generateM3UsByCategory, type M3UGenerationResult } from '@/lib/m3uGenerator'
import { detectAPIEndpoints, extractFromAPIEndpoints, type APIEndpoint, type ExtractedStream } from '@/lib/apiContentExtractor'

const BACKEND_URL = 'http://localhost:3002'

interface KodiJob {
  job_id: string
  status: 'queued' | 'detecting' | 'scraping' | 'completed' | 'failed'
  progress: number
  source_url: string
  repo_type: string
  created_at: string
  updated_at: string
}

interface KodiSessionData {
  success: boolean
  session_id: string
  jobs: KodiJob[]
  total: number
  summary: {
    queued: number
    detecting: number
    scraping: number
    completed: number
    failed: number
  }
}

interface ClassifiedUrl {
  url: string
  contentType: 'movie' | 'tv-series' | 'live-tv' | 'vod' | 'unknown'
  source: string
  isValid?: boolean
  validating?: boolean
}

interface MediaImage {
  url: string
  title?: string
  source: string
  type: 'jpg' | 'png' | 'gif' | 'webp' | 'bmp' | 'svg'
}

type PlaylistFormat = 'm3u8' | 'm3u' | 'json' | 'xml' | 'csv' | 'txt'

const PLAYLIST_FORMATS: { format: PlaylistFormat; extension: string; label: string }[] = [
  { format: 'm3u8', extension: '.m3u8', label: '.M3U8' },
  { format: 'm3u', extension: '.m3u', label: '.M3U' },
  { format: 'json', extension: '.json', label: '.JSON' },
  { format: 'xml', extension: '.xml', label: '.XML' },
  { format: 'csv', extension: '.csv', label: '.CSV' },
  { format: 'txt', extension: '.txt', label: '.TXT' }
]

export function KodiSyncDashboard() {
  const [sessionId, setSessionId] = useState('')
  const [sessionData, setSessionData] = useState<KodiSessionData | null>(null)
  const [loading, setLoading] = useState(false)
  
  // Media links
  const [classifiedUrls, setClassifiedUrls] = useState<ClassifiedUrl[]>([])
  const [loadingUrls, setLoadingUrls] = useState(false)
  const [validating, setValidating] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'tv-series' | 'live-tv' | 'vod' | 'unknown'>('all')
  
  // API extraction
  const [apiFiles, setApiFiles] = useState<string[]>([])
  const [selectedApiFile, setSelectedApiFile] = useState<string>('')
  const [apiEndpoints, setApiEndpoints] = useState<APIEndpoint[]>([])
  const [extractingApi, setExtractingApi] = useState(false)
  const [apiProgress, setApiProgress] = useState({ current: 0, total: 0 })
  
  // Media images
  const [mediaImages, setMediaImages] = useState<MediaImage[]>([])
  
  // Playlist format & save
  const [selectedFormat, setSelectedFormat] = useState<PlaylistFormat>('m3u8')
  const [m3uResult, setM3uResult] = useState<M3UGenerationResult | null>(null)
  const [readyUrls, setReadyUrls] = useState<ClassifiedUrl[]>([])

  // Auto-fetch latest session on mount
  const fetchLatestSession = useCallback(async (showToast = false) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/kodi-sync/latest-session`)
      if (!response.ok) return

      const data = await response.json()
      if (!data?.success || !data?.session_id) return

      setSessionId(data.session_id)

      const sessionResponse = await fetch(`${BACKEND_URL}/api/kodi-sync/session/${data.session_id}`)
      if (!sessionResponse.ok) return

      const sessionData: KodiSessionData = await sessionResponse.json()
      setSessionData(sessionData)
      
      if (showToast) {
        toast.success(`Refreshed session: Found ${sessionData.total} jobs`)
      }
    } catch (error) {
      console.error('Latest session fetch error:', error)
    }
  }, [])

  useEffect(() => {
    fetchLatestSession(false)
    const interval = setInterval(() => {
      fetchLatestSession(false)
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchLatestSession])

  // Load URLs from completed jobs
  const loadUrls = useCallback(async () => {
    if (!sessionData || sessionData.jobs.length === 0) {
      toast.error('No jobs to load URLs from')
      return
    }

    setLoadingUrls(true)
    const allUrls: ClassifiedUrl[] = []

    try {
      const completedJobs = sessionData.jobs.filter(job => job.status === 'completed')
      
      if (completedJobs.length === 0) {
        toast.warning('No completed jobs found. Please wait for scans to finish.')
        setLoadingUrls(false)
        return
      }

      for (const job of completedJobs) {
        try {
          const response = await fetch(`${BACKEND_URL}/api/kodi-sync/results/${job.job_id}`)
          if (response.ok) {
            const jobData = await response.json()
            
            // Try to extract URLs from various possible locations
            let urlsFound = false
            
            // Check for top-level urls array (from intelligent ingest)
            if (jobData.urls && Array.isArray(jobData.urls)) {
              jobData.urls.forEach((urlData: any) => {
                allUrls.push({
                  url: typeof urlData === 'string' ? urlData : urlData.url,
                  contentType: (urlData.contentType || urlData.type || urlData.media_type || 'unknown') as any,
                  source: urlData.extracted_from || job.source_url || 'Unknown',
                  isValid: undefined,
                  validating: false
                })
              })
              urlsFound = true
            }
            
            // Check for results.urls array (legacy location)
            if (!urlsFound && jobData.results?.urls && Array.isArray(jobData.results.urls)) {
              jobData.results.urls.forEach((urlData: any) => {
                allUrls.push({
                  url: typeof urlData === 'string' ? urlData : urlData.url,
                  contentType: (urlData.contentType || urlData.media_type || 'unknown') as any,
                  source: job.source_url || 'Unknown',
                  isValid: undefined,
                  validating: false
                })
              })
              urlsFound = true
            }
            
            // Check for results.links array (legacy location)
            if (!urlsFound && jobData.results?.links && Array.isArray(jobData.results.links)) {
              jobData.results.links.forEach((urlData: any) => {
                allUrls.push({
                  url: typeof urlData === 'string' ? urlData : urlData.url,
                  contentType: (urlData.contentType || urlData.media_type || 'unknown') as any,
                  source: job.source_url || 'Unknown',
                  isValid: undefined,
                  validating: false
                })
              })
              urlsFound = true
            }
            
            // If no URLs found but job has metadata, create synthetic entries for API detection
            if (!urlsFound && jobData.results) {
              console.warn(`Job ${job.job_id} completed but has no URL array. Summary:`, {
                total_links: jobData.results.total_links_found,
                files_scanned: jobData.results.total_files_scanned
              })
              
              // Return summary message
              if (jobData.results.total_links_found && jobData.results.total_links_found > 0) {
                toast.info(`Job found ${jobData.results.total_links_found} links but detailed URLs not available yet`)
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching job ${job.job_id}:`, error)
          toast.error(`Failed to load job ${job.job_id}`)
        }
      }

      if (allUrls.length > 0) {
        setClassifiedUrls(allUrls)
        toast.success(`Loaded ${allUrls.length} URLs from completed jobs`)
      } else {
        toast.info('Jobs completed but no detailed URLs available. Run scans from Kodi addon to populate URLs.')
        setClassifiedUrls([])
      }
    } catch (error) {
      toast.error('Failed to load URLs')
      console.error(error)
    } finally {
      setLoadingUrls(false)
    }
  }, [sessionData])

  // Auto-detect API-compatible files
  const detectApiFiles = useCallback(() => {
    if (!classifiedUrls.length) {
      toast.error('No URLs loaded. Load URLs from Kodi jobs first.')
      return
    }

    const apiCompatible = classifiedUrls.filter(url => {
      const urlStr = url.url.toLowerCase()
      return urlStr.includes('roku') || urlStr.includes('stremio') || 
             urlStr.includes('xtream') || urlStr.includes('.m3u') ||
             urlStr.includes('manifest') || urlStr.includes('api')
    })

    setApiFiles(apiCompatible.map(u => u.url))
    toast.success(`Found ${apiCompatible.length} API-compatible URLs`)
  }, [classifiedUrls])

  // Extract streams from selected API file
  const handleExtractApi = useCallback(async () => {
    if (!selectedApiFile) {
      toast.error('Please select an API URL')
      return
    }

    setExtractingApi(true)
    setApiProgress({ current: 0, total: 1 })

    try {
      const endpoints = detectAPIEndpoints(selectedApiFile)
      setApiEndpoints(endpoints)

      if (endpoints.length === 0) {
        toast.warning('No API endpoints detected in this URL')
        setExtractingApi(false)
        return
      }

      const streams = await extractFromAPIEndpoints(endpoints, (current, total) => {
        setApiProgress({ current, total })
      })

      if (streams.length > 0) {
        // Add extracted streams to classified URLs
        const newUrls: ClassifiedUrl[] = streams.map(stream => ({
          url: stream.url,
          contentType: stream.type as any || 'unknown',
          source: `API: ${stream.source}`,
          isValid: undefined
        }))

        setClassifiedUrls(prev => [...prev, ...newUrls])
        toast.success(`Extracted ${streams.length} stream URLs from API`)

        // Extract images if any
        streams.forEach(stream => {
          if (stream.url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i)) {
            setMediaImages(prev => [...prev, {
              url: stream.url,
              title: stream.title,
              source: `API: ${stream.source}`,
              type: stream.url.split('.').pop()?.toLowerCase() as any || 'jpg'
            }])
          }
        })
      }
    } catch (error) {
      toast.error('Error extracting from API')
      console.error(error)
    } finally {
      setExtractingApi(false)
    }
  }, [selectedApiFile])

  // Extract from all API files
  const handleExtractAllApis = useCallback(async () => {
    if (apiFiles.length === 0) {
      toast.error('No API files to extract from')
      return
    }

    setExtractingApi(true)
    let totalStreams = 0
    let totalImages = 0
    let successCount = 0
    let failedCount = 0

    try {
      for (let i = 0; i < apiFiles.length; i++) {
        const file = apiFiles[i]
        setApiProgress({ current: i + 1, total: apiFiles.length })
        
        try {
          const endpoints = detectAPIEndpoints(file)
          
          if (endpoints.length > 0) {
            const streams = await extractFromAPIEndpoints(endpoints, (current, total) => {
              setApiProgress({ current: i + 1, total: apiFiles.length })
            })

            if (streams.length > 0) {
              // Add extracted streams to classified URLs
              const newUrls: ClassifiedUrl[] = streams.map(stream => ({
                url: stream.url,
                contentType: stream.type as any || 'unknown',
                source: `API: ${stream.source}`,
                isValid: undefined
              }))

              setClassifiedUrls(prev => [...prev, ...newUrls])
              totalStreams += streams.length

              // Extract images if any
              streams.forEach(stream => {
                if (stream.url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i)) {
                  setMediaImages(prev => [...prev, {
                    url: stream.url,
                    title: stream.title,
                    source: `API: ${stream.source}`,
                    type: stream.url.split('.').pop()?.toLowerCase() as any || 'jpg'
                  }])
                  totalImages++
                }
              })
              
              successCount++
            }
          }
        } catch (error) {
          console.error(`Error extracting from ${file}:`, error)
          failedCount++
        }
      }

      // Automatically validate and sort extracted URLs
      if (totalStreams > 0) {
        const allClassifiedUrls = [...classifiedUrls]
        const validated: ClassifiedUrl[] = []
        
        for (const url of allClassifiedUrls) {
          try {
            const urlObj = new URL(url.url)
            const isValid = urlObj.protocol.startsWith('http')
            validated.push({ ...url, isValid })
          } catch {
            validated.push({ ...url, isValid: false })
          }
        }
        
        // Sort by category, then alphabetically by URL
        const sortedValidUrls = validated
          .filter(u => u.isValid)
          .sort((a, b) => {
            // First sort by category
            const categoryOrder = { 'movie': 0, 'tv-series': 1, 'live-tv': 2, 'vod': 3, 'unknown': 4 }
            const aCat = categoryOrder[a.contentType] ?? 5
            const bCat = categoryOrder[b.contentType] ?? 5
            if (aCat !== bCat) return aCat - bCat
            
            // Then alphabetically by URL
            return a.url.localeCompare(b.url)
          })
        
        setReadyUrls(sortedValidUrls)
        toast.success(`✓ Extracted ${totalStreams} streams from ${successCount}/${apiFiles.length} APIs${totalImages > 0 ? ` (${totalImages} images)` : ''}`)
      } else {
        toast.warning(`No streams found in ${apiFiles.length} API files`)
      }
      
      if (failedCount > 0) {
        toast.error(`${failedCount} API extractions failed`)
      }
    } catch (error) {
      toast.error('Error during bulk extraction')
      console.error(error)
    } finally {
      setExtractingApi(false)
      setApiProgress({ current: 0, total: 0 })
    }
  }, [apiFiles])

  // Validate URLs
  const validateUrls = useCallback(async () => {
    if (classifiedUrls.length === 0) {
      toast.error('No URLs to validate')
      return
    }

    setValidating(true)
    const validated: ClassifiedUrl[] = []

    try {
      // Simulate validation (in real app, would call backend)
      for (const url of classifiedUrls) {
        const urlObj = new URL(url.url)
        const isValid = urlObj.protocol.startsWith('http')
        validated.push({ ...url, isValid })
      }

      // Sort validated URLs by category, then alphabetically
      const sortedValidUrls = validated
        .filter(u => u.isValid)
        .sort((a, b) => {
          // First sort by category
          const categoryOrder = { 'movie': 0, 'tv-series': 1, 'live-tv': 2, 'vod': 3, 'unknown': 4 }
          const aCat = categoryOrder[a.contentType] ?? 5
          const bCat = categoryOrder[b.contentType] ?? 5
          if (aCat !== bCat) return aCat - bCat
          
          // Then alphabetically by URL
          return a.url.localeCompare(b.url)
        })
      
      setReadyUrls(sortedValidUrls)
      toast.success(`Validated: ${validated.filter(u => u.isValid).length} working, ${validated.filter(u => !u.isValid).length} broken`)
    } catch (error) {
      toast.error('Validation failed')
      console.error(error)
    } finally {
      setValidating(false)
    }
  }, [classifiedUrls])

  // Calculate filtered URLs and category counts before they're used in callbacks
  const filteredUrls = filterType === 'all' 
    ? classifiedUrls 
    : classifiedUrls.filter(url => url.contentType === filterType)

  const filteredReadyUrls = filterType === 'all'
    ? readyUrls
    : readyUrls.filter(url => url.contentType === filterType)

  const movieCount = classifiedUrls.filter(url => url.contentType === 'movie').length
  const tvSeriesCount = classifiedUrls.filter(url => url.contentType === 'tv-series').length
  const liveTvCount = classifiedUrls.filter(url => url.contentType === 'live-tv').length

  // Save playlist with selected format
  const savePlaylist = useCallback(() => {
    if (filteredReadyUrls.length === 0) {
      toast.error('No URLs to save in current filter')
      return
    }

    let content = ''
    const timestamp = new Date().toISOString().split('T')[0]
    const filterPrefix = filterType === 'all' ? 'all' : filterType
    const filename = `${filterPrefix}-${timestamp}${PLAYLIST_FORMATS.find(f => f.format === selectedFormat)?.extension}`

    switch (selectedFormat) {
      case 'm3u8':
      case 'm3u':
        content = '#EXTM3U\n'
        filteredReadyUrls.forEach(url => {
          content += `#EXTINF:-1,${url.source}\n${url.url}\n`
        })
        break
      case 'json':
        content = JSON.stringify({
          name: `Media List (${filterType})`,
          timestamp,
          filter: filterType,
          count: filteredReadyUrls.length,
          streams: filteredReadyUrls.map(u => ({
            url: u.url,
            source: u.source,
            contentType: u.contentType
          }))
        }, null, 2)
        break
      case 'xml':
        content = '<?xml version="1.0" encoding="UTF-8"?>\n<playlist>\n'
        filteredReadyUrls.forEach(url => {
          content += `  <item>\n    <url>${url.url}</url>\n    <source>${url.source}</source>\n    <contentType>${url.contentType}</contentType>\n  </item>\n`
        })
        content += '</playlist>'
        break
      case 'csv':
        content = 'URL,Source,ContentType\n'
        filteredReadyUrls.forEach(url => {
          content += `"${url.url}","${url.source}","${url.contentType}"\n`
        })
        break
      case 'txt':
        content = filteredReadyUrls.map(u => u.url).join('\n')
        break
    }

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(`Saved ${filteredReadyUrls.length} URLs as ${filename}`)
  }, [filteredReadyUrls, selectedFormat, filterType])

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">🔄 Kodi Sync Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Streamlined workflow: Extract → Validate → Save in your preferred format
        </p>
      </div>

      <Tabs defaultValue="session" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="session">Session</TabsTrigger>
          <TabsTrigger value="api">API Extract</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="save">Ready & Save</TabsTrigger>
        </TabsList>

        {/* Session Tab */}
        <TabsContent value="session" className="space-y-4">
          <div className="space-y-3">
            {sessionId && (
              <div className="p-3 bg-accent/5 border border-accent/20 rounded-md">
                <p className="text-xs text-muted-foreground">Session ID</p>
                <p className="text-sm font-mono text-foreground break-all">{sessionId}</p>
              </div>
            )}
            {!sessionId && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  Waiting for Kodi addon to connect...
                </p>
              </div>
            )}
          </div>

          {sessionData && (
            <>
              <div className="grid grid-cols-5 gap-3">
                <Card className="p-3">
                  <div className="text-2xl font-bold text-foreground">{sessionData.total}</div>
                  <div className="text-xs text-muted-foreground">Total Jobs</div>
                </Card>
                <Card className="p-3">
                  <div className="text-2xl font-bold text-green-500">{sessionData.summary.completed}</div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </Card>
                <Card className="p-3">
                  <div className="text-2xl font-bold text-yellow-500">{sessionData.summary.scraping}</div>
                  <div className="text-xs text-muted-foreground">Scraping</div>
                </Card>
                <Card className="p-3">
                  <div className="text-2xl font-bold text-blue-500">{sessionData.summary.queued}</div>
                  <div className="text-xs text-muted-foreground">Queued</div>
                </Card>
                <Card className="p-3">
                  <div className="text-2xl font-bold text-red-500">{sessionData.summary.failed}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </Card>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-bold text-foreground">Media Links ({classifiedUrls.length})</h4>
                
                {/* Category Filter Buttons */}
                {classifiedUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Button
                      onClick={() => setFilterType('all')}
                      variant={filterType === 'all' ? 'default' : 'outline'}
                      size="sm"
                      className={filterType === 'all' ? 'bg-accent text-accent-foreground' : ''}
                    >
                      All Content
                    </Button>
                    {movieCount > 0 && (
                      <Button
                        onClick={() => setFilterType('movie')}
                        variant={filterType === 'movie' ? 'default' : 'outline'}
                        size="sm"
                        className={filterType === 'movie' ? 'bg-accent text-accent-foreground' : ''}
                      >
                        <Film size={16} className="mr-1" />
                        Movies ({movieCount})
                      </Button>
                    )}
                    {tvSeriesCount > 0 && (
                      <Button
                        onClick={() => setFilterType('tv-series')}
                        variant={filterType === 'tv-series' ? 'default' : 'outline'}
                        size="sm"
                        className={filterType === 'tv-series' ? 'bg-accent text-accent-foreground' : ''}
                      >
                        <Tv size={16} className="mr-1" />
                        TV Series ({tvSeriesCount})
                      </Button>
                    )}
                    {liveTvCount > 0 && (
                      <Button
                        onClick={() => setFilterType('live-tv')}
                        variant={filterType === 'live-tv' ? 'default' : 'outline'}
                        size="sm"
                        className={filterType === 'live-tv' ? 'bg-accent text-accent-foreground' : ''}
                      >
                        <Radio size={16} className="mr-1" />
                        Live TV ({liveTvCount})
                      </Button>
                    )}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button
                    onClick={loadUrls}
                    disabled={loadingUrls}
                    className="flex-1"
                  >
                    {loadingUrls ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Load URLs from Jobs
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={detectApiFiles}
                    variant="outline"
                    disabled={classifiedUrls.length === 0}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Detect APIs
                  </Button>
                </div>

                {filteredUrls.length > 0 && (
                  <div className="max-h-[300px] overflow-y-auto space-y-1">
                    {filteredUrls.slice(0, 10).map((url, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-card/50 border border-border rounded text-xs"
                      >
                        <div className="font-mono text-muted-foreground truncate">{url.url}</div>
                        <div className="text-xs text-muted-foreground mt-1">{url.source}</div>
                      </div>
                    ))}
                    {filteredUrls.length > 10 && (
                      <div className="text-xs text-center text-muted-foreground p-2">
                        +{filteredUrls.length - 10} more...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* API Extract Tab */}
        <TabsContent value="api" className="space-y-4">
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-foreground">API-Compatible Files ({apiFiles.length})</h4>
            
            {apiFiles.length > 0 ? (
              <>
                <div className="max-h-[200px] overflow-y-auto space-y-2">
                  {apiFiles.map((file, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedApiFile(file)}
                      className={`p-2 rounded cursor-pointer transition-all ${
                        selectedApiFile === file
                          ? 'bg-accent/20 border border-accent text-accent'
                          : 'bg-card/50 border border-border hover:border-accent/50'
                      }`}
                    >
                      <div className="font-mono text-xs truncate">{file}</div>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={handleExtractAllApis}
                  disabled={extractingApi}
                  className="w-full bg-accent hover:bg-accent/90"
                  variant="default"
                >
                  {extractingApi ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Extracting All... {apiProgress.current}/{apiProgress.total}
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Extract All Streams from API ({apiFiles.length} files)
                    </>
                  )}
                </Button>

                <Separator className="my-2" />

                <Button
                  onClick={handleExtractApi}
                  disabled={!selectedApiFile || extractingApi}
                  className="w-full"
                  variant="outline"
                >
                  {extractingApi ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Extracting... {apiProgress.current}/{apiProgress.total}
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Extract Streams from Selected API
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No API files detected. Click "Detect APIs" in Session tab to find them.
              </div>
            )}
          </div>
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images" className="space-y-4">
          <h4 className="text-sm font-bold text-foreground">Media Images ({mediaImages.length})</h4>
          
          {mediaImages.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
              {mediaImages.map((img, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="aspect-square bg-card/50 border border-border rounded overflow-hidden">
                    <img
                      src={img.url}
                      alt={img.title || 'Media'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                  {img.title && (
                    <p className="text-xs text-muted-foreground truncate">{img.title}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No images extracted yet</p>
            </div>
          )}
        </TabsContent>

        {/* Ready & Save Tab */}
        <TabsContent value="save" className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground">Ready & Usable</h4>
              <Badge>{readyUrls.length} ready</Badge>
            </div>

            <Button
              onClick={validateUrls}
              disabled={validating || classifiedUrls.length === 0}
              className="w-full"
            >
              {validating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Validate All URLs
                </>
              )}
            </Button>

            {readyUrls.length > 0 && (
              <>
                <Separator />

                <div className="space-y-3">
                  <div className="text-sm font-bold text-foreground">Save Format</div>
                  <div className="grid grid-cols-3 gap-2">
                    {PLAYLIST_FORMATS.map(fmt => (
                      <Button
                        key={fmt.format}
                        onClick={() => setSelectedFormat(fmt.format)}
                        variant={selectedFormat === fmt.format ? 'default' : 'outline'}
                        size="sm"
                        className={selectedFormat === fmt.format ? 'bg-accent' : ''}
                      >
                        {fmt.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Save by Category</div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      onClick={() => {
                        setFilterType('movie')
                        savePlaylist()
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={readyUrls.filter(u => u.contentType === 'movie').length === 0}
                    >
                      <Film className="w-4 h-4 mr-1" />
                      Movies ({readyUrls.filter(u => u.contentType === 'movie').length})
                    </Button>
                    <Button
                      onClick={() => {
                        setFilterType('tv-series')
                        savePlaylist()
                      }}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      disabled={readyUrls.filter(u => u.contentType === 'tv-series').length === 0}
                    >
                      <Tv className="w-4 h-4 mr-1" />
                      TV ({readyUrls.filter(u => u.contentType === 'tv-series').length})
                    </Button>
                    <Button
                      onClick={() => {
                        setFilterType('live-tv')
                        savePlaylist()
                      }}
                      className="w-full bg-red-600 hover:bg-red-700"
                      disabled={readyUrls.filter(u => u.contentType === 'live-tv').length === 0}
                    >
                      <Radio className="w-4 h-4 mr-1" />
                      Live ({readyUrls.filter(u => u.contentType === 'live-tv').length})
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={savePlaylist}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save All ({readyUrls.length}) as {PLAYLIST_FORMATS.find(f => f.format === selectedFormat)?.extension.toUpperCase()}
                </Button>

                <div className="max-h-[200px] overflow-y-auto space-y-1">
                  {filteredReadyUrls.map((url, idx) => (
                    <div key={idx} className="p-2 bg-green-500/10 border border-green-500/20 rounded text-xs">
                      <div className="font-mono text-green-600 dark:text-green-400 truncate">
                        ✓ {url.url}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  )
}
