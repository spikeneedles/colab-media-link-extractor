/**
 * GoogleDriveService.ts
 *
 * Handles OAuth2 authentication and file operations for Google Drive.
 * Tokens are persisted in backend/data/drive_tokens.json.
 * Playlists are stored in a "SILAS Playlists" folder on the user's Drive.
 */

import { google, drive_v3 } from 'googleapis'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const TOKEN_FILE   = path.join(__dirname, '..', '..', 'data', 'drive_tokens.json')
const FILE_ID_MAP  = path.join(__dirname, '..', '..', 'data', 'drive_file_ids.json')
const FOLDER_NAME  = 'SILAS Playlists'

// If the user specifies a target folder ID via env, use it directly (skip create/search)
const TARGET_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || ''

export interface DriveFileInfo {
  id:       string
  name:     string
  mimeType: string
  size:     string
  modifiedTime: string
  webViewLink?: string
}

export interface DriveStatus {
  connected:   boolean
  email?:      string
  folderId?:   string
  folderUrl?:  string
}

class GoogleDriveService {
  private folderId: string | null = null
  private _oauth2Client: InstanceType<typeof google.auth.OAuth2> | null = null

  // Lazy-init: env vars are read here (after dotenv.config() has run in index.ts)
  private get oauth2Client(): InstanceType<typeof google.auth.OAuth2> {
    if (!this._oauth2Client) {
      this._oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID     || '',
        process.env.GOOGLE_CLIENT_SECRET || '',
        process.env.GOOGLE_REDIRECT_URI  || 'http://localhost:3002/api/drive/callback',
      )
      this.loadTokens()
    }
    return this._oauth2Client
  }

  // ── Token persistence ───────────────────────────────────────────────────────

  constructor() {
    // Intentionally empty — oauth2Client is lazy-initialized on first use
  }

  private loadTokens() {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        const tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'))
        this.oauth2Client.setCredentials(tokens)
      }
    } catch { /* first run — no tokens yet */ }
  }

  private saveTokens(tokens: object) {
    fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true })
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf-8')
  }

  // ── Auth ────────────────────────────────────────────────────────────────────

  isConfigured(): boolean {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  }

  isConnected(): boolean {
    const creds = this.oauth2Client.credentials
    return !!(creds?.access_token || creds?.refresh_token)
  }

  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt:      'consent',
      scope: [
        'https://www.googleapis.com/auth/drive',   // full Drive access — needed to write to any folder
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    })
  }

  async handleCallback(code: string): Promise<void> {
    const { tokens } = await this.oauth2Client.getToken(code)
    this.oauth2Client.setCredentials(tokens)
    this.saveTokens(tokens)
    // Pre-create folder on first auth
    await this.ensureFolder()
  }

  async disconnect(): Promise<void> {
    try { await this.oauth2Client.revokeCredentials() } catch { /* best effort */ }
    this.oauth2Client.setCredentials({})
    this.folderId = null
    if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE)
  }

  async getStatus(): Promise<DriveStatus> {
    if (!this.isConnected()) return { connected: false }
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client })
      const { data } = await oauth2.userinfo.get()
      const folderId = await this.ensureFolder()
      return {
        connected:  true,
        email:      data.email ?? undefined,
        folderId:   folderId ?? undefined,
        folderUrl:  folderId ? `https://drive.google.com/drive/folders/${folderId}` : undefined,
      }
    } catch {
      return { connected: false }
    }
  }

  // ── Folder management ───────────────────────────────────────────────────────

  private async ensureFolder(): Promise<string | null> {
    // If a specific folder ID is configured, use it directly
    if (TARGET_FOLDER_ID) {
      this.folderId = TARGET_FOLDER_ID
      return this.folderId
    }

    if (this.folderId) return this.folderId
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client })

    // Check if folder already exists
    const list = await drive.files.list({
      q:      `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive',
    })

    if (list.data.files && list.data.files.length > 0) {
      this.folderId = list.data.files[0].id!
      return this.folderId
    }

    // Create folder
    const folder = await drive.files.create({
      requestBody: { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
      fields:      'id',
    })
    this.folderId = folder.data.id!
    return this.folderId
  }

  // ── Local file ID cache (avoids listing the target folder) ─────────────────

  private loadFileIdMap(): Record<string, string> {
    try {
      if (fs.existsSync(FILE_ID_MAP)) return JSON.parse(fs.readFileSync(FILE_ID_MAP, 'utf-8'))
    } catch { /* ignore */ }
    return {}
  }

  private saveFileIdMap(map: Record<string, string>) {
    fs.mkdirSync(path.dirname(FILE_ID_MAP), { recursive: true })
    fs.writeFileSync(FILE_ID_MAP, JSON.stringify(map, null, 2), 'utf-8')
  }

  // ── File operations ─────────────────────────────────────────────────────────

  /**
   * Upload or update a playlist file.
   * Uses a local cache of Drive file IDs to update instead of querying the folder
   * (required when TARGET_FOLDER_ID points to a folder we didn't create).
   */
  async uploadPlaylist(name: string, content: string): Promise<DriveFileInfo> {
    const drive    = google.drive({ version: 'v3', auth: this.oauth2Client })
    const folderId = await this.ensureFolder()
    const mimeType = this.mimeTypeFor(name)
    const body     = Readable.from([content])
    const idMap    = this.loadFileIdMap()

    let file: drive_v3.Schema$File

    if (idMap[name]) {
      // We already uploaded this file before — update it directly
      try {
        const { data } = await drive.files.update({
          fileId: idMap[name],
          media:  { mimeType, body },
          fields: 'id,name,mimeType,size,modifiedTime,webViewLink',
        })
        file = data
      } catch {
        // File was deleted on Drive — fall through to create
        delete idMap[name]
        const { data } = await drive.files.create({
          requestBody: { name, parents: [folderId!] },
          media:       { mimeType, body },
          fields:      'id,name,mimeType,size,modifiedTime,webViewLink',
        })
        file = data
      }
    } else {
      // First upload — create in target folder
      const { data } = await drive.files.create({
        requestBody: { name, parents: [folderId!] },
        media:       { mimeType, body },
        fields:      'id,name,mimeType,size,modifiedTime,webViewLink',
      })
      file = data
    }

    // Persist the file ID so future uploads update instead of duplicate
    idMap[name] = file.id!
    this.saveFileIdMap(idMap)

    return {
      id:           file.id!,
      name:         file.name!,
      mimeType:     file.mimeType!,
      size:         file.size ?? '0',
      modifiedTime: file.modifiedTime ?? new Date().toISOString(),
      webViewLink:  file.webViewLink ?? undefined,
    }
  }

  /** Upload a playlist from a local file path */
  async uploadPlaylistFile(filePath: string): Promise<DriveFileInfo> {
    const content = fs.readFileSync(filePath, 'utf-8')
    return this.uploadPlaylist(path.basename(filePath), content)
  }

  /** List all files in the SILAS Playlists folder */
  async listPlaylists(): Promise<DriveFileInfo[]> {
    const drive    = google.drive({ version: 'v3', auth: this.oauth2Client })
    const folderId = await this.ensureFolder()
    const { data } = await drive.files.list({
      q:      `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
      orderBy: 'modifiedTime desc',
    })
    return (data.files ?? []).map(f => ({
      id:           f.id!,
      name:         f.name!,
      mimeType:     f.mimeType!,
      size:         f.size ?? '0',
      modifiedTime: f.modifiedTime ?? '',
      webViewLink:  f.webViewLink ?? undefined,
    }))
  }

  /** Download a file's text content by Drive file ID */
  async downloadFile(fileId: string): Promise<string> {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client })
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'text' },
    )
    return res.data as string
  }

  /** Delete a file from Drive */
  async deleteFile(fileId: string): Promise<void> {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client })
    await drive.files.delete({ fileId })
  }

  // ── Sync master playlists ───────────────────────────────────────────────────

  /**
   * Sync all three master playlists (movies, livetv, series) to Drive.
   * Called automatically by ArchivistService after each commit.
   */
  async syncMasterPlaylists(playlistsDir: string): Promise<{ synced: string[]; errors: string[] }> {
    const files  = [
      'movies_master.m3u', 'livetv_master.m3u', 'series_master.m3u',
      'adult_movies_master.m3u', 'adult_livetv_master.m3u', 'adult_series_master.m3u',
    ]
    const synced: string[] = []
    const errors: string[] = []

    for (const name of files) {
      const filePath = path.join(playlistsDir, name)
      if (!fs.existsSync(filePath)) continue
      try {
        await this.uploadPlaylistFile(filePath)
        synced.push(name)
      } catch (err: any) {
        errors.push(`${name}: ${err.message}`)
      }
    }
    return { synced, errors }
  }

  // ── Site-index folder helpers ───────────────────────────────────────────────

  /**
   * Find-or-create a subfolder named "whole websites indexed" inside the
   * SILAS Playlists parent folder.  Returns the folder ID.
   */
  async getOrCreateIndexedFolder(): Promise<string | null> {
    try {
      const drive    = google.drive({ version: 'v3', auth: this.oauth2Client })
      const parentId = await this.ensureFolder()
      if (!parentId) return null

      const INDEXED_FOLDER = 'whole websites indexed'
      const list = await drive.files.list({
        q:      `name='${INDEXED_FOLDER}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive',
      })
      if (list.data.files?.length) return list.data.files[0].id!

      const { data } = await drive.files.create({
        requestBody: {
          name:     INDEXED_FOLDER,
          mimeType: 'application/vnd.google-apps.folder',
          parents:  [parentId],
        },
        fields: 'id',
      })
      return data.id!
    } catch (err) {
      console.error('[Drive] getOrCreateIndexedFolder failed:', err)
      return null
    }
  }

  /**
   * Upload a text/JSON file into a specific Drive folder by folder ID.
   */
  async uploadFileToFolder(folderId: string, filename: string, content: string, mimeType: string): Promise<void> {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client })
    const body  = Readable.from([content])
    await drive.files.create({
      requestBody: { name: filename, parents: [folderId] },
      media:       { mimeType, body },
      fields:      'id',
    })
  }

  /**
   * Find-or-create a named subfolder inside a given parent folder ID.
   */
  async getOrCreateSubfolder(parentId: string, name: string): Promise<string | null> {
    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client })
      const safeName = name.replace(/[/\\?%*:|"<>]/g, '_') // sanitize for Drive

      const list = await drive.files.list({
        q:      `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive',
      })
      if (list.data.files?.length) return list.data.files[0].id!

      const { data } = await drive.files.create({
        requestBody: {
          name:     safeName,
          mimeType: 'application/vnd.google-apps.folder',
          parents:  [parentId],
        },
        fields: 'id',
      })
      return data.id!
    } catch (err) {
      console.error('[Drive] getOrCreateSubfolder failed:', err)
      return null
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private mimeTypeFor(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase()
    const map: Record<string, string> = {
      m3u:  'audio/x-mpegurl',
      m3u8: 'application/vnd.apple.mpegurl',
      pls:  'audio/x-scpls',
      xspf: 'application/xspf+xml',
      asx:  'video/x-ms-asf',
      wpl:  'application/vnd.ms-wpl',
      json: 'application/json',
    }
    return map[ext ?? ''] || 'text/plain'
  }
}

export const googleDrive = new GoogleDriveService()
