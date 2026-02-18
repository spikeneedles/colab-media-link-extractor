import { useState, useMemo, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FunnelSimple, DownloadSimple, FileText, Broadcast, Code, CheckCircle, Warning, FloppyDisk, TrashSimple, Plus, MagnifyingGlass, FileArrowUp, FileArrowDown, Sparkle } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useKV } from '@github/spark/hooks'
import {
  StreamingProtocol,
  PROTOCOL_PATTERNS,
  filterByProtocol,
  filterUrlsByProtocols,
  detectProtocol,
  getProtocolStats,
  filterByCustomRegex,
  filterByHost,
  filterByPort,
  filterByExtension,
  generateProtocolReport,
  exportProtocolFilteredFiles
} from '@/lib/protocolFilters'

type RegexPattern = {
  id: string
  name: string
  pattern: string
  description: string
  caseSensitive: boolean
  tags: string[]
}

type ProtocolFiltersProps = {
  urls: string[]
  onFilteredUrlsChange?: (urls: string[]) => void
}

const PRESET_PATTERNS: RegexPattern[] = [
  {
    id: 'hd-4k',
    name: 'HD/4K Quality Streams',
    pattern: '.*(1080p?|2160p?|4k|uhd|hd|fhd).*',
    description: 'Match URLs containing quality indicators like 1080p, 4K, UHD, HD, FHD',
    caseSensitive: false,
    tags: ['quality', 'video', 'hd']
  },
  {
    id: 'specific-port',
    name: 'Specific Port Range',
    pattern: '.*:(8080|8000|554|1935).*',
    description: 'Match URLs with common streaming ports (8080, 8000, 554, 1935)',
    caseSensitive: false,
    tags: ['port', 'network']
  },
  {
    id: 'hls-variants',
    name: 'HLS Variant Playlists',
    pattern: '.*\\.m3u8\\?.*variant.*',
    description: 'Match HLS M3U8 URLs with variant stream parameters',
    caseSensitive: false,
    tags: ['hls', 'playlist', 'adaptive']
  },
  {
    id: 'rtmp-live',
    name: 'RTMP Live Streams',
    pattern: 'rtmp[s]?://.*live.*',
    description: 'Match RTMP/RTMPS URLs containing "live" in the path',
    caseSensitive: false,
    tags: ['rtmp', 'live']
  },
  {
    id: 'token-auth',
    name: 'Token-Based Authentication',
    pattern: '.*\\?(token|auth|key)=.*',
    description: 'Match URLs with authentication tokens or API keys',
    caseSensitive: false,
    tags: ['auth', 'security']
  },
  {
    id: 'cdn-sources',
    name: 'CDN Sources',
    pattern: '.*(cdn|cloudfront|akamai|fastly|cloudflare).*',
    description: 'Match URLs from popular CDN providers',
    caseSensitive: false,
    tags: ['cdn', 'delivery']
  },
  {
    id: 'sports-channels',
    name: 'Sports Channels',
    pattern: '.*(sport|espn|nba|nfl|mlb|soccer|football|hockey).*',
    description: 'Match URLs containing sports-related keywords',
    caseSensitive: false,
    tags: ['category', 'sports']
  },
  {
    id: 'movies-vod',
    name: 'Movies/VOD',
    pattern: '.*(movie|film|vod|cinema).*',
    description: 'Match URLs containing movie or video-on-demand keywords',
    caseSensitive: false,
    tags: ['category', 'movies', 'vod']
  },
  {
    id: 'language-specific',
    name: 'Language Specific (EN)',
    pattern: '.*(en|eng|english|us|uk).*',
    description: 'Match URLs with English language indicators',
    caseSensitive: false,
    tags: ['language', 'english']
  },
  {
    id: 'dash-mpd',
    name: 'DASH MPD Files',
    pattern: '.*\\.mpd(\\?.*)?$',
    description: 'Match MPEG-DASH manifest files (.mpd)',
    caseSensitive: false,
    tags: ['dash', 'adaptive']
  }
]

