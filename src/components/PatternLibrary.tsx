import { useState, useMemo, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  MagnifyingGlass, 
  DownloadSimple, 
  UploadSimple, 
  CheckCircle, 
  Star, 
  TrendUp, 
  Clock, 
  Tag, 
  FunnelSimple,
  Copy,
  FileText,
  Sparkle,
  Play,
  Plus,
  CheckSquare,
  Square,
  Package,
  BookOpen,
  Fire,
  Users,
  Shield,
  Code,
  TestTube,
  ShareNetwork,
  Database,
  CaretRight,
  CaretDown,
  FilmSlate,
  Broadcast,
  Video,
  Television,
  X
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  getCommunityPatterns,
  getPatternById,
  getPatternsByCategory,
  searchPatterns,
  getTopPatterns,
  getRecentPatterns,
  getPatternStats,
  testPatternSetAgainstUrl,
  findMatchingPatterns,
  exportPattern,
  importPattern,
  validatePattern,
  extractUrlsUsingPattern,
  scanContentWithPatterns,
  generatePatternReport,
  type StreamingPattern,
  type PatternLibraryStats
} from '@/lib/patternLibrary'

export function PatternLibrary() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(new Set())
  const [showPatternDetails, setShowPatternDetails] = useState(false)
  const [selectedPattern, setSelectedPattern] = useState<StreamingPattern | null>(null)
  const [expandedPatterns, setExpandedPatterns] = useState<Set<string>>(new Set())
  const [testUrl, setTestUrl] = useState('')
  const [testResults, setTestResults] = useState<Map<string, boolean>>(new Map())
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [sortBy, setSortBy] = useState<'popularity' | 'rating' | 'recent' | 'name'>('popularity')
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [scanContent, setScanContent] = useState('')
  const [showScanDialog, setShowScanDialog] = useState(false)
  const [scanResults, setScanResults] = useState<Map<string, string[]>>(new Map())
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [submitName, setSubmitName] = useState('')
  const [submitDescription, setSubmitDescription] = useState('')
  const [submitCategory, setSubmitCategory] = useState<StreamingPattern['category']>('custom')
  const [submitPatterns, setSubmitPatterns] = useState('')
  const [submitExampleUrls, setSubmitExampleUrls] = useState('')
  const [submitTags, setSubmitTags] = useState('')
  const [submitProviderHints, setSubmitProviderHints] = useState('')
  const [submitValidating, setSubmitValidating] = useState(false)

  const stats: PatternLibraryStats = useMemo(() => getPatternStats(), [])

  const filteredPatterns = useMemo(() => {
    let patterns = getCommunityPatterns()

    if (searchQuery.trim()) {
      patterns = searchPatterns(searchQuery)
    }

    if (selectedCategory !== 'all') {
      patterns = patterns.filter(p => p.category === selectedCategory)
    }

    patterns = [...patterns].sort((a, b) => {
      switch (sortBy) {
        case 'popularity':
          return b.popularity - a.popularity
        case 'rating':
          return b.rating - a.rating
        case 'recent':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    return patterns
  }, [searchQuery, selectedCategory, sortBy])

  const handlePatternSelect = useCallback((patternId: string) => {
    setSelectedPatterns(prev => {
      const newSet = new Set(prev)
      if (newSet.has(patternId)) {
        newSet.delete(patternId)
      } else {
        newSet.add(patternId)
      }
      return newSet
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectedPatterns.size === filteredPatterns.length) {
      setSelectedPatterns(new Set())
    } else {
      setSelectedPatterns(new Set(filteredPatterns.map(p => p.id)))
    }
  }, [selectedPatterns.size, filteredPatterns])

  const handleExportSelected = useCallback(async () => {
    if (selectedPatterns.size === 0) {
      toast.error('Please select at least one pattern to export')
      return
    }

    const patterns = Array.from(selectedPatterns)
      .map(id => getPatternById(id))
      .filter(p => p !== undefined) as StreamingPattern[]

    if (patterns.length === 1) {
      const blob = await exportPattern(patterns[0])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pattern-${patterns[0].id}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Pattern exported successfully')
    } else {
      const exportData = {
        patterns,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `patterns-bundle-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Exported ${patterns.length} patterns successfully`)
    }
  }, [selectedPatterns])

  const handleImportPattern = useCallback(async () => {
    if (!importJson.trim()) {
      toast.error('Please enter pattern JSON to import')
      return
    }

    try {
      const pattern = await importPattern(importJson)
      const validation = validatePattern(pattern)
      
      if (!validation.valid) {
        toast.error(`Invalid pattern: ${validation.errors.join(', ')}`)
        return
      }

      toast.success(`Pattern "${pattern.name}" imported successfully`)
      setImportJson('')
      setShowImportDialog(false)
    } catch (error) {
      toast.error('Failed to import pattern: ' + (error as Error).message)
    }
  }, [importJson])

  const handleTestPattern = useCallback((pattern: StreamingPattern) => {
    setSelectedPattern(pattern)
    setTestUrl('')
    setTestResults(new Map())
    setShowTestDialog(true)
  }, [])

  const handleRunTest = useCallback(() => {
    if (!selectedPattern || !testUrl.trim()) {
      toast.error('Please enter a URL to test')
      return
    }

    const matches = testPatternSetAgainstUrl(selectedPattern.patterns, testUrl)
    const newResults = new Map(testResults)
    newResults.set(testUrl, matches)
    setTestResults(newResults)

    if (matches) {
      toast.success('✓ URL matches this pattern!')
    } else {
      toast.error('✗ URL does not match this pattern')
    }
  }, [selectedPattern, testUrl, testResults])

  const handleViewDetails = useCallback((pattern: StreamingPattern) => {
    setSelectedPattern(pattern)
    setShowPatternDetails(true)
  }, [])

  const togglePatternExpansion = useCallback((patternId: string) => {
    setExpandedPatterns(prev => {
      const newSet = new Set(prev)
      if (newSet.has(patternId)) {
        newSet.delete(patternId)
      } else {
        newSet.add(patternId)
      }
      return newSet
    })
  }, [])

  const handleCopyPatterns = useCallback((pattern: StreamingPattern) => {
    const text = pattern.patterns.join('\n')
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Patterns copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy patterns')
    })
  }, [])

  const handleScanWithPatterns = useCallback(async () => {
    if (!scanContent.trim()) {
      toast.error('Please enter content to scan')
      return
    }

    const patterns = Array.from(selectedPatterns)
      .map(id => getPatternById(id))
      .filter(p => p !== undefined) as StreamingPattern[]

    if (patterns.length === 0) {
      toast.error('Please select at least one pattern to use for scanning')
      return
    }

    toast.loading('Scanning content with selected patterns...', { id: 'scan-patterns' })

    const results = await scanContentWithPatterns(scanContent, patterns)
    setScanResults(results)

    const totalUrls = Array.from(results.values()).flat().length
    toast.success(`Found ${totalUrls} URLs using ${patterns.length} patterns`, { id: 'scan-patterns' })
  }, [scanContent, selectedPatterns])

  const handleDownloadScanReport = useCallback(() => {
    if (scanResults.size === 0) {
      toast.error('No scan results to download')
      return
    }

    const patterns = Array.from(selectedPatterns)
      .map(id => getPatternById(id))
      .filter(p => p !== undefined) as StreamingPattern[]

    const report = generatePatternReport(patterns, scanResults)
    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pattern-scan-report-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Scan report downloaded')
  }, [scanResults, selectedPatterns])

  const handleOpenSubmitDialog = useCallback(() => {
    setSubmitName('')
    setSubmitDescription('')
    setSubmitCategory('custom')
    setSubmitPatterns('')
    setSubmitExampleUrls('')
    setSubmitTags('')
    setSubmitProviderHints('')
    setSubmitValidating(false)
    setShowSubmitDialog(true)
  }, [])

  const handleValidateSubmission = useCallback(async () => {
    if (!submitName.trim()) {
      toast.error('Please enter a pattern name')
      return false
    }

    if (!submitDescription.trim()) {
      toast.error('Please enter a pattern description')
      return false
    }

    if (!submitPatterns.trim()) {
      toast.error('Please enter at least one regex pattern')
      return false
    }

    const patterns = submitPatterns.split('\n').filter(p => p.trim())
    if (patterns.length === 0) {
      toast.error('Please enter at least one valid regex pattern')
      return false
    }

    setSubmitValidating(true)

    for (const pattern of patterns) {
      try {
        new RegExp(pattern)
      } catch (error) {
        setSubmitValidating(false)
        toast.error(`Invalid regex pattern: ${pattern}`)
        return false
      }
    }

    const exampleUrls = submitExampleUrls.split('\n').filter(u => u.trim())
    if (exampleUrls.length > 0) {
      let matchCount = 0
      for (const url of exampleUrls) {
        if (testPatternSetAgainstUrl(patterns, url)) {
          matchCount++
        }
      }

      if (matchCount === 0) {
        setSubmitValidating(false)
        toast.error('None of your example URLs match the provided patterns')
        return false
      }

      if (matchCount < exampleUrls.length) {
        toast.warning(`Only ${matchCount} of ${exampleUrls.length} example URLs match the patterns`)
      }
    }

    setSubmitValidating(false)
    return true
  }, [submitName, submitDescription, submitPatterns, submitExampleUrls])

  const handleSubmitPattern = useCallback(async () => {
    const isValid = await handleValidateSubmission()
    if (!isValid) return

    try {
      const newPattern: StreamingPattern = {
        id: `user-${Date.now()}`,
        name: submitName.trim(),
        description: submitDescription.trim(),
        category: submitCategory,
        patterns: submitPatterns.split('\n').filter(p => p.trim()),
        exampleUrls: submitExampleUrls.split('\n').filter(u => u.trim()),
        tags: submitTags.split(',').map(t => t.trim()).filter(t => t),
        providerHints: submitProviderHints.split(',').map(p => p.trim()).filter(p => p),
        verified: false,
        popularity: 0,
        downloads: 0,
        rating: 0,
        author: 'Community User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const validation = validatePattern(newPattern)
      if (!validation.valid) {
        toast.error(`Pattern validation failed: ${validation.errors.join(', ')}`)
        return
      }

      const blob = await exportPattern(newPattern)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pattern-submission-${newPattern.id}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(
        'Pattern created successfully! The JSON file has been downloaded. Share it with the community or import it locally.',
        { duration: 5000 }
      )
      
      setShowSubmitDialog(false)
    } catch (error) {
      toast.error('Failed to create pattern: ' + (error as Error).message)
    }
  }, [submitName, submitDescription, submitCategory, submitPatterns, submitExampleUrls, submitTags, submitProviderHints, handleValidateSubmission])

  const getCategoryIcon = (category: StreamingPattern['category']) => {
    switch (category) {
      case 'xtream': return <Database size={16} />
      case 'hls': return <Video size={16} />
      case 'rtmp': return <Broadcast size={16} />
      case 'rtsp': return <Television size={16} />
      case 'm3u': return <FilmSlate size={16} />
      case 'dash': return <Play size={16} />
      case 'iptv-panel': return <Package size={16} />
      case 'custom': return <Code size={16} />
      default: return <Code size={16} />
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen size={24} className="text-accent" />
        <h3 className="text-lg font-bold text-foreground">Community Pattern Library</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Browse, test, and use community-shared patterns for popular streaming providers. Select patterns to scan content, validate URLs, or export for later use.
      </p>

      <Card className="bg-card border-border p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-accent/5 rounded-lg border border-accent/20">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Package size={20} className="text-accent" />
              <div className="text-2xl font-bold text-accent">{stats.totalPatterns}</div>
            </div>
            <div className="text-xs text-muted-foreground">Total Patterns</div>
          </div>

          <div className="text-center p-3 bg-accent/5 rounded-lg border border-accent/20">
            <div className="flex items-center justify-center gap-2 mb-1">
              <DownloadSimple size={20} className="text-accent" />
              <div className="text-2xl font-bold text-accent">{stats.totalDownloads.toLocaleString()}</div>
            </div>
            <div className="text-xs text-muted-foreground">Total Downloads</div>
          </div>

          <div className="text-center p-3 bg-accent/5 rounded-lg border border-accent/20">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Users size={20} className="text-accent" />
              <div className="text-2xl font-bold text-accent">{Object.keys(stats.categories).length}</div>
            </div>
            <div className="text-xs text-muted-foreground">Categories</div>
          </div>

          <div className="text-center p-3 bg-accent/5 rounded-lg border border-accent/20">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Shield size={20} className="text-accent" />
              <div className="text-2xl font-bold text-accent">
                {getCommunityPatterns().filter(p => p.verified).length}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">Verified</div>
          </div>
        </div>

        <Separator className="bg-border my-4" />

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search patterns by name, description, tags, or provider..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="xtream">Xtream Codes</SelectItem>
                <SelectItem value="hls">HLS</SelectItem>
                <SelectItem value="dash">DASH</SelectItem>
                <SelectItem value="rtmp">RTMP</SelectItem>
                <SelectItem value="rtsp">RTSP</SelectItem>
                <SelectItem value="m3u">M3U</SelectItem>
                <SelectItem value="iptv-panel">IPTV Panel</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popularity">Most Popular</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSelectAll}
              variant="outline"
              size="sm"
              className="border-accent/30 hover:bg-accent/10 text-accent"
            >
              {selectedPatterns.size === filteredPatterns.length && filteredPatterns.length > 0 ? (
                <CheckSquare size={16} className="mr-1" weight="fill" />
              ) : (
                <Square size={16} className="mr-1" />
              )}
              Select All
            </Button>
            <Button
              onClick={handleExportSelected}
              variant="outline"
              size="sm"
              className="border-accent/30 hover:bg-accent/10 text-accent"
              disabled={selectedPatterns.size === 0}
            >
              <DownloadSimple size={16} className="mr-1" />
              Export Selected ({selectedPatterns.size})
            </Button>
            <Button
              onClick={() => setShowImportDialog(true)}
              variant="outline"
              size="sm"
              className="border-accent/30 hover:bg-accent/10 text-accent"
            >
              <UploadSimple size={16} className="mr-1" />
              Import Pattern
            </Button>
            <Button
              onClick={() => {
                setScanContent('')
                setScanResults(new Map())
                setShowScanDialog(true)
              }}
              variant="outline"
              size="sm"
              className="border-accent/30 hover:bg-accent/10 text-accent"
              disabled={selectedPatterns.size === 0}
            >
              <MagnifyingGlass size={16} className="mr-1" />
              Scan Content
            </Button>
            <Button
              onClick={handleOpenSubmitDialog}
              variant="default"
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <ShareNetwork size={16} className="mr-1" weight="fill" />
              Submit New Pattern
            </Button>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="browse" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-primary/30">
          <TabsTrigger value="browse">
            <Package size={16} className="mr-1" />
            Browse
          </TabsTrigger>
          <TabsTrigger value="top">
            <Fire size={16} className="mr-1" />
            Top Patterns
          </TabsTrigger>
          <TabsTrigger value="recent">
            <Clock size={16} className="mr-1" />
            Recent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-4">
          <ScrollArea className="h-[500px] rounded-md border border-border bg-primary/30 p-4">
            <div className="space-y-3">
              {filteredPatterns.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Package size={64} className="mx-auto mb-4 opacity-30" />
                  <p>No patterns found matching your search criteria</p>
                </div>
              ) : (
                <AnimatePresence>
                  {filteredPatterns.map((pattern, index) => {
                    const isExpanded = expandedPatterns.has(pattern.id)
                    const isSelected = selectedPatterns.has(pattern.id)
                    return (
                      <motion.div
                        key={pattern.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.5) }}
                        className={`rounded-lg border transition-all duration-200 ${
                          isSelected 
                            ? 'border-accent bg-accent/5' 
                            : 'border-border bg-card hover:border-accent/50'
                        }`}
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handlePatternSelect(pattern.id)}
                              className="mt-1"
                            />
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-foreground">{pattern.name}</h4>
                                    {pattern.verified && (
                                      <Shield size={16} className="text-accent" weight="fill" />
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">{pattern.description}</p>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                                  {getCategoryIcon(pattern.category)}
                                  <span className="ml-1">{pattern.category}</span>
                                </Badge>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Star size={14} weight="fill" className="text-yellow-500" />
                                  <span>{pattern.rating.toFixed(1)}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <TrendUp size={14} />
                                  <span>{pattern.popularity.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <DownloadSimple size={14} />
                                  <span>{pattern.downloads.toLocaleString()}</span>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1 mb-2">
                                {pattern.tags.slice(0, 5).map(tag => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    <Tag size={10} className="mr-1" />
                                    {tag}
                                  </Badge>
                                ))}
                                {pattern.tags.length > 5 && (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">
                                    +{pattern.tags.length - 5} more
                                  </Badge>
                                )}
                              </div>

                              {pattern.providerHints && pattern.providerHints.length > 0 && (
                                <div className="text-xs text-muted-foreground mb-2">
                                  <strong>Providers:</strong> {pattern.providerHints.join(', ')}
                                </div>
                              )}

                              <button
                                onClick={() => togglePatternExpansion(pattern.id)}
                                className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
                              >
                                {isExpanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
                                {isExpanded ? 'Hide' : 'Show'} {pattern.patterns.length} regex patterns
                              </button>

                              {isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-2 space-y-2"
                                >
                                  {pattern.patterns.map((p, i) => (
                                    <div key={i} className="bg-secondary/30 rounded p-2 font-mono text-xs break-all">
                                      {p}
                                    </div>
                                  ))}
                                  {pattern.exampleUrls.length > 0 && (
                                    <div className="mt-2">
                                      <div className="text-xs text-muted-foreground mb-1">Example URLs:</div>
                                      {pattern.exampleUrls.slice(0, 3).map((url, i) => (
                                        <div key={i} className="bg-accent/5 rounded p-2 font-mono text-xs break-all text-accent">
                                          {url}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </div>

                            <div className="flex flex-col gap-1 shrink-0">
                              <Button
                                onClick={() => handleViewDetails(pattern)}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-accent/20 text-accent"
                                title="View details"
                              >
                                <FileText size={16} />
                              </Button>
                              <Button
                                onClick={() => handleTestPattern(pattern)}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-accent/20 text-accent"
                                title="Test pattern"
                              >
                                <TestTube size={16} />
                              </Button>
                              <Button
                                onClick={() => handleCopyPatterns(pattern)}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-accent/20 text-accent"
                                title="Copy patterns"
                              >
                                <Copy size={16} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="top" className="mt-4">
          <ScrollArea className="h-[500px] rounded-md border border-border bg-primary/30 p-4">
            <div className="space-y-3">
              {getTopPatterns(10).map((pattern, index) => (
                <motion.div
                  key={pattern.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="p-4 rounded-lg border border-border bg-card hover:border-accent/50 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/10 text-accent font-bold shrink-0">
                      #{index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-foreground">{pattern.name}</h4>
                        {pattern.verified && (
                          <Shield size={16} className="text-accent" weight="fill" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1 text-yellow-500">
                          <Star size={14} weight="fill" />
                          <span>{pattern.rating.toFixed(1)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <TrendUp size={14} />
                          <span>{pattern.popularity.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <DownloadSimple size={14} />
                          <span>{pattern.downloads.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => handlePatternSelect(pattern.id)}
                      variant="outline"
                      size="sm"
                      className={selectedPatterns.has(pattern.id) ? 'bg-accent/10 border-accent' : ''}
                    >
                      {selectedPatterns.has(pattern.id) ? (
                        <CheckCircle size={16} weight="fill" />
                      ) : (
                        <Plus size={16} />
                      )}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="recent" className="mt-4">
          <ScrollArea className="h-[500px] rounded-md border border-border bg-primary/30 p-4">
            <div className="space-y-3">
              {getRecentPatterns(10).map((pattern, index) => (
                <motion.div
                  key={pattern.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="p-4 rounded-lg border border-border bg-card hover:border-accent/50 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <Clock size={24} className="text-accent shrink-0 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-foreground">{pattern.name}</h4>
                        {pattern.verified && (
                          <Shield size={16} className="text-accent" weight="fill" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{pattern.description}</p>
                      <div className="text-xs text-muted-foreground">
                        Updated {new Date(pattern.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Button
                      onClick={() => handlePatternSelect(pattern.id)}
                      variant="outline"
                      size="sm"
                      className={selectedPatterns.has(pattern.id) ? 'bg-accent/10 border-accent' : ''}
                    >
                      {selectedPatterns.has(pattern.id) ? (
                        <CheckCircle size={16} weight="fill" />
                      ) : (
                        <Plus size={16} />
                      )}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <Dialog open={showPatternDetails} onOpenChange={setShowPatternDetails}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={20} className="text-accent" />
              Pattern Details
            </DialogTitle>
          </DialogHeader>

          {selectedPattern && (
            <div className="space-y-4 py-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-foreground">{selectedPattern.name}</h3>
                  {selectedPattern.verified && (
                    <Shield size={20} className="text-accent" weight="fill" />
                  )}
                </div>
                <p className="text-muted-foreground">{selectedPattern.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-accent/5 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Category</div>
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(selectedPattern.category)}
                    <span className="text-sm font-semibold text-foreground capitalize">
                      {selectedPattern.category}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-accent/5 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Rating</div>
                  <div className="flex items-center gap-1">
                    <Star size={16} weight="fill" className="text-yellow-500" />
                    <span className="text-sm font-semibold text-foreground">
                      {selectedPattern.rating.toFixed(1)} / 5.0
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-accent/5 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Popularity</div>
                  <div className="flex items-center gap-1">
                    <TrendUp size={16} className="text-accent" />
                    <span className="text-sm font-semibold text-foreground">
                      {selectedPattern.popularity.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-accent/5 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Downloads</div>
                  <div className="flex items-center gap-1">
                    <DownloadSimple size={16} className="text-accent" />
                    <span className="text-sm font-semibold text-foreground">
                      {selectedPattern.downloads.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <Separator className="bg-border" />

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Regex Patterns</h4>
                <div className="space-y-2">
                  {selectedPattern.patterns.map((pattern, i) => (
                    <div key={i} className="bg-secondary/30 rounded p-3 font-mono text-xs break-all">
                      {pattern}
                    </div>
                  ))}
                </div>
              </div>

              {selectedPattern.exampleUrls.length > 0 && (
                <>
                  <Separator className="bg-border" />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Example URLs</h4>
                    <div className="space-y-2">
                      {selectedPattern.exampleUrls.map((url, i) => (
                        <div key={i} className="bg-accent/5 rounded p-3 font-mono text-xs break-all text-accent">
                          {url}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selectedPattern.tags.length > 0 && (
                <>
                  <Separator className="bg-border" />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedPattern.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          <Tag size={12} className="mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selectedPattern.providerHints && selectedPattern.providerHints.length > 0 && (
                <>
                  <Separator className="bg-border" />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Provider Hints</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedPattern.providerHints.map(hint => (
                        <Badge key={hint} variant="outline" className="text-xs border-accent/30 text-accent">
                          {hint}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => setShowPatternDetails(false)}
              variant="outline"
              className="border-border"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube size={20} className="text-accent" />
              Test Pattern
            </DialogTitle>
            <DialogDescription>
              {selectedPattern && `Testing pattern: ${selectedPattern.name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="test-url" className="text-sm font-medium text-foreground block mb-2">
                Enter URL to test
              </label>
              <Input
                id="test-url"
                placeholder="https://example.com/stream/playlist.m3u8"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <Button
              onClick={handleRunTest}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={!testUrl.trim()}
            >
              <Play size={16} className="mr-2" weight="fill" />
              Run Test
            </Button>

            {testResults.size > 0 && (
              <>
                <Separator className="bg-border" />
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Test Results</h4>
                  <div className="space-y-2">
                    {Array.from(testResults.entries()).map(([url, matches]) => (
                      <div
                        key={url}
                        className={`p-3 rounded-lg border ${
                          matches
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-red-500/10 border-red-500/30'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {matches ? (
                            <CheckCircle size={20} className="text-green-500 shrink-0 mt-0.5" weight="fill" />
                          ) : (
                            <X size={20} className="text-red-500 shrink-0 mt-0.5" weight="bold" />
                          )}
                          <div className="flex-1">
                            <div className={`text-sm font-semibold ${matches ? 'text-green-500' : 'text-red-500'}`}>
                              {matches ? 'Match Found' : 'No Match'}
                            </div>
                            <div className="text-xs font-mono break-all text-foreground/80 mt-1">
                              {url}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {selectedPattern && selectedPattern.exampleUrls.length > 0 && (
              <>
                <Separator className="bg-border" />
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Try Example URLs</h4>
                  <div className="space-y-2">
                    {selectedPattern.exampleUrls.slice(0, 3).map((url, i) => (
                      <Button
                        key={i}
                        onClick={() => setTestUrl(url)}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-left h-auto py-2 border-accent/30 hover:bg-accent/10"
                      >
                        <div className="font-mono text-xs break-all">{url}</div>
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowTestDialog(false)}
              variant="outline"
              className="border-border"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UploadSimple size={20} className="text-accent" />
              Import Pattern
            </DialogTitle>
            <DialogDescription>
              Paste a pattern JSON file or pattern bundle to import custom patterns
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Textarea
              placeholder='{"name": "My Custom Pattern", "patterns": [...], ...}'
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              className="font-mono text-xs min-h-[200px]"
            />
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowImportDialog(false)}
              variant="outline"
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportPattern}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={!importJson.trim()}
            >
              <CheckCircle size={16} className="mr-2" weight="fill" />
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MagnifyingGlass size={20} className="text-accent" />
              Scan Content with Patterns
            </DialogTitle>
            <DialogDescription>
              Paste content to scan using {selectedPatterns.size} selected pattern{selectedPatterns.size !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Paste HTML, JSON, text content, or URLs to scan..."
              value={scanContent}
              onChange={(e) => setScanContent(e.target.value)}
              className="font-mono text-xs min-h-[200px]"
            />

            <Button
              onClick={handleScanWithPatterns}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={!scanContent.trim() || selectedPatterns.size === 0}
            >
              <MagnifyingGlass size={16} className="mr-2" />
              Scan Now
            </Button>

            {scanResults.size > 0 && (
              <>
                <Separator className="bg-border" />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-foreground">Scan Results</h4>
                    <Button
                      onClick={handleDownloadScanReport}
                      variant="outline"
                      size="sm"
                      className="border-accent/30 hover:bg-accent/10 text-accent"
                    >
                      <DownloadSimple size={16} className="mr-1" />
                      Download Report
                    </Button>
                  </div>
                  <ScrollArea className="h-[300px] rounded-md border border-border bg-primary/30 p-4">
                    <div className="space-y-4">
                      {Array.from(scanResults.entries()).map(([patternId, urls]) => {
                        const pattern = getPatternById(patternId)
                        if (!pattern) return null
                        return (
                          <div key={patternId} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h5 className="text-sm font-semibold text-foreground">{pattern.name}</h5>
                              <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                                {urls.length} URLs
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              {urls.map((url, i) => (
                                <div
                                  key={i}
                                  className="bg-secondary/30 rounded p-2 font-mono text-xs break-all text-accent"
                                >
                                  {url}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowScanDialog(false)}
              variant="outline"
              className="border-border"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShareNetwork size={20} className="text-accent" weight="fill" />
              Submit New Pattern to Community
            </DialogTitle>
            <DialogDescription>
              Create and share a new pattern with the community. Your pattern will be downloaded as a JSON file that you can share or import later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div>
                <label htmlFor="submit-name" className="text-sm font-medium text-foreground block mb-1">
                  Pattern Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="submit-name"
                  placeholder="e.g., Premium IPTV Provider X, HLS Stream Pattern"
                  value={submitName}
                  onChange={(e) => setSubmitName(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="submit-description" className="text-sm font-medium text-foreground block mb-1">
                  Description <span className="text-destructive">*</span>
                </label>
                <Textarea
                  id="submit-description"
                  placeholder="Describe what this pattern matches and when to use it..."
                  value={submitDescription}
                  onChange={(e) => setSubmitDescription(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div>
                <label htmlFor="submit-category" className="text-sm font-medium text-foreground block mb-1">
                  Category <span className="text-destructive">*</span>
                </label>
                <Select value={submitCategory} onValueChange={(v) => setSubmitCategory(v as StreamingPattern['category'])}>
                  <SelectTrigger id="submit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xtream">Xtream Codes</SelectItem>
                    <SelectItem value="hls">HLS</SelectItem>
                    <SelectItem value="dash">DASH</SelectItem>
                    <SelectItem value="rtmp">RTMP</SelectItem>
                    <SelectItem value="rtsp">RTSP</SelectItem>
                    <SelectItem value="m3u">M3U</SelectItem>
                    <SelectItem value="iptv-panel">IPTV Panel</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator className="bg-border" />

              <div>
                <label htmlFor="submit-patterns" className="text-sm font-medium text-foreground block mb-1">
                  Regex Patterns (one per line) <span className="text-destructive">*</span>
                </label>
                <Textarea
                  id="submit-patterns"
                  placeholder="https?://[^/]+/live/[^/]+/[^/]+/\\d+\\.ts&#10;https?://[^/]+/player_api\\.php\\?.*"
                  value={submitPatterns}
                  onChange={(e) => setSubmitPatterns(e.target.value)}
                  className="font-mono text-xs min-h-[150px]"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter JavaScript-compatible regex patterns. Each pattern should be on its own line.
                </p>
              </div>

              <div>
                <label htmlFor="submit-examples" className="text-sm font-medium text-foreground block mb-1">
                  Example URLs (one per line)
                </label>
                <Textarea
                  id="submit-examples"
                  placeholder="http://example.com/live/username/password/12345.ts&#10;http://provider.tv/player_api.php?username=user&password=pass"
                  value={submitExampleUrls}
                  onChange={(e) => setSubmitExampleUrls(e.target.value)}
                  className="font-mono text-xs min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Provide example URLs that your patterns should match. We'll validate them for you.
                </p>
              </div>

              <Separator className="bg-border" />

              <div>
                <label htmlFor="submit-tags" className="text-sm font-medium text-foreground block mb-1">
                  Tags (comma-separated)
                </label>
                <Input
                  id="submit-tags"
                  placeholder="iptv, hls, live-tv, premium, subscription"
                  value={submitTags}
                  onChange={(e) => setSubmitTags(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Add tags to help others find your pattern. Separate with commas.
                </p>
              </div>

              <div>
                <label htmlFor="submit-providers" className="text-sm font-medium text-foreground block mb-1">
                  Provider Hints (comma-separated)
                </label>
                <Input
                  id="submit-providers"
                  placeholder="ProviderName, ServiceX, PlatformY"
                  value={submitProviderHints}
                  onChange={(e) => setSubmitProviderHints(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  List specific providers or services this pattern works with.
                </p>
              </div>
            </div>

            <Card className="bg-accent/5 border-accent/30 p-4">
              <div className="flex gap-2">
                <Sparkle size={16} className="text-accent shrink-0 mt-0.5" />
                <div className="text-xs text-foreground">
                  <p className="font-semibold mb-1">Submission Guidelines:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Use valid JavaScript regex patterns</li>
                    <li>Test your patterns with example URLs</li>
                    <li>Provide clear descriptions and tags</li>
                    <li>Avoid patterns that match unrelated content</li>
                    <li>Your pattern will be saved as a JSON file to share</li>
                  </ul>
                </div>
              </div>
            </Card>

            <div className="flex gap-2">
              <Button
                onClick={handleValidateSubmission}
                variant="outline"
                className="flex-1 border-accent/30 hover:bg-accent/10 text-accent"
                disabled={submitValidating}
              >
                <TestTube size={16} className="mr-2" />
                {submitValidating ? 'Validating...' : 'Validate Pattern'}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowSubmitDialog(false)}
              variant="outline"
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitPattern}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={submitValidating || !submitName.trim() || !submitDescription.trim() || !submitPatterns.trim()}
            >
              <ShareNetwork size={16} className="mr-2" weight="fill" />
              Create & Download Pattern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
