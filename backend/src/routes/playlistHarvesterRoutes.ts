/**
 * Playlist Harvester Routes
 *
 * POST /api/harvest/scan     — start a harvest (presetIds[], customUrls[])
 * GET  /api/harvest/status   — get current/last harvest status
 * POST /api/harvest/stop     — abort a running harvest
 * GET  /api/harvest/presets  — list available preset sources
 */

import { Router, Request, Response } from 'express'
import { playlistHarvester, HARVEST_PRESETS } from '../services/PlaylistHarvesterService.js'

const router = Router()

// ── List presets ──────────────────────────────────────────────────────────────

router.get('/presets', (_req: Request, res: Response) => {
  res.json({ presets: HARVEST_PRESETS })
})

// ── Status ────────────────────────────────────────────────────────────────────

router.get('/status', (_req: Request, res: Response) => {
  res.json(playlistHarvester.getStatus())
})

// ── Start harvest ─────────────────────────────────────────────────────────────

router.post('/scan', async (req: Request, res: Response) => {
  const { presetIds = [], customUrls = [] } = req.body as {
    presetIds?: string[]
    customUrls?: string[]
  }

  if (presetIds.length === 0 && customUrls.filter(Boolean).length === 0) {
    return res.status(400).json({ error: 'Provide at least one presetId or customUrl' })
  }

  const status = playlistHarvester.getStatus()
  if (status.running) {
    return res.status(409).json({ error: 'Harvest already running', status })
  }

  // Fire-and-forget — client polls /status or uses SSE
  res.json({ ok: true, message: 'Harvest started', totalSources: presetIds.length + customUrls.filter(Boolean).length })

  playlistHarvester.harvest(presetIds, customUrls).catch(err => {
    console.error('[PlaylistHarvester] harvest error:', err?.message)
  })
})

// ── Stop harvest ──────────────────────────────────────────────────────────────

router.post('/stop', (_req: Request, res: Response) => {
  playlistHarvester.stop()
  res.json({ ok: true, message: 'Harvest stopped' })
})

// ── SSE live progress stream ──────────────────────────────────────────────────

router.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  const send = (event: string, data: any) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  // Send current status immediately
  send('status', playlistHarvester.getStatus())

  const onStarted       = (d: any) => send('started',       d)
  const onProgress      = (d: any) => send('progress',      d)
  const onSourceComplete= (d: any) => send('sourceComplete',d)
  const onBatchComplete = (d: any) => send('batchComplete', d)
  const onCompleted     = (d: any) => send('completed',     d)
  const onStopped       = (d: any) => send('stopped',       d)

  playlistHarvester.on('started',        onStarted)
  playlistHarvester.on('progress',       onProgress)
  playlistHarvester.on('sourceComplete', onSourceComplete)
  playlistHarvester.on('batchComplete',  onBatchComplete)
  playlistHarvester.on('completed',      onCompleted)
  playlistHarvester.on('stopped',        onStopped)

  req.on('close', () => {
    playlistHarvester.off('started',        onStarted)
    playlistHarvester.off('progress',       onProgress)
    playlistHarvester.off('sourceComplete', onSourceComplete)
    playlistHarvester.off('batchComplete',  onBatchComplete)
    playlistHarvester.off('completed',      onCompleted)
    playlistHarvester.off('stopped',        onStopped)
  })
})

// ── Parse a single URL (preview without archiving) ────────────────────────────

router.post('/parse', async (req: Request, res: Response) => {
  const { url } = req.body as { url?: string }
  if (!url) return res.status(400).json({ error: 'url is required' })

  try {
    const entries = await playlistHarvester.fetchAndParsePlaylist(url)
    res.json({
      url,
      entriesFound: entries.length,
      preview: entries.slice(0, 20),
    })
  } catch (err: any) {
    res.status(422).json({ error: err.message ?? 'Could not parse playlist' })
  }
})

export default router
