import { useState, useMemo, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Globe,
  Star,
  Download,
  Upload,
  Fire,
  Clock,
  TrendUp,
  Users,
  Eye,
  Heart,
  ChatCircle,
  GitBranch,
  Package,
  MagnifyingGlass,
  Funnel,
  SortAscending,
  CheckCircle,
  Shield,
  Crown,
  Lightning,
  BookOpen,
  Plus,
  Share,
  Copy,
  Code,
  ArrowUp,
  ArrowDown,
  User,
  Sparkle,
  Tag,
  CalendarBlank,
  FileArrowUp,
  FileArrowDown,
  Bell,
  BellSimple,
  Trophy,
  ChartLine,
  CloudArrowUp,
  CloudArrowDown,
  CaretRight,
  CaretDown,
  X,
  Check
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  getHubPatterns,
  searchHubPatterns,
  publishPattern,
  downloadPattern,
  togglePatternStar,
  forkPattern,
  submitReview,
  getHubStats,
  getFeaturedPatterns,
  getTrendingPatterns,
  getRecentPatterns,
  getCurrentUser,
  updateUserProfile,
  subscribeToPattern,
  unsubscribeFromPattern,
  isSubscribedToPattern,
  getSubscribedPatterns,
  getUserPatterns,
  getPatternComments,
  addPatternComment,
  exportPatternForSharing,
  importPatternFromHub,
  type CommunityPattern,
  type HubUser,
  type HubStats,
  type PublishOptions,
  type SearchFilters,
  type PatternComment
} from '@/lib/communityHub'
import type { StreamingPattern, PatternSubmission } from '@/lib/patternLibrary'

interface CommunityPatternHubProps {
  onImportPattern?: (pattern: StreamingPattern) => void
}

