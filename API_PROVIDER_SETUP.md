# API Provider Integration Setup Guide

This guide explains how to configure and use the API provider integration system that enables your scrapers and crawlers to leverage external APIs for content discovery and enrichment.

## 🎯 Overview

The API Provider system integrates with 60+ discovered API/database endpoints from your M3U8 analysis:

### **Metadata APIs** (TMDb, TVDb, Trakt, TVMaze)
- Search for movies and TV shows
- Get detailed metadata (titles, posters, descriptions, ratings)
- Link media files to IMDB/TMDb IDs

### **Debrid Services** (Real-Debrid, AllDebrid, Premiumize)
- Convert magnet links to direct streaming URLs
- Access cached torrents instantly
- High-speed premium links

### **Torrent Databases** (BTDb, torrentsdb)
- Search for torrents by title
- Get magnet links and metadata
- Find seeders/leechers information

---

## 🔧 Configuration

### 1. Environment Variables

Add these to your `.env` file:

```bash
# TMDb API (https://www.themoviedb.org/settings/api)
TMDB_API_KEY=your_tmdb_api_key_here

# TVDb API (https://thetvdb.com/dashboard/account/apikeys)
TVDB_API_KEY=your_tvdb_api_key_here

# Trakt API (https://trakt.tv/oauth/applications)
TRAKT_API_KEY=your_trakt_client_id_here

# Real-Debrid (https://real-debrid.com/apitoken)
REAL_DEBRID_API_KEY=your_realdebrid_token_here

# AllDebrid (https://alldebrid.com/apikeys/)
ALLDEBRID_API_KEY=your_alldebrid_api_key_here

# Premiumize (https://www.premiumize.me/account)
PREMIUMIZE_API_KEY=your_premiumize_api_key_here
```

### 2. Configure API Keys via API

After starting the server, you can also configure keys via the API:

```bash
# Configure TMDb
curl -X POST http://localhost:3002/api/discovery/providers/api.themoviedb.org/configure \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "your_tmdb_key"}'

# Configure Real-Debrid
curl -X POST http://localhost:3002/api/discovery/providers/api.real-debrid.com/configure \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "your_realdebrid_token"}'
```

### 3. Load Configuration on Startup

Update `backend/src/services/ApiProviderService.ts` to load from environment:

```typescript
constructor() {
  this.initializeProviders()
  this.loadApiKeysFromEnv()
}

private loadApiKeysFromEnv(): void {
  // Load from environment variables
  if (process.env.TMDB_API_KEY) {
    this.setApiKey('api.themoviedb.org', process.env.TMDB_API_KEY)
  }
  if (process.env.TVDB_API_KEY) {
    this.setApiKey('api.thetvdb.com', process.env.TVDB_API_KEY)
  }
  if (process.env.TRAKT_API_KEY) {
    this.setApiKey('api.trakt.tv', process.env.TRAKT_API_KEY)
  }
  if (process.env.REAL_DEBRID_API_KEY) {
    this.setApiKey('api.real-debrid.com', process.env.REAL_DEBRID_API_KEY)
  }
  if (process.env.ALLDEBRID_API_KEY) {
    this.setApiKey('api.alldebrid.com', process.env.ALLDEBRID_API_KEY)
  }
  if (process.env.PREMIUMIZE_API_KEY) {
    this.setApiKey('www.premiumize.me', process.env.PREMIUMIZE_API_KEY)
  }
}
```

---

## 📡 API Endpoints

### Check Provider Status

```bash
GET http://localhost:3002/api/discovery/providers
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalProviders": 9,
    "byType": {
      "metadata": 4,
      "debrid": 3,
      "torrent-db": 3,
      "streaming": 0,
      "playlist": 0
    },
    "configured": 6,
    "requiresAuth": 7
  },
  "providers": [...]
}
```

### Search Metadata

```bash
GET http://localhost:3002/api/discovery/search/metadata?q=Inception&type=movie
```

**Response:**
```json
{
  "success": true,
  "query": "Inception",
  "type": "movie",
  "count": 5,
  "results": [
    {
      "id": "tmdb-movie-27205",
      "title": "Inception",
      "type": "movie",
      "year": 2010,
      "posterUrl": "https://image.tmdb.org/t/p/w500/...",
      "rating": 8.4,
      "externalIds": {
        "tmdb": "27205",
        "imdb": "tt1375666"
      }
    }
  ]
}
```

### Search Torrents

