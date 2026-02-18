# Auto-Domain Crawler - Quick Start Guide

## Overview

The media link extractor now automatically crawls an entire domain whenever a media URL is captured. This means when you get a single media link from an extension, the system will:

1. **Auto-detect** the domain
2. **Crawl** all pages on that domain 
3. **Extract** all media links found
4. **Display** results in real-time with progress updates

## Getting Started

### 1. Start the Backend

```bash
cd backend
npm install
npm run dev
```

### 2. Start the Frontend

```bash
npm run dev
```

### 3. Open Extension Manager

Navigate to: `http://localhost:5173`

Click "Extension Manager" in the navigation

## Testing Auto-Crawl

### Option A: Mock Player (No Extension Required)

1. Click **"Launch Mock Media Player"**
2. Enter a test URL:
   ```
   https://example.com/stream.m3u8
   ```
3. Click **"Capture & Send to Bridge"**
4. Watch the crawl status update automatically:
   - Progress bar shows crawl completion
   - URLs found counter increments
   - Media links discovered in real-time
   - Pages processed counter shows activity

### Option B: Real Browser Extension

1. Load the sample extension in Chrome:
   - `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `extension-sample/` folder

2. Visit any streaming website
3. The extension will capture media URLs
4. The Extension Manager will show:
   - Crawl status with domain name
   - Real-time progress percentage
   - Statistics (URLs, media links, pages)

## API Endpoints

### Capture & Auto-Crawl

**POST** `/api/extension/capture`

Captures a media URL and automatically starts domain crawl.

```bash
curl -X POST http://localhost:3001/api/extension/capture \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "extension-123",
    "url": "https://streaming-site.com/video.m3u8",
    "title": "Live Stream"
  }'
```

**Response:**
```json
{
  "success": true,
  "mediaId": "session-123-1234567890",
  "crawlSessionId": "crawl-session-123-1234567890",
  "message": "Media captured and domain crawl started",
  "crawlStatus": {
    "status": "crawling",
    "progress": 0,
    "domain": "streaming-site.com"
  }
}
```

### Get Crawl Status

**GET** `/api/extension/crawl/:crawlSessionId`

Check the current progress of a domain crawl.

```bash
curl http://localhost:3001/api/extension/crawl/crawl-session-123
```

**Response:**
```json
{
  "success": true,
  "crawlSessionId": "crawl-session-123",
  "status": "crawling",
  "progress": 45,
  "domain": "streaming-site.com",
  "discoveredUrls": 12,
  "mediaLinksFound": 3,
  "pagesProcessed": 5,
  "startedAt": "2024-02-18T10:30:00Z"
}
```

### Get Discovered Media Links

**GET** `/api/extension/crawl/:crawlSessionId/results`

Retrieve all discovered media links from the crawl.

```bash
curl http://localhost:3001/api/extension/crawl/crawl-session-123/results?limit=50
```

**Response:**
```json
{
  "success": true,
  "crawlSessionId": "crawl-session-123",
  "status": "completed",
  "mediaLinks": [
    "https://streaming-site.com/stream.m3u8",
    "https://streaming-site.com/video1.mp4",
    "https://streaming-site.com/video2.ts"
  ],
  "total": 3,
  "offset": 0,
  "limit": 50
}
```

### Get Crawled Pages

**GET** `/api/extension/crawl/:crawlSessionId/pages`

View all pages that were crawled and the media found on each.

```bash
curl http://localhost:3001/api/extension/crawl/crawl-session-123/pages
```

### Cancel Crawl

**POST** `/api/extension/crawl/:crawlSessionId/cancel`

Stop an ongoing crawl.

```bash
curl -X POST http://localhost:3001/api/extension/crawl/crawl-session-123/cancel
```

## How It Works

### Crawl Process

1. **Capture**: Media URL captured from extension or mock player
2. **Extract Domain**: Parse the URL to get domain (e.g., `streaming-site.com`)
3. **Crawl**: 
   - Start with the initial URL
   - Discover new URLs on same domain
   - Recursively crawl to max depth (3)
   - Max 100 pages per domain
4. **Extract Media**: Find all media links using patterns:
   - `.m3u8`, `.m3u` (HLS)
   - `.ts` (MPEG-TS)
   - `.mp4`, `.mkv`, `.webm` (Video files)
   - `.flv` (Flash video)
   - `rtmp://`, `rtmps://` (RTMP streams)
5. **Store**: Keep results in memory with pagination
6. **Report**: Stream progress updates to UI

### Configuration

**Backend** (`backend/src/domainCrawler.ts`):
- `maxPagesPerDomain`: Default 100 (adjust for more/fewer pages)
- `maxDepth`: Default 3 (crawl depth limit)
- `timeout`: Default 30000ms (page load timeout)

**Frontend** (`src/hooks/useAutoCrawler.ts`):
- Poll interval: 2000ms (check status every 2 seconds)

