import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const Database = require(path.join(__dirname, '..', 'backend', 'node_modules', 'better-sqlite3'))

const DB_PATH   = path.join(__dirname, '..', 'backend', 'data', 'media.db')
const PLAYLISTS = path.join(__dirname, '..', 'backend', 'playlists')

// URLs that are NOT directly streamable
const BAD_URL = /^https?:\/\/localhost:\d+\/|^https?:\/\/127\.0\.0\.1:\d+\/|nyaa\.si\/view\/|rargb\.to|1337x\.to|thepiratebay\.org|kickass\.to|torrentgalaxy\.to|limetorrents\.|zooqle\.com|torlock\.com|eztv\.re|torrentz2\./i

const db = new Database(DB_PATH)
const rows = db.prepare('SELECT id, media_url FROM archivist_archive').all()
let removed = 0
for (const row of rows) {
  if (BAD_URL.test(row.media_url)) {
    db.prepare('DELETE FROM archivist_archive WHERE id = ?').run(row.id)
    removed++
  }
}
console.log(`Removed ${removed} dead/torrent-page URLs from DB`)

// Rebuild all 6 playlists from clean DB
const HEADERS = {
  movies:       '#EXTM3U\n#PLAYLIST:Movies Master — Archivist Protocol\n\n',
  live_tv:      '#EXTM3U\n#PLAYLIST:Live TV Master — Archivist Protocol\n\n',
  series:       '#EXTM3U\n#PLAYLIST:Series Master — Archivist Protocol\n\n',
  adult_movies: '#EXTM3U\n#PLAYLIST:Adult Movies Master — Archivist Protocol\n\n',
  adult_livetv: '#EXTM3U\n#PLAYLIST:Adult Live TV Master — Archivist Protocol\n\n',
  adult_series: '#EXTM3U\n#PLAYLIST:Adult Series Master — Archivist Protocol\n\n',
}
const FILES = {
  movies:       path.join(PLAYLISTS, 'movies_master.m3u'),
  live_tv:      path.join(PLAYLISTS, 'livetv_master.m3u'),
  series:       path.join(PLAYLISTS, 'series_master.m3u'),
  adult_movies: path.join(PLAYLISTS, 'adult_movies_master.m3u'),
  adult_livetv: path.join(PLAYLISTS, 'adult_livetv_master.m3u'),
  adult_series: path.join(PLAYLISTS, 'adult_series_master.m3u'),
}
const GROUP = {
  movies: 'Movies', live_tv: 'Live TV', series: 'Series',
  adult_movies: 'Adult Movies', adult_livetv: 'Adult Live TV', adult_series: 'Adult Series',
}

const buffers = {}
for (const k of Object.keys(HEADERS)) buffers[k] = HEADERS[k]

for (const row of db.prepare('SELECT * FROM archivist_archive ORDER BY archived_at ASC').all()) {
  if (!buffers[row.category]) continue
  const g = GROUP[row.category] ?? row.category
  buffers[row.category] += `#EXTINF:-1 tvg-name="${row.title.replace(/"/g, "'")}" group-title="${g}",${row.title}\n${row.media_url}\n\n`
}

for (const [cat, content] of Object.entries(buffers)) {
  fs.writeFileSync(FILES[cat], content, 'utf-8')
  const count = (content.match(/^#EXTINF/gm) ?? []).length
  console.log(`  ${cat}: ${count} entries`)
}
db.close()
console.log('Done!')
