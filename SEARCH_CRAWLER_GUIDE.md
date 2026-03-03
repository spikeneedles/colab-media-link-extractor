# Search Crawler Guide

## Overview

The Search Crawler feature allows you to use any website's search function as a source for media discovery. It leverages Puppeteer's headless browser to:

- Fill in search forms automatically
- Navigate search result pages
- Extract media links from search results
- Support pagination for deep crawling
- Handle both form-based and URL-based searches

## Quick Start

### 1. Start the Backend

```bash
cd backend
npm install
npm start
```

The backend with Puppeteer support will start on `http://localhost:3001`.

### 2. Use a Preset Configuration

The system comes with several pre-configured sources:

- **XVideos** - Adult video site (form-based search)
- **PornHub** - Adult video site (URL-based search)
- **YouTube** - Video platform
- **Vimeo** - Video platform
- **Dailymotion** - Video platform
- **Twitch** - Live streaming and videos

### 3. Execute a Search

**Using cURL:**

```bash
curl -X POST http://localhost:3001/api/search/execute \
  -H "Content-Type: application/json" \
  -d '{
    "presetId": "xvideos",
    "query": "best moments",
    "maxPages": 3
  }'
```

**Using JavaScript:**

```javascript
const response = await fetch('http://localhost:3001/api/search/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    presetId: 'xvideos',
    query: 'best moments',
    maxPages: 3
  })
})

const data = await response.json()
console.log(`Found ${data.result.totalResults} results`)
console.log(data.result.results)
```

## API Endpoints

### Get All Presets

```http
GET /api/search/presets
```

**Response:**

```json
{
  "success": true,
  "count": 8,
  "presets": [
    {
      "id": "xvideos",
      "name": "XVideos",
      "baseUrl": "https://www.xvideos.com/",
      "searchMethod": "form",
      "supportsForm": true,
      "supportsUrl": false,
      "supportsPagination": true
    },
    ...
  ]
}
```

### Get Specific Preset

```http
GET /api/search/presets/:id
```

**Example:**

```bash
curl http://localhost:3001/api/search/presets/xvideos
```

### Execute Search

```http
POST /api/search/execute
```

**Request Body:**

```json
{
  "presetId": "xvideos",
  "query": "your search query",
  "maxPages": 5
}
```

**Response:**

```json
{
  "success": true,
  "result": {
    "searchQuery": "your search query",
    "totalResults": 120,
    "results": [
      {
        "url": "https://www.xvideos.com/video12345",
        "title": "Video Title",
        "thumbnail": "https://cdn.xvideos.com/thumb.jpg",
        "metadata": {
          "duration": "10:30",
          "views": "1.2M"
        },
        "sourceConfig": "xvideos",
        "searchQuery": "your search query",
        "pageNumber": 1
      },
      ...
    ],
    "pagesScraped": 5,
    "executionTime": 15234,
    "errors": []
  }
}
```

### Execute Multi-Source Search

```http
POST /api/search/execute-multi
```

**Request Body:**

```json
{
  "presetIds": ["xvideos", "pornhub", "youtube"],
  "query": "your search query",
  "maxPages": 3
}
```

**Response:**

```json
{
  "success": true,
  "results": {
    "xvideos": { ... },
    "pornhub": { ... },
    "youtube": { ... }
  },
  "summary": {
    "totalSources": 3,
    "totalResults": 350,
    "totalPages": 9,
    "totalTime": 42000
  }
}
```

## Creating Custom Search Sources

### Form-Based Search (Like XVideos)

When a website uses a search form (like the xvideos.com example you provided):

```javascript
const customConfig = {
  id: 'my-custom-site',
  name: 'My Custom Site',
  baseUrl: 'https://example.com/',
  searchMethod: 'form',
  
  // Form configuration
  formConfig: {
    inputSelector: 'input[name="k"]',           // CSS selector for search input
    submitSelector: 'button[type="submit"]',    // Optional: submit button
    waitForResults: '.results-container'        // Wait for results to load
  },
  
  // How to extract results
  resultSelectors: {
    containerSelector: '.result-item',          // Each result container
    linkSelector: 'a.video-link',               // Link within container
    titleSelector: '.title',                    // Optional: title
    thumbnailSelector: 'img.thumbnail',         // Optional: thumbnail
    metadataSelectors: {                        // Optional: additional data
      duration: '.duration',
      views: '.view-count'
    }
  },
  
  // Pagination (optional)
  pagination: {
    nextButtonSelector: 'a.next-page',
    maxPages: 10
  },
  
  // Browser options
  browserOptions: {
    blockImages: false,  // Set to true to speed up
    blockStyles: false,
    blockFonts: true,
    timeout: 30000
  }
}

// Save it
await fetch('http://localhost:3001/api/search/custom/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(customConfig)
})

// Use it
await fetch('http://localhost:3001/api/search/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customConfig: customConfig,
    query: 'test search',
    maxPages: 3
  })
})
```

### URL-Based Search

When a website uses URL parameters for search:

