import type { EPGData } from './epgParser'
import type { ValidationStatus } from './urlValidator'

export type ContentType = 'movie' | 'tv-series' | 'live-tv' | 'vod' | 'unknown'

export interface LinkWithCount {
  url: string
  count: number
  mediaType: 'video' | 'audio' | 'unknown'
  contentType?: ContentType
  filePaths: string[]
  title?: string
  category?: string
  validationStatus?: ValidationStatus
  responseTime?: number
  statusCode?: number
}

export interface ConfigFile {
  path: string
  name: string
  content: string
  size: number
  type: 'json' | 'xml' | 'properties' | 'ini' | 'txt' | 'conf' | 'cfg' | 'm3u' | 'm3u8' | 'py' | 'other'
  linksFound?: number
  hasMediaLinks?: boolean
}

export interface ScanResult {
  links: string[]
  linksWithCounts: LinkWithCount[]
  fileCount: number
  linkCount: number
  uniqueLinkCount: number
  duplicateCount: number
  videoCount: number
  audioCount: number
  movieCount: number
  tvSeriesCount: number
  liveTvCount: number
  epgData?: EPGData
  configFiles?: ConfigFile[]
}

const VIDEO_EXTENSIONS = [
  'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm',
  'm3u8', 'ts', 'm4v', 'mpg', 'mpeg', '3gp', 'f4v',
  'vob', 'ogv', 'divx', 'asf', 'rm', 'rmvb', 'mts',
  'm2ts', 'mxf', 'nsv', 'swf', 'xvid', 'h264', 'h265',
  'hevc', 'vp8', 'vp9', 'av1', 'mjpeg', 'mjpg', 'dat',
  'dv', 'mod', 'tod', 'm2v', 'm4p', 'm4b', 'mpv', 'mp2v',
  'ogm', 'qt', 'yuv', 'roq', 'svi', 'drc', 'gifv', 'mng',
  '3g2', '3gpp', 'amv', 'f4p', 'f4b', 'nsv', 'ogx', 'rec',
  'rv', 'rmvb', 'y4m', 'wtv', 'dvr-ms', 'dvr', 'trp', 'ivf'
]

const AUDIO_EXTENSIONS = [
  'mp3', 'aac', 'flac', 'wav', 'ogg', 'opus',
  'm4a', 'f4a', 'wma', 'alac', 'ape', 'mid', 'midi',
  'ra', 'ram', 'aiff', 'ac3', 'dts', 'tta', 'voc',
  'oga', 'mogg', 'xm', 'it', 's3m', 'mod', 'amr', 'awb',
  'au', 'snd', 'mp2', 'mpa', 'mp1', 'm2a', 'm3u', 'mka',
  'tak', 'wv', 'webm', 'aa', 'aax', 'act', 'aiff', 'aifc',
  'caf', 'dss', 'dvf', 'gsm', 'iklax', 'ivs', 'm4p', 'mmf',
  'mpc', 'msv', 'nmf', 'nsf', 'ots', 'sln', 'spx', 'tta',
  'vox', 'wve', '8svx', 'cda', 'kar', 'mxmf', 'rtttl', 'rtx'
]

const MEDIA_EXTENSIONS = [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, 'm3u']

const KODI_EXTENSIONS = [
  'xsp', 'nfo', 'strm', 'py', 'xml', 'addon', 'repository',
  'pvr', 'skinning', 'keymap', 'playercorefactory', 'advancedsettings',
  'guisettings', 'favourites', 'sources'
]

const KODI_ADDON_PATTERNS = [
  'addon.xml', 'default.py', 'addon.py', 'plugin.py',
  'service.py', 'script.py', 'resources/settings.xml',
  'resources/lib/', 'fanart.jpg', 'icon.png'
]

const SUPPORTED_FILE_EXTENSIONS = [
  'm3u', 'm3u8', 'txt', 'json', 'pls', 'xspf', 'asx', 'xml',
  'playlist', 'conf', 'list', 'urls', 'links', 'wpl', 'b4s',
  'kpl', 'jspf', 'smil', 'smi', 'ram', 'qtl', 'wvx', 'm4u',
  'vlc', 'zpl', 'mpcpl', 'mxu', 'cue', 'dpl', 'epg',
  'aimppl', 'aimppl4', 'bio', 'fpl', 'kpl', 'mpls', 'pla',
  'plc', 'pls', 'plx', 'plist', 'smil', 'smi', 'sml', 'sqf',
  'wax', 'wmx', 'wvx', 'xpl', 'xspf', 'zpl', 'asx', 'wax',
  'wvx', 'wmx', 'm3u', 'm3u8', 'm4u', 'pls', 'ram', 'rmp',
  'rpm', 'smi', 'smil', 'wax', 'wpl', 'wvx', 'xspf', 'vlc',
  'ts', 'mpd', 'ism', 'isml', 'f4m', 'strm', 
  'apk', 'aab', 'xapk', 'apks', 'apkm', 'apex', 'apkx',
  'zip', 'rar', 'tar', 'gz', 'tgz', 'tar.gz', '7z', 'bz2', 'bzip2', 'exe',
  ...KODI_EXTENSIONS
]

export interface M3UEntry {
  url: string
  title?: string
  category?: string
}

export function extractLinks(content: string): string[] {
  const links: string[] = []

  const urlRegex = /(https?|rtsp|rtmps?|mms|mmsh|rtp|udp|hls|dash|rtmpe|rtmpt|rtmpte|rtmfp|rtsps?|mmst?|ftp|ftps|sftp):\/\/[^\s<>"{}|\\^`\[\]]+/gi
  const urlMatches = content.match(urlRegex) || []
  
  urlMatches.forEach(url => {
    const cleanUrl = url.replace(/[,;:)}\]]+$/, '')
    if (isValidMediaUrl(cleanUrl)) {
      links.push(cleanUrl)
    }
  })

  if (content.includes('#EXTINF') || content.includes('#EXTM3U')) {
    const m3uEntries = parseM3UWithMetadata(content)
    links.push(...m3uEntries.map(e => e.url))
  }

  try {
    const jsonData = JSON.parse(content)
    const xtreamLinks = parseXtreamCodes(jsonData)
    links.push(...xtreamLinks)
  } catch {
  }

  if (content.includes('[playlist]') || content.includes('File1=')) {
    const plsLinks = parsePLS(content)
    links.push(...plsLinks)
  }

  if (content.includes('<playlist') || content.includes('<trackList>')) {
    const xspfLinks = parseXSPF(content)
    links.push(...xspfLinks)
  }

  if (content.includes('<asx') || content.includes('<ASX') || content.includes('<entry>')) {
    const asxLinks = parseASX(content)
    links.push(...asxLinks)
  }

  if (content.includes('<smil') || content.includes('<SMIL') || content.includes('<seq>') || content.includes('<par>')) {
    const smilLinks = parseSMIL(content)
    links.push(...smilLinks)
  }

  if (content.includes('<?wpl') || content.includes('<smil>')) {
    const wplLinks = parseWPL(content)
    links.push(...wplLinks)
  }

  const ramLinks = parseRAM(content)
  links.push(...ramLinks)

  if (content.includes('<MPD') || content.includes('<?xml') && content.includes('dash')) {
    const dashLinks = parseDASH(content)
    links.push(...dashLinks)
  }

  if (content.includes('<?xml') && (content.includes('SmoothStreamingMedia') || content.includes('.ism'))) {
    const smoothLinks = parseSmoothStreaming(content)
    links.push(...smoothLinks)
  }

  return links
}

export function getMediaType(url: string): 'video' | 'audio' | 'unknown' {
  try {
    const urlLower = url.toLowerCase()
    
    if (VIDEO_EXTENSIONS.some(ext => urlLower.includes(`.${ext}`))) {
      return 'video'
    }
    
    if (AUDIO_EXTENSIONS.some(ext => urlLower.includes(`.${ext}`))) {
      return 'audio'
    }
    
    if (/video|tv|movie|film/i.test(url)) {
      return 'video'
    }
    
    if (/audio|music|radio|song/i.test(url)) {
      return 'audio'
    }
    
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export function detectContentType(url: string, title?: string, category?: string): ContentType {
  const urlLower = url.toLowerCase()
  const titleLower = title?.toLowerCase() || ''
  const categoryLower = category?.toLowerCase() || ''
  const combinedText = `${urlLower} ${titleLower} ${categoryLower}`

  if (/\blive[-_]?tv\b|\blive[-_]?stream\b|\blive\b.*\btv\b|channel|television|\bnews\b|\bsport\b.*\blive\b/i.test(combinedText)) {
    return 'live-tv'
  }

  if (/\b(s\d{1,2}[-_]?e\d{1,2})\b/i.test(combinedText)) {
    return 'tv-series'
  }

  if (/season[-_]?\d+|episode[-_]?\d+|\bep[-_]?\d+|\bs\d{1,2}\b|\be\d{1,2}\b|series|show/i.test(combinedText)) {
    return 'tv-series'
  }

  if (/\btv[-_]?show\b|\btv[-_]?series\b/i.test(combinedText)) {
    return 'tv-series'
  }

  if (/\bmovie\b|\bfilm\b|\bcinema\b|\.(?:19|20)\d{2}\.|[\[(](?:19|20)\d{2}[\])]|\b(?:19|20)\d{2}\b.*\b(?:bluray|brrip|webrip|dvdrip|hdtv|hdrip|web-dl|720p|1080p|2160p|4k)/i.test(combinedText)) {
    return 'movie'
  }

  if (/vod|on[-_]?demand|catch[-_]?up|replay/i.test(combinedText)) {
    return 'vod'
  }

  if (category) {
    if (/movie|film|cinema/i.test(category)) {
      return 'movie'
    }
    if (/series|show|tv/i.test(category)) {
      return 'tv-series'
    }
    if (/live|channel|news|sport/i.test(category)) {
      return 'live-tv'
    }
  }

  return 'unknown'
}

function isValidMediaUrl(url: string): boolean {
  try {
    if (url.startsWith('rtsp://') || url.startsWith('rtmps://') || url.startsWith('rtmp://') || 
        url.startsWith('mms://') || url.startsWith('mmsh://') || url.startsWith('rtp://') ||
        url.startsWith('udp://') || url.startsWith('hls://') || url.startsWith('dash://') ||
        url.startsWith('rtmpe://') || url.startsWith('rtmpt://') || url.startsWith('rtmpte://') ||
        url.startsWith('rtmfp://') || url.startsWith('rtsps://') || url.startsWith('mmst://')) {
      return true
    }
    
    const urlObj = new URL(url)
    
    const hasMediaExtension = MEDIA_EXTENSIONS.some(ext => 
      urlObj.pathname.toLowerCase().includes(`.${ext}`)
    )
    
    const hasMediaParams = /\.(m3u8?|ts|mp4|mp3|mpd|ism|f4m)/.test(urlObj.search.toLowerCase())
    
    const isStreamingDomain = /playlist|stream|live|video|media|cdn|hls|dash|manifest/i.test(urlObj.hostname)
    
    const hasManifest = /manifest|playlist|\.mpd|\.ism|\.m3u8/i.test(urlObj.pathname)
    
    return hasMediaExtension || hasMediaParams || hasManifest || (isStreamingDomain && urlObj.pathname.length > 10)
  } catch {
    return false
  }
}

function parseM3U(content: string): string[] {
  const entries = parseM3UWithMetadata(content)
  return entries.map(e => e.url)
}

export function parseM3UWithMetadata(content: string): M3UEntry[] {
  const entries: M3UEntry[] = []
  const lines = content.split('\n')
  
  let currentTitle: string | undefined
  let currentCategory: string | undefined
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (line.startsWith('#EXTINF')) {
      const groupTitleMatch = line.match(/group-title=["']([^"']+)["']/i)
      currentCategory = groupTitleMatch ? groupTitleMatch[1] : undefined
      
      const titleMatch = line.match(/,(.+)$/)
      currentTitle = titleMatch ? titleMatch[1].trim() : undefined
    } else if (line && !line.startsWith('#')) {
      if (line.startsWith('http://') || line.startsWith('https://') || 
          line.startsWith('rtsp://') || line.startsWith('rtmps://') || line.startsWith('rtmp://') ||
          line.startsWith('mms://') || line.startsWith('mmsh://') || line.startsWith('rtp://') ||
          line.startsWith('udp://') || line.startsWith('hls://') || line.startsWith('dash://')) {
        entries.push({
          url: line,
          title: currentTitle,
          category: currentCategory
        })
        currentTitle = undefined
        currentCategory = undefined
      }
    }
  }
  
  return entries
}

function parseXtreamCodes(data: any): string[] {
  const links: string[] = []
  
  if (Array.isArray(data)) {
    data.forEach(item => {
      if (typeof item === 'object') {
        Object.values(item).forEach(value => {
          if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
            if (isValidMediaUrl(value)) {
              links.push(value)
            }
          }
        })
      }
    })
  } else if (typeof data === 'object') {
    Object.values(data).forEach(value => {
      if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
        if (isValidMediaUrl(value)) {
          links.push(value)
        }
      } else if (Array.isArray(value)) {
        links.push(...parseXtreamCodes(value))
      } else if (typeof value === 'object') {
        links.push(...parseXtreamCodes(value))
      }
    })
  }
  
  return links
}