```bash
GET http://localhost:3002/api/discovery/search/torrents?q=Inception+2010+1080p
```

**Response:**
```json
{
  "success": true,
  "query": "Inception 2010 1080p",
  "count": 15,
  "results": [
    {
      "name": "Inception (2010) 1080p BluRay x264",
      "infoHash": "abc123...",
      "magnetUrl": "magnet:?xt=urn:btih:abc123...",
      "size": 2147483648,
      "seeders": 250,
      "leechers": 12,
      "source": "https://btdb.eu"
    }
  ]
}
```

### Resolve Debrid Stream

```bash
POST http://localhost:3002/api/discovery/resolve/debrid
Content-Type: application/json

{
  "magnetUrl": "magnet:?xt=urn:btih:abc123...",
  "service": "real-debrid"
}
```

**Response:**
```json
{
  "success": true,
  "stream": {
    "streamUrl": "https://12.real-debrid.com/d/...",
    "quality": "1080p",
    "fileSize": 2147483648,
    "filename": "Inception.2010.1080p.BluRay.mp4",
    "cached": true
  }
}
```

### Full Discovery (Metadata + Torrents + Streams)

```bash
POST http://localhost:3002/api/discovery/discover
Content-Type: application/json

{
  "title": "Inception 2010",
  "includeMetadata": true,
  "includeTorrents": true,
  "resolveStreams": true,
  "debridService": "real-debrid"
}
```

**Response:**
```json
{
  "success": true,
  "title": "Inception 2010",
  "metadata": [...],
  "torrents": [...],
  "streams": [...],
  "recommendations": {
    "bestMatch": {...},
    "topTorrents": [...],
    "availableStreams": 3
  }
}
```

---

## 🚀 Usage Examples

### Example 1: Enrich M3U8 Playlist

Process your M3U8 playlist and enrich each entry with metadata:

```bash
POST http://localhost:3002/api/discovery/batch/playlist
Content-Type: application/json

{
  "entries": [
    {
      "title": "Inception",
      "url": "http://example.com/inception.m3u8"
    },
    {
      "title": "The Dark Knight",
      "url": "http://example.com/dark-knight.m3u8"
    }
  ],
  "maxConcurrent": 5,
  "enrichMetadata": true,
  "findTorrents": true
}
```

**Response:**
```json
{
  "success": true,
  "totalProcessed": 2,
  "enrichedCount": 2,
  "enrichmentRate": "100.0%",
  "results": [
    {
      "title": "Inception",
      "url": "http://example.com/inception.m3u8",
      "metadata": {
        "id": "tmdb-movie-27205",
        "title": "Inception",
        "type": "movie",
        "year": 2010,
        "posterUrl": "https://image.tmdb.org/t/p/w500/...",
        "rating": 8.4
      },
      "torrents": [
        {
          "name": "Inception (2010) 1080p",
          "seeders": 250
        }
      ],
      "enriched": true
    }
  ]
}
```

### Example 2: Enhanced Crawl with API Integration

Start a crawl that automatically enriches discovered content:

```bash
POST http://localhost:3002/api/discovery/crawl/enhanced
Content-Type: application/json

{
  "url": "https://example-media-site.com",
  "title": "Example Media Site Crawl",
  "enrichMetadata": true,
  "discoverTorrents": true,
  "resolveDebrid": false
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "enhanced-1234567890-abc123",
  "message": "Enhanced crawl started. Check status endpoint for progress."
}
```

### Example 3: Programmatic Usage in Your Code

```typescript
import { apiProviderService } from './services/ApiProviderService'
import { enhancedMediaCrawler } from './services/EnhancedMediaCrawler'

// Search for media metadata
const metadata = await apiProviderService.searchMedia('Inception', 'movie')
console.log('Found:', metadata[0].title, metadata[0].year)

// Search for torrents
const torrents = await apiProviderService.searchTorrents('Inception 2010 1080p')
console.log('Found', torrents.length, 'torrents')

// Resolve magnet to stream
const stream = await apiProviderService.resolveDebridStream(
  torrents[0].magnetUrl,
  'real-debrid'
)
console.log('Stream URL:', stream?.streamUrl)

// Enhanced crawl
const crawlResult = await enhancedMediaCrawler.startEnhancedCrawl(
  'session-123',
  'https://example.com',
  'Example Crawl',
  {
    enrichMetadata: true,
    discoverTorrents: true,
    resolveDebrid: true,
    debridService: 'real-debrid'
  }
)

console.log('Crawl completed:', crawlResult.enrichedMedia.length, 'media enriched')
console.log('API calls made:', crawlResult.apiCallsMade)
```

