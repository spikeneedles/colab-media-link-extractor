import { useState, useEffect, useCallback, useRef } from 'react'

export interface CapturedUrl {
  id: string
  url: string
  source: 'mitm-url' | 'mitm-content-type' | 'mitm-body' | 'mitm-xtream' | 'logcat' | 'manual'
  timestamp: string
  metadata?: {
    host?: string
    path?: string
    statusCode?: number | null
    contentType?: string | null
    foundIn?: string
  }
}

export interface CaptureSession {
  serial: string
  apk: string
  proxy: string
  startedAt: string
  active: boolean
}

interface UseRuntimeCaptureOptions {
  backendUrl?: string
  /** Auto-connect on mount */
  autoConnect?: boolean
  /** Max URLs to keep in state */
  maxUrls?: number
  /** Called when a new URL is captured */
  onCapture?: (url: CapturedUrl) => void
}

interface UseRuntimeCaptureReturn {
  urls: CapturedUrl[]
  session: CaptureSession | null
  connected: boolean
  error: string | null
  connect: () => void
  disconnect: () => void
  clearUrls: () => Promise<void>
  startSession: (serial: string, apk: string, proxy?: string) => Promise<void>
  stopSession: () => Promise<void>
}

export function useRuntimeCapture({
  backendUrl = 'http://localhost:3001',
  autoConnect = false,
  maxUrls = 500,
  onCapture,
}: UseRuntimeCaptureOptions = {}): UseRuntimeCaptureReturn {
  const [urls, setUrls] = useState<CapturedUrl[]>([])
  const [session, setSession] = useState<CaptureSession | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const esRef = useRef<EventSource | null>(null)
  const onCaptureRef = useRef(onCapture)
  onCaptureRef.current = onCapture

  const connect = useCallback(() => {
    if (esRef.current) return // Already connected

    const url = `${backendUrl}/api/runtime-capture/stream`
    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => {
      setConnected(true)
      setError(null)
    }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case 'buffer':
            // Initial buffer on connect
            setUrls(data.urls ?? [])
            if (data.session) setSession(data.session)
            break

          case 'url': {
            const captured: CapturedUrl = {
              id:        data.id,
              url:       data.url,
              source:    data.source,
              timestamp: data.timestamp,
              metadata:  data.metadata,
            }
            setUrls(prev => {
              const next = [...prev, captured]
              return next.length > maxUrls ? next.slice(-maxUrls) : next
            })
            onCaptureRef.current?.(captured)
            break
          }

          case 'session':
            setSession(data.session)
            break

          case 'clear':
            setUrls([])
            break
        }
      } catch {
        // Ignore malformed frames
      }
    }

    es.onerror = () => {
      setConnected(false)
      setError('Lost connection to backend. Is it running?')
      es.close()
      esRef.current = null
    }
  }, [backendUrl, maxUrls])

  const disconnect = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
    setConnected(false)
  }, [])

  const clearUrls = useCallback(async () => {
    await fetch(`${backendUrl}/api/runtime-capture/urls`, { method: 'DELETE' })
    setUrls([]) // Optimistic — SSE 'clear' event will confirm
  }, [backendUrl])

  const startSession = useCallback(async (
    serial: string,
    apk: string,
    proxy = '10.0.2.2:8080',
  ) => {
    const res = await fetch(`${backendUrl}/api/runtime-capture/session/start`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ serial, apk, proxy }),
    })
    const data = await res.json()
    if (data.session) setSession(data.session)
  }, [backendUrl])

  const stopSession = useCallback(async () => {
    await fetch(`${backendUrl}/api/runtime-capture/session/stop`, { method: 'POST' })
    setSession(null)
  }, [backendUrl])

  // Auto-connect
  useEffect(() => {
    if (autoConnect) connect()
    return () => { esRef.current?.close() }
  }, [autoConnect, connect])

  return { urls, session, connected, error, connect, disconnect, clearUrls, startSession, stopSession }
}
