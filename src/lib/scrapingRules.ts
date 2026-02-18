export type WaitCondition = 
  | { type: 'selector'; selector: string; timeout?: number }
  | { type: 'xpath'; xpath: string; timeout?: number }
  | { type: 'text'; text: string; timeout?: number }
  | { type: 'url'; pattern: string; timeout?: number }
  | { type: 'networkIdle'; timeout?: number }
  | { type: 'delay'; ms: number }
  | { type: 'function'; code: string; timeout?: number }

export type ExtractionRule = {
  name: string
  selector?: string
  xpath?: string
  attribute?: string
  regex?: string
  transform?: string
  multiple?: boolean
  required?: boolean
}

export type JavaScriptAction = {
  type: 'execute' | 'click' | 'scroll' | 'fill' | 'select' | 'hover' | 'wait'
  selector?: string
  code?: string
  value?: string
  waitAfter?: number
  condition?: WaitCondition
}

export type ScrapingRule = {
  id: string
  name: string
  description?: string
  domain?: string
  urlPattern?: string
  priority?: number
  enabled: boolean
  
  waitConditions?: WaitCondition[]
  
  preActions?: JavaScriptAction[]
  
  extractionRules: ExtractionRule[]
  
  postActions?: JavaScriptAction[]
  
  pagination?: {
    enabled: boolean
    nextSelector?: string
    maxPages?: number
    waitBetweenPages?: number
  }
  
  authentication?: {
    type: 'none' | 'basic' | 'form' | 'custom'
    username?: string
    password?: string
    formSelectors?: {
      usernameField?: string
      passwordField?: string
      submitButton?: string
    }
    customCode?: string
  }
  
  headers?: Record<string, string>
  cookies?: Array<{ name: string; value: string; domain?: string }>
  
  rateLimit?: {
    requestsPerSecond?: number
    delayBetweenRequests?: number
  }
  
  errorHandling?: {
    retries?: number
    retryDelay?: number
    ignoreErrors?: boolean
  }
  
  createdAt: Date
  updatedAt: Date
}

export type ScrapingRuleSet = {
  id: string
  name: string
  description?: string
  rules: ScrapingRule[]
  createdAt: Date
  updatedAt: Date
}

export const DEFAULT_WAIT_TIMEOUT = 30000
export const DEFAULT_RETRY_COUNT = 3
export const DEFAULT_RETRY_DELAY = 2000
export const DEFAULT_RATE_LIMIT = 1

