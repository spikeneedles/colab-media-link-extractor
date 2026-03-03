import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  MagnifyingGlass, 
  Globe, 
  Database, 
  ListBullets, 
  Link as LinkIcon, 
  Image as ImageIcon,
  VideoCamera,
  FileText,
  Code,
  Play,
  Spinner,
  CheckCircle,
  Warning,
  ArrowRight,
  CaretRight
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002'

// Puppeteer crawling actions
const CRAWLER_ACTIONS = [
  { 
    id: 'search', 
    name: 'Search Website', 
    icon: MagnifyingGlass,
    description: 'Use website search forms to find and scrape results, optionally extract media/metadata from each',
    inputs: ['preset', 'query', 'maxPages', 'extractMedia']
  },
  { 
    id: 'scrape-urls', 
    name: 'Scrape URLs from Page', 
    icon: LinkIcon,
    description: 'Extract all URLs from a webpage',
    inputs: ['url', 'selector', 'maxDepth']
  },
  { 
    id: 'extract-media', 
    name: 'Extract Media & Metadata', 
    icon: VideoCamera,
    description: 'Get all video/audio sources and page metadata (title, description, OG tags)',
    inputs: ['url', 'includeEmbedded']
  },
  { 
    id: 'extract-images', 
    name: 'Extract Images', 
    icon: ImageIcon,
    description: 'Get all image URLs and their attributes',
    inputs: ['url', 'minWidth', 'minHeight']
  },
  { 
    id: 'navigate-click', 
    name: 'Navigate & Click Elements', 
    icon: Play,
    description: 'Navigate to page and click specific elements',
    inputs: ['url', 'selector', 'waitForSelector']
  },
  { 
    id: 'list-links', 
    name: 'List All Links', 
    icon: ListBullets,
    description: 'Get all links with titles and metadata',
    inputs: ['url', 'filterPattern']
  },
  { 
    id: 'scrape-sitemap', 
    name: 'Scrape Sitemap', 
    icon: Globe,
    description: 'Parse XML sitemap and extract all URLs',
    inputs: ['url']
  },
  { 
    id: 'custom-script', 
    name: 'Run Custom Script', 
    icon: Code,
    description: 'Execute custom JavaScript in page context',
    inputs: ['url', 'script']
  }
]

interface SearchPreset {
  id: string
  name: string
  baseUrl: string
  searchMethod: string
  supportsForm: boolean
  supportsUrl: boolean
  supportsPagination: boolean
}

interface SearchResult {
  url: string
  title?: string
  thumbnail?: string
  metadata?: Record<string, string>
  sourceConfig: string
  searchQuery: string
  pageNumber: number
  mediaUrls?: string[]
  audioUrls?: string[]
}

interface CrawlerResult {
  action: string
  success: boolean
  data?: any
  error?: string
  executionTime?: number
  totalResults?: number
  pagesScraped?: number
}

interface SearchCrawlerUIProps {
  onPlayMedia?: (urls: string[], mediaType: 'video' | 'audio', title: string) => void
}

