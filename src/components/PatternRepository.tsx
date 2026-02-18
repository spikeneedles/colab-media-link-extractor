import { useState, useCallback, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Globe, Lock, LockOpen, Plus, Download, Upload, Trash, Star, Eye, Copy, Share, GitBranch, Package, MagnifyingGlass, Check, X, Heart, ArrowUp, ArrowDown, Clock, Sparkle, FileArrowDown, FileArrowUp, Users, BookOpen, CloudArrowUp, CloudArrowDown, ForkKnife } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useKV } from '@github/spark/hooks'

export interface PatternItem {
  id: string
  name: string
  description: string
  pattern: string
  category: 'url-filter' | 'scraping-rule' | 'pagination-rule' | 'provider-preset' | 'crawl-config'
  visibility: 'public' | 'private'
  author: string
  authorId: string
  createdAt: string
  updatedAt: string
  version: string
  downloads: number
  stars: number
  forks: number
  tags: string[]
  exampleUrls?: string[]
  dependencies?: string[]
  compatibility: string[]
  rating: number
  reviews: number
  tested: boolean
  verified: boolean
}

export interface PatternRepository {
  id: string
  name: string
  description: string
  visibility: 'public' | 'private'
  owner: string
  ownerId: string
  patterns: PatternItem[]
  contributors: string[]
  stars: number
  forks: number
  createdAt: string
  updatedAt: string
  tags: string[]
  license: string
  readme: string
}

interface PatternRepositoryProps {
  onImportPattern?: (pattern: PatternItem) => void
}

