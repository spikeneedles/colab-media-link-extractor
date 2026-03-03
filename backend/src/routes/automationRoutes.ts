/**
 * Automation Routes — REST + SSE for AutomationEngine control
 *
 * POST /api/automation/start       — start continuous loop
 * POST /api/automation/stop        — stop continuous loop
 * POST /api/automation/run-once    — trigger a single cycle now
 * GET  /api/automation/status      — current status + stats
 * PATCH /api/automation/config     — update engine config
 * GET  /api/automation/stream      — SSE live event stream
 */

import { Router, Request, Response } from 'express'
import { getAutomationEngine } from '../services/AutomationEngine.js'

const router = Router()

// ── Start ─────────────────────────────────────────────────────────────────────

router.post('/start', (_req: Request, res: Response) => {
  const engine = getAutomationEngine()
  if (engine.getStatus().running) {
    return res.json({ ok: true, message: 'Already running', status: engine.getStatus() })
  }
  engine.start()
  res.json({ ok: true, message: 'Automation started', status: engine.getStatus() })
})

// ── Stop ──────────────────────────────────────────────────────────────────────

router.post('/stop', (_req: Request, res: Response) => {
  const engine = getAutomationEngine()
  engine.stop()
  res.json({ ok: true, message: 'Automation stopped', status: engine.getStatus() })
})

// ── Run once ──────────────────────────────────────────────────────────────────

router.post('/run-once', async (_req: Request, res: Response) => {
  const engine = getAutomationEngine()
  if (engine.getStatus().cycleInProgress) {
    return res.status(409).json({ ok: false, error: 'A cycle is already in progress — wait for it to complete' })
  }
  try {
    const cycle = await engine.runOnce()
    res.json({ ok: true, cycle })
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── Status ────────────────────────────────────────────────────────────────────

router.get('/status', (_req: Request, res: Response) => {
  const engine = getAutomationEngine()
  res.json(engine.getStatus())
})

// ── Config patch ──────────────────────────────────────────────────────────────

router.patch('/config', (req: Request, res: Response) => {
  const engine = getAutomationEngine()
  const allowed = [
    'cycleIntervalMs','prowlarrWorkers','webPresetWorkers','fileSortWorkers',
    'enableProwlarr','enableWebScraper','enableFileSorter',
    'enabledPresetIds','categories','searchQuery',
  ]
  const update: Record<string, any> = {}
  for (const key of allowed) {
    if (key in req.body) update[key] = req.body[key]
  }
  engine.updateConfig(update as any)
  res.json({ ok: true, config: engine.getStatus().config })
})

// ── SSE live stream ───────────────────────────────────────────────────────────
// Clients connect here to receive real-time progress events.

router.get('/stream', (req: Request, res: Response) => {
  const engine = getAutomationEngine()

  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.flushHeaders()

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  // Initial snapshot
  send('status', engine.getStatus())

  const handlers: Array<[string, (...args: any[]) => void]> = [
    ['started',         ()  => send('started',         engine.getStatus())],
    ['stopped',         ()  => send('stopped',         engine.getStatus())],
    ['phaseStart',      (d) => send('phaseStart',      d)],
    ['phaseComplete',   (d) => send('phaseComplete',   d)],
    ['cycleComplete',   (d) => send('cycleComplete',   d)],
    ['webBatchComplete',(d) => send('webBatchComplete', d)],
    ['configUpdated',   (d) => send('configUpdated',   d)],
  ]

  for (const [event, handler] of handlers) engine.on(event, handler)

  // Keep-alive ping every 20 s
  const ping = setInterval(() => res.write(': ping\n\n'), 20_000)

  req.on('close', () => {
    clearInterval(ping)
    for (const [event, handler] of handlers) engine.off(event, handler)
  })
})

export default router
