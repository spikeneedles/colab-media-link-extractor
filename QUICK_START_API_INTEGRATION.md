# Quick Start: API Integration for Media Scrapers

This guide gets your API-enhanced scrapers running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- API keys obtained (at minimum, TMDb API key recommended)

## Step 1: Configure API Keys (2 minutes)

```bash
# Navigate to backend directory
cd backend

# Copy environment template
cp .env.example .env

# Edit .env and add your API keys
```

### Minimum Configuration (Basic Metadata)
```bash
# In backend/.env
TMDB_API_KEY=your_tmdb_key_here
```

### Recommended Configuration (Metadata + Streaming)
```bash
# In backend/.env
TMDB_API_KEY=your_tmdb_key_here
REAL_DEBRID_API_KEY=your_realdebrid_token_here
```

### Full Configuration (Maximum Discovery)
```bash
# In backend/.env
TMDB_API_KEY=your_tmdb_key_here
TVDB_API_KEY=your_tvdb_key_here
TRAKT_API_KEY=your_trakt_client_id_here
REAL_DEBRID_API_KEY=your_realdebrid_token_here
ALLDEBRID_API_KEY=your_alldebrid_token_here
PREMIUMIZE_API_KEY=your_premiumize_key_here
```

## Step 2: Get API Keys (Where to Get Them)

| Provider | URL | Free Tier | Purpose |
|----------|-----|-----------|---------|
| **TMDb** | https://www.themoviedb.org/settings/api | 40 req/min | Movie/TV metadata |
| **Real-Debrid** | https://real-debrid.com/apitoken | 60 req/min | Premium streaming |
| TVDb | https://thetvdb.com/dashboard/account/apikeys | 30 req/min | TV show data |
| Trakt | https://trakt.tv/oauth/applications | 60 req/min | Trending/popular |
| AllDebrid | https://alldebrid.com/apikeys/ | 60 req/min | Premium streaming |
| Premiumize | https://www.premiumize.me/account | 100 req/min | Premium streaming |

**Bold entries = Recommended minimum setup**

## Step 3: Start the Backend (1 minute)

```bash
# From backend directory
npm install
npm run dev

# You should see:
# [ApiProviderService] ✅ TMDb API key loaded from environment
# [ApiProviderService] ✅ Real-Debrid API key loaded from environment
# [ApiProviderService] 📊 7/9 providers configured
# 🚀 Server running on http://localhost:3002
```

## Step 4: Test API Integration (30 seconds)

### Check Provider Status
```bash
curl http://localhost:3002/api/discovery/providers
```

**Expected response:**
```json
{
  "configured": 2,
  "total": 9,
  "providers": [
    {
      "hostname": "api.themoviedb.org",
      "name": "TMDb",
      "configured": true,
      "rateLimit": "40 requests per minute"
    },
    {
      "hostname": "api.real-debrid.com",
      "name": "Real-Debrid",
      "configured": true,
      "rateLimit": "60 requests per minute"
    }
  ]
}
```

### Search for Content
```bash
curl "http://localhost:3002/api/discovery/search/metadata?title=Inception&type=movie"
```

**Expected response:**
```json
{
  "results": [
    {
      "title": "Inception",
      "year": 2010,
      "type": "movie",
      "tmdbId": 27205,
      "imdbId": "tt1375666",
      "rating": 8.8,
      "poster": "https://image.tmdb.org/t/p/w500/...",
      "overview": "Cobb, a skilled thief...",
      "provider": "TMDb"
    }
  ],
  "totalResults": 1
}
```

## Step 5: Use Enhanced Crawler (1 minute)

### Test Enhanced Crawl with API Enrichment
```bash
curl -X POST http://localhost:3002/api/discovery/crawl/enhanced \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example-streaming-site.com",
    "options": {
      "enrichMetadata": true,
      "discoverTorrents": true,
      "resolveDebrid": true,
      "maxDepth": 2
    }
  }'
```

**What happens:**
1. Traditional web scraping extracts links from URL
2. TMDb enriches each found title with metadata (poster, rating, overview)
3. BTDb searches for torrent magnet links
4. Real-Debrid converts magnets to direct streaming URLs

