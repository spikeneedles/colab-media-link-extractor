import { useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DeviceMobile, Copy, CheckCircle, PlayCircle, FileCode, Package, Sparkle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

interface AndroidMediaServerProps {
  linksWithCounts?: Array<{
    url: string
    title?: string
    category?: string
    mediaType?: 'video' | 'audio' | 'unknown'
  }>
}

export function AndroidMediaServer({ linksWithCounts = [] }: AndroidMediaServerProps) {
  const [backendUrl, setBackendUrl] = useState('http://localhost:3001')
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set())
  const [generatedPlaylist, setGeneratedPlaylist] = useState<string>('')
  const [showPlaylist, setShowPlaylist] = useState(false)

  const generateProxyUrl = useCallback((url: string, title?: string): string => {
    const params = new URLSearchParams({ url })
    if (title) params.append('title', title)
    return `${backendUrl}/api/media/stream?${params.toString()}`
  }, [backendUrl])

  const handleCopyProxyUrl = useCallback((url: string, title?: string) => {
    const proxyUrl = generateProxyUrl(url, title)
    navigator.clipboard.writeText(proxyUrl).then(() => {
      toast.success('Proxy URL copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy URL')
    })
  }, [generateProxyUrl])

  const handleCopyAllProxyUrls = useCallback(() => {
    const urls = linksWithCounts
      .map(link => generateProxyUrl(link.url, link.title))
      .join('\n')
    
    navigator.clipboard.writeText(urls).then(() => {
      toast.success(`Copied ${linksWithCounts.length} proxy URLs`)
    }).catch(() => {
      toast.error('Failed to copy URLs')
    })
  }, [linksWithCounts, generateProxyUrl])

  const handleGenerateAndroidPlaylist = useCallback(async () => {
    if (linksWithCounts.length === 0) {
      toast.error('No links available to generate playlist')
      return
    }

    try {
      const links = linksWithCounts.map(link => ({
        url: link.url,
        title: link.title,
        category: link.category,
        duration: -1
      }))

      const response = await fetch(`${backendUrl}/api/media/generate-m3u`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          links,
          playlistName: 'Android Media Player Playlist',
          playlistDescription: 'Generated playlist with proxied URLs for Android media players'
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const playlistContent = await response.text()
      setGeneratedPlaylist(playlistContent)
      setShowPlaylist(true)
      toast.success('Android playlist generated successfully')
    } catch (error) {
      console.error('Playlist generation error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate playlist')
    }
  }, [linksWithCounts, backendUrl])

  const handleDownloadPlaylist = useCallback(() => {
    if (!generatedPlaylist) return

    const blob = new Blob([generatedPlaylist], { type: 'application/vnd.apple.mpegurl' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'android-media-player.m3u'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Playlist downloaded')
  }, [generatedPlaylist])

  const handleCopyPlaylist = useCallback(() => {
    if (!generatedPlaylist) return

    navigator.clipboard.writeText(generatedPlaylist).then(() => {
      toast.success('Playlist copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy playlist')
    })
  }, [generatedPlaylist])

  const kotlinCode = `// Android ExoPlayer Integration
import com.google.android.exoplayer2.ExoPlayer
import com.google.android.exoplayer2.MediaItem
import java.net.URLEncoder

val proxyUrl = "${backendUrl}/api/media/stream?url=" + 
    URLEncoder.encode(originalUrl, "UTF-8")

val player = ExoPlayer.Builder(context).build()
val mediaItem = MediaItem.fromUri(proxyUrl)
player.setMediaItem(mediaItem)
player.prepare()
player.play()`

  const vlcCode = `// VLC Android Integration
import org.videolan.libvlc.LibVLC
import org.videolan.libvlc.Media
import org.videolan.libvlc.MediaPlayer

val libVLC = LibVLC(context)
val mediaPlayer = MediaPlayer(libVLC)

val proxyUrl = "${backendUrl}/api/media/stream?url=" + 
    URLEncoder.encode(originalUrl, "UTF-8")

val media = Media(libVLC, Uri.parse(proxyUrl))
mediaPlayer.media = media
mediaPlayer.play()`

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <DeviceMobile size={24} className="text-accent" />
        <h3 className="text-lg font-bold text-foreground">Android Media Server</h3>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Stream media directly to Android TV, mobile apps, and other players. The backend server proxies media URLs with full range request support for seeking and adaptive streaming.
      </p>

      <div className="space-y-3">
        <div>
          <Label htmlFor="backend-url" className="text-sm font-medium text-foreground">
            Backend Server URL
          </Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="backend-url"
              type="url"
              placeholder="http://localhost:3001"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => {
                navigator.clipboard.writeText(backendUrl)
                toast.success('Backend URL copied')
              }}
              variant="outline"
              size="sm"
              className="border-accent/30 hover:bg-accent/10 text-accent shrink-0"
            >
              <Copy size={16} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Make sure the backend server is running on this URL
          </p>
        </div>

        {linksWithCounts.length > 0 && (
          <>
            <Separator className="bg-border" />
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Available Media ({linksWithCounts.length})
                </h4>
                <p className="text-xs text-muted-foreground">
                  Generate proxy URLs for Android media players
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCopyAllProxyUrls}
                  variant="outline"
                  size="sm"
                  className="border-accent/30 hover:bg-accent/10 text-accent"
                >
                  <Copy size={16} className="mr-1" />
                  Copy All URLs
                </Button>
                <Button
                  onClick={handleGenerateAndroidPlaylist}
                  variant="default"
                  size="sm"
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Package size={16} className="mr-1" />
                  Generate M3U Playlist
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[200px] rounded-md border border-border bg-primary/30 p-4">
              <div className="space-y-2">
                {linksWithCounts.slice(0, 10).map((link, index) => (
                  <motion.div
                    key={link.url}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className="flex items-start gap-2 p-2 rounded hover:bg-accent/10 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      {link.title && (
                        <div className="text-sm font-semibold text-foreground mb-1">
                          {link.title}
                        </div>
                      )}
                      {link.category && (
                        <Badge variant="outline" className="text-xs border-accent/30 text-accent mb-1">
                          {link.category}
                        </Badge>
                      )}
                      <div className="text-xs font-mono text-muted-foreground break-all">
                        {generateProxyUrl(link.url, link.title)}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleCopyProxyUrl(link.url, link.title)}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Copy size={14} />
                    </Button>
                  </motion.div>
                ))}
                {linksWithCounts.length > 10 && (
                  <div className="text-center text-xs text-muted-foreground py-2">
                    ... and {linksWithCounts.length - 10} more
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}

        {showPlaylist && generatedPlaylist && (
          <>
            <Separator className="bg-border" />
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Generated M3U Playlist
                </h4>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCopyPlaylist}
                    variant="outline"
                    size="sm"
                    className="border-accent/30 hover:bg-accent/10 text-accent"
                  >
                    <Copy size={16} className="mr-1" />
                    Copy
                  </Button>
                  <Button
                    onClick={handleDownloadPlaylist}
                    variant="default"
                    size="sm"
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    <Package size={16} className="mr-1" />
                    Download M3U
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[150px] rounded-md border border-border bg-primary/30 p-4">
                <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                  {generatedPlaylist}
                </pre>
              </ScrollArea>
            </div>
          </>
        )}

        <Separator className="bg-border" />

        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileCode size={20} className="text-accent" />
            <h4 className="text-sm font-semibold text-foreground">Integration Code Examples</h4>
          </div>
          
          <Tabs defaultValue="exoplayer" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-primary/30">
              <TabsTrigger value="exoplayer">ExoPlayer</TabsTrigger>
              <TabsTrigger value="vlc">VLC Android</TabsTrigger>
            </TabsList>
            
            <TabsContent value="exoplayer" className="mt-3">
              <div className="relative">
                <ScrollArea className="h-[200px] rounded-md border border-border bg-primary/30 p-4">
                  <pre className="text-xs font-mono text-foreground">
                    {kotlinCode}
                  </pre>
                </ScrollArea>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(kotlinCode)
                    toast.success('Code copied to clipboard')
                  }}
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-8 w-8 p-0 bg-background/80 hover:bg-accent/20"
                >
                  <Copy size={14} />
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="vlc" className="mt-3">
              <div className="relative">
                <ScrollArea className="h-[200px] rounded-md border border-border bg-primary/30 p-4">
                  <pre className="text-xs font-mono text-foreground">
                    {vlcCode}
                  </pre>
                </ScrollArea>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(vlcCode)
                    toast.success('Code copied to clipboard')
                  }}
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-8 w-8 p-0 bg-background/80 hover:bg-accent/20"
                >
                  <Copy size={14} />
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <Alert className="border-accent/30 bg-accent/5">
          <AlertDescription className="text-foreground text-xs">
            <Sparkle size={14} className="inline mr-1" />
            <strong>Features:</strong> Full HTTP 206 range request support, CORS enabled, Android optimized headers, automatic content-type detection, and built-in caching for better performance.
          </AlertDescription>
        </Alert>

        <Alert className="border-blue-500/30 bg-blue-500/5">
          <AlertDescription className="text-foreground text-xs">
            <CheckCircle size={14} className="inline mr-1 text-blue-500" />
            <strong>Compatible with:</strong> ExoPlayer, VLC, Kodi, MX Player, Perfect Player, TiviMate, GSE Smart IPTV, IPTV Smarters, and all standard Android media players.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}
