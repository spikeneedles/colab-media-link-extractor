import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Play, Pause, SpeakerHigh, SpeakerSlash, X, ArrowsOut, ArrowsIn, VideoCamera, MusicNote, Warning, SkipForward, SkipBack, Repeat, RepeatOnce, Shuffle, Queue, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

export interface QueueItem {
  url: string
  title?: string
  mediaType: 'video' | 'audio' | 'unknown'
}

interface MediaPlayerProps {
  url: string
  title?: string
  mediaType: 'video' | 'audio' | 'unknown'
  onClose: () => void
  queue?: QueueItem[]
  currentIndex?: number
  onQueueChange?: (queue: QueueItem[], currentIndex: number) => void
}

export function MediaPlayer({ url, title, mediaType, onClose, queue = [], currentIndex = 0, onQueueChange }: MediaPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off')
  const [shuffleMode, setShuffleMode] = useState(false)
  const [showQueue, setShowQueue] = useState(false)
  const [localQueue, setLocalQueue] = useState<QueueItem[]>(queue)
  const [localCurrentIndex, setLocalCurrentIndex] = useState(currentIndex)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentItem = localQueue[localCurrentIndex] || { url, title, mediaType }
  const mediaRef = currentItem.mediaType === 'video' ? videoRef : audioRef
  const hasQueue = localQueue.length > 0

  const playItem = useCallback((index: number) => {
    if (index < 0 || index >= localQueue.length) return
    
    setLocalCurrentIndex(index)
    setError(null)
    setIsLoading(true)
    setCurrentTime(0)
    setDuration(0)
    
    if (onQueueChange) {
      onQueueChange(localQueue, index)
    }

    setTimeout(() => {
      const media = mediaRef.current
      if (media) {
        media.load()
        media.play().then(() => {
          setIsPlaying(true)
        }).catch(() => {
          toast.error('Failed to play next media')
        })
      }
    }, 100)
  }, [localQueue, mediaRef, onQueueChange])

  const playNext = useCallback(() => {
    if (!hasQueue) return

    let nextIndex = localCurrentIndex + 1

    if (shuffleMode) {
      const availableIndices = localQueue
        .map((_, i) => i)
        .filter(i => i !== localCurrentIndex)
      if (availableIndices.length > 0) {
        nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
      }
    }

    if (nextIndex < localQueue.length) {
      playItem(nextIndex)
    } else if (repeatMode === 'all') {
      playItem(0)
    }
  }, [hasQueue, localCurrentIndex, shuffleMode, localQueue, repeatMode, playItem])

  const handleMediaEnded = useCallback(() => {
    if (repeatMode === 'one') {
      const media = mediaRef.current
      if (media) {
        media.currentTime = 0
        media.play()
        setIsPlaying(true)
      }
      return
    }

    if (hasQueue && localCurrentIndex < localQueue.length - 1) {
      playNext()
    } else if (repeatMode === 'all' && hasQueue) {
      playItem(0)
    }
  }, [repeatMode, mediaRef, hasQueue, localCurrentIndex, localQueue.length, playNext, playItem])

  useEffect(() => {
    const media = mediaRef.current
    if (!media) return

    media.volume = volume

    const handleLoadedMetadata = () => {
      setDuration(media.duration)
      setIsLoading(false)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(media.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      handleMediaEnded()
    }

    const handleError = () => {
      setError('Failed to load media. The URL may be invalid or require authentication.')
      setIsLoading(false)
      toast.error('Failed to load media stream')
    }

    const handleLoadStart = () => {
      setIsLoading(true)
      setError(null)
    }

    const handleCanPlay = () => {
      setIsLoading(false)
    }

    media.addEventListener('loadedmetadata', handleLoadedMetadata)
    media.addEventListener('timeupdate', handleTimeUpdate)
    media.addEventListener('ended', handleEnded)
    media.addEventListener('error', handleError)
    media.addEventListener('loadstart', handleLoadStart)
    media.addEventListener('canplay', handleCanPlay)

    return () => {
      media.removeEventListener('loadedmetadata', handleLoadedMetadata)
      media.removeEventListener('timeupdate', handleTimeUpdate)
      media.removeEventListener('ended', handleEnded)
      media.removeEventListener('error', handleError)
      media.removeEventListener('loadstart', handleLoadStart)
      media.removeEventListener('canplay', handleCanPlay)
    }
  }, [mediaRef, volume, handleMediaEnded])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    setLocalQueue(queue)
  }, [queue])

  useEffect(() => {
    setLocalCurrentIndex(currentIndex)
  }, [currentIndex])

  const togglePlay = () => {
    const media = mediaRef.current
    if (!media) return

    if (isPlaying) {
      media.pause()
    } else {
      media.play().catch(() => {
        toast.error('Failed to play media')
      })
    }
    setIsPlaying(!isPlaying)
  }

  const toggleMute = () => {
    const media = mediaRef.current
    if (!media) return

    media.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (value: number[]) => {
    const media = mediaRef.current
    if (!media) return

    const newVolume = value[0]
    media.volume = newVolume
    setVolume(newVolume)
    if (newVolume === 0) {
      setIsMuted(true)
      media.muted = true
    } else if (isMuted) {
      setIsMuted(false)
      media.muted = false
    }
  }

  const handleSeek = (value: number[]) => {
    const media = mediaRef.current
    if (!media) return

    media.currentTime = value[0]
    setCurrentTime(value[0])
  }

  const toggleFullscreen = async () => {
    if (!containerRef.current) return

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (error) {
      toast.error('Fullscreen not supported')
    }
  }

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const playPrevious = () => {
    if (!hasQueue) return

    if (currentTime > 3) {
      const media = mediaRef.current
      if (media) {
        media.currentTime = 0
      }
      return
    }

    let prevIndex = localCurrentIndex - 1

    if (shuffleMode) {
      const availableIndices = localQueue
        .map((_, i) => i)
        .filter(i => i !== localCurrentIndex)
      if (availableIndices.length > 0) {
        prevIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
      }
    }

    if (prevIndex >= 0) {
      playItem(prevIndex)
    } else if (repeatMode === 'all') {
      playItem(localQueue.length - 1)
    }
  }

  const removeFromQueue = (index: number) => {
    const newQueue = localQueue.filter((_, i) => i !== index)
    
    if (index < localCurrentIndex) {
      setLocalCurrentIndex(localCurrentIndex - 1)
      setLocalQueue(newQueue)
      if (onQueueChange) {
        onQueueChange(newQueue, localCurrentIndex - 1)
      }
    } else if (index === localCurrentIndex) {
      if (newQueue.length === 0) {
        onClose()
        return
      }
      setLocalQueue(newQueue)
      const newIndex = Math.min(localCurrentIndex, newQueue.length - 1)
      setLocalCurrentIndex(newIndex)
      if (onQueueChange) {
        onQueueChange(newQueue, newIndex)
      }
      playItem(newIndex)
    } else {
      setLocalQueue(newQueue)
      if (onQueueChange) {
        onQueueChange(newQueue, localCurrentIndex)
      }
    }

    toast.success('Removed from queue')
  }

  const toggleRepeat = () => {
    const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one']
    const currentModeIndex = modes.indexOf(repeatMode)
    const nextMode = modes[(currentModeIndex + 1) % modes.length]
    setRepeatMode(nextMode)
    
    const modeText = nextMode === 'off' ? 'Repeat off' : nextMode === 'all' ? 'Repeat all' : 'Repeat one'
    toast.info(modeText)
  }

  const toggleShuffle = () => {
    setShuffleMode(!shuffleMode)
    toast.info(shuffleMode ? 'Shuffle off' : 'Shuffle on')
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden bg-card border-border">
        <div className="flex flex-col lg:flex-row h-[90vh] max-h-[800px]">
          <div ref={containerRef} className={`flex-1 flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''}`}>
            <DialogHeader className={`p-6 pb-3 ${isFullscreen ? 'bg-black/80' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2 flex-wrap">
                    {currentItem.mediaType === 'video' ? (
                      <VideoCamera size={24} className="text-accent shrink-0" />
                    ) : (
                      <MusicNote size={24} className="text-accent shrink-0" />
                    )}
                    <span className="truncate">{currentItem.title || 'Media Preview'}</span>
                    {hasQueue && (
                      <Badge variant="outline" className="text-xs border-accent/30 text-accent font-mono">
                        {localCurrentIndex + 1}/{localQueue.length}
                      </Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground break-all mt-2">
                    {currentItem.url}
                  </DialogDescription>
                </div>
                <div className="flex gap-2 shrink-0">
                  {hasQueue && !isFullscreen && (
                    <Button
                      onClick={() => setShowQueue(!showQueue)}
                      variant="ghost"
                      size="sm"
                      className={`h-8 w-8 p-0 hover:bg-accent/20 ${showQueue ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <Queue size={20} />
                    </Button>
                  )}
                  <Button
                    onClick={onClose}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-accent/20 text-muted-foreground hover:text-foreground"
                  >
                    <X size={20} />
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className={`relative ${isFullscreen ? 'flex-1 flex items-center justify-center' : 'aspect-video'} bg-black flex-shrink-0`}>
              {currentItem.mediaType === 'video' ? (
                <video
                  ref={videoRef}
                  src={currentItem.url}
                  className="w-full h-full"
                  crossOrigin="anonymous"
                  preload="metadata"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary via-primary to-secondary">
                  <audio ref={audioRef} src={currentItem.url} crossOrigin="anonymous" preload="metadata" />
                  <div className="text-center">
                    <MusicNote size={120} className="text-accent/30 mx-auto mb-4" weight="thin" />
                    {currentItem.title && <div className="text-2xl font-bold text-foreground mb-2">{currentItem.title}</div>}
                    <div className="text-sm text-muted-foreground">Audio Stream</div>
                  </div>
                </div>
              )}

              {isLoading && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-3"></div>
                    <div className="text-sm text-foreground">Loading media...</div>
                  </div>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-center max-w-md px-6">
                    <Warning size={64} className="text-destructive mx-auto mb-4" weight="fill" />
                    <div className="text-lg font-semibold text-foreground mb-2">Playback Error</div>
                    <div className="text-sm text-muted-foreground">{error}</div>
                  </div>
                </div>
              )}
            </div>

            <div className={`p-4 space-y-3 ${isFullscreen ? 'bg-black/80' : 'bg-card'}`}>
              <div className="space-y-2">
                <Slider
                  value={[currentTime]}
                  onValueChange={handleSeek}
                  max={duration || 100}
                  step={0.1}
                  className="w-full"
                  disabled={!duration || error !== null}
                />
                <div className="flex justify-between text-xs text-muted-foreground font-mono">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    {hasQueue && (
                      <Button
                        onClick={playPrevious}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-accent/20 text-foreground"
                        disabled={!hasQueue}
                      >
                        <SkipBack size={20} weight="fill" />
                      </Button>
                    )}
                    
                    <Button
                      onClick={togglePlay}
                      variant="default"
                      size="sm"
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                      disabled={error !== null}
                    >
                      {isPlaying ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
                    </Button>

                    {hasQueue && (
                      <Button
                        onClick={playNext}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-accent/20 text-foreground"
                        disabled={!hasQueue}
                      >
                        <SkipForward size={20} weight="fill" />
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={toggleMute}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-accent/20 text-foreground"
                    >
                      {isMuted ? <SpeakerSlash size={20} /> : <SpeakerHigh size={20} />}
                    </Button>
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      onValueChange={handleVolumeChange}
                      max={1}
                      step={0.01}
                      className="w-24"
                    />
                  </div>

                  <Badge variant="outline" className="text-xs border-accent/30 text-accent font-mono">
                    {currentItem.mediaType.toUpperCase()}
                  </Badge>
                </div>

                <div className="flex items-center gap-1">
                  {hasQueue && (
                    <>
                      <Button
                        onClick={toggleShuffle}
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 hover:bg-accent/20 ${shuffleMode ? 'text-accent' : 'text-foreground'}`}
                        title={shuffleMode ? 'Shuffle on' : 'Shuffle off'}
                      >
                        <Shuffle size={20} weight={shuffleMode ? 'fill' : 'regular'} />
                      </Button>

                      <Button
                        onClick={toggleRepeat}
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 hover:bg-accent/20 ${repeatMode !== 'off' ? 'text-accent' : 'text-foreground'}`}
                        title={repeatMode === 'off' ? 'Repeat off' : repeatMode === 'all' ? 'Repeat all' : 'Repeat one'}
                      >
                        {repeatMode === 'one' ? (
                          <RepeatOnce size={20} weight="fill" />
                        ) : (
                          <Repeat size={20} weight={repeatMode === 'all' ? 'fill' : 'regular'} />
                        )}
                      </Button>
                    </>
                  )}

                  {currentItem.mediaType === 'video' && (
                    <Button
                      onClick={toggleFullscreen}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-accent/20 text-foreground"
                    >
                      {isFullscreen ? <ArrowsIn size={20} /> : <ArrowsOut size={20} />}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {hasQueue && showQueue && !isFullscreen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-border bg-card/50 flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Queue size={18} className="text-accent" />
                  Queue ({localQueue.length})
                </h3>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  <AnimatePresence>
                    {localQueue.map((item, index) => (
                      <motion.div
                        key={`${item.url}-${index}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className={`group relative p-3 rounded hover:bg-accent/10 transition-colors cursor-pointer ${
                          index === localCurrentIndex ? 'bg-accent/20 border border-accent/30' : 'border border-transparent'
                        }`}
                        onClick={() => playItem(index)}
                      >
                        <div className="flex items-start gap-2">
                          <div className="shrink-0 mt-0.5">
                            {item.mediaType === 'video' ? (
                              <VideoCamera size={16} className={index === localCurrentIndex ? 'text-accent' : 'text-muted-foreground'} />
                            ) : (
                              <MusicNote size={16} className={index === localCurrentIndex ? 'text-accent' : 'text-muted-foreground'} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${index === localCurrentIndex ? 'text-accent' : 'text-foreground'}`}>
                              {item.title || `Media ${index + 1}`}
                            </div>
                            <div className="text-xs text-muted-foreground truncate mt-1">
                              {item.url}
                            </div>
                          </div>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFromQueue(index)
                            }}
                            variant="ghost"
                            size="sm"
                            className="shrink-0 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-destructive transition-opacity"
                          >
                            <Trash size={14} />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
