/**
 * FloatingPlayer — A self-contained video player with 3 modes:
 *   fullscreen → overlays entire viewport (click X to go mini)
 *   mini       → small draggable PiP window (□ = fullscreen, - = pause+hide, × = close)
 *   closed     → unmounted
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import Hls from 'hls.js'
import { motion, useDragControls } from 'framer-motion'
import {
  X, Minus, CornersOut, Play, Pause,
  SpeakerHigh, SpeakerSlash, ArrowsOut, Spinner,
} from '@phosphor-icons/react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlayerMode = 'fullscreen' | 'mini' | 'closed'

export interface FloatingPlayerProps {
  url:     string
  title:   string
  mode:    PlayerMode
  onMode: (m: PlayerMode) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BACKEND = (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3002')

function isHLS(url: string)    { return /\.m3u8($|\?)/i.test(url) || /x-mpegurl/i.test(url) }
function isDASH(url: string)   { return /\.mpd($|\?)/i.test(url) }
// Direct protocols that browsers can handle without CORS proxy
function isNativeStream(url: string) {
  return /^(rtsp|rtmp|rtmpe|rtmpt|rtp|udp):\/\//i.test(url)
}
// Route external HTTP(S) video URLs through the backend stream proxy to avoid CORS
function resolvePlayUrl(url: string): string {
  if (!url) return url
  if (isNativeStream(url)) return url
  if (isHLS(url) || isDASH(url)) return url   // hls.js handles these directly
  if (/^https?:\/\//i.test(url)) {
    return `${BACKEND}/api/media/stream?url=${encodeURIComponent(url)}`
  }
  return url
}

function formatTime(s: number) {
  if (!isFinite(s) || s < 0) return '--:--'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FloatingPlayer({ url, title, mode, onMode }: FloatingPlayerProps) {
  const videoRef      = useRef<HTMLVideoElement>(null)
  const hlsRef        = useRef<Hls | null>(null)
  const dragControls  = useDragControls()

  const [playing,     setPlaying]    = useState(false)
  const [muted,       setMuted]      = useState(false)
  const [volume,      setVolume]     = useState(0.85)
  const [current,     setCurrent]    = useState(0)
  const [duration,    setDuration]   = useState(0)
  const [loading,     setLoading]    = useState(true)
  const [error,       setError]      = useState<string | null>(null)
  const [showCtrl,    setShowCtrl]   = useState(true)
  const hideTimer     = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ── HLS / DASH setup ──────────────────────────────────────────────────────

  useEffect(() => {
    if (mode === 'closed') return
    const video = videoRef.current
    if (!video) return

    setLoading(true)
    setError(null)
    setPlaying(false)
    setCurrent(0)
    setDuration(0)

    // Destroy previous HLS instance
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }

    const playUrl = resolvePlayUrl(url)

    if (isHLS(url) && Hls.isSupported()) {
      const hls = new Hls({ startLevel: -1, debug: false })
      hls.loadSource(playUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().then(() => setPlaying(true)).catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setError('Stream error — the source may be offline.')
      })
      hlsRef.current = hls
    } else if (isHLS(url) && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = playUrl
      video.load()
      video.play().then(() => setPlaying(true)).catch(() => {})
    } else {
      video.src = playUrl
      video.load()
      video.play().then(() => setPlaying(true)).catch(() => {})
    }

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, mode === 'closed'])

  // ── Pause/resume on mode change ───────────────────────────────────────────

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (mode === 'mini') { /* keep playing in mini */ }
  }, [mode])

  // ── Video event listeners ─────────────────────────────────────────────────

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onPlay   = () => setPlaying(true)
    const onPause  = () => setPlaying(false)
    const onTime   = () => setCurrent(video.currentTime)
    const onMeta   = () => { setDuration(video.duration); setLoading(false) }
    const onWait   = () => setLoading(true)
    const onResume = () => setLoading(false)
    const onErr    = () => { setError('Playback error.'); setLoading(false) }

    video.addEventListener('play',        onPlay)
    video.addEventListener('pause',       onPause)
    video.addEventListener('timeupdate',  onTime)
    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('canplay',     onResume)
    video.addEventListener('waiting',     onWait)
    video.addEventListener('error',       onErr)

    return () => {
      video.removeEventListener('play',        onPlay)
      video.removeEventListener('pause',       onPause)
      video.removeEventListener('timeupdate',  onTime)
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('canplay',     onResume)
      video.removeEventListener('waiting',     onWait)
      video.removeEventListener('error',       onErr)
    }
  }, [])

  // ── Auto-hide controls ────────────────────────────────────────────────────

  const resetHideTimer = useCallback(() => {
    setShowCtrl(true)
    clearTimeout(hideTimer.current)
    if (mode === 'fullscreen') {
      hideTimer.current = setTimeout(() => setShowCtrl(false), 3000)
    }
  }, [mode])

  useEffect(() => {
    resetHideTimer()
    return () => clearTimeout(hideTimer.current)
  }, [mode, resetHideTimer])

  // ── Playback helpers ──────────────────────────────────────────────────────

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    playing ? v.pause() : v.play().catch(() => {})
  }

  const seek = (pct: number) => {
    const v = videoRef.current
    if (!v || !isFinite(duration) || duration === 0) return
    v.currentTime = pct * duration
  }

  const setVol = (v: number) => {
    setVolume(v)
    if (videoRef.current) videoRef.current.volume = v
    if (v > 0) setMuted(false)
  }

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    v.muted = !muted
    setMuted(!muted)
  }

  const handleMinimize = () => {
    videoRef.current?.pause()
    onMode('mini')
  }

  if (mode === 'closed') return null

  // ── Mini PiP ──────────────────────────────────────────────────────────────

  if (mode === 'mini') {
    return (
      <motion.div
        drag
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0}
        initial={{ x: 0, y: 0, opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="fixed bottom-6 right-6 z-[9999] w-72 rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black select-none"
        style={{ cursor: 'grab' }}
      >
        {/* Drag handle / title bar */}
        <div
          className="flex items-center justify-between px-2.5 py-1.5 bg-gray-900/95 backdrop-blur cursor-grab active:cursor-grabbing"
          onPointerDown={e => dragControls.start(e)}
        >
          <span className="text-[11px] text-gray-300 font-medium truncate max-w-[140px]">{title}</span>
          <div className="flex items-center gap-1 shrink-0">
            {/* Pause/play */}
            <button onClick={togglePlay} className="p-1 text-gray-400 hover:text-white transition-colors" title={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause size={12} weight="fill" /> : <Play size={12} weight="fill" />}
            </button>
            {/* Expand to fullscreen */}
            <button onClick={() => onMode('fullscreen')} className="p-1 text-gray-400 hover:text-white transition-colors" title="Fullscreen">
              <CornersOut size={12} weight="bold" />
            </button>
            {/* Minimize (pause) */}
            <button onClick={handleMinimize} className="p-1 text-gray-400 hover:text-yellow-400 transition-colors" title="Minimize & Pause">
              <Minus size={12} weight="bold" />
            </button>
            {/* Close */}
            <button onClick={() => onMode('closed')} className="p-1 text-gray-400 hover:text-red-400 transition-colors" title="Close">
              <X size={12} weight="bold" />
            </button>
          </div>
        </div>

        {/* Video */}
        <div className="relative aspect-video bg-black">
          <video ref={videoRef} className="w-full h-full object-contain" playsInline />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Spinner size={24} className="animate-spin text-purple-400" />
            </div>
          )}
          {/* Click to toggle fullscreen */}
          <div className="absolute inset-0 cursor-pointer" onClick={() => onMode('fullscreen')} />
        </div>
      </motion.div>
    )
  }

  // ── Fullscreen overlay ────────────────────────────────────────────────────

  const progress = duration > 0 ? current / duration : 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9990] bg-black flex flex-col"
      onMouseMove={resetHideTimer}
      onClick={resetHideTimer}
    >
      {/* ── Top bar ── */}
      <div className={`absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showCtrl ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <span className="text-white font-semibold text-sm truncate max-w-[70vw] drop-shadow">{title}</span>
        <div className="flex items-center gap-2">
          {/* Shrink to mini */}
          <button
            onClick={() => onMode('mini')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
            title="Mini player"
          >
            <ArrowsOut size={14} />
            Mini
          </button>
          {/* Close */}
          <button
            onClick={() => onMode('closed')}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/80 text-white flex items-center justify-center transition-colors"
            title="Close"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      </div>

      {/* ── Video ── */}
      <div className="flex-1 relative flex items-center justify-center" onClick={togglePlay}>
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
        />

        {/* Loading spinner */}
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Spinner size={48} className="animate-spin text-white/60" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 pointer-events-none">
            <span className="text-red-400 text-sm font-medium">{error}</span>
            <span className="text-gray-500 text-xs max-w-xs text-center">{url}</span>
          </div>
        )}

        {/* Big play/pause flash */}
        <motion.div
          key={playing ? 'play' : 'pause'}
          initial={{ opacity: 0.8, scale: 0.8 }}
          animate={{ opacity: 0, scale: 1.3 }}
          transition={{ duration: 0.5 }}
          className="absolute pointer-events-none"
        >
          {playing
            ? <Play  size={72} weight="fill" className="text-white drop-shadow-2xl" />
            : <Pause size={72} weight="fill" className="text-white drop-shadow-2xl" />
          }
        </motion.div>
      </div>

      {/* ── Bottom controls ── */}
      <div className={`absolute bottom-0 left-0 right-0 z-10 px-5 pb-5 pt-10 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300 ${showCtrl ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>

        {/* Seek bar */}
        <div
          className="relative w-full h-1 rounded-full bg-white/20 cursor-pointer mb-3 group/seek"
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            seek((e.clientX - rect.left) / rect.width)
          }}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-purple-500 group-hover/seek:bg-purple-400 transition-colors"
            style={{ width: `${progress * 100}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover/seek:opacity-100 transition-opacity"
            style={{ left: `calc(${progress * 100}% - 6px)` }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3">
          {/* Play/pause */}
          <button onClick={togglePlay} className="text-white hover:text-purple-300 transition-colors">
            {playing
              ? <Pause size={22} weight="fill" />
              : <Play  size={22} weight="fill" />
            }
          </button>

          {/* Time */}
          <span className="text-white/70 text-xs tabular-nums min-w-[90px]">
            {formatTime(current)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Volume */}
          <div className="flex items-center gap-2 group/vol">
            <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors">
              {muted || volume === 0
                ? <SpeakerSlash size={18} weight="fill" />
                : <SpeakerHigh  size={18} weight="fill" />
              }
            </button>
            <div
              className="relative w-20 h-1 rounded-full bg-white/20 cursor-pointer"
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect()
                setVol(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)))
              }}
            >
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-white/70"
                style={{ width: `${(muted ? 0 : volume) * 100}%` }}
              />
            </div>
          </div>

          {/* Mini button */}
          <button
            onClick={() => onMode('mini')}
            className="text-white/70 hover:text-white transition-colors ml-1"
            title="Shrink to mini player"
          >
            <ArrowsOut size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
