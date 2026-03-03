#!/usr/bin/env node
/**
 * dedup-playlists.mjs
 * One-time cleanup: reads each master M3U, removes duplicate URLs and
 * duplicate normalized titles, rewrites the file, and also back-fills
 * title_norm in the SQLite DB so future pipeline dedup works correctly.
 *
 * Run from repo root:  node scripts/dedup-playlists.mjs
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLAYLISTS = path.join(__dirname, '..', 'backend', 'playlists')
const DB_PATH   = path.join(__dirname, '..', 'backend', 'data', 'media.db')

// ── Title normalizer (must match ArchivistService.ts) ─────────────────────────
function normalizeTitle(raw) {
  return raw
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\s*[\[(]\s*(?:19|20)\d{2}\s*[\])]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Parse M3U into blocks [{extinf, url}] ─────────────────────────────────────
function parseBlocks(content) {
  const lines  = content.split('\n')
  const blocks = []
  let header   = []
  let inHeader = true
  let pending  = null

  for (const line of lines) {
    const t = line.trim()
    if (inHeader && (t.startsWith('#EXTM3U') || t.startsWith('#PLAYLIST') || t === '')) {
      header.push(line)
      continue
    }
    inHeader = false
    if (t.startsWith('#EXTINF')) {
      pending = t
    } else if (pending && /^https?:\/\//i.test(t)) {
      blocks.push({ extinf: pending, url: t })
      pending = null
    }
    // Skip orphan lines (blank, other directives, non-http URLs)
  }
  return { header: header.join('\n'), blocks }
}

// ── Deduplicate blocks ────────────────────────────────────────────────────────
function dedupBlocks(blocks, isLiveTV = false) {
  const seenUrls   = new Set()
  const seenTitles = new Set()
  const kept       = []
  let removedUrl   = 0
  let removedTitle = 0

  for (const block of blocks) {
    // 1. Exact URL dedup
    if (seenUrls.has(block.url)) { removedUrl++; continue }
    seenUrls.add(block.url)

    // 2. Normalized title dedup (skip for live TV — channel variants are valid)
    if (!isLiveTV) {
      const titleMatch = block.extinf.match(/,(.+)$/)
      const rawTitle   = titleMatch ? titleMatch[1].trim() : ''
      const norm       = normalizeTitle(rawTitle)
      if (norm.length > 3 && seenTitles.has(norm)) { removedTitle++; continue }
      if (norm.length > 3) seenTitles.add(norm)
    }

    kept.push(block)
  }
  return { kept, removedUrl, removedTitle }
}

// ── Write cleaned M3U ─────────────────────────────────────────────────────────
function writeM3U(filePath, header, blocks) {
  const body = blocks.map(b => `${b.extinf}\n${b.url}`).join('\n\n')
  fs.writeFileSync(filePath, `${header}\n\n${body}\n`, 'utf-8')
}

// ── Backfill SQLite title_norm ────────────────────────────────────────────────
async function backfillDb() {
  if (!fs.existsSync(DB_PATH)) { console.log('  DB not found, skipping backfill'); return }
  try {
    const { default: Database } = await import('better-sqlite3')
    const db   = new Database(DB_PATH)
    const rows = db.prepare("SELECT id, title FROM archivist_archive WHERE title_norm = '' OR title_norm IS NULL").all()
    const upd  = db.prepare('UPDATE archivist_archive SET title_norm = ? WHERE id = ?')
    const run  = db.transaction(() => { for (const row of rows) upd.run(normalizeTitle(row.title), row.id) })
    run()
    db.close()
    console.log(`  DB backfill: updated ${rows.length} rows`)
  } catch (e) {
    console.log(`  DB backfill skipped: ${e.message}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
const FILES = {
  'movies_master.m3u':  false,
  'livetv_master.m3u':  true,   // live TV — skip title dedup
  'series_master.m3u':  false,
}

let totalRemoved = 0
for (const [name, isLiveTV] of Object.entries(FILES)) {
  const fp = path.join(PLAYLISTS, name)
  if (!fs.existsSync(fp)) { console.log(`  SKIP ${name} (not found)`); continue }

  const raw = fs.readFileSync(fp, 'utf-8')
  const { header, blocks } = parseBlocks(raw)
  const before = blocks.length
  const { kept, removedUrl, removedTitle } = dedupBlocks(blocks, isLiveTV)

  // Backup original
  fs.copyFileSync(fp, fp + '.bak')

  writeM3U(fp, header, kept)
  const removed = removedUrl + removedTitle
  totalRemoved += removed
  console.log(`✅ ${name}: ${before} → ${kept.length} entries (-${removed}: ${removedUrl} dupe URL, ${removedTitle} dupe title)`)
}

console.log(`\nTotal removed: ${totalRemoved}`)
await backfillDb()
console.log('Done. Backup files saved as *.m3u.bak')
