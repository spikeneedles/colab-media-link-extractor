import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { ArrowsClockwise, Plus, Trash, PencilSimple, CheckCircle, MagnifyingGlass, Play, ListNumbers, CaretRight, Code, Globe, ArrowLineDown, Lightning, Package, Broadcast, Television } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  type PaginationPattern,
  type PaginationRule,
  DEFAULT_PAGINATION_PATTERNS,
  DEFAULT_PAGINATION_RULES,
  loadPaginationRules,
  savePaginationRule,
  deletePaginationRule,
  loadPaginationPatterns,
  savePaginationPattern,
  deletePaginationPattern,
  detectPaginationPattern,
  matchPaginationRule,
  generatePaginatedUrls,
  crawlPaginatedSite
} from '@/lib/paginationRules'

export function PaginationManager() {
  const [rules, setRules] = useState<PaginationRule[]>([])
  const [patterns, setPatterns] = useState<PaginationPattern[]>([])
  const [showRuleDialog, setShowRuleDialog] = useState(false)
  const [showPatternDialog, setShowPatternDialog] = useState(false)
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [editingRule, setEditingRule] = useState<PaginationRule | null>(null)
  const [editingPattern, setEditingPattern] = useState<PaginationPattern | null>(null)
  const [testUrl, setTestUrl] = useState('')
  const [testResult, setTestResult] = useState<string[] | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [expandedRule, setExpandedRule] = useState<string | null>(null)
  const [showProviderPresets, setShowProviderPresets] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = useCallback(() => {
    setRules(loadPaginationRules())
    setPatterns(loadPaginationPatterns())
  }, [])

  const PROVIDER_PRESETS = [
    {
      id: 'iptv-org',
      name: 'IPTV-Org',
      description: 'Official IPTV-Org repository with country and category pages',
      icon: <Television size={20} className="text-purple-500" weight="fill" />,
      ruleId: 'iptv-org-provider',
      testUrl: 'https://github.com/iptv-org/iptv'
    },
    {
      id: 'free-iptv',
      name: 'Free-IPTV',
      description: 'Free-IPTV countries repository with multiple pages',
      icon: <Broadcast size={20} className="text-blue-500" weight="fill" />,
      ruleId: 'free-iptv-provider',
      testUrl: 'https://github.com/Free-IPTV/Countries'
    },
    {
      id: 'awesome-iptv',
      name: 'Awesome-IPTV',
      description: 'Curated IPTV lists and directory pages',
      icon: <ListNumbers size={20} className="text-green-500" weight="fill" />,
      ruleId: 'awesome-iptv-provider',
      testUrl: 'https://github.com/awesome-iptv'
    },
    {
      id: 'xtream-codes',
      name: 'Xtream Codes',
      description: 'Xtream Codes panels with API pagination',
      icon: <Code size={20} className="text-orange-500" weight="fill" />,
      ruleId: 'xtream-codes-panels',
      testUrl: 'http://example.com:8080'
    },
    {
      id: 'm3u-directories',
      name: 'M3U Directories',
      description: 'M3U playlist file directories with index pages',
      icon: <Package size={20} className="text-cyan-500" weight="fill" />,
      ruleId: 'm3u-playlist-directories',
      testUrl: 'http://example.com/playlists/'
    },
    {
      id: 'epg-guides',
      name: 'EPG TV Guides',
      description: 'Electronic Program Guide sites with date pagination',
      icon: <Globe size={20} className="text-pink-500" weight="fill" />,
      ruleId: 'epg-guide-sites',
      testUrl: 'https://example.com/epg'
    }
  ]

  const handleLoadProviderPreset = useCallback((presetId: string) => {
    const preset = PROVIDER_PRESETS.find(p => p.id === presetId)
    if (!preset) return

    const defaultRule = DEFAULT_PAGINATION_RULES.find(r => r.id === preset.ruleId)
    if (!defaultRule) {
      toast.error('Provider preset not found')
      return
    }

    const existingRule = rules.find(r => r.id === preset.ruleId)
    if (existingRule) {
      toast.info(`${preset.name} rule already loaded`)
      return
    }

    savePaginationRule(defaultRule)
    loadData()
    toast.success(`Loaded ${preset.name} pagination rules`)
  }, [rules, loadData])

  const handleSaveRule = useCallback((rule: PaginationRule) => {
    savePaginationRule(rule)
    loadData()
    setShowRuleDialog(false)
    setEditingRule(null)
    toast.success('Pagination rule saved')
  }, [loadData])

  const handleDeleteRule = useCallback((ruleId: string) => {
    deletePaginationRule(ruleId)
    loadData()
    toast.success('Pagination rule deleted')
  }, [loadData])

  const handleSavePattern = useCallback((pattern: PaginationPattern) => {
    savePaginationPattern(pattern)
    loadData()
    setShowPatternDialog(false)
    setEditingPattern(null)
    toast.success('Pagination pattern saved')
  }, [loadData])

  const handleDeletePattern = useCallback((patternId: string) => {
    deletePaginationPattern(patternId)
    loadData()
    toast.success('Pagination pattern deleted')
  }, [loadData])

  const handleTestUrl = useCallback(async () => {
    if (!testUrl) {
      toast.error('Please enter a URL to test')
      return
    }

    setIsTesting(true)
    toast.loading('Testing pagination...', { id: 'test-pagination' })

    try {
      const urls = await crawlPaginatedSite(testUrl, {
        maxPages: 10,
        autoDetect: true,
        onPageDiscovered: (url, pageNumber) => {
          console.log(`Page ${pageNumber}: ${url}`)
        }
      })

      setTestResult(urls)
      toast.success(`Found ${urls.length} pages`, { id: 'test-pagination' })
    } catch (error) {
      toast.error('Failed to test pagination', { id: 'test-pagination' })
      console.error('Test error:', error)
    } finally {
      setIsTesting(false)
    }
  }, [testUrl])

  const handleQuickTest = useCallback(async (url: string) => {
    setTestUrl(url)
    setShowTestDialog(true)
    
    try {
      const rule = matchPaginationRule(url)
      if (rule) {
        toast.success(`Matched rule: ${rule.name}`)
      } else {
        toast.info('No matching rule found, will try auto-detection')
      }
    } catch (error) {
      console.error('Quick test error:', error)
    }
  }, [])

  const getPatternTypeIcon = (type: PaginationPattern['type']) => {
    switch (type) {
      case 'url_param': return <Globe size={16} className="text-blue-500" />
      case 'path_segment': return <Code size={16} className="text-green-500" />
      case 'button_click': return <Play size={16} className="text-purple-500" />
      case 'infinite_scroll': return <ArrowLineDown size={16} className="text-orange-500" />
      case 'next_link': return <CaretRight size={16} className="text-cyan-500" />
      case 'custom': return <Lightning size={16} className="text-yellow-500" />
      default: return <ListNumbers size={16} className="text-muted-foreground" />
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ArrowsClockwise size={24} className="text-accent" />
        <h3 className="text-lg font-bold text-foreground">Pagination Rules</h3>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Configure automatic pagination detection to crawl multi-page IPTV lists, playlist directories, and streaming sites. The crawler will automatically follow pagination patterns to discover all pages.
      </p>

      <Alert className="border-accent/30 bg-accent/5">
        <AlertDescription className="text-foreground text-xs">
          <ArrowsClockwise size={14} className="inline mr-1" />
          <strong>Provider Presets:</strong> Load pre-configured pagination rules for popular IPTV providers like IPTV-Org, Free-IPTV, Xtream Codes, and more. Click "Load Provider Presets" to get started quickly.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-semibold text-foreground">Provider Presets</h4>
          <Button
            onClick={() => setShowProviderPresets(!showProviderPresets)}
            variant="outline"
            size="sm"
            className="border-accent/30 hover:bg-accent/10 text-accent"
          >
            {showProviderPresets ? 'Hide' : 'Show'} Presets ({PROVIDER_PRESETS.length})
          </Button>
        </div>

        {showProviderPresets && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {PROVIDER_PRESETS.map((preset, index) => {
              const isLoaded = rules.some(r => r.id === preset.ruleId)
              return (
                <motion.div
                  key={preset.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className={`p-4 rounded-lg border transition-all ${
                    isLoaded 
                      ? 'border-green-500/30 bg-green-500/5' 
                      : 'border-border bg-card hover:border-accent/50'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="shrink-0 mt-0.5">{preset.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-semibold text-foreground">{preset.name}</h5>
                        {isLoaded && (
                          <Badge variant="outline" className="text-xs border-green-500/30 text-green-500">
                            <CheckCircle size={12} className="mr-1" weight="fill" />
                            Loaded
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{preset.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleLoadProviderPreset(preset.id)}
                      disabled={isLoaded}
                      size="sm"
                      className={`flex-1 ${
                        isLoaded 
                          ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                          : 'bg-accent text-accent-foreground hover:bg-accent/90'
                      }`}
                    >
                      <Plus size={14} className="mr-1" />
                      {isLoaded ? 'Loaded' : 'Load Rules'}
                    </Button>
                    <Button
                      onClick={() => handleQuickTest(preset.testUrl)}
                      variant="outline"
                      size="sm"
                      className="border-accent/30 hover:bg-accent/10 text-accent"
                      title="Test pagination"
                    >
                      <Play size={14} />
                    </Button>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>

      <Separator className="bg-border" />

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setEditingRule(null)
            setShowRuleDialog(true)
          }}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Plus size={16} className="mr-1" />
          Add Custom Rule
        </Button>
        <Button
          onClick={() => {
            setEditingPattern(null)
            setShowPatternDialog(true)
          }}
          variant="outline"
          className="border-accent/30 hover:bg-accent/10 text-accent"
        >
          <Plus size={16} className="mr-1" />
          Add Custom Pattern
        </Button>
        <Button
          onClick={() => setShowTestDialog(true)}
          variant="outline"
          className="border-accent/30 hover:bg-accent/10 text-accent"
        >
          <MagnifyingGlass size={16} className="mr-1" />
          Test URL
        </Button>
      </div>

      <div className="space-y-3">
        <h4 className="text-md font-semibold text-foreground">Active Rules ({rules.filter(r => r.enabled).length})</h4>
        
        {rules.length === 0 ? (
          <Alert className="border-border bg-card">
            <AlertDescription className="text-muted-foreground text-sm text-center py-4">
              No pagination rules configured. Default patterns will be used for auto-detection.
            </AlertDescription>
          </Alert>
        ) : (
          <ScrollArea className="h-[400px] rounded-md border border-border bg-primary/30 p-4">
            <div className="space-y-3">
              <AnimatePresence>
                {rules.map((rule, index) => (
                  <motion.div
                    key={rule.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className="rounded-lg border border-border bg-card p-4 hover:border-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-semibold text-foreground">{rule.name}</h5>
                          {rule.enabled ? (
                            <Badge variant="outline" className="text-xs border-green-500/30 text-green-500">
                              <CheckCircle size={12} className="mr-1" weight="fill" />
                              Enabled
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-muted-foreground/30 text-muted-foreground">
                              Disabled
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono break-all">
                          Pattern: {rule.urlPattern}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          onClick={() => handleQuickTest(`https://example.com/${rule.urlPattern.replace(/\.\*/g, 'test')}`)}
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-accent/20 text-accent"
                          title="Test rule"
                        >
                          <Play size={14} />
                        </Button>
                        <Button
                          onClick={() => {
                            setEditingRule(rule)
                            setShowRuleDialog(true)
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-accent/20 text-accent"
                          title="Edit rule"
                        >
                          <PencilSimple size={14} />
                        </Button>
                        <Button
                          onClick={() => handleDeleteRule(rule.id)}
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-destructive/20 text-destructive"
                          title="Delete rule"
                        >
                          <Trash size={14} />
                        </Button>
                      </div>
                    </div>

                    <Button
                      onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {expandedRule === rule.id ? '▼' : '▶'} {rule.patterns.length} patterns
                    </Button>

                    {expandedRule === rule.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 space-y-2"
                      >
                        {rule.patterns.map((pattern) => (
                          <div
                            key={pattern.id}
                            className="p-2 rounded bg-secondary/30 border border-border/50"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {getPatternTypeIcon(pattern.type)}
                              <span className="text-xs font-semibold text-foreground">{pattern.name}</span>
                              {pattern.enabled && (
                                <CheckCircle size={12} className="text-green-500 ml-auto" weight="fill" />
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{pattern.description}</div>
                            {pattern.pattern && (
                              <div className="text-xs font-mono text-accent mt-1">
                                Pattern: {pattern.pattern}
                              </div>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </div>

      <Separator className="bg-border" />

      <div className="space-y-3">
        <h4 className="text-md font-semibold text-foreground">Available Patterns ({patterns.filter(p => p.enabled).length})</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {patterns.slice(0, 6).map((pattern) => (
            <div
              key={pattern.id}
              className="p-3 rounded-lg border border-border bg-card hover:border-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                {getPatternTypeIcon(pattern.type)}
                <span className="text-sm font-semibold text-foreground">{pattern.name}</span>
                {pattern.enabled && (
                  <CheckCircle size={12} className="text-green-500 ml-auto" weight="fill" />
                )}
              </div>
              <div className="text-xs text-muted-foreground mb-2">{pattern.description}</div>
              <div className="flex items-center justify-between text-xs">
                <Badge variant="outline" className="text-xs uppercase">{pattern.type}</Badge>
                {pattern.maxPages && (
                  <span className="text-muted-foreground">Max: {pattern.maxPages} pages</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {patterns.length > 6 && (
          <div className="text-center">
            <span className="text-xs text-muted-foreground">
              ... and {patterns.length - 6} more patterns
            </span>
          </div>
        )}
      </div>

      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MagnifyingGlass size={20} className="text-accent" />
              Test Pagination Detection
            </DialogTitle>
            <DialogDescription>
              Test URL to see which pagination patterns are detected and preview generated pages.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Test URL</label>
              <Input
                placeholder="https://example.com/playlists"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <Button
              onClick={handleTestUrl}
              disabled={isTesting || !testUrl}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Play size={16} className="mr-2" />
              {isTesting ? 'Testing...' : 'Test Pagination'}
            </Button>

            {testResult && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Discovered Pages ({testResult.length})</span>
                  <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                    {testResult.length} URLs
                  </Badge>
                </div>
                <ScrollArea className="h-[200px] rounded-md border border-border bg-primary/30 p-3">
                  <div className="space-y-1 font-mono text-xs">
                    {testResult.map((url, index) => (
                      <div key={index} className="text-foreground/90">
                        {index + 1}. {url}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowTestDialog(false)
                setTestResult(null)
              }}
              variant="outline"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
