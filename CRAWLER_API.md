# Crawler API Documentation

## Overview

The Crawler API enables scrapers, crawlers, and media extraction tools to:
1. **Trace media URLs back to their source repositories** using `/api/crawler/trace`
2. **Initiate automated crawling sessions** on detected repositories using `/api/crawler/crawl`
3. **Chain both operations together** for seamless media discovery using `/api/crawler/chain`

This allows crawlers to follow the chain: **Media URL → Repository → Crawl Repository → Discover More Media**

---

## Endpoints

### 1. POST `/api/crawler/trace`

**Purpose**: Trace a media URL back to its source repository.

**Use Case**: When your crawler encounters a media file, trace it back to find the original repository for deeper scraping.

**Request**:
```bash
curl -X POST http://localhost:3002/api/crawler/trace \
  -H "Content-Type: application/json" \
  -d '{
    "media_url": "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u8"
  }'
```

**Request Body**:
```json
{
  "media_url": "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u8"
}
```

**Response** (High Confidence - GitHub):
```json
{
  "media_url": "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u8",
  "detected_type": "github",
  "repository_url": "https://github.com/iptv-org/iptv",
  "repository_info": {
    "owner": "iptv-org",
    "name": "iptv",
    "branch": "main",
    "path": "streams.m3u8"
  },
  "confidence": "high",
  "raw_analysis": "Detected from hostname: raw.githubusercontent.com"
}
```

**Supported Repository Types**:
- `github` - GitHub repositories (high confidence)
- `gitlab` - GitLab repositories (high confidence)
- `bitbucket` - Bitbucket repositories (high confidence)
- `codeberg` - Codeberg repositories (high confidence)
- `web` - Generic web servers (low confidence)
- `unknown` - Could not detect

**Response Codes**:
- `200` - Successfully traced repository
- `400` - Invalid URL format or missing parameters
- `500` - Server error

---

### 2. POST `/api/crawler/crawl`

**Purpose**: Initiate an automated crawling session on a repository.

**Use Case**: After discovering a repository, crawl it to extract all media URLs, playlists, and metadata.

**Request**:
```bash
curl -X POST http://localhost:3002/api/crawler/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "repository_url": "https://github.com/iptv-org/iptv",
    "max_pages": 50,
    "max_depth": 2,
    "filters": {
      "extensions": ["m3u8", "m3u", "mp4", "ts", "mkv"]
    }
  }'
```

**Request Body**:
```json
{
  "repository_url": "https://github.com/iptv-org/iptv",
  "max_pages": 50,           // Maximum pages to crawl
  "max_depth": 2,            // Maximum directory depth
  "filters": {
    "extensions": ["m3u8", "mp4"]  // File extensions to look for
  }
}
```

**Response** (Accepted - Job Queued):
```json
{
  "success": true,
  "crawl_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "message": "Crawl session queued successfully",
  "repository_url": "https://github.com/iptv-org/iptv",
  "repo_type": "github",
  "tracking": {
    "status_endpoint": "/api/crawler/crawl/550e8400-e29b-41d4-a716-446655440000/status",
    "results_endpoint": "/api/crawler/crawl/550e8400-e29b-41d4-a716-446655440000/results"
  },
  "timestamp": "2026-02-21T12:00:00.000Z"
}
```

**Response Codes**:
- `202` - Crawl job successfully queued (asynchronous)
- `400` - Invalid repository URL
- `500` - Server error

---

### 3. GET `/api/crawler/crawl/{crawl_id}/status`

**Purpose**: Get real-time status of an active crawl session.

**Use Case**: Monitor crawl progress without blocking your crawler.

**Request**:
```bash
curl -X GET http://localhost:3002/api/crawler/crawl/550e8400-e29b-41d4-a716-446655440000/status
```

**Response** (In Progress):
```json
{
  "crawl_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "crawling",
  "progress": 50,
  "repository_url": "https://github.com/iptv-org/iptv",
  "repo_type": "github",
  "created_at": "2026-02-21T12:00:00.000Z",
  "updated_at": "2026-02-21T12:01:30.000Z",
  "estimated_completion": "2026-02-21T12:02:00.000Z"
}
```

**Response** (Completed):
```json
{
  "crawl_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "repository_url": "https://github.com/iptv-org/iptv",
  "repo_type": "github",
  "created_at": "2026-02-21T12:00:00.000Z",
  "updated_at": "2026-02-21T12:05:00.000Z",
  "estimated_completion": null
}
```

**Response Codes**:
- `200` - Status retrieved successfully
- `404` - Crawl session not found
- `500` - Server error

---

### 4. GET `/api/crawler/crawl/{crawl_id}/results`

**Purpose**: Get the complete crawl results including all discovered media.

**Use Case**: After crawl completes, retrieve all extracted URLs, file counts, and metadata.

**Request**:
```bash
curl -X GET http://localhost:3002/api/crawler/crawl/550e8400-e29b-41d4-a716-446655440000/results
```

