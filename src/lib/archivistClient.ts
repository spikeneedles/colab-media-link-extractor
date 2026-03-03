/**
 * archivistClient.ts
 * Frontend API client for The Archivist Protocol endpoints.
 * All calls target VITE_BACKEND_URL (default: http://localhost:3002)
 */

const BASE = (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3002') + '/api/archivist'
const META_BASE = (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3002') + '/api/metadata'

export type ArchiveCategory = 'movies' | 'live_tv' | 'series' | 'adult_movies' | 'adult_livetv' | 'adult_series'
export type ArchiveStatus   = 'archived' | 'flagged' | 'rejected'

export interface ArchivistEntry {
  sourceUrl:    string
  mediaUrl:     string
  title:        string
  contentType:  string
  category?:    string
  duration?:    number
  resolution?:  string
  tvgId?:       string
  tvgLogo?:     string
  groupTitle?:  string
  indexer?:     string
}

export interface ArchivistResult {
  status:      ArchiveStatus
  category?:   ArchiveCategory
  code?:       string
  entry:       ArchivistEntry
  archivedAt?: string
}

export interface ArchivistStats {
  archived:       number
  rejected:       number
  flagged:        number
  totalUnique:    number
  flaggedPending: number
  playlists: Record<ArchiveCategory, { count: number; sizeBytes: number }>
}

export interface BatchArchiveResponse {
  summary: { archived: number; flagged: number; rejected: number; total: number }
  results: ArchivistResult[]
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function getArchivistStats(): Promise<ArchivistStats> {
  const r = await fetch(`${BASE}/stats`)
  if (!r.ok) throw new Error(`Stats fetch failed: ${r.status}`)
  return r.json()
}

export async function getFlaggedItems(): Promise<ArchivistEntry[]> {
  const r = await fetch(`${BASE}/flagged`)
  if (!r.ok) throw new Error(`Flagged fetch failed: ${r.status}`)
  return r.json()
}

export async function resolveFlaggedItem(mediaUrl: string, category: ArchiveCategory): Promise<void> {
  const r = await fetch(`${BASE}/resolve-flagged`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mediaUrl, category }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error ?? `Resolve failed: ${r.status}`)
  }
}

export async function validateUrl(url: string): Promise<{
  valid: boolean
  statusCode?: number
  error?: string
  detectedContentType?: string
}> {
  const r = await fetch(`${BASE}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!r.ok) throw new Error(`Validate failed: ${r.status}`)
  return r.json()
}

export async function archiveEntry(entry: ArchivistEntry): Promise<ArchivistResult> {
  const r = await fetch(`${BASE}/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
  return r.json()
}

export async function archiveBatch(entries: ArchivistEntry[]): Promise<BatchArchiveResponse> {
  const r = await fetch(`${BASE}/archive-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  })
  if (!r.ok) throw new Error(`Batch archive failed: ${r.status}`)
  return r.json()
}

/** URL of the master M3U playlist for a category — usable directly in a <source> or as a fetch target */
export function getPlaylistUrl(category: ArchiveCategory): string {
  return `${BASE}/playlist/${category}`
}

// ── M3U → Player queue helper ─────────────────────────────────────────────────

export interface PlaylistQueueItem {
  url:      string
  title:    string
  type:     'video' | 'audio'
  category: string
}

/**
 * Fetch a master playlist from the archivist and parse it into a queue
 * suitable for the MediaPlayer component.
 */
export async function fetchPlaylistAsQueue(category: ArchiveCategory): Promise<PlaylistQueueItem[]> {
  const r = await fetch(getPlaylistUrl(category))
  if (!r.ok) throw new Error(`Playlist fetch failed: ${r.status}`)
  const text = await r.text()
  return parseM3UContent(text)
}

export function parseM3UContent(m3u: string): PlaylistQueueItem[] {
  const lines  = m3u.split('\n').map(l => l.trim()).filter(Boolean)
  const items: PlaylistQueueItem[] = []
  let pendingTitle   = ''
  let pendingGroup   = ''
  let pendingContent = ''

  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      // Parse title after last comma
      pendingTitle = line.includes(',') ? line.split(',').slice(1).join(',').trim() : 'Untitled'
      // Parse group-title
      const groupMatch = line.match(/group-title="([^"]*)"/)
      pendingGroup = groupMatch ? groupMatch[1] : ''
      // Parse content-type attribute
      const ctMatch = line.match(/content-type="([^"]*)"/)
      pendingContent = ctMatch ? ctMatch[1] : ''
    } else if (line.startsWith('#')) {
      // Other directives — skip
    } else if (line.startsWith('http') || line.startsWith('rtsp') || line.startsWith('rtmp')) {
      const isAudio = /audio|\.mp3|\.aac|\.ogg|\.flac/i.test(pendingContent + line)
      items.push({
        url:      line,
        title:    pendingTitle || new URL(line).pathname.split('/').pop() || 'Untitled',
        type:     isAudio ? 'audio' : 'video',
        category: pendingGroup,
      })
      pendingTitle = ''
      pendingGroup = ''
      pendingContent = ''
    }
  }
  return items
}

/** Human-readable file size */
export function formatBytes(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3)  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

// ── Poster lookup (TMDB via backend) ─────────────────────────────────────────

export interface PosterResult {
  posterUrl:   string | null
  backdropUrl: string | null
  tmdbTitle?:  string
  year?:       number
  overview?:   string
  rating?:     number
  genres?:     string[]
}

/** In-memory session cache so the same title is never fetched twice */
const _posterCache = new Map<string, PosterResult | null>()
const _inflight    = new Map<string, Promise<PosterResult | null>>()

export async function fetchPoster(title: string): Promise<PosterResult | null> {
  const key = title.toLowerCase().trim()
  if (_posterCache.has(key)) return _posterCache.get(key)!
  if (_inflight.has(key))    return _inflight.get(key)!

  const p = (async () => {
    try {
      const r = await fetch(`${META_BASE}/poster?title=${encodeURIComponent(title)}`)
      if (!r.ok) return null
      const data = await r.json() as PosterResult
      _posterCache.set(key, data.posterUrl ? data : null)
      return data.posterUrl ? data : null
    } catch {
      _posterCache.set(key, null)
      return null
    } finally {
      _inflight.delete(key)
    }
  })()

  _inflight.set(key, p)
  return p
}