function parsePLS(content: string): string[] {
  const links: string[] = []
  const lines = content.split('\n')
  
  lines.forEach(line => {
    const match = line.match(/^File\d+=(.+)$/i)
    if (match && match[1]) {
      const url = match[1].trim()
      if (url.startsWith('http://') || url.startsWith('https://') ||
          url.startsWith('rtsp://') || url.startsWith('rtmps://') || url.startsWith('rtmp://') ||
          url.startsWith('mms://') || url.startsWith('mmsh://') || url.startsWith('rtp://') ||
          url.startsWith('udp://') || url.startsWith('hls://') || url.startsWith('dash://')) {
        links.push(url)
      }
    }
  })
  
  return links
}

function parseXSPF(content: string): string[] {
  const links: string[] = []
  const locationRegex = /<location>(https?:\/\/[^<]+)<\/location>/gi
  let match
  
  while ((match = locationRegex.exec(content)) !== null) {
    links.push(match[1])
  }
  
  return links
}

function parseASX(content: string): string[] {
  const links: string[] = []
  const refRegex = /<ref\s+href=["'](https?:\/\/[^"']+)["']/gi
  const entryRefRegex = /<entryref\s+href=["'](https?:\/\/[^"']+)["']/gi
  
  let match
  while ((match = refRegex.exec(content)) !== null) {
    links.push(match[1])
  }
  
  while ((match = entryRefRegex.exec(content)) !== null) {
    links.push(match[1])
  }
  
  return links
}

function parseSMIL(content: string): string[] {
  const links: string[] = []
  const srcRegex = /src=["'](https?:\/\/[^"']+)["']/gi
  const videoRegex = /<video[^>]+src=["'](https?:\/\/[^"']+)["']/gi
  const audioRegex = /<audio[^>]+src=["'](https?:\/\/[^"']+)["']/gi
  
  let match
  while ((match = srcRegex.exec(content)) !== null) {
    links.push(match[1])
  }
  
  while ((match = videoRegex.exec(content)) !== null) {
    links.push(match[1])
  }
  
  while ((match = audioRegex.exec(content)) !== null) {
    links.push(match[1])
  }
  
  return links
}

function parseWPL(content: string): string[] {
  const links: string[] = []
  const mediaRegex = /<media\s+src=["'](https?:\/\/[^"']+)["']/gi
  
  let match
  while ((match = mediaRegex.exec(content)) !== null) {
    links.push(match[1])
  }
  
  return links
}

function parseRAM(content: string): string[] {
  const links: string[] = []
  const lines = content.split('\n')
  
  lines.forEach(line => {
    const trimmed = line.trim()
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('rtsp://') ||
        trimmed.startsWith('rtmps://') || trimmed.startsWith('rtmp://') || trimmed.startsWith('rtp://') ||
        trimmed.startsWith('udp://')) {
      if (isValidMediaUrl(trimmed) || trimmed.startsWith('rtsp://') || trimmed.startsWith('rtp://') || trimmed.startsWith('udp://')) {
        links.push(trimmed)
      }
    }
  })
  
  return links
}

function parseDASH(content: string): string[] {
  const links: string[] = []
  const baseURLRegex = /<BaseURL>(https?:\/\/[^<]+)<\/BaseURL>/gi
  const locationRegex = /<Location>(https?:\/\/[^<]+)<\/Location>/gi
  
  let match
  while ((match = baseURLRegex.exec(content)) !== null) {
    links.push(match[1])
  }
  
  while ((match = locationRegex.exec(content)) !== null) {
    links.push(match[1])
  }
  
  return links
}

function parseSmoothStreaming(content: string): string[] {
  const links: string[] = []
  const urlRegex = /Url=["'](https?:\/\/[^"']+)["']/gi
  const srcRegex = /src=["'](https?:\/\/[^"']+\.ism[^"']*)["']/gi
  
  let match
  while ((match = urlRegex.exec(content)) !== null) {
    links.push(match[1])
  }
  
  while ((match = srcRegex.exec(content)) !== null) {
    links.push(match[1])
  }
  
  return links
}

export function generateTextFile(linksWithCounts: LinkWithCount[]): Blob {
  const lines = linksWithCounts.flatMap(({ url, filePaths }) => {
    const fileInfo = filePaths.length > 0 ? ` # Found in: ${filePaths.join(', ')}` : ''
    return `${url}${fileInfo}`
  })
  const content = lines.join('\n')
  return new Blob([content], { type: 'text/plain' })
}

export function generateUniqueLinksFile(linksWithCounts: LinkWithCount[]): Blob {
  const lines = linksWithCounts.map(({ url, filePaths }) => {
    const fileInfo = filePaths.length > 0 ? ` # Found in: ${filePaths.join(', ')}` : ''
    return `${url}${fileInfo}`
  })
  const content = lines.join('\n')
  return new Blob([content], { type: 'text/plain' })
}

export function generateDuplicatesFile(linksWithCounts: LinkWithCount[]): Blob {
  const duplicates = linksWithCounts.filter(item => item.count > 1)
  const lines = duplicates.map(({ url, count, filePaths }) => {
    const fileInfo = filePaths.length > 0 ? ` # Found in: ${filePaths.join(', ')}` : ''
    return `${url} (×${count})${fileInfo}`
  })
  const content = lines.join('\n')
  return new Blob([content], { type: 'text/plain' })
}

async function scanZipPackageForLinks(zip: any): Promise<string[]> {
  const links: string[] = []
  
  const commonFilesToScan = [
    'res/values/strings.xml',
    'res/values-en/strings.xml',
    'res/values-es/strings.xml',
    'res/values-fr/strings.xml',
    'res/values-de/strings.xml',
    'res/values-it/strings.xml',
    'res/values-pt/strings.xml',
    'res/values-ru/strings.xml',
    'res/values-ar/strings.xml',
    'res/values-tr/strings.xml',
    'res/values-zh/strings.xml',
    'res/raw/config.json',
    'res/raw/settings.json',
    'res/raw/channels.json',
    'res/raw/servers.json',
    'res/raw/playlist.m3u',
    'res/raw/playlist.m3u8',
    'res/raw/urls.txt',
    'res/raw/links.txt',
    'res/raw/data.txt',
    'res/raw/api.txt',
    'AndroidManifest.xml',
    'META-INF/services/config',
    'assets/config.json',
    'assets/configuration.json',
    'assets/settings.json',
    'assets/channels.json',
    'assets/servers.json',
    'assets/api.json',
    'assets/endpoints.json',
    'assets/playlist.m3u',
    'assets/playlist.m3u8',
    'assets/urls.txt',
    'assets/links.txt',
    'assets/data.txt',
    'assets/streams.txt',
    'assets/media.txt',
    'assets/iptv.txt',
    'assets/channels.txt',
    'lib/config.txt',
    'lib/settings.txt',
    'default.py',
    'addon.py',
    'plugin.py',
    'service.py',
    'script.py',
    'resources/lib/config.py',
    'resources/lib/settings.py',
    'resources/lib/constants.py',
    'resources/lib/utils.py',
    'resources/settings.xml'
  ]
  
  for (const fileName of commonFilesToScan) {
    const zipFile = zip.file(fileName)
    if (zipFile) {
      try {
        const content = await zipFile.async('text')
        const extractedLinks = extractLinks(content)
        links.push(...extractedLinks)
      } catch (error) {
        console.debug(`Could not read ${fileName}:`, error)
      }
    }
  }
  
  const assetsFolder = zip.folder('assets')
  if (assetsFolder) {
    const assetFiles = Object.keys(zip.files).filter(path => 
      path.startsWith('assets/') && 
      !path.endsWith('/') &&
      (path.endsWith('.txt') || path.endsWith('.json') || path.endsWith('.m3u') || 
       path.endsWith('.m3u8') || path.endsWith('.xml') || path.endsWith('.conf') ||
       path.endsWith('.list') || path.endsWith('.urls') || path.endsWith('.links') ||
       path.endsWith('.pls') || path.endsWith('.xspf') || path.endsWith('.asx') ||
       path.endsWith('.properties') || path.endsWith('.ini') || path.endsWith('.cfg') ||
       path.endsWith('.py'))
    )
    
    for (const assetPath of assetFiles) {
      if (!commonFilesToScan.includes(assetPath)) {
        const zipFile = zip.file(assetPath)
        if (zipFile) {
          try {
            const content = await zipFile.async('text')
            const extractedLinks = extractLinks(content)
            links.push(...extractedLinks)
          } catch (error) {
            console.debug(`Could not read ${assetPath}:`, error)
          }
        }
      }
    }
  }
  
  const resFolder = zip.folder('res')
  if (resFolder) {
    const resFiles = Object.keys(zip.files).filter(path => 
      path.startsWith('res/') && 
      !path.endsWith('/') &&
      (path.endsWith('.xml') || path.endsWith('.txt') || path.endsWith('.json') ||
       path.endsWith('.m3u') || path.endsWith('.m3u8') || path.endsWith('.conf') ||
       path.endsWith('.py'))
    )
    
    for (const resPath of resFiles) {
      if (!commonFilesToScan.includes(resPath)) {
        const zipFile = zip.file(resPath)
        if (zipFile) {
          try {
            const content = await zipFile.async('text')
            const extractedLinks = extractLinks(content)
            links.push(...extractedLinks)
          } catch (error) {
            console.debug(`Could not read ${resPath}:`, error)
          }
        }
      }
    }
  }
  
  const libFolder = zip.folder('lib')
  if (libFolder) {
    const libFiles = Object.keys(zip.files).filter(path => 
      path.startsWith('lib/') && 
      !path.endsWith('/') &&
      (path.endsWith('.txt') || path.endsWith('.json') || path.endsWith('.xml') ||
       path.endsWith('.conf') || path.endsWith('.cfg') || path.endsWith('.properties') ||
       path.endsWith('.py'))
    )
    
    for (const libPath of libFiles) {
      if (!commonFilesToScan.includes(libPath)) {
        const zipFile = zip.file(libPath)
        if (zipFile) {
          try {
            const content = await zipFile.async('text')
            const extractedLinks = extractLinks(content)
            links.push(...extractedLinks)
          } catch (error) {
            console.debug(`Could not read ${libPath}:`, error)
          }
        }
      }
    }
  }
  
  const pythonFiles = Object.keys(zip.files).filter(path => 
    !path.endsWith('/') &&
    path.endsWith('.py') &&
    (path.startsWith('resources/') || 
     path === 'default.py' || 
     path === 'addon.py' || 
     path === 'plugin.py' ||
     path === 'service.py' ||
     path === 'script.py')
  )
  
  for (const pyPath of pythonFiles) {
    if (!commonFilesToScan.includes(pyPath)) {
      const zipFile = zip.file(pyPath)
      if (zipFile) {
        try {
          const content = await zipFile.async('text')
          const extractedLinks = extractLinks(content)
          links.push(...extractedLinks)
        } catch (error) {
          console.debug(`Could not read ${pyPath}:`, error)
        }
      }
    }
  }
  
  return links
}

