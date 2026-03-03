# Quick Start: Website Search Crawler

## What You Just Got

I've added a **Website Search Crawler** feature to your media link extractor that allows you to:

✅ Use any website's search function as a source  
✅ Automatically fill search forms and extract results  
✅ Support pagination for deep crawling  
✅ Extract media links, titles, thumbnails, and metadata  
✅ Search multiple sites simultaneously  

## Files Added

### Backend Services
- `backend/src/services/SearchCrawler.ts` - Core search crawler service
- `backend/src/services/searchSourcePresets.ts` - Pre-configured site templates

### API Endpoints (added to `backend/src/index.ts`)
- `GET /api/search/presets` - List available search sources
- `GET /api/search/presets/:id` - Get specific preset details
- `POST /api/search/execute` - Execute search on one source
- `POST /api/search/execute-multi` - Search multiple sources
- `POST /api/search/custom/save` - Save custom configurations
- `GET /api/search/custom` - Get custom configurations
- `DELETE /api/search/custom/:id` - Delete custom configuration

### Documentation
- `SEARCH_CRAWLER_GUIDE.md` - Complete feature documentation
- `XVIDEOS_EXAMPLE.md` - Specific example for your XVideos use case
- `test-search.mjs` - Test script for trying the feature

## Quick Start

### 1. Install Dependencies (if needed)

```powershell
cd backend
npm install
```

### 2. Start the Backend

```powershell
cd backend
npm start
```

You should see:
```
✅ Browser launched
🚀 Server running on port 3001
```

### 3. Test the Search (3 Ways)

#### Option A: Use the Test Script

```powershell
# Search XVideos
node test-search.mjs "your search term" xvideos 3

# Search YouTube
node test-search.mjs "cooking videos" youtube 5

# List all available presets
node test-search.mjs --list

# Multi-source search
node test-search.mjs --multi "music videos" 3
```

#### Option B: Use cURL

```powershell
# List presets
curl http://localhost:3001/api/search/presets

# Search XVideos
curl -X POST http://localhost:3001/api/search/execute `
  -H "Content-Type: application/json" `
  -d '{\"presetId\": \"xvideos\", \"query\": \"your search\", \"maxPages\": 3}'

# Multi-source search
curl -X POST http://localhost:3001/api/search/execute-multi `
  -H "Content-Type: application/json" `
  -d '{\"presetIds\": [\"xvideos\", \"pornhub\"], \"query\": \"your search\", \"maxPages\": 2}'
```

#### Option C: Use JavaScript/Fetch

```javascript
// In your browser console or Node.js
const response = await fetch('http://localhost:3001/api/search/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    presetId: 'xvideos',
    query: 'your search term',
    maxPages: 3
  })
})

const data = await response.json()
console.log('Found:', data.result.totalResults, 'results')
console.log('Results:', data.result.results)
```

## Pre-configured Sites

The system comes with these ready-to-use presets:

| Preset ID | Site | Method | Pagination |
|-----------|------|--------|------------|
| `xvideos` | XVideos | Form | ✅ |
| `pornhub` | PornHub | URL | ✅ |
| `youtube` | YouTube | URL | ✅ |
| `vimeo` | Vimeo | URL | ✅ |
| `dailymotion` | Dailymotion | URL | ✅ |
| `twitch-videos` | Twitch | URL | ❌ |
| `generic-form` | Template for form-based sites | Form | ✅ |
| `generic-url` | Template for URL-based sites | URL | ✅ |

## Your XVideos Example

Based on your inspection:

```javascript
{
  name: "k",
  placeholder: "Search X videos",
  form: "home-mobile-search",
  baseURI: "https://www.xvideos.com/"
}
```

The crawler automatically:
1. Goes to `https://www.xvideos.com/`
2. Finds `input[name="k"]`
3. Types your search query
4. Presses Enter to submit
5. Waits for `.mozaique` results
6. Extracts all video links
7. Follows pagination links

**Example Output:**

```json
{
  "success": true,
  "result": {
    "searchQuery": "your term",
    "totalResults": 120,
    "pagesScraped": 3,
    "executionTime": 12453,
    "results": [
      {
        "url": "https://www.xvideos.com/video73216089/...",
        "title": "Video Title",
        "thumbnail": "https://cdn77-pic.xvideos-cdn.com/...",
        "metadata": {
          "duration": "10:30",
          "views": "1.2M views"
        }
      }
      // ... more results
    ]
  }
}
```