---

## 🎨 Integration with Existing Crawlers

### Extend AutoDiscoveryManager

Modify `backend/src/autoDiscovery.ts` to use API providers:

```typescript
import { apiProviderService } from './services/ApiProviderService.js'

// In performDiscovery method, add:
for (const link of job.discoveredLinks) {
  // Enrich with metadata
  const metadata = await apiProviderService.searchMedia(link.title || '')
  if (metadata.length > 0) {
    link.metadata = metadata[0]
  }
  
  // Find torrents
  const torrents = await apiProviderService.searchTorrents(link.title || '')
  link.torrents = torrents.slice(0, 3)
}
```

### Extend DomainCrawler

Add API enrichment to crawled results:

```typescript
import { enhancedMediaCrawler } from './services/EnhancedMediaCrawler.js'

// Replace domainCrawler.startCrawl with:
const result = await enhancedMediaCrawler.startEnhancedCrawl(
  sessionId,
  url,
  title,
  {
    enrichMetadata: true,
    discoverTorrents: false,
    resolveDebrid: false
  }
)
```

---

## 📊 Rate Limits and Best Practices

### Rate Limits by Provider

| Provider | Requests/Minute | Notes |
|----------|----------------|-------|
| TMDb | 40 | Automatic rate limiting built-in |
| TVDb | 30 | Requires JWT token refresh |
| Trakt | 60 | Per client ID |
| TVMaze | 20 | No authentication required |
| Real-Debrid | 60 | Per API token |
| AllDebrid | 60 | Per API token |
| BTDb | Unlimited | Web scraping, use responsibly |

### Best Practices

1. **Batch Processing**: Use `/api/discovery/batch/playlist` for bulk operations (auto-throttled)
2. **Cache Results**: Metadata and torrent searches are cached for 1 hour
3. **Concurrent Limits**: Default 5 concurrent requests, configurable via `maxConcurrent`
4. **Error Handling**: Failed API calls don't stop the process, partial results returned
5. **Debrid Quotas**: Debrid services have daily limits, check your account

---

## 🔍 Monitoring and Debugging

### Check Statistics

```bash
GET http://localhost:3002/api/discovery/stats
```

**Response:**
```json
{
  "success": true,
  "strategies": [
    {
      "name": "Metadata Enrichment",
      "enabled": true,
      "providers": ["api.themoviedb.org", "api.thetvdb.com"],
      "priority": 1
    }
  ],
  "apiProviders": {
    "totalProviders": 9,
    "configured": 6,
    "requiresAuth": 7
  }
}
```

### Debug Logs

Enable debug logging:

```bash
# Set in .env
DEBUG=api-provider:*

# Or set log level
LOG_LEVEL=debug
```

---

## 🎯 Next Steps

1. **Configure at least one provider** from each category (metadata, torrent, debrid)
2. **Test the `/api/discovery/discover` endpoint** with a movie title
3. **Batch process your M3U8 file** using `/api/discovery/batch/playlist`
4. **Integrate with existing crawlers** by replacing `DomainCrawler` with `EnhancedMediaCrawler`
5. **Monitor API usage** via `/api/discovery/stats`

---

## 🆘 Troubleshooting

### "Authentication required" error
- Check API keys are correctly set in `.env`
- Verify keys are valid on provider websites
- Call `/api/discovery/providers` to check configuration status

### Rate limit errors
- Reduce `maxConcurrent` parameter
- Add delays between batch operations
- Check provider account limits

### No torrents found
- BTDb uses web scraping and may be blocked
- Try alternative search terms (include year, quality)
- Check if torrent databases are accessible

### Debrid resolution fails
- Verify magnet link is valid
- Check if torrent is cached (instant) vs uncached (slow)
- Ensure debrid account has active subscription

---

## 📚 Additional Resources

- [TMDb API Docs](https://developers.themoviedb.org/3)
- [TVDb API Docs](https://thetvdb.github.io/v4-api/)
- [Trakt API Docs](https://trakt.docs.apiary.io/)
- [Real-Debrid API Docs](https://api.real-debrid.com/)
- [AllDebrid API Docs](https://docs.alldebrid.com/)

---

## 🎉 You're Ready!

Your scrapers and crawlers can now leverage 60+ API/database endpoints discovered from your M3U8 analysis. Start by configuring TMDb and Real-Debrid for the best content discovery experience.
