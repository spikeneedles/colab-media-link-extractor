import { Page } from 'puppeteer'
import { BrowserPool } from '../browserPool.js'
import { flareSolverr, isCloudflareBlocked } from './FlareSolverrClient.js'

/**
 * Configuration for a website search source
 */
export interface SearchSourceConfig {
  id: string
  name: string
  baseUrl: string
  searchMethod: 'form' | 'url' | 'api'
  
  // For form-based search
  formConfig?: {
    formSelector?: string // CSS selector for the form (optional if using input directly)
    inputSelector: string // CSS selector for search input (e.g., 'input[name="k"]')
    submitSelector?: string // CSS selector for submit button (optional - can press Enter)
    waitForResults?: string // CSS selector to wait for after submitting
  }
  
  // For URL-based search (e.g., /search?q=QUERY)
  urlTemplate?: string // e.g., 'https://example.com/search?q={query}'
  
  // For API-based search
  apiConfig?: {
    endpoint: string
    method: 'GET' | 'POST'
    queryParam?: string // Parameter name for query (e.g., 'q', 'search', 'keyword')
    headers?: Record<string, string>
    bodyTemplate?: string // JSON template with {query} placeholder
  }
  
  // Result extraction
  resultSelectors: {
    containerSelector: string // Container for each result item
    linkSelector: string // Link within each container
    titleSelector?: string // Optional title selector
    thumbnailSelector?: string // Optional thumbnail selector
    metadataSelectors?: Record<string, string> // Additional metadata
  }
  
  // Pagination support
  pagination?: {
    nextButtonSelector?: string // CSS selector for "Next" button
    pageUrlTemplate?: string // e.g., '/search?q={query}&page={page}'
    maxPages?: number // Maximum pages to crawl (default: 5)
  }
  
  // Browser options
  browserOptions?: {
    blockImages?: boolean
    blockStyles?: boolean
    blockFonts?: boolean
    timeout?: number
    userAgent?: string
    viewport?: { width: number; height: number }
  }
}

export interface SearchResult {
  url: string
  title?: string
  thumbnail?: string
  metadata?: Record<string, string>
  sourceConfig: string // ID of the search source
  searchQuery: string
  pageNumber: number
}

export interface SearchCrawlResult {
  searchQuery: string
  totalResults: number
  results: SearchResult[]
  pagesScraped: number
  executionTime: number
  errors?: string[]
}

export class SearchCrawler {
  private browserPool: BrowserPool

  constructor(browserPool: BrowserPool) {
    this.browserPool = browserPool
  }