export function createDefaultRule(domain?: string): ScrapingRule {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: domain ? `Rule for ${domain}` : 'New Scraping Rule',
    description: '',
    domain,
    enabled: true,
    extractionRules: [
      {
        name: 'media_links',
        selector: 'a[href]',
        attribute: 'href',
        multiple: true,
        required: false
      }
    ],
    rateLimit: {
      requestsPerSecond: DEFAULT_RATE_LIMIT,
      delayBetweenRequests: 1000
    },
    errorHandling: {
      retries: DEFAULT_RETRY_COUNT,
      retryDelay: DEFAULT_RETRY_DELAY,
      ignoreErrors: false
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

export const PRESET_RULES: ScrapingRule[] = [
  {
    id: 'iptv-github',
    name: 'IPTV GitHub Repositories',
    description: 'Extract M3U playlists and media links from IPTV GitHub repositories',
    domain: 'github.com',
    urlPattern: '.*iptv.*',
    enabled: true,
    priority: 10,
    waitConditions: [
      { type: 'selector', selector: '.repository-content', timeout: 10000 },
      { type: 'networkIdle', timeout: 5000 }
    ],
    preActions: [
      {
        type: 'wait',
        condition: { type: 'selector', selector: '[data-testid="repos-split-pane-content"]', timeout: 10000 }
      }
    ],
    extractionRules: [
      {
        name: 'm3u_files',
        selector: 'a[href*=".m3u"], a[href*=".m3u8"]',
        attribute: 'href',
        multiple: true,
        required: false
      },
      {
        name: 'playlist_links',
        regex: 'https?:\\/\\/[^\\s<>"]+\\.m3u8?(?:\\?[^\\s<>"]*)?',
        multiple: true
      },
      {
        name: 'raw_content_links',
        selector: 'a[href*="raw.githubusercontent.com"]',
        attribute: 'href',
        multiple: true
      }
    ],
    rateLimit: {
      requestsPerSecond: 2,
      delayBetweenRequests: 500
    },
    errorHandling: {
      retries: 3,
      retryDelay: 2000,
      ignoreErrors: false
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'xtream-portal',
    name: 'Xtream Codes Portal',
    description: 'Extract streams from Xtream Codes web portals',
    urlPattern: '.*portal\\.php.*|.*player_api\\.php.*',
    enabled: true,
    priority: 9,
    waitConditions: [
      { type: 'delay', ms: 2000 },
      { type: 'selector', selector: 'body', timeout: 5000 }
    ],
    preActions: [
      {
        type: 'execute',
        code: `
          const authData = localStorage.getItem('auth_data');
          if (authData) {
            console.log('Found auth data:', authData);
          }
        `
      }
    ],
    extractionRules: [
      {
        name: 'live_streams',
        selector: '[data-stream-type="live"]',
        attribute: 'data-stream-url',
        multiple: true
      },
      {
        name: 'vod_streams',
        selector: '[data-stream-type="vod"]',
        attribute: 'data-stream-url',
        multiple: true
      },
      {
        name: 'api_endpoints',
        regex: 'https?:\\/\\/[^\\s]+\\/player_api\\.php\\?[^\\s<>"]+',
        multiple: true
      }
    ],
    rateLimit: {
      requestsPerSecond: 1,
      delayBetweenRequests: 1500
    },
    errorHandling: {
      retries: 5,
      retryDelay: 3000,
      ignoreErrors: true
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'kodi-addon-repo',
    name: 'Kodi Addon Repository',
    description: 'Extract addon metadata and download links from Kodi repositories',
    urlPattern: '.*addons\\.xml.*|.*repository\\..*',
    enabled: true,
    priority: 8,
    waitConditions: [
      { type: 'networkIdle', timeout: 5000 }
    ],
    extractionRules: [
      {
        name: 'addon_xml',
        selector: 'addon[id]',
        attribute: 'id',
        multiple: true
      },
      {
        name: 'zip_downloads',
        selector: 'a[href*=".zip"]',
        attribute: 'href',
        multiple: true
      },
      {
        name: 'source_urls',
        regex: 'https?:\\/\\/[^\\s<>"]+\\.zip',
        multiple: true
      }
    ],
    rateLimit: {
      requestsPerSecond: 3,
      delayBetweenRequests: 333
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'pastebin-style',
    name: 'Pastebin-style Sites',
    description: 'Extract raw text content from pastebin, hastebin, and similar services',
    urlPattern: '.*pastebin.*|.*hastebin.*|.*paste.*',
    enabled: true,
    priority: 7,
    waitConditions: [
      { type: 'selector', selector: 'pre, textarea, .paste-content', timeout: 10000 }
    ],
    preActions: [
      {
        type: 'click',
        selector: 'button[data-action="raw"], .raw-button',
        waitAfter: 1000
      }
    ],
    extractionRules: [
      {
        name: 'text_content',
        selector: 'pre, textarea, .paste-content, .raw-content',
        multiple: false,
        required: true
      },
      {
        name: 'all_links',
        regex: 'https?:\\/\\/[^\\s<>"]+',
        multiple: true
      }
    ],
    rateLimit: {
      requestsPerSecond: 2,
      delayBetweenRequests: 500
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'streaming-site',
    name: 'Generic Streaming Site',
    description: 'Extract video and audio streams from common streaming sites',
    enabled: true,
    priority: 5,
    waitConditions: [
      { type: 'delay', ms: 3000 },
      { type: 'selector', selector: 'video, audio', timeout: 15000 }
    ],
    preActions: [
      {
        type: 'execute',
        code: `
          // Block ads and overlays
          const overlays = document.querySelectorAll('.ad, .advertisement, [id*="ad-"], [class*="ad-"]');
          overlays.forEach(el => el.remove());
          
          // Trigger video load
          const videos = document.querySelectorAll('video');
          videos.forEach(v => {
            v.play().catch(() => {});
            setTimeout(() => v.pause(), 500);
          });
        `,
        waitAfter: 2000
      }
    ],
    extractionRules: [
      {
        name: 'video_sources',
        selector: 'video source, video',
        attribute: 'src',
        multiple: true
      },
      {
        name: 'audio_sources',
        selector: 'audio source, audio',
        attribute: 'src',
        multiple: true
      },
      {
        name: 'm3u8_links',
        regex: 'https?:\\/\\/[^\\s<>"]+\\.m3u8(?:[^\\s<>"]*)?',
        multiple: true
      },
      {
        name: 'mp4_links',
        regex: 'https?:\\/\\/[^\\s<>"]+\\.mp4(?:[^\\s<>"]*)?',
        multiple: true
      }
    ],
    postActions: [
      {
        type: 'execute',
        code: `
          // Extract from JavaScript variables
          const scripts = document.querySelectorAll('script:not([src])');
          const links = [];
          scripts.forEach(script => {
            const matches = script.textContent.match(/https?:\\/\\/[^\\s<>"']+\\.m3u8[^\\s<>"']*/g);
            if (matches) links.push(...matches);
          });
          return links;
        `
      }
    ],
    rateLimit: {
      requestsPerSecond: 1,
      delayBetweenRequests: 2000
    },
    errorHandling: {
      retries: 3,
      retryDelay: 3000,
      ignoreErrors: true
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'spa-ajax-site',
    name: 'Single Page Application (SPA)',
    description: 'Handle dynamic content loaded via AJAX/JavaScript',
    enabled: true,
    priority: 6,
    waitConditions: [
      { type: 'networkIdle', timeout: 10000 },
      {
        type: 'function',
        code: `
          return new Promise((resolve) => {
            let stabilityCount = 0;
            let lastCount = 0;
            
            const check = () => {
              const currentCount = document.querySelectorAll('a[href]').length;
              
              if (currentCount === lastCount) {
                stabilityCount++;
                if (stabilityCount >= 3) {
                  resolve(true);
                  return;
                }
              } else {
                stabilityCount = 0;
                lastCount = currentCount;
              }
              
              if (stabilityCount < 10) {
                setTimeout(check, 500);
              } else {
                resolve(true);
              }
            };
            
            check();
          });
        `,
        timeout: 30000
      }
    ],
    preActions: [
      {
        type: 'scroll',
        code: `
          // Infinite scroll trigger
          await new Promise((resolve) => {
            let scrollCount = 0;
            const maxScrolls = 10;
            
            const scrollInterval = setInterval(() => {
              window.scrollTo(0, document.body.scrollHeight);
              scrollCount++;
              
              if (scrollCount >= maxScrolls) {
                clearInterval(scrollInterval);
                setTimeout(resolve, 2000);
              }
            }, 1000);
          });
        `,
        waitAfter: 3000
      }
    ],
    extractionRules: [
      {
        name: 'dynamic_links',
        selector: 'a[href]',
        attribute: 'href',
        multiple: true
      },
      {
        name: 'data_attributes',
        selector: '[data-src], [data-url], [data-link]',
        attribute: 'data-src',
        multiple: true
      }
    ],
    rateLimit: {
      requestsPerSecond: 1,
      delayBetweenRequests: 2000
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
]

export function matchRuleToUrl(url: string, rules: ScrapingRule[]): ScrapingRule | null {
  const enabledRules = rules.filter(r => r.enabled)
  
  const matchingRules = enabledRules.filter(rule => {
    if (rule.domain) {
      const urlObj = new URL(url)
      if (!urlObj.hostname.includes(rule.domain)) {
        return false
      }
    }
    
    if (rule.urlPattern) {
      const regex = new RegExp(rule.urlPattern, 'i')
      if (!regex.test(url)) {
        return false
      }
    }
    
    return true
  })
  
  if (matchingRules.length === 0) {
    return null
  }
  
  matchingRules.sort((a, b) => (b.priority || 0) - (a.priority || 0))
  
  return matchingRules[0]
}

export function validateRule(rule: ScrapingRule): string[] {
  const errors: string[] = []
  
  if (!rule.name || rule.name.trim() === '') {
    errors.push('Rule name is required')
  }
  
  if (rule.extractionRules.length === 0) {
    errors.push('At least one extraction rule is required')
  }
  
  rule.extractionRules.forEach((extraction, index) => {
    if (!extraction.name || extraction.name.trim() === '') {
      errors.push(`Extraction rule ${index + 1}: name is required`)
    }
    
    if (!extraction.selector && !extraction.xpath && !extraction.regex) {
      errors.push(`Extraction rule "${extraction.name}": must have selector, xpath, or regex`)
    }
  })
  
  if (rule.waitConditions) {
    rule.waitConditions.forEach((condition, index) => {
      if (condition.type === 'selector' && !condition.selector) {
        errors.push(`Wait condition ${index + 1}: selector is required`)
      }
      if (condition.type === 'xpath' && !condition.xpath) {
        errors.push(`Wait condition ${index + 1}: xpath is required`)
      }
      if (condition.type === 'delay' && !condition.ms) {
        errors.push(`Wait condition ${index + 1}: delay ms is required`)
      }
    })
  }
  
  return errors
}

export function exportRuleSet(rules: ScrapingRule[], name: string): ScrapingRuleSet {
  return {
    id: `ruleset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    rules,
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

export function importRuleSet(data: string): ScrapingRuleSet {
  try {
    const parsed = JSON.parse(data)
    
    if (!parsed.rules || !Array.isArray(parsed.rules)) {
      throw new Error('Invalid rule set format')
    }
    
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      updatedAt: new Date(parsed.updatedAt),
      rules: parsed.rules.map((r: any) => ({
        ...r,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt)
      }))
    }
  } catch (error) {
    throw new Error(`Failed to import rule set: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
