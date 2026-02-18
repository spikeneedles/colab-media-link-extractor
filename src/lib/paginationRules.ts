export type PaginationPattern = {
  id: string
  name: string
  description: string
  type: 'url_param' | 'path_segment' | 'button_click' | 'infinite_scroll' | 'next_link' | 'custom'
  pattern: string
  startPage?: number
  maxPages?: number
  pageIncrement?: number
  selector?: string
  nextLinkSelector?: string
  customScript?: string
  enabled: boolean
}

export type PaginationRule = {
  id: string
  name: string
  urlPattern: string
  patterns: PaginationPattern[]
  detectionSelectors?: string[]
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

export const DEFAULT_PAGINATION_PATTERNS: PaginationPattern[] = [
  {
    id: 'url-page-param',
    name: 'URL Parameter: ?page=N',
    description: 'Increments page parameter in URL (e.g., ?page=1, ?page=2)',
    type: 'url_param',
    pattern: 'page',
    startPage: 1,
    maxPages: 100,
    pageIncrement: 1,
    enabled: true
  },
  {
    id: 'url-p-param',
    name: 'URL Parameter: ?p=N',
    description: 'Increments p parameter in URL (e.g., ?p=1, ?p=2)',
    type: 'url_param',
    pattern: 'p',
    startPage: 1,
    maxPages: 100,
    pageIncrement: 1,
    enabled: true
  },
  {
    id: 'url-pg-param',
    name: 'URL Parameter: ?pg=N',
    description: 'Increments pg parameter in URL (e.g., ?pg=1, ?pg=2)',
    type: 'url_param',
    pattern: 'pg',
    startPage: 1,
    maxPages: 100,
    pageIncrement: 1,
    enabled: true
  },
  {
    id: 'url-offset-param',
    name: 'URL Parameter: ?offset=N',
    description: 'Increments offset parameter in URL by custom increment',
    type: 'url_param',
    pattern: 'offset',
    startPage: 0,
    maxPages: 100,
    pageIncrement: 20,
    enabled: true
  },
  {
    id: 'url-start-param',
    name: 'URL Parameter: ?start=N',
    description: 'Increments start parameter in URL by custom increment',
    type: 'url_param',
    pattern: 'start',
    startPage: 0,
    maxPages: 100,
    pageIncrement: 10,
    enabled: true
  },
  {
    id: 'path-page-number',
    name: 'Path Segment: /page/N/',
    description: 'Increments page number in URL path (e.g., /page/1/, /page/2/)',
    type: 'path_segment',
    pattern: '/page/(\\d+)/',
    startPage: 1,
    maxPages: 100,
    pageIncrement: 1,
    enabled: true
  },
  {
    id: 'path-page-dash',
    name: 'Path Segment: /page-N/',
    description: 'Increments page number in URL path (e.g., /page-1/, /page-2/)',
    type: 'path_segment',
    pattern: '/page-(\\d+)/',
    startPage: 1,
    maxPages: 100,
    pageIncrement: 1,
    enabled: true
  },
  {
    id: 'path-p-number',
    name: 'Path Segment: /p/N/',
    description: 'Increments page number in URL path (e.g., /p/1/, /p/2/)',
    type: 'path_segment',
    pattern: '/p/(\\d+)/',
    startPage: 1,
    maxPages: 100,
    pageIncrement: 1,
    enabled: true
  },
  {
    id: 'next-link-common',
    name: 'Next Link: Common Selectors',
    description: 'Follows "Next" links using common CSS selectors',
    type: 'next_link',
    pattern: '',
    nextLinkSelector: 'a[rel="next"], a.next, a.pagination-next, .pagination a:contains("Next"), .pager a:contains("Next"), a[aria-label="Next"]',
    maxPages: 100,
    enabled: true
  },
  {
    id: 'next-link-numbered',
    name: 'Next Link: Numbered Links',
    description: 'Follows numbered pagination links (1, 2, 3...)',
    type: 'next_link',
    pattern: '',
    nextLinkSelector: '.pagination a, .pager a, .page-numbers a',
    maxPages: 100,
    enabled: true
  },
  {
    id: 'button-load-more',
    name: 'Button Click: Load More',
    description: 'Clicks "Load More" or "Show More" buttons',
    type: 'button_click',
    pattern: '',
    selector: 'button:contains("Load More"), button:contains("Show More"), .load-more, .show-more',
    maxPages: 50,
    enabled: true
  },
  {
    id: 'infinite-scroll',
    name: 'Infinite Scroll: Auto-detect',
    description: 'Automatically scrolls to load more content',
    type: 'infinite_scroll',
    pattern: '',
    maxPages: 50,
    enabled: true
  },
  {
    id: 'iptv-list-pagination',
    name: 'IPTV: List Pagination',
    description: 'Common pagination for IPTV playlist directories',
    type: 'url_param',
    pattern: 'page',
    startPage: 1,
    maxPages: 200,
    pageIncrement: 1,
    enabled: true
  },
  {
    id: 'iptv-channel-pagination',
    name: 'IPTV: Channel Pages',
    description: 'Pagination for IPTV channel listing pages',
    type: 'path_segment',
    pattern: '/channels/(\\d+)',
    startPage: 1,
    maxPages: 100,
    pageIncrement: 1,
    enabled: true
  },
  {
    id: 'iptv-org-categories',
    name: 'IPTV-Org: Category Pages',
    description: 'Pagination for IPTV-Org category listings',
    type: 'path_segment',
    pattern: '/categories/[^/]+/page/(\\d+)',
    startPage: 1,
    maxPages: 50,
    pageIncrement: 1,
    enabled: true
  },
  {
    id: 'iptv-org-countries',
    name: 'IPTV-Org: Country Pages',
    description: 'Pagination for IPTV-Org country listings',
    type: 'path_segment',
    pattern: '/countries/[^/]+/page/(\\d+)',
    startPage: 1,
    maxPages: 100,
    pageIncrement: 1,
    enabled: true
  },
  {
    id: 'free-iptv-list',
    name: 'Free-IPTV: List Pages',
    description: 'Pagination for Free-IPTV GitHub repository lists',
    type: 'url_param',
    pattern: 'page',
    startPage: 1,
    maxPages: 150,
    pageIncrement: 1,
    enabled: true
  },
  {
    id: 'iptv-github-tree',
    name: 'GitHub: Tree View Pages',
    description: 'Pagination for GitHub repository tree view',
    type: 'url_param',
    pattern: 'after',
    startPage: 0,
    maxPages: 200,
    pageIncrement: 1,
    enabled: true
  },
  {
    id: 'awesome-iptv-pages',
    name: 'Awesome-IPTV: Directory Pages',
    description: 'Pagination for Awesome-IPTV directory listings',
    type: 'path_segment',
    pattern: '/(\\d+)\\.html',
    startPage: 1,
    maxPages: 100,
    pageIncrement: 1,
    enabled: true
  },
  {
    id: 'iptv-stream-offset',
    name: 'IPTV Stream: Offset Pagination',
    description: 'Offset-based pagination for IPTV stream listings (50 per page)',
    type: 'url_param',
    pattern: 'offset',
    startPage: 0,
    maxPages: 100,
    pageIncrement: 50,
    enabled: true
  },
  {
    id: 'xtream-codes-page',
    name: 'Xtream Codes: Page Parameter',
    description: 'Page-based pagination for Xtream Codes panels',
    type: 'url_param',
    pattern: 'page',
    startPage: 0,
    maxPages: 200,
    pageIncrement: 1,
    enabled: true
  },
  {
    id: 'iptv-player-limit',
    name: 'IPTV Player: Limit/Offset',
    description: 'Limit and offset pagination for IPTV player APIs',
    type: 'url_param',
    pattern: 'limit',
    startPage: 0,
    maxPages: 150,
    pageIncrement: 100,
    enabled: true
  },
  {
    id: 'm3u-playlist-index',
    name: 'M3U Playlist: Index Pages',
    description: 'Index-based pagination for M3U playlist directories',
    type: 'path_segment',
    pattern: '/index(\\d+)\\.m3u',
    startPage: 1,
    maxPages: 50,
    pageIncrement: 1,
    enabled: true
  },
  {
    id: 'epg-guide-pages',
    name: 'EPG Guide: Date Pages',
    description: 'Date-based pagination for EPG TV guide pages',
    type: 'url_param',
    pattern: 'date',
    startPage: 0,
    maxPages: 30,
    pageIncrement: 1,
    enabled: true
  },
  {
    id: 'kodi-repo-folders',
    name: 'Kodi: Repository Folder Pages',
    description: 'Pagination for Kodi repository folder listings',
    type: 'path_segment',
    pattern: '/repo/[^/]+/(\\d+)',
    startPage: 0,
    maxPages: 50,
    pageIncrement: 1,
    enabled: true
  }
]

export const DEFAULT_PAGINATION_RULES: PaginationRule[] = [
  {
    id: 'iptv-org-provider',
    name: 'IPTV-Org Official Repository',
    urlPattern: 'github.com/iptv-org/iptv|iptv-org.github.io',
    patterns: DEFAULT_PAGINATION_PATTERNS.filter(p => 
      ['iptv-org-categories', 'iptv-org-countries', 'iptv-github-tree', 'next-link-common'].includes(p.id)
    ),
    detectionSelectors: ['.pagination', '.Box-row', 'a[rel="next"]', '.js-navigation-item'],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'free-iptv-provider',
    name: 'Free-IPTV Repository',
    urlPattern: 'github.com/Free-IPTV/Countries|github.com/Free-TV/IPTV',
    patterns: DEFAULT_PAGINATION_PATTERNS.filter(p => 
      ['free-iptv-list', 'iptv-github-tree', 'path-page-number', 'next-link-common'].includes(p.id)
    ),
    detectionSelectors: ['.pagination', '.Box-row', 'a[rel="next"]', 'nav[aria-label="Pagination"]'],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'awesome-iptv-provider',
    name: 'Awesome-IPTV Lists',
    urlPattern: 'github.com/.*/awesome-iptv|awesome-iptv',
    patterns: DEFAULT_PAGINATION_PATTERNS.filter(p => 
      ['awesome-iptv-pages', 'url-page-param', 'next-link-common'].includes(p.id)
    ),
    detectionSelectors: ['.pagination', 'a[rel="next"]', '.page-link'],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'xtream-codes-panels',
    name: 'Xtream Codes Panels',
    urlPattern: '.*xtream.*|.*:8080.*|.*:8000.*',
    patterns: DEFAULT_PAGINATION_PATTERNS.filter(p => 
      ['xtream-codes-page', 'iptv-player-limit', 'url-offset-param'].includes(p.id)
    ),
    detectionSelectors: ['.pagination', '.page-item', 'button[data-page]'],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'm3u-playlist-directories',
    name: 'M3U Playlist Directories',
    urlPattern: '.*\\.m3u.*|.*playlist.*\\.m3u|.*playlists/.*',
    patterns: DEFAULT_PAGINATION_PATTERNS.filter(p => 
      ['m3u-playlist-index', 'url-page-param', 'path-page-number'].includes(p.id)
    ),
    detectionSelectors: ['.file-list', '.directory-listing', 'a[href$=".m3u"]'],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'epg-guide-sites',
    name: 'EPG TV Guide Sites',
    urlPattern: '.*epg.*|.*tvguide.*|.*tv-guide.*',
    patterns: DEFAULT_PAGINATION_PATTERNS.filter(p => 
      ['epg-guide-pages', 'url-page-param', 'next-link-common'].includes(p.id)
    ),
    detectionSelectors: ['.date-pagination', '.tv-schedule', 'button[data-date]'],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'iptv-stream-providers',
    name: 'IPTV Stream Providers',
    urlPattern: '.*iptvstream.*|.*livestream.*|.*tv-stream.*',
    patterns: DEFAULT_PAGINATION_PATTERNS.filter(p => 
      ['iptv-stream-offset', 'iptv-player-limit', 'button-load-more'].includes(p.id)
    ),
    detectionSelectors: ['.stream-list', '.channel-grid', 'button:contains("Load More")'],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'iptv-github-repos',
    name: 'IPTV GitHub Repositories',
    urlPattern: 'github.com/.*iptv',
    patterns: DEFAULT_PAGINATION_PATTERNS.filter(p => 
      ['url-page-param', 'path-page-number', 'iptv-github-tree', 'next-link-common'].includes(p.id)
    ),
    detectionSelectors: ['.pagination', '.pager', 'a[rel="next"]', '.Box-row'],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'iptv-playlist-sites',
    name: 'IPTV Playlist Websites',
    urlPattern: '.*playlist.*|.*iptv.*|.*m3u.*',
    patterns: DEFAULT_PAGINATION_PATTERNS.filter(p => 
      ['url-page-param', 'url-p-param', 'next-link-common', 'button-load-more'].includes(p.id)
    ),
    detectionSelectors: ['.pagination', 'button:contains("Load More")', 'a[rel="next"]'],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'streaming-directories',
    name: 'Streaming Media Directories',
    urlPattern: '.*stream.*|.*media.*|.*video.*',
    patterns: DEFAULT_PAGINATION_PATTERNS.filter(p => 
      ['url-page-param', 'path-page-number', 'next-link-common', 'infinite-scroll'].includes(p.id)
    ),
    detectionSelectors: ['.pagination', '.infinite-scroll', 'a[rel="next"]'],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'kodi-addon-repos',
    name: 'Kodi Addon Repositories',
    urlPattern: '.*kodi.*|.*addon.*',
    patterns: DEFAULT_PAGINATION_PATTERNS.filter(p => 
      ['url-page-param', 'path-page-number', 'next-link-numbered'].includes(p.id)
    ),
    detectionSelectors: ['.pagination', '.page-numbers', 'a[rel="next"]'],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'generic-pagination',
    name: 'Generic Web Pagination',
    urlPattern: '.*',
    patterns: DEFAULT_PAGINATION_PATTERNS.filter(p => 
      ['url-page-param', 'next-link-common'].includes(p.id)
    ),
    detectionSelectors: ['.pagination', 'a[rel="next"]'],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]

export function detectPaginationPattern(url: string, html?: string): PaginationPattern | null {
  const urlObj = new URL(url)
  
  for (const pattern of DEFAULT_PAGINATION_PATTERNS) {
    if (!pattern.enabled) continue
    
    switch (pattern.type) {
      case 'url_param':
        if (urlObj.searchParams.has(pattern.pattern)) {
          return pattern
        }
        break
        
      case 'path_segment':
        const regex = new RegExp(pattern.pattern)
        if (regex.test(urlObj.pathname)) {
          return pattern
        }
        break
        
      case 'next_link':
      case 'button_click':
      case 'infinite_scroll':
        if (html && pattern.selector) {
          return pattern
        }
        break
    }
  }
  
  if (html) {
    const hasPagination = html.includes('pagination') || 
                         html.includes('page-numbers') || 
                         html.includes('rel="next"')
    
    if (hasPagination) {
      return DEFAULT_PAGINATION_PATTERNS.find(p => p.id === 'next-link-common') || null
    }
  }
  
  return null
}

export function generatePaginatedUrls(
  baseUrl: string,
  pattern: PaginationPattern,
  maxPages?: number
): string[] {
  const urls: string[] = []
  const limit = Math.min(maxPages || pattern.maxPages || 50, 200)
  const urlObj = new URL(baseUrl)
  
  switch (pattern.type) {
    case 'url_param':
      for (let i = pattern.startPage || 1; i < (pattern.startPage || 1) + limit; i += pattern.pageIncrement || 1) {
        const newUrl = new URL(baseUrl)
        newUrl.searchParams.set(pattern.pattern, String(i))
        urls.push(newUrl.toString())
      }
      break
      
    case 'path_segment':
      const regex = new RegExp(pattern.pattern)
      for (let i = pattern.startPage || 1; i < (pattern.startPage || 1) + limit; i += pattern.pageIncrement || 1) {
        const newPath = urlObj.pathname.match(regex) 
          ? urlObj.pathname.replace(regex, pattern.pattern.replace('(\\d+)', String(i)))
          : urlObj.pathname + pattern.pattern.replace('(\\d+)', String(i))
        
        const newUrl = new URL(urlObj.origin + newPath + urlObj.search + urlObj.hash)
        urls.push(newUrl.toString())
      }
      break
  }
  
  return urls
}

export function matchPaginationRule(url: string): PaginationRule | null {
  for (const rule of DEFAULT_PAGINATION_RULES) {
    if (!rule.enabled) continue
    
    const regex = new RegExp(rule.urlPattern, 'i')
    if (regex.test(url)) {
      return rule
    }
  }
  
  return null
}

export function getPaginatedUrlsForRule(
  baseUrl: string,
  rule: PaginationRule,
  maxPages?: number
): string[] {
  const allUrls: string[] = []
  
  for (const pattern of rule.patterns) {
    if (!pattern.enabled) continue
    
    if (pattern.type === 'url_param' || pattern.type === 'path_segment') {
      const urls = generatePaginatedUrls(baseUrl, pattern, maxPages)
      allUrls.push(...urls)
    }
  }
  
  return Array.from(new Set(allUrls))
}

export async function crawlPaginatedSite(
  baseUrl: string,
  options: {
    maxPages?: number
    autoDetect?: boolean
    pattern?: PaginationPattern
    rule?: PaginationRule
    onPageDiscovered?: (url: string, pageNumber: number) => void
    onProgress?: (current: number, total: number) => void
  } = {}
): Promise<string[]> {
  const discoveredUrls: string[] = [baseUrl]
  const { maxPages = 50, autoDetect = true } = options
  
  let pattern = options.pattern
  let rule = options.rule
  
  if (autoDetect && !pattern && !rule) {
    const matchedRule = matchPaginationRule(baseUrl)
    if (matchedRule) {
      rule = matchedRule
    }
  }
  
  if (rule) {
    const urls = getPaginatedUrlsForRule(baseUrl, rule, maxPages)
    discoveredUrls.push(...urls)
  } else if (pattern) {
    const urls = generatePaginatedUrls(baseUrl, pattern, maxPages)
    discoveredUrls.push(...urls)
  } else {
    try {
      const response = await fetch(baseUrl)
      const html = await response.text()
      const detectedPattern = detectPaginationPattern(baseUrl, html)
      
      if (detectedPattern) {
        const urls = generatePaginatedUrls(baseUrl, detectedPattern, maxPages)
        discoveredUrls.push(...urls)
      }
    } catch (error) {
      console.error('Failed to detect pagination:', error)
    }
  }
  
  const uniqueUrls = Array.from(new Set(discoveredUrls))
  
  uniqueUrls.forEach((url, index) => {
    options.onPageDiscovered?.(url, index + 1)
  })
  
  options.onProgress?.(uniqueUrls.length, uniqueUrls.length)
  
  return uniqueUrls
}

export function savePaginationRule(rule: PaginationRule): void {
  const existingRules = loadPaginationRules()
  const index = existingRules.findIndex(r => r.id === rule.id)
  
  if (index >= 0) {
    existingRules[index] = { ...rule, updatedAt: new Date() }
  } else {
    existingRules.push({ ...rule, createdAt: new Date(), updatedAt: new Date() })
  }
  
  localStorage.setItem('pagination-rules', JSON.stringify(existingRules))
}

export function loadPaginationRules(): PaginationRule[] {
  try {
    const stored = localStorage.getItem('pagination-rules')
    if (stored) {
      const rules = JSON.parse(stored)
      return rules.map((r: any) => ({
        ...r,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt)
      }))
    }
  } catch (error) {
    console.error('Failed to load pagination rules:', error)
  }
  
  return [...DEFAULT_PAGINATION_RULES]
}

export function deletePaginationRule(ruleId: string): void {
  const rules = loadPaginationRules()
  const filtered = rules.filter(r => r.id !== ruleId)
  localStorage.setItem('pagination-rules', JSON.stringify(filtered))
}

export function savePaginationPattern(pattern: PaginationPattern): void {
  const patterns = loadPaginationPatterns()
  const index = patterns.findIndex(p => p.id === pattern.id)
  
  if (index >= 0) {
    patterns[index] = pattern
  } else {
    patterns.push(pattern)
  }
  
  localStorage.setItem('pagination-patterns', JSON.stringify(patterns))
}

export function loadPaginationPatterns(): PaginationPattern[] {
  try {
    const stored = localStorage.getItem('pagination-patterns')
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Failed to load pagination patterns:', error)
  }
  
  return [...DEFAULT_PAGINATION_PATTERNS]
}

export function deletePaginationPattern(patternId: string): void {
  const patterns = loadPaginationPatterns()
  const filtered = patterns.filter(p => p.id !== patternId)
  localStorage.setItem('pagination-patterns', JSON.stringify(filtered))
}