### Process Your M3U8 Playlist
```bash
curl -X POST http://localhost:3002/api/discovery/batch/playlist \
  -H "Content-Type: application/json" \
  -d '{
    "entries": [
      {
        "title": "Inception (2010)",
        "url": "https://example.com/inception.m3u8"
      },
      {
        "title": "The Matrix (1999)",
        "url": "https://example.com/matrix.m3u8"
      }
    ],
    "enrichMetadata": true,
    "discoverTorrents": false,
    "resolveDebrid": false,
    "concurrency": 5
  }'
```

**Processes 5 entries concurrently with metadata enrichment**

## Common Use Cases

### 1. Enrich Existing M3U8 Playlist
**Goal:** Add metadata (posters, ratings) to existing playlist entries

```bash
# Read your playlist
cat all-2026-02-22.m3u8 | grep 'extinf' | head -10 > sample.json

# Enrich with metadata
curl -X POST http://localhost:3002/api/discovery/batch/playlist \
  -H "Content-Type: application/json" \
  -d @sample.json
```

### 2. Discover Alternative Streaming Sources
**Goal:** Find debrid streams for movie titles

```bash
curl -X POST http://localhost:3002/api/discovery/discover \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Inception",
    "type": "movie",
    "strategies": {
      "metadata": false,
      "torrents": true,
      "debrid": true
    }
  }'
```

### 3. Automated Content Discovery Pipeline
**Goal:** Continuously discover and enrich content

```javascript
// In your application code
const response = await fetch('http://localhost:3002/api/discovery/crawl/enhanced', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://target-site.com',
    options: {
      enrichMetadata: true,
      discoverTorrents: true,
      resolveDebrid: true,
      maxDepth: 3,
      maxPages: 50
    }
  })
})

const enrichedResults = await response.json()
// Process enrichedResults.results with metadata, torrents, streams
```

## Monitoring

### Check API Usage Stats
```bash
curl http://localhost:3002/api/discovery/stats
```

**Response shows:**
- Total requests per provider
- Rate limit status
- Configuration health
- Error counts

## Troubleshooting

### "0/9 providers configured"
**Problem:** No API keys loaded

**Solution:**
1. Check `.env` file exists in `backend/` directory
2. Verify environment variables are uncommented (no `#` prefix)
3. Restart backend server: `npm run dev`

### "Rate limit exceeded" errors
**Problem:** Too many requests to provider

**Solution:**
- Reduce `concurrency` parameter in batch operations
- Wait 60 seconds for rate limit window to reset
- Consider spreading requests across multiple providers

### "Unauthorized" or 401 errors
**Problem:** Invalid API key

**Solution:**
1. Verify API key copied correctly (no spaces)
2. Check API key is active on provider website
3. For Trakt: Use **Client ID**, not Client Secret
4. For debrid services: Generate new token from account settings

### No metadata found for valid titles
**Problem:** Title parsing or API search issues

**Solution:**
- Check exact title format (include year if known)
- Try alternative provider: `"provider": "tvdb"` in request
- Check debug logs: `DEBUG=* npm run dev`

## Next Steps

1. **Read Full Documentation:** See [API_PROVIDER_SETUP.md](./API_PROVIDER_SETUP.md) for complete API reference

2. **Integrate with Existing Crawlers:** Modify `backend/src/autoDiscovery.ts` to use `EnhancedMediaCrawler` instead of `DomainCrawler`

3. **Scale Up:** Process your full 20,972-line M3U8 playlist in batches:
   ```bash
   # Split playlist into chunks of 100 entries
   # Process each chunk with 30-second delays between batches
   ```

4. **Monitor Performance:** Set up logging to track enrichment success rates

## Support

- **Full API Documentation:** [API_PROVIDER_SETUP.md](./API_PROVIDER_SETUP.md)
- **Rate Limits Reference:** See "Rate Limits and Quotas" section in API_PROVIDER_SETUP.md
- **Integration Examples:** See "Integration with Existing Crawlers" in API_PROVIDER_SETUP.md

---

**Ready to go!** With just a TMDb API key, you're now enriching media content with metadata, posters, ratings, and more. Add debrid services for direct streaming URLs.
