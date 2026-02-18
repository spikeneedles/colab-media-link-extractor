import { useState, useCallback, useEffect, useRef } from 'react'

interface ExtensionSession {
  id: string
  name: string
  connectedAt: Date
  lastHeartbeat: Date
  capturedCount: number
  isAlive: boolean
}

interface CapturedMedia {
  id: string
  url: string
  title?: string
  timestamp: Date
  metadata?: Record<string, any>
  sessionId?: string
  sessionName?: string
}

const API_BASE = '/api/extension'

export function useExtensionBridge() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [sessions, setSessions] = useState<ExtensionSession[]>([])
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia[]>([])
  const [stats, setStats] = useState({ totalCaptured: 0, sessionsActive: 0 })
  const [error, setError] = useState<string | null>(null)
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /**
   * Register this instance as an extension
   */
  const registerExtension = useCallback(async (extensionName: string = 'WebApp') => {
    try {
      setError(null)
      const id = `webapp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const response = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extensionId: id,
          name: extensionName,
        }),
      })

      if (!response.ok) throw new Error('Registration failed')

      const data = await response.json()
      setSessionId(data.sessionId)
      setIsConnected(true)

      // Start heartbeat
      startHeartbeat(data.sessionId)
      // Start polling for sessions
      pollSessions()

      return data.sessionId
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      setError(message)
      throw err
    }
  }, [])

  /**
   * Send heartbeat to keep session alive
   */
  const startHeartbeat = useCallback((sid: string) => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }

    heartbeatIntervalRef.current = setInterval(async () => {
      try {
        await fetch(`${API_BASE}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sid }),
        })
      } catch (err) {
        console.warn('Heartbeat failed:', err)
      }
    }, 10000)
  }, [])

  /**
   * Capture media from extension
   */
  const captureMedia = useCallback(
    async (url: string, title?: string, metadata?: Record<string, any>) => {
      if (!sessionId) {
        setError('Not connected to extension bridge')
        return null
      }

      try {
        const response = await fetch(`${API_BASE}/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            url,
            title,
            metadata,
          }),
        })

        if (!response.ok) throw new Error('Capture failed')

        const data = await response.json()
        // Immediate fetch of new media
        await fetchAllMedia()

        return data.mediaId
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Capture failed'
        setError(message)
        return null
      }
    },
    [sessionId]
  )

  /**
   * Fetch all sessions
   */
  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/sessions`)
      if (!response.ok) throw new Error('Failed to fetch sessions')

      const data = await response.json()
      setSessions(data.sessions || [])
      setStats({ ...stats, sessionsActive: data.totalActive || 0 })
    } catch (err) {
      console.warn('Failed to fetch sessions:', err)
    }
  }, [stats])

  /**
   * Fetch all captured media
   */
  const fetchAllMedia = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/media/all?limit=100`)
      if (!response.ok) throw new Error('Failed to fetch media')

      const data = await response.json()
      setCapturedMedia(data.media || [])
      setStats((s) => ({ ...s, totalCaptured: data.total }))
    } catch (err) {
      console.warn('Failed to fetch media:', err)
    }
  }, [])

  /**
   * Fetch media from specific session
   */
  const fetchSessionMedia = useCallback(async (sid: string) => {
    try {
      const response = await fetch(`${API_BASE}/sessions/${sid}/media?limit=50`)
      if (!response.ok) throw new Error('Failed to fetch session media')

      const data = await response.json()
      return data.media || []
    } catch (err) {
      console.warn('Failed to fetch session media:', err)
      return []
    }
  }, [])

  /**
   * Start polling for sessions and media
   */
  const pollSessions = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }

    pollIntervalRef.current = setInterval(() => {
      fetchSessions()
      fetchAllMedia()
    }, 5000)
  }, [fetchSessions, fetchAllMedia])

  /**
   * Disconnect extension bridge
   */
  const disconnect = useCallback(async () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }

    if (sessionId) {
      try {
        await fetch(`${API_BASE}/sessions/${sessionId}`, {
          method: 'DELETE',
        })
      } catch (err) {
        console.warn('Disconnect error:', err)
      }
    }

    setSessionId(null)
    setIsConnected(false)
  }, [sessionId])

  /**
   * Process captured media with crawler
   */
  const processMedia = useCallback(
    async (mediaId: string, patterns?: string[], crawlerConfig?: Record<string, any>) => {
      if (!sessionId) {
        setError('Not connected')
        return null
      }

      try {
        const response = await fetch(`${API_BASE}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            mediaId,
            patterns,
            crawlerConfig,
          }),
        })

        if (!response.ok) throw new Error('Processing failed')

        return await response.json()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Processing failed'
        setError(message)
        return null
      }
    },
    [sessionId]
  )

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [])

  return {
    // State
    sessionId,
    isConnected,
    sessions,
    capturedMedia,
    stats,
    error,
    
    // Methods
    registerExtension,
    captureMedia,
    fetchSessions,
    fetchAllMedia,
    fetchSessionMedia,
    disconnect,
    processMedia,
  }
}

export default useExtensionBridge