**Response** (Complete):
```json
{
  "crawl_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "repository_url": "https://github.com/iptv-org/iptv",
  "repo_type": "github",
  "results": {
    "pages_crawled": 42,
    "links_found": 523,
    "media_found": {
      "video": 287,
      "audio": 98,
      "playlist": 31,
      "archive": 15,
      "other": 92
    },
    "file_types": [
      "m3u8",
      "m3u",
      "mp4",
      "ts",
      "mkv",
      "avi",
      "zip",
      "tar",
      "json",
      "xml"
    ]
  },
  "created_at": "2026-02-21T12:00:00.000Z",
  "updated_at": "2026-02-21T12:05:00.000Z"
}
```

**In-Progress Response**:
```json
{
  "message": "Crawl still in progress (status: crawling)",
  "progress": 65,
  "crawl_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response Codes**:
- `200` - Results available (completed or failed)
- `202` - Crawl still in progress
- `404` - Crawl session not found
- `500` - Server error

---

### 5. POST `/api/crawler/chain`

**Purpose**: Combined endpoint - trace a media URL AND automatically initiate a crawl on the detected repository.

**Use Case**: Streamlined workflow when you want to immediately crawl a repository after discovering a media file.

**Request**:
```bash
curl -X POST http://localhost:3002/api/crawler/chain \
  -H "Content-Type: application/json" \
  -d '{
    "media_url": "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u8",
    "auto_crawl": true,
    "crawl_options": {
      "max_pages": 50,
      "max_depth": 2,
      "filters": { "extensions": ["m3u8", "mp4"] }
    }
  }'
```

**Request Body**:
```json
{
  "media_url": "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u8",
  "auto_crawl": true,
  "crawl_options": {
    "max_pages": 50,
    "max_depth": 2,
    "filters": { "extensions": ["m3u8", "mp4"] }
  }
}
```

**Response**:
```json
{
  "success": true,
  "trace": {
    "media_url": "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u8",
    "detected_type": "github",
    "repository_url": "https://github.com/iptv-org/iptv",
    "repository_info": {
      "owner": "iptv-org",
      "name": "iptv",
      "branch": "main",
      "path": "streams.m3u8"
    },
    "confidence": "high"
  },
  "crawl": {
    "crawl_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "queued",
    "repository_url": "https://github.com/iptv-org/iptv",
    "tracking_endpoint": "/api/crawler/crawl/550e8400-e29b-41d4-a716-446655440000/status"
  },
  "workflow": "Traced media URL to repository. Crawl initiated."
}
```

**Response Codes**:
- `200` - Successfully traced and queued crawl
- `400` - Invalid URL or no crawlable repository detected
- `500` - Server error

---

## Workflow Examples

### Example 1: Simple Media Trace

**Scenario**: Your crawler found `https://example.com/streams.m3u8` and wants to know its source.

```bash
# Trace the media
curl -X POST http://localhost:3002/api/crawler/trace \
  -H "Content-Type: application/json" \
  -d '{"media_url":"https://raw.githubusercontent.com/user/repo/main/playlist.m3u8"}'

# Response shows it's from GitHub: https://github.com/user/repo
```

---

### Example 2: Repository Crawl with Monitoring

**Scenario**: Crawl a detected repository and monitor progress.

```bash
# 1. Initiate crawl
CRAWL_RESPONSE=$(curl -s -X POST http://localhost:3002/api/crawler/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "repository_url": "https://github.com/iptv-org/iptv",
    "max_pages": 50,
    "max_depth": 2
  }')

CRAWL_ID=$(echo $CRAWL_RESPONSE | jq -r '.crawl_id')
echo "Crawl started: $CRAWL_ID"

# 2. Poll status
while true; do
  STATUS=$(curl -s http://localhost:3002/api/crawler/crawl/$CRAWL_ID/status)
  PROGRESS=$(echo $STATUS | jq -r '.progress')
  echo "Progress: $PROGRESS%"
  
  if [ "$PROGRESS" == "100" ]; then
    break
  fi
  
  sleep 2
done

# 3. Get results
curl -s http://localhost:3002/api/crawler/crawl/$CRAWL_ID/results | jq '.results'
```

---

### Example 3: Full Chain (Trace + Auto-Crawl)

**Scenario**: Find a media file and immediately crawl its entire repository.

```bash
curl -X POST http://localhost:3002/api/crawler/chain \
  -H "Content-Type: application/json" \
  -d '{
    "media_url": "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u8",
    "auto_crawl": true,
    "crawl_options": {
      "max_pages": 100,
      "max_depth": 3
    }
  }' | jq '.'

# Instantly get both trace info AND crawl_id for monitoring
```

---

## Integration in Crawlers

### Python Example