export const ProtocolFilters = ({ urls, onFilteredUrlsChange }: ProtocolFiltersProps) => {
  const [selectedProtocols, setSelectedProtocols] = useState<Set<StreamingProtocol>>(new Set(['all']))
  const [customRegex, setCustomRegex] = useState('')
  const [hostFilter, setHostFilter] = useState('')
  const [portFilter, setPortFilter] = useState('')
  const [extensionFilter, setExtensionFilter] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [activeTab, setActiveTab] = useState('protocols')
  const [savedPatterns, setSavedPatterns] = useKV<RegexPattern[]>('regex-patterns', [])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [newPatternName, setNewPatternName] = useState('')
  const [newPatternDesc, setNewPatternDesc] = useState('')
  const [newPatternTags, setNewPatternTags] = useState('')
  const [testPattern, setTestPattern] = useState('')
  const [testResults, setTestResults] = useState<{ url: string; matches: boolean }[]>([])
  const [regexError, setRegexError] = useState('')

  const protocolStats = useMemo(() => getProtocolStats(urls), [urls])

  const validateRegex = useCallback((pattern: string): boolean => {
    try {
      new RegExp(pattern)
      setRegexError('')
      return true
    } catch (e) {
      setRegexError(e instanceof Error ? e.message : 'Invalid regex pattern')
      return false
    }
  }, [])

  const filteredUrls = useMemo(() => {
    let result = urls

    if (!selectedProtocols.has('all')) {
      const protocols = Array.from(selectedProtocols)
      result = result.filter(url => {
        const protocol = detectProtocol(url)
        return protocols.includes(protocol)
      })
    }

    if (customRegex && validateRegex(customRegex)) {
      result = filterByCustomRegex(result, customRegex, caseSensitive)
    }

    if (hostFilter) {
      result = filterByHost(result, hostFilter)
    }

    if (portFilter) {
      const port = parseInt(portFilter)
      if (!isNaN(port)) {
        result = filterByPort(result, port)
      }
    }

    if (extensionFilter) {
      result = filterByExtension(result, extensionFilter)
    }

    return result
  }, [urls, selectedProtocols, customRegex, hostFilter, portFilter, extensionFilter, caseSensitive, validateRegex])

  const toggleProtocol = (protocol: StreamingProtocol) => {
    const newSelected = new Set(selectedProtocols)
    
    if (protocol === 'all') {
      if (newSelected.has('all')) {
        newSelected.clear()
      } else {
        newSelected.clear()
        newSelected.add('all')
      }
    } else {
      newSelected.delete('all')
      if (newSelected.has(protocol)) {
        newSelected.delete(protocol)
      } else {
        newSelected.add(protocol)
      }
      
      if (newSelected.size === 0) {
        newSelected.add('all')
      }
    }
    
    setSelectedProtocols(newSelected)
  }

  const handleApplyFilters = () => {
    if (onFilteredUrlsChange) {
      onFilteredUrlsChange(filteredUrls)
    }
    toast.success(`Filtered to ${filteredUrls.length} URLs`)
  }

  const handleDownloadReport = () => {
    const report = generateProtocolReport(urls)
    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `protocol-analysis-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Downloaded protocol analysis report')
  }

  const handleDownloadFiltered = async () => {
    const content = filteredUrls.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `filtered-urls-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`Downloaded ${filteredUrls.length} filtered URLs`)
  }

  const handleDownloadByProtocol = async (protocol: StreamingProtocol) => {
    const blob = await exportProtocolFilteredFiles(urls, protocol)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const pattern = PROTOCOL_PATTERNS[protocol]
    a.download = `${protocol}-urls-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`Downloaded ${pattern.name} URLs`)
  }

  const handleClearFilters = () => {
    setSelectedProtocols(new Set(['all']))
    setCustomRegex('')
    setHostFilter('')
    setPortFilter('')
    setExtensionFilter('')
    setCaseSensitive(false)
    setRegexError('')
    toast.info('Filters cleared')
  }

  const handleLoadPreset = (pattern: RegexPattern) => {
    setCustomRegex(pattern.pattern)
    setCaseSensitive(pattern.caseSensitive)
    setActiveTab('advanced')
    toast.success(`Loaded preset: ${pattern.name}`)
  }

  const handleSavePattern = useCallback(() => {
    if (!customRegex || !newPatternName) {
      toast.error('Pattern and name are required')
      return
    }

    if (!validateRegex(customRegex)) {
      toast.error('Invalid regex pattern')
      return
    }

    const newPattern: RegexPattern = {
      id: `custom-${Date.now()}`,
      name: newPatternName,
      pattern: customRegex,
      description: newPatternDesc || 'Custom pattern',
      caseSensitive,
      tags: newPatternTags.split(',').map(t => t.trim()).filter(t => t.length > 0)
    }

    setSavedPatterns(current => [...(current || []), newPattern])
    setShowSaveDialog(false)
    setNewPatternName('')
    setNewPatternDesc('')
    setNewPatternTags('')
    toast.success('Pattern saved successfully')
  }, [customRegex, newPatternName, newPatternDesc, caseSensitive, newPatternTags, validateRegex, setSavedPatterns])

  const handleDeletePattern = useCallback((id: string) => {
    setSavedPatterns(current => (current || []).filter(p => p.id !== id))
    toast.success('Pattern deleted')
  }, [setSavedPatterns])

  const handleTestPattern = useCallback(() => {
    if (!testPattern || !validateRegex(testPattern)) {
      toast.error('Invalid test pattern')
      return
    }

    const sampleUrls = urls.slice(0, 20)
    const results = sampleUrls.map(url => {
      try {
        const regex = new RegExp(testPattern, caseSensitive ? '' : 'i')
        return { url, matches: regex.test(url) }
      } catch {
        return { url, matches: false }
      }
    })

    setTestResults(results)
  }, [testPattern, urls, caseSensitive, validateRegex])

  const handleExportPatterns = useCallback(() => {
    const data = JSON.stringify(savedPatterns || [], null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `regex-patterns-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Patterns exported')
  }, [savedPatterns])

  const handleImportPatterns = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string) as RegexPattern[]
        setSavedPatterns(current => [...(current || []), ...imported])
        toast.success(`Imported ${imported.length} patterns`)
      } catch {
        toast.error('Failed to import patterns')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [setSavedPatterns])

  const protocolList: StreamingProtocol[] = [
    'http', 'https', 'rtsp', 'rtmp', 'rtmps', 'rtp', 'udp', 'hls', 'dash',
    'mms', 'mmsh', 'mmst', 'rtmpt', 'rtmpe', 'rtmpte', 'ftp', 'sftp',
    'srt', 'webrtc', 'icecast', 'shoutcast'
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FunnelSimple size={24} className="text-accent" />
        <h3 className="text-lg font-bold text-foreground">URL Pattern Filters</h3>
      </div>

      <Alert className="border-accent/30 bg-accent/5">
        <AlertDescription className="text-foreground text-xs">
          <Code size={14} className="inline mr-1" />
          Filter URLs by streaming protocol, custom regex patterns, host names, ports, or file extensions. Advanced filtering helps isolate specific types of media sources.
        </AlertDescription>
      </Alert>

      <Card className="bg-card border-border p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 bg-primary/30">
            <TabsTrigger value="protocols">Protocols</TabsTrigger>
            <TabsTrigger value="presets">Presets</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          <TabsContent value="protocols" className="space-y-4 mt-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Select Streaming Protocols:</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => toggleProtocol('all')}
                  variant={selectedProtocols.has('all') ? 'default' : 'outline'}
                  size="sm"
                  className={selectedProtocols.has('all') ? 'bg-accent text-accent-foreground' : 'border-border'}
                >
                  All Protocols ({urls.length})
                </Button>
                {protocolList.map(protocol => {
                  const count = protocolStats.get(protocol) || 0
                  const pattern = PROTOCOL_PATTERNS[protocol]
                  if (count === 0) return null
                  
                  return (
                    <Button
                      key={protocol}
                      onClick={() => toggleProtocol(protocol)}
                      variant={selectedProtocols.has(protocol) ? 'default' : 'outline'}
                      size="sm"
                      className={selectedProtocols.has(protocol) ? 'bg-accent text-accent-foreground' : 'border-border'}
                      title={pattern.description}
                    >
                      {pattern.name} ({count})
                    </Button>
                  )
                })}
              </div>
            </div>

            <Separator className="bg-border" />

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Protocol Statistics:</h4>
              <ScrollArea className="h-[200px] rounded-md border border-border bg-primary/30 p-4">
                <div className="space-y-2">
                  {Array.from(protocolStats.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([protocol, count]) => {
                      const pattern = PROTOCOL_PATTERNS[protocol]
                      const percentage = ((count / urls.length) * 100).toFixed(1)
                      
                      return (
                        <motion.div
                          key={protocol}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between p-2 rounded hover:bg-accent/10 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Broadcast size={16} className="text-accent" />
                            <div>
                              <div className="text-sm font-semibold text-foreground">
                                {pattern.name} ({protocol.toUpperCase()})
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {pattern.description}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-accent/30 text-accent">
                              {count} URLs ({percentage}%)
                            </Badge>
                            <Button
                              onClick={() => handleDownloadByProtocol(protocol)}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-accent/20 text-accent"
                              title="Download these URLs"
                            >
                              <DownloadSimple size={14} />
                            </Button>
                          </div>
                        </motion.div>
                      )
                    })}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="presets" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">Preset Regex Patterns</h4>
                <Badge variant="outline" className="border-accent/30 text-accent">
                  {PRESET_PATTERNS.length} presets available
                </Badge>
              </div>

              <Alert className="border-accent/30 bg-accent/5">
                <AlertDescription className="text-xs text-foreground">
                  <Sparkle size={14} className="inline mr-1" />
                  Click any preset to load it into the custom regex field. Presets include common patterns for quality, CDN, language, and category filtering.
                </AlertDescription>
              </Alert>

              <ScrollArea className="h-[350px] rounded-md border border-border bg-primary/30 p-4">
                <div className="space-y-3">
                  {PRESET_PATTERNS.map((preset, index) => (
                    <motion.div
                      key={preset.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      <Card className="bg-card border-border p-4 hover:border-accent/50 transition-colors cursor-pointer"
                        onClick={() => handleLoadPreset(preset)}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="text-sm font-semibold text-foreground">{preset.name}</h5>
                              <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 hover:bg-accent/20 text-accent"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleLoadPreset(preset)
                              }}
                            >
                              Load
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {preset.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <div className="font-mono text-xs text-accent bg-accent/5 rounded p-2 break-all">
                            {preset.pattern}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">Saved Custom Patterns</h4>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportPatterns}
                    className="hidden"
                    id="import-patterns"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-accent/30 hover:bg-accent/10 text-accent"
                    onClick={() => document.getElementById('import-patterns')?.click()}
                  >
                    <FileArrowUp size={16} className="mr-1" />
                    Import
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-accent/30 hover:bg-accent/10 text-accent"
                    onClick={handleExportPatterns}
                    disabled={(savedPatterns || []).length === 0}
                  >
                    <FileArrowDown size={16} className="mr-1" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-accent/30 hover:bg-accent/10 text-accent"
                    onClick={() => setShowSaveDialog(true)}
                    disabled={!customRegex}
                  >
                    <FloppyDisk size={16} className="mr-1" />
                    Save Current
                  </Button>
                </div>
              </div>

              {(savedPatterns || []).length === 0 ? (
                <Alert className="border-border">
                  <AlertDescription className="text-center text-muted-foreground py-4">
                    No saved patterns yet. Create a custom regex pattern in the Advanced tab and save it here for reuse.
                  </AlertDescription>
                </Alert>
              ) : (
                <ScrollArea className="h-[350px] rounded-md border border-border bg-primary/30 p-4">
                  <div className="space-y-3">
                    {(savedPatterns || []).map((pattern, index) => (
                      <motion.div
                        key={pattern.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                      >
                        <Card className="bg-card border-border p-4 hover:border-accent/50 transition-colors">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h5 className="text-sm font-semibold text-foreground">{pattern.name}</h5>
                                <p className="text-xs text-muted-foreground mt-1">{pattern.description}</p>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 hover:bg-accent/20 text-accent"
                                  onClick={() => handleLoadPreset(pattern)}
                                >
                                  Load
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-destructive/20 text-destructive"
                                  onClick={() => handleDeletePattern(pattern.id)}
                                >
                                  <TrashSimple size={14} />
                                </Button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {pattern.tags.map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {pattern.caseSensitive && (
                                <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-500">
                                  Case Sensitive
                                </Badge>
                              )}
                            </div>
                            <div className="font-mono text-xs text-accent bg-accent/5 rounded p-2 break-all">
                              {pattern.pattern}
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="custom-regex" className="text-sm font-medium text-foreground">
                    Custom Regex Pattern
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 border-accent/30 hover:bg-accent/10 text-accent"
                    onClick={() => setShowTestDialog(true)}
                    disabled={!customRegex}
                  >
                    <MagnifyingGlass size={14} className="mr-1" />
                    Test Pattern
                  </Button>
                </div>
                <div className="space-y-2">
                  <Textarea
                    id="custom-regex"
                    placeholder="e.g., .*\.m3u8.*quality=(high|4k).*&#10;or: https?://.*cdn.*\.mp4&#10;or: .*sport.*(720p|1080p).*"
                    value={customRegex}
                    onChange={(e) => {
                      setCustomRegex(e.target.value)
                      validateRegex(e.target.value)
                    }}
                    className="font-mono text-sm min-h-[80px]"
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="case-sensitive"
                      checked={caseSensitive}
                      onCheckedChange={(checked) => setCaseSensitive(checked as boolean)}
                    />
                    <label htmlFor="case-sensitive" className="text-xs text-muted-foreground cursor-pointer">
                      Case sensitive
                    </label>
                  </div>
                </div>
                {regexError && (
                  <Alert className="border-destructive/30 bg-destructive/5 mt-2">
                    <AlertDescription className="text-xs text-destructive">
                      <Warning size={14} className="inline mr-1" />
                      {regexError}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Use JavaScript regex patterns to match specific URL formats. Test your pattern before applying to see which URLs match.
                </p>
              </div>

              <div>
                <Label htmlFor="host-filter" className="text-sm font-medium text-foreground">
                  Filter by Host
                </Label>
                <Input
                  id="host-filter"
                  placeholder="e.g., example.com or 192.168.1"
                  value={hostFilter}
                  onChange={(e) => setHostFilter(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Match URLs containing this hostname or IP address
                </p>
              </div>

              <div>
                <Label htmlFor="port-filter" className="text-sm font-medium text-foreground">
                  Filter by Port
                </Label>
                <Input
                  id="port-filter"
                  type="number"
                  placeholder="e.g., 8080 or 554"
                  value={portFilter}
                  onChange={(e) => setPortFilter(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Match URLs using this specific port number
                </p>
              </div>

              <div>
                <Label htmlFor="extension-filter" className="text-sm font-medium text-foreground">
                  Filter by Extension
                </Label>
                <Input
                  id="extension-filter"
                  placeholder="e.g., m3u8, mp4, ts"
                  value={extensionFilter}
                  onChange={(e) => setExtensionFilter(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Match URLs ending with this file extension
                </p>
              </div>

              <Alert className="border-accent/30 bg-accent/5">
                <AlertDescription className="text-xs text-foreground">
                  <Warning size={14} className="inline mr-1" />
                  Advanced filters are applied in addition to protocol filters. Clear all filters to reset.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>

          <TabsContent value="results" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-foreground">Filtered Results</h4>
                <p className="text-xs text-muted-foreground">
                  {filteredUrls.length} of {urls.length} URLs match your filters
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleDownloadFiltered}
                  variant="outline"
                  size="sm"
                  className="border-accent/30 hover:bg-accent/10 text-accent"
                  disabled={filteredUrls.length === 0}
                >
                  <DownloadSimple size={16} className="mr-1" />
                  Download
                </Button>
                <Button
                  onClick={handleApplyFilters}
                  variant="outline"
                  size="sm"
                  className="border-accent/30 hover:bg-accent/10 text-accent"
                  disabled={filteredUrls.length === 0}
                >
                  <CheckCircle size={16} className="mr-1" weight="fill" />
                  Apply
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[300px] rounded-md border border-border bg-primary/30 p-4">
              <div className="space-y-2 font-mono text-sm">
                {filteredUrls.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No URLs match the current filters
                  </div>
                ) : (
                  filteredUrls.map((url, index) => {
                    const protocol = detectProtocol(url)
                    const pattern = PROTOCOL_PATTERNS[protocol]
                    
                    return (
                      <motion.div
                        key={`${url}-${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.01, 0.5) }}
                        className="p-2 rounded hover:bg-accent/10 transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-muted-foreground shrink-0">{index + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                                {pattern.name}
                              </Badge>
                            </div>
                            <div className="text-foreground/90 break-all text-xs">
                              {url}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </div>
            </ScrollArea>

            {filteredUrls.length > 0 && (
              <Alert className="border-accent/30 bg-accent/5">
                <AlertDescription className="text-xs text-foreground">
                  <CheckCircle size={14} className="inline mr-1" weight="fill" />
                  {filteredUrls.length} URLs ready. Click "Apply" to update the main results or "Download" to save.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>

        <Separator className="bg-border my-4" />

        <div className="flex justify-between">
          <Button
            onClick={handleClearFilters}
            variant="outline"
            size="sm"
            className="border-border"
          >
            Clear All Filters
          </Button>
          <Button
            onClick={handleDownloadReport}
            variant="outline"
            size="sm"
            className="border-accent/30 hover:bg-accent/10 text-accent"
          >
            <FileText size={16} className="mr-1" />
            Download Protocol Analysis
          </Button>
        </div>
      </Card>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FloppyDisk size={20} className="text-accent" />
              Save Custom Pattern
            </DialogTitle>
            <DialogDescription>
              Save your custom regex pattern for future use. Add a name, description, and tags to organize your patterns.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pattern-name" className="text-sm font-medium text-foreground">
                Pattern Name *
              </Label>
              <Input
                id="pattern-name"
                placeholder="e.g., HD Sports Streams"
                value={newPatternName}
                onChange={(e) => setNewPatternName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pattern-desc" className="text-sm font-medium text-foreground">
                Description
              </Label>
              <Textarea
                id="pattern-desc"
                placeholder="Describe what this pattern matches..."
                value={newPatternDesc}
                onChange={(e) => setNewPatternDesc(e.target.value)}
                className="min-h-[60px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pattern-tags" className="text-sm font-medium text-foreground">
                Tags (comma-separated)
              </Label>
              <Input
                id="pattern-tags"
                placeholder="e.g., sports, hd, quality"
                value={newPatternTags}
                onChange={(e) => setNewPatternTags(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Current Pattern</Label>
              <div className="font-mono text-xs text-accent bg-accent/5 rounded p-3 break-all border border-border">
                {customRegex}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={caseSensitive}
                  disabled
                />
                <span>Case sensitive: {caseSensitive ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowSaveDialog(false)}
              variant="outline"
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePattern}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={!newPatternName}
            >
              <FloppyDisk size={16} className="mr-2" />
              Save Pattern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MagnifyingGlass size={20} className="text-accent" />
              Test Regex Pattern
            </DialogTitle>
            <DialogDescription>
              Test your regex pattern against a sample of URLs to see which ones match. This helps validate your pattern before applying it.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="test-pattern" className="text-sm font-medium text-foreground">
                Pattern to Test
              </Label>
              <Textarea
                id="test-pattern"
                placeholder="Enter regex pattern..."
                value={testPattern}
                onChange={(e) => {
                  setTestPattern(e.target.value)
                  validateRegex(e.target.value)
                }}
                className="font-mono text-sm min-h-[80px]"
              />
              {regexError && (
                <Alert className="border-destructive/30 bg-destructive/5">
                  <AlertDescription className="text-xs text-destructive">
                    <Warning size={14} className="inline mr-1" />
                    {regexError}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Button
              onClick={handleTestPattern}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={!testPattern || !!regexError}
            >
              <MagnifyingGlass size={16} className="mr-2" />
              Test Against Sample URLs
            </Button>

            {testResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-foreground">
                    Test Results
                  </Label>
                  <Badge variant="outline" className="border-accent/30 text-accent">
                    {testResults.filter(r => r.matches).length} / {testResults.length} matches
                  </Badge>
                </div>

                <ScrollArea className="h-[300px] rounded-md border border-border bg-primary/30 p-4">
                  <div className="space-y-2">
                    {testResults.map((result, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        className={`p-3 rounded border ${
                          result.matches 
                            ? 'border-green-500/30 bg-green-500/5' 
                            : 'border-border bg-card/50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {result.matches ? (
                            <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" weight="fill" />
                          ) : (
                            <Warning size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-mono text-foreground break-all">
                              {result.url}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>

                <Alert className="border-accent/30 bg-accent/5">
                  <AlertDescription className="text-xs text-foreground">
                    <Sparkle size={14} className="inline mr-1" />
                    Testing against first 20 URLs in your dataset. Matches are highlighted in green.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setCustomRegex(testPattern)
                setShowTestDialog(false)
                setActiveTab('results')
                toast.success('Pattern applied')
              }}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={!testPattern || !!regexError}
            >
              <CheckCircle size={16} className="mr-2" weight="fill" />
              Use This Pattern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
