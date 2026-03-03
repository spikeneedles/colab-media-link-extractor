# XVideos Search Integration Example

Based on your inspection of the XVideos search form, here's how the search crawler works with it.

## Your Inspection Data

You provided this information about the search input:

```javascript
{
  name: "k",
  type: "text",
  value: "ndfndasfvasgfaasdgasdfgasbfcdvxzgnzvZvzVczvxzbnzbbv cv nsxf",
  placeholder: "Search X videos",
  class: "search-input form-control",
  form: "home-mobile-search",
  baseURI: "https://www.xvideos.com/"
}
```

## How It Works

The search crawler automatically:

1. **Navigates to** `https://www.xvideos.com/`
2. **Finds the input** using `input[name="k"]`
3. **Types your query** into the search box
4. **Submits the form** by pressing Enter
5. **Waits for results** to appear in `.mozaique`
6. **Extracts links** from `.thumb-block` containers
7. **Follows pagination** using `.next-page` links

## Quick Test

### 1. Start the Backend

```powershell
cd backend
npm install
npm start
```

### 2. Run a Search

```powershell
# Using the test script
node test-search.mjs "your search term" xvideos 3

# Or using curl
curl -X POST http://localhost:3001/api/search/execute `
  -H "Content-Type: application/json" `
  -d '{\"presetId\": \"xvideos\", \"query\": \"your search term\", \"maxPages\": 3}'
```

### 3. Example Response

```json
{
  "success": true,
  "result": {
    "searchQuery": "your search term",
    "totalResults": 120,
    "results": [
      {
        "url": "https://www.xvideos.com/video73216089/...",
        "title": "Video Title Here",
        "thumbnail": "https://cdn77-pic.xvideos-cdn.com/...",
        "metadata": {
          "duration": "10:30",
          "views": "1.2M views"
        },
        "sourceConfig": "xvideos",
        "searchQuery": "your search term",
        "pageNumber": 1
      },
      // ... 119 more results
    ],
    "pagesScraped": 3,
    "executionTime": 12453,
    "errors": []
  }
}
```

## The XVideos Configuration

This is what's running behind the scenes:

```javascript
{
  id: 'xvideos',
  name: 'XVideos',
  baseUrl: 'https://www.xvideos.com/',
  searchMethod: 'form',
  
  // Based on your inspection
  formConfig: {
    inputSelector: 'input[name="k"]',        // The input you inspected
    waitForResults: '.mozaique'              // Results container
  },
  
  // How to extract each video
  resultSelectors: {
    containerSelector: '.mozaique .thumb-block',   // Each video block
    linkSelector: 'a.thumb',                       // Video link
    titleSelector: 'p.title a',                    // Video title
    thumbnailSelector: 'img.thumb',                // Thumbnail image
    metadataSelectors: {
      duration: '.duration',                       // Video duration
      views: '.metadata .right'                    // View count
    }
  },
  
  // Pagination support
  pagination: {
    nextButtonSelector: 'a.next-page',             // "Next" button
    maxPages: 10                                   // Crawl up to 10 pages
  },
  
  // Performance settings
  browserOptions: {
    blockImages: false,   // Keep images for thumbnails
    blockStyles: false,   // Keep styles for layout
    blockFonts: true,     // Don't need fonts
    timeout: 30000        // 30 second timeout
  }
}
```

## Custom Modifications

### Search Only Specific Categories

You can modify the search query to include category filters:

```javascript
// Example: Search in a specific category
const response = await fetch('http://localhost:3001/api/search/execute', {
  method: 'POST',
  headers: { 'Content-Type': application/json' },
  body: JSON.stringify({
    presetId: 'xvideos',
    query: 'your search term',  // The site handles category filtering
    maxPages: 5
  })
})
```

### Extract Additional Metadata

Create a custom config with more metadata:

```javascript
const customXVideosConfig = {
  id: 'xvideos-custom',
  name: 'XVideos (Custom)',
  baseUrl: 'https://www.xvideos.com/',
  searchMethod: 'form',
  
  formConfig: {
    inputSelector: 'input[name="k"]',
    waitForResults: '.mozaique'
  },
  
  resultSelectors: {
    containerSelector: '.mozaique .thumb-block',
    linkSelector: 'a.thumb',
    titleSelector: 'p.title a',
    thumbnailSelector: 'img.thumb',
    metadataSelectors: {
      duration: '.duration',
      views: '.metadata .right',
      rating: '.rating',           // Add rating
      uploadDate: '.upload-date',  // Add upload date
      uploader: '.uploader-name'   // Add uploader
    }
  },
  
  pagination: {
    nextButtonSelector: 'a.next-page',
    maxPages: 10
  },
  
  browserOptions: {
    blockImages: false,
    blockStyles: false,
    blockFonts: true,
    timeout: 30000
  }
}

// Save it
await fetch('http://localhost:3001/api/search/custom/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(customXVideosConfig)
})

// Use it
await fetch('http://localhost:3001/api/search/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customConfig: customXVideosConfig,
    query: 'your search',
    maxPages: 3
  })
})
```

