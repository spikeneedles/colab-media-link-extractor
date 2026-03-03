import { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Play, Trash, ArrowsClockwise, MagnifyingGlass, Spinner } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { QueueItem } from './MediaPlayer'

interface MediaItem {
  id: string
  url: string
  title: string
  category: 'live tv' | 'movies' | 'series'
  addedAt: number
  metadata?: {
    duration?: number
    resolution?: string
    format?: string
    source?: string
    [key: string]: any
  }
}

interface MediaList {
  id: string
  category: 'live tv' | 'movies' | 'series'
  items: MediaItem[]
  lastUpdated: number
  itemCount: number
}

interface FirebaseMediaBrowserProps {
  onPlayMedia?: (urls: string[], mediaType: 'video' | 'audio', title: string) => void
  onMediaSelect?: (item: MediaItem) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  'live tv': 'bg-red-500',
  'movies': 'bg-blue-500',
  'series': 'bg-purple-500',
}

const CATEGORY_ICONS: Record<string, string> = {
  'live tv': '📺',
  'movies': '🎬',
  'series': '📺',
}

export function FirebaseMediaBrowser({ onPlayMedia, onMediaSelect }: FirebaseMediaBrowserProps) {
  const [activeCategory, setActiveCategory] = useState<'live tv' | 'movies' | 'series'>('movies')
  const [mediaLists, setMediaLists] = useState<Record<string, MediaList>>({})
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MediaItem[]>([])
  const [stats, setStats] = useState({
    totalCategories: 0,
    categories: [] as any[],
    totalItems: 0,
  })

  // Fetch media lists from Firebase
  const fetchMediaLists = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/media-list')
      const data = await response.json()

      if (data.success) {
        const listsMap = data.data.reduce(
          (acc: Record<string, MediaList>, list: MediaList) => {
            acc[list.category] = list
            return acc
          },
          {}
        )
        setMediaLists(listsMap)
        setStats({
          totalCategories: data.totalLists,
          categories: data.data,
          totalItems: data.data.reduce((sum: number, list: MediaList) => sum + list.itemCount, 0),
        })
      }
    } catch (error) {
      console.error('Failed to fetch media lists:', error)
      toast.error('Failed to load media lists')
    } finally {
      setLoading(false)
    }
  }, [])

  // Search media
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    try {
      setSearching(true)
      const response = await fetch(`/api/media-list/search/query?q=${encodeURIComponent(query)}`)
      const data = await response.json()

      if (data.success) {
        setSearchResults(data.data)
      }
    } catch (error) {
      console.error('Search failed:', error)
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }, [])

  // Delete media item
  const handleDeleteMedia = useCallback(
    async (category: 'live tv' | 'movies' | 'series', mediaId: string) => {
      try {
        const response = await fetch(`/api/media-list/${category}/${mediaId}`, {
          method: 'DELETE',
        })

        if (response.ok) {
          toast.success('Media removed')
          await fetchMediaLists()
        } else {
          toast.error('Failed to remove media')
        }
      } catch (error) {
        console.error('Delete failed:', error)
        toast.error('Delete failed')
      }
    },
    [fetchMediaLists]
  )

  // Play media
  const handlePlayMedia = useCallback(
    (item: MediaItem) => {
      if (onPlayMedia) {
        const mediaType = item.category === 'live tv' || item.metadata?.format?.includes('m3u8') ? 'video' : 'video'
        onPlayMedia([item.url], mediaType, item.title)
      }

      if (onMediaSelect) {
        onMediaSelect(item)
      }
    },
    [onPlayMedia, onMediaSelect]
  )

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString()
  }

  // Format file size
  const formatSize = (bytes?: number) => {
    if (!bytes) return 'N/A'
    const kb = bytes / 1024
    const mb = kb / 1024
    const gb = mb / 1024

    if (gb > 0) return `${gb.toFixed(2)} GB`
    if (mb > 0) return `${mb.toFixed(2)} MB`
    if (kb > 0) return `${kb.toFixed(2)} KB`
    return `${bytes} B`
  }

  // Get current media list
  const currentList = mediaLists[activeCategory]

  useEffect(() => {
    fetchMediaLists()
  }, [fetchMediaLists])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Firebase Media Library</h2>
        <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
          <div>Total Items: {stats.totalItems}</div>
          <div>Categories: {stats.totalCategories}</div>
          <Button size="sm" variant="outline" onClick={() => fetchMediaLists()} className="w-fit">
            <ArrowsClockwise className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search Section */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Search All Media</h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search media..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                handleSearch(e.target.value)
              }}
              className="pl-10"
            />
          </div>
        </div>

        {searchQuery && (
          <div className="border rounded-lg p-2 space-y-2 max-h-48 overflow-y-auto">
            {searching ? (
              <div className="flex justify-center p-4">
                <Spinner className="w-4 h-4 animate-spin" />
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 bg-secondary rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_ICONS[item.category]} {item.category} · {formatTime(item.addedAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePlayMedia(item)}
                    className="ml-2"
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground p-2">No results found</p>
            )}
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as any)} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="live tv">
            {CATEGORY_ICONS['live tv']} Live TV
            <Badge variant="outline" className="ml-2">
              {mediaLists['live tv']?.itemCount || 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="movies">
            {CATEGORY_ICONS['movies']} Movies
            <Badge variant="outline" className="ml-2">
              {mediaLists['movies']?.itemCount || 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="series">
            {CATEGORY_ICONS['series']} Series
            <Badge variant="outline" className="ml-2">
              {mediaLists['series']?.itemCount || 0}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Live TV Tab */}
        <TabsContent value="live tv" className="flex-1 overflow-hidden">
          <MediaListView
            list={mediaLists['live tv']}
            onPlay={handlePlayMedia}
            onDelete={handleDeleteMedia}
            formatSize={formatSize}
            formatTime={formatTime}
          />
        </TabsContent>

        {/* Movies Tab */}
        <TabsContent value="movies" className="flex-1 overflow-hidden">
          <MediaListView
            list={mediaLists['movies']}
            onPlay={handlePlayMedia}
            onDelete={handleDeleteMedia}
            formatSize={formatSize}
            formatTime={formatTime}
          />
        </TabsContent>

        {/* Series Tab */}
        <TabsContent value="series" className="flex-1 overflow-hidden">
          <MediaListView
            list={mediaLists['series']}
            onPlay={handlePlayMedia}
            onDelete={handleDeleteMedia}
            formatSize={formatSize}
            formatTime={formatTime}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface MediaListViewProps {
  list?: MediaList
  onPlay: (item: MediaItem) => void
  onDelete: (category: 'live tv' | 'movies' | 'series', id: string) => void
  formatSize: (bytes?: number) => string
  formatTime: (timestamp: number) => string
}

function MediaListView({ list, onPlay, onDelete, formatSize, formatTime }: MediaListViewProps) {
  if (!list || list.items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No media in this category</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-4">
        {list.items.map((item) => (
          <Card key={item.id} className="hover:bg-accent transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">{item.title}</CardTitle>
                  <CardDescription className="text-xs">
                    Added {formatTime(item.addedAt)} · {formatSize(item.metadata?.size)}
                  </CardDescription>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button size="sm" variant="ghost" onClick={() => onPlay(item)}>
                    <Play className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(item.category, item.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {item.metadata && (
              <CardContent className="pb-2">
                <div className="text-xs text-muted-foreground space-y-1">
                  {item.metadata.source && <p>Source: {item.metadata.source}</p>}
                  {item.metadata.resolution && <p>Resolution: {item.metadata.resolution}</p>}
                  {item.metadata.seeders !== undefined && item.metadata.leechers !== undefined && (
                    <p>
                      📊 {item.metadata.seeders} seeds / {item.metadata.leechers} leeches
                    </p>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </ScrollArea>
  )
}