  /**
   * Execute a search query on a configured source
   */
  async search(
    config: SearchSourceConfig,
    query: string,
    maxPages: number = 5
  ): Promise<SearchCrawlResult> {
    const startTime = Date.now()
    const allResults: SearchResult[] = []
    const errors: string[] = []
    let pagesScraped = 0

    // API-mode: bypass browser entirely
    if (config.searchMethod === 'api') {
      try {
        const apiResults = await this.performApiSearch(config, query)
        return {
          searchQuery: query,
          totalResults: apiResults.length,
          results: apiResults,
          pagesScraped: 1,
          executionTime: Date.now() - startTime,
        }
      } catch (err) {
        return {
          searchQuery: query,
          totalResults: 0,
          results: [],
          pagesScraped: 0,
          executionTime: Date.now() - startTime,
          errors: [err instanceof Error ? err.message : String(err)],
        }
      }
    }

    let page: import('puppeteer').Page | null = null
    try {
      page = await this.browserPool.getPage()

      // Configure browser options
      if (config.browserOptions) {
        await this.configureBrowser(page, config.browserOptions)
      }

      // Perform initial search
      await this.performSearch(page, config, query)

      // Extract results from first page
      const firstPageResults = await this.extractResults(page, config, query, 1)
      allResults.push(...firstPageResults)
      pagesScraped = 1

      // Handle pagination if configured
      if (config.pagination && maxPages > 1) {
        const pagesToCrawl = Math.min(
          maxPages - 1,
          (config.pagination.maxPages || 5) - 1
        )

        for (let i = 0; i < pagesToCrawl; i++) {
          try {
            const hasNextPage = await this.goToNextPage(page, config, query, i + 2)

            if (!hasNextPage) {
              break
            }

            const pageResults = await this.extractResults(page, config, query, i + 2)
            allResults.push(...pageResults)
            pagesScraped++

            // Small delay between pages
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))
          } catch (error) {
            const errorMsg = `Error on page ${i + 2}: ${error instanceof Error ? error.message : String(error)}`
            console.error(errorMsg)
            errors.push(errorMsg)
            break
          }
        }
      }
    } catch (error) {
      const errorMsg = `Search failed: ${error instanceof Error ? error.message : String(error)}`
      console.error(errorMsg)
      errors.push(errorMsg)
    } finally {
      // Always release the page back to the pool
      if (page) {
        await this.browserPool.releasePage(page).catch(() => {})
      }
    }

    return {
      searchQuery: query,
      totalResults: allResults.length,
      results: allResults,
      pagesScraped,
      executionTime: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined,
    }
  }

  /**
   * Configure browser with specified options
   */
  private async configureBrowser(
    page: Page,
    options: SearchSourceConfig['browserOptions']
  ): Promise<void> {
    if (!options) return

    if (options.userAgent) {
      await page.setUserAgent(options.userAgent)
    }

    if (options.viewport) {
      await page.setViewport(options.viewport)
    }

    if (options.blockImages || options.blockStyles || options.blockFonts) {
      // Remove any existing request listeners to avoid conflicts
      page.removeAllListeners('request')
      
      await page.setRequestInterception(true)
      page.on('request', (request) => {
        const resourceType = request.resourceType()
        if (
          (options.blockImages && resourceType === 'image') ||
          (options.blockStyles && resourceType === 'stylesheet') ||
          (options.blockFonts && resourceType === 'font')
        ) {
          request.abort()
        } else {
          request.continue()
        }
      })
    }
  }

  /**
   * Perform the initial search based on config method
   */
  private async performSearch(
    page: Page,
    config: SearchSourceConfig,
    query: string
  ): Promise<void> {
    const timeout = config.browserOptions?.timeout || 30000

    switch (config.searchMethod) {
      case 'form':
        await this.performFormSearch(page, config, query, timeout)
        break
      
      case 'url':
        await this.performUrlSearch(page, config, query, timeout)
        break
      
      case 'api':
        // Handled before browser acquisition in search() — should never reach here
        throw new Error('API search handled outside browser context')
      
      default:
        throw new Error(`Unknown search method: ${config.searchMethod}`)
    }
  }

  /**
   * Perform form-based search (like your xvideos.com example)
   */
  private async performFormSearch(
    page: Page,
    config: SearchSourceConfig,
    query: string,
    timeout: number
  ): Promise<void> {
    if (!config.formConfig) {
      throw new Error('Form config is required for form-based search')
    }

    // Navigate to base URL
    await page.goto(config.baseUrl, { waitUntil: 'networkidle2', timeout })

    // Wait for search input to be available
    await page.waitForSelector(config.formConfig.inputSelector, { timeout })

    // Fill in the search query
    await page.type(config.formConfig.inputSelector, query)

    // Submit the form
    if (config.formConfig.submitSelector) {
      // Click submit button if specified
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout }),
        page.click(config.formConfig.submitSelector),
      ])
    } else {
      // Press Enter to submit
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout }),
        page.keyboard.press('Enter'),
      ])
    }

    // Wait for results if specified
    if (config.formConfig.waitForResults) {
      await page.waitForSelector(config.formConfig.waitForResults, { timeout })
    }
  }

  /**
   * Perform URL-based search (e.g., /search?q=query)
   */
  private async performUrlSearch(
    page: Page,
    config: SearchSourceConfig,
    query: string,
    timeout: number
  ): Promise<void> {
    if (!config.urlTemplate) {
      throw new Error('URL template is required for URL-based search')
    }

    const searchUrl = config.urlTemplate.replace('{query}', encodeURIComponent(query))

    // Try networkidle2 first; fall back to domcontentloaded for slow/heavy pages
    try {
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout })
    } catch {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout })
    }

    // Check for Cloudflare block and retry via FlareSolverr if needed
    await this.bypassCloudflareIfNeeded(page, searchUrl, timeout)

    // Wait for results container — non-fatal; extractResults will just return []
    try {
      await page.waitForSelector(config.resultSelectors.containerSelector, { timeout: Math.min(timeout, 10000) })
    } catch {
      console.warn(`[SearchCrawler] Container selector "${config.resultSelectors.containerSelector}" not found on ${searchUrl}`)
    }
  }

  /**
   * Execute an API-based search using axios (no browser required).
   */
  private async performApiSearch(
    config: SearchSourceConfig,
    query: string
  ): Promise<SearchResult[]> {
    if (!config.apiConfig) throw new Error('apiConfig is required for api search method')

    const { endpoint, method, queryParam, headers, bodyTemplate } = config.apiConfig
    const url = queryParam
      ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}${queryParam}=${encodeURIComponent(query)}`
      : endpoint

    const axiosConfig = {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ArchivistSILAS/1.0)', ...(headers ?? {}) },
      timeout: config.browserOptions?.timeout ?? 30000,
    }

    let data: any
    if (method === 'POST' && bodyTemplate) {
      const body = bodyTemplate.replace('{query}', query)
      const parsed = JSON.parse(body)
      const response = await import('axios').then(m => m.default.post(url, parsed, axiosConfig))
      data = response.data
    } else {
      const response = await import('axios').then(m => m.default.get(url, axiosConfig))
      data = response.data
    }

    // Normalise common API shapes into SearchResult[]
    const items: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.results)   ? data.results
      : Array.isArray(data?.data)       ? data.data
      : Array.isArray(data?.items)      ? data.items
      : Array.isArray(data?.torrents)   ? data.torrents
      : []

    return items.map((item: any) => ({
      url:          item.url ?? item.link ?? item.magnetUrl ?? item.downloadUrl ?? item.guid ?? '',
      title:        item.title ?? item.name ?? item.filename ?? '',
      thumbnail:    item.poster ?? item.thumbnail ?? item.image ?? undefined,
      metadata: {
        seeders:  String(item.seeders ?? ''),
        size:     String(item.size ?? ''),
        category: String(item.category ?? ''),
        indexer:  String(item.indexer ?? ''),
      },
      sourceConfig: config.id,
      searchQuery:  query,
      pageNumber:   1,
    })).filter(r => r.url)
  }

  /**
   * If the current page looks like a Cloudflare challenge, fetch the real content
   * via FlareSolverr and inject it into the page so downstream selectors still work.
   */
  private async bypassCloudflareIfNeeded(page: Page, url: string, timeout: number): Promise<void> {
    try {
      const bodyText = await page.evaluate(() => document.body?.innerText ?? '')
      const isBlocked = isCloudflareBlocked({ body: bodyText, status: undefined })
      if (!isBlocked) return

      console.log(`[SearchCrawler] Cloudflare detected on ${url} — trying FlareSolverr…`)
      const solution = await flareSolverr.get(url)
      if (!solution) {
        console.warn(`[SearchCrawler] FlareSolverr unavailable, proceeding with blocked page`)
        return
      }

      // Inject FlareSolverr cookies into the page session
      const client = await page.target().createCDPSession()
      for (const cookie of solution.cookies) {
        await client.send('Network.setCookie', {
          name:     cookie.name,
          value:    cookie.value,
          domain:   cookie.domain,
          path:     cookie.path,
          secure:   cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite as any,
        }).catch(() => {})
      }

      // Set the solved user-agent so subsequent requests match
      await page.setUserAgent(solution.userAgent)

      // Re-navigate now that cookies are set
      await page.goto(url, { waitUntil: 'networkidle2', timeout })
      console.log(`[SearchCrawler] ✓ CF bypass successful for ${url}`)
    } catch (err: any) {
      console.warn(`[SearchCrawler] bypassCloudflare error: ${err.message}`)
    }
  }

  /**
   * Extract results from current page
   */
  private async extractResults(
    page: Page,
    config: SearchSourceConfig,
    query: string,
    pageNumber: number
  ): Promise<SearchResult[]> {
    const { containerSelector, linkSelector, titleSelector, thumbnailSelector, metadataSelectors } =
      config.resultSelectors

    const results = await page.evaluate(
      (
        containerSel: string,
        linkSel: string,
        titleSel: string | undefined,
        thumbnailSel: string | undefined,
        metadataSels: Record<string, string> | undefined,
        configId: string,
        searchQuery: string,
        pageNum: number
      ) => {
        const containers = Array.from(document.querySelectorAll(containerSel))
        const debugInfo = {
          containerCount: containers.length,
          containerSelector: containerSel,
          linkSelector: linkSel,
          htmlSnippet: document.body.innerHTML.substring(0, 500),
          firstContainerHTML: containers[0]?.outerHTML?.substring(0, 800) || 'No containers found',
          linkElementsFound: containers[0]?.querySelectorAll('a').length || 0
        }
        
        const extracted: SearchResult[] = []

        for (const container of containers) {
          try {
            // Extract link (required)
            const linkElement = container.querySelector(linkSel) as HTMLAnchorElement | null
            if (!linkElement || !linkElement.href) {
              continue
            }

            const result: SearchResult = {
              url: linkElement.href,
              sourceConfig: configId,
              searchQuery: searchQuery,
              pageNumber: pageNum,
            }

            // Extract title (optional)
            if (titleSel) {
              const titleElement = container.querySelector(titleSel)
              if (titleElement) {
                result.title = titleElement.textContent?.trim() || undefined
              }
            }

            // Extract thumbnail (optional)
            if (thumbnailSel) {
              const thumbnailElement = container.querySelector(thumbnailSel) as HTMLImageElement | null
              if (thumbnailElement) {
                result.thumbnail = thumbnailElement.src || thumbnailElement.dataset.src || undefined
              }
            }

            // Extract additional metadata (optional)
            if (metadataSels) {
              result.metadata = {}
              for (const [key, selector] of Object.entries(metadataSels)) {
                const metaElement = container.querySelector(selector)
                if (metaElement) {
                  result.metadata[key] = metaElement.textContent?.trim() || ''
                }
              }
            }

            extracted.push(result)
          } catch (error) {
            // Errors are silent in browser context
          }
        }

        return { results: extracted, debug: debugInfo }
      },
      containerSelector,
      linkSelector,
      titleSelector,
      thumbnailSelector,
      metadataSelectors,
      config.id,
      query,
      pageNumber
    )

    console.log(`[SearchCrawler] Found ${results.debug.containerCount} containers with selector: ${results.debug.containerSelector}`)
    console.log(`[SearchCrawler] First container has ${results.debug.linkElementsFound} <a> elements`)
    console.log(`[SearchCrawler] First container HTML:`, results.debug.firstContainerHTML)
    console.log(`[SearchCrawler] Extracted ${results.results.length} results from page ${pageNumber}`)
    return results.results
  }

  /**
   * Navigate to next page of results
   */
  private async goToNextPage(
    page: Page,
    config: SearchSourceConfig,
    query: string,
    pageNumber: number
  ): Promise<boolean> {
    if (!config.pagination) return false

    const timeout = config.browserOptions?.timeout || 30000

    try {
      if (config.pagination.nextButtonSelector) {
        // Click next button
        const nextButton = await page.$(config.pagination.nextButtonSelector)
        if (!nextButton) return false

        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout }),
          nextButton.click(),
        ])

        return true
      } else if (config.pagination.pageUrlTemplate) {
        // Navigate to page URL
        const pageUrl = config.pagination.pageUrlTemplate
          .replace('{query}', encodeURIComponent(query))
          .replace('{page}', String(pageNumber))

        await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout })
        
        // Verify results container exists
        await page.waitForSelector(config.resultSelectors.containerSelector, { timeout: 5000 })
        
        return true
      }

      return false
    } catch (error) {
      console.error(`Failed to navigate to page ${pageNumber}:`, error)
      return false
    }
  }

  /**
   * Search multiple sources in true parallel using Promise.allSettled.
   * All sources run concurrently up to the BrowserPool's concurrency limit.
   */
  async searchMultipleSources(
    configs: SearchSourceConfig[],
    query: string,
    maxPages: number = 5,
    concurrency: number = 6
  ): Promise<Record<string, SearchCrawlResult>> {
    const results: Record<string, SearchCrawlResult> = {}

    // Process in parallel batches to respect BrowserPool limits
    for (let i = 0; i < configs.length; i += concurrency) {
      const batch = configs.slice(i, i + concurrency)
      const settled = await Promise.allSettled(
        batch.map(async (config) => {
          console.log(`[SearchCrawler] Searching ${config.name} for: "${query}"`)
          return { id: config.id, result: await this.search(config, query, maxPages) }
        })
      )

      for (const outcome of settled) {
        if (outcome.status === 'fulfilled') {
          results[outcome.value.id] = outcome.value.result
        } else {
          // Find which config errored by cross-referencing batch index
          const idx = settled.indexOf(outcome as any)
          const config = batch[idx]
          if (config) {
            results[config.id] = {
              searchQuery: query,
              totalResults: 0,
              results: [],
              pagesScraped: 0,
              executionTime: 0,
              errors: [outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)],
            }
          }
        }
      }
    }

    return results
  }
}
