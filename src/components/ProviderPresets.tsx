import { useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Globe, Package, Database, CheckCircle, PlayCircle, StopCircle, Sparkle, MagnifyingGlass, FunnelSimple, Lightning, Rocket, DownloadSimple, FileText } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { IPTV_PROVIDER_PRESETS, getPresetsByCategory, getPresetsByTag, getAllTags, type ProviderPreset, type ScanProgress } from '@/lib/providerPresets'
import { scanRepositoryUrls, type RepositoryScanResult } from '@/lib/linkExtractor'
import { scanPlaylistUrls, type PlaylistScanResult, type PlaylistAuthCredentials } from '@/lib/linkExtractor'
import { scanXtreamCodesAPI, type XtreamCodesCredentials, type XtreamCodesScanResult, convertXtreamCodesToLinks } from '@/lib/linkExtractor'
import { scanWebUrls } from '@/lib/linkExtractor'
import { RabbitLoader } from '@/components/AnimatedRabbit'

interface ProviderPresetsProps {
  onScanComplete?: (results: any) => void
}

export function ProviderPresets({ onScanComplete }: ProviderPresetsProps) {
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set())
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<ScanProgress[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterTag, setFilterTag] = useState<string>('all')
  const [showResults, setShowResults] = useState(false)
  const [totalLinksFound, setTotalLinksFound] = useState(0)
  const [xtreamCredentials, setXtreamCredentials] = useState<Map<string, XtreamCodesCredentials>>(new Map())
  const [combinedResults, setCombinedResults] = useState<any>(null)

  const allTags = getAllTags()

  const filteredPresets = IPTV_PROVIDER_PRESETS.filter(preset => {
    const matchesSearch = searchQuery === '' || 
      preset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      preset.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      preset.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesCategory = filterCategory === 'all' || preset.category === filterCategory
    const matchesTag = filterTag === 'all' || preset.tags.includes(filterTag)
    
    return matchesSearch && matchesCategory && matchesTag
  })

  const togglePreset = useCallback((presetId: string) => {
    setSelectedPresets(prev => {
      const newSet = new Set(prev)
      if (newSet.has(presetId)) {
        newSet.delete(presetId)
      } else {
        newSet.add(presetId)
      }
      return newSet
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedPresets(new Set(filteredPresets.map(p => p.id)))
  }, [filteredPresets])

  const clearAll = useCallback(() => {
    setSelectedPresets(new Set())
  }, [])

  const handleQuickSelect = useCallback((type: 'all-sources' | 'github-only' | 'free-only') => {
    switch (type) {
      case 'all-sources':
        setSelectedPresets(new Set(['all-sources']))
        break
      case 'github-only':
        setSelectedPresets(new Set(IPTV_PROVIDER_PRESETS.filter(p => p.category === 'github').map(p => p.id)))
        break
      case 'free-only':
        setSelectedPresets(new Set(IPTV_PROVIDER_PRESETS.filter(p => p.tags.includes('free')).map(p => p.id)))
        break
    }
  }, [])

  const handleScanPresets = useCallback(async () => {
    if (selectedPresets.size === 0) {
      toast.error('Please select at least one provider preset')
      return
    }

    setIsScanning(true)
    setShowResults(false)
    setTotalLinksFound(0)

    const presetsToScan = Array.from(selectedPresets)
      .map(id => IPTV_PROVIDER_PRESETS.find(p => p.id === id))
      .filter(Boolean) as ProviderPreset[]

    const initialProgress: ScanProgress[] = presetsToScan.map(preset => ({
      provider: preset.name,
      current: 0,
      total: preset.sources.length,
      status: 'pending',
      linksFound: 0
    }))

    setScanProgress(initialProgress)

    toast.loading(`Starting scan of ${presetsToScan.length} provider${presetsToScan.length !== 1 ? 's' : ''}...`, { id: 'preset-scan' })

    const allResults = {
      repositories: [] as RepositoryScanResult[],
      playlists: [] as PlaylistScanResult[],
      xtream: [] as XtreamCodesScanResult[],
      web: [] as any[]
    }

    let totalLinks = 0

    for (let i = 0; i < presetsToScan.length; i++) {
      const preset = presetsToScan[i]

      setScanProgress(prev => prev.map(p => 
        p.provider === preset.name ? { ...p, status: 'scanning' } : p
      ))

      toast.loading(`Scanning ${preset.name}...`, { id: 'preset-scan' })

      try {
        for (let j = 0; j < preset.sources.length; j++) {
          const source = preset.sources[j]

          setScanProgress(prev => prev.map(p => 
            p.provider === preset.name ? { ...p, current: j + 1 } : p
          ))

          try {
            if (source.type === 'github' && source.url) {
              const results = await scanRepositoryUrls([source.url], () => {})
              allResults.repositories.push(...results)
              
              const linksInResults = results.reduce((sum, r) => sum + (r.totalLinks || 0), 0)
              totalLinks += linksInResults

              setScanProgress(prev => prev.map(p => 
                p.provider === preset.name ? { ...p, linksFound: p.linksFound + linksInResults } : p
              ))
            } else if (source.type === 'playlist' && source.url) {
              const results = await scanPlaylistUrls([source.url], () => {}, new Map())
              allResults.playlists.push(...results)
              
              const linksInResults = results.reduce((sum, r) => sum + (r.totalLinks || 0), 0)
              totalLinks += linksInResults

              setScanProgress(prev => prev.map(p => 
                p.provider === preset.name ? { ...p, linksFound: p.linksFound + linksInResults } : p
              ))
            } else if (source.type === 'xtream' && source.serverUrl && source.username && source.password) {
              const credentials: XtreamCodesCredentials = {
                serverUrl: source.serverUrl,
                username: source.username,
                password: source.password
              }
              const result = await scanXtreamCodesAPI(credentials, () => {})
              if (result.success) {
                allResults.xtream.push(result)
                totalLinks += result.totalStreams
                
                setScanProgress(prev => prev.map(p => 
                  p.provider === preset.name ? { ...p, linksFound: p.linksFound + result.totalStreams } : p
                ))
              }
            } else if (source.type === 'web' && source.url) {
              const results = await scanWebUrls([source.url], () => {})
              allResults.web.push(...results)
              
              const linksInResults = results.reduce((sum, r) => sum + (r.links?.length || 0), 0)
              totalLinks += linksInResults

              setScanProgress(prev => prev.map(p => 
                p.provider === preset.name ? { ...p, linksFound: p.linksFound + linksInResults } : p
              ))
            }
          } catch (sourceError) {
            console.error(`Error scanning source ${j + 1} of ${preset.name}:`, sourceError)
          }
        }

        setScanProgress(prev => prev.map(p => 
          p.provider === preset.name ? { ...p, status: 'complete' } : p
        ))

      } catch (error) {
        console.error(`Error scanning preset ${preset.name}:`, error)
        setScanProgress(prev => prev.map(p => 
          p.provider === preset.name ? { ...p, status: 'error', error: 'Scan failed' } : p
        ))
      }
    }

    setTotalLinksFound(totalLinks)
    setCombinedResults(allResults)
    setIsScanning(false)
    setShowResults(true)

    toast.success(`Scan complete! Found ${totalLinks} total media links from ${presetsToScan.length} provider${presetsToScan.length !== 1 ? 's' : ''}`, { id: 'preset-scan' })

    if (onScanComplete) {
      onScanComplete(allResults)
    }
  }, [selectedPresets, onScanComplete])

  const handleExportMasterPlaylist = useCallback(() => {
    if (!combinedResults) return

    const playlistEntries: string[] = []
    playlistEntries.push('#EXTM3U')
    playlistEntries.push('#EXTINF:-1,Master Playlist - Combined IPTV Sources')
    playlistEntries.push('')

    const allLinks = new Map<string, { title?: string; category?: string; provider?: string }>()

    combinedResults.repositories.forEach((repo: RepositoryScanResult) => {
      if (!repo.error && repo.links) {
        repo.links.forEach(link => {
          if (!allLinks.has(link)) {
            allLinks.set(link, {
              title: link.split('/').pop() || 'Unknown',
              category: 'Repository',
              provider: `${repo.owner}/${repo.repoName}`
            })
          }
        })
      }
    })

    combinedResults.playlists.forEach((playlist: PlaylistScanResult) => {
      if (!playlist.error && playlist.linksWithMetadata) {
        playlist.linksWithMetadata.forEach(entry => {
          if (!allLinks.has(entry.url)) {
            allLinks.set(entry.url, {
              title: entry.title || 'Unknown',
              category: entry.category || 'Playlist',
              provider: new URL(playlist.url).hostname
            })
          }
        })
      }
    })

    combinedResults.xtream.forEach((xtream: XtreamCodesScanResult) => {
      if (xtream.success) {
        const links = convertXtreamCodesToLinks(xtream)
        links.forEach(link => {
          if (!allLinks.has(link.url)) {
            allLinks.set(link.url, {
              title: link.title || 'Unknown',
              category: link.category || 'Xtream',
              provider: new URL(xtream.serverUrl).hostname
            })
          }
        })
      }
    })

    combinedResults.web.forEach((web: any) => {
      if (!web.error && web.links) {
        web.links.forEach((link: string) => {
          if (!allLinks.has(link)) {
            allLinks.set(link, {
              title: link.split('/').pop() || 'Unknown',
              category: 'Web',
              provider: new URL(web.url).hostname
            })
          }
        })
      }
    })

    allLinks.forEach((metadata, url) => {
      const groupTitle = metadata.category || 'Uncategorized'
      const channelName = metadata.title || 'Unknown Channel'
      const providerInfo = metadata.provider ? ` [${metadata.provider}]` : ''
      
      playlistEntries.push(`#EXTINF:-1 group-title="${groupTitle}",${channelName}${providerInfo}`)
      playlistEntries.push(url)
    })

    const blob = new Blob([playlistEntries.join('\n')], { type: 'text/plain' })
    const downloadUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    const timestamp = new Date().toISOString().split('T')[0]
    a.download = `master-playlist-${timestamp}.m3u`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(downloadUrl)

    toast.success(`Exported master playlist with ${allLinks.size} unique links`)
  }, [combinedResults])

  const handleExportLinksList = useCallback(() => {
    if (!combinedResults) return

    const allLinks = new Set<string>()

    combinedResults.repositories.forEach((repo: RepositoryScanResult) => {
      if (!repo.error && repo.links) {
        repo.links.forEach(link => allLinks.add(link))
      }
    })

    combinedResults.playlists.forEach((playlist: PlaylistScanResult) => {
      if (!playlist.error && playlist.linksWithMetadata) {
        playlist.linksWithMetadata.forEach(entry => allLinks.add(entry.url))
      }
    })

    combinedResults.xtream.forEach((xtream: XtreamCodesScanResult) => {
      if (xtream.success) {
        const links = convertXtreamCodesToLinks(xtream)
        links.forEach(link => allLinks.add(link.url))
      }
    })

    combinedResults.web.forEach((web: any) => {
      if (!web.error && web.links) {
        web.links.forEach((link: string) => allLinks.add(link))
      }
    })

    const blob = new Blob([Array.from(allLinks).join('\n')], { type: 'text/plain' })
    const downloadUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    const timestamp = new Date().toISOString().split('T')[0]
    a.download = `combined-links-${timestamp}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(downloadUrl)

    toast.success(`Exported ${allLinks.size} unique links`)
  }, [combinedResults])

  const handleStopScan = useCallback(() => {
    setIsScanning(false)
    toast.info('Scan stopped')
  }, [])

  const getCategoryIcon = (category: ProviderPreset['category']) => {
    switch (category) {
      case 'github':
        return <Package size={16} className="text-purple-500" />
      case 'playlist':
        return <Globe size={16} className="text-blue-500" />
      case 'xtream':
        return <Database size={16} className="text-green-500" />
      case 'web':
        return <Globe size={16} className="text-orange-500" />
      case 'mixed':
        return <Sparkle size={16} className="text-accent" weight="fill" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Rocket size={24} className="text-accent" weight="fill" />
        <h3 className="text-lg font-bold text-foreground">Provider Presets - Bulk IPTV Scanner</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Select from curated provider presets to scan multiple major IPTV sources at once. Includes repositories, playlists, and streaming services.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={selectAll}
            variant="outline"
            size="sm"
            className="border-accent/30 hover:bg-accent/10 text-accent"
          >
            Select All
          </Button>
          <Button
            onClick={clearAll}
            variant="outline"
            size="sm"
            className="border-border"
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => handleQuickSelect('all-sources')}
          variant="default"
          size="sm"
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Rocket size={16} className="mr-1" weight="fill" />
          Quick: All Sources
        </Button>
        <Button
          onClick={() => handleQuickSelect('github-only')}
          variant="outline"
          size="sm"
          className="border-purple-500/30 hover:bg-purple-500/10 text-purple-400"
        >
          <Package size={16} className="mr-1" />
          GitHub Only
        </Button>
        <Button
          onClick={() => handleQuickSelect('free-only')}
          variant="outline"
          size="sm"
          className="border-green-500/30 hover:bg-green-500/10 text-green-400"
        >
          <CheckCircle size={16} className="mr-1" weight="fill" />
          Free Sources
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FunnelSimple size={16} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Category:</span>
        </div>
        <Button
          onClick={() => setFilterCategory('all')}
          variant={filterCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          className={filterCategory === 'all' ? 'bg-accent text-accent-foreground text-xs h-7' : 'text-xs h-7'}
        >
          All
        </Button>
        <Button
          onClick={() => setFilterCategory('github')}
          variant={filterCategory === 'github' ? 'default' : 'outline'}
          size="sm"
          className={filterCategory === 'github' ? 'bg-purple-500 text-white text-xs h-7' : 'text-xs h-7'}
        >
          GitHub
        </Button>
        <Button
          onClick={() => setFilterCategory('playlist')}
          variant={filterCategory === 'playlist' ? 'default' : 'outline'}
          size="sm"
          className={filterCategory === 'playlist' ? 'bg-blue-500 text-white text-xs h-7' : 'text-xs h-7'}
        >
          Playlists
        </Button>
        <Button
          onClick={() => setFilterCategory('xtream')}
          variant={filterCategory === 'xtream' ? 'default' : 'outline'}
          size="sm"
          className={filterCategory === 'xtream' ? 'bg-green-500 text-white text-xs h-7' : 'text-xs h-7'}
        >
          Xtream
        </Button>
        <Button
          onClick={() => setFilterCategory('web')}
          variant={filterCategory === 'web' ? 'default' : 'outline'}
          size="sm"
          className={filterCategory === 'web' ? 'bg-orange-500 text-white text-xs h-7' : 'text-xs h-7'}
        >
          Web
        </Button>
        <Button
          onClick={() => setFilterCategory('mixed')}
          variant={filterCategory === 'mixed' ? 'default' : 'outline'}
          size="sm"
          className={filterCategory === 'mixed' ? 'bg-accent text-accent-foreground text-xs h-7' : 'text-xs h-7'}
        >
          Mixed
        </Button>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FunnelSimple size={16} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Tags:</span>
          </div>
          <Button
            onClick={() => setFilterTag('all')}
            variant={filterTag === 'all' ? 'default' : 'outline'}
            size="sm"
            className={filterTag === 'all' ? 'bg-accent text-accent-foreground text-xs h-7' : 'text-xs h-7'}
          >
            All
          </Button>
          {allTags.slice(0, 10).map(tag => (
            <Button
              key={tag}
              onClick={() => setFilterTag(tag)}
              variant={filterTag === tag ? 'default' : 'outline'}
              size="sm"
              className={filterTag === tag ? 'bg-accent text-accent-foreground text-xs h-7' : 'text-xs h-7'}
            >
              {tag}
            </Button>
          ))}
        </div>
      )}

      <ScrollArea className="h-[400px] rounded-md border border-border bg-primary/30 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence>
            {filteredPresets.map((preset, index) => {
              const isSelected = selectedPresets.has(preset.id)
              return (
                <motion.div
                  key={preset.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15, delay: index * 0.02 }}
                >
                  <Card
                    className={`p-4 cursor-pointer transition-all duration-150 hover:shadow-md ${
                      isSelected
                        ? 'border-accent bg-accent/10 shadow-accent/20'
                        : 'border-border hover:border-accent/50'
                    }`}
                    onClick={() => togglePreset(preset.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => togglePreset(preset.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{preset.icon}</span>
                          <h4 className="font-semibold text-foreground text-sm">{preset.name}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                          {preset.description}
                        </p>
                        <div className="flex flex-wrap gap-1 mb-2">
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            {getCategoryIcon(preset.category)}
                            {preset.category}
                          </Badge>
                          <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                            {preset.sources.length} source{preset.sources.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {preset.tags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {preset.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              +{preset.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {selectedPresets.size > 0 && (
        <Alert className="border-accent/50 bg-accent/10">
          <AlertDescription className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-foreground text-sm">
              <CheckCircle size={16} className="text-accent" weight="fill" />
              {selectedPresets.size} provider{selectedPresets.size !== 1 ? 's' : ''} selected
            </div>
            {!isScanning ? (
              <Button
                onClick={handleScanPresets}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                size="sm"
              >
                <PlayCircle size={16} className="mr-1" weight="fill" />
                Start Bulk Scan
              </Button>
            ) : (
              <Button
                onClick={handleStopScan}
                variant="destructive"
                size="sm"
              >
                <StopCircle size={16} className="mr-1" weight="fill" />
                Stop Scan
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {isScanning && scanProgress.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <Alert className="border-accent/30 bg-accent/5">
            <AlertDescription>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <RabbitLoader size={20} />
                  Scanning {scanProgress.filter(p => p.status === 'scanning').length} of {scanProgress.length} providers...
                </div>
                {scanProgress.map((progress, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {progress.status === 'pending' && (
                          <span className="text-muted-foreground">⏳</span>
                        )}
                        {progress.status === 'scanning' && (
                          <RabbitLoader size={16} />
                        )}
                        {progress.status === 'complete' && (
                          <CheckCircle size={16} className="text-green-500" weight="fill" />
                        )}
                        {progress.status === 'error' && (
                          <span className="text-destructive">❌</span>
                        )}
                        <span className="text-foreground font-medium">{progress.provider}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                          {progress.linksFound} links
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {progress.current}/{progress.total}
                        </span>
                      </div>
                    </div>
                    {progress.status === 'scanning' && (
                      <Progress value={(progress.current / progress.total) * 100} className="h-1" />
                    )}
                    {progress.status === 'error' && progress.error && (
                      <div className="text-xs text-destructive">{progress.error}</div>
                    )}
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {showResults && !isScanning && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <Alert className="border-green-500/30 bg-green-500/10">
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <CheckCircle size={20} className="text-green-500" weight="fill" />
                  Bulk Scan Complete!
                </div>
                <div className="text-sm text-foreground">
                  Found <strong className="text-accent">{totalLinksFound}</strong> total media links across {scanProgress.length} provider{scanProgress.length !== 1 ? 's' : ''}
                </div>
                <div className="space-y-1 mt-2">
                  {scanProgress.map((progress, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{progress.provider}</span>
                      <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                        {progress.linksFound} links
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleExportMasterPlaylist}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={!combinedResults || totalLinksFound === 0}
            >
              <DownloadSimple size={20} className="mr-2" weight="fill" />
              Export Master Playlist (M3U)
            </Button>
            <Button
              onClick={handleExportLinksList}
              variant="outline"
              className="w-full border-accent/30 hover:bg-accent/10 text-accent"
              disabled={!combinedResults || totalLinksFound === 0}
            >
              <FileText size={20} className="mr-2" />
              Export Links List (TXT)
            </Button>
          </div>

          <Alert className="border-accent/30 bg-accent/5">
            <AlertDescription className="text-xs text-foreground">
              <DownloadSimple size={14} className="inline mr-1" />
              <strong>Master Playlist:</strong> Downloads a single M3U file with all links organized by category and provider.
              <br />
              <FileText size={14} className="inline mr-1 mt-1" />
              <strong>Links List:</strong> Downloads a simple text file with one URL per line (no metadata).
            </AlertDescription>
          </Alert>
        </motion.div>
      )}
    </div>
  )
}