export async function scanAPK(file: File): Promise<string[]> {
  const links: string[] = []
  const fileName = file.name.toLowerCase()
  
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(file)
    
    if (fileName.endsWith('.xapk') || fileName.endsWith('.apkm')) {
      const apkFiles = Object.keys(zip.files).filter(path => 
        path.toLowerCase().endsWith('.apk') && !path.endsWith('/')
      )
      
      for (const apkPath of apkFiles) {
        const apkFile = zip.file(apkPath)
        if (apkFile) {
          try {
            const apkData = await apkFile.async('arraybuffer')
            const apkZip = await JSZip.loadAsync(apkData)
            const apkLinks = await scanZipPackageForLinks(apkZip)
            links.push(...apkLinks)
          } catch (error) {
            console.debug(`Could not read APK ${apkPath}:`, error)
          }
        }
      }
      
      const configFiles = Object.keys(zip.files).filter(path => 
        (path.toLowerCase().endsWith('.json') || path.toLowerCase().endsWith('.txt')) && 
        !path.endsWith('/')
      )
      
      for (const configPath of configFiles) {
        const configFile = zip.file(configPath)
        if (configFile) {
          try {
            const content = await configFile.async('text')
            const extractedLinks = extractLinks(content)
            links.push(...extractedLinks)
          } catch (error) {
            console.debug(`Could not read ${configPath}:`, error)
          }
        }
      }
    } else if (fileName.endsWith('.apks') || fileName.endsWith('.apkx')) {
      const apkFiles = Object.keys(zip.files).filter(path => 
        path.toLowerCase().endsWith('.apk') && !path.endsWith('/')
      )
      
      for (const apkPath of apkFiles) {
        const apkFile = zip.file(apkPath)
        if (apkFile) {
          try {
            const apkData = await apkFile.async('arraybuffer')
            const apkZip = await JSZip.loadAsync(apkData)
            const apkLinks = await scanZipPackageForLinks(apkZip)
            links.push(...apkLinks)
          } catch (error) {
            console.debug(`Could not read APK ${apkPath}:`, error)
          }
        }
      }
    } else if (fileName.endsWith('.aab')) {
      const moduleFiles = Object.keys(zip.files).filter(path => 
        path.includes('/') && !path.endsWith('/')
      )
      
      const aabLinks = await scanZipPackageForLinks(zip)
      links.push(...aabLinks)
      
      for (const modulePath of moduleFiles) {
        if (modulePath.endsWith('.zip')) {
          const moduleFile = zip.file(modulePath)
          if (moduleFile) {
            try {
              const moduleData = await moduleFile.async('arraybuffer')
              const moduleZip = await JSZip.loadAsync(moduleData)
              const moduleLinks = await scanZipPackageForLinks(moduleZip)
              links.push(...moduleLinks)
            } catch (error) {
              console.debug(`Could not read module ${modulePath}:`, error)
            }
          }
        }
      }
    } else if (fileName.endsWith('.apex')) {
      const apexLinks = await scanZipPackageForLinks(zip)
      links.push(...apexLinks)
    } else {
      const apkLinks = await scanZipPackageForLinks(zip)
      links.push(...apkLinks)
    }
    
  } catch (error) {
    console.error(`Failed to scan ${fileName}:`, error)
  }
  
  return links
}

function getConfigFileType(filename: string): ConfigFile['type'] {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.xml')) return 'xml'
  if (lower.endsWith('.properties')) return 'properties'
  if (lower.endsWith('.ini')) return 'ini'
  if (lower.endsWith('.txt')) return 'txt'
  if (lower.endsWith('.conf')) return 'conf'
  if (lower.endsWith('.cfg')) return 'cfg'
  if (lower.endsWith('.m3u')) return 'm3u'
  if (lower.endsWith('.m3u8')) return 'm3u8'
  if (lower.endsWith('.py')) return 'py'
  return 'other'
}

async function extractConfigFilesFromZip(zip: any, parentPath = ''): Promise<ConfigFile[]> {
  const configFiles: ConfigFile[] = []
  
  const configExtensions = [
    '.json', '.xml', '.properties', '.ini', '.txt', '.conf', '.cfg',
    '.m3u', '.m3u8', '.pls', '.xspf', '.asx', '.wpl', '.smil',
    '.list', '.urls', '.links', '.playlist', '.channels', '.servers',
    '.settings', '.config', '.configuration', '.api', '.endpoints', '.py'
  ]
  
  const relevantPaths = Object.keys(zip.files).filter(path => {
    if (path.endsWith('/')) return false
    
    const pathLower = path.toLowerCase()
    
    const hasConfigExtension = configExtensions.some(ext => pathLower.endsWith(ext))
    if (!hasConfigExtension) return false
    
    const isInConfigFolder = 
      pathLower.startsWith('assets/') ||
      pathLower.startsWith('res/raw/') ||
      pathLower.startsWith('res/values/') ||
      pathLower.startsWith('lib/') ||
      pathLower.startsWith('config/') ||
      pathLower.startsWith('META-INF/')
    
    const hasConfigName = 
      pathLower.includes('config') ||
      pathLower.includes('settings') ||
      pathLower.includes('channels') ||
      pathLower.includes('servers') ||
      pathLower.includes('playlist') ||
      pathLower.includes('urls') ||
      pathLower.includes('links') ||
      pathLower.includes('streams') ||
      pathLower.includes('media') ||
      pathLower.includes('iptv') ||
      pathLower.includes('api') ||
      pathLower.includes('endpoints') ||
      pathLower.includes('data')
    
    return isInConfigFolder || hasConfigName
  })
  
  for (const path of relevantPaths) {
    const zipFile = zip.file(path)
    if (zipFile) {
      try {
        const content = await zipFile.async('text')
        const size = content.length
        const name = path.split('/').pop() || path
        const fullPath = parentPath ? `${parentPath}/${path}` : path
        
        configFiles.push({
          path: fullPath,
          name,
          content,
          size,
          type: getConfigFileType(name)
        })
      } catch (error) {
        console.debug(`Could not read config file ${path}:`, error)
      }
    }
  }
  
  return configFiles
}

export async function extractConfigFilesFromPackage(file: File): Promise<ConfigFile[]> {
  const configFiles: ConfigFile[] = []
  const fileName = file.name.toLowerCase()
  
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(file)
    
    if (fileName.endsWith('.xapk') || fileName.endsWith('.apkm')) {
      const topLevelConfigs = await extractConfigFilesFromZip(zip, file.name)
      configFiles.push(...topLevelConfigs)
      
      const apkFiles = Object.keys(zip.files).filter(path => 
        path.toLowerCase().endsWith('.apk') && !path.endsWith('/')
      )
      
      for (const apkPath of apkFiles) {
        const apkFile = zip.file(apkPath)
        if (apkFile) {
          try {
            const apkData = await apkFile.async('arraybuffer')
            const apkZip = await JSZip.loadAsync(apkData)
            const apkConfigs = await extractConfigFilesFromZip(apkZip, `${file.name}/${apkPath}`)
            configFiles.push(...apkConfigs)
          } catch (error) {
            console.debug(`Could not read APK ${apkPath}:`, error)
          }
        }
      }
    } else if (fileName.endsWith('.apks') || fileName.endsWith('.apkx')) {
      const apkFiles = Object.keys(zip.files).filter(path => 
        path.toLowerCase().endsWith('.apk') && !path.endsWith('/')
      )
      
      for (const apkPath of apkFiles) {
        const apkFile = zip.file(apkPath)
        if (apkFile) {
          try {
            const apkData = await apkFile.async('arraybuffer')
            const apkZip = await JSZip.loadAsync(apkData)
            const apkConfigs = await extractConfigFilesFromZip(apkZip, `${file.name}/${apkPath}`)
            configFiles.push(...apkConfigs)
          } catch (error) {
            console.debug(`Could not read APK ${apkPath}:`, error)
          }
        }
      }
    } else if (fileName.endsWith('.aab')) {
      const aabConfigs = await extractConfigFilesFromZip(zip, file.name)
      configFiles.push(...aabConfigs)
      
      const moduleFiles = Object.keys(zip.files).filter(path => 
        path.endsWith('.zip') && !path.endsWith('/')
      )
      
      for (const modulePath of moduleFiles) {
        const moduleFile = zip.file(modulePath)
        if (moduleFile) {
          try {
            const moduleData = await moduleFile.async('arraybuffer')
            const moduleZip = await JSZip.loadAsync(moduleData)
            const moduleConfigs = await extractConfigFilesFromZip(moduleZip, `${file.name}/${modulePath}`)
            configFiles.push(...moduleConfigs)
          } catch (error) {
            console.debug(`Could not read module ${modulePath}:`, error)
          }
        }
      }
    } else {
      const pkgConfigs = await extractConfigFilesFromZip(zip, file.name)
      configFiles.push(...pkgConfigs)
    }
    
  } catch (error) {
    console.error(`Failed to extract config files from ${fileName}:`, error)
  }
  
  return configFiles
}