export function SearchCrawlerUI({ onPlayMedia }: SearchCrawlerUIProps = {}) {
  const [selectedAction, setSelectedAction] = useState<string>('search')
  const [presets, setPresets] = useState<SearchPreset[]>([])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<CrawlerResult | null>(null)
  
  // Input states
  const [selectedPreset, setSelectedPreset] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [maxPages, setMaxPages] = useState<string>('3')
  const [extractMedia, setExtractMedia] = useState(false)
  const [targetUrl, setTargetUrl] = useState<string>('')
  const [cssSelector, setCssSelector] = useState<string>('')
  const [maxDepth, setMaxDepth] = useState<string>('1')
  const [includeEmbedded, setIncludeEmbedded] = useState(false)
  const [minWidth, setMinWidth] = useState<string>('200')
  const [minHeight, setMinHeight] = useState<string>('200')
  const [waitForSelector, setWaitForSelector] = useState<string>('')
  const [filterPattern, setFilterPattern] = useState<string>('')
  const [customScript, setCustomScript] = useState<string>('')

  useEffect(() => {
    loadPresets()
  }, [])

  const loadPresets = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/search/presets`)
      const data = await response.json()
      if (data.success) {
        setPresets(data.presets)
        if (data.presets.length > 0) {
          setSelectedPreset(data.presets[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load presets:', error)
    }
  }

  const executeAction = async () => {
    setLoading(true)
    setResults(null)

    try {
      let response: Response | null = null

      switch (selectedAction) {
        case 'search':
          if (!selectedPreset || !searchQuery) {
            toast.error('Please select a preset and enter a search query')
            setLoading(false)
            return
          }
          response = await fetch(`${BACKEND_URL}/api/search/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              presetId: selectedPreset,
              query: searchQuery,
              maxPages: parseInt(maxPages) || 3,
              extractMediaFromResults: extractMedia
            })
          })
          break

        case 'scrape-urls':
          if (!targetUrl) {
            toast.error('Please enter a target URL')
            setLoading(false)
            return
          }
          // TODO: Implement scrape-urls endpoint
          toast.info('URL scraping endpoint coming soon')
          setLoading(false)
          return

        case 'extract-media':
          if (!targetUrl) {
            toast.error('Please enter a target URL')
            setLoading(false)
            return
          }
          // Combines video/audio/metadata extraction - automatically gets everything with media URLs
          toast.info('Media & metadata extraction endpoint coming soon')
          setLoading(false)
          return

        case 'extract-images':
          if (!targetUrl) {
            toast.error('Please enter a target URL')
            setLoading(false)
            return
          }
          // TODO: Implement extract-images endpoint
          toast.info('Image extraction endpoint coming soon')
          setLoading(false)
          return

        case 'navigate-click':
          if (!targetUrl) {
            toast.error('Please enter a target URL')
            setLoading(false)
            return
          }
          // TODO: Implement navigate-click endpoint
          toast.info('Navigation & click endpoint coming soon')
          setLoading(false)
          return

        case 'list-links':
          if (!targetUrl) {
            toast.error('Please enter a target URL')
            setLoading(false)
            return
          }
          // TODO: Implement list-links endpoint
          toast.info('Link listing endpoint coming soon')
          setLoading(false)
          return

        case 'scrape-sitemap':
          if (!targetUrl) {
            toast.error('Please enter a target URL')
            setLoading(false)
            return
          }
          // TODO: Implement scrape-sitemap endpoint
          toast.info('Sitemap scraping endpoint coming soon')
          setLoading(false)
          return

        case 'custom-script':
          if (!targetUrl || !customScript) {
            toast.error('Please enter a target URL and custom script')
            setLoading(false)
            return
          }
          // TODO: Implement custom-script endpoint
          toast.info('Custom script endpoint coming soon')
          setLoading(false)
          return

        default:
          toast.info('This action is not yet implemented')
          setLoading(false)
          return
      }

      if (response) {
        const data = await response.json()
        
        if (data.success) {
          const crawlerResult: CrawlerResult = {
            action: selectedAction,
            success: true,
            data: data.result,
            executionTime: data.result.executionTime,
            totalResults: data.result.totalResults,
            pagesScraped: data.result.pagesScraped
          }
          setResults(crawlerResult)
          toast.success(`Found ${data.result.totalResults} results in ${(data.result.executionTime / 1000).toFixed(2)}s`)
        } else {
          setResults({
            action: selectedAction,
            success: false,
            error: data.error || 'Unknown error'
          })
          toast.error(data.error || 'Action failed')
        }
      }
    } catch (error) {
      console.error('Crawler action failed:', error)
      setResults({
        action: selectedAction,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      toast.error('Failed to execute action')
    } finally {
      setLoading(false)
    }
  }

  const renderInputFields = () => {
    const action = CRAWLER_ACTIONS.find(a => a.id === selectedAction)
    if (!action) return null

    return (
      <motion.div
        key={selectedAction}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <action.icon className="h-4 w-4" />
          <span>{action.description}</span>
        </div>

        <Separator />

        {action.inputs.includes('preset') && (
          <div className="space-y-2">
            <Label htmlFor="preset">Search Provider</Label>
            <Select value={selectedPreset} onValueChange={setSelectedPreset}>
              <SelectTrigger id="preset">
                <SelectValue placeholder="Select a search provider" />
              </SelectTrigger>
              <SelectContent>
                {presets.map(preset => (
                  <SelectItem key={preset.id} value={preset.id}>
                    <div className="flex items-center gap-2">
                      <span>{preset.name}</span>
                      {preset.supportsPagination && (
                        <Badge variant="outline" className="text-xs">Pagination</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {action.inputs.includes('query') && (
          <div className="space-y-2">
            <Label htmlFor="query">Search Query</Label>
            <Input
              id="query"
              placeholder="Enter what you want to search for..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        {action.inputs.includes('maxPages') && (
          <div className="space-y-2">
            <Label htmlFor="maxPages">Maximum Pages to Crawl</Label>
            <Input
              id="maxPages"
              type="number"
              min="1"
              max="20"
              placeholder="3"
              value={maxPages}
              onChange={(e) => setMaxPages(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              How many result pages to scrape (more pages = longer execution time)
            </p>
          </div>
        )}

        {action.inputs.includes('extractMedia') && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="extractMedia"
              checked={extractMedia}
              onCheckedChange={(checked) => setExtractMedia(checked as boolean)}
            />
            <Label htmlFor="extractMedia" className="font-normal">
              Extract media & metadata from each result (slower but gets all streams)
            </Label>
          </div>
        )}

        {action.inputs.includes('url') && (
          <div className="space-y-2">
            <Label htmlFor="url">Target URL</Label>
            <Input
              id="url"
              placeholder="https://example.com/page"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The webpage to scrape or extract data from
            </p>
          </div>
        )}

        {action.inputs.includes('selector') && (
          <div className="space-y-2">
            <Label htmlFor="selector">CSS Selector (Optional)</Label>
            <Input
              id="selector"
              placeholder=".content a, div.links a"
              value={cssSelector}
              onChange={(e) => setCssSelector(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Target specific elements using CSS selectors
            </p>
          </div>
        )}

        {action.inputs.includes('maxDepth') && (
          <div className="space-y-2">
            <Label htmlFor="maxDepth">Crawl Depth</Label>
            <Input
              id="maxDepth"
              type="number"
              min="1"
              max="5"
              placeholder="1"
              value={maxDepth}
              onChange={(e) => setMaxDepth(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              How many levels deep to follow links (1 = only current page)
            </p>
          </div>
        )}

        {action.inputs.includes('includeEmbedded') && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeEmbedded"
              checked={includeEmbedded}
              onCheckedChange={(checked) => setIncludeEmbedded(checked as boolean)}
            />
            <Label htmlFor="includeEmbedded" className="font-normal">
              Include embedded media from iframes
            </Label>
          </div>
        )}

        {action.inputs.includes('minWidth') && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minWidth">Min Width (px)</Label>
              <Input
                id="minWidth"
                type="number"
                placeholder="200"
                value={minWidth}
                onChange={(e) => setMinWidth(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minHeight">Min Height (px)</Label>
              <Input
                id="minHeight"
                type="number"
                placeholder="200"
                value={minHeight}
                onChange={(e) => setMinHeight(e.target.value)}
              />
            </div>
          </div>
        )}

        {action.inputs.includes('waitForSelector') && (
          <div className="space-y-2">
            <Label htmlFor="waitForSelector">Wait For Selector</Label>
            <Input
              id="waitForSelector"
              placeholder=".results-loaded, #content"
              value={waitForSelector}
              onChange={(e) => setWaitForSelector(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Wait for this element to appear before continuing
            </p>
          </div>
        )}

        {action.inputs.includes('filterPattern') && (
          <div className="space-y-2">
            <Label htmlFor="filterPattern">Filter Pattern (Optional)</Label>
            <Input
              id="filterPattern"
              placeholder=".*\.mp4$, .*video.*"
              value={filterPattern}
              onChange={(e) => setFilterPattern(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Regex pattern to filter results
            </p>
          </div>
        )}

        {action.inputs.includes('script') && (
          <div className="space-y-2">
            <Label htmlFor="script">Custom JavaScript</Label>
            <textarea
              id="script"
              className="w-full h-32 px-3 py-2 text-sm border rounded-md bg-background"
              placeholder="return document.querySelectorAll('a').length"
              value={customScript}
              onChange={(e) => setCustomScript(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              JavaScript code to execute in page context (must return a value)
            </p>
          </div>
        )}
      </motion.div>
    )
  }

  const renderResults = () => {
    if (!results) return null

    if (!results.success) {
      return (
        <Card className="p-6 border-destructive/50">
          <div className="flex items-start gap-3">
            <Warning className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <h3 className="font-medium text-destructive">Action Failed</h3>
              <p className="text-sm text-muted-foreground mt-1">{results.error}</p>
            </div>
          </div>
        </Card>
      )
    }

    // Render search results
    if (results.action === 'search' && results.data?.results) {
      const searchResults = results.data.results as SearchResult[]

      return (
        <div className="space-y-4">
          <Card className="p-4 border-green-500/50">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <h3 className="font-medium">Search Complete</h3>
                <p className="text-sm text-muted-foreground">
                  Found {results.totalResults} results across {results.pagesScraped} pages 
                  in {((results.executionTime || 0) / 1000).toFixed(2)}s
                </p>
              </div>
            </div>
          </Card>

          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {searchResults.map((result, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="p-4 hover:border-primary/50 transition-colors">
                    <div className="flex gap-4">
                      {result.thumbnail && (
                        <img
                          src={result.thumbnail}
                          alt={result.title || 'Result'}
                          className="w-32 h-20 object-cover rounded"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{result.title || 'Untitled'}</h4>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {result.url}
                        </p>
                        {result.metadata && Object.keys(result.metadata).length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Object.entries(result.metadata).map(([key, value]) => (
                              <Badge key={key} variant="secondary" className="text-xs">
                                {key}: {value}
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        {/* Show extracted media URLs */}
                        {(result.mediaUrls?.length || 0) > 0 && (
                          <div className="mt-3">
                            <div className="text-xs font-medium text-muted-foreground mb-2">
                              Videos ({result.mediaUrls?.length}):
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {result.mediaUrls?.map((url, urlIndex) => (
                                <Button
                                  key={urlIndex}
                                  size="sm"
                                  variant="secondary"
                                  className="gap-1 text-xs"
                                  onClick={() => onPlayMedia?.([url], 'video', result.title || 'Untitled')}
                                >
                                  <Play className="h-3 w-3" />
                                  Video {urlIndex + 1}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {(result.audioUrls?.length || 0) > 0 && (
                          <div className="mt-3">
                            <div className="text-xs font-medium text-muted-foreground mb-2">
                              Audio ({result.audioUrls?.length}):
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {result.audioUrls?.map((url, urlIndex) => (
                                <Button
                                  key={urlIndex}
                                  size="sm"
                                  variant="secondary"
                                  className="gap-1 text-xs"
                                  onClick={() => onPlayMedia?.([url], 'audio', result.title || 'Untitled')}
                                >
                                  <Play className="h-3 w-3" />
                                  Audio {urlIndex + 1}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <Badge variant="outline" className="mt-2 text-xs">
                          Page {result.pageNumber}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          window.open(result.url, '_blank')
                        }}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )
    }

    return (
      <Card className="p-6">
        <pre className="text-xs overflow-auto">
          {JSON.stringify(results.data, null, 2)}
        </pre>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-[320px_1fr] gap-6 h-full">
      {/* Left Panel - Action Selector */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Crawler Actions</h2>
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-2">
            {CRAWLER_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => setSelectedAction(action.id)}
                className={`
                  w-full text-left px-3 py-3 rounded-lg transition-all
                  ${selectedAction === action.id 
                    ? 'bg-primary text-primary-foreground shadow-md' 
                    : 'hover:bg-accent hover:text-accent-foreground'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <action.icon className={`h-5 w-5 shrink-0 ${
                    selectedAction === action.id ? '' : 'text-muted-foreground'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{action.name}</div>
                    <div className={`text-xs mt-0.5 ${
                      selectedAction === action.id 
                        ? 'text-primary-foreground/70' 
                        : 'text-muted-foreground'
                    }`}>
                      {action.description}
                    </div>
                  </div>
                  {selectedAction === action.id && (
                    <CaretRight className="h-4 w-4" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Right Panel - Input Fields and Results */}
      <div className="space-y-6">
        {/* Input Section */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">
                {CRAWLER_ACTIONS.find(a => a.id === selectedAction)?.name}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure the crawling parameters
              </p>
            </div>
            <Button
              onClick={executeAction}
              disabled={loading}
              size="lg"
              className="min-w-[120px]"
            >
              {loading ? (
                <>
                  <Spinner className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Go
                </>
              )}
            </Button>
          </div>

          {renderInputFields()}
        </Card>

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {results && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Results</h3>
                {renderResults()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
