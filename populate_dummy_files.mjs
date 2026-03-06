import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const downloadsDir = path.join(__dirname, 'backend', 'downloads')
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true })
}

const movies = [
  'Avatar.2009.1080p.BluRay.x264.mp4',
  'Inception.2010.720p.BRRip.mkv',
  'Interstellar.2014.2160p.UHD.mkv',
  'The.Dark.Knight.2008.1080p.mkv',
  'Pulp.Fiction.1994.720p.mp4',
]

const series = [
  'Breaking.Bad.S01E01.720p.mkv',
  'Game.of.Thrones.S08E06.1080p.mkv',
  'Stranger.Things.S01E01.720p.mkv',
  'The.Mandalorian.S01E01.1080p.mkv',
  'The.Boys.S01E01.720p.mkv',
]

const live_tv = [
  'CNN.Live.Stream.m3u8',
  'ESPN.HD.Channel.m3u8',
  'BBC.World.News.m3u8',
  'Sky.Sports.Live.m3u8',
  'HBO.Live.Stream.m3u8',
]

const filesToCreate = []

for (let i = 0; i < 100; i++) {
  const type = Math.floor(Math.random() * 3)
  let name = ''
  if (type === 0) name = movies[Math.floor(Math.random() * movies.length)]
  else if (type === 1) name = series[Math.floor(Math.random() * series.length)]
  else name = live_tv[Math.floor(Math.random() * live_tv.length)]

  filesToCreate.push(`${i}_${name}`)
}

for (const name of filesToCreate) {
  const filePath = path.join(downloadsDir, name)
  fs.writeFileSync(filePath, 'dummy content')
}

console.log(`Created 100 dummy files in ${downloadsDir}`)