export function scanConfigFilesForLinks(configFiles: ConfigFile[]): { 
  links: string[]
  configFilesWithLinks: ConfigFile[]
  linkToConfigMap: Map<string, string[]>
} {
  const links: string[] = []
  const linkToConfigMap = new Map<string, string[]>()
  const configFilesWithLinks: ConfigFile[] = []
  
  configFiles.forEach(configFile => {
    const extractedLinks = extractLinks(configFile.content)
    
    if (extractedLinks.length > 0) {
      links.push(...extractedLinks)
      
      const updatedConfigFile = {
        ...configFile,
        linksFound: extractedLinks.length,
        hasMediaLinks: true
      }
      configFilesWithLinks.push(updatedConfigFile)
      
      extractedLinks.forEach(link => {
        const configs = linkToConfigMap.get(link) || []
        if (!configs.includes(configFile.path)) {
          configs.push(configFile.path)
        }
        linkToConfigMap.set(link, configs)
      })
    }
  })
  
  return {
    links,
    configFilesWithLinks,
    linkToConfigMap
  }
}

export async function generateConfigFilesArchive(configFiles: ConfigFile[], packageName: string): Promise<Blob> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  
  const fileTypeGroups = new Map<string, ConfigFile[]>()
  configFiles.forEach(file => {
    const group = fileTypeGroups.get(file.type) || []
    group.push(file)
    fileTypeGroups.set(file.type, group)
  })
  
  configFiles.forEach((file, index) => {
    const sanitizedPath = file.path.replace(/[<>:"|?*]/g, '_')
    zip.file(sanitizedPath, file.content)
  })
  
  const configsWithLinks = configFiles.filter(f => f.hasMediaLinks)
  const totalLinks = configFiles.reduce((sum, f) => sum + (f.linksFound || 0), 0)
  
  const summary = `Configuration Files Extracted from ${packageName}
${'='.repeat(60)}

Total Files: ${configFiles.length}
Files with Media Links: ${configsWithLinks.length}
Total Media Links Found: ${totalLinks}
Extraction Date: ${new Date().toLocaleString()}

Files by Type:
${Array.from(fileTypeGroups.entries())
  .sort(([typeA], [typeB]) => typeA.localeCompare(typeB))
  .map(([type, files]) => `- ${type.toUpperCase()}: ${files.length} file${files.length !== 1 ? 's' : ''}`)
  .join('\n')}

File List:
${configFiles
  .sort((a, b) => a.path.localeCompare(b.path))
  .map((file, i) => `${i + 1}. ${file.path}
   Type: ${file.type}
   Size: ${file.size} bytes${file.hasMediaLinks ? `\n   Media Links Found: ${file.linksFound}` : ''}`)
  .join('\n\n')}

Note: All configuration files have been extracted with their original paths preserved.
You can use these files to analyze app configuration, IPTV endpoints, API URLs, and more.
${configsWithLinks.length > 0 ? `\nFiles marked with "Media Links Found" contain URLs that can be used for streaming.` : ''}
`
  
  zip.file('README.txt', summary)
  
  return await zip.generateAsync({ type: 'blob' })
}

export function isSupportedFile(filename: string): boolean {
  const extension = filename.split('.').pop()?.toLowerCase()
  return extension ? SUPPORTED_FILE_EXTENSIONS.includes(extension) : false
}

export async function scanFiles(items: FileList | DataTransferItemList): Promise<File[]> {
  const allFiles: File[] = []
  
  if (items instanceof FileList) {
    for (let i = 0; i < items.length; i++) {
      const file = items[i]
      if (isSupportedFile(file.name)) {
        allFiles.push(file)
      }
    }
  } else {
    for (let i = 0; i < items.length; i++) {
      const item = items[i].webkitGetAsEntry()
      if (item) {
        const files = await scanEntry(item)
        allFiles.push(...files)
      }
    }
  }
  
  return allFiles
}

async function scanEntry(entry: FileSystemEntry): Promise<File[]> {
  const files: File[] = []
  
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry
    if (isSupportedFile(entry.name)) {
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject)
      })
      files.push(file)
    }
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry
    const reader = dirEntry.createReader()
    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    
    for (const childEntry of entries) {
      const childFiles = await scanEntry(childEntry)
      files.push(...childFiles)
    }
  }
  
  return files
}

export interface ContentClassification {
  url: string
  contentType: ContentType
  title?: string
  category?: string
}

export interface ClassificationsBackup {
  version: string
  timestamp: string
  classifications: ContentClassification[]
}

export function generateClassificationsBackup(linksWithCounts: LinkWithCount[]): Blob {
  const classifications: ContentClassification[] = linksWithCounts
    .filter(link => link.contentType && link.contentType !== 'unknown')
    .map(link => ({
      url: link.url,
      contentType: link.contentType!,
      title: link.title,
      category: link.category
    }))

  const backup: ClassificationsBackup = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    classifications
  }

  const content = JSON.stringify(backup, null, 2)
  return new Blob([content], { type: 'application/json' })
}

export function parseClassificationsBackup(content: string): Map<string, ContentType> {
  try {
    const backup: ClassificationsBackup = JSON.parse(content)
    const classificationsMap = new Map<string, ContentType>()

    if (backup.classifications && Array.isArray(backup.classifications)) {
      backup.classifications.forEach(classification => {
        if (classification.url && classification.contentType) {
          classificationsMap.set(classification.url, classification.contentType)
        }
      })
    }

    return classificationsMap
  } catch (error) {
    console.error('Failed to parse classifications backup:', error)
    return new Map()
  }
}

export function mergeClassificationsBackups(contents: string[]): Map<string, ContentType> {
  const mergedMap = new Map<string, ContentType>()
  const urlTimestamps = new Map<string, string>()

  contents.forEach(content => {
    try {
      const backup: ClassificationsBackup = JSON.parse(content)
      
      if (backup.classifications && Array.isArray(backup.classifications)) {
        backup.classifications.forEach(classification => {
          if (classification.url && classification.contentType) {
            const existingTimestamp = urlTimestamps.get(classification.url)
            
            if (!existingTimestamp || (backup.timestamp && backup.timestamp > existingTimestamp)) {
              mergedMap.set(classification.url, classification.contentType)
              if (backup.timestamp) {
                urlTimestamps.set(classification.url, backup.timestamp)
              }
            }
          }
        })
      }
    } catch (error) {
      console.error('Failed to parse one of the classification backups:', error)
    }
  })

  return mergedMap
}

export function generateMergedClassificationsBackup(classificationsMap: Map<string, ContentType>): Blob {
  const classifications: ContentClassification[] = Array.from(classificationsMap.entries()).map(([url, contentType]) => ({
    url,
    contentType
  }))

  const backup: ClassificationsBackup = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    classifications
  }

  const content = JSON.stringify(backup, null, 2)
  return new Blob([content], { type: 'application/json' })
}