```javascript
const urlConfig = {
  id: 'my-url-site',
  name: 'My URL Site',
  baseUrl: 'https://example.com/',
  searchMethod: 'url',
  
  // URL template with {query} placeholder
  urlTemplate: 'https://example.com/search?q={query}',
  
  resultSelectors: {
    containerSelector: '.search-result',
    linkSelector: 'a',
    titleSelector: 'h3',
    thumbnailSelector: 'img'
  },
  
  pagination: {
    pageUrlTemplate: 'https://example.com/search?q={query}&page={page}',
    maxPages: 5
  },
  
  browserOptions: {
    blockImages: true,
    timeout: 30000
  }
}
```

## Finding CSS Selectors

### Method 1: Browser DevTools

1. Right-click on the element you want to select
2. Click "Inspect" or "Inspect Element"
3. Right-click on the highlighted HTML in DevTools
4. Select "Copy" → "Copy selector"

### Method 2: Manual Selection

Common selector patterns:

```css
/* By ID */
#search-input

/* By name attribute */
input[name="q"]
input[name="k"]
input[name="search"]

/* By class */
.search-input
.result-item
.video-link

/* By type and attributes */
input[type="search"]
input[type="text"][placeholder="Search"]

/* Nested selectors */
.result .title
div.container > a.link

/* Multiple classes */
.search-input.form-control
```

## Real-World Example: XVideos

Based on your inspection, here's how the XVideos preset was created:

```javascript
{
  id: 'xvideos',
  name: 'XVideos',
  baseUrl: 'https://www.xvideos.com/',
  searchMethod: 'form',
  
  formConfig: {
    // The input has name="k" and class="search-input form-control"
    inputSelector: 'input[name="k"]',
    
    // The form will auto-submit on Enter, so no submitSelector needed
    // But we wait for the results grid to appear
    waitForResults: '.mozaique'
  },
  
  resultSelectors: {
    // Each video is in a .thumb-block within .mozaique
    containerSelector: '.mozaique .thumb-block',
    
    // The link is an <a> with class "thumb"
    linkSelector: 'a.thumb',
    
    // Title is in <p class="title"><a>...</a></p>
    titleSelector: 'p.title a',
    
    // Thumbnail image
    thumbnailSelector: 'img.thumb',
    
    // Additional metadata
    metadataSelectors: {
      duration: '.duration',
      views: '.metadata .right'
    }
  },
  
  pagination: {
    // XVideos has a standard "next" button
    nextButtonSelector: 'a.next-page',
    maxPages: 10
  },
  
  browserOptions: {
    blockImages: false,  // Keep images for thumbnails
    blockStyles: false,  // Keep styles for layout
    blockFonts: true,    // Don't need fonts
    timeout: 30000
  }
}
```

## Advanced: Inspecting a Website

To create a custom config for any website:

1. **Find the search input:**
   - Open DevTools (F12)
   - Find the search input field
   - Note its `name`, `id`, `class`, or other attributes

2. **Test the search:**
   - Perform a search manually
   - Observe the URL structure
   - Is it form-based or URL-based?

3. **Inspect results:**
   - Look at the HTML structure of results
   - Find the container for each result item
   - Identify selectors for links, titles, thumbnails

4. **Check pagination:**
   - Go to page 2 of results
   - Look for "Next" button or page number links
   - Check if the URL changes

5. **Create config:**
   - Use the gathered information to build your config
   - Test with a single page first
   - Then enable pagination

## Performance Tips

1. **Block unnecessary resources:**
   ```javascript
   browserOptions: {
     blockImages: true,    // Saves bandwidth
     blockStyles: false,   // May be needed for layout
     blockFonts: true,     // Usually safe to block
   }
   ```

2. **Limit pagination:**
   ```javascript
   pagination: {
     maxPages: 5  // Don't crawl too many pages
   }
   ```

3. **Use appropriate timeouts:**
   ```javascript
   browserOptions: {
     timeout: 15000  // Faster timeout for quick sites
   }
   ```

4. **Reuse configurations:**
   - Save frequently used configs as presets
   - Use the custom config API to store them

## Troubleshooting

### "Element not found" errors

- The selector may be incorrect
- The page may not have loaded yet
- Try adding a `waitForResults` selector

### No results extracted

- Check that `containerSelector` matches result items
- Verify `linkSelector` finds the actual link elements
- Test selectors in browser DevTools first

### Timeout errors

- Increase `timeout` in `browserOptions`
- Check if the site is slow or blocking automated access
- Some sites may require authentication

### Pagination not working

- Verify the next button selector exists
- Check if pagination uses JavaScript (may need custom handling)
- Try URL-based pagination instead

## Integration with UI

The search crawler can be integrated into your media link extractor UI:

1. Add a "Search Sources" section
2. Display available presets
3. Allow custom source creation
4. Show search results in the main results panel
5. Merge results with other scanning methods

## Environment Variables

Configure search crawler behavior in `.env`:

```bash
# Browser pool size
MAX_CONCURRENT_BROWSERS=5

# Cache settings
CACHE_ENABLED=true
CACHE_TTL=3600

# Disable headless mode for debugging
HEADLESS=false
```

## Security Notes

- Search crawlers respect robots.txt by default
- Rate limiting is applied to prevent abuse
- Authentication-required sites need proper credentials
- Be respectful of target sites' resources
- Consider legal implications of automated scraping

## Next Steps

1. ✅ Test with provided presets
2. ✅ Create custom configs for your favorite sites
3. ✅ Integrate with your main application
4. ✅ Build a UI for managing search sources
5. ✅ Add scheduling for automated searches