export function PatternRepository({ onImportPattern }: PatternRepositoryProps) {
  const [repositories, setRepositories] = useKV<PatternRepository[]>('pattern-repositories', [])
  const [myPatterns, setMyPatterns] = useKV<PatternItem[]>('my-patterns', [])
  const [starredPatterns, setStarredPatterns] = useKV<string[]>('starred-patterns', [])
  const [forkedPatterns, setForkedPatterns] = useKV<string[]>('forked-patterns', [])
  
  const [showCreateRepo, setShowCreateRepo] = useState(false)
  const [showCreatePattern, setShowCreatePattern] = useState(false)
  const [showPatternDetails, setShowPatternDetails] = useState(false)
  const [selectedPattern, setSelectedPattern] = useState<PatternItem | null>(null)
  const [selectedRepo, setSelectedRepo] = useState<PatternRepository | null>(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterVisibility, setFilterVisibility] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'stars' | 'downloads'>('popular')
  
  const [newRepoName, setNewRepoName] = useState('')
  const [newRepoDesc, setNewRepoDesc] = useState('')
  const [newRepoVisibility, setNewRepoVisibility] = useState<'public' | 'private'>('public')
  const [newRepoReadme, setNewRepoReadme] = useState('')
  const [newRepoLicense, setNewRepoLicense] = useState('MIT')
  const [newRepoTags, setNewRepoTags] = useState('')
  
  const [newPatternName, setNewPatternName] = useState('')
  const [newPatternDesc, setNewPatternDesc] = useState('')
  const [newPatternPattern, setNewPatternPattern] = useState('')
  const [newPatternCategory, setNewPatternCategory] = useState<PatternItem['category']>('url-filter')
  const [newPatternVisibility, setNewPatternVisibility] = useState<'public' | 'private'>('public')
  const [newPatternTags, setNewPatternTags] = useState('')
  const [newPatternExamples, setNewPatternExamples] = useState('')
  const [newPatternCompatibility, setNewPatternCompatibility] = useState('')
  const [newPatternVersion, setNewPatternVersion] = useState('1.0.0')

  const [currentUser] = useState(() => {
    return {
      id: 'user-' + Date.now(),
      name: 'Anonymous User'
    }
  })

  const handleCreateRepo = useCallback(() => {
    if (!newRepoName.trim()) {
      toast.error('Repository name is required')
      return
    }

    const newRepo: PatternRepository = {
      id: `repo-${Date.now()}`,
      name: newRepoName,
      description: newRepoDesc,
      visibility: newRepoVisibility,
      owner: currentUser.name,
      ownerId: currentUser.id,
      patterns: [],
      contributors: [currentUser.name],
      stars: 0,
      forks: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: newRepoTags.split(',').map(t => t.trim()).filter(t => t),
      license: newRepoLicense,
      readme: newRepoReadme || `# ${newRepoName}\n\n${newRepoDesc}`
    }

    setRepositories(current => [...(current || []), newRepo])
    toast.success(`Repository "${newRepoName}" created successfully`)
    
    setNewRepoName('')
    setNewRepoDesc('')
    setNewRepoVisibility('public')
    setNewRepoReadme('')
    setNewRepoLicense('MIT')
    setNewRepoTags('')
    setShowCreateRepo(false)
  }, [newRepoName, newRepoDesc, newRepoVisibility, newRepoReadme, newRepoLicense, newRepoTags, currentUser, setRepositories])

  const handleCreatePattern = useCallback(() => {
    if (!newPatternName.trim() || !newPatternPattern.trim()) {
      toast.error('Pattern name and pattern content are required')
      return
    }

    const newPattern: PatternItem = {
      id: `pattern-${Date.now()}`,
      name: newPatternName,
      description: newPatternDesc,
      pattern: newPatternPattern,
      category: newPatternCategory,
      visibility: newPatternVisibility,
      author: currentUser.name,
      authorId: currentUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: newPatternVersion,
      downloads: 0,
      stars: 0,
      forks: 0,
      tags: newPatternTags.split(',').map(t => t.trim()).filter(t => t),
      exampleUrls: newPatternExamples.split('\n').filter(u => u.trim()),
      compatibility: newPatternCompatibility.split(',').map(c => c.trim()).filter(c => c),
      rating: 0,
      reviews: 0,
      tested: false,
      verified: false
    }

    setMyPatterns(current => [...(current || []), newPattern])
    toast.success(`Pattern "${newPatternName}" created successfully`)
    
    setNewPatternName('')
    setNewPatternDesc('')
    setNewPatternPattern('')
    setNewPatternCategory('url-filter')
    setNewPatternVisibility('public')
    setNewPatternTags('')
    setNewPatternExamples('')
    setNewPatternCompatibility('')
    setNewPatternVersion('1.0.0')
    setShowCreatePattern(false)
  }, [newPatternName, newPatternDesc, newPatternPattern, newPatternCategory, newPatternVisibility, newPatternTags, newPatternExamples, newPatternCompatibility, newPatternVersion, currentUser, setMyPatterns])

  const handleStarPattern = useCallback((patternId: string) => {
    setStarredPatterns(current => {
      const currentArray = current || []
      const isStarred = currentArray.includes(patternId)
      if (isStarred) {
        toast.info('Pattern unstarred')
        return currentArray.filter(id => id !== patternId)
      } else {
        toast.success('Pattern starred!')
        return [...currentArray, patternId]
      }
    })
  }, [setStarredPatterns])

  const handleForkPattern = useCallback((pattern: PatternItem) => {
    const forkedPattern: PatternItem = {
      ...pattern,
      id: `pattern-${Date.now()}`,
      name: `${pattern.name} (Fork)`,
      author: currentUser.name,
      authorId: currentUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloads: 0,
      stars: 0,
      forks: 0
    }

    setMyPatterns(current => [...(current || []), forkedPattern])
    setForkedPatterns(current => [...(current || []), pattern.id])
    toast.success(`Forked pattern "${pattern.name}" to your collection`)
  }, [currentUser, setMyPatterns, setForkedPatterns])

  const handleDownloadPattern = useCallback((pattern: PatternItem) => {
    const patternData = JSON.stringify(pattern, null, 2)
    const blob = new Blob([patternData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pattern.name.toLowerCase().replace(/\s+/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success(`Downloaded pattern "${pattern.name}"`)
  }, [])

  const handleImportPatternFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]
    try {
      const content = await file.text()
      const pattern = JSON.parse(content) as PatternItem
      
      const importedPattern: PatternItem = {
        ...pattern,
        id: `pattern-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      setMyPatterns(current => [...(current || []), importedPattern])
      toast.success(`Imported pattern "${pattern.name}"`)
    } catch (error) {
      toast.error('Failed to import pattern file')
      console.error('Import error:', error)
    }
  }, [setMyPatterns])

  const handleDeletePattern = useCallback((patternId: string) => {
    setMyPatterns(current => {
      const currentArray = current || []
      const pattern = currentArray.find(p => p.id === patternId)
      if (pattern) {
        toast.success(`Deleted pattern "${pattern.name}"`)
      }
      return currentArray.filter(p => p.id !== patternId)
    })
  }, [setMyPatterns])

  const handleSharePattern = useCallback((pattern: PatternItem) => {
    const shareData = {
      name: pattern.name,
      description: pattern.description,
      pattern: pattern.pattern,
      category: pattern.category,
      tags: pattern.tags,
      author: pattern.author
    }
    
    const shareText = JSON.stringify(shareData, null, 2)
    navigator.clipboard.writeText(shareText).then(() => {
      toast.success('Pattern data copied to clipboard - share it with others!')
    }).catch(() => {
      toast.error('Failed to copy pattern data')
    })
  }, [])

  const handleViewPattern = useCallback((pattern: PatternItem) => {
    setSelectedPattern(pattern)
    setShowPatternDetails(true)
  }, [])

  const handleUsePattern = useCallback((pattern: PatternItem) => {
    if (onImportPattern) {
      onImportPattern(pattern)
      toast.success(`Applied pattern "${pattern.name}"`)
    }
  }, [onImportPattern])

  const filteredPatterns = (myPatterns || []).filter(pattern => {
    const matchesSearch = !searchQuery || 
      pattern.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pattern.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pattern.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesCategory = filterCategory === 'all' || pattern.category === filterCategory
    const matchesVisibility = filterVisibility === 'all' || pattern.visibility === filterVisibility
    
    return matchesSearch && matchesCategory && matchesVisibility
  })

  const sortedPatterns = [...filteredPatterns].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'popular':
        return b.downloads - a.downloads
      case 'stars':
        return b.stars - a.stars
      case 'downloads':
        return b.downloads - a.downloads
      default:
        return 0
    }
  })

  const getCategoryIcon = (category: PatternItem['category']) => {
    switch (category) {
      case 'url-filter':
        return <Globe size={16} />
      case 'scraping-rule':
        return <MagnifyingGlass size={16} />
      case 'pagination-rule':
        return <BookOpen size={16} />
      case 'provider-preset':
        return <Package size={16} />
      case 'crawl-config':
        return <GitBranch size={16} />
      default:
        return <Globe size={16} />
    }
  }

  const getCategoryColor = (category: PatternItem['category']) => {
    switch (category) {
      case 'url-filter':
        return 'border-blue-500/30 text-blue-400'
      case 'scraping-rule':
        return 'border-purple-500/30 text-purple-400'
      case 'pagination-rule':
        return 'border-green-500/30 text-green-400'
      case 'provider-preset':
        return 'border-orange-500/30 text-orange-400'
      case 'crawl-config':
        return 'border-cyan-500/30 text-cyan-400'
      default:
        return 'border-accent/30 text-accent'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package size={24} className="text-accent" />
        <h3 className="text-lg font-bold text-foreground">Pattern Repository Hub</h3>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Create, share, and discover scraping patterns, URL filters, and crawling configurations. Build your own pattern library or fork patterns from the community.
      </p>

      <Tabs defaultValue="my-patterns" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-primary/30">
          <TabsTrigger value="my-patterns">My Patterns</TabsTrigger>
          <TabsTrigger value="repositories">Repositories</TabsTrigger>
          <TabsTrigger value="discover">Discover</TabsTrigger>
        </TabsList>
        
        <TabsContent value="my-patterns" className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setShowCreatePattern(true)}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Plus size={20} className="mr-2" />
                Create Pattern
              </Button>
              <label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportPatternFile}
                  className="hidden"
                />
                <Button variant="outline" className="border-accent/30 hover:bg-accent/10 text-accent" asChild>
                  <span>
                    <FileArrowUp size={20} className="mr-2" />
                    Import Pattern
                  </span>
                </Button>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Search patterns by name, description, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="url-filter">URL Filters</SelectItem>
                  <SelectItem value="scraping-rule">Scraping Rules</SelectItem>
                  <SelectItem value="pagination-rule">Pagination Rules</SelectItem>
                  <SelectItem value="provider-preset">Provider Presets</SelectItem>
                  <SelectItem value="crawl-config">Crawl Configs</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="stars">Most Stars</SelectItem>
                  <SelectItem value="downloads">Most Downloads</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {sortedPatterns.length === 0 ? (
            <Alert className="border-accent/30 bg-accent/5">
              <AlertDescription className="text-center py-8">
                <Package size={48} className="mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-foreground mb-2">No patterns found</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || filterCategory !== 'all' 
                    ? 'Try adjusting your filters or search terms' 
                    : 'Create your first pattern to get started'}
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[500px] rounded-md border border-border bg-primary/30 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AnimatePresence>
                  {sortedPatterns.map((pattern, index) => {
                    const isStarred = (starredPatterns || []).includes(pattern.id)
                    const isForked = (forkedPatterns || []).includes(pattern.id)
                    
                    return (
                      <motion.div
                        key={pattern.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.5) }}
                      >
                        <Card className="bg-card border-border p-4 hover:border-accent/50 transition-all duration-200 group">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-foreground truncate">{pattern.name}</h4>
                                  {pattern.verified && (
                                    <Badge variant="outline" className="text-xs border-green-500/30 text-green-500">
                                      <Check size={12} className="mr-1" />
                                      Verified
                                    </Badge>
                                  )}
                                  {pattern.visibility === 'private' && (
                                    <Lock size={16} className="text-muted-foreground" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2">{pattern.description}</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline" className={`text-xs ${getCategoryColor(pattern.category)}`}>
                                {getCategoryIcon(pattern.category)}
                                <span className="ml-1">{pattern.category}</span>
                              </Badge>
                              {pattern.tags.slice(0, 3).map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {pattern.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{pattern.tags.length - 3}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Download size={14} />
                                <span>{pattern.downloads}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Star size={14} className={isStarred ? 'fill-yellow-500 text-yellow-500' : ''} />
                                <span>{pattern.stars}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock size={14} />
                                <span>{new Date(pattern.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>

                            <Separator className="bg-border" />

                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={() => handleViewPattern(pattern)}
                                variant="outline"
                                size="sm"
                                className="flex-1 border-accent/30 hover:bg-accent/10 text-accent"
                              >
                                <Eye size={16} className="mr-1" />
                                View
                              </Button>
                              <Button
                                onClick={() => handleUsePattern(pattern)}
                                variant="outline"
                                size="sm"
                                className="flex-1 border-accent/30 hover:bg-accent/10 text-accent"
                              >
                                <Check size={16} className="mr-1" />
                                Use
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="border-border">
                                    •••
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleStarPattern(pattern.id)} className="cursor-pointer">
                                    <Star size={16} className={`mr-2 ${isStarred ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                                    {isStarred ? 'Unstar' : 'Star'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleForkPattern(pattern)} className="cursor-pointer">
                                    <ForkKnife size={16} className="mr-2" />
                                    Fork
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDownloadPattern(pattern)} className="cursor-pointer">
                                    <FileArrowDown size={16} className="mr-2" />
                                    Download
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleSharePattern(pattern)} className="cursor-pointer">
                                    <Share size={16} className="mr-2" />
                                    Share
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleDeletePattern(pattern.id)} 
                                    className="cursor-pointer text-destructive"
                                  >
                                    <Trash size={16} className="mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </TabsContent>
        
        <TabsContent value="repositories" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setShowCreateRepo(true)}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Plus size={20} className="mr-2" />
              Create Repository
            </Button>
          </div>

          {(repositories || []).length === 0 ? (
            <Alert className="border-accent/30 bg-accent/5">
              <AlertDescription className="text-center py-8">
                <GitBranch size={48} className="mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-foreground mb-2">No repositories yet</p>
                <p className="text-sm text-muted-foreground">
                  Create your first repository to organize and share your patterns
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[500px] rounded-md border border-border bg-primary/30 p-4">
              <div className="space-y-4">
                {(repositories || []).map((repo, index) => (
                  <motion.div
                    key={repo.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.5) }}
                  >
                    <Card className="bg-card border-border p-4 hover:border-accent/50 transition-all duration-200">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <GitBranch size={20} className="text-accent" />
                              <h4 className="font-semibold text-foreground">{repo.name}</h4>
                              {repo.visibility === 'private' ? (
                                <Lock size={16} className="text-muted-foreground" />
                              ) : (
                                <LockOpen size={16} className="text-green-500" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{repo.description}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {repo.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Package size={14} />
                            <span>{repo.patterns.length} patterns</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star size={14} />
                            <span>{repo.stars}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users size={14} />
                            <span>{repo.contributors.length} contributors</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
        
        <TabsContent value="discover" className="space-y-4">
          <Alert className="border-accent/30 bg-accent/5">
            <AlertDescription className="text-center py-8">
              <Sparkle size={48} className="mx-auto mb-4 text-accent" />
              <p className="text-foreground mb-2">Community Pattern Hub Coming Soon</p>
              <p className="text-sm text-muted-foreground">
                Discover and share patterns with the community. Browse curated collections, trending patterns, and verified provider presets.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Badge variant="outline" className="text-xs">Trending Patterns</Badge>
                <Badge variant="outline" className="text-xs">Verified Providers</Badge>
                <Badge variant="outline" className="text-xs">Top Contributors</Badge>
                <Badge variant="outline" className="text-xs">Featured Collections</Badge>
              </div>
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateRepo} onOpenChange={setShowCreateRepo}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch size={20} className="text-accent" />
              Create New Repository
            </DialogTitle>
            <DialogDescription>
              Create a new repository to organize and share your patterns with the community.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="repo-name" className="text-sm font-medium text-foreground block mb-1">
                Repository Name *
              </label>
              <Input
                id="repo-name"
                placeholder="e.g., iptv-providers, streaming-patterns"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="repo-desc" className="text-sm font-medium text-foreground block mb-1">
                Description
              </label>
              <Textarea
                id="repo-desc"
                placeholder="Describe what this repository contains..."
                value={newRepoDesc}
                onChange={(e) => setNewRepoDesc(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="repo-visibility" className="text-sm font-medium text-foreground">
                Visibility
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {newRepoVisibility === 'public' ? 'Public' : 'Private'}
                </span>
                <Switch
                  id="repo-visibility"
                  checked={newRepoVisibility === 'public'}
                  onCheckedChange={(checked) => setNewRepoVisibility(checked ? 'public' : 'private')}
                />
              </div>
            </div>

            <div>
              <label htmlFor="repo-license" className="text-sm font-medium text-foreground block mb-1">
                License
              </label>
              <Select value={newRepoLicense} onValueChange={setNewRepoLicense}>
                <SelectTrigger id="repo-license">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MIT">MIT License</SelectItem>
                  <SelectItem value="Apache-2.0">Apache License 2.0</SelectItem>
                  <SelectItem value="GPL-3.0">GNU GPLv3</SelectItem>
                  <SelectItem value="BSD-3-Clause">BSD 3-Clause</SelectItem>
                  <SelectItem value="CC0-1.0">CC0 1.0 Universal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="repo-tags" className="text-sm font-medium text-foreground block mb-1">
                Tags (comma-separated)
              </label>
              <Input
                id="repo-tags"
                placeholder="e.g., iptv, streaming, m3u, providers"
                value={newRepoTags}
                onChange={(e) => setNewRepoTags(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="repo-readme" className="text-sm font-medium text-foreground block mb-1">
                README (Markdown)
              </label>
              <Textarea
                id="repo-readme"
                placeholder="# Repository Name&#10;&#10;Description and usage instructions..."
                value={newRepoReadme}
                onChange={(e) => setNewRepoReadme(e.target.value)}
                className="min-h-[120px] font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowCreateRepo(false)}
              variant="outline"
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateRepo}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={!newRepoName.trim()}
            >
              <GitBranch size={16} className="mr-2" />
              Create Repository
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreatePattern} onOpenChange={setShowCreatePattern}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus size={20} className="text-accent" />
              Create New Pattern
            </DialogTitle>
            <DialogDescription>
              Create a reusable pattern for URL filtering, scraping, pagination, or crawling.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="pattern-name" className="text-sm font-medium text-foreground block mb-1">
                Pattern Name *
              </label>
              <Input
                id="pattern-name"
                placeholder="e.g., Xtream Codes Filter, M3U Pagination"
                value={newPatternName}
                onChange={(e) => setNewPatternName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="pattern-desc" className="text-sm font-medium text-foreground block mb-1">
                Description
              </label>
              <Textarea
                id="pattern-desc"
                placeholder="Describe what this pattern does and when to use it..."
                value={newPatternDesc}
                onChange={(e) => setNewPatternDesc(e.target.value)}
                className="min-h-[60px]"
              />
            </div>

            <div>
              <label htmlFor="pattern-category" className="text-sm font-medium text-foreground block mb-1">
                Category *
              </label>
              <Select value={newPatternCategory} onValueChange={(v) => setNewPatternCategory(v as any)}>
                <SelectTrigger id="pattern-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="url-filter">URL Filter</SelectItem>
                  <SelectItem value="scraping-rule">Scraping Rule</SelectItem>
                  <SelectItem value="pagination-rule">Pagination Rule</SelectItem>
                  <SelectItem value="provider-preset">Provider Preset</SelectItem>
                  <SelectItem value="crawl-config">Crawl Configuration</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="pattern-pattern" className="text-sm font-medium text-foreground block mb-1">
                Pattern Content * (Regex, JSON, or Code)
              </label>
              <Textarea
                id="pattern-pattern"
                placeholder={`For URL Filter: /^https?:\\/\\/.+\\.m3u8?$/&#10;For Scraping Rule: {"selector": ".video-link", "attribute": "href"}&#10;For Provider Preset: JSON configuration object`}
                value={newPatternPattern}
                onChange={(e) => setNewPatternPattern(e.target.value)}
                className="min-h-[120px] font-mono text-xs"
              />
            </div>

            <div>
              <label htmlFor="pattern-examples" className="text-sm font-medium text-foreground block mb-1">
                Example URLs (one per line)
              </label>
              <Textarea
                id="pattern-examples"
                placeholder="http://example.com/stream.m3u8&#10;https://provider.tv/playlist.m3u"
                value={newPatternExamples}
                onChange={(e) => setNewPatternExamples(e.target.value)}
                className="min-h-[80px] font-mono text-xs"
              />
            </div>

            <div>
              <label htmlFor="pattern-tags" className="text-sm font-medium text-foreground block mb-1">
                Tags (comma-separated)
              </label>
              <Input
                id="pattern-tags"
                placeholder="e.g., m3u, xtream, hls, streaming"
                value={newPatternTags}
                onChange={(e) => setNewPatternTags(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="pattern-compatibility" className="text-sm font-medium text-foreground block mb-1">
                Compatibility (comma-separated)
              </label>
              <Input
                id="pattern-compatibility"
                placeholder="e.g., VLC, Kodi, IPTV Smarters"
                value={newPatternCompatibility}
                onChange={(e) => setNewPatternCompatibility(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pattern-version" className="text-sm font-medium text-foreground block mb-1">
                  Version
                </label>
                <Input
                  id="pattern-version"
                  placeholder="1.0.0"
                  value={newPatternVersion}
                  onChange={(e) => setNewPatternVersion(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <div className="flex items-center justify-between w-full">
                  <label htmlFor="pattern-visibility" className="text-sm font-medium text-foreground">
                    Public
                  </label>
                  <Switch
                    id="pattern-visibility"
                    checked={newPatternVisibility === 'public'}
                    onCheckedChange={(checked) => setNewPatternVisibility(checked ? 'public' : 'private')}
                  />
                </div>
              </div>
            </div>

            <Alert className="border-accent/30 bg-accent/5">
              <AlertDescription className="text-xs">
                <Sparkle size={14} className="inline mr-1" />
                Public patterns can be discovered and used by the community. Private patterns are only visible to you.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowCreatePattern(false)}
              variant="outline"
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreatePattern}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={!newPatternName.trim() || !newPatternPattern.trim()}
            >
              <Plus size={16} className="mr-2" />
              Create Pattern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPatternDetails} onOpenChange={setShowPatternDetails}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          {selectedPattern && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getCategoryIcon(selectedPattern.category)}
                  {selectedPattern.name}
                </DialogTitle>
                <DialogDescription>
                  {selectedPattern.description}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={`text-xs ${getCategoryColor(selectedPattern.category)}`}>
                    {selectedPattern.category}
                  </Badge>
                  {selectedPattern.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Author:</span>
                    <span className="ml-2 text-foreground">{selectedPattern.author}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Version:</span>
                    <span className="ml-2 text-foreground">{selectedPattern.version}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Downloads:</span>
                    <span className="ml-2 text-foreground">{selectedPattern.downloads}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stars:</span>
                    <span className="ml-2 text-foreground">{selectedPattern.stars}</span>
                  </div>
                </div>

                <Separator className="bg-border" />

                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Pattern Content:</h4>
                  <div className="bg-secondary/30 rounded p-3 font-mono text-xs overflow-x-auto">
                    <pre className="whitespace-pre-wrap break-all">{selectedPattern.pattern}</pre>
                  </div>
                </div>

                {selectedPattern.exampleUrls && selectedPattern.exampleUrls.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Example URLs:</h4>
                    <div className="space-y-1">
                      {selectedPattern.exampleUrls.map((url, i) => (
                        <div key={i} className="bg-secondary/30 rounded p-2 font-mono text-xs break-all">
                          {url}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPattern.compatibility && selectedPattern.compatibility.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Compatibility:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedPattern.compatibility.map(compat => (
                        <Badge key={compat} variant="outline" className="text-xs">
                          {compat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex gap-2">
                <Button
                  onClick={() => handleUsePattern(selectedPattern)}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Check size={16} className="mr-2" />
                  Use Pattern
                </Button>
                <Button
                  onClick={() => handleDownloadPattern(selectedPattern)}
                  variant="outline"
                  className="border-accent/30 hover:bg-accent/10 text-accent"
                >
                  <FileArrowDown size={16} className="mr-2" />
                  Download
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
