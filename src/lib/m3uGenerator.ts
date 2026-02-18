import type { LinkWithCount, ContentType } from './linkExtractor'
import JSZip from 'jszip'

export interface M3UGenerationOptions {
  includeExtinf?: boolean
  includeGroupTitle?: boolean
  includeTvgId?: boolean
  includeTvgLogo?: boolean
}

export interface M3UGenerationResult {
  movies: string
  tvSeries: string
  liveTV: string
  all: string
  movieCount: number
  tvSeriesCount: number
  liveTVCount: number
  totalCount: number
}

export interface M3UCustomOptions {
  playlistName?: string
  playlistDescription?: string
  includeExtinf?: boolean
  includeGroupTitle?: boolean
  includeTvgId?: boolean
  includeTvgLogo?: boolean
  sortBy?: 'title' | 'category' | 'url' | 'none'
  groupByCategory?: boolean
}

export interface CustomM3UGenerationResult extends M3UGenerationResult {
  moviesName: string
  tvSeriesName: string
  liveTVName: string
  allName: string
  moviesDescription?: string
  tvSeriesDescription?: string
  liveTVDescription?: string
  allDescription?: string
}

const normalizeTitle = (title: string): string => {
  return title.replace(/[<>:"|?*]/g, '_').trim()
}

const normalizeFilename = (name: string): string => {
  return name.replace(/[<>:"|?*\/\\]/g, '_').trim()
}

const generateM3UContent = (
  links: LinkWithCount[],
  options: M3UGenerationOptions = {}
): string => {
  const lines: string[] = ['#EXTM3U']
  
  links.forEach((link, index) => {
    if (options.includeExtinf) {
      const extinf = ['#EXTINF:-1']
      
      if (options.includeTvgId && link.title) {
        extinf.push(`tvg-id="${normalizeTitle(link.title)}"`)
      }
      
      if (options.includeGroupTitle && link.category) {
        extinf.push(`group-title="${link.category}"`)
      }
      
      if (options.includeTvgLogo && link.title) {
        extinf.push(`tvg-logo=""`)
      }
      
      const title = link.title || `Media ${index + 1}`
      lines.push(`${extinf.join(' ')},${title}`)
    }
    
    lines.push(link.url)
  })
  
  return lines.join('\n')
}

const generateCustomM3UContent = (
  links: LinkWithCount[],
  options: M3UCustomOptions = {}
): string => {
  const lines: string[] = ['#EXTM3U']
  
  if (options.playlistName) {
    lines.push(`#PLAYLIST:${options.playlistName}`)
  }
  
  if (options.playlistDescription) {
    lines.push(`#DESCRIPTION:${options.playlistDescription}`)
  }
  
  let sortedLinks = [...links]
  
  if (options.sortBy === 'title') {
    sortedLinks.sort((a, b) => (a.title || a.url).localeCompare(b.title || b.url))
  } else if (options.sortBy === 'category') {
    sortedLinks.sort((a, b) => (a.category || '').localeCompare(b.category || ''))
  } else if (options.sortBy === 'url') {
    sortedLinks.sort((a, b) => a.url.localeCompare(b.url))
  }
  
  if (options.groupByCategory) {
    const grouped = new Map<string, LinkWithCount[]>()
    
    sortedLinks.forEach(link => {
      const category = link.category || 'Uncategorized'
      if (!grouped.has(category)) {
        grouped.set(category, [])
      }
      grouped.get(category)!.push(link)
    })
    
    const sortedCategories = Array.from(grouped.keys()).sort()
    
    sortedCategories.forEach(category => {
      lines.push(``)
      lines.push(`#EXTGRP:${category}`)
      
      grouped.get(category)!.forEach((link, index) => {
        const extinf = ['#EXTINF:-1']
        
        if (options.includeTvgId !== false && link.title) {
          extinf.push(`tvg-id="${normalizeTitle(link.title)}"`)
        }
        
        extinf.push(`group-title="${category}"`)
        
        if (options.includeTvgLogo && link.title) {
          extinf.push(`tvg-logo=""`)
        }
        
        const title = link.title || `${category} ${index + 1}`
        lines.push(`${extinf.join(' ')},${title}`)
        lines.push(link.url)
      })
    })
  } else {
    sortedLinks.forEach((link, index) => {
      const extinf = ['#EXTINF:-1']
      
      if (options.includeTvgId !== false && link.title) {
        extinf.push(`tvg-id="${normalizeTitle(link.title)}"`)
      }
      
      if (options.includeGroupTitle !== false && link.category) {
        extinf.push(`group-title="${link.category}"`)
      }
      
      if (options.includeTvgLogo && link.title) {
        extinf.push(`tvg-logo=""`)
      }
      
      const title = link.title || `Media ${index + 1}`
      lines.push(`${extinf.join(' ')},${title}`)
      lines.push(link.url)
    })
  }
  
  return lines.join('\n')
}

export const generateM3UsByCategory = (
  linksWithCounts: LinkWithCount[],
  options: M3UGenerationOptions = {
    includeExtinf: true,
    includeGroupTitle: true,
    includeTvgId: true,
    includeTvgLogo: false
  }
): M3UGenerationResult => {
  const movieLinks = linksWithCounts.filter(link => link.contentType === 'movie')
  const tvSeriesLinks = linksWithCounts.filter(link => link.contentType === 'tv-series')
  const liveTVLinks = linksWithCounts.filter(link => link.contentType === 'live-tv')
  
  const allCategorizedLinks = [
    ...movieLinks.map(l => ({ ...l, category: l.category || 'Movies' })),
    ...tvSeriesLinks.map(l => ({ ...l, category: l.category || 'TV Series' })),
    ...liveTVLinks.map(l => ({ ...l, category: l.category || 'Live TV' }))
  ]
  
  return {
    movies: generateM3UContent(movieLinks, options),
    tvSeries: generateM3UContent(tvSeriesLinks, options),
    liveTV: generateM3UContent(liveTVLinks, options),
    all: generateM3UContent(allCategorizedLinks, options),
    movieCount: movieLinks.length,
    tvSeriesCount: tvSeriesLinks.length,
    liveTVCount: liveTVLinks.length,
    totalCount: allCategorizedLinks.length
  }
}

export const generateCustomM3UsByCategory = (
  linksWithCounts: LinkWithCount[],
  customOptions: {
    moviesName?: string
    moviesDescription?: string
    tvSeriesName?: string
    tvSeriesDescription?: string
    liveTVName?: string
    liveTVDescription?: string
    allName?: string
    allDescription?: string
    sortBy?: 'title' | 'category' | 'url' | 'none'
    groupByCategory?: boolean
    includeExtinf?: boolean
    includeGroupTitle?: boolean
    includeTvgId?: boolean
    includeTvgLogo?: boolean
  } = {}
): CustomM3UGenerationResult => {
  const movieLinks = linksWithCounts.filter(link => link.contentType === 'movie')
  const tvSeriesLinks = linksWithCounts.filter(link => link.contentType === 'tv-series')
  const liveTVLinks = linksWithCounts.filter(link => link.contentType === 'live-tv')
  
  const allCategorizedLinks = [
    ...movieLinks.map(l => ({ ...l, category: l.category || 'Movies' })),
    ...tvSeriesLinks.map(l => ({ ...l, category: l.category || 'TV Series' })),
    ...liveTVLinks.map(l => ({ ...l, category: l.category || 'Live TV' }))
  ]
  
  const baseOptions: M3UCustomOptions = {
    includeExtinf: customOptions.includeExtinf !== false,
    includeGroupTitle: customOptions.includeGroupTitle !== false,
    includeTvgId: customOptions.includeTvgId !== false,
    includeTvgLogo: customOptions.includeTvgLogo || false,
    sortBy: customOptions.sortBy || 'none',
    groupByCategory: customOptions.groupByCategory || false
  }
  
  return {
    movies: generateCustomM3UContent(movieLinks, {
      ...baseOptions,
      playlistName: customOptions.moviesName || 'Movies Playlist',
      playlistDescription: customOptions.moviesDescription
    }),
    tvSeries: generateCustomM3UContent(tvSeriesLinks, {
      ...baseOptions,
      playlistName: customOptions.tvSeriesName || 'TV Series Playlist',
      playlistDescription: customOptions.tvSeriesDescription
    }),
    liveTV: generateCustomM3UContent(liveTVLinks, {
      ...baseOptions,
      playlistName: customOptions.liveTVName || 'Live TV Playlist',
      playlistDescription: customOptions.liveTVDescription
    }),
    all: generateCustomM3UContent(allCategorizedLinks, {
      ...baseOptions,
      playlistName: customOptions.allName || 'All Media Playlist',
      playlistDescription: customOptions.allDescription
    }),
    movieCount: movieLinks.length,
    tvSeriesCount: tvSeriesLinks.length,
    liveTVCount: liveTVLinks.length,
    totalCount: allCategorizedLinks.length,
    moviesName: customOptions.moviesName || 'movies',
    tvSeriesName: customOptions.tvSeriesName || 'tv-series',
    liveTVName: customOptions.liveTVName || 'live-tv',
    allName: customOptions.allName || 'all-categorized',
    moviesDescription: customOptions.moviesDescription,
    tvSeriesDescription: customOptions.tvSeriesDescription,
    liveTVDescription: customOptions.liveTVDescription,
    allDescription: customOptions.allDescription
  }
}

export const downloadM3UFile = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'audio/x-mpegurl' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const generateM3UBatchDownload = async (
  result: M3UGenerationResult | CustomM3UGenerationResult
): Promise<Blob> => {
  const zip = new JSZip()
  
  const isCustomResult = 'moviesName' in result
  
  if (result.movieCount > 0) {
    const filename = isCustomResult 
      ? `${normalizeFilename(result.moviesName)}.m3u`
      : 'movies.m3u'
    zip.file(filename, result.movies)
  }
  
  if (result.tvSeriesCount > 0) {
    const filename = isCustomResult 
      ? `${normalizeFilename(result.tvSeriesName)}.m3u`
      : 'tv-series.m3u'
    zip.file(filename, result.tvSeries)
  }
  
  if (result.liveTVCount > 0) {
    const filename = isCustomResult 
      ? `${normalizeFilename(result.liveTVName)}.m3u`
      : 'live-tv.m3u'
    zip.file(filename, result.liveTV)
  }
  
  if (result.totalCount > 0) {
    const filename = isCustomResult 
      ? `${normalizeFilename(result.allName)}.m3u`
      : 'all-categorized.m3u'
    zip.file(filename, result.all)
  }
  
  const readmeLines = [
    'Media Link Scanner - M3U Playlists',
    '='.repeat(50),
    '',
    `Generated: ${new Date().toISOString()}`,
    ''
  ]
  
  if (isCustomResult && (result.moviesDescription || result.tvSeriesDescription || result.liveTVDescription || result.allDescription)) {
    readmeLines.push('Playlist Descriptions:')
    readmeLines.push('-'.repeat(50))
    if (result.movieCount > 0 && result.moviesDescription) {
      readmeLines.push(`Movies: ${result.moviesDescription}`)
    }
    if (result.tvSeriesCount > 0 && result.tvSeriesDescription) {
      readmeLines.push(`TV Series: ${result.tvSeriesDescription}`)
    }
    if (result.liveTVCount > 0 && result.liveTVDescription) {
      readmeLines.push(`Live TV: ${result.liveTVDescription}`)
    }
    if (result.totalCount > 0 && result.allDescription) {
      readmeLines.push(`All Media: ${result.allDescription}`)
    }
    readmeLines.push('')
  }
  
  readmeLines.push('Files Included:')
  if (result.movieCount > 0) {
    const filename = isCustomResult ? result.moviesName : 'movies'
    readmeLines.push(`- ${filename}.m3u (${result.movieCount} movies)`)
  }
  if (result.tvSeriesCount > 0) {
    const filename = isCustomResult ? result.tvSeriesName : 'tv-series'
    readmeLines.push(`- ${filename}.m3u (${result.tvSeriesCount} TV series)`)
  }
  if (result.liveTVCount > 0) {
    const filename = isCustomResult ? result.liveTVName : 'live-tv'
    readmeLines.push(`- ${filename}.m3u (${result.liveTVCount} live TV channels)`)
  }
  if (result.totalCount > 0) {
    const filename = isCustomResult ? result.allName : 'all-categorized'
    readmeLines.push(`- ${filename}.m3u (${result.totalCount} total links with categories)`)
  }
  
  readmeLines.push(`Total Media Links: ${result.totalCount}`)
  readmeLines.push('')
  readmeLines.push('Usage:')
  readmeLines.push('------')
  readmeLines.push('1. Open any M3U file with your favorite media player (VLC, Kodi, IPTV apps)')
  readmeLines.push('2. The playlists are organized by content type for easy navigation')
  readmeLines.push('3. Each entry includes metadata like title and category where available')
  readmeLines.push('')
  readmeLines.push('Supported Players:')
  readmeLines.push('- VLC Media Player')
  readmeLines.push('- Kodi')
  readmeLines.push('- PotPlayer')
  readmeLines.push('- IPTV Smarters')
  readmeLines.push('- TiviMate')
  readmeLines.push('- GSE Smart IPTV')
  readmeLines.push('- Perfect Player')
  readmeLines.push('')
  readmeLines.push('Note: Not all links may be working. Use the URL validation feature')
  readmeLines.push('in the Media Link Scanner to test links before using.')
  
  zip.file('README.txt', readmeLines.join('\n'))
  
  return await zip.generateAsync({ type: 'blob' })
}

export const generateAdvancedM3UContent = (
  links: LinkWithCount[],
  options: {
    title?: string
    sortBy?: 'title' | 'category' | 'url'
    groupByCategory?: boolean
  } = {}
): string => {
  const lines: string[] = []
  
  lines.push('#EXTM3U')
  
  if (options.title) {
    lines.push(`#PLAYLIST:${options.title}`)
  }
  
  let sortedLinks = [...links]
  
  if (options.sortBy === 'title') {
    sortedLinks.sort((a, b) => (a.title || a.url).localeCompare(b.title || b.url))
  } else if (options.sortBy === 'category') {
    sortedLinks.sort((a, b) => (a.category || '').localeCompare(b.category || ''))
  }
  
  if (options.groupByCategory) {
    const grouped = new Map<string, LinkWithCount[]>()
    
    sortedLinks.forEach(link => {
      const category = link.category || 'Uncategorized'
      if (!grouped.has(category)) {
        grouped.set(category, [])
      }
      grouped.get(category)!.push(link)
    })
    
    const sortedCategories = Array.from(grouped.keys()).sort()
    
    sortedCategories.forEach(category => {
      lines.push(``)
      lines.push(`#EXTGRP:${category}`)
      
      grouped.get(category)!.forEach((link, index) => {
        const extinf = ['#EXTINF:-1']
        
        if (link.title) {
          extinf.push(`tvg-id="${normalizeTitle(link.title)}"`)
        }
        
        extinf.push(`group-title="${category}"`)
        
        const title = link.title || `${category} ${index + 1}`
        lines.push(`${extinf.join(' ')},${title}`)
        lines.push(link.url)
      })
    })
  } else {
    sortedLinks.forEach((link, index) => {
      const extinf = ['#EXTINF:-1']
      
      if (link.title) {
        extinf.push(`tvg-id="${normalizeTitle(link.title)}"`)
      }
      
      if (link.category) {
        extinf.push(`group-title="${link.category}"`)
      }
      
      const title = link.title || `Media ${index + 1}`
      lines.push(`${extinf.join(' ')},${title}`)
      lines.push(link.url)
    })
  }
  
  return lines.join('\n')
}

export const generateM3UWithValidationStatus = (
  links: LinkWithCount[]
): { working: string; broken: string; all: string } => {
  const workingLinks = links.filter(link => link.validationStatus === 'working')
  const brokenLinks = links.filter(link => 
    link.validationStatus === 'broken' || 
    link.validationStatus === 'timeout'
  )
  
  return {
    working: generateM3UContent(workingLinks, {
      includeExtinf: true,
      includeGroupTitle: true,
      includeTvgId: true
    }),
    broken: generateM3UContent(brokenLinks, {
      includeExtinf: true,
      includeGroupTitle: true,
      includeTvgId: true
    }),
    all: generateM3UContent(links, {
      includeExtinf: true,
      includeGroupTitle: true,
      includeTvgId: true
    })
  }
}

export interface BulkPlaylistConfig {
  id: string
  enabled: boolean
  name: string
  description?: string
  contentTypes: ContentType[]
  categories?: string[]
  mediaTypes?: ('video' | 'audio' | 'unknown')[]
  urlPattern?: string
  minOccurrences?: number
  maxOccurrences?: number
  sortBy?: 'title' | 'category' | 'url' | 'none'
  groupByCategory?: boolean
  includeExtinf?: boolean
  includeGroupTitle?: boolean
  includeTvgId?: boolean
  includeTvgLogo?: boolean
  validationStatus?: 'working' | 'broken' | 'all'
}

export interface BulkPlaylistResult {
  id: string
  name: string
  filename: string
  content: string
  linkCount: number
  description?: string
}

export interface BulkGenerationResult {
  playlists: BulkPlaylistResult[]
  totalPlaylists: number
  totalLinks: number
  timestamp: Date
}

export const generateBulkPlaylists = (
  linksWithCounts: LinkWithCount[],
  configs: BulkPlaylistConfig[]
): BulkGenerationResult => {
  const enabledConfigs = configs.filter(c => c.enabled)
  const playlists: BulkPlaylistResult[] = []
  let totalLinks = 0

  enabledConfigs.forEach(config => {
    let filteredLinks = [...linksWithCounts]

    if (config.contentTypes && config.contentTypes.length > 0) {
      filteredLinks = filteredLinks.filter(link => 
        link.contentType && config.contentTypes.includes(link.contentType)
      )
    }

    if (config.categories && config.categories.length > 0) {
      filteredLinks = filteredLinks.filter(link => 
        link.category && config.categories!.includes(link.category)
      )
    }

    if (config.mediaTypes && config.mediaTypes.length > 0) {
      filteredLinks = filteredLinks.filter(link => 
        link.mediaType && config.mediaTypes!.includes(link.mediaType)
      )
    }

    if (config.urlPattern) {
      try {
        const regex = new RegExp(config.urlPattern, 'i')
        filteredLinks = filteredLinks.filter(link => regex.test(link.url))
      } catch (error) {
        console.error('Invalid URL pattern:', config.urlPattern, error)
      }
    }

    if (config.minOccurrences !== undefined && config.minOccurrences > 0) {
      filteredLinks = filteredLinks.filter(link => link.count >= config.minOccurrences!)
    }

    if (config.maxOccurrences !== undefined && config.maxOccurrences > 0) {
      filteredLinks = filteredLinks.filter(link => link.count <= config.maxOccurrences!)
    }

    if (config.validationStatus && config.validationStatus !== 'all') {
      if (config.validationStatus === 'working') {
        filteredLinks = filteredLinks.filter(link => link.validationStatus === 'working')
      } else if (config.validationStatus === 'broken') {
        filteredLinks = filteredLinks.filter(link => 
          link.validationStatus === 'broken' || link.validationStatus === 'timeout'
        )
      }
    }

    const content = generateCustomM3UContent(filteredLinks, {
      playlistName: config.name,
      playlistDescription: config.description,
      sortBy: config.sortBy,
      groupByCategory: config.groupByCategory,
      includeExtinf: config.includeExtinf !== false,
      includeGroupTitle: config.includeGroupTitle !== false,
      includeTvgId: config.includeTvgId !== false,
      includeTvgLogo: config.includeTvgLogo || false
    })

    const filename = `${normalizeFilename(config.name)}.m3u`

    playlists.push({
      id: config.id,
      name: config.name,
      filename,
      content,
      linkCount: filteredLinks.length,
      description: config.description
    })

    totalLinks += filteredLinks.length
  })

  return {
    playlists,
    totalPlaylists: playlists.length,
    totalLinks,
    timestamp: new Date()
  }
}

export const generateBulkPlaylistsZip = async (
  result: BulkGenerationResult
): Promise<Blob> => {
  const zip = new JSZip()

  result.playlists.forEach(playlist => {
    zip.file(playlist.filename, playlist.content)
  })

  const readmeLines = [
    'Media Link Scanner - Bulk M3U Playlists',
    '='.repeat(60),
    '',
    `Generated: ${result.timestamp.toISOString()}`,
    `Total Playlists: ${result.totalPlaylists}`,
    `Total Links: ${result.totalLinks}`,
    '',
    'Playlists Included:',
    '-'.repeat(60)
  ]

  result.playlists.forEach((playlist, index) => {
    readmeLines.push('')
    readmeLines.push(`${index + 1}. ${playlist.name}`)
    readmeLines.push(`   File: ${playlist.filename}`)
    readmeLines.push(`   Links: ${playlist.linkCount}`)
    if (playlist.description) {
      readmeLines.push(`   Description: ${playlist.description}`)
    }
  })

  readmeLines.push('')
  readmeLines.push('='.repeat(60))
  readmeLines.push('Usage:')
  readmeLines.push('------')
  readmeLines.push('1. Open any M3U file with your favorite media player')
  readmeLines.push('2. Each playlist is customized with specific content filters')
  readmeLines.push('3. Metadata and categories are included where available')
  readmeLines.push('')
  readmeLines.push('Supported Players:')
  readmeLines.push('- VLC Media Player')
  readmeLines.push('- Kodi')
  readmeLines.push('- PotPlayer')
  readmeLines.push('- IPTV Smarters')
  readmeLines.push('- TiviMate')
  readmeLines.push('- GSE Smart IPTV')
  readmeLines.push('- Perfect Player')

  zip.file('README.txt', readmeLines.join('\n'))

  return await zip.generateAsync({ type: 'blob' })
}

export const createDefaultBulkConfigs = (
  linksWithCounts: LinkWithCount[]
): BulkPlaylistConfig[] => {
  const categories = Array.from(new Set(
    linksWithCounts
      .filter(l => l.category)
      .map(l => l.category!)
  )).sort()

  const hasVideo = linksWithCounts.some(l => l.mediaType === 'video')
  const hasAudio = linksWithCounts.some(l => l.mediaType === 'audio')

  const configs: BulkPlaylistConfig[] = [
    {
      id: 'all-movies',
      enabled: true,
      name: 'All Movies',
      description: 'Complete collection of movie content',
      contentTypes: ['movie'],
      sortBy: 'title',
      groupByCategory: false
    },
    {
      id: 'all-tv-series',
      enabled: true,
      name: 'All TV Series',
      description: 'Complete collection of TV series content',
      contentTypes: ['tv-series'],
      sortBy: 'title',
      groupByCategory: false
    },
    {
      id: 'all-live-tv',
      enabled: true,
      name: 'All Live TV',
      description: 'Complete collection of live TV channels',
      contentTypes: ['live-tv'],
      sortBy: 'category',
      groupByCategory: true
    },
    {
      id: 'working-links',
      enabled: false,
      name: 'Validated Working Links',
      description: 'Only links that passed validation',
      contentTypes: ['movie', 'tv-series', 'live-tv'],
      validationStatus: 'working',
      sortBy: 'title'
    }
  ]

  if (hasVideo) {
    configs.push({
      id: 'video-only',
      enabled: false,
      name: 'Video Content Only',
      description: 'All video streams excluding audio-only content',
      contentTypes: ['movie', 'tv-series', 'live-tv'],
      mediaTypes: ['video'],
      sortBy: 'title',
      groupByCategory: false
    })
  }

  if (hasAudio) {
    configs.push({
      id: 'audio-only',
      enabled: false,
      name: 'Audio Content Only',
      description: 'Music, radio, and audio-only streams',
      contentTypes: ['live-tv', 'vod'],
      mediaTypes: ['audio'],
      sortBy: 'title',
      groupByCategory: false
    })
  }

  configs.push({
    id: 'hls-streams',
    enabled: false,
    name: 'HLS Streams (m3u8)',
    description: 'HTTP Live Streaming content only',
    contentTypes: ['movie', 'tv-series', 'live-tv'],
    urlPattern: '\\.m3u8',
    sortBy: 'title',
    groupByCategory: false
  })

  configs.push({
    id: 'popular-links',
    enabled: false,
    name: 'Popular Links (5+ occurrences)',
    description: 'Links that appear frequently across multiple sources',
    contentTypes: ['movie', 'tv-series', 'live-tv'],
    minOccurrences: 5,
    sortBy: 'title',
    groupByCategory: false
  })

  configs.push({
    id: 'unique-links',
    enabled: false,
    name: 'Unique Links (Single occurrence)',
    description: 'Rare links that appear only once',
    contentTypes: ['movie', 'tv-series', 'live-tv'],
    minOccurrences: 1,
    maxOccurrences: 1,
    sortBy: 'title',
    groupByCategory: false
  })

  categories.slice(0, 10).forEach(category => {
    configs.push({
      id: `category-${category.toLowerCase().replace(/\s+/g, '-')}`,
      enabled: false,
      name: `${category} Collection`,
      description: `All content in the ${category} category`,
      contentTypes: ['movie', 'tv-series', 'live-tv'],
      categories: [category],
      sortBy: 'title',
      groupByCategory: false
    })
  })

  return configs
}

export const downloadBulkPlaylist = (playlist: BulkPlaylistResult) => {
  downloadM3UFile(playlist.content, playlist.filename)
}
