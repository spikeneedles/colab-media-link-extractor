import { StoredMediaItem, getStoredItemsByType } from './storageManager'

export type PlaylistFormat = 'm3u8' | 'm3u' | 'txt' | 'json' | 'xml'
export type ContentFilter = 'movie' | 'series' | 'live-tv'

interface PlaylistEntry {
  title: string
  url: string
  duration?: number
  tvgId?: string
  tvgName?: string
  tvgLogo?: string
  groupTitle?: string
  extra?: Record<string, string>
}

export function generatePlaylist(
  items: StoredMediaItem[],
  format: PlaylistFormat = 'm3u8',
  contentType: ContentFilter | 'all' = 'all'
): string {
  // Filter items by content type if specified
  let filteredItems = items
  if (contentType !== 'all') {
    filteredItems = items.filter(item => item.contentType === contentType)
  }

  // Convert to playlist entries
  const entries: PlaylistEntry[] = filteredItems.map(item => {
    const extra: Record<string, string> = {
      indexer: item.indexer || '',
      seeders: item.seeders?.toString() || '0',
      leechers: item.leechers?.toString() || '0',
      size: item.size?.toString() || '0',
      confidence: item.confidence?.toString() || '',
    }
    
    if (item.genre) {
      extra.genre = Array.isArray(item.genre) ? item.genre.join(', ') : item.genre
    }

    return {
      title: item.title,
      url: item.url,
      tvgName: item.title,
      tvgId: item.id,
      groupTitle: getGroupTitle(item.contentType || 'movie'),
      duration: -1,
      extra,
    }
  })

  switch (format) {
    case 'm3u8':
    case 'm3u':
      return generateM3U(entries)
    case 'txt':
      return generatePlainText(entries)
    case 'json':
      return generateJSON(entries, filteredItems)
    case 'xml':
      return generateXML(entries, filteredItems)
    default:
      return generateM3U(entries)
  }
}

function getGroupTitle(contentType: string): string {
  switch (contentType) {
    case 'movie':
      return 'Movies'
    case 'series':
      return 'Television Series'
    case 'live-tv':
      return 'Live TV / IPTV'
    default:
      return 'Media'
  }
}

function generateM3U(entries: PlaylistEntry[]): string {
  let content = '#EXTM3U\n'
  
  entries.forEach(entry => {
    const attributes: string[] = [
      `tvg-id="${entry.tvgId || ''}"`,
      `tvg-name="${escapeAttribute(entry.tvgName || '')}"`,
      `group-title="${escapeAttribute(entry.groupTitle || '')}"`,
      `duration="${entry.duration || -1}"`,
    ]

    // Add extra attributes
    if (entry.extra?.indexer) {
      attributes.push(`indexer="${escapeAttribute(entry.extra.indexer)}"`)
    }
    if (entry.extra?.seeders) {
      attributes.push(`seeders="${entry.extra.seeders}"`)
    }
    if (entry.extra?.confidence) {
      attributes.push(`confidence="${entry.extra.confidence}"`)
    }

    content += `#EXTINF:${entry.duration || -1}, ${escapeAttribute(entry.title)}\n`
    content += `${attributes.join(' ')}\n`
    content += `${entry.url}\n`
  })

  return content
}

function generatePlainText(entries: PlaylistEntry[]): string {
  const grouped = groupByCategory(entries)
  let content = ''

  const categories = ['Movies', 'Television Series', 'Live TV / IPTV']
  
  categories.forEach(category => {
    const items = grouped[category] || []
    if (items.length > 0) {
      content += `\n=== ${category.toUpperCase()} (${items.length} items) ===\n\n`
      items.forEach((entry, index) => {
        content += `${index + 1}. ${entry.title}\n`
        content += `   URL: ${entry.url}\n`
        if (entry.extra?.indexer) {
          content += `   Indexer: ${entry.extra.indexer}\n`
        }
        if (entry.extra?.seeders) {
          content += `   Seeders: ${entry.extra.seeders}\n`
        }
        if (entry.extra?.confidence) {
          content += `   Confidence: ${entry.extra.confidence}\n`
        }
        content += '\n'
      })
    }
  })

  return content
}

