import React, { useState, useCallback, useEffect } from 'react'
import { Play, Pause, Volume2, Maximize, Link2, Copy, Check } from 'lucide-react'

interface MockPlayerProps {
  url?: string
  title?: string
  onMediaCapture?: (mediaData: { url: string; title?: string; timestamp: Date }) => void
  isExtensionConnected?: boolean
}

export function MockMediaPlayer({
  url,
  title = 'Mock Media Player',
  onMediaCapture,
  isExtensionConnected = false,
}: MockPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(70)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isCopied, setIsCopied] = useState(false)

  // Simulate video duration
  useEffect(() => {
    if (isPlaying && duration < 100) {
      const timer = setInterval(() => {
        setCurrentTime((t) => (t < duration ? t + 1 : duration))
      }, 500)
      return () => clearInterval(timer)
    }
  }, [isPlaying, duration])

  const handlePlayPause = () => {
    if (!isPlaying && !duration) {
      // Simulate media load
      setDuration(60)
      onMediaCapture?.({
        url: url || 'mock://video.mp4',
        title,
        timestamp: new Date(),
      })
    }
    setIsPlaying(!isPlaying)
  }

  const handleCopyUrl = () => {
    const mediaUrl = url || 'mock://video.mp4'
    navigator.clipboard.writeText(mediaUrl)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="bg-black rounded-lg overflow-hidden shadow-xl w-full max-w-2xl">
      {/* Video Container */}
      <div className="bg-linear-to-br from-neutral-900 to-black aspect-video flex items-center justify-center relative overflow-hidden">
        {/* Connection Indicator */}
        {isExtensionConnected && (
          <div className="absolute top-3 right-3 flex items-center gap-2 bg-green-900/80 px-3 py-1 rounded-full text-green-300 text-xs z-10">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Extension Connected
          </div>
        )}

        {/* Mock Video Content */}
        <div className="text-center">
          {isPlaying ? (
            <div className="space-y-4">
              <div className="animate-pulse">
                <div className="w-24 h-24 bg-linear-to-r from-indigo-500 to-purple-500 rounded-lg mx-auto mb-4" />
              </div>
              <p className="text-white text-sm">Playing: {title}</p>
              <p className="text-neutral-400 text-xs">
                {currentTime}s / {duration}s
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-24 h-24 bg-neutral-800 rounded-lg mx-auto flex items-center justify-center">
                <Play className="w-12 h-12 text-neutral-600" />
              </div>
              <p className="text-neutral-400 text-sm">Ready to Play</p>
            </div>
          )}
        </div>

        {/* Play Button Overlay */}
        <button
          onClick={handlePlayPause}
          className="absolute inset-0 flex items-center justify-center group"
        >
          <div className="w-16 h-16 bg-indigo-600/80 hover:bg-indigo-500 rounded-full flex items-center justify-center transition group-hover:scale-110">
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white ml-1" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" />
            )}
          </div>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="bg-neutral-900 px-4 py-2">
        <div className="w-full bg-neutral-800 h-1 rounded-full overflow-hidden cursor-pointer group">
          <div
            className="bg-linear-to-r from-indigo-500 to-purple-500 h-full transition-all group-hover:h-2"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="bg-neutral-900 p-4 space-y-4">
        {/* Time Display */}
        <div className="flex justify-between text-xs text-neutral-400">
          <span>{currentTime}s</span>
          <span>{duration}s</span>
        </div>

        {/* URL Display & Copy */}
        <div className="bg-neutral-800 rounded p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Link2 className="w-4 h-4 text-neutral-500 shrink-0" />
            <code className="text-xs text-neutral-300 truncate">
              {url || 'mock://video.mp4'}
            </code>
          </div>
          <button
            onClick={handleCopyUrl}
            className="flex items-center gap-1 px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 rounded text-xs transition shrink-0"
          >
            {isCopied ? (
              <>
                <Check className="w-3 h-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy
              </>
            )}
          </button>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Play Button */}
            <button
              onClick={handlePlayPause}
              className="text-neutral-300 hover:text-white transition"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6" />
              )}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-neutral-400" />
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-24 h-1 bg-neutral-700 rounded-full appearance-none cursor-pointer"
              />
              <span className="text-xs text-neutral-400 w-8">{volume}%</span>
            </div>
          </div>

          {/* Fullscreen Button */}
          <button
            className="text-neutral-300 hover:text-white transition"
            title="Fullscreen"
          >
            <Maximize className="w-6 h-6" />
          </button>
        </div>

        {/* Media Info */}
        <div className="bg-neutral-800 rounded p-3 text-sm text-neutral-300">
          <p className="font-semibold mb-1">Media Info</p>
          <p className="text-xs text-neutral-400">Title: {title}</p>
          <p className="text-xs text-neutral-400 mt-1">
            Status: {isPlaying ? '▶️ Playing' : '⏸️ Paused'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default MockMediaPlayer
