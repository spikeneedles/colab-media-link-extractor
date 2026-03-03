/**
 * playlistParser.ts
 *
 * Detects and parses M3U / M3U8 / PLS / XSPF / ASX / WPL playlist formats.
 * Also classifies magnet links and .torrent file URLs.
 */

import type { QueueItem } from '@/components/MediaPlayer'

const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL ?? 'http://localhost:3002'

// ── URL type detection ────────────────────────────────────────────────────────

export type UrlType = 'magnet' | 'torrent' | 'm3u' | 'pls' | 'xspf' | 'asx' | 'wpl' | 'stream'

export function detectUrlType(url: string): UrlType {
  if (!url) return 'stream'
  const u = url.trim()
  if (/^magnet:/i.test(u)) return 'magnet'
  if (/\.torrent(\?.*)?$/i.test(u)) return 'torrent'
  if (/\.(m3u8?)(\?.*)?$/i.test(u) || /[?&]type=m3u/i.test(u) || /\/playlist\.m3u/i.test(u)) return 'm3u'
  if (/\.pls(\?.*)?$/i.test(u)) return 'pls'
  if (/\.xspf(\?.*)?$/i.test(u)) return 'xspf'
  if (/\.asx(\?.*)?$/i.test(u)) return 'asx'
  if (/\.wpl(\?.*)?$/i.test(u)) return 'wpl'
  return 'stream'
}

export function isPlaylist(url: string): boolean {
  const t = detectUrlType(url)
  return t === 'm3u' || t === 'pls' || t === 'xspf' || t === 'asx' || t === 'wpl'
}

// ── M3U / M3U8 parser ─────────────────────────────────────────────────────────

export function parseM3U(text: string): QueueItem[] {
  const lines = text.split(/\r?\n/)
  const items: QueueItem[] = []
  let currentTitle = ''
  let currentType: 'video' | 'audio' | 'unknown' = 'video'

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    if (line.startsWith('#EXTINF')) {
      // Extract title after last comma
      const commaIdx = line.lastIndexOf(',')
      currentTitle = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : ''
      // Detect audio streams
      if (/audio|radio|music/i.test(line)) currentType = 'audio'
      else currentType = 'video'
    } else if (!line.startsWith('#')) {
      items.push({ url: line, title: currentTitle || line, mediaType: currentType })
      currentTitle = ''
      currentType = 'video'
    }
  }

  return items
}

// ── PLS parser ────────────────────────────────────────────────────────────────
// Format:  [playlist]\nFile1=URL\nTitle1=Name\nLength1=-1\nNumberOfEntries=N

export function parsePLS(text: string): QueueItem[] {
  const fileMap: Record<number, string> = {}
  const titleMap: Record<number, string> = {}

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const fileMatch = line.match(/^File(\d+)=(.+)$/i)
    if (fileMatch) { fileMap[parseInt(fileMatch[1])] = fileMatch[2].trim(); continue }
    const titleMatch = line.match(/^Title(\d+)=(.+)$/i)
    if (titleMatch) titleMap[parseInt(titleMatch[1])] = titleMatch[2].trim()
  }

  return Object.entries(fileMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([idx, url]) => ({
      url,
      title: titleMap[Number(idx)] || url,
      mediaType: 'video' as const,
    }))
}

// ── XSPF parser ───────────────────────────────────────────────────────────────
// Format: XML <playlist><trackList><track><location>URL</location><title>Name</title>

export function parseXSPF(text: string): QueueItem[] {
  const items: QueueItem[] = []
  try {
    const doc = new DOMParser().parseFromString(text, 'application/xml')
    doc.querySelectorAll('track').forEach(track => {
      const location = track.querySelector('location')?.textContent?.trim()
      const title    = track.querySelector('title')?.textContent?.trim()
      const creator  = track.querySelector('creator')?.textContent?.trim()
      if (location) {
        items.push({
          url:       location,
          title:     title || (creator ? `${creator} — Unknown` : location),
          mediaType: 'video',
        })
      }
    })
  } catch {
    // Malformed XML — return empty
  }
  return items
}

// ── ASX parser ────────────────────────────────────────────────────────────────
// Format: XML <asx><entry><ref href="URL"/><title>Name</title></entry></asx>

export function parseASX(text: string): QueueItem[] {
  const items: QueueItem[] = []
  try {
    const doc = new DOMParser().parseFromString(text, 'application/xml')
    doc.querySelectorAll('entry, Entry').forEach(entry => {
      const ref   = entry.querySelector('ref, Ref')?.getAttribute('href')?.trim()
      const title = entry.querySelector('title, Title')?.textContent?.trim()
      if (ref) items.push({ url: ref, title: title || ref, mediaType: 'video' })
    })
  } catch { /* Malformed XML */ }
  return items
}

// ── WPL parser ────────────────────────────────────────────────────────────────
// Format: XML <smil><body><seq><media src="URL"/></seq></body></smil>

export function parseWPL(text: string): QueueItem[] {
  const items: QueueItem[] = []
  try {
    const doc = new DOMParser().parseFromString(text, 'application/xml')
    // WPL uses <media src="..."/> inside <seq>
    doc.querySelectorAll('media, Media').forEach(media => {
      const src = media.getAttribute('src')?.trim()
      if (src) items.push({ url: src, title: src.split(/[\\/]/).pop() || src, mediaType: 'video' })
    })
  } catch { /* Malformed XML */ }
  return items
}

// ── Fetch + expand playlist URL → QueueItem[] ────────────────────────────────

export async function fetchAndExpandPlaylist(url: string): Promise<QueueItem[] | null> {
  const type = detectUrlType(url)
  if (type !== 'm3u' && type !== 'pls' && type !== 'xspf' && type !== 'asx' && type !== 'wpl') return null

  let text: string | null = null

  // Try direct fetch first (works for CORS-open sources like GitHub raw)
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (r.ok) text = await r.text()
  } catch { /* CORS blocked — fall through to proxy */ }

  // Fall back to backend proxy
  if (!text) {
    try {
      const r = await fetch(
        `${BACKEND_URL}/api/proxy/fetch?url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(15_000) },
      )
      if (r.ok) text = await r.text()
    } catch { /* proxy also failed */ }
  }

  if (!text) return null

  if (type === 'm3u')  return parseM3U(text)
  if (type === 'pls')  return parsePLS(text)
  if (type === 'xspf') return parseXSPF(text)
  if (type === 'asx')  return parseASX(text)
  if (type === 'wpl')  return parseWPL(text)
  return null
}
