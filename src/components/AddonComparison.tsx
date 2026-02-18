import { useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Package, Plus, Trash, MagnifyingGlass, VideoCamera, MusicNote, FileText, Database, CheckCircle, Warning, Crown, ArrowUp, ArrowDown, X, DownloadSimple, Copy, Sparkle } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { scanRepositoryUrls, type RepositoryScanResult, type ConfigFile } from '@/lib/linkExtractor'

export interface AddonComparisonData {
  id: string
  url: string
  name: string
  owner: string
  repoName: string
  platform: string
  totalLinks: number
  videoLinks: number
  audioLinks: number
  configFiles: ConfigFile[]
  filesScanned: number
  links: string[]
  isScanning: boolean
  error?: string
  scanProgress: number
}

export function AddonComparison() {
  const [addons, setAddons] = useState<AddonComparisonData[]>([])
  const [newAddonUrl, setNewAddonUrl] = useState('')
  const [isScanning, setIsScanning] = useState(false)

  const handleAddAddon = useCallback(async () => {
    const url = newAddonUrl.trim()
    if (!url) {
      toast.error('Please enter a repository URL')
      return
    }

    const addonId = `addon-${Date.now()}`
    
    setAddons(prev => [...prev, {
      id: addonId,
      url,
      name: '',
      owner: '',
      repoName: '',
      platform: '',
      totalLinks: 0,
      videoLinks: 0,
      audioLinks: 0,
      configFiles: [],
      filesScanned: 0,
      links: [],
      isScanning: true,
      scanProgress: 0
    }])
    
    setNewAddonUrl('')
    setIsScanning(true)

    try {
      const results = await scanRepositoryUrls([url], (current, total, repoCurrent, repoTotal) => {
        if (repoCurrent !== undefined && repoTotal !== undefined) {
          const progress = (repoCurrent / repoTotal) * 100
          setAddons(prev => prev.map(addon => 
            addon.id === addonId ? { ...addon, scanProgress: progress } : addon
          ))
        }
      })

      if (results.length > 0) {
        const result = results[0]
        
        setAddons(prev => prev.map(addon => {
          if (addon.id === addonId) {
            if (result.error) {
              return {
                ...addon,
                isScanning: false,
                error: result.error,
                scanProgress: 0
              }
            } else {
              return {
                ...addon,
                name: result.repoName,
                owner: result.owner,
                repoName: result.repoName,
                platform: result.platform,
                totalLinks: result.totalLinks,
                videoLinks: result.videoLinks,
                audioLinks: result.audioLinks,
                configFiles: result.configFiles,
                filesScanned: result.filesScanned,
                links: result.links,
                isScanning: false,
                scanProgress: 100
              }
            }
          }
          return addon
        }))

        if (result.error) {
          toast.error(`Failed to scan: ${result.error}`)
        } else {
          toast.success(`Scanned ${result.repoName}: ${result.totalLinks} links found`)
        }
      }
    } catch (error) {
      setAddons(prev => prev.map(addon => 
        addon.id === addonId ? { 
          ...addon, 
          isScanning: false, 
          error: 'Scan failed',
          scanProgress: 0
        } : addon
      ))
      toast.error('Failed to scan repository')
      console.error('Addon scan error:', error)
    } finally {
      setIsScanning(false)
    }
  }, [newAddonUrl])

  const handleRemoveAddon = useCallback((addonId: string) => {
    setAddons(prev => prev.filter(addon => addon.id !== addonId))
    toast.success('Addon removed from comparison')
  }, [])

  const handleClearAll = useCallback(() => {
    setAddons([])
    toast.success('All addons cleared')
  }, [])

  const getBestAddon = useCallback((): AddonComparisonData | null => {
    const validAddons = addons.filter(addon => !addon.error && !addon.isScanning)
    if (validAddons.length === 0) return null
    
    return validAddons.reduce((best, current) => {
      const currentScore = current.totalLinks + (current.configFiles.length * 10) + (current.videoLinks * 2)
      const bestScore = best.totalLinks + (best.configFiles.length * 10) + (best.videoLinks * 2)
      return currentScore > bestScore ? current : best
    })
  }, [addons])

  const handleCopyAllLinks = useCallback((addon: AddonComparisonData) => {
    if (addon.links.length === 0) {
      toast.error('No links to copy')
      return
    }
    
    navigator.clipboard.writeText(addon.links.join('\n')).then(() => {
      toast.success(`Copied ${addon.links.length} links from ${addon.name}`)
    }).catch(() => {
      toast.error('Failed to copy links')
    })
  }, [])

  const handleDownloadLinks = useCallback((addon: AddonComparisonData) => {
    if (addon.links.length === 0) {
      toast.error('No links to download')
      return
    }

    const content = addon.links.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${addon.name}-links.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success(`Downloaded links from ${addon.name}`)
  }, [])

  const handleExportComparison = useCallback(() => {
    if (addons.length === 0) {
      toast.error('No addons to export')
      return
    }

    const comparison = {
      exportDate: new Date().toISOString(),
      addons: addons.map(addon => ({
        url: addon.url,
        name: addon.name,
        owner: addon.owner,
        platform: addon.platform,
        totalLinks: addon.totalLinks,
        videoLinks: addon.videoLinks,
        audioLinks: addon.audioLinks,
        configFilesCount: addon.configFiles.length,
        filesScanned: addon.filesScanned,
        error: addon.error
      })),
      bestAddon: getBestAddon()?.name || 'N/A'
    }

    const blob = new Blob([JSON.stringify(comparison, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `addon-comparison-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Comparison exported successfully')
  }, [addons, getBestAddon])

  const getPlatformColor = (platform: string): string => {
    switch (platform) {
      case 'github': return 'border-purple-500/30 text-purple-400'
      case 'gitlab': return 'border-orange-500/30 text-orange-400'
      case 'bitbucket': return 'border-blue-500/30 text-blue-400'
      case 'gitea': return 'border-green-500/30 text-green-400'
      case 'codeberg': return 'border-cyan-500/30 text-cyan-400'
      case 'sourcehut': return 'border-yellow-500/30 text-yellow-400'
      default: return 'border-accent/30 text-accent'
    }
  }

  const bestAddon = getBestAddon()
  const validAddons = addons.filter(addon => !addon.error && !addon.isScanning)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package size={24} className="text-accent" />
        <h3 className="text-lg font-bold text-foreground">Compare Kodi Addons</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Add multiple Kodi addon repositories to compare side-by-side. Find the best sources with the most media links, configuration files, and content.
      </p>

      <div className="flex gap-2">
        <Input
          id="addon-comparison-url"
          placeholder="https://github.com/username/kodi-addon"
          value={newAddonUrl}
          onChange={(e) => setNewAddonUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleAddAddon()
            }
          }}
          className="flex-1 font-mono text-sm"
          disabled={isScanning}
        />
        <Button
          onClick={handleAddAddon}
          disabled={isScanning || !newAddonUrl.trim()}
          className="bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <Plus size={20} className="mr-2" />
          Add Addon
        </Button>
      </div>

      {addons.length > 0 && (
        <>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-accent/30 text-accent">
                {addons.length} {addons.length === 1 ? 'addon' : 'addons'} in comparison
              </Badge>
              {bestAddon && (
                <Badge variant="outline" className="border-yellow-500/30 text-yellow-500 flex items-center gap-1">
                  <Crown size={14} weight="fill" />
                  Best: {bestAddon.name}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleExportComparison}
                variant="outline"
                size="sm"
                className="border-accent/30 hover:bg-accent/10 text-accent"
              >
                <DownloadSimple size={16} className="mr-1" />
                Export
              </Button>
              <Button
                onClick={handleClearAll}
                variant="outline"
                size="sm"
                className="border-destructive/30 hover:bg-destructive/10 text-destructive"
              >
                <Trash size={16} className="mr-1" />
                Clear All
              </Button>
            </div>
          </div>

          <Tabs defaultValue="grid" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-primary/30">
              <TabsTrigger value="grid">Grid View</TabsTrigger>
              <TabsTrigger value="table">Table View</TabsTrigger>
            </TabsList>

            <TabsContent value="grid" className="mt-4">
              <ScrollArea className="h-[500px]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
                  <AnimatePresence>
                    {addons.map((addon, index) => (
                      <motion.div
                        key={addon.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                      >
                        <Card className={`p-4 relative ${addon.id === bestAddon?.id ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-border'} ${addon.error ? 'border-destructive/50 bg-destructive/5' : ''}`}>
                          {addon.id === bestAddon?.id && (
                            <div className="absolute -top-3 -right-3">
                              <Badge className="bg-yellow-500 text-black border-yellow-400">
                                <Crown size={14} weight="fill" className="mr-1" />
                                Best Source
                              </Badge>
                            </div>
                          )}

                          <Button
                            onClick={() => handleRemoveAddon(addon.id)}
                            variant="ghost"
                            size="sm"
                            className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                          >
                            <X size={14} />
                          </Button>

                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Package size={20} className="text-accent" />
                                <div className="font-semibold text-foreground text-sm line-clamp-1">
                                  {addon.name || 'Loading...'}
                                </div>
                              </div>
                              {addon.owner && (
                                <div className="text-xs text-muted-foreground font-mono">
                                  {addon.owner}/{addon.repoName}
                                </div>
                              )}
                              {addon.platform && (
                                <Badge variant="outline" className={`text-xs mt-1 uppercase ${getPlatformColor(addon.platform)}`}>
                                  {addon.platform}
                                </Badge>
                              )}
                            </div>

                            {addon.isScanning && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-accent">
                                  <MagnifyingGlass size={16} className="animate-pulse" />
                                  <span className="text-xs">Scanning...</span>
                                </div>
                                <Progress value={addon.scanProgress} className="h-1" />
                              </div>
                            )}

                            {addon.error && (
                              <Alert className="border-destructive/30 bg-destructive/5 py-2">
                                <AlertDescription className="text-xs text-destructive flex items-start gap-2">
                                  <Warning size={14} className="shrink-0 mt-0.5" />
                                  {addon.error}
                                </AlertDescription>
                              </Alert>
                            )}

                            {!addon.isScanning && !addon.error && (
                              <>
                                <Separator className="bg-border" />

                                <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-primary/20 rounded p-2">
                                    <div className="text-2xl font-bold text-accent">{addon.totalLinks}</div>
                                    <div className="text-xs text-muted-foreground">Total Links</div>
                                  </div>
                                  <div className="bg-primary/20 rounded p-2">
                                    <div className="text-2xl font-bold text-accent">{addon.filesScanned}</div>
                                    <div className="text-xs text-muted-foreground">Files Scanned</div>
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {addon.videoLinks > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      <VideoCamera size={12} className="mr-1" />
                                      {addon.videoLinks} video
                                    </Badge>
                                  )}
                                  {addon.audioLinks > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      <MusicNote size={12} className="mr-1" />
                                      {addon.audioLinks} audio
                                    </Badge>
                                  )}
                                  {addon.configFiles.length > 0 && (
                                    <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                                      <FileText size={12} className="mr-1" />
                                      {addon.configFiles.length} configs
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => handleCopyAllLinks(addon)}
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 border-accent/30 hover:bg-accent/10 text-accent text-xs"
                                  >
                                    <Copy size={14} className="mr-1" />
                                    Copy Links
                                  </Button>
                                  <Button
                                    onClick={() => handleDownloadLinks(addon)}
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 border-accent/30 hover:bg-accent/10 text-accent text-xs"
                                  >
                                    <DownloadSimple size={14} className="mr-1" />
                                    Download
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="table" className="mt-4">
              <ScrollArea className="h-[500px]">
                <div className="space-y-2 p-2">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground bg-primary/20 rounded sticky top-0">
                    <div className="col-span-3">Addon Name</div>
                    <div className="col-span-2">Platform</div>
                    <div className="col-span-1 text-center">Links</div>
                    <div className="col-span-1 text-center">Video</div>
                    <div className="col-span-1 text-center">Audio</div>
                    <div className="col-span-1 text-center">Configs</div>
                    <div className="col-span-1 text-center">Files</div>
                    <div className="col-span-2 text-center">Actions</div>
                  </div>

                  <AnimatePresence>
                    {addons.map((addon, index) => (
                      <motion.div
                        key={addon.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        className={`grid grid-cols-12 gap-2 px-4 py-3 rounded items-center ${addon.id === bestAddon?.id ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-card border border-border'} ${addon.error ? 'border-destructive/50' : ''}`}
                      >
                        <div className="col-span-3">
                          <div className="flex items-center gap-2">
                            {addon.id === bestAddon?.id && (
                              <Crown size={16} weight="fill" className="text-yellow-500 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground text-sm truncate">
                                {addon.name || 'Loading...'}
                              </div>
                              {addon.owner && (
                                <div className="text-xs text-muted-foreground font-mono truncate">
                                  {addon.owner}/{addon.repoName}
                                </div>
                              )}
                            </div>
                          </div>
                          {addon.isScanning && (
                            <div className="mt-2">
                              <Progress value={addon.scanProgress} className="h-1" />
                            </div>
                          )}
                          {addon.error && (
                            <div className="text-xs text-destructive mt-1 flex items-center gap-1">
                              <Warning size={12} />
                              {addon.error}
                            </div>
                          )}
                        </div>

                        <div className="col-span-2">
                          {addon.platform && (
                            <Badge variant="outline" className={`text-xs uppercase ${getPlatformColor(addon.platform)}`}>
                              {addon.platform}
                            </Badge>
                          )}
                        </div>

                        <div className="col-span-1 text-center">
                          <div className="text-sm font-bold text-accent">{addon.totalLinks}</div>
                        </div>

                        <div className="col-span-1 text-center">
                          <div className="text-sm text-foreground">{addon.videoLinks}</div>
                        </div>

                        <div className="col-span-1 text-center">
                          <div className="text-sm text-foreground">{addon.audioLinks}</div>
                        </div>

                        <div className="col-span-1 text-center">
                          <div className="text-sm text-foreground">{addon.configFiles.length}</div>
                        </div>

                        <div className="col-span-1 text-center">
                          <div className="text-sm text-foreground">{addon.filesScanned}</div>
                        </div>

                        <div className="col-span-2 flex justify-center gap-1">
                          {!addon.isScanning && !addon.error && (
                            <>
                              <Button
                                onClick={() => handleCopyAllLinks(addon)}
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 hover:bg-accent/20 text-accent"
                                title="Copy links"
                              >
                                <Copy size={14} />
                              </Button>
                              <Button
                                onClick={() => handleDownloadLinks(addon)}
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 hover:bg-accent/20 text-accent"
                                title="Download links"
                              >
                                <DownloadSimple size={14} />
                              </Button>
                            </>
                          )}
                          <Button
                            onClick={() => handleRemoveAddon(addon.id)}
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 hover:bg-destructive/20 text-destructive"
                            title="Remove addon"
                          >
                            <Trash size={14} />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {validAddons.length > 1 && (
            <>
              <Separator className="bg-border" />

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Sparkle size={16} weight="fill" className="text-accent" />
                  Comparison Insights
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card className="p-3 bg-primary/20 border-accent/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Most Links</span>
                      <ArrowUp size={14} className="text-accent" />
                    </div>
                    {(() => {
                      const best = validAddons.reduce((max, addon) => 
                        addon.totalLinks > max.totalLinks ? addon : max
                      )
                      return (
                        <div>
                          <div className="text-lg font-bold text-foreground">{best.name}</div>
                          <div className="text-xs text-accent">{best.totalLinks} links</div>
                        </div>
                      )
                    })()}
                  </Card>

                  <Card className="p-3 bg-primary/20 border-accent/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Most Videos</span>
                      <VideoCamera size={14} className="text-accent" />
                    </div>
                    {(() => {
                      const best = validAddons.reduce((max, addon) => 
                        addon.videoLinks > max.videoLinks ? addon : max
                      )
                      return (
                        <div>
                          <div className="text-lg font-bold text-foreground">{best.name}</div>
                          <div className="text-xs text-accent">{best.videoLinks} videos</div>
                        </div>
                      )
                    })()}
                  </Card>

                  <Card className="p-3 bg-primary/20 border-accent/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Most Configs</span>
                      <Database size={14} className="text-accent" />
                    </div>
                    {(() => {
                      const best = validAddons.reduce((max, addon) => 
                        addon.configFiles.length > max.configFiles.length ? addon : max
                      )
                      return (
                        <div>
                          <div className="text-lg font-bold text-foreground">{best.name}</div>
                          <div className="text-xs text-accent">{best.configFiles.length} configs</div>
                        </div>
                      )
                    })()}
                  </Card>
                </div>

                <Alert className="border-accent/30 bg-accent/5">
                  <AlertDescription className="text-xs text-foreground">
                    <CheckCircle size={14} className="inline mr-1" weight="fill" />
                    <strong>Recommendation:</strong> The addon marked with <Crown size={12} className="inline mx-1" weight="fill" /> is scored highest based on total links, video content, and configuration files. This typically indicates the most comprehensive source for media content.
                  </AlertDescription>
                </Alert>
              </div>
            </>
          )}
        </>
      )}

      {addons.length === 0 && (
        <Alert className="border-accent/30 bg-accent/5">
          <AlertDescription className="text-foreground">
            <Package size={16} className="inline mr-2" />
            Add Kodi addon repositories above to start comparing. You can add multiple addons from GitHub, GitLab, Bitbucket, and other Git hosting platforms to see which ones have the best media sources.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
