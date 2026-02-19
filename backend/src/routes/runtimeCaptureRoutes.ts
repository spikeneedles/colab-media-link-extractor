import { Router, Request, Response } from 'express'
import { EventEmitter } from 'events'

const router = Router()

// Global emitter — all SSE clients subscribe to this
const captureEmitter = new EventEmitter()
captureEmitter.setMaxListeners(100)

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface CapturedUrl {
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

interface CaptureSession {
  serial: string
  apk: string
  proxy: string
  startedAt: string
  active: boolean
}

// ─────────────────────────────────────────────
// In-memory store (ring buffer — last 500 URLs)
// ─────────────────────────────────────────────
const capturedUrls: CapturedUrl[] = []
const MAX_BUFFER = 500

let activeSession: CaptureSession | null = null

function pushUrl(item: CapturedUrl): void {
  capturedUrls.push(item)
  if (capturedUrls.length > MAX_BUFFER) {
    capturedUrls.shift()
  }
  captureEmitter.emit('url', item)
}

// ─────────────────────────────────────────────
// SSE stream — frontend subscribes here
//
// GET /api/runtime-capture/stream
// EventSource events:
//   { type: 'buffer', urls: CapturedUrl[] }   — sent once on connect
//   { type: 'url', ...CapturedUrl }            — sent per new capture
//   { type: 'session', session: CaptureSession } — session state change
//   { type: 'clear' }                          — URLs cleared
// ─────────────────────────────────────────────
router.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  const write = (data: object) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    } catch {
      // Client disconnected
    }
  }

  // Send current buffer + session state immediately on connect
  write({ type: 'buffer', urls: capturedUrls.slice(-100), session: activeSession })

  const onUrl     = (item: CapturedUrl)        => write({ type: 'url', ...item })
  const onSession = (s: CaptureSession | null) => write({ type: 'session', session: s })
  const onClear   = ()                          => write({ type: 'clear' })

  captureEmitter.on('url', onUrl)
  captureEmitter.on('session', onSession)
  captureEmitter.on('clear', onClear)

  // Heartbeat every 20s to prevent proxy/load-balancer timeout
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n') } catch { clearInterval(heartbeat) }
  }, 20_000)

  req.on('close', () => {
    captureEmitter.off('url', onUrl)
    captureEmitter.off('session', onSession)
    captureEmitter.off('clear', onClear)
    clearInterval(heartbeat)
  })
})

// ─────────────────────────────────────────────
// Ingest — mitmproxy addon POSTs here
//
// POST /api/runtime-capture/ingest
// Body: { url, source?, metadata? }
// ─────────────────────────────────────────────
router.post('/ingest', (req: Request, res: Response) => {
  const { url, source = 'mitm-url', metadata } = req.body

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' })
  }

  // Basic dedup — check last 50 entries
  const recentWindow = capturedUrls.slice(-50)
  if (recentWindow.some(u => u.url === url)) {
    return res.json({ success: true, duplicate: true })
  }

  const item: CapturedUrl = {
    id:        `rc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    url,
    source,
    timestamp: new Date().toISOString(),
    metadata,
  }

  pushUrl(item)
  res.json({ success: true, id: item.id })
})

// ─────────────────────────────────────────────
// Session lifecycle
//
// POST /api/runtime-capture/session/start
// POST /api/runtime-capture/session/stop
// GET  /api/runtime-capture/session
// ─────────────────────────────────────────────
router.post('/session/start', (req: Request, res: Response) => {
  const { serial, apk, proxy } = req.body

  activeSession = {
    serial: serial || 'unknown',
    apk:    apk    || 'unknown.apk',
    proxy:  proxy  || '10.0.2.2:8080',
    startedAt: new Date().toISOString(),
    active: true,
  }

  captureEmitter.emit('session', activeSession)
  console.log(`[RuntimeCapture] Session started — ${activeSession.apk} on ${activeSession.serial}`)
  res.json({ success: true, session: activeSession })
})

router.post('/session/stop', (req: Request, res: Response) => {
  if (activeSession) {
    activeSession.active = false
    captureEmitter.emit('session', activeSession)
    console.log(`[RuntimeCapture] Session stopped — ${activeSession.apk}`)
  }
  activeSession = null
  res.json({ success: true })
})

router.get('/session', (req: Request, res: Response) => {
  res.json({ success: true, session: activeSession })
})

// ─────────────────────────────────────────────
// Query / clear
//
// GET    /api/runtime-capture/urls?since=<ISO>
// DELETE /api/runtime-capture/urls
// ─────────────────────────────────────────────
router.get('/urls', (req: Request, res: Response) => {
  const { since, limit = '100' } = req.query as Record<string, string>

  const filtered = since
    ? capturedUrls.filter(u => u.timestamp > since)
    : capturedUrls.slice(-Number(limit))

  res.json({ success: true, urls: filtered, total: capturedUrls.length })
})

router.delete('/urls', (req: Request, res: Response) => {
  capturedUrls.length = 0
  captureEmitter.emit('clear')
  res.json({ success: true, message: 'Capture buffer cleared' })
})

export { captureEmitter }
export default router
