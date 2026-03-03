/**
 * One-time migration script:
 * 1. Remove all Real Debrid / debrid entries from the archive DB
 * 2. Move adult entries from main categories (movies/live_tv/series) to adult sub-categories
 * 3. Rebuild all 6 master playlists from the cleaned DB
 *
 * Run from repo root: node scripts/migrate-adult-realdebrid.mjs
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.resolve(__dirname, '..')
// better-sqlite3 is in backend/node_modules
const Database  = require(path.join(ROOT, 'backend', 'node_modules', 'better-sqlite3'))
const DATA_DIR  = path.join(ROOT, 'backend', 'data')
const PLAYLISTS = path.join(ROOT, 'backend', 'playlists')
const BACKUP    = path.join(ROOT, 'backend', 'playlists', 'migration-backup-' + Date.now())

// ── Patterns ────────────────────────────────────────────────────────────────

const DEBRID_URL_RE     = /real-debrid\.com|debrid-link\.fr|alldebrid\.com|premiumize\.me|offcloud\.com/i
const DEBRID_INDEXER_RE = /real.?debrid|alldebrid|premiumize/i

const ADULT_KEYWORDS = [
  'xxx', 'porn', 'adult', 'erotic', 'nsfw', 'hentai', 'nude', 'naked',
  'milf', 'hardcore', 'softcore', 'fetish', 'lewd', 'explicit', 'xvideos',
  'pornhub', 'xnxx', 'brazzers', 'bangbros', 'playboy', 'penthouse',
  'x-rated', '18+',
]

function isDebrid(row) {
  return DEBRID_URL_RE.test(row.media_url) ||
         (row.indexer && DEBRID_INDEXER_RE.test(row.indexer))
}

function isAdult(row) {
  const text = [row.title, row.indexer ?? '', row.category ?? ''].join(' ').toLowerCase()
  return ADULT_KEYWORDS.some(kw => text.includes(kw)) || /\b100000\b/.test(text)
}

function adultCategoryFor(baseCategory) {
  if (baseCategory === 'live_tv') return 'adult_livetv'
  if (baseCategory === 'series')  return 'adult_series'
  return 'adult_movies'
}

// ── Playlist builder ─────────────────────────────────────────────────────────

const PLAYLIST_HEADERS = {
  movies:       '#EXTM3U\n#PLAYLIST:Movies Master — Archivist Protocol\n\n',
  live_tv:      '#EXTM3U\n#PLAYLIST:Live TV Master — Archivist Protocol\n\n',
  series:       '#EXTM3U\n#PLAYLIST:Series Master — Archivist Protocol\n\n',
  adult_movies: '#EXTM3U\n#PLAYLIST:Adult Movies Master — Archivist Protocol\n\n',
  adult_livetv: '#EXTM3U\n#PLAYLIST:Adult Live TV Master — Archivist Protocol\n\n',
  adult_series: '#EXTM3U\n#PLAYLIST:Adult Series Master — Archivist Protocol\n\n',
}
const PLAYLIST_FILES = {
  movies:       path.join(PLAYLISTS, 'movies_master.m3u'),
  live_tv:      path.join(PLAYLISTS, 'livetv_master.m3u'),
  series:       path.join(PLAYLISTS, 'series_master.m3u'),
  adult_movies: path.join(PLAYLISTS, 'adult_movies_master.m3u'),
  adult_livetv: path.join(PLAYLISTS, 'adult_livetv_master.m3u'),
  adult_series: path.join(PLAYLISTS, 'adult_series_master.m3u'),
}

function buildBlock(row) {
  const groupTitle =
    row.category === 'movies'       ? 'Movies' :
    row.category === 'live_tv'      ? 'Live TV' :
    row.category === 'series'       ? 'Series' :
    row.category === 'adult_movies' ? 'Adult Movies' :
    row.category === 'adult_livetv' ? 'Adult Live TV' : 'Adult Series'

  return `#EXTINF:-1 tvg-id="${row.title.slice(0, 64).replace(/[^a-zA-Z0-9._-]/g, '_')}" tvg-name="${row.title.replace(/"/g, "'")}" group-title="${groupTitle}" archived-at="${row.archived_at}",${row.title}\n${row.media_url}\n\n`
}

// ── Main ─────────────────────────────────────────────────────────────────────

const dbPath = path.join(DATA_DIR, 'media.db')
if (!fs.existsSync(dbPath)) {
  console.error('❌  media.db not found at', dbPath)
  process.exit(1)
}

// Backup existing playlists
fs.mkdirSync(BACKUP, { recursive: true })
for (const [cat, file] of Object.entries(PLAYLIST_FILES)) {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join(BACKUP, path.basename(file)))
  }
}
console.log('📦  Backed up playlists to', BACKUP)

const db = new Database(dbPath)

// 1. Remove debrid entries
const allRows = db.prepare('SELECT * FROM archivist_archive').all()
let removedDebrid = 0
let movedAdult = 0

const removeStmt = db.prepare('DELETE FROM archivist_archive WHERE id = ?')
const updateCatStmt = db.prepare('UPDATE archivist_archive SET category = ? WHERE id = ?')

for (const row of allRows) {
  if (isDebrid(row)) {
    removeStmt.run(row.id)
    removedDebrid++
    continue
  }
  // 2. Move adult entries in main categories to adult sub-categories
  if (['movies', 'live_tv', 'series'].includes(row.category) && isAdult(row)) {
    const newCat = adultCategoryFor(row.category)
    updateCatStmt.run(newCat, row.id)
    movedAdult++
  }
}

console.log(`🗑️   Removed ${removedDebrid} debrid entries`)
console.log(`🔞  Moved ${movedAdult} adult entries to adult sub-categories`)

// 3. Rebuild all 6 playlists from clean DB
const cleanRows = db.prepare('SELECT * FROM archivist_archive ORDER BY archived_at ASC').all()

// Initialize playlist buffers
const buffers = {}
for (const cat of Object.keys(PLAYLIST_HEADERS)) {
  buffers[cat] = PLAYLIST_HEADERS[cat]
}

for (const row of cleanRows) {
  if (buffers[row.category] !== undefined) {
    buffers[row.category] += buildBlock(row)
  }
}

// Write all 6 playlist files
for (const [cat, content] of Object.entries(buffers)) {
  fs.writeFileSync(PLAYLIST_FILES[cat], content, 'utf-8')
  const count = (content.match(/^#EXTINF/gm) ?? []).length
  console.log(`✅  ${cat}: ${count} entries → ${path.basename(PLAYLIST_FILES[cat])}`)
}

console.log('\n🎉  Migration complete!')
db.close()