## Common Use Cases

### 1. Bulk URL Collection

Collect video URLs for batch processing:

```javascript
const result = await fetch('http://localhost:3001/api/search/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    presetId: 'xvideos',
    query: 'your category',
    maxPages: 10  // Get lots of results
  })
})

const data = await result.json()
const urls = data.result.results.map(r => r.url)

console.log(`Collected ${urls.length} video URLs`)
// Save to file, database, etc.
```

### 2. Scheduled Searches

Set up automated searches:

```javascript
// Search every hour
setInterval(async () => {
  const queries = ['trending', 'popular', 'new']
  
  for (const query of queries) {
    const result = await fetch('http://localhost:3001/api/search/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presetId: 'xvideos',
        query,
        maxPages: 3
      })
    })
    
    const data = await result.json()
    console.log(`Found ${data.result.totalResults} results for: ${query}`)
    
    // Process results...
  }
}, 3600000)  // Every hour
```

### 3. Multi-Site Comparison

Search across multiple adult video sites:

```javascript
const result = await fetch('http://localhost:3001/api/search/execute-multi', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    presetIds: ['xvideos', 'pornhub'],  // Multiple sites
    query: 'your search',
    maxPages: 3
  })
})

const data = await result.json()

// Compare results
console.log('XVideos:', data.results.xvideos.totalResults, 'results')
console.log('PornHub:', data.results.pornhub.totalResults, 'results')
```

## Integration with Main App

Add to your media link extractor UI:

```typescript
// src/components/SearchCrawler.tsx
import { useState } from 'react'

export function SearchCrawler() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  async function handleSearch() {
    setLoading(true)
    
    const response = await fetch('http://localhost:3001/api/search/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presetId: 'xvideos',
        query,
        maxPages: 3
      })
    })
    
    const data = await response.json()
    setResults(data.result.results)
    setLoading(false)
  }

  return (
    <div>
      <h2>Search XVideos</h2>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter search query..."
      />
      <button onClick={handleSearch} disabled={loading}>
        {loading ? 'Searching...' : 'Search'}
      </button>
      
      <div>
        {results.map((result, i) => (
          <div key={i}>
            <h3>{result.title}</h3>
            <a href={result.url} target="_blank">{result.url}</a>
            {result.thumbnail && <img src={result.thumbnail} alt="" />}
            <p>Duration: {result.metadata?.duration}</p>
            <p>Views: {result.metadata?.views}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Performance Optimization

### 1. Block Images (Faster but No Thumbnails)

```javascript
const fastConfig = {
  ...customXVideosConfig,
  browserOptions: {
    blockImages: true,     // Much faster!
    blockStyles: true,
    blockFonts: true,
    timeout: 15000
  }
}
```

### 2. Limit Pages

```javascript
// Only get first page for quick results
const response = await fetch('http://localhost:3001/api/search/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    presetId: 'xvideos',
    query: 'your search',
    maxPages: 1  // Fast!
  })
})
```

### 3. Use Caching

The backend automatically caches results for 1 hour by default.

## Security & Privacy

1. **Run locally**: Keep searches on your own machine
2. **Use VPN**: Protect your privacy
3. **Respect rate limits**: Don't spam the site
4. **Review robots.txt**: Be respectful of site policies

## Troubleshooting

### "No results found"

- The site may have changed its HTML structure
- Try inspecting the page again and updating selectors
- Check if the site uses different classes for mobile/desktop

### "Timeout error"

- Increase `timeout` in config
- Check your internet connection
- The site may be slow or blocking automated access

### "Element not found"

- The selector may be incorrect
- The page structure may have changed
- Try testing the selector in browser DevTools first

## Next Steps

1. Test the basic search functionality
2. Customize the config for your specific needs
3. Integrate with your main application
4. Add scheduling for automated searches
5. Implement result filtering and deduplication

## Support

For issues or questions:
- Check the main [SEARCH_CRAWLER_GUIDE.md](./SEARCH_CRAWLER_GUIDE.md)
- Review the [API documentation](http://localhost:3001/api/)
- Inspect the page structure using browser DevTools