export function CommunityPatternHub({ onImportPattern }: CommunityPatternHubProps) {
  const [currentUser, setCurrentUser] = useState<HubUser | null>(null)
  const [hubStats, setHubStats] = useState<HubStats | null>(null)
  
  const [activeTab, setActiveTab] = useState<'explore' | 'trending' | 'featured' | 'my-patterns' | 'subscriptions'>('explore')
  const [patterns, setPatterns] = useState<CommunityPattern[]>([])
  const [selectedPattern, setSelectedPattern] = useState<CommunityPattern | null>(null)
  const [showPatternDetails, setShowPatternDetails] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterVerified, setFilterVerified] = useState<boolean | undefined>(undefined)
  const [sortBy, setSortBy] = useState<'trending' | 'recent' | 'popular' | 'rating' | 'downloads'>('trending')
  
  const [showPublishDialog, setShowPublishDialog] = useState(false)
  const [publishName, setPublishName] = useState('')
  const [publishDescription, setPublishDescription] = useState('')
  const [publishCategory, setPublishCategory] = useState<StreamingPattern['category']>('custom')
  const [publishPatterns, setPublishPatterns] = useState('')
  const [publishExamples, setPublishExamples] = useState('')
  const [publishTags, setPublishTags] = useState('')
  const [publishLicense, setPublishLicense] = useState<'MIT' | 'Apache-2.0' | 'GPL-3.0' | 'BSD-3-Clause' | 'CC0-1.0' | 'Unlicense'>('MIT')
  const [publishVisibility, setPublishVisibility] = useState<'public' | 'unlisted' | 'private'>('public')
  const [isPublishing, setIsPublishing] = useState(false)
  
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [profileUsername, setProfileUsername] = useState('')
  const [profileDisplayName, setProfileDisplayName] = useState('')
  const [profileBio, setProfileBio] = useState('')
  const [profileWebsite, setProfileWebsite] = useState('')
  
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  
  const [showComments, setShowComments] = useState(false)
  const [patternComments, setPatternComments] = useState<PatternComment[]>([])
  const [newComment, setNewComment] = useState('')
  
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  
  const [starredPatterns, setStarredPatterns] = useState<Set<string>>(new Set())
  const [subscribedPatterns, setSubscribedPatterns] = useState<Set<string>>(new Set())

  // Load current user and stats on mount
  useEffect(() => {
    const user = getCurrentUser()
    setCurrentUser(user)
    if (user) {
      setProfileUsername(user.username)
      setProfileDisplayName(user.displayName)
      setProfileBio(user.bio || '')
      setProfileWebsite(user.website || '')
    }

    const stats = getHubStats()
    setHubStats(stats)

    // Load starred patterns
    const allPatterns = getHubPatterns()
    const starred = new Set<string>()
    allPatterns.forEach(p => {
      if (localStorage.getItem(`starred-${p.id}`) === 'true') {
        starred.add(p.id)
      }
    })
    setStarredPatterns(starred)

    // Load subscribed patterns
    const subscribed = new Set<string>()
    const subscribedList = getSubscribedPatterns()
    subscribedList.forEach(p => subscribed.add(p.id))
    setSubscribedPatterns(subscribed)
  }, [])

  // Load patterns based on active tab
  useEffect(() => {
    loadPatterns()
  }, [activeTab, searchQuery, filterCategory, filterVerified, sortBy])

  const loadPatterns = useCallback(() => {
    let loaded: CommunityPattern[] = []

    switch (activeTab) {
      case 'explore':
        const filters: SearchFilters = {
          query: searchQuery || undefined,
          category: filterCategory !== 'all' ? filterCategory : undefined,
          verified: filterVerified,
          sortBy
        }
        loaded = searchHubPatterns(filters)
        break

      case 'trending':
        loaded = getTrendingPatterns(50)
        break

      case 'featured':
        loaded = getFeaturedPatterns(50)
        break

      case 'my-patterns':
        if (currentUser) {
          loaded = getUserPatterns(currentUser.username)
        }
        break

      case 'subscriptions':
        loaded = getSubscribedPatterns()
        break
    }

    setPatterns(loaded)
  }, [activeTab, searchQuery, filterCategory, filterVerified, sortBy, currentUser])

  const handlePublishPattern = useCallback(async () => {
    if (!publishName.trim() || !publishPatterns.trim()) {
      toast.error('Pattern name and regex patterns are required')
      return
    }

    setIsPublishing(true)

    try {
      const patternList = publishPatterns.split('\n').filter(p => p.trim())
      const exampleList = publishExamples.split('\n').filter(e => e.trim())
      const tagList = publishTags.split(',').map(t => t.trim()).filter(t => t)

      const submission: PatternSubmission = {
        name: publishName,
        description: publishDescription,
        category: publishCategory,
        patterns: patternList,
        exampleUrls: exampleList,
        tags: tagList
      }

      const options: PublishOptions = {
        pattern: submission,
        visibility: publishVisibility,
        license: publishLicense,
        allowForks: true,
        allowComments: true,
        enableVersioning: true,
        notifyFollowers: true
      }

      const published = await publishPattern(options)
      
      toast.success(`Pattern "${publishName}" published successfully!`)
      
      // Reset form
      setPublishName('')
      setPublishDescription('')
      setPublishCategory('custom')
      setPublishPatterns('')
      setPublishExamples('')
      setPublishTags('')
      setPublishVisibility('public')
      setShowPublishDialog(false)

      // Refresh patterns
      loadPatterns()

      // Update stats
      const stats = getHubStats()
      setHubStats(stats)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to publish pattern')
    } finally {
      setIsPublishing(false)
    }
  }, [publishName, publishDescription, publishCategory, publishPatterns, publishExamples, publishTags, publishLicense, publishVisibility, loadPatterns])

  const handleDownloadPattern = useCallback(async (pattern: CommunityPattern) => {
    try {
      await downloadPattern(pattern.id)
      toast.success(`Downloaded "${pattern.name}"`)
      
      // Call the import callback if provided
      if (onImportPattern) {
        onImportPattern(pattern as StreamingPattern)
      }
      
      loadPatterns()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download pattern')
    }
  }, [onImportPattern, loadPatterns])

  const handleStarPattern = useCallback((pattern: CommunityPattern) => {
    try {
      const result = togglePatternStar(pattern.id)
      
      setStarredPatterns(prev => {
        const newSet = new Set(prev)
        if (result.starred) {
          newSet.add(pattern.id)
          toast.success(`Starred "${pattern.name}"`)
        } else {
          newSet.delete(pattern.id)
          toast.info(`Unstarred "${pattern.name}"`)
        }
        return newSet
      })
      
      loadPatterns()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to star pattern')
    }
  }, [loadPatterns])

  const handleForkPattern = useCallback(async (pattern: CommunityPattern) => {
    try {
      const forked = await forkPattern(pattern.id)
      toast.success(`Forked "${pattern.name}" successfully!`)
      loadPatterns()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fork pattern')
    }
  }, [loadPatterns])

  const handleSubscribeToggle = useCallback((pattern: CommunityPattern) => {
    const isSubscribed = subscribedPatterns.has(pattern.id)
    
    if (isSubscribed) {
      unsubscribeFromPattern(pattern.id)
      setSubscribedPatterns(prev => {
        const newSet = new Set(prev)
        newSet.delete(pattern.id)
        return newSet
      })
      toast.info(`Unsubscribed from "${pattern.name}"`)
    } else {
      subscribeToPattern(pattern.id)
      setSubscribedPatterns(prev => new Set(prev).add(pattern.id))
      toast.success(`Subscribed to "${pattern.name}" updates`)
    }
  }, [subscribedPatterns])

  const handleViewPatternDetails = useCallback((pattern: CommunityPattern) => {
    setSelectedPattern(pattern)
    setShowPatternDetails(true)
    
    // Load comments
    const comments = getPatternComments(pattern.id)
    setPatternComments(comments)
  }, [])

  const handleSubmitReview = useCallback(() => {
    if (!selectedPattern) return

    try {
      submitReview(selectedPattern.id, reviewRating, reviewComment)
      toast.success('Review submitted successfully!')
      setReviewRating(5)
      setReviewComment('')
      setShowReviewDialog(false)
      
      // Refresh pattern details
      loadPatterns()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit review')
    }
  }, [selectedPattern, reviewRating, reviewComment, loadPatterns])

  const handleAddComment = useCallback(() => {
    if (!selectedPattern || !newComment.trim()) return

    try {
      addPatternComment(selectedPattern.id, newComment)
      toast.success('Comment added!')
      setNewComment('')
      
      // Reload comments
      const comments = getPatternComments(selectedPattern.id)
      setPatternComments(comments)
      
      loadPatterns()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add comment')
    }
  }, [selectedPattern, newComment, loadPatterns])

  const handleUpdateProfile = useCallback(() => {
    if (!currentUser) return

    try {
      const updated = updateUserProfile({
        username: profileUsername,
        displayName: profileDisplayName,
        bio: profileBio,
        website: profileWebsite
      })
      
      setCurrentUser(updated)
      toast.success('Profile updated successfully!')
      setShowProfileDialog(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile')
    }
  }, [currentUser, profileUsername, profileDisplayName, profileBio, profileWebsite])

  const handleExportPattern = useCallback((pattern: CommunityPattern) => {
    try {
      const jsonString = exportPatternForSharing(pattern.id)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${pattern.name.replace(/\s+/g, '-').toLowerCase()}-pattern.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('Pattern exported successfully!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export pattern')
    }
  }, [])

  const handleCopyPattern = useCallback((pattern: CommunityPattern) => {
    const text = pattern.patterns.join('\n')
    navigator.clipboard.writeText(text)
    toast.success('Patterns copied to clipboard!')
  }, [])

  const toggleCardExpanded = useCallback((patternId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev)
      if (newSet.has(patternId)) {
        newSet.delete(patternId)
      } else {
        newSet.add(patternId)
      }
      return newSet
    })
  }, [])

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'xtream': 'bg-purple-500/10 text-purple-500',
      'hls': 'bg-blue-500/10 text-blue-500',
      'rtmp': 'bg-red-500/10 text-red-500',
      'rtsp': 'bg-orange-500/10 text-orange-500',
      'm3u': 'bg-green-500/10 text-green-500',
      'dash': 'bg-cyan-500/10 text-cyan-500',
      'generic': 'bg-gray-500/10 text-gray-500',
      'iptv-panel': 'bg-pink-500/10 text-pink-500',
      'custom': 'bg-indigo-500/10 text-indigo-500'
    }
    return colors[category] || colors['custom']
  }

  const renderStarRating = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            size={14}
            weight={star <= rating ? 'fill' : 'regular'}
            className={star <= rating ? 'text-yellow-500' : 'text-muted-foreground/30'}
          />
        ))}
        <span className="ml-1 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe size={24} weight="duotone" className="text-primary" />
                Community Pattern Hub
              </CardTitle>
              <CardDescription>
                Discover, share, and collaborate on streaming extraction patterns with the community
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowProfileDialog(true)}
              >
                <User size={16} weight="duotone" />
                Profile
              </Button>
              <Button
                size="sm"
                onClick={() => setShowPublishDialog(true)}
              >
                <Plus size={16} weight="bold" />
                Publish Pattern
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Hub Statistics */}
      {hubStats && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{hubStats.totalPatterns}</div>
                <div className="text-xs text-muted-foreground">Total Patterns</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{hubStats.totalUsers}</div>
                <div className="text-xs text-muted-foreground">Contributors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{hubStats.totalDownloads.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Total Downloads</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-500">{hubStats.totalStars.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Total Stars</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">{hubStats.patternsThisWeek}</div>
                <div className="text-xs text-muted-foreground">This Week</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-500">{hubStats.activeUsers}</div>
                <div className="text-xs text-muted-foreground">Active Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-pink-500">
                  {currentUser ? currentUser.patternsPublished : 0}
                </div>
                <div className="text-xs text-muted-foreground">Your Patterns</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="grid w-full grid-cols-5 mb-4">
              <TabsTrigger value="explore" className="flex items-center gap-2">
                <MagnifyingGlass size={16} />
                Explore
              </TabsTrigger>
              <TabsTrigger value="trending" className="flex items-center gap-2">
                <Fire size={16} />
                Trending
              </TabsTrigger>
              <TabsTrigger value="featured" className="flex items-center gap-2">
                <Crown size={16} />
                Featured
              </TabsTrigger>
              <TabsTrigger value="my-patterns" className="flex items-center gap-2">
                <Package size={16} />
                My Patterns
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="flex items-center gap-2">
                <Bell size={16} />
                Subscriptions
              </TabsTrigger>
            </TabsList>

            {/* Search and Filters (only on explore tab) */}
            {activeTab === 'explore' && (
              <div className="space-y-3 mb-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search patterns, authors, tags..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="xtream">Xtream Codes</SelectItem>
                      <SelectItem value="hls">HLS/M3U8</SelectItem>
                      <SelectItem value="rtmp">RTMP</SelectItem>
                      <SelectItem value="rtsp">RTSP</SelectItem>
                      <SelectItem value="m3u">M3U Playlists</SelectItem>
                      <SelectItem value="dash">DASH</SelectItem>
                      <SelectItem value="generic">Generic</SelectItem>
                      <SelectItem value="iptv-panel">IPTV Panel</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trending">Trending</SelectItem>
                      <SelectItem value="recent">Recent</SelectItem>
                      <SelectItem value="popular">Popular</SelectItem>
                      <SelectItem value="rating">Top Rated</SelectItem>
                      <SelectItem value="downloads">Most Downloaded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="verified-only"
                      checked={filterVerified === true}
                      onCheckedChange={(checked) => setFilterVerified(checked ? true : undefined)}
                    />
                    <Label htmlFor="verified-only" className="text-sm cursor-pointer">
                      Verified only
                    </Label>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {patterns.length} patterns found
                  </Badge>
                </div>
              </div>
            )}

            <TabsContent value={activeTab} className="mt-0">
              {patterns.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No patterns found</p>
                  {activeTab === 'my-patterns' && (
                    <Button
                      className="mt-4"
                      onClick={() => setShowPublishDialog(true)}
                    >
                      Publish Your First Pattern
                    </Button>
                  )}
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3 pr-4">
                    {patterns.map((pattern) => {
                      const isExpanded = expandedCards.has(pattern.id)
                      const isStarred = starredPatterns.has(pattern.id)
                      const isSubscribed = subscribedPatterns.has(pattern.id)

                      return (
                        <motion.div
                          key={pattern.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Card className="hover:border-primary/50 transition-colors">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <CardTitle className="text-base cursor-pointer hover:text-primary transition-colors" onClick={() => handleViewPatternDetails(pattern)}>
                                      {pattern.name}
                                    </CardTitle>
                                    <Badge className={getCategoryColor(pattern.category)}>
                                      {pattern.category}
                                    </Badge>
                                    {pattern.verified && (
                                      <Badge variant="outline" className="text-green-500 border-green-500/30">
                                        <CheckCircle size={12} className="mr-1" weight="fill" />
                                        Verified
                                      </Badge>
                                    )}
                                    {pattern.isFeatured && (
                                      <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                                        <Crown size={12} className="mr-1" weight="fill" />
                                        Featured
                                      </Badge>
                                    )}
                                    {pattern.isOfficial && (
                                      <Badge variant="outline" className="text-blue-500 border-blue-500/30">
                                        <Shield size={12} className="mr-1" weight="fill" />
                                        Official
                                      </Badge>
                                    )}
                                  </div>
                                  <CardDescription className="text-sm line-clamp-2">
                                    {pattern.description}
                                  </CardDescription>
                                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <User size={14} />
                                      {pattern.username}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Download size={14} />
                                      {pattern.downloads.toLocaleString()}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Star size={14} />
                                      {pattern.stars}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Eye size={14} />
                                      {pattern.views}
                                    </span>
                                    {renderStarRating(pattern.rating)}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <Button
                                    size="sm"
                                    variant={isStarred ? 'default' : 'outline'}
                                    onClick={() => handleStarPattern(pattern)}
                                  >
                                    <Star size={16} weight={isStarred ? 'fill' : 'regular'} />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDownloadPattern(pattern)}
                                  >
                                    <Download size={16} />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>

                            {isExpanded && (
                              <CardContent className="pb-3">
                                <div className="space-y-3">
                                  <div>
                                    <div className="text-xs font-medium mb-1 text-muted-foreground">PATTERNS</div>
                                    <div className="bg-muted/50 rounded p-3 space-y-1">
                                      {pattern.patterns.map((p, i) => (
                                        <code key={i} className="text-xs block font-mono">
                                          {p}
                                        </code>
                                      ))}
                                    </div>
                                  </div>

                                  {pattern.exampleUrls.length > 0 && (
                                    <div>
                                      <div className="text-xs font-medium mb-1 text-muted-foreground">EXAMPLE URLS</div>
                                      <div className="space-y-1">
                                        {pattern.exampleUrls.slice(0, 3).map((url, i) => (
                                          <div key={i} className="text-xs text-muted-foreground truncate">
                                            {url}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {pattern.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {pattern.tags.map((tag, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs">
                                          <Tag size={10} className="mr-1" />
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            )}

                            <CardFooter className="pt-3 flex items-center justify-between">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleCardExpanded(pattern.id)}
                              >
                                {isExpanded ? (
                                  <>
                                    <CaretDown size={16} className="mr-1" />
                                    Show Less
                                  </>
                                ) : (
                                  <>
                                    <CaretRight size={16} className="mr-1" />
                                    Show More
                                  </>
                                )}
                              </Button>

                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewPatternDetails(pattern)}
                                >
                                  <BookOpen size={16} className="mr-1" />
                                  Details
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleForkPattern(pattern)}
                                >
                                  <GitBranch size={16} className="mr-1" />
                                  Fork
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyPattern(pattern)}
                                >
                                  <Copy size={16} className="mr-1" />
                                  Copy
                                </Button>
                                <Button
                                  variant={isSubscribed ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => handleSubscribeToggle(pattern)}
                                >
                                  {isSubscribed ? <Bell size={16} weight="fill" /> : <BellSimple size={16} />}
                                </Button>
                              </div>
                            </CardFooter>
                          </Card>
                        </motion.div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Publish Pattern Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CloudArrowUp size={24} weight="duotone" />
              Publish Pattern to Community Hub
            </DialogTitle>
            <DialogDescription>
              Share your custom pattern with the community. Make sure to test it thoroughly before publishing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="publish-name">Pattern Name *</Label>
              <Input
                id="publish-name"
                value={publishName}
                onChange={(e) => setPublishName(e.target.value)}
                placeholder="e.g., Custom IPTV Provider Pattern"
              />
            </div>

            <div>
              <Label htmlFor="publish-description">Description *</Label>
              <Textarea
                id="publish-description"
                value={publishDescription}
                onChange={(e) => setPublishDescription(e.target.value)}
                placeholder="Describe what this pattern does and when to use it..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="publish-category">Category</Label>
                <Select value={publishCategory} onValueChange={(v: any) => setPublishCategory(v)}>
                  <SelectTrigger id="publish-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xtream">Xtream Codes</SelectItem>
                    <SelectItem value="hls">HLS/M3U8</SelectItem>
                    <SelectItem value="rtmp">RTMP</SelectItem>
                    <SelectItem value="rtsp">RTSP</SelectItem>
                    <SelectItem value="m3u">M3U Playlists</SelectItem>
                    <SelectItem value="dash">DASH</SelectItem>
                    <SelectItem value="generic">Generic</SelectItem>
                    <SelectItem value="iptv-panel">IPTV Panel</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="publish-license">License</Label>
                <Select value={publishLicense} onValueChange={(v: any) => setPublishLicense(v)}>
                  <SelectTrigger id="publish-license">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MIT">MIT</SelectItem>
                    <SelectItem value="Apache-2.0">Apache 2.0</SelectItem>
                    <SelectItem value="GPL-3.0">GPL 3.0</SelectItem>
                    <SelectItem value="BSD-3-Clause">BSD 3-Clause</SelectItem>
                    <SelectItem value="CC0-1.0">CC0 1.0</SelectItem>
                    <SelectItem value="Unlicense">Unlicense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="publish-patterns">Regex Patterns * (one per line)</Label>
              <Textarea
                id="publish-patterns"
                value={publishPatterns}
                onChange={(e) => setPublishPatterns(e.target.value)}
                placeholder="https?://example\\.com/.*\\.m3u8&#10;https?://provider\\.tv/live/.*"
                rows={5}
                className="font-mono text-sm"
              />
            </div>

            <div>
              <Label htmlFor="publish-examples">Example URLs (one per line)</Label>
              <Textarea
                id="publish-examples"
                value={publishExamples}
                onChange={(e) => setPublishExamples(e.target.value)}
                placeholder="http://example.com/stream.m3u8&#10;http://provider.tv/live/channel123"
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="publish-tags">Tags (comma-separated)</Label>
              <Input
                id="publish-tags"
                value={publishTags}
                onChange={(e) => setPublishTags(e.target.value)}
                placeholder="iptv, live-tv, streaming, hls"
              />
            </div>

            <div>
              <Label htmlFor="publish-visibility">Visibility</Label>
              <Select value={publishVisibility} onValueChange={(v: any) => setPublishVisibility(v)}>
                <SelectTrigger id="publish-visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public - Visible to everyone</SelectItem>
                  <SelectItem value="unlisted">Unlisted - Only via direct link</SelectItem>
                  <SelectItem value="private">Private - Only you can see it</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handlePublishPattern} disabled={isPublishing}>
              {isPublishing ? (
                <>
                  <Lightning size={16} className="mr-2 animate-pulse" />
                  Publishing...
                </>
              ) : (
                <>
                  <CloudArrowUp size={16} className="mr-2" />
                  Publish Pattern
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pattern Details Dialog */}
      <Dialog open={showPatternDetails} onOpenChange={setShowPatternDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedPattern && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <DialogTitle className="flex items-center gap-2 flex-wrap">
                      {selectedPattern.name}
                      <Badge className={getCategoryColor(selectedPattern.category)}>
                        {selectedPattern.category}
                      </Badge>
                      {selectedPattern.verified && (
                        <Badge variant="outline" className="text-green-500 border-green-500/30">
                          <CheckCircle size={12} className="mr-1" weight="fill" />
                          Verified
                        </Badge>
                      )}
                    </DialogTitle>
                    <DialogDescription className="mt-2">
                      {selectedPattern.description}
                    </DialogDescription>
                    <div className="flex items-center gap-4 mt-3 text-sm">
                      <span className="flex items-center gap-1">
                        <User size={16} />
                        {selectedPattern.username}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarBlank size={16} />
                        {new Date(selectedPattern.publishedAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Download size={16} />
                        {selectedPattern.downloads.toLocaleString()} downloads
                      </span>
                      <span className="flex items-center gap-1">
                        <Star size={16} />
                        {selectedPattern.stars} stars
                      </span>
                      <span className="flex items-center gap-1">
                        <GitBranch size={16} />
                        {selectedPattern.forks} forks
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleDownloadPattern(selectedPattern)}
                  >
                    <Download size={18} className="mr-2" />
                    Download
                  </Button>
                </div>
              </DialogHeader>

              <Separator />

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Regex Patterns</h3>
                  <div className="bg-muted/50 rounded p-4 space-y-2">
                    {selectedPattern.patterns.map((pattern, i) => (
                      <code key={i} className="block font-mono text-sm">
                        {pattern}
                      </code>
                    ))}
                  </div>
                </div>

                {selectedPattern.exampleUrls.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Example URLs</h3>
                    <div className="space-y-1">
                      {selectedPattern.exampleUrls.map((url, i) => (
                        <div key={i} className="text-sm text-muted-foreground font-mono bg-muted/30 p-2 rounded">
                          {url}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPattern.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedPattern.tags.map((tag, i) => (
                        <Badge key={i} variant="secondary">
                          <Tag size={12} className="mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold mb-2">Rating & Reviews</h3>
                  <div className="flex items-center gap-4">
                    {renderStarRating(selectedPattern.rating)}
                    <span className="text-sm text-muted-foreground">
                      {selectedPattern.reviews.length} reviews
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowReviewDialog(true)}
                    >
                      <Star size={16} className="mr-1" />
                      Write a Review
                    </Button>
                  </div>
                </div>

                {selectedPattern.reviews.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Recent Reviews</h3>
                    <div className="space-y-3">
                      {selectedPattern.reviews.slice(0, 3).map((review, i) => (
                        <div key={i} className="border rounded p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{review.author}</span>
                              {renderStarRating(review.rating)}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{review.comment}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleStarPattern(selectedPattern)}
                  >
                    <Star size={18} className="mr-2" weight={starredPatterns.has(selectedPattern.id) ? 'fill' : 'regular'} />
                    {starredPatterns.has(selectedPattern.id) ? 'Unstar' : 'Star'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleForkPattern(selectedPattern)}
                  >
                    <GitBranch size={18} className="mr-2" />
                    Fork
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExportPattern(selectedPattern)}
                  >
                    <FileArrowDown size={18} className="mr-2" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSubscribeToggle(selectedPattern)}
                  >
                    {subscribedPatterns.has(selectedPattern.id) ? (
                      <>
                        <Bell size={18} className="mr-2" weight="fill" />
                        Unsubscribe
                      </>
                    ) : (
                      <>
                        <BellSimple size={18} className="mr-2" />
                        Subscribe
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your Profile</DialogTitle>
            <DialogDescription>
              Update your community profile information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="profile-username">Username</Label>
              <Input
                id="profile-username"
                value={profileUsername}
                onChange={(e) => setProfileUsername(e.target.value)}
                placeholder="username"
              />
            </div>

            <div>
              <Label htmlFor="profile-display-name">Display Name</Label>
              <Input
                id="profile-display-name"
                value={profileDisplayName}
                onChange={(e) => setProfileDisplayName(e.target.value)}
                placeholder="Your Name"
              />
            </div>

            <div>
              <Label htmlFor="profile-bio">Bio</Label>
              <Textarea
                id="profile-bio"
                value={profileBio}
                onChange={(e) => setProfileBio(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="profile-website">Website</Label>
              <Input
                id="profile-website"
                value={profileWebsite}
                onChange={(e) => setProfileWebsite(e.target.value)}
                placeholder="https://yourwebsite.com"
              />
            </div>

            {currentUser && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold">{currentUser.patternsPublished}</div>
                  <div className="text-xs text-muted-foreground">Patterns</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{currentUser.reputation}</div>
                  <div className="text-xs text-muted-foreground">Reputation</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{currentUser.totalDownloads}</div>
                  <div className="text-xs text-muted-foreground">Downloads</div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProfileDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProfile}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
            <DialogDescription>
              Share your experience with this pattern
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Rating</Label>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="focus:outline-none"
                  >
                    <Star
                      size={32}
                      weight={star <= reviewRating ? 'fill' : 'regular'}
                      className={`transition-colors ${
                        star <= reviewRating ? 'text-yellow-500' : 'text-muted-foreground/30'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="review-comment">Comment</Label>
              <Textarea
                id="review-comment"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your thoughts about this pattern..."
                rows={5}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitReview}>
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