export async function generateBatchDownload(result: ScanResult): Promise<Blob> {
  const JSZip = (await import('jszip')).default
  const { generateEPGSummary, generateEPGChannelsFile, generateEPGProgrammesFile, generateEPGChannelURLsFile } = await import('./epgParser')
  const zip = new JSZip()
  
  zip.file('all-links.txt', result.linksWithCounts.map(item => {
    const fileInfo = item.filePaths.length > 0 ? ` # Found in: ${item.filePaths.join(', ')}` : ''
    return `${item.url}${fileInfo}`
  }).join('\n'))
  
  zip.file('unique-links.txt', result.linksWithCounts.map(item => {
    const fileInfo = item.filePaths.length > 0 ? ` # Found in: ${item.filePaths.join(', ')}` : ''
    return `${item.url}${fileInfo}`
  }).join('\n'))
  
  if (result.duplicateCount > 0) {
    const duplicates = result.linksWithCounts.filter(item => item.count > 1)
    zip.file('duplicates.txt', duplicates.map(item => {
      const fileInfo = item.filePaths.length > 0 ? ` # Found in: ${item.filePaths.join(', ')}` : ''
      return `${item.url} (×${item.count})${fileInfo}`
    }).join('\n'))
  }
  
  const videoLinks = result.linksWithCounts.filter(item => item.mediaType === 'video')
  if (videoLinks.length > 0) {
    zip.file('video-links.txt', videoLinks.map(item => {
      const fileInfo = item.filePaths.length > 0 ? ` # Found in: ${item.filePaths.join(', ')}` : ''
      return `${item.url}${fileInfo}`
    }).join('\n'))
  }
  
  const audioLinks = result.linksWithCounts.filter(item => item.mediaType === 'audio')
  if (audioLinks.length > 0) {
    zip.file('audio-links.txt', audioLinks.map(item => {
      const fileInfo = item.filePaths.length > 0 ? ` # Found in: ${item.filePaths.join(', ')}` : ''
      return `${item.url}${fileInfo}`
    }).join('\n'))
  }

  const classificationsBlob = generateClassificationsBackup(result.linksWithCounts)
  const classificationsText = await classificationsBlob.text()
  const classificationsData = JSON.parse(classificationsText)
  if (classificationsData.classifications.length > 0) {
    zip.file('content-classifications.json', classificationsText)
  }

  if (result.epgData && (result.epgData.channelCount > 0 || result.epgData.programmeCount > 0)) {
    const epgFolder = zip.folder('EPG')
    if (epgFolder) {
      epgFolder.file('epg-summary.txt', generateEPGSummary(result.epgData))
      
      if (result.epgData.channelCount > 0) {
        const channelsBlob = generateEPGChannelsFile(result.epgData)
        const channelsText = await channelsBlob.text()
        epgFolder.file('epg-channels.txt', channelsText)
        
        const channelsWithUrls = result.epgData.channels.filter(ch => ch.url)
        if (channelsWithUrls.length > 0) {
          const channelUrlsBlob = generateEPGChannelURLsFile(result.epgData)
          const channelUrlsText = await channelUrlsBlob.text()
          epgFolder.file('epg-channel-urls.txt', channelUrlsText)
        }
      }
      
      if (result.epgData.programmeCount > 0) {
        const programmesBlob = generateEPGProgrammesFile(result.epgData)
        const programmesText = await programmesBlob.text()
        epgFolder.file('epg-programmes.txt', programmesText)
      }
    }
  }

  if (result.configFiles && result.configFiles.length > 0) {
    const configFolder = zip.folder('ConfigFiles')
    if (configFolder) {
      result.configFiles.forEach(file => {
        const sanitizedPath = file.path.replace(/[<>:"|?*]/g, '_')
        configFolder.file(sanitizedPath, file.content)
      })
      
      const configSummary = `Extracted Configuration Files
${'='.repeat(40)}

Total Files: ${result.configFiles.length}

Files by Type:
${Array.from(
  result.configFiles.reduce((acc, file) => {
    acc.set(file.type, (acc.get(file.type) || 0) + 1)
    return acc
  }, new Map<string, number>())
).map(([type, count]) => `- ${type.toUpperCase()}: ${count}`).join('\n')}

File List:
${result.configFiles.map((file, i) => 
  `${i + 1}. ${file.path} (${file.size} bytes, ${file.type})`
).join('\n')}
`
      configFolder.file('README.txt', configSummary)
    }
  }
  
  zip.file('summary.txt', 
    `Media Link Scanner - Scan Summary
==================================

Files Processed: ${result.fileCount}
Total Links Found: ${result.linkCount}
Unique Links: ${result.uniqueLinkCount}
Duplicate Occurrences: ${result.duplicateCount}

Media Type Breakdown:
- Video Links: ${result.videoCount}
- Audio Links: ${result.audioCount}
- Unknown Type: ${result.uniqueLinkCount - result.videoCount - result.audioCount}

Content Type Classifications:
- Movies: ${result.movieCount}
- TV Series: ${result.tvSeriesCount}
- Live TV: ${result.liveTvCount}
${result.epgData ? `
EPG Data:
- Channels: ${result.epgData.channelCount}
- Programmes: ${result.epgData.programmeCount}
` : ''}${result.configFiles && result.configFiles.length > 0 ? `
Configuration Files Extracted:
- Total Config Files: ${result.configFiles.length}
- From Android Packages (APK/AAB/etc.)
` : ''}
Files included in this archive:
- all-links.txt: All ${result.linkCount} links found (with file paths)
- unique-links.txt: ${result.uniqueLinkCount} unique links only (with file paths)
${result.duplicateCount > 0 ? `- duplicates.txt: ${result.duplicateCount} duplicate occurrences with counts and file paths\n` : ''}${videoLinks.length > 0 ? `- video-links.txt: ${result.videoCount} video links (with file paths)\n` : ''}${audioLinks.length > 0 ? `- audio-links.txt: ${result.audioCount} audio links (with file paths)\n` : ''}${classificationsData.classifications.length > 0 ? `- content-classifications.json: ${classificationsData.classifications.length} content type classifications (for backup/restore)\n` : ''}${result.epgData && (result.epgData.channelCount > 0 || result.epgData.programmeCount > 0) ? `- EPG/ folder: Electronic Program Guide data\n` : ''}${result.configFiles && result.configFiles.length > 0 ? `- ConfigFiles/ folder: ${result.configFiles.length} configuration files extracted from packages\n` : ''}
Note: File paths are included as comments after each link (# Found in: ...)

Generated: ${new Date().toLocaleString()}
`
  )
  
  return await zip.generateAsync({ type: 'blob' })
}

export async function scanWebUrls(
  urls: string[], 
  onProgress?: (current: number, total: number) => void
): Promise<{ url: string; links: string[]; error?: string }[]> {
  const results: { url: string; links: string[]; error?: string }[] = []
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i].trim()
    if (!url) continue
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(30000)
      })
      
      if (!response.ok) {
        results.push({
          url,
          links: [],
          error: `HTTP ${response.status}: ${response.statusText}`
        })
        continue
      }
      
      const contentType = response.headers.get('content-type') || ''
      const text = await response.text()
      
      const extractedLinks = extractLinks(text)
      
      results.push({
        url,
        links: extractedLinks
      })
      
    } catch (error) {
      results.push({
        url,
        links: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    if (onProgress) {
      onProgress(i + 1, urls.length)
    }
  }
  
  return results
}

export interface PlaylistAuthCredentials {
  username?: string
  password?: string
  apiKey?: string
  token?: string
}

export interface XtreamCodesCredentials {
  serverUrl: string
  username: string
  password: string
}

export interface XtreamCodesCategory {
  category_id: string
  category_name: string
  parent_id: number
}

export interface XtreamCodesStream {
  num: number
  name: string
  stream_type: string
  stream_id: number
  series_id?: number
  stream_icon: string
  epg_channel_id: string
  added: string
  category_id: string
  custom_sid: string
  tv_archive: number
  direct_source: string
  tv_archive_duration: number
  container_extension?: string
}

export interface XtreamCodesScanResult {
  serverUrl: string
  success: boolean
  error?: string
  liveStreams: XtreamCodesStream[]
  vodStreams: XtreamCodesStream[]
  series: XtreamCodesStream[]
  liveCategories: XtreamCodesCategory[]
  vodCategories: XtreamCodesCategory[]
  seriesCategories: XtreamCodesCategory[]
  totalStreams: number
  serverInfo?: {
    url: string
    port: string
    https_port: string
    server_protocol: string
    rtmp_port: string
    timestamp_now: number
    time_now: string
  }
  userInfo?: {
    username: string
    password: string
    message: string
    auth: number
    status: string
    exp_date: string
    is_trial: string
    active_cons: string
    created_at: string
    max_connections: string
    allowed_output_formats: string[]
  }
}

export interface PlaylistScanResult {
  url: string
  links: string[]
  linksWithMetadata: M3UEntry[]
  epgData?: EPGData
  error?: string
  contentType?: string
  totalLinks: number
  videoLinks: number
  audioLinks: number
  requiresAuth?: boolean
}

function buildAuthHeaders(credentials?: PlaylistAuthCredentials): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': '*/*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
  
  if (credentials) {
    if (credentials.username && credentials.password) {
      const basicAuth = btoa(`${credentials.username}:${credentials.password}`)
      headers['Authorization'] = `Basic ${basicAuth}`
    } else if (credentials.token) {
      headers['Authorization'] = `Bearer ${credentials.token}`
    } else if (credentials.apiKey) {
      headers['X-API-Key'] = credentials.apiKey
    }
  }
  
  return headers
}

function buildAuthUrl(url: string, credentials?: PlaylistAuthCredentials): string {
  if (!credentials || (!credentials.username && !credentials.apiKey)) {
    return url
  }
  
  try {
    const urlObj = new URL(url)
    
    if (credentials.username && credentials.password) {
      urlObj.username = credentials.username
      urlObj.password = credentials.password
    } else if (credentials.apiKey) {
      urlObj.searchParams.set('api_key', credentials.apiKey)
    }
    
    return urlObj.toString()
  } catch (error) {
    return url
  }
}

export async function scanPlaylistUrls(
  urls: string[],
  onProgress?: (current: number, total: number) => void,
  authCredentials?: Map<string, PlaylistAuthCredentials>
): Promise<PlaylistScanResult[]> {
  const results: PlaylistScanResult[] = []
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i].trim()
    if (!url) continue
    
    const credentials = authCredentials?.get(url)
    
    try {
      const authUrl = buildAuthUrl(url, credentials)
      const headers = buildAuthHeaders(credentials)
      
      const response = await fetch(authUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(60000)
      })
      
      if (response.status === 401 || response.status === 403) {
        results.push({
          url,
          links: [],
          linksWithMetadata: [],
          error: `Authentication required: ${response.status} ${response.statusText}`,
          totalLinks: 0,
          videoLinks: 0,
          audioLinks: 0,
          requiresAuth: true
        })
        continue
      }
      
      if (!response.ok) {
        results.push({
          url,
          links: [],
          linksWithMetadata: [],
          error: `HTTP ${response.status}: ${response.statusText}`,
          totalLinks: 0,
          videoLinks: 0,
          audioLinks: 0
        })
        continue
      }
      
      const contentType = response.headers.get('content-type') || ''
      const text = await response.text()
      
      const { parseEPG } = await import('./epgParser')
      const epgData = parseEPG(text)
      
      const linksWithMetadata = parseM3UWithMetadata(text)
      const extractedLinks = extractLinks(text)
      
      const allLinks = [...new Set([
        ...linksWithMetadata.map(entry => entry.url),
        ...extractedLinks,
        ...(epgData?.channels.filter(ch => ch.url).map(ch => ch.url!) || [])
      ])]
      
      const videoLinks = allLinks.filter(link => getMediaType(link) === 'video').length
      const audioLinks = allLinks.filter(link => getMediaType(link) === 'audio').length
      
      results.push({
        url,
        links: allLinks,
        linksWithMetadata,
        epgData: epgData || undefined,
        contentType,
        totalLinks: allLinks.length,
        videoLinks,
        audioLinks,
        requiresAuth: false
      })
      
    } catch (error) {
      results.push({
        url,
        links: [],
        linksWithMetadata: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        totalLinks: 0,
        videoLinks: 0,
        audioLinks: 0
      })
    }
    
    if (onProgress) {
      onProgress(i + 1, urls.length)
    }
  }
  
  return results
}


export async function scanXtreamCodesAPI(
  credentials: XtreamCodesCredentials,
  onProgress?: (stage: string, current: number, total: number) => void
): Promise<XtreamCodesScanResult> {
  const { serverUrl, username, password } = credentials
  
  const normalizedUrl = serverUrl.trim().replace(/\/+$/, '')
  
  const result: XtreamCodesScanResult = {
    serverUrl: normalizedUrl,
    success: false,
    liveStreams: [],
    vodStreams: [],
    series: [],
    liveCategories: [],
    vodCategories: [],
    seriesCategories: [],
    totalStreams: 0
  }
  
  try {
    onProgress?.('Authenticating', 0, 4)
    
    const authUrl = `${normalizedUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
    
    const authResponse = await fetch(authUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(30000)
    })
    
    if (!authResponse.ok) {
      result.error = `Authentication failed: ${authResponse.status} ${authResponse.statusText}`
      return result
    }
    
    const authData = await authResponse.json()
    
    if (authData.user_info) {
      result.userInfo = authData.user_info
      result.serverInfo = authData.server_info
      
      if (authData.user_info.auth !== 1) {
        result.error = 'Authentication failed: Invalid credentials or account not active'
        return result
      }
    }
    
    onProgress?.('Fetching live categories', 1, 4)
    const liveCategoriesUrl = `${normalizedUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_categories`
    const liveCategoriesResponse = await fetch(liveCategoriesUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30000)
    })
    
    if (liveCategoriesResponse.ok) {
      result.liveCategories = await liveCategoriesResponse.json()
    }
    
    onProgress?.('Fetching live streams', 1, 4)
    const liveStreamsUrl = `${normalizedUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`
    const liveStreamsResponse = await fetch(liveStreamsUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(60000)
    })
    
    if (liveStreamsResponse.ok) {
      result.liveStreams = await liveStreamsResponse.json()
    }
    
    onProgress?.('Fetching VOD categories', 2, 4)
    const vodCategoriesUrl = `${normalizedUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_vod_categories`
    const vodCategoriesResponse = await fetch(vodCategoriesUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30000)
    })
    
    if (vodCategoriesResponse.ok) {
      result.vodCategories = await vodCategoriesResponse.json()
    }
    
    onProgress?.('Fetching VOD streams', 2, 4)
    const vodStreamsUrl = `${normalizedUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_vod_streams`
    const vodStreamsResponse = await fetch(vodStreamsUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(60000)
    })
    
    if (vodStreamsResponse.ok) {
      result.vodStreams = await vodStreamsResponse.json()
    }
    
    onProgress?.('Fetching series categories', 3, 4)
    const seriesCategoriesUrl = `${normalizedUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series_categories`
    const seriesCategoriesResponse = await fetch(seriesCategoriesUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30000)
    })
    
    if (seriesCategoriesResponse.ok) {
      result.seriesCategories = await seriesCategoriesResponse.json()
    }
    
    onProgress?.('Fetching series', 3, 4)
    const seriesUrl = `${normalizedUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_series`
    const seriesResponse = await fetch(seriesUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(60000)
    })
    
    if (seriesResponse.ok) {
      result.series = await seriesResponse.json()
    }
    
    onProgress?.('Complete', 4, 4)
    
    result.totalStreams = result.liveStreams.length + result.vodStreams.length + result.series.length
    result.success = true
    
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error occurred'
  }
  
  return result
}

export function convertXtreamCodesToLinks(
  scanResult: XtreamCodesScanResult
): { url: string; title: string; category: string; mediaType: 'video' | 'audio' | 'unknown'; contentType: ContentType }[] {
  const links: { url: string; title: string; category: string; mediaType: 'video' | 'audio' | 'unknown'; contentType: ContentType }[] = []
  const { serverUrl, liveStreams, vodStreams, series, liveCategories, vodCategories, seriesCategories } = scanResult
  
  if (!scanResult.success || !scanResult.userInfo) {
    return links
  }
  
  const username = scanResult.userInfo.username
  const password = scanResult.userInfo.password
  
  const getCategoryName = (categoryId: string, categories: XtreamCodesCategory[]): string => {
    const category = categories.find(cat => cat.category_id === categoryId)
    return category?.category_name || 'Uncategorized'
  }
  
  liveStreams.forEach(stream => {
    const extension = stream.container_extension || 'ts'
    const streamUrl = `${serverUrl}/live/${username}/${password}/${stream.stream_id}.${extension}`
    links.push({
      url: streamUrl,
      title: stream.name,
      category: getCategoryName(stream.category_id, liveCategories),
      mediaType: 'video',
      contentType: 'live-tv'
    })
  })
  
  vodStreams.forEach(stream => {
    const extension = stream.container_extension || 'mp4'
    const streamUrl = `${serverUrl}/movie/${username}/${password}/${stream.stream_id}.${extension}`
    links.push({
      url: streamUrl,
      title: stream.name,
      category: getCategoryName(stream.category_id, vodCategories),
      mediaType: 'video',
      contentType: stream.stream_type === 'movie' ? 'movie' : 'vod'
    })
  })
  
  series.forEach(show => {
    const streamUrl = `${serverUrl}/series/${username}/${password}/${show.series_id}`
    links.push({
      url: streamUrl,
      title: show.name,
      category: getCategoryName(show.category_id, seriesCategories),
      mediaType: 'video',
      contentType: 'tv-series'
    })
  })
  
  return links
}

export interface RepositoryScanResult {
  url: string
  repoName: string
  owner: string
  platform: 'github' | 'gitlab' | 'bitbucket' | 'gitea' | 'codeberg' | 'sourcehut' | 'unknown'
  links: string[]
  error?: string
  filesScanned: number
  totalLinks: number
  videoLinks: number
  audioLinks: number
  configFiles: ConfigFile[]
}

export interface ZipFileScanResult {
  fileName: string
  links: string[]
  error?: string
  filesScanned: number
  totalLinks: number
  videoLinks: number
  audioLinks: number
  configFiles: ConfigFile[]
  linksWithMetadata: M3UEntry[]
}

function detectGitPlatform(url: string): 'github' | 'gitlab' | 'bitbucket' | 'gitea' | 'codeberg' | 'sourcehut' | 'unknown' {
  const urlLower = url.toLowerCase()
  if (urlLower.includes('github.com')) return 'github'
  if (urlLower.includes('gitlab.com') || urlLower.includes('gitlab.')) return 'gitlab'
  if (urlLower.includes('bitbucket.org')) return 'bitbucket'
  if (urlLower.includes('gitea.io') || urlLower.includes('gitea.')) return 'gitea'
  if (urlLower.includes('codeberg.org')) return 'codeberg'
  if (urlLower.includes('git.sr.ht') || urlLower.includes('sr.ht')) return 'sourcehut'
  return 'unknown'
}

export async function scanGitRepository(
  repoUrl: string,
  onProgress?: (current: number, total: number) => void
): Promise<RepositoryScanResult> {
  const platform = detectGitPlatform(repoUrl)
  
  switch (platform) {
    case 'github':
      return scanGitHubRepository(repoUrl, onProgress)
    case 'gitlab':
      return scanGitLabRepository(repoUrl, onProgress)
    case 'bitbucket':
      return scanBitbucketRepository(repoUrl, onProgress)
    case 'gitea':
    case 'codeberg':
      return scanGiteaRepository(repoUrl, onProgress)
    default:
      return {
        url: repoUrl,
        repoName: '',
        owner: '',
        platform: 'unknown',
        links: [],
        error: 'Unsupported Git hosting platform. Supported: GitHub, GitLab, Bitbucket, Gitea, Codeberg',
        filesScanned: 0,
        totalLinks: 0,
        videoLinks: 0,
        audioLinks: 0,
        configFiles: []
      }
  }
}

async function scanGitHubRepository(
  repoUrl: string,
  onProgress?: (current: number, total: number) => void
): Promise<RepositoryScanResult> {
  const result: RepositoryScanResult = {
    url: repoUrl,
    repoName: '',
    owner: '',
    platform: 'github',
    links: [],
    filesScanned: 0,
    totalLinks: 0,
    videoLinks: 0,
    audioLinks: 0,
    configFiles: []
  }

  try {
    const repoMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/)
    if (!repoMatch) {
      result.error = 'Invalid GitHub repository URL'
      return result
    }

    const owner = repoMatch[1]
    const repo = repoMatch[2].replace(/\.git$/, '')
    result.owner = owner
    result.repoName = repo

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Media-Link-Scanner'
      },
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      const fallbackUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`
      const fallbackResponse = await fetch(fallbackUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Media-Link-Scanner'
        },
        signal: AbortSignal.timeout(30000)
      })

      if (!fallbackResponse.ok) {
        result.error = `Failed to fetch repository: ${response.status} ${response.statusText}`
        return result
      }

      const data = await fallbackResponse.json()
      await processGitHubRepoTree(data, owner, repo, 'master', result, onProgress)
    } else {
      const data = await response.json()
      await processGitHubRepoTree(data, owner, repo, 'main', result, onProgress)
    }

    const allLinks = new Set(result.links)
    result.totalLinks = allLinks.size
    result.videoLinks = Array.from(allLinks).filter(link => getMediaType(link) === 'video').length
    result.audioLinks = Array.from(allLinks).filter(link => getMediaType(link) === 'audio').length

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error'
  }

  return result
}

async function processGitHubRepoTree(
  treeData: any,
  owner: string,
  repo: string,
  branch: string,
  result: RepositoryScanResult,
  onProgress?: (current: number, total: number) => void
) {
  const files = treeData.tree.filter((item: any) =>
    item.type === 'blob' && isSupportedFile(item.path)
  )

  const total = files.length
  result.filesScanned = total

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`
      const fileResponse = await fetch(rawUrl, {
        signal: AbortSignal.timeout(15000)
      })

      if (fileResponse.ok) {
        const content = await fileResponse.text()
        const extractedLinks = extractLinks(content)
        result.links.push(...extractedLinks)

        if (isConfigFile(file.path)) {
          result.configFiles.push({
            path: file.path,
            name: file.path.split('/').pop() || file.path,
            content,
            size: content.length,
            type: getConfigFileType(file.path)
          })
        }
      }
    } catch (error) {
      console.debug(`Failed to fetch file ${file.path}:`, error)
    }

    if (onProgress) {
      onProgress(i + 1, total)
    }
  }
}

async function scanGitLabRepository(
  repoUrl: string,
  onProgress?: (current: number, total: number) => void
): Promise<RepositoryScanResult> {
  const result: RepositoryScanResult = {
    url: repoUrl,
    repoName: '',
    owner: '',
    platform: 'gitlab',
    links: [],
    filesScanned: 0,
    totalLinks: 0,
    videoLinks: 0,
    audioLinks: 0,
    configFiles: []
  }

  try {
    const repoMatch = repoUrl.match(/gitlab\.[^\/]+\/([^\/]+)\/([^\/\?#]+)/) || 
                      repoUrl.match(/^https?:\/\/([^\/]+)\/([^\/]+)\/([^\/\?#]+)/)
    
    if (!repoMatch) {
      result.error = 'Invalid GitLab repository URL'
      return result
    }

    let domain = 'gitlab.com'
    let owner: string
    let repo: string

    if (repoUrl.includes('gitlab.com')) {
      owner = repoMatch[1]
      repo = repoMatch[2].replace(/\.git$/, '')
    } else {
      domain = repoMatch[1]
      owner = repoMatch[2]
      repo = repoMatch[3].replace(/\.git$/, '')
    }

    result.owner = owner
    result.repoName = repo

    const projectPath = encodeURIComponent(`${owner}/${repo}`)
    const apiUrl = `https://${domain}/api/v4/projects/${projectPath}/repository/tree?recursive=true&per_page=100`
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Media-Link-Scanner'
      },
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      result.error = `Failed to fetch repository: ${response.status} ${response.statusText}`
      return result
    }

    const treeData = await response.json()
    await processGitLabRepoTree(treeData, domain, owner, repo, result, onProgress)

    const allLinks = new Set(result.links)
    result.totalLinks = allLinks.size
    result.videoLinks = Array.from(allLinks).filter(link => getMediaType(link) === 'video').length
    result.audioLinks = Array.from(allLinks).filter(link => getMediaType(link) === 'audio').length

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error'
  }

  return result
}

async function processGitLabRepoTree(
  treeData: any[],
  domain: string,
  owner: string,
  repo: string,
  result: RepositoryScanResult,
  onProgress?: (current: number, total: number) => void
) {
  const files = treeData.filter((item: any) =>
    item.type === 'blob' && isSupportedFile(item.path)
  )

  const total = files.length
  result.filesScanned = total

  const projectPath = encodeURIComponent(`${owner}/${repo}`)

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    try {
      const encodedPath = encodeURIComponent(file.path)
      const fileUrl = `https://${domain}/api/v4/projects/${projectPath}/repository/files/${encodedPath}/raw?ref=main`
      
      let fileResponse = await fetch(fileUrl, {
        headers: {
          'User-Agent': 'Media-Link-Scanner'
        },
        signal: AbortSignal.timeout(15000)
      })

      if (!fileResponse.ok) {
        const masterUrl = `https://${domain}/api/v4/projects/${projectPath}/repository/files/${encodedPath}/raw?ref=master`
        fileResponse = await fetch(masterUrl, {
          headers: {
            'User-Agent': 'Media-Link-Scanner'
          },
          signal: AbortSignal.timeout(15000)
        })
      }

      if (fileResponse.ok) {
        const content = await fileResponse.text()
        const extractedLinks = extractLinks(content)
        result.links.push(...extractedLinks)

        if (isConfigFile(file.path)) {
          result.configFiles.push({
            path: file.path,
            name: file.path.split('/').pop() || file.path,
            content,
            size: content.length,
            type: getConfigFileType(file.path)
          })
        }
      }
    } catch (error) {
      console.debug(`Failed to fetch file ${file.path}:`, error)
    }

    if (onProgress) {
      onProgress(i + 1, total)
    }
  }
}

async function scanBitbucketRepository(
  repoUrl: string,
  onProgress?: (current: number, total: number) => void
): Promise<RepositoryScanResult> {
  const result: RepositoryScanResult = {
    url: repoUrl,
    repoName: '',
    owner: '',
    platform: 'bitbucket',
    links: [],
    filesScanned: 0,
    totalLinks: 0,
    videoLinks: 0,
    audioLinks: 0,
    configFiles: []
  }

  try {
    const repoMatch = repoUrl.match(/bitbucket\.org\/([^\/]+)\/([^\/\?#]+)/)
    if (!repoMatch) {
      result.error = 'Invalid Bitbucket repository URL'
      return result
    }

    const owner = repoMatch[1]
    const repo = repoMatch[2].replace(/\.git$/, '')
    result.owner = owner
    result.repoName = repo

    const apiUrl = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src`
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Media-Link-Scanner'
      },
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      result.error = `Failed to fetch repository: ${response.status} ${response.statusText}`
      return result
    }

    const data = await response.json()
    await processBitbucketRepoTree(data, owner, repo, result, onProgress)

    const allLinks = new Set(result.links)
    result.totalLinks = allLinks.size
    result.videoLinks = Array.from(allLinks).filter(link => getMediaType(link) === 'video').length
    result.audioLinks = Array.from(allLinks).filter(link => getMediaType(link) === 'audio').length

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error'
  }

  return result
}

async function processBitbucketRepoTree(
  data: any,
  owner: string,
  repo: string,
  result: RepositoryScanResult,
  onProgress?: (current: number, total: number) => void
) {
  const files: any[] = []
  
  async function collectFiles(url: string) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Media-Link-Scanner'
      },
      signal: AbortSignal.timeout(15000)
    })
    
    if (response.ok) {
      const data = await response.json()
      
      for (const item of data.values || []) {
        if (item.type === 'commit_file' && isSupportedFile(item.path)) {
          files.push(item)
        } else if (item.type === 'commit_directory') {
          try {
            await collectFiles(item.links.self.href)
          } catch (error) {
            console.debug(`Failed to scan directory ${item.path}:`, error)
          }
        }
      }
      
      if (data.next) {
        await collectFiles(data.next)
      }
    }
  }
  
  await collectFiles(`https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src`)

  const total = files.length
  result.filesScanned = total

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    try {
      const fileUrl = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src/master/${file.path}`
      const fileResponse = await fetch(fileUrl, {
        headers: {
          'User-Agent': 'Media-Link-Scanner'
        },
        signal: AbortSignal.timeout(15000)
      })

      if (fileResponse.ok) {
        const content = await fileResponse.text()
        const extractedLinks = extractLinks(content)
        result.links.push(...extractedLinks)

        if (isConfigFile(file.path)) {
          result.configFiles.push({
            path: file.path,
            name: file.path.split('/').pop() || file.path,
            content,
            size: content.length,
            type: getConfigFileType(file.path)
          })
        }
      }
    } catch (error) {
      console.debug(`Failed to fetch file ${file.path}:`, error)
    }

    if (onProgress) {
      onProgress(i + 1, total)
    }
  }
}

async function scanGiteaRepository(
  repoUrl: string,
  onProgress?: (current: number, total: number) => void
): Promise<RepositoryScanResult> {
  const result: RepositoryScanResult = {
    url: repoUrl,
    repoName: '',
    owner: '',
    platform: repoUrl.includes('codeberg.org') ? 'codeberg' : 'gitea',
    links: [],
    filesScanned: 0,
    totalLinks: 0,
    videoLinks: 0,
    audioLinks: 0,
    configFiles: []
  }

  try {
    const repoMatch = repoUrl.match(/(?:gitea\.[^\/]+|codeberg\.org)\/([^\/]+)\/([^\/\?#]+)/) ||
                      repoUrl.match(/^https?:\/\/([^\/]+)\/([^\/]+)\/([^\/\?#]+)/)
    
    if (!repoMatch) {
      result.error = 'Invalid Gitea/Codeberg repository URL'
      return result
    }

    let domain: string
    let owner: string
    let repo: string

    if (repoUrl.includes('codeberg.org')) {
      domain = 'codeberg.org'
      owner = repoMatch[1]
      repo = repoMatch[2].replace(/\.git$/, '')
    } else if (repoUrl.includes('gitea.')) {
      domain = repoUrl.match(/(?:https?:\/\/)?([^\/]+)/)?.[1] || 'gitea.io'
      owner = repoMatch[1]
      repo = repoMatch[2].replace(/\.git$/, '')
    } else {
      domain = repoMatch[1]
      owner = repoMatch[2]
      repo = repoMatch[3].replace(/\.git$/, '')
    }

    result.owner = owner
    result.repoName = repo

    const apiUrl = `https://${domain}/api/v1/repos/${owner}/${repo}/git/trees/main?recursive=true`
    let response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Media-Link-Scanner'
      },
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      const masterUrl = `https://${domain}/api/v1/repos/${owner}/${repo}/git/trees/master?recursive=true`
      response = await fetch(masterUrl, {
        headers: {
          'User-Agent': 'Media-Link-Scanner'
        },
        signal: AbortSignal.timeout(30000)
      })

      if (!response.ok) {
        result.error = `Failed to fetch repository: ${response.status} ${response.statusText}`
        return result
      }
    }

    const treeData = await response.json()
    const branch = response.url.includes('/main?') ? 'main' : 'master'
    await processGiteaRepoTree(treeData, domain, owner, repo, branch, result, onProgress)

    const allLinks = new Set(result.links)
    result.totalLinks = allLinks.size
    result.videoLinks = Array.from(allLinks).filter(link => getMediaType(link) === 'video').length
    result.audioLinks = Array.from(allLinks).filter(link => getMediaType(link) === 'audio').length

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error'
  }

  return result
}

async function processGiteaRepoTree(
  treeData: any,
  domain: string,
  owner: string,
  repo: string,
  branch: string,
  result: RepositoryScanResult,
  onProgress?: (current: number, total: number) => void
) {
  const files = treeData.tree?.filter((item: any) =>
    item.type === 'blob' && isSupportedFile(item.path)
  ) || []

  const total = files.length
  result.filesScanned = total

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    try {
      const rawUrl = `https://${domain}/${owner}/${repo}/raw/branch/${branch}/${file.path}`
      const fileResponse = await fetch(rawUrl, {
        headers: {
          'User-Agent': 'Media-Link-Scanner'
        },
        signal: AbortSignal.timeout(15000)
      })

      if (fileResponse.ok) {
        const content = await fileResponse.text()
        const extractedLinks = extractLinks(content)
        result.links.push(...extractedLinks)

        if (isConfigFile(file.path)) {
          result.configFiles.push({
            path: file.path,
            name: file.path.split('/').pop() || file.path,
            content,
            size: content.length,
            type: getConfigFileType(file.path)
          })
        }
      }
    } catch (error) {
      console.debug(`Failed to fetch file ${file.path}:`, error)
    }

    if (onProgress) {
      onProgress(i + 1, total)
    }
  }
}

function isConfigFile(path: string): boolean {
  const configExtensions = ['json', 'xml', 'properties', 'ini', 'conf', 'cfg', 'm3u', 'm3u8', 'txt', 'yml', 'yaml', 'toml', 'env']
  const fileName = path.toLowerCase()
  return configExtensions.some(ext => fileName.endsWith(`.${ext}`)) ||
    fileName.includes('config') ||
    fileName.includes('settings') ||
    fileName === '.env' ||
    fileName === 'dockerfile'
}

export function parseKodiFile(content: string, fileName: string): string[] {
  const links: string[] = []
  const lowerFileName = fileName.toLowerCase()
  
  if (lowerFileName.endsWith('.strm')) {
    const trimmed = content.trim()
    if (isValidMediaUrl(trimmed)) {
      links.push(trimmed)
    }
  }
  
  else if (lowerFileName.endsWith('.xsp')) {
    const matches = content.match(/<path>(.*?)<\/path>/gi) || []
    matches.forEach(match => {
      const url = match.replace(/<\/?path>/gi, '').trim()
      if (isValidMediaUrl(url)) {
        links.push(url)
      }
    })
  }
  
  else if (lowerFileName.endsWith('.nfo')) {
    const urlMatches = content.match(/(https?|rtsp|rtmps?):\/\/[^\s<>"{}|\\^`\[\]]+/gi) || []
    urlMatches.forEach(url => {
      if (isValidMediaUrl(url)) {
        links.push(url)
      }
    })
  }
  
  else if (lowerFileName === 'addon.xml' || lowerFileName.includes('addon')) {
    const urlMatches = content.match(/(https?|rtsp|rtmps?):\/\/[^\s<>"{}|\\^`\[\]]+/gi) || []
    urlMatches.forEach(url => {
      if (isValidMediaUrl(url) || url.includes('api') || url.includes('stream') || url.includes('media')) {
        links.push(url)
      }
    })
  }
  
  else if (lowerFileName.endsWith('.py')) {
    const stringMatches = content.match(/['"]((https?|rtsp|rtmps?|mms|mmsh|rtp|udp):\/\/[^'"]+)['"]/gi) || []
    stringMatches.forEach(match => {
      const url = match.replace(/['"]/g, '')
      if (isValidMediaUrl(url)) {
        links.push(url)
      }
    })
    
    const variableMatches = content.match(/url\s*=\s*['"]([^'"]+)['"]/gi) || []
    variableMatches.forEach(match => {
      const url = match.replace(/url\s*=\s*['"]|['"]/gi, '')
      if (url.startsWith('http') || url.startsWith('rtsp') || url.startsWith('rtmp')) {
        if (isValidMediaUrl(url)) {
          links.push(url)
        }
      }
    })
  }
  
  else if (lowerFileName === 'sources.xml' || lowerFileName === 'favourites.xml') {
    const pathMatches = content.match(/<(?:path|thumb)>(.*?)<\/(?:path|thumb)>/gi) || []
    pathMatches.forEach(match => {
      const url = match.replace(/<\/?(?:path|thumb)>/gi, '').trim()
      if (isValidMediaUrl(url)) {
        links.push(url)
      }
    })
  }
  
  else if (lowerFileName === 'advancedsettings.xml' || lowerFileName === 'playercorefactory.xml') {
    const urlMatches = content.match(/(https?|rtsp|rtmps?|mms|mmsh):\/\/[^\s<>"{}|\\^`\[\]]+/gi) || []
    urlMatches.forEach(url => {
      if (isValidMediaUrl(url)) {
        links.push(url)
      }
    })
  }
  
  return [...new Set(links)]
}

async function scanArchiveAsZip(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ZipFileScanResult> {
  const result: ZipFileScanResult = {
    fileName: file.name,
    links: [],
    filesScanned: 0,
    totalLinks: 0,
    videoLinks: 0,
    audioLinks: 0,
    configFiles: [],
    linksWithMetadata: []
  }

  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(file)

    const supportedFiles = Object.keys(zip.files).filter(path =>
      !path.endsWith('/') && isSupportedFile(path)
    )

    result.filesScanned = supportedFiles.length

    for (let i = 0; i < supportedFiles.length; i++) {
      const filePath = supportedFiles[i]
      const zipFile = zip.file(filePath)

      if (zipFile) {
        try {
          const content = await zipFile.async('text')
          const extractedLinks = extractLinks(content)
          result.links.push(...extractedLinks)

          const m3uEntries = parseM3UWithMetadata(content)
          result.linksWithMetadata.push(...m3uEntries)

          if (isConfigFile(filePath)) {
            result.configFiles.push({
              path: filePath,
              name: filePath.split('/').pop() || filePath,
              content,
              size: content.length,
              type: getConfigFileType(filePath)
            })
          }
        } catch (error) {
          console.debug(`Failed to read file ${filePath}:`, error)
        }
      }

      if (onProgress) {
        onProgress(i + 1, supportedFiles.length)
      }
    }

    const allLinks = new Set(result.links)
    result.totalLinks = allLinks.size
    result.videoLinks = Array.from(allLinks).filter(link => getMediaType(link) === 'video').length
    result.audioLinks = Array.from(allLinks).filter(link => getMediaType(link) === 'audio').length

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error'
  }

  return result
}

async function scanRarFile(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ZipFileScanResult> {
  const result: ZipFileScanResult = {
    fileName: file.name,
    links: [],
    filesScanned: 0,
    totalLinks: 0,
    videoLinks: 0,
    audioLinks: 0,
    configFiles: [],
    linksWithMetadata: []
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    const textContent = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array)
    
    const extractedLinks = extractLinks(textContent)
    result.links.push(...extractedLinks)
    
    const m3uEntries = parseM3UWithMetadata(textContent)
    result.linksWithMetadata.push(...m3uEntries)
    
    result.filesScanned = 1
    
    const allLinks = new Set(result.links)
    result.totalLinks = allLinks.size
    result.videoLinks = Array.from(allLinks).filter(link => getMediaType(link) === 'video').length
    result.audioLinks = Array.from(allLinks).filter(link => getMediaType(link) === 'audio').length

    if (onProgress) {
      onProgress(1, 1)
    }

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'RAR format requires extraction - scanning for embedded text data'
  }

  return result
}

async function scanTarFile(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ZipFileScanResult> {
  const result: ZipFileScanResult = {
    fileName: file.name,
    links: [],
    filesScanned: 0,
    totalLinks: 0,
    videoLinks: 0,
    audioLinks: 0,
    configFiles: [],
    linksWithMetadata: []
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    const isGzipped = uint8Array[0] === 0x1f && uint8Array[1] === 0x8b
    
    let tarData: Uint8Array
    
    if (isGzipped) {
      const JSZip = (await import('jszip')).default
      const decompressed = await JSZip.loadAsync(arrayBuffer)
      const files = Object.keys(decompressed.files)
      
      if (files.length > 0) {
        const firstFile = decompressed.file(files[0])
        if (firstFile) {
          const content = await firstFile.async('uint8array')
          tarData = content
        } else {
          tarData = uint8Array
        }
      } else {
        tarData = uint8Array
      }
    } else {
      tarData = uint8Array
    }
    
    let offset = 0
    let filesProcessed = 0
    const maxFiles = 1000
    
    while (offset < tarData.length - 512 && filesProcessed < maxFiles) {
      const header = tarData.slice(offset, offset + 512)
      
      const fileName = new TextDecoder().decode(header.slice(0, 100)).replace(/\0.*$/, '')
      
      if (!fileName) {
        offset += 512
        continue
      }
      
      const fileSizeStr = new TextDecoder().decode(header.slice(124, 136)).replace(/\0.*$/, '').trim()
      const fileSize = parseInt(fileSizeStr, 8) || 0
      
      const fileType = String.fromCharCode(header[156])
      
      offset += 512
      
      if (fileType === '0' || fileType === '\0') {
        if (isSupportedFile(fileName) && fileSize > 0 && fileSize < 10 * 1024 * 1024) {
          try {
            const fileContent = tarData.slice(offset, offset + fileSize)
            const textContent = new TextDecoder('utf-8', { fatal: false }).decode(fileContent)
            
            const extractedLinks = extractLinks(textContent)
            result.links.push(...extractedLinks)
            
            const m3uEntries = parseM3UWithMetadata(textContent)
            result.linksWithMetadata.push(...m3uEntries)
            
            if (isConfigFile(fileName)) {
              result.configFiles.push({
                path: fileName,
                name: fileName.split('/').pop() || fileName,
                content: textContent,
                size: fileSize,
                type: getConfigFileType(fileName)
              })
            }
            
            filesProcessed++
          } catch (error) {
            console.debug(`Failed to read file ${fileName}:`, error)
          }
        }
      }
      
      const paddedSize = Math.ceil(fileSize / 512) * 512
      offset += paddedSize
      
      if (onProgress && filesProcessed % 10 === 0) {
        onProgress(filesProcessed, Math.min(maxFiles, 100))
      }
    }
    
    result.filesScanned = filesProcessed
    
    const allLinks = new Set(result.links)
    result.totalLinks = allLinks.size
    result.videoLinks = Array.from(allLinks).filter(link => getMediaType(link) === 'video').length
    result.audioLinks = Array.from(allLinks).filter(link => getMediaType(link) === 'audio').length

    if (onProgress) {
      onProgress(1, 1)
    }

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error processing TAR file'
  }

  return result
}

async function scanExeFile(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ZipFileScanResult> {
  const result: ZipFileScanResult = {
    fileName: file.name,
    links: [],
    filesScanned: 0,
    totalLinks: 0,
    videoLinks: 0,
    audioLinks: 0,
    configFiles: [],
    linksWithMetadata: []
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    const textContent = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array)
    
    const extractedLinks = extractLinks(textContent)
    result.links.push(...extractedLinks)
    
    const m3uEntries = parseM3UWithMetadata(textContent)
    result.linksWithMetadata.push(...m3uEntries)
    
    const jsonMatches = textContent.match(/\{[^{}]*"[^"]*":[^{}]*\}/g) || []
    for (const jsonStr of jsonMatches) {
      try {
        const jsonData = JSON.parse(jsonStr)
        const jsonLinks = extractLinksFromObject(jsonData)
        result.links.push(...jsonLinks)
      } catch {
      }
    }
    
    result.filesScanned = 1
    
    const allLinks = new Set(result.links)
    result.totalLinks = allLinks.size
    result.videoLinks = Array.from(allLinks).filter(link => getMediaType(link) === 'video').length
    result.audioLinks = Array.from(allLinks).filter(link => getMediaType(link) === 'audio').length

    if (onProgress) {
      onProgress(1, 1)
    }

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Failed to scan EXE file'
  }

  return result
}

function extractLinksFromObject(obj: any): string[] {
  const links: string[] = []
  
  if (typeof obj === 'string') {
    if (isValidMediaUrl(obj)) {
      links.push(obj)
    }
  } else if (Array.isArray(obj)) {
    obj.forEach(item => {
      links.push(...extractLinksFromObject(item))
    })
  } else if (typeof obj === 'object' && obj !== null) {
    Object.values(obj).forEach(value => {
      links.push(...extractLinksFromObject(value))
    })
  }
  
  return links
}

export async function scanZipFile(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ZipFileScanResult> {
  const fileName = file.name.toLowerCase()
  
  if (fileName.endsWith('.rar')) {
    return scanRarFile(file, onProgress)
  } else if (fileName.endsWith('.tar') || fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz') || fileName.endsWith('.gz')) {
    return scanTarFile(file, onProgress)
  } else if (fileName.endsWith('.exe')) {
    return scanExeFile(file, onProgress)
  } else {
    return scanArchiveAsZip(file, onProgress)
  }
}

export async function scanRepositoryUrls(
  urls: string[],
  onProgress?: (current: number, total: number, repoProgress?: number, repoTotal?: number) => void
): Promise<RepositoryScanResult[]> {
  const results: RepositoryScanResult[] = []

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i].trim()
    if (!url) continue

    const result = await scanGitRepository(url, (current, total) => {
      if (onProgress) {
        onProgress(i, urls.length, current, total)
      }
    })

    results.push(result)

    if (onProgress) {
      onProgress(i + 1, urls.length)
    }
  }

  return results
}
