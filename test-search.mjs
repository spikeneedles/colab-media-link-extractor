/**
 * Search Crawler Test Script
 * 
 * This script demonstrates how to use the search crawler API
 * to search for media across different sources.
 * 
 * Usage:
 *   node test-search.mjs "your search query"
 *   node test-search.mjs "cooking videos" youtube
 *   node test-search.mjs "action movies" xvideos 5
 */

const API_BASE = 'http://localhost:3002'

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
}

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.bright}${msg}${colors.reset}`),
}

/**
 * Fetch available presets
 */
async function getPresets() {
  const response = await fetch(`${API_BASE}/api/search/presets`)
  if (!response.ok) {
    throw new Error('Failed to fetch presets')
  }
  return await response.json()
}

/**
 * Execute a search
 */
async function search(presetId, query, maxPages = 3) {
  const response = await fetch(`${API_BASE}/api/search/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presetId, query, maxPages }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Search failed')
  }

  return await response.json()
}

/**
 * Execute multi-source search
 */
async function multiSearch(presetIds, query, maxPages = 3) {
  const response = await fetch(`${API_BASE}/api/search/execute-multi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presetIds, query, maxPages }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Multi-search failed')
  }

  return await response.json()
}

/**
 * Display search results
 */
function displayResults(result) {
  log.section('Search Results')
  console.log(`Query: ${colors.bright}${result.searchQuery}${colors.reset}`)
  console.log(`Total Results: ${colors.green}${result.totalResults}${colors.reset}`)
  console.log(`Pages Scraped: ${result.pagesScraped}`)
  console.log(`Execution Time: ${(result.executionTime / 1000).toFixed(2)}s`)

  if (result.errors && result.errors.length > 0) {
    log.warning(`Errors: ${result.errors.length}`)
    result.errors.forEach((err) => log.error(err))
  }

  log.section('Top 10 Results')
  result.results.slice(0, 10).forEach((item, index) => {
    console.log(`\n${colors.bright}${index + 1}.${colors.reset} ${item.title || 'No title'}`)
    console.log(`   ${colors.cyan}URL:${colors.reset} ${item.url}`)
    if (item.thumbnail) {
      console.log(`   ${colors.cyan}Thumbnail:${colors.reset} ${item.thumbnail}`)
    }
    if (item.metadata) {
      Object.entries(item.metadata).forEach(([key, value]) => {
        console.log(`   ${colors.cyan}${key}:${colors.reset} ${value}`)
      })
    }
  })

  if (result.totalResults > 10) {
    log.info(`... and ${result.totalResults - 10} more results`)
  }
}

/**
 * Display multi-search results summary
 */
function displayMultiResults(data) {
  log.section('Multi-Source Search Summary')
  console.log(`Total Sources: ${data.summary.totalSources}`)
  console.log(`Total Results: ${colors.green}${data.summary.totalResults}${colors.reset}`)
  console.log(`Total Pages: ${data.summary.totalPages}`)
  console.log(`Total Time: ${(data.summary.totalTime / 1000).toFixed(2)}s`)

  log.section('Results by Source')
  Object.entries(data.results).forEach(([sourceId, result]) => {
    console.log(`\n${colors.bright}${sourceId}${colors.reset}`)
    console.log(`  Results: ${colors.green}${result.totalResults}${colors.reset}`)
    console.log(`  Pages: ${result.pagesScraped}`)
    console.log(`  Time: ${(result.executionTime / 1000).toFixed(2)}s`)

    if (result.errors && result.errors.length > 0) {
      log.warning(`  Errors: ${result.errors.join(', ')}`)
    }

    // Show top 3 results from each source
    if (result.results.length > 0) {
      console.log(`  ${colors.cyan}Top results:${colors.reset}`)
      result.results.slice(0, 3).forEach((item, idx) => {
        console.log(`    ${idx + 1}. ${item.title || item.url}`)
      })
    }
  })
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
${colors.bright}Search Crawler Test Script${colors.reset}

Usage:
  node test-search.mjs <query> [preset] [maxPages]
  node test-search.mjs --list
  node test-search.mjs --multi <query> [maxPages]

Examples:
  node test-search.mjs "cooking videos"
  node test-search.mjs "action movies" youtube 5
  node test-search.mjs --multi "music videos" 3
  node test-search.mjs --list

Options:
  --list          List all available presets
  --multi         Search across multiple sources
  <query>         Search query string
  [preset]        Preset ID (default: first available)
  [maxPages]      Max pages to scrape (default: 3)
    `)
    process.exit(0)
  }

  try {
    // Check if backend is running
    log.info('Checking backend connection...')
    const healthCheck = await fetch(`${API_BASE}/api/health`)
    if (!healthCheck.ok) {
      log.error('Backend is not responding. Make sure it is running on port 3001.')
      process.exit(1)
    }
    log.success('Connected to backend')

    // List presets
    if (args[0] === '--list') {
      const data = await getPresets()
      log.section('Available Search Presets')
      data.presets.forEach((preset) => {
        console.log(`\n${colors.bright}${preset.id}${colors.reset}`)
        console.log(`  Name: ${preset.name}`)
        console.log(`  URL: ${preset.baseUrl}`)
        console.log(`  Method: ${preset.searchMethod}`)
        console.log(`  Form: ${preset.supportsForm ? '✓' : '✗'}`)
        console.log(`  Pagination: ${preset.supportsPagination ? '✓' : '✗'}`)
      })
      return
    }

    // Multi-source search
    if (args[0] === '--multi') {
      if (args.length < 2) {
        log.error('Please provide a search query')
        process.exit(1)
      }

      const query = args[1]
      const maxPages = parseInt(args[2]) || 3

      log.info(`Fetching available presets...`)
      const presetsData = await getPresets()
      
      // Use video platforms (excluding adult sites for this example)
      const videoPresets = ['youtube', 'vimeo', 'dailymotion', 'twitch-videos']
      const availableIds = presetsData.presets
        .filter(p => videoPresets.includes(p.id))
        .map(p => p.id)

      if (availableIds.length === 0) {
        log.error('No video presets available')
        process.exit(1)
      }

      log.info(`Searching ${availableIds.length} sources for: "${query}"`)
      log.info(`This may take a while...`)

      const startTime = Date.now()
      const data = await multiSearch(availableIds, query, maxPages)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

      log.success(`Search completed in ${elapsed}s`)
      displayMultiResults(data)
      return
    }

    // Single source search
    const query = args[0]
    const presetId = args[1]
    const maxPages = parseInt(args[2]) || 3

    let selectedPresetId = presetId

    if (!selectedPresetId) {
      log.info('No preset specified, fetching available presets...')
      const data = await getPresets()
      
      if (data.presets.length === 0) {
        log.error('No presets available')
        process.exit(1)
      }

      // Use first available preset
      selectedPresetId = data.presets[0].id
      log.info(`Using preset: ${selectedPresetId}`)
    }

    log.info(`Searching ${selectedPresetId} for: "${query}"`)
    log.info(`Max pages: ${maxPages}`)
    log.info('This may take a while...')

    const startTime = Date.now()
    const data = await search(selectedPresetId, query, maxPages)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

    log.success(`Search completed in ${elapsed}s`)
    displayResults(data.result)

  } catch (error) {
    log.error(`Error: ${error.message}`)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// Run the script
main()