```python
import requests
import time

class CrawlerWithRepositoryTracing:
    API_BASE = "http://localhost:3002/api/crawler"
    
    def trace_media_url(self, media_url: str):
        """Trace media back to source repository"""
        response = requests.post(
            f"{self.API_BASE}/trace",
            json={"media_url": media_url}
        )
        return response.json()
    
    def crawl_repository(self, repo_url: str, max_pages: int = 50):
        """Start crawling a repository"""
        response = requests.post(
            f"{self.API_BASE}/crawl",
            json={
                "repository_url": repo_url,
                "max_pages": max_pages,
                "max_depth": 2
            }
        )
        return response.json()
    
    def get_crawl_results(self, crawl_id: str):
        """Poll and wait for crawl results"""
        while True:
            response = requests.get(
                f"{self.API_BASE}/crawl/{crawl_id}/status"
            )
            status = response.json()
            
            if status['progress'] == 100:
                break
            
            print(f"Crawl progress: {status['progress']}%")
            time.sleep(2)
        
        # Get final results
        results = requests.get(
            f"{self.API_BASE}/crawl/{crawl_id}/results"
        ).json()
        
        return results
    
    def chain_trace_and_crawl(self, media_url: str):
        """One-shot: trace + crawl"""
        response = requests.post(
            f"{self.API_BASE}/chain",
            json={
                "media_url": media_url,
                "auto_crawl": True,
                "crawl_options": {"max_pages": 50}
            }
        )
        return response.json()

# Usage
crawler = CrawlerWithRepositoryTracing()

# Found media, trace it
media_url = "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u8"
trace_result = crawler.trace_media_url(media_url)

if trace_result['confidence'] == 'high':
    print(f"Found repository: {trace_result['repository_url']}")
    
    # Start crawl
    crawl_response = crawler.crawl_repository(
        trace_result['repository_url']
    )
    crawl_id = crawl_response['crawl_id']
    
    # Wait for results
    results = crawler.get_crawl_results(crawl_id)
    print(f"Found {results['results']['links_found']} links")
```

### JavaScript/Node.js Example

```javascript
const fetch = require('node-fetch');

class CrawlerAPI {
  constructor(baseUrl = 'http://localhost:3002') {
    this.baseUrl = baseUrl;
  }

  async traceMedia(mediaUrl) {
    const response = await fetch(`${this.baseUrl}/api/crawler/trace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_url: mediaUrl })
    });
    return response.json();
  }

  async initiateCrawl(repoUrl, options = {}) {
    const response = await fetch(`${this.baseUrl}/api/crawler/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repository_url: repoUrl,
        max_pages: options.maxPages || 50,
        max_depth: options.maxDepth || 2
      })
    });
    return response.json();
  }

  async waitForCrawlCompletion(crawlId, pollInterval = 2000) {
    while (true) {
      const response = await fetch(
        `${this.baseUrl}/api/crawler/crawl/${crawlId}/status`
      );
      const status = response.json();
      
      if (status.progress === 100) break;
      
      console.log(`Progress: ${status.progress}%`);
      await new Promise(r => setTimeout(r, pollInterval));
    }
  }

  async getCrawlResults(crawlId) {
    const response = await fetch(
      `${this.baseUrl}/api/crawler/crawl/${crawlId}/results`
    );
    return response.json();
  }

  async chainTraceAndCrawl(mediaUrl) {
    const response = await fetch(`${this.baseUrl}/api/crawler/chain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_url: mediaUrl,
        auto_crawl: true,
        crawl_options: { max_pages: 50 }
      })
    });
    return response.json();
  }
}

// Usage
const crawler = new CrawlerAPI();

(async () => {
  const result = await crawler.chainTraceAndCrawl(
    'https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u8'
  );
  
  console.log('Trace result:', result.trace);
  const crawlId = result.crawl.crawl_id;
  
  await crawler.waitForCrawlCompletion(crawlId);
  const results = await crawler.getCrawlResults(crawlId);
  
  console.log('Crawl results:', results.results);
})();
```

---

## Error Handling

### Example: Invalid URL

```json
{
  "error": "Invalid URL format",
  "code": "INVALID_URL"
}
```

### Example: Repository Not Found

```json
{
  "error": "Could not detect a crawlable repository from this media URL",
  "code": "NO_REPOSITORY_DETECTED",
  "detected_type": "unknown"
}
```

### Example: Crawl Session Not Found

```json
{
  "error": "Crawl session not found",
  "code": "NOT_FOUND",
  "crawl_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Rate Limiting & Best Practices

1. **Respect Repository Limits**: Set `max_pages` based on your needs (default: 50)
2. **Use Depth Wisely**: `max_depth: 2` covers most repository structures
3. **Cache Results**: Cache trace results to avoid repeated detection
4. **Poll Respectfully**: Don't poll status more than every 1-2 seconds
5. **Parallel Crawls**: You can initiate multiple crawls in parallel

---

## Architecture

The Crawler API is designed to seamlessly integrate with the Media Link Extractor's intelligent ingestion system:

```
Media Discovery
       ↓
[Crawler detects media URL]
       ↓
POST /api/crawler/trace ← Detect repository source
       ↓
POST /api/crawler/crawl ← Initiate repository crawl
       ↓
GET /api/crawler/crawl/:id/status ← Monitor progress
       ↓
GET /api/crawler/crawl/:id/results ← Get discovered media
       ↓
[Crawler feeds results back to Media Link Extractor]
```

This enables a **fully automated repository discovery chain** where crawlers can find media, trace it to its source, and continue scraping the entire repository.
