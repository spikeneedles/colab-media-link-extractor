import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StackSimple, DownloadSimple, Plus, Trash, PencilSimple, CheckCircle, FilmSlate, Package, Broadcast, Television, VideoCamera, Copy, X, FunnelSimple, MusicNote, Hash, TextT, Sparkle, Info } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import type { LinkWithCount, ContentType } from '@/lib/linkExtractor'
import { 
  generateBulkPlaylists, 
  generateBulkPlaylistsZip, 
  createDefaultBulkConfigs, 
  downloadBulkPlaylist,
  type BulkPlaylistConfig,
  type BulkPlaylistResult,
  type BulkGenerationResult
} from '@/lib/m3uGenerator'

interface BulkPlaylistGeneratorProps {
  linksWithCounts: LinkWithCount[]
  availableCategories: string[]
}

export function BulkPlaylistGenerator({ linksWithCounts, availableCategories }: BulkPlaylistGeneratorProps) {
  const [configs, setConfigs] = useState<BulkPlaylistConfig[]>([])
  const [generatedResult, setGeneratedResult] = useState<BulkGenerationResult | null>(null)
  const [showResultDialog, setShowResultDialog] = useState(false)
  const [editingConfig, setEditingConfig] = useState<BulkPlaylistConfig | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showPresetsInfo, setShowPresetsInfo] = useState(false)

  useEffect(() => {
    const defaultConfigs = createDefaultBulkConfigs(linksWithCounts)
    setConfigs(defaultConfigs)
  }, [linksWithCounts])

  const handleToggleConfig = (id: string) => {
    setConfigs(prev => prev.map(c => 
      c.id === id ? { ...c, enabled: !c.enabled } : c
    ))
  }

  const handleAddConfig = () => {
    const newConfig: BulkPlaylistConfig = {
      id: `custom-${Date.now()}`,
      enabled: true,
      name: 'New Playlist',
      contentTypes: ['movie', 'tv-series', 'live-tv'],
      sortBy: 'title',
      groupByCategory: false
    }
    setConfigs(prev => [...prev, newConfig])
    setEditingConfig(newConfig)
    setShowEditDialog(true)
  }

  const handleEditConfig = (config: BulkPlaylistConfig) => {
    setEditingConfig({ ...config })
    setShowEditDialog(true)
  }

  const handleDeleteConfig = (id: string) => {
    setConfigs(prev => prev.filter(c => c.id !== id))
    toast.success('Playlist configuration deleted')
  }

  const handleSaveConfig = () => {
    if (!editingConfig) return

    setConfigs(prev => prev.map(c => 
      c.id === editingConfig.id ? editingConfig : c
    ))
    setShowEditDialog(false)
    setEditingConfig(null)
    toast.success('Playlist configuration saved')
  }

  const handleGenerate = () => {
    const enabledConfigs = configs.filter(c => c.enabled)
    
    if (enabledConfigs.length === 0) {
      toast.error('Please enable at least one playlist configuration')
      return
    }

    toast.loading('Generating bulk playlists...', { id: 'bulk-generation' })

    try {
      const result = generateBulkPlaylists(linksWithCounts, configs)
      setGeneratedResult(result)
      setShowResultDialog(true)
      toast.success(`Generated ${result.totalPlaylists} playlists with ${result.totalLinks} total links`, { id: 'bulk-generation' })
    } catch (error) {
      toast.error('Failed to generate playlists', { id: 'bulk-generation' })
      console.error('Bulk generation error:', error)
    }
  }

  const handleDownloadAll = async () => {
    if (!generatedResult) return

    try {
      toast.loading('Creating ZIP archive...', { id: 'bulk-zip' })
      const blob = await generateBulkPlaylistsZip(generatedResult)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bulk-playlists-${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Downloaded bulk playlists archive', { id: 'bulk-zip' })
    } catch (error) {
      toast.error('Failed to create ZIP archive', { id: 'bulk-zip' })
      console.error('ZIP creation error:', error)
    }
  }

  const handleDownloadSingle = (playlist: BulkPlaylistResult) => {
    downloadBulkPlaylist(playlist)
    toast.success(`Downloaded ${playlist.filename}`)
  }

  const handleDuplicateConfig = (config: BulkPlaylistConfig) => {
    const duplicatedConfig: BulkPlaylistConfig = {
      ...config,
      id: `duplicate-${Date.now()}`,
      name: `${config.name} (Copy)`,
      enabled: false
    }
    setConfigs(prev => [...prev, duplicatedConfig])
    toast.success('Configuration duplicated')
  }

  const handleReloadPresets = () => {
    const defaultConfigs = createDefaultBulkConfigs(linksWithCounts)
    setConfigs(defaultConfigs)
    toast.success('Loaded default presets with advanced filters')
  }

  const handleShowPresetsInfo = () => {
    setShowPresetsInfo(true)
  }

  const enabledCount = configs.filter(c => c.enabled).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StackSimple size={24} className="text-accent" />
          <h3 className="text-lg font-bold text-foreground">Bulk Playlist Generator</h3>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleShowPresetsInfo}
            variant="outline"
            size="sm"
            className="border-blue-500/30 hover:bg-blue-500/10 text-blue-500"
            title="Learn about preset configurations"
          >
            <Info size={16} className="mr-1" />
            Presets
          </Button>
          <Button
            onClick={handleReloadPresets}
            variant="outline"
            size="sm"
            className="border-accent/30 hover:bg-accent/10 text-accent"
            title="Reset to default presets"
          >
            <Sparkle size={16} className="mr-1" />
            Reload
          </Button>
          <Button
            onClick={handleAddConfig}
            variant="outline"
            size="sm"
            className="border-accent/30 hover:bg-accent/10 text-accent"
          >
            <Plus size={16} className="mr-1" />
            Add Config
          </Button>
          <Button
            onClick={handleGenerate}
            variant="default"
            size="sm"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={enabledCount === 0}
          >
            <StackSimple size={16} className="mr-1" />
            Generate {enabledCount > 0 && `(${enabledCount})`}
          </Button>
        </div>
      </div>

      <Alert className="border-accent/30 bg-accent/5">
        <AlertDescription className="text-foreground text-xs">
          <StackSimple size={14} className="inline mr-1" />
          <strong>Bulk Generation:</strong> Create multiple custom M3U playlists at once with different filters, categories, media types, URL patterns, and sorting options. Perfect for organizing large media collections. Use advanced filters like occurrence ranges and regex patterns for precise control.
        </AlertDescription>
      </Alert>

      <ScrollArea className="h-[400px] rounded-md border border-border bg-card/50 p-4">
        <div className="space-y-3">
          <AnimatePresence>
            {configs.map((config, index) => (
              <motion.div
                key={config.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
              >
                <Card className={`p-4 ${config.enabled ? 'border-accent/30 bg-accent/5' : 'border-border bg-card/30'}`}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={config.enabled}
                      onCheckedChange={() => handleToggleConfig(config.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground text-sm">{config.name}</h4>
                          {config.description && (
                            <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {config.contentTypes.map(type => (
                          <Badge key={type} variant="outline" className="text-xs border-accent/30 text-accent">
                            {type === 'movie' && <FilmSlate size={12} className="mr-1" />}
                            {type === 'tv-series' && <StackSimple size={12} className="mr-1" />}
                            {type === 'live-tv' && <Broadcast size={12} className="mr-1" />}
                            {type.replace('-', ' ')}
                          </Badge>
                        ))}
                        {config.mediaTypes && config.mediaTypes.length > 0 && (
                          <>
                            {config.mediaTypes.map(type => (
                              <Badge key={type} variant="outline" className="text-xs border-purple-500/30 text-purple-500">
                                {type === 'video' && <VideoCamera size={12} className="mr-1" />}
                                {type === 'audio' && <MusicNote size={12} className="mr-1" />}
                                {type}
                              </Badge>
                            ))}
                          </>
                        )}
                        {config.categories && config.categories.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {config.categories.length} {config.categories.length === 1 ? 'category' : 'categories'}
                          </Badge>
                        )}
                        {config.urlPattern && (
                          <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-500">
                            <TextT size={12} className="mr-1" />
                            URL pattern
                          </Badge>
                        )}
                        {(config.minOccurrences !== undefined || config.maxOccurrences !== undefined) && (
                          <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-500">
                            <Hash size={12} className="mr-1" />
                            Occurrence filter
                          </Badge>
                        )}
                        {config.validationStatus && config.validationStatus !== 'all' && (
                          <Badge variant="outline" className="text-xs border-green-500/30 text-green-500">
                            {config.validationStatus}
                          </Badge>
                        )}
                        {config.sortBy && config.sortBy !== 'none' && (
                          <Badge variant="outline" className="text-xs">
                            Sort: {config.sortBy}
                          </Badge>
                        )}
                        {config.groupByCategory && (
                          <Badge variant="outline" className="text-xs">
                            Grouped
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        onClick={() => handleEditConfig(config)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-accent/20 text-accent"
                        title="Edit"
                      >
                        <PencilSimple size={16} />
                      </Button>
                      <Button
                        onClick={() => handleDuplicateConfig(config)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-accent/20 text-accent"
                        title="Duplicate"
                      >
                        <Copy size={16} />
                      </Button>
                      <Button
                        onClick={() => handleDeleteConfig(config.id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-destructive/20 text-destructive"
                        title="Delete"
                      >
                        <Trash size={16} />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
          {configs.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Package size={48} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No configurations yet. Click "Add Config" to create one.</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PencilSimple size={20} className="text-accent" />
              Edit Playlist Configuration
            </DialogTitle>
            <DialogDescription>
              Customize the playlist name, filters, and options
            </DialogDescription>
          </DialogHeader>

          {editingConfig && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Playlist Name
                </label>
                <Input
                  value={editingConfig.name}
                  onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })}
                  placeholder="e.g., Action Movies, Sports Channels"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Description (Optional)
                </label>
                <Textarea
                  value={editingConfig.description || ''}
                  onChange={(e) => setEditingConfig({ ...editingConfig, description: e.target.value })}
                  placeholder="Describe this playlist..."
                  className="min-h-[60px]"
                />
              </div>

              <Separator className="bg-border" />

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Content Types
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['movie', 'tv-series', 'live-tv', 'vod', 'unknown'] as ContentType[]).map(type => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={editingConfig.contentTypes.includes(type)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setEditingConfig({
                              ...editingConfig,
                              contentTypes: [...editingConfig.contentTypes, type]
                            })
                          } else {
                            setEditingConfig({
                              ...editingConfig,
                              contentTypes: editingConfig.contentTypes.filter(t => t !== type)
                            })
                          }
                        }}
                      />
                      <span className="text-sm text-foreground">{type.replace('-', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Media Types (Optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['video', 'audio', 'unknown'] as const).map(type => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={editingConfig.mediaTypes?.includes(type) || false}
                        onCheckedChange={(checked) => {
                          const currentMediaTypes = editingConfig.mediaTypes || []
                          if (checked) {
                            setEditingConfig({
                              ...editingConfig,
                              mediaTypes: [...currentMediaTypes, type]
                            })
                          } else {
                            setEditingConfig({
                              ...editingConfig,
                              mediaTypes: currentMediaTypes.filter(t => t !== type)
                            })
                          }
                        }}
                      />
                      <span className="text-sm text-foreground flex items-center gap-1">
                        {type === 'video' && <VideoCamera size={14} />}
                        {type === 'audio' && <MusicNote size={14} />}
                        {type}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {availableCategories.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">
                    Categories (Optional - leave empty for all)
                  </label>
                  <ScrollArea className="h-[120px] rounded-md border border-border p-2">
                    <div className="space-y-2">
                      {availableCategories.map(category => (
                        <label key={category} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={editingConfig.categories?.includes(category) || false}
                            onCheckedChange={(checked) => {
                              const currentCategories = editingConfig.categories || []
                              if (checked) {
                                setEditingConfig({
                                  ...editingConfig,
                                  categories: [...currentCategories, category]
                                })
                              } else {
                                setEditingConfig({
                                  ...editingConfig,
                                  categories: currentCategories.filter(c => c !== category)
                                })
                              }
                            }}
                          />
                          <span className="text-sm text-foreground">{category}</span>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <Separator className="bg-border" />

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FunnelSimple size={16} className="text-accent" />
                  Advanced Filters
                </h4>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  URL Pattern (RegEx - Optional)
                </label>
                <Input
                  value={editingConfig.urlPattern || ''}
                  onChange={(e) => setEditingConfig({ ...editingConfig, urlPattern: e.target.value })}
                  placeholder="e.g., \.m3u8$ or sports|espn|nfl"
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Filter URLs by pattern. Examples: <code className="bg-muted px-1 rounded">\.m3u8$</code> for HLS streams, <code className="bg-muted px-1 rounded">sports|football</code> for keywords
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">
                    Min Occurrences
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={editingConfig.minOccurrences || ''}
                    onChange={(e) => setEditingConfig({ 
                      ...editingConfig, 
                      minOccurrences: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                    placeholder="No minimum"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Only include links that appear at least this many times
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">
                    Max Occurrences
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={editingConfig.maxOccurrences || ''}
                    onChange={(e) => setEditingConfig({ 
                      ...editingConfig, 
                      maxOccurrences: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                    placeholder="No maximum"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Only include links that appear at most this many times
                  </p>
                </div>
              </div>

              <Alert className="border-blue-500/30 bg-blue-500/5">
                <AlertDescription className="text-foreground text-xs">
                  <FunnelSimple size={14} className="inline mr-1" />
                  <strong>Advanced Filters:</strong> Combine multiple filters to create highly specific playlists. For example, filter for video-only links from specific categories that match a URL pattern and appear 2-5 times across your scanned files.
                </AlertDescription>
              </Alert>

              <Separator className="bg-border" />

              <Separator className="bg-border" />

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">
                  Organization Options
                </h4>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Validation Status Filter
                </label>
                <Select
                  value={editingConfig.validationStatus || 'all'}
                  onValueChange={(value) => setEditingConfig({
                    ...editingConfig,
                    validationStatus: value as 'working' | 'broken' | 'all'
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Links</SelectItem>
                    <SelectItem value="working">Working Links Only</SelectItem>
                    <SelectItem value="broken">Broken Links Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  Sort By
                </label>
                <Select
                  value={editingConfig.sortBy || 'none'}
                  onValueChange={(value) => setEditingConfig({
                    ...editingConfig,
                    sortBy: value as 'title' | 'category' | 'url' | 'none'
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Sorting</SelectItem>
                    <SelectItem value="title">Sort by Title</SelectItem>
                    <SelectItem value="category">Sort by Category</SelectItem>
                    <SelectItem value="url">Sort by URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={editingConfig.groupByCategory || false}
                  onCheckedChange={(checked) => setEditingConfig({
                    ...editingConfig,
                    groupByCategory: checked as boolean
                  })}
                />
                <label className="text-sm font-medium text-foreground cursor-pointer">
                  Group by Category
                </label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                setShowEditDialog(false)
                setEditingConfig(null)
              }}
              variant="outline"
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveConfig}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <CheckCircle size={16} className="mr-2" weight="fill" />
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle size={20} className="text-accent" weight="fill" />
              Bulk Playlists Generated
            </DialogTitle>
            <DialogDescription>
              {generatedResult && (
                <>Generated {generatedResult.totalPlaylists} playlists with {generatedResult.totalLinks} total links</>
              )}
            </DialogDescription>
          </DialogHeader>

          {generatedResult && (
            <div className="space-y-4 py-4">
              <ScrollArea className="h-[300px] rounded-md border border-border bg-card/50 p-4">
                <div className="space-y-3">
                  {generatedResult.playlists.map((playlist, index) => (
                    <motion.div
                      key={playlist.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="p-3 border-accent/20 hover:border-accent/40 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <FilmSlate size={16} className="text-accent shrink-0" />
                              <h4 className="font-semibold text-foreground text-sm">{playlist.name}</h4>
                            </div>
                            {playlist.description && (
                              <p className="text-xs text-muted-foreground mb-2">{playlist.description}</p>
                            )}
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span className="font-mono">{playlist.filename}</span>
                              <span>•</span>
                              <span>{playlist.linkCount} links</span>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleDownloadSingle(playlist)}
                            variant="outline"
                            size="sm"
                            className="border-accent/30 hover:bg-accent/10 text-accent shrink-0"
                          >
                            <DownloadSimple size={16} />
                          </Button>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>

              <Button
                onClick={handleDownloadAll}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Package size={20} className="mr-2" />
                Download All as ZIP
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => setShowResultDialog(false)}
              variant="outline"
              className="border-border"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPresetsInfo} onOpenChange={setShowPresetsInfo}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info size={20} className="text-blue-500" />
              Preset Configurations
            </DialogTitle>
            <DialogDescription>
              Learn about the pre-configured playlist filters and how to use them effectively
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Basic Presets</h4>
              <div className="space-y-2 text-sm">
                <div className="bg-card/50 rounded p-3 border border-border">
                  <div className="font-medium text-foreground mb-1">All Movies / All TV Series / All Live TV</div>
                  <div className="text-xs text-muted-foreground">Standard playlists organized by content type. These are enabled by default and include all classified content.</div>
                </div>
                <div className="bg-card/50 rounded p-3 border border-border">
                  <div className="font-medium text-foreground mb-1">Validated Working Links</div>
                  <div className="text-xs text-muted-foreground">Only includes links that passed URL validation. Enable this after running validation to get a clean playlist of working sources.</div>
                </div>
              </div>
            </div>

            <Separator className="bg-border" />

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Media Type Filters</h4>
              <div className="space-y-2 text-sm">
                <div className="bg-card/50 rounded p-3 border border-border">
                  <div className="font-medium text-foreground mb-1 flex items-center gap-2">
                    <VideoCamera size={14} className="text-purple-500" />
                    Video Content Only
                  </div>
                  <div className="text-xs text-muted-foreground">Filters for video streams, excluding audio-only content like radio stations or music streams.</div>
                </div>
                <div className="bg-card/50 rounded p-3 border border-border">
                  <div className="font-medium text-foreground mb-1 flex items-center gap-2">
                    <MusicNote size={14} className="text-purple-500" />
                    Audio Content Only
                  </div>
                  <div className="text-xs text-muted-foreground">Perfect for music, radio, and audio-only streams. Great for creating dedicated audio playlists.</div>
                </div>
              </div>
            </div>

            <Separator className="bg-border" />

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Advanced Filters</h4>
              <div className="space-y-2 text-sm">
                <div className="bg-card/50 rounded p-3 border border-border">
                  <div className="font-medium text-foreground mb-1 flex items-center gap-2">
                    <TextT size={14} className="text-blue-500" />
                    HLS Streams (m3u8)
                  </div>
                  <div className="text-xs text-muted-foreground">Uses URL pattern <code className="bg-muted px-1 rounded">\.m3u8</code> to filter only HTTP Live Streaming content. Widely compatible with modern players.</div>
                </div>
                <div className="bg-card/50 rounded p-3 border border-border">
                  <div className="font-medium text-foreground mb-1 flex items-center gap-2">
                    <Hash size={14} className="text-yellow-500" />
                    Popular Links (5+ occurrences)
                  </div>
                  <div className="text-xs text-muted-foreground">Links that appear frequently across multiple sources are often more reliable. This filter keeps only frequently-found links.</div>
                </div>
                <div className="bg-card/50 rounded p-3 border border-border">
                  <div className="font-medium text-foreground mb-1 flex items-center gap-2">
                    <Hash size={14} className="text-yellow-500" />
                    Unique Links (Single occurrence)
                  </div>
                  <div className="text-xs text-muted-foreground">Finds rare or unique links that appear only once. Useful for discovering exclusive or lesser-known sources.</div>
                </div>
              </div>
            </div>

            <Separator className="bg-border" />

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Category-Based Presets</h4>
              <div className="bg-card/50 rounded p-3 border border-border">
                <div className="text-xs text-muted-foreground">
                  For each category found in your scanned files, a preset is automatically created (up to 10 categories). These are disabled by default but can be enabled to create category-specific playlists like "Sports Collection" or "News Collection".
                </div>
              </div>
            </div>

            <Separator className="bg-border" />

            <Alert className="border-accent/30 bg-accent/5">
              <AlertDescription className="text-foreground text-xs">
                <Sparkle size={14} className="inline mr-1" />
                <strong>Pro Tip:</strong> Combine multiple filters in custom configurations! For example, create a playlist with video-only sports content that uses HLS streaming and has been validated as working.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowPresetsInfo(false)}
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
