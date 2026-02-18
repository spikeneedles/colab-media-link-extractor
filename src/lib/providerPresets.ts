export interface ProviderPreset {
  id: string
  name: string
  description: string
  category: 'github' | 'playlist' | 'xtream' | 'web' | 'mixed'
  icon: string
  sources: ProviderSource[]
  tags: string[]
}

export interface ProviderSource {
  type: 'github' | 'playlist' | 'xtream' | 'web'
  url?: string
  serverUrl?: string
  username?: string
  password?: string
  label?: string
  requiresAuth?: boolean
}

export interface ScanProgress {
  provider: string
  current: number
  total: number
  status: 'pending' | 'scanning' | 'complete' | 'error'
  linksFound: number
  error?: string
}

export const IPTV_PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'iptv-org',
    name: 'IPTV-Org Collection',
    description: 'Comprehensive GitHub repository with 10,000+ free IPTV channels from around the world',
    category: 'github',
    icon: '🌍',
    sources: [
      {
        type: 'github',
        url: 'https://github.com/iptv-org/iptv',
        label: 'Main IPTV collection'
      }
    ],
    tags: ['free', 'worldwide', 'live-tv', 'sports', 'news']
  },
  {
    id: 'free-iptv',
    name: 'Free-IPTV Collection',
    description: 'Curated list of free IPTV channels with regular updates',
    category: 'github',
    icon: '📺',
    sources: [
      {
        type: 'github',
        url: 'https://github.com/Free-IPTV/Countries',
        label: 'Free IPTV by country'
      }
    ],
    tags: ['free', 'categorized', 'live-tv']
  },
  {
    id: 'iptv-links',
    name: 'IPTV Links Collection',
    description: 'Multiple GitHub repositories with working IPTV links',
    category: 'github',
    icon: '🔗',
    sources: [
      {
        type: 'github',
        url: 'https://github.com/iptv-org/awesome-iptv',
        label: 'Awesome IPTV resources'
      },
      {
        type: 'github',
        url: 'https://github.com/davidbombal/iptv',
        label: 'David Bombal IPTV'
      }
    ],
    tags: ['free', 'multiple-sources', 'curated']
  },
  {
    id: 'sports-iptv',
    name: 'Sports IPTV Channels',
    description: 'Specialized collections for sports streaming channels',
    category: 'github',
    icon: '⚽',
    sources: [
      {
        type: 'github',
        url: 'https://github.com/iptv-org/iptv',
        label: 'IPTV-Org Sports'
      }
    ],
    tags: ['sports', 'live', 'free']
  },
  {
    id: 'kodi-addons',
    name: 'Kodi Addon Repositories',
    description: 'Popular Kodi addon repositories with media sources',
    category: 'github',
    icon: '🎬',
    sources: [
      {
        type: 'github',
        url: 'https://github.com/streamlink/streamlink',
        label: 'Streamlink plugins'
      }
    ],
    tags: ['kodi', 'addons', 'streaming']
  },
  {
    id: 'movies-tv',
    name: 'Movies & TV Shows',
    description: 'VOD sources for movies and TV series',
    category: 'mixed',
    icon: '🎭',
    sources: [
      {
        type: 'github',
        url: 'https://github.com/iptv-org/iptv',
        label: 'VOD sources'
      }
    ],
    tags: ['movies', 'tv-series', 'vod']
  },
  {
    id: 'news-channels',
    name: 'News Channels',
    description: 'Live news channels from around the world',
    category: 'github',
    icon: '📰',
    sources: [
      {
        type: 'github',
        url: 'https://github.com/iptv-org/iptv',
        label: 'News channels'
      }
    ],
    tags: ['news', 'live', 'worldwide']
  },
  {
    id: 'regional-usa',
    name: 'USA Regional Channels',
    description: 'US-based IPTV channels and local broadcasts',
    category: 'github',
    icon: '🇺🇸',
    sources: [
      {
        type: 'github',
        url: 'https://github.com/iptv-org/iptv',
        label: 'USA channels'
      }
    ],
    tags: ['usa', 'regional', 'local']
  },
  {
    id: 'regional-uk',
    name: 'UK Regional Channels',
    description: 'UK-based IPTV channels and BBC streams',
    category: 'github',
    icon: '🇬🇧',
    sources: [
      {
        type: 'github',
        url: 'https://github.com/iptv-org/iptv',
        label: 'UK channels'
      }
    ],
    tags: ['uk', 'regional', 'bbc']
  },
  {
    id: 'regional-asia',
    name: 'Asian Channels',
    description: 'IPTV channels from Asian countries',
    category: 'github',
    icon: '🌏',
    sources: [
      {
        type: 'github',
        url: 'https://github.com/iptv-org/iptv',
        label: 'Asian channels'
      }
    ],
    tags: ['asia', 'regional', 'international']
  },
  {
    id: 'xtream-providers',
    name: 'Xtream Codes Providers',
    description: 'Connect to popular Xtream Codes API providers (requires credentials)',
    category: 'xtream',
    icon: '🔐',
    sources: [
      {
        type: 'xtream',
        requiresAuth: true,
        label: 'Xtream Codes API'
      }
    ],
    tags: ['xtream', 'paid', 'premium']
  },
  {
    id: 'm3u-playlists',
    name: 'Popular M3U Playlists',
    description: 'Well-known public M3U playlist URLs',
    category: 'playlist',
    icon: '📋',
    sources: [
      {
        type: 'playlist',
        requiresAuth: false,
        label: 'Public M3U playlists'
      }
    ],
    tags: ['m3u', 'playlists', 'free']
  },
  {
    id: 'web-scrapers',
    name: 'Web-Based IPTV Sites',
    description: 'Scan popular IPTV listing websites',
    category: 'web',
    icon: '🌐',
    sources: [
      {
        type: 'web',
        label: 'IPTV websites'
      }
    ],
    tags: ['web', 'scraping', 'dynamic']
  },
  {
    id: 'all-sources',
    name: 'Scan All Sources',
    description: 'Comprehensive scan of all major IPTV providers and repositories',
    category: 'mixed',
    icon: '🚀',
    sources: [
      {
        type: 'github',
        url: 'https://github.com/iptv-org/iptv',
        label: 'IPTV-Org'
      },
      {
        type: 'github',
        url: 'https://github.com/Free-IPTV/Countries',
        label: 'Free-IPTV'
      },
      {
        type: 'github',
        url: 'https://github.com/iptv-org/awesome-iptv',
        label: 'Awesome IPTV'
      },
      {
        type: 'github',
        url: 'https://github.com/davidbombal/iptv',
        label: 'David Bombal'
      },
      {
        type: 'github',
        url: 'https://github.com/streamlink/streamlink',
        label: 'Streamlink'
      }
    ],
    tags: ['comprehensive', 'all', 'bulk']
  }
]

export const getPresetById = (id: string): ProviderPreset | undefined => {
  return IPTV_PROVIDER_PRESETS.find(preset => preset.id === id)
}

export const getPresetsByCategory = (category: ProviderPreset['category']): ProviderPreset[] => {
  return IPTV_PROVIDER_PRESETS.filter(preset => preset.category === category)
}

export const getPresetsByTag = (tag: string): ProviderPreset[] => {
  return IPTV_PROVIDER_PRESETS.filter(preset => preset.tags.includes(tag))
}

export const getAllTags = (): string[] => {
  const tags = new Set<string>()
  IPTV_PROVIDER_PRESETS.forEach(preset => {
    preset.tags.forEach(tag => tags.add(tag))
  })
  return Array.from(tags).sort()
}