## Creating Custom Configurations

Want to add a new site? Here's how:

### 1. Inspect the Search Form

Open DevTools (F12) and find:
- Search input selector (e.g., `input[name="q"]`)
- Results container selector (e.g., `.results`)
- Link selector within results (e.g., `a.video-link`)

### 2. Create Configuration

```javascript
const myCustomSite = {
  id: 'my-site',
  name: 'My Site',
  baseUrl: 'https://example.com/',
  searchMethod: 'form',  // or 'url'
  
  formConfig: {
    inputSelector: 'input[name="q"]',
    waitForResults: '.results'
  },
  
  resultSelectors: {
    containerSelector: '.result-item',
    linkSelector: 'a',
    titleSelector: 'h3',
    thumbnailSelector: 'img'
  },
  
  pagination: {
    nextButtonSelector: 'a.next',
    maxPages: 5
  },
  
  browserOptions: {
    blockImages: false,
    timeout: 30000
  }
}
```

### 3. Save and Use

```javascript
// Save it
await fetch('http://localhost:3001/api/search/custom/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(myCustomSite)
})

// Use it
await fetch('http://localhost:3001/api/search/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customConfig: myCustomSite,
    query: 'test',
    maxPages: 3
  })
})
```

## Integration with Your UI

Add a search interface to your React app:

```typescript
// In your main App.tsx or new component
import { useState } from 'react'

function SearchInterface() {
  const [query, setQuery] = useState('')
  const [preset, setPreset] = useState('xvideos')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  async function search() {
    setLoading(true)
    const res = await fetch('http://localhost:3001/api/search/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetId: preset, query, maxPages: 3 })
    })
    const data = await res.json()
    setResults(data.result.results)
    setLoading(false)
  }

  return (
    <div>
      <select value={preset} onChange={e => setPreset(e.target.value)}>
        <option value="xvideos">XVideos</option>
        <option value="pornhub">PornHub</option>
        <option value="youtube">YouTube</option>
      </select>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <button onClick={search}>{loading ? 'Searching...' : 'Search'}</button>
      
      <div>
        {results.map((r, i) => (
          <div key={i}>
            <a href={r.url}>{r.title}</a>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Performance Tips

### For Speed
```javascript
browserOptions: {
  blockImages: true,   // 50-80% faster
  blockStyles: true,   // 20-30% faster
  blockFonts: true,    // 10-15% faster
  timeout: 15000       // Fail fast
}
```

### For Quality
```javascript
browserOptions: {
  blockImages: false,  // Get thumbnails
  blockStyles: false,  // Proper layout
  blockFonts: true,    // Usually safe
  timeout: 30000       // More time
}
```

## Common Issues

### "Backend not responding"
```powershell
cd backend
npm start
```

### "Element not found"
- Test your selector in browser DevTools first
- The site may have changed its HTML structure
- Try using a more general selector

### "Timeout"
- Increase `timeout` in config
- Check your internet connection
- Try `blockImages: true` for faster loading

### "No results"
- Verify the `containerSelector` matches result items
- Check `linkSelector` finds actual links
- Test pagination separately

## Next Steps

1. ✅ **Installed** - Feature is ready to use
2. 🔄 **Test** - Try the examples above
3. 🎨 **Customize** - Add your own site configs
4. 🚀 **Integrate** - Add to your main UI
5. 📊 **Monitor** - Check results and optimize

## Documentation

- **Full Guide**: [SEARCH_CRAWLER_GUIDE.md](./SEARCH_CRAWLER_GUIDE.md)
- **XVideos Example**: [XVIDEOS_EXAMPLE.md](./XVIDEOS_EXAMPLE.md)
- **API Docs**: http://localhost:3001/api/

## Support

Having issues? Check:
1. Backend is running on port 3001
2. Node.js and npm are installed
3. No firewall blocking localhost
4. Puppeteer installed correctly

## What Changed

**Backend Changes:**
- Added `SearchCrawler` service
- Added `searchSourcePresets` with 8 presets
- Added 7 new API endpoints
- Updated API documentation

**No UI Changes:**
- Feature is backend-only
- You can integrate it into your React UI later
- Or use it directly via API calls

**No Breaking Changes:**
- All existing features still work
- Backward compatible
- Optional feature

---

**Ready to try it?**

```powershell
cd backend
npm start
```

Then in another terminal:

```powershell
node test-search.mjs "your search" xvideos 3
```

Enjoy! 🎉
