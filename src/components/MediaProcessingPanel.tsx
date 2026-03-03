import React, { useState, useCallback, useEffect } from 'react'
import { Upload, Play, Download, RefreshCw, Trash2, CheckCircle, XCircle, Clock, Film, Tv, Radio, AlertCircle, Loader2, Copy, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

const BACKEND_URL = 'http://localhost:3002'

export interface EnrichedMedia {
  url: string
  title: string
  contentType: 'movie' | 'series' | 'live-tv' | 'extra-content'
  category?: string
  genre?: string[]
  description?: string
  logo?: string
  season?: number
  episode?: number
  releaseYear?: number
  duration?: number
  confidence: 'high' | 'medium' | 'low'
  source?: string
}

interface ProcessingJob {
  id: string
  status: 'pending' | 'processing' | 'extracting' | 'enriching' | 'classifying' | 'complete' | 'error'
  progress: number
  totalUrls: number
  processedUrls: number
  extractedCount: number
  counts: {
    movies: number
    series: number
    liveTV: number
    extraContent: number
  }
  error?: string
}

interface ProcessingResults {
  movies: EnrichedMedia[]
  series: EnrichedMedia[]
  liveTV: EnrichedMedia[]
  extraContent: EnrichedMedia[]
}

type ProcessingPhase = 'input' | 'processing' | 'ready'

interface MediaProcessingPanelProps {
  initialJobId?: string
}

export function MediaProcessingPanel({ initialJobId }: MediaProcessingPanelProps) {
  const [phase, setPhase] = useState<ProcessingPhase>('input')
  const [urlInput, setUrlInput] = useState('')
  
  // Get job ID from prop or localStorage
  const storedJobId = typeof window !== 'undefined' ? localStorage.getItem('lastIndexerJobId') : null
  const [jobId, setJobId] = useState(initialJobId || storedJobId || '')
  const [job, setJob] = useState<ProcessingJob | null>(null)
  const [results, setResults] = useState<ProcessingResults | null>(null)
  const [selectedContentType, setSelectedContentType] = useState<'all' | 'movie' | 'series' | 'live-tv' | 'extra-content'>('all')
  const [showUrls, setShowUrls] = useState(true)
  const [editingUrls, setEditingUrls] = useState(false)
  const [editedResults, setEditedResults] = useState<ProcessingResults | null>(null)
  
  const pollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  // Load results for provided job ID
  useEffect(() => {
    const idToLoad = initialJobId || storedJobId
    if (idToLoad && !results) {
      setJobId(idToLoad)
      setPhase('processing')
      const loadJobResults = async () => {
        try {
          const response = await fetch(`${BACKEND_URL}/api/media/process-and-classify/${idToLoad}/status`)
          if (response.ok) {
            const data = await response.json()
            setJob(data)
            
            if (data.status === 'complete') {
              const resultsResponse = await fetch(`${BACKEND_URL}/api/media/process-and-classify/${idToLoad}/results`)
              if (resultsResponse.ok) {
                const resultsData = await resultsResponse.json()
                const summary = resultsData.summary
                const processedResults: ProcessingResults = {
                  movies: (summary.movies?.items || []).map((item: any) => ({ ...item, contentType: 'movie' as const })),
                  series: (summary.series?.items || []).map((item: any) => ({ ...item, contentType: 'series' as const })),
                  liveTV: (summary.liveTV?.items || []).map((item: any) => ({ ...item, contentType: 'live-tv' as const })),
                  extraContent: (summary.extraContent?.items || []).map((item: any) => ({ ...item, contentType: 'extra-content' as const }))
                }
                setResults(processedResults)
                setPhase('ready')
              }
            }
          }
        } catch (error) {
          console.error('Failed to load job results:', error)
        }
      }
      loadJobResults()
    }
  }, [initialJobId, storedJobId])

  // Parse URLs from input
  const parseUrls = useCallback((text: string): string[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && (line.startsWith('http://') || line.startsWith('https://')))
  }, [])

  // Validate and start processing
  const handleStartProcessing = useCallback(async () => {
    const urls = parseUrls(urlInput)
    
    if (urls.length === 0) {
      toast.error('Please enter at least one valid URL')
      return
    }

    try {
      setPhase('processing')
      toast.info('Starting pipeline...')
      
      // Send URLs directly to processing - backend handles validation
      const response = await fetch(`${BACKEND_URL}/api/media/process-and-classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls })
      })

      if (!response.ok) {
        throw new Error('Failed to start processing')
      }

      const data = await response.json()
      setJobId(data.id)
      setJob({
        id: data.id,
        status: data.status,
        progress: data.progress,
        totalUrls: urls.length,
        processedUrls: 0,
        extractedCount: 0,
        counts: { movies: 0, series: 0, liveTV: 0, extraContent: 0 }
      })
      
      toast.success(`Processing ${urls.length} URLs...`)
    } catch (error) {
      toast.error('Failed to start processing: ' + (error instanceof Error ? error.message : 'Unknown error'))
      setPhase('input')
    }
  }, [urlInput, parseUrls])

  // Poll job status
  useEffect(() => {
    if (phase !== 'processing' || !jobId) return

    const pollStatus = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/media/process-and-classify/${jobId}/status`)
        if (!response.ok) return

        const data = await response.json()
        setJob(data)

        if (data.status === 'complete') {
          // Fetch results
          const resultsResponse = await fetch(`${BACKEND_URL}/api/media/process-and-classify/${jobId}/results`)
          if (resultsResponse.ok) {
            const resultsData = await resultsResponse.json()
            const summary = resultsData.summary
            
            // Properly map and categorize results
            const processedResults: ProcessingResults = {
              movies: (summary.movies?.items || []).map((item: any) => ({
                ...item,
                contentType: 'movie' as const
              })),
              series: (summary.series?.items || []).map((item: any) => ({
                ...item,
                contentType: 'series' as const
              })),
              liveTV: (summary.liveTV?.items || []).map((item: any) => ({
                ...item,
                contentType: 'live-tv' as const
              })),
              extraContent: (summary.extraContent?.items || []).map((item: any) => ({
                ...item,
                contentType: 'extra-content' as const
              }))
            }
            
            setResults(processedResults)
            setEditedResults(JSON.parse(JSON.stringify(processedResults)))
            setPhase('ready')
            
            const total = (summary.movies?.count || 0) + (summary.series?.count || 0) + (summary.liveTV?.count || 0) + (summary.extraContent?.count || 0)
            toast.success(`Processing complete! ${total} items classified`)
            
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current)
              pollIntervalRef.current = null
            }
          }
        } else if (data.status === 'error') {
          toast.error('Processing error: ' + (data.error || 'Unknown error'))
          setPhase('input')
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }

    pollStatus()
    pollIntervalRef.current = setInterval(pollStatus, 1000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [phase, jobId])

  // Download playlist
  const handleDownloadPlaylist = useCallback(async (category: 'movies' | 'series' | 'live-tv' | 'extra-content') => {
    if (!jobId) return

    try {
      const response = await fetch(`${BACKEND_URL}/api/media/download-playlist/${jobId}/${category}`)
      if (!response.ok) throw new Error('Download failed')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${category.replace('-', ' ')}.m3u8`
      a.click()
      URL.revokeObjectURL(url)
      
      toast.success(`Downloaded ${category} playlist`)
    } catch (error) {
      toast.error('Failed to download playlist')
    }
  }, [jobId])

  // Reset
  const handleReset = useCallback(() => {
    setPhase('input')
    setUrlInput('')
    setJobId('')
    setJob(null)
    setResults(null)
    setEditedResults(null)
    setSelectedContentType('all')
  }, [])

  // Get filtered results
  const getFilteredResults = useCallback(() => {
    const source = editedResults || results
    if (!source) return []

    if (selectedContentType === 'all') {
      return [...source.movies, ...source.series, ...source.liveTV, ...source.extraContent].sort((a, b) => 
        (a.title || '').localeCompare(b.title || '')
      )
    } else if (selectedContentType === 'movie') {
      return [...source.movies].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    } else if (selectedContentType === 'series') {
      return [...source.series].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    } else if (selectedContentType === 'live-tv') {
      return [...source.liveTV].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    } else if (selectedContentType === 'extra-content') {
      return [...source.extraContent].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    }
    return []
  }, [results, editedResults, selectedContentType])

  // Copy all URLs
  const handleCopyAllUrls = useCallback(() => {
    const filtered = getFilteredResults()
    if (filtered.length === 0) {
      toast.error('No URLs to copy')
      return
    }

    const urls = filtered.map(media => media.url).join('\n')
    navigator.clipboard.writeText(urls).then(() => {
      toast.success(`Copied ${filtered.length} URLs to clipboard`)
    }).catch(() => {
      toast.error('Failed to copy URLs')
    })
  }, [getFilteredResults])

  const filteredResults = getFilteredResults()

  // Render input phase
  if (phase === 'input') {
    return (
      <Card className="bg-card border-border p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-foreground mb-2">Media Processing Pipeline</h3>
            <p className="text-sm text-muted-foreground">
              Load playlist URLs to extract, deduplicate, enrich metadata, and classify media automatically
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-2">Playlist URLs</label>
            <Textarea
              placeholder="https://example.com/playlist.m3u&#10;https://provider.com/channels.m3u8&#10;http://stream.com/live.m3u"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="font-mono text-sm h-[150px] overflow-auto resize-none"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Enter one URL per line. Supports M3U, M3U8, XSPF, PLS, JSON, XML, CSV formats and ZIP archives
            </p>
          </div>

          <Button
            onClick={handleStartProcessing}
            disabled={!urlInput.trim()}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-12 text-base font-semibold"
          >
            <Upload size={20} className="mr-2" />
            Load URLs
          </Button>
        </div>
      </Card>
    )
  }

  // Render processing phase with overlay
  if (phase === 'processing') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md mx-4"
          >
            <Card className="bg-card border-border p-8 space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-bold text-foreground mb-2">Processing Media... </h3>
                <p className="text-sm text-muted-foreground">
                  {job?.status === 'extracting' && 'Extracting from playlists...'}
                  {job?.status === 'enriching' && 'Enriching metadata...'}
                  {job?.status === 'classifying' && 'Classifying content...'}
                  {job?.status === 'processing' && 'Processing URLs...'}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Progress</span>
                  <span className="text-sm font-bold text-accent">{Math.round(job?.progress || 0)}%</span>
                </div>
                <Progress value={job?.progress || 0} className="h-3" />
              </div>

              {job && (
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{job.counts.movies}</p>
                    <p className="text-xs text-muted-foreground">Movies</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{job.counts.series}</p>
                    <p className="text-xs text-muted-foreground">Series</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{job.counts.liveTV}</p>
                    <p className="text-xs text-muted-foreground">Live TV</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{job.counts.extraContent}</p>
                    <p className="text-xs text-muted-foreground">Extra</p>
                  </div>
                </div>
              )}

              <div className="pt-4">
                <p className="text-xs text-muted-foreground text-center">
                  Please wait while we process your content...
                </p>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )
  }

  // Render ready phase
  if (phase === 'ready' && results) {
    const movieCount = results.movies.length
    const seriesCount = results.series.length
    const liveTvCount = results.liveTV.length
    const extraContentCount = results.extraContent.length
    const totalCount = movieCount + seriesCount + liveTvCount + extraContentCount

    return (
      <Card className="bg-card border-border p-6">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h3 className="text-lg font-bold text-foreground mb-2">Ready to Save</h3>
            <p className="text-sm text-muted-foreground">
              {totalCount} media items extracted and classified. Review before download.
            </p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3">
            <Card className="bg-secondary/50 border-border p-4 text-center cursor-pointer hover:bg-secondary/70 transition-colors" 
              onClick={() => setSelectedContentType('movie')}>
              <Film size={24} className="mx-auto text-accent mb-2" />
              <p className="text-2xl font-bold text-foreground">{movieCount}</p>
              <p className="text-xs text-muted-foreground">Movies</p>
            </Card>
            <Card className="bg-secondary/50 border-border p-4 text-center cursor-pointer hover:bg-secondary/70 transition-colors"
              onClick={() => setSelectedContentType('series')}>
              <Tv size={24} className="mx-auto text-accent mb-2" />
              <p className="text-2xl font-bold text-foreground">{seriesCount}</p>
              <p className="text-xs text-muted-foreground">Series</p>
            </Card>
            <Card className="bg-secondary/50 border-border p-4 text-center cursor-pointer hover:bg-secondary/70 transition-colors"
              onClick={() => setSelectedContentType('live-tv')}>
              <Radio size={24} className="mx-auto text-accent mb-2" />
              <p className="text-2xl font-bold text-foreground">{liveTvCount}</p>
              <p className="text-xs text-muted-foreground">Live TV</p>
            </Card>
            <Card className="bg-secondary/50 border-border p-4 text-center cursor-pointer hover:bg-secondary/70 transition-colors"
              onClick={() => setSelectedContentType('extra-content')}>
              <AlertCircle size={24} className="mx-auto text-accent mb-2" />
              <p className="text-2xl font-bold text-foreground">{extraContentCount}</p>
              <p className="text-xs text-muted-foreground">Extra</p>
            </Card>
          </div>

          <Separator />

          {/* Tabs */}
          <Tabs value={selectedContentType} onValueChange={(v) => setSelectedContentType(v as any)}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All ({totalCount})</TabsTrigger>
              <TabsTrigger value="movie">Movies ({movieCount})</TabsTrigger>
              <TabsTrigger value="series">Series ({seriesCount})</TabsTrigger>
              <TabsTrigger value="live-tv">Live TV ({liveTvCount})</TabsTrigger>
              <TabsTrigger value="extra-content">Extra ({extraContentCount})</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedContentType as any} className="space-y-4">
              {/* View toggle */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUrls(!showUrls)}
                    className="border-accent/30 text-accent hover:bg-accent/10"
                  >
                    {showUrls ? <Eye size={16} className="mr-1" /> : <EyeOff size={16} className="mr-1" />}
                    {showUrls ? 'Hide URLs' : 'Show URLs'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={editingUrls}
                    className="border-accent/30 text-accent hover:bg-accent/10"
                    onClick={() => {
                      if (editingUrls) {
                        setResults(editedResults)
                      }
                      setEditingUrls(!editingUrls)
                    }}
                  >
                    {editingUrls ? 'Done Editing' : 'Edit'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyAllUrls}
                    className="border-accent/30 text-accent hover:bg-accent/10"
                  >
                    <Copy size={16} className="mr-1" />
                    Copy All URLs
                  </Button>
                </div>

                {selectedContentType !== 'all' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadPlaylist(selectedContentType as 'movies' | 'series' | 'live-tv')}
                    className="border-accent/30 text-accent hover:bg-accent/10"
                  >
                    <Download size={16} className="mr-1" />
                    Download M3U
                  </Button>
                )}
              </div>

              {/* URL List */}
              {filteredResults.length > 0 ? (
                <ScrollArea className="h-[400px] rounded-md border border-border bg-secondary/30 p-4">
                  <div className="space-y-3">
                    {filteredResults.map((media, idx) => (
                      <div key={`${media.url}-${idx}`} className="p-3 rounded border border-border/50 hover:border-accent/50 transition-colors bg-secondary/20">
                        {!editingUrls && (
                          <>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-foreground text-sm">{media.title}</p>
                                {media.category && (
                                  <Badge variant="outline" className="text-xs mt-1 border-accent/30 text-accent">
                                    {media.category}
                                  </Badge>
                                )}
                              </div>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {media.confidence}
                              </Badge>
                            </div>

                            {media.genre && media.genre.length > 0 && (
                              <p className="text-xs text-muted-foreground mb-2">
                                {media.genre.join(', ')}
                              </p>
                            )}

                            {showUrls && (
                              <div className="text-xs font-mono text-accent/70 bg-secondary p-2 rounded truncate cursor-pointer" title={media.url}>
                                {media.url}
                              </div>
                            )}
                          </>
                        )}

                        {editingUrls && (
                          <Input
                            value={media.url}
                            onChange={(e) => {
                              if (editedResults) {
                                const updated = { ...editedResults }
                                const list = updated[media.contentType as never] as EnrichedMedia[]
                                const itemIdx = list.findIndex(m => m.url === media.url)
                                if (itemIdx >= 0) {
                                  list[itemIdx] = { ...list[itemIdx], url: e.target.value }
                                }
                                setEditedResults(updated)
                              }
                            }}
                            className="text-xs font-mono"
                            title="Edit URL"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <Alert className="border-border">
                  <AlertDescription className="text-muted-foreground">
                    No media items in this category
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => handleDownloadPlaylist('movies')}
              variant="outline"
              disabled={movieCount === 0}
              className="border-accent/30 text-accent hover:bg-accent/10"
            >
              <Download size={16} className="mr-1" />
              Download Movies
            </Button>
            <Button
              onClick={() => handleDownloadPlaylist('series')}
              variant="outline"
              disabled={seriesCount === 0}
              className="border-accent/30 text-accent hover:bg-accent/10"
            >
              <Download size={16} className="mr-1" />
              Download Series
            </Button>
            <Button
              onClick={() => handleDownloadPlaylist('live-tv')}
              variant="outline"
              disabled={liveTvCount === 0}
              className="border-accent/30 text-accent hover:bg-accent/10"
            >
              <Download size={16} className="mr-1" />
              Download Live TV
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              className="ml-auto border-accent/30 text-accent hover:bg-accent/10"
            >
              <RefreshCw size={16} className="mr-1" />
              Process New URLs
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return null
}