### Media Link Detection

The crawler uses multiple patterns to find media:

**URL Patterns** (regex):
- HLS: `https://.../*.m3u8`
- MPEG-TS: `https://.../*.ts?...`
- MP4: `https://.../*.mp4?...`
- Streaming: `rtmp://...`

**JSON Patterns**:
- Looks for properties like `url`, `src`, `stream`, `media`, `video`

## UI Components

### Crawl Status Card

Shows real-time crawl progress:
- Domain being crawled
- Progress bar (0-100%)
- Stats: URLs found, media links, pages processed
- Cancel button
- Auto-expands when crawl completes
- Shows status: pending → crawling → completed

### Discovered Media Section

After crawl completes:
- Lists first 10 media links
- Shows total count
- Copy-to-clipboard for each link
- Scroll for more links
- Updates automatically as crawl progresses

### Extension Manager Stats

Updated with crawl data:
- Media Captured count
- Unique domains count
- Active crawls indicator

## Common Issues

### Crawl Not Starting

1. **Check session**: Ensure extension is registered first
   ```bash
   curl http://localhost:3001/api/extension/sessions
   ```

2. **Check backend logs**: Look for errors in terminal output

3. **Verify domain**: Use valid, crawlable domains

### No Media Links Found

1. **Domain structure**: Some domains use JavaScript-loaded media
2. **Access restrictions**: Some sites block automated crawlers
3. **Media patterns**: Unusual host/extension combinations

### Slow Crawls

1. **Reduce max pages**: Lower `maxPagesPerDomain` in `domainCrawler.ts`
2. **Increase timeout**: Some pages need longer to load
3. **Disable JavaScript**: Can speed up crawling for static sites

## Examples

### Example 1: Static Streaming Site

Input URL: `https://media-site.com/videos/stream.m3u8`

Expected Result:
- Crawls: `media-site.com`
- Finds: 5-20 media links
- Time: 5-10 seconds

### Example 2: Multi-Page Video Platform

Input URL: `https://platform.com/channel/live.m3u8`

Expected Result:
- Crawls: 50-100 pages
- Finds: 30+ media links
- Time: 30-60 seconds

### Example 3: CDN Resource

Input URL: `https://cdn.example.com/content/segment.ts`

Expected Result:
- Crawls: 10-20 pages
- Finds: Many TS segments (continuity)
- Time: 5-10 seconds

## Advanced Customization

### Modify Crawl Depth

Edit `backend/src/domainCrawler.ts`:

```typescript
const crawler = new DomainCrawler(
  100, // maxPagesPerDomain
  5    // maxDepth (increase to 5)
)
```

### Add Custom Media Patterns

Edit the `extractMediaLinks()` method:

```typescript
private extractMediaLinks(html: string): string[] {
  // Add custom pattern
  const customPattern = /https?:\/\/[^\s"'<>]+\.custom(?:\?[^\s"'<>]*)?/gi
  
  // Use it...
}
```

### Change Poll Interval

Edit `src/hooks/useAutoCrawler.ts`:

```typescript
const startPolling = useCallback((crawlSessionId: string, interval = 2000) => {
  // interval in milliseconds
}, [])
```

## Performance Tips

1. **Cache domains**: Don't re-crawl same domain too soon
2. **Limit depth**: Reduce `maxDepth` for faster crawls
3. **Parallel crawls**: System handles multiple crawls simultaneously
4. **Memory cleanup**: Old sessions auto-delete after 1 hour

## Troubleshooting

### Check Crawl Status in Browser Console

```javascript
// Get current crawl session ID
const crawlSessionId = 'crawl-session-123'

// Poll status
fetch(`http://localhost:3001/api/extension/crawl/${crawlSessionId}`)
  .then(r => r.json())
  .then(data => console.log(data))

// Get results
fetch(`http://localhost:3001/api/extension/crawl/${crawlSessionId}/results`)
  .then(r => r.json())
  .then(data => console.log(data.mediaLinks))
```

### Monitor Backend Logging

Check terminal where `npm run dev` is running:
- Crawl start: `Crawl started for domain: ...`
- Page processed: `Processed page: ...`
- Errors: `Error crawling ... : ...`

## Next Steps

1. Test with different domains
2. Customize media patterns for your needs
3. Integrate with existing crawlers
4. Add database storage for results
5. Implement webhook notifications

## API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/extension/register` | POST | Register extension |
| `/api/extension/capture` | POST | Capture URL & start crawl |
| `/api/extension/crawl/:id` | GET | Get crawl status |
| `/api/extension/crawl/:id/results` | GET | Get media links |
| `/api/extension/crawl/:id/pages` | GET | Get crawled pages |
| `/api/extension/crawl/:id/cancel` | POST | Cancel crawl |

---

**Version**: 1.0.0  
**Last Updated**: February 2024  
**Status**: Production Ready