function generateJSON(entries: PlaylistEntry[], items: StoredMediaItem[]): string {
  const grouped: Record<string, PlaylistEntry[]> = {}
  
  entries.forEach(entry => {
    const group = entry.groupTitle || 'Other'
    if (!grouped[group]) {
      grouped[group] = []
    }
    grouped[group].push(entry)
  })

  const stats = {
    totalItems: items.length,
    movies: items.filter(i => i.contentType === 'movie').length,
    series: items.filter(i => i.contentType === 'series').length,
    liveTv: items.filter(i => i.contentType === 'live-tv').length,
    generatedAt: new Date().toISOString(),
    categories: grouped,
  }

  return JSON.stringify(stats, null, 2)
}

function generateXML(entries: PlaylistEntry[], items: StoredMediaItem[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<playlist>\n'
  xml += `  <meta>\n`
  xml += `    <title>Media Vault Playlist</title>\n`
  xml += `    <totalItems>${items.length}</totalItems>\n`
  xml += `    <generatedAt>${new Date().toISOString()}</generatedAt>\n`
  xml += `    <categories>\n`
  xml += `      <movies>${items.filter(i => i.contentType === 'movie').length}</movies>\n`
  xml += `      <series>${items.filter(i => i.contentType === 'series').length}</series>\n`
  xml += `      <liveTv>${items.filter(i => i.contentType === 'live-tv').length}</liveTv>\n`
  xml += `    </categories>\n`
  xml += `  </meta>\n`
  xml += `  <items>\n`

  entries.forEach(entry => {
    xml += `    <item>\n`
    xml += `      <title>${escapeXML(entry.title)}</title>\n`
    xml += `      <url>${escapeXML(entry.url)}</url>\n`
    xml += `      <group>${escapeXML(entry.groupTitle || 'Other')}</group>\n`
    if (entry.extra?.indexer) {
      xml += `      <indexer>${escapeXML(entry.extra.indexer)}</indexer>\n`
    }
    if (entry.extra?.seeders) {
      xml += `      <seeders>${entry.extra.seeders}</seeders>\n`
    }
    if (entry.extra?.confidence) {
      xml += `      <confidence>${entry.extra.confidence}</confidence>\n`
    }
    xml += `    </item>\n`
  })

  xml += `  </items>\n`
  xml += `</playlist>\n`

  return xml
}

function groupByCategory(entries: PlaylistEntry[]): Record<string, PlaylistEntry[]> {
  const grouped: Record<string, PlaylistEntry[]> = {}
  
  entries.forEach(entry => {
    const group = entry.groupTitle || 'Other'
    if (!grouped[group]) {
      grouped[group] = []
    }
    grouped[group].push(entry)
  })

  return grouped
}

function escapeAttribute(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeXML(str: string): string {
  return escapeAttribute(str)
}

export function downloadPlaylist(
  items: StoredMediaItem[],
  format: PlaylistFormat = 'm3u8',
  contentType: ContentFilter | 'all' = 'all'
): void {
  const content = generatePlaylist(items, format, contentType)
  const filename = generateFilename(contentType, format)
  
  const element = document.createElement('a')
  let mimeType = 'text/plain'
  
  switch (format) {
    case 'm3u8':
    case 'm3u':
      mimeType = 'text/plain'
      break
    case 'json':
      mimeType = 'application/json'
      break
    case 'xml':
      mimeType = 'application/xml'
      break
    case 'txt':
      mimeType = 'text/plain'
      break
  }
  
  element.setAttribute(
    'href',
    `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`
  )
  element.setAttribute('download', filename)
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

function generateFilename(contentType: ContentFilter | 'all', format: PlaylistFormat): string {
  const timestamp = new Date().toISOString().slice(0, 10)
  const typeMap: Record<ContentFilter | 'all', string> = {
    all: 'media-vault',
    movie: 'movies',
    series: 'television-series',
    'live-tv': 'live-tv-iptv'
  }
  const typeStr = typeMap[contentType] || 'media'
  return `${typeStr}-${timestamp}.${format}`
}

export function getFormatLabel(format: PlaylistFormat): string {
  const labels: Record<PlaylistFormat, string> = {
    m3u8: 'M3U8 (Playlist)',
    m3u: 'M3U (Playlist)',
    txt: 'TXT (Plain Text)',
    json: 'JSON (Data)',
    xml: 'XML (Structured)'
  }
  return labels[format] || format
}
