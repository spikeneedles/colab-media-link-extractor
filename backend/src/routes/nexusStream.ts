import { Request, Response } from 'express'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'
import bencode from 'bencode'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface MediaProxyRequest extends Request {
  query: {
    url: string
    title?: string
    type?: string
    save?: string
  }
}

// ─── DOWNLOADS TRACKING ───────────────────────────────────────────────────

const DOWNLOADS_DIR = path.join(__dirname, '..', '..', 'downloads')
const MEGA_LIST_FILE = path.join(DOWNLOADS_DIR, 'mega-list.json')

interface DownloadEntry {
  id: string
  title: string
  url: string
  originalUrl: string
  fileSize: number
  filePath: string
  contentType: string
  downloadedAt: string
  duration?: string
  thumbnail?: string
}

// Ensure downloads directory exists
async function ensureDownloadsDir() {
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })
    console.log(`[DOWNLOADS] Created directory: ${DOWNLOADS_DIR}`)
  }
}

// Load mega list from disk
async function loadMegaList(): Promise<DownloadEntry[]> {
  await ensureDownloadsDir()
  if (fs.existsSync(MEGA_LIST_FILE)) {
    try {
      const data = fs.readFileSync(MEGA_LIST_FILE, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      console.error('[MEGA-LIST] Error loading mega list:', error)
      return []
    }
  }
  return []
}

// Save mega list to disk
async function saveMegaList(entries: DownloadEntry[]) {
  await ensureDownloadsDir()
  try {
    fs.writeFileSync(MEGA_LIST_FILE, JSON.stringify(entries, null, 2), 'utf-8')
    console.log(`[MEGA-LIST] Saved ${entries.length} entries`)
  } catch (error) {
    console.error('[MEGA-LIST] Error saving mega list:', error)
  }
}

// Add download entry to mega list
async function addDownloadEntry(entry: DownloadEntry) {
  const megaList = await loadMegaList()
  megaList.unshift(entry) // Add to beginning (newest first)
  await saveMegaList(megaList)
}

// Generate unique filename
function generateFilename(title: string, url: string, contentType: string): string {
  let ext = '.bin'
  if (contentType.includes('mp4')) ext = '.mp4'
  else if (contentType.includes('mkv')) ext = '.mkv'
  else if (contentType.includes('avi')) ext = '.avi'
  else if (contentType.includes('webm')) ext = '.webm'
  else if (contentType.includes('mpegurl') || contentType.includes('m3u')) ext = '.m3u8'
  else if (contentType.includes('mp2t')) ext = '.ts'
  else if (contentType.includes('mpeg')) ext = '.mp3'
  else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg'
  else if (contentType.includes('png')) ext = '.png'

  const sanitized = (title || 'download')
    .replace(/[^a-z0-9\s]/gi, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 50)

  return sanitized + ext
}

// ─── METADATA ENRICHMENT & PARSING ─────────────────────────────────────────

// Parse filename to extract clean title and year
function cleanFilename(url: string): { title: string; year?: string } {
  const filename = decodeURIComponent(url.split('/').pop() || '')
  // Remove extensions and common scene tags
  const clean = filename
    .replace(/\.(mp4|mkv|avi|m3u8|ts|webm)$/i, '')
    .replace(/(1080p|720p|4k|480p|x264|x265|h264|h\.265|bluray|web-?dl|web-?rip|aac|dts|hevc|avc|remux|hdrip).*/i, '')
    .replace(/[\.\-_]/g, ' ')
    .trim()

  const yearMatch = clean.match(/\b(19|20)\d{2}\b/)
  return {
    title: clean.replace(/\b(19|20)\d{2}\b/, '').trim(),
    year: yearMatch ? yearMatch[0] : undefined,
  }
}

// Get enriched metadata from TMDb
async function getEnrichedMetadata(title: string, year?: string) {
  const TMDB_API_KEY = process.env.TMDB_API_KEY
  if (!TMDB_API_KEY) return null

  try {
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}`
    const res = await axios.get(url, { timeout: 5000 })
    const movie = res.data.results?.[0]

    if (!movie) return null

    return {
      tmdbId: movie.id,
      description: movie.overview || '',
      posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      backdropUrl: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null,
      rating: movie.vote_average || 0,
      releaseDate: movie.release_date || year,
    }
  } catch (error) {
    console.error('[TMDB-ENRICHMENT-ERROR]', error instanceof Error ? error.message : error)
    return null
  }
}

// Detect if client is Android
function isAndroidClient(userAgent?: string): boolean {
  return /android/i.test(userAgent || '')
}

// ─── TORRENTIO RESOLVER ───────────────────────────────────────────────────────

async function resolveTorrentIO(infoHash: string, title?: string): Promise<string | null> {
  const isEpisode = /s\d{2}e\d{2}|\bseason\b|\bepisode\b/i.test(title ?? '')
  const types = isEpisode ? ['series', 'movie'] : ['movie', 'series']
  for (const t of types) {
    for (const base of ['https://torrentio.stremio.now.sh', 'https://torrentio.strem.fun']) {
      try {
        const res = await axios.get(`${base}/stream/${t}/${infoHash}.json`, { timeout: 12000 })
        const streams: any[] = res.data?.streams ?? []
        const http = streams.find((s: any) => /^https?:\/\//i.test(s.url ?? ''))
        if (http?.url) return http.url
      } catch { /* try next */ }
    }
  }
  return null
}

// ─── UNIVERSAL MEDIA STREAM ENDPOINT ───────────────────────────────────────

export async function handleNexusStream(req: MediaProxyRequest, res: Response) {
  let { url, title, type, save } = req.query
  const shouldSave = save === 'true' || save === '1'

  console.log(`[NEXUS-STREAM] Request for URL: ${url?.substring(0, 100)}...`)
  console.log(`[NEXUS-STREAM] Title: ${title}, Type: ${type}`)

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' })
  }

  const userAgent = (req.headers['user-agent'] || '').toString()
  const isAndroid = isAndroidClient(userAgent)

  try {
    const range = req.headers.range as string | undefined

    // ─────────────────────────────────────────────────────────────────────
    // FILE:// PROTOCOL HANDLER
    // ─────────────────────────────────────────────────────────────────────

    if (url.startsWith('file://')) {
      const filePath = fileURLToPath(url)
      const stat = await fs.promises.stat(filePath)
      const fileSize = stat.size
      const ext = path.extname(filePath).toLowerCase()
      const inferredType =
        ext === '.m3u8'
          ? 'application/vnd.apple.mpegurl'
          : ext === '.m3u'
          ? 'audio/x-mpegurl'
          : ext === '.mp4'
          ? 'video/mp4'
          : ext === '.mp3'
          ? 'audio/mpeg'
          : 'application/octet-stream'

      res.setHeader('Content-Type', type || inferredType)
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
      res.setHeader('Cache-Control', 'public, max-age=3600')
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

      if (title) {
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(title)}"`)
      }

      if (range) {
        const match = /bytes=(\d+)-(\d*)/.exec(range)
        const start = match ? parseInt(match[1], 10) : 0
        const end = match && match[2] ? parseInt(match[2], 10) : fileSize - 1
        const chunkSize = end - start + 1

        res.status(206)
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`)
        res.setHeader('Content-Length', chunkSize)

        fs.createReadStream(filePath, { start, end }).pipe(res)
      } else {
        res.status(200)
        res.setHeader('Content-Length', fileSize)
        fs.createReadStream(filePath).pipe(res)
      }

      return
    }

    // ─────────────────────────────────────────────────────────────────────
    // 1. UNIVERSAL RESOLVER LOOP
    // Handles: magnet: → HTTP, Prowlarr redirects, and chained redirects
    // ─────────────────────────────────────────────────────────────────────

    console.log('[NEXUS-RESOLVER] Starting universal resolution loop')

    let resolveAttempts = 0
    const maxResolveAttempts = 3
    const resolveHistory: string[] = [url]

    while (resolveAttempts < maxResolveAttempts) {
      const previousUrl = url

      // If it's a magnet link, resolve it to a playable HTTP URL
      if (url.startsWith('magnet:')) {
        console.log(`[NEXUS-RESOLVER] Magnet detected (attempt ${resolveAttempts + 1})`)

        const hashMatch = url.match(/xt=urn:btih:([a-zA-Z0-9]+)/)
        if (!hashMatch) {
          console.error('[NEXUS-RESOLVER] Could not extract info hash from magnet')
          break
        }

        const infoHash = hashMatch[1]
        const nameMatch = url.match(/dn=([^&]+)/)
        const decodedName = nameMatch ? decodeURIComponent(nameMatch[1]) : 'Torrent'

        try {
          // Try TorrentIO first
          const torrentioUrl = `https://torrentio.stremio.now.sh/stream/movie/${infoHash}.json`
          console.log(`[NEXUS-RESOLVER] Calling TorrentIO: ${torrentioUrl}`)

          const resolveRes = await axios.get(torrentioUrl, { timeout: 8000 })
          const firstStream = resolveRes.data?.streams?.find(
            (s: any) => s.url && (s.url.startsWith('http://') || s.url.startsWith('https://'))
          )

          if (firstStream) {
            url = firstStream.url
            if (!title) title = decodedName
            console.log(`[NEXUS-RESOLVER] Magnet resolved to HTTP: ${url.substring(0, 80)}...`)
            resolveHistory.push(url)
            break // Successfully resolved
          }
        } catch (torrentioErr) {
          console.warn('[NEXUS-RESOLVER] TorrentIO failed, trying fallback...')

          try {
            const fallbackUrl = `https://www.torrentio.app/stream/movie/${infoHash}.json`
            const fallbackRes = await axios.get(fallbackUrl, { timeout: 8000 })
            const fallbackStream = fallbackRes.data?.streams?.find(
              (s: any) => s.url && (s.url.startsWith('http://') || s.url.startsWith('https://'))
            )

            if (fallbackStream) {
              url = fallbackStream.url
              if (!title) title = decodedName
              console.log(`[NEXUS-RESOLVER] Magnet resolved via fallback`)
              resolveHistory.push(url)
              break
            }
          } catch (fallbackErr) {
            console.error('[NEXUS-RESOLVER] Fallback also failed')
          }
        }

        break
      }

      // Check for HTTP redirects (common with Prowlarr/Jackett)
      if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
          const headRes = await axios.head(url, {
            maxRedirects: 0,
            validateStatus: (status) => status < 500,
            timeout: 5000,
          })

          // If it's a redirect, follow it and re-evaluate
          if (headRes.status >= 300 && headRes.status < 400) {
            const location = headRes.headers['location'] as string | undefined

            if (location && location.startsWith('magnet:')) {
              console.log('[NEXUS-RESOLVER] Redirect to magnet detected')
              url = location
              resolveHistory.push(url)
              resolveAttempts++
              continue
            } else if (location) {
              console.log(`[NEXUS-RESOLVER] Following redirect: ${location.substring(0, 80)}...`)
              url = location
              resolveHistory.push(url)
              resolveAttempts++
              continue
            }
          }
        } catch (headErr) {
          console.warn('[NEXUS-RESOLVER] HEAD request failed, continuing with GET')
        }
      }

      // If we haven't changed the URL, we're done resolving
      if (url === previousUrl) {
        break
      }

      resolveAttempts++
    }

    console.log('[NEXUS-RESOLVER] Resolve history:', resolveHistory)

    // Validate final URL
    try {
      new URL(url)
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format after resolution' })
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2. PREPARE REQUEST HEADERS
    // ─────────────────────────────────────────────────────────────────────

    const headers: Record<string, string> = {
      'User-Agent': isAndroid
        ? 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity',
    }

    // Forward Prowlarr auth cookie if present
    const incomingCookies = req.headers.cookie || ''
    const prowlarrAuthMatch = incomingCookies.match(/ProwlarrAuth=([^;]+)/)
    if (prowlarrAuthMatch && prowlarrAuthMatch[1]) {
      headers['Cookie'] = `ProwlarrAuth=${prowlarrAuthMatch[1]}`
      console.log('[NEXUS-STREAM] Forwarding Prowlarr auth cookie')
    }

    if (range) {
      headers['Range'] = range
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3. FETCH STREAM
    // ─────────────────────────────────────────────────────────────────────

    console.log(`[NEXUS-STREAM] Fetching from: ${url.substring(0, 100)}...`)

    let response: any
    try {
      response = await axios({
        method: 'GET',
        url,
        headers,
        responseType: 'stream',
        maxRedirects: 0,
        validateStatus: (status) => status < 500,
        timeout: 30000,
      })
    } catch (axiosError: any) {
      if (axiosError.code === 'ERR_FR_REDIRECTION_FAILURE' && axiosError.response) {
        const redirectLocation = axiosError.response.headers?.['location'] as string | undefined
        if (redirectLocation && redirectLocation.startsWith('magnet:')) {
          console.log('[NEXUS-STREAM] Redirect to magnet (from error handler)')
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          return res.status(200).json({
            magnet: redirectLocation,
            title: title || 'Torrent',
          })
        }
      }
      throw axiosError
    }

    // Check for redirects BEFORE consuming stream
    if (response.status >= 300 && response.status < 400) {
      const redirectLocation = response.headers['location'] as string | undefined

      if (redirectLocation && redirectLocation.startsWith('magnet:')) {
        console.log('[NEXUS-STREAM] Magnet redirect detected')
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        return res.status(200).json({
          magnet: redirectLocation,
          title: title || 'Torrent',
        })
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. DETECT CONTENT TYPE & HANDLE TORRENT / M3U8 MANIFESTS
    // ─────────────────────────────────────────────────────────────────────

    const urlExt = url.split('?')[0].split('#')[0].toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || ''
    const inferredType =
      urlExt === '.m3u8'
        ? 'application/vnd.apple.mpegurl'
        : urlExt === '.m3u'
        ? 'audio/x-mpegurl'
        : urlExt === '.mp4'
        ? 'video/mp4'
        : urlExt === '.ts'
        ? 'video/mp2t'
        : urlExt === '.webm'
        ? 'video/webm'
        : urlExt === '.mkv'
        ? 'video/x-matroska'
        : urlExt === '.avi'
        ? 'video/x-msvideo'
        : undefined

    const contentType = response.headers['content-type'] || inferredType || type || 'video/mp4'

    console.log(`[NEXUS-CONTENT] Type: ${contentType}, Extension: ${urlExt}`)

    // ── Torrent binary → resolve via TorrentIO ──────────────────────────────
    if (contentType.includes('bittorrent') || contentType.includes('x-torrent') || urlExt === '.torrent') {
      console.log('[NEXUS-TORRENT] Detected .torrent — extracting info hash for TorrentIO')
      // Buffer the (small) torrent file
      const chunks: Buffer[] = []
      for await (const chunk of response.data) chunks.push(Buffer.from(chunk))
      const torrentBuf = Buffer.concat(chunks)

      let infoHash: string | null = null
      try {
        const decoded = bencode.decode(torrentBuf) as any
        const infoEncoded = bencode.encode(decoded.info)
        infoHash = createHash('sha1').update(infoEncoded).digest('hex')
        console.log(`[NEXUS-TORRENT] Info hash: ${infoHash}`)
      } catch (e) {
        console.warn('[NEXUS-TORRENT] Bencode parse failed:', e)
      }

      if (infoHash) {
        const streamUrl = await resolveTorrentIO(infoHash, title)
        if (streamUrl) {
          console.log(`[NEXUS-TORRENT] TorrentIO stream: ${streamUrl.substring(0, 80)}`)
          // Proxy the actual stream through ourselves so CORS is handled
          return res.redirect(302, `/api/media/stream?url=${encodeURIComponent(streamUrl)}${title ? `&title=${encodeURIComponent(title)}` : ''}`)
        }
      }

      return res.status(502).json({ error: 'Torrent has no active streams in TorrentIO' })
    }

    // Handle M3U8 manifests
    if (urlExt === '.m3u8' || contentType.includes('application/vnd.apple.mpegurl') || contentType.includes('application/x-mpegurl')) {
      console.log('[NEXUS-MANIFEST] Detected M3U8 - reading and rewriting')

      const chunks: Buffer[] = []
      for await (const chunk of response.data) {
        chunks.push(Buffer.from(chunk))
      }
      let manifest = Buffer.concat(chunks).toString('utf-8')

      // Validate M3U8
      if (manifest.trim().startsWith('#EXTM3U')) {
        const backendBaseUrl = `${req.protocol}://${req.get('host')}`
        const manifestBaseUrl = url.substring(0, url.lastIndexOf('/') + 1)

        console.log('[NEXUS-MANIFEST] Rewriting segment URLs for proxying')

        const lines = manifest.split('\n')
        const processedLines = lines.map((line: string) => {
          // Handle URI= attributes
          if (line.includes('URI=')) {
            return line.replace(/URI="([^"]+)"/g, (match, uri) => {
              const absoluteUri =
                uri.startsWith('http://') || uri.startsWith('https://') ? uri : new URL(uri, manifestBaseUrl).href
              const proxiedUri = `${backendBaseUrl}/api/media/stream?url=${encodeURIComponent(absoluteUri)}`
              return `URI="${proxiedUri}"`
            })
          }

          // Skip comments
          if (line.startsWith('#') || !line.trim()) return line

          // Rewrite segment URLs
          const segmentLine = line.trim()
          const absoluteSegmentUrl =
            segmentLine.startsWith('http://') || segmentLine.startsWith('https://')
              ? segmentLine
              : new URL(segmentLine, manifestBaseUrl).href

          const proxiedUrl = `${backendBaseUrl}/api/media/stream?url=${encodeURIComponent(absoluteSegmentUrl)}`
          return proxiedUrl
        })

        const rewrittenManifest = processedLines.join('\n')
        const manifestBuffer = Buffer.from(rewrittenManifest, 'utf-8')

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8')
        res.setHeader('Accept-Ranges', 'bytes')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
        res.setHeader('Cache-Control', 'public, max-age=60')
        res.setHeader('Content-Length', manifestBuffer.length.toString())
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

        if (title) {
          res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(title)}"`)
        }

        res.status(200).send(manifestBuffer)
        return
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 5. METADATA ENRICHMENT (for logging & headers)
    // ─────────────────────────────────────────────────────────────────────

    if (!title) {
      const { title: cleanTitle, year } = cleanFilename(url)
      if (cleanTitle) {
        title = cleanTitle
        // Optionally enrich with TMDb (this is async, don't wait for it)
        getEnrichedMetadata(cleanTitle, year).then((metadata) => {
          if (metadata) {
            console.log(`[NEXUS-METADATA] Enriched: ${cleanTitle} - Rating: ${metadata.rating}/10`)
          }
        })
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 6. PIPE BINARY CONTENT
    // ─────────────────────────────────────────────────────────────────────

    const contentLength = response.headers['content-length']
    const contentRange = response.headers['content-range']

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Access-Control-Max-Age', '86400')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type, Content-Disposition')
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

    res.setHeader('Content-Type', contentType)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('X-Content-Type-Options', 'nosniff')

    if (title) {
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(title)}"`)
    }

    if (contentLength) {
      res.setHeader('Content-Length', contentLength)
    }

    if (contentRange) {
      res.setHeader('Content-Range', contentRange)
      res.status(206)
    } else if (range) {
      res.status(206)
    } else {
      res.status(200)
    }

    console.log('[NEXUS-STREAM] Piping media to client')

    // Optionally save to disk
    if (shouldSave) {
      await ensureDownloadsDir()
      const filename = generateFilename(title || '', url, contentType)
      const filePath = path.join(DOWNLOADS_DIR, filename)

      const writeStream = fs.createWriteStream(filePath)
      const startTime = Date.now()
      let totalBytes = 0

      response.data.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length
      })

      response.data
        .pipe(writeStream)
        .on('finish', async () => {
          const duration = ((Date.now() - startTime) / 1000).toFixed(2)
          console.log(`[DOWNLOADS] Saved to disk: ${filename} (${(totalBytes / 1024 / 1024).toFixed(2)} MB in ${duration}s)`)

          // Add to mega list (use relative path, not full path)
          const entry: DownloadEntry = {
            id: Date.now().toString(),
            title: title || filename,
            url: url,
            originalUrl: req.query.url as string,
            fileSize: totalBytes,
            filePath: filename, // Use relative filename, not full path
            contentType: contentType,
            downloadedAt: new Date().toISOString(),
          }
          await addDownloadEntry(entry)
        })
        .on('error', (error: Error) => {
          console.error('[DOWNLOADS-SAVE-ERROR]', error.message)
          try {
            fs.unlinkSync(filePath)
          } catch (e) {
            // File may not exist yet
          }
        })

      response.data.pipe(res)
    } else {
      response.data.pipe(res)
    }

    response.data.on('error', (error: Error) => {
      console.error('[NEXUS-PIPE-ERROR]', error.message)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error' })
      }
    })
  } catch (error) {
    console.error('[NEXUS-FATAL]', error instanceof Error ? error.message : error)
    if (!res.headersSent) {
      if (axios.isAxiosError(error) && error.response) {
        const statusCode = error.response.status || 500
        console.error('[NEXUS-AXIOS] Status:', statusCode)
        res.status(statusCode).json({
          error: `Failed to fetch media: ${error.message}`,
          status: statusCode,
        })
      } else if (axios.isAxiosError(error)) {
        console.error('[NEXUS-AXIOS-NO-RESPONSE]', error.message)
        res.status(500).json({
          error: `Network error: ${error.message}`,
        })
      } else {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  }
}
