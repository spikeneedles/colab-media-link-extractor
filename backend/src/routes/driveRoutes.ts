/**
 * driveRoutes.ts — Google Drive integration endpoints
 *
 * GET  /api/drive/status           → connection status + email
 * GET  /api/drive/auth             → redirect to Google OAuth consent
 * GET  /api/drive/callback         → OAuth code exchange (redirect target)
 * POST /api/drive/disconnect       → revoke tokens
 * GET  /api/drive/files            → list all files in SILAS Playlists folder
 * POST /api/drive/upload           → upload playlist content { name, content }
 * POST /api/drive/sync             → sync all master playlists to Drive
 * GET  /api/drive/download/:id     → get file content by Drive file ID
 * DELETE /api/drive/file/:id       → delete a file from Drive
 */

import { Router, Request, Response } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { googleDrive } from '../services/GoogleDriveService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const PLAYLISTS_DIR = path.join(__dirname, '..', '..', 'playlists')

const router = Router()

// ── Status ──────────────────────────────────────────────────────────────────

router.get('/status', async (_req: Request, res: Response) => {
  if (!googleDrive.isConfigured()) {
    return res.json({
      connected:    false,
      configured:   false,
      message:      'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to enable Google Drive sync',
    })
  }
  const status = await googleDrive.getStatus()
  res.json({ ...status, configured: true })
})

// ── OAuth flow ───────────────────────────────────────────────────────────────

router.get('/auth', (_req: Request, res: Response) => {
  if (!googleDrive.isConfigured()) {
    return res.status(503).json({ error: 'Google Drive not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET' })
  }
  const url = googleDrive.getAuthUrl()
  res.redirect(url)
})

router.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string
  if (!code) return res.status(400).send('Missing OAuth code')
  try {
    await googleDrive.handleCallback(code)
    // Redirect back to the frontend with success indicator
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5001'
    res.redirect(`${frontendUrl}?drive_connected=1`)
  } catch (err: any) {
    res.status(500).send(`OAuth callback failed: ${err.message}`)
  }
})

router.post('/disconnect', async (_req: Request, res: Response) => {
  try {
    await googleDrive.disconnect()
    res.json({ ok: true, message: 'Disconnected from Google Drive' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// ── File operations ──────────────────────────────────────────────────────────

router.get('/files', async (_req: Request, res: Response) => {
  if (!googleDrive.isConnected()) return res.status(401).json({ error: 'Not connected to Google Drive' })
  try {
    const files = await googleDrive.listPlaylists()
    res.json({ files })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/upload', async (req: Request, res: Response) => {
  if (!googleDrive.isConnected()) return res.status(401).json({ error: 'Not connected to Google Drive' })
  const { name, content } = req.body as { name?: string; content?: string }
  if (!name || !content) return res.status(400).json({ error: 'name and content required' })
  try {
    const file = await googleDrive.uploadPlaylist(name, content)
    res.json({ ok: true, file })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/sync', async (_req: Request, res: Response) => {
  if (!googleDrive.isConnected()) return res.status(401).json({ error: 'Not connected to Google Drive' })
  try {
    const result = await googleDrive.syncMasterPlaylists(PLAYLISTS_DIR)
    res.json({ ok: true, ...result })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/download/:id', async (req: Request, res: Response) => {
  if (!googleDrive.isConnected()) return res.status(401).json({ error: 'Not connected to Google Drive' })
  try {
    const content = await googleDrive.downloadFile(String(req.params.id))
    res.set('Content-Type', 'text/plain')
    res.send(content)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/file/:id', async (req: Request, res: Response) => {
  if (!googleDrive.isConnected()) return res.status(401).json({ error: 'Not connected to Google Drive' })
  try {
    await googleDrive.deleteFile(String(req.params.id))
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
