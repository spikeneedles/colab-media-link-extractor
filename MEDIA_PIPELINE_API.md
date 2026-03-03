# Media Processing & Classification Pipeline

Complete workflow for extracting, enriching, deduplicating, and classifying media URLs into Movies, Live Television, and Series categories.

## Overview

The Media Processing Pipeline automates the complete workflow:

```
Load URLs from Job
    ↓
Validate URLs
    ↓
Extract from Playlist Files (m3u, m3u8, xsp, strm, etc.)
    ↓
Deduplicate URLs
    ↓
Enrich Metadata (titles, descriptions, genres)
    ↓
Classify into Content Type (Movie | Series | Live TV)
    ↓
Display for User Review
    ↓
Generate & Download M3U Playlists
```

## API Endpoints

### 1. Process and Classify Media URLs

Start processing a batch of media URLs.

**Endpoint:** `POST /api/media/process-and-classify`

**Request Body:**
```json
{
  "urls": [
    "https://raw.githubusercontent.com/iptv-org/iptv/master/playlists/all.m3u",
    "https://example.com/movies.m3u",
    "http://example.com/stream.m3u8",
    "https://api.example.com/channels/live.xspf"
  ],
  "jobId": "optional-custom-uuid"
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "progress": 0,
  "message": "Processing started"
}
```

**Status Values:**
- `pending` - Job queued
- `processing` - Loading URLs
- `extracting` - Extracting media from playlists
- `enriching` - Adding metadata (names, descriptions, genres)
- `classifying` - Categorizing into Movies/Series/Live TV
- `complete` - Processing finished
- `error` - Processing failed

---

### 2. Get Processing Status

Check progress of a processing job.

**Endpoint:** `GET /api/media/process-and-classify/:id/status`

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "enriching",
  "progress": 65,
  "totalUrls": 4,
  "processedUrls": 4,
  "extractedCount": 2847,
  "counts": {
    "movies": 892,
    "series": 305,
    "liveTV": 1650
  },
  "startedAt": "2024-01-15T10:30:45.123Z",
  "completedAt": null
}
```

---

### 3. Get Processing Results

Retrieve classified and enriched media.

**Endpoint:** `GET /api/media/process-and-classify/:id/results`

**Response (when complete):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "complete",
  "summary": {
    "total": 2847,
    "movies": {
      "count": 892,
      "items": [
        {
          "url": "https://example.com/movies/action/the-matrix-1999.mp4",
          "title": "The Matrix",
          "contentType": "movie",
          "category": "Action",
          "genre": ["sci-fi", "action", "thriller"],
          "description": "A hackerComputer programmer learns from mysterious rebels about the true nature of reality",
          "logo": "https://example.com/logos/matrix.jpg",
          "releaseYear": 1999,
          "duration": 136,
          "confidence": "high",
          "source": "example.com"
        }
      ]
    },
    "series": {
      "count": 305,
      "items": [
        {
          "url": "https://example.com/series/the-office/s01e01.mp4",
          "title": "The Office - Season 1, Episode 1",
          "contentType": "series",
          "category": "Comedy",
          "genre": ["comedy", "documentary"],
          "season": 1,
          "episode": 1,
          "confidence": "high",
          "source": "example.com"
        }
      ]
    },
    "liveTV": {
      "count": 1650,
      "items": [
        {
          "url": "https://stream.example.com/live/channel1/playlist.m3u8",
          "title": "Channel 1 Live",
          "contentType": "live-tv",
          "category": "News",
          "genre": ["news"],
          "logo": "https://example.com/logos/channel1.png",
          "confidence": "high",
          "source": "stream.example.com"
        }
      ]
    }
  },
  "processingTime": 45
}
```

---

### 4. Generate M3U Playlists

Create M3U8 playlist files from classified media.

**Endpoint:** `POST /api/media/generate-playlists/:id`

**Request Body (optional):**
```json
{
  "categories": ["movies", "series", "live-tv"],
  "includeEpg": true
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "playlists": {
    "movies": "#EXTM3U x-tvg-url=\"http://epg.example.com/epg.xml\"...",
    "series": "#EXTM3U x-tvg-url=\"http://epg.example.com/epg.xml\"...",
    "live-tv": "#EXTM3U x-tvg-url=\"http://epg.example.com/epg.xml\"..."
  }
}
```

---

### 5. Download Playlist File

Download a specific M3U8 playlist.

**Endpoint:** `GET /api/media/download-playlist/:id/:category`

**Category Options:**
- `movies` - Download Movies.m3u8
- `series` - Download Series.m3u8
- `live-tv` - Download Live TV.m3u8

**Response:**
- Content-Type: `application/vnd.apple.mpegurl`
- Content-Disposition: `attachment; filename="Movies.m3u8"`
- Body: M3U8 playlist file (can be saved directly or imported into media player)

**Example:**
```bash
# Download movies playlist
curl http://localhost:3002/api/media/download-playlist/550e8400-e29b-41d4-a716-446655440000/movies \
  -o Movies.m3u8

# Download live TV playlist  
curl http://localhost:3002/api/media/download-playlist/550e8400-e29b-41d4-a716-446655440000/live-tv \
  -o LiveTV.m3u8
```

---

### 6. Clear Processing Job

Delete a completed processing job from memory.

**Endpoint:** `DELETE /api/media/process-and-classify/:id`

**Response:**
```json
{
  "success": true,
  "message": "Job cleared"
}
```

---

## Complete Workflow Examples

### Example 1: Process Playlists and Download Movies

```javascript
// 1. Start processing
const startRes = await fetch('http://localhost:3002/api/media/process-and-classify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    urls: [
      'https://raw.githubusercontent.com/iptv-org/iptv/master/playlists/movies.m3u',
      'https://example.com/my-movies.m3u'
    ]
  })
})
const { id } = await startRes.json()

// 2. Poll for completion
let status
do {
  const statusRes = await fetch(`http://localhost:3002/api/media/process-and-classify/${id}/status`)
  status = await statusRes.json()
  console.log(`Progress: ${status.progress}%, Movies: ${status.counts.movies}`)
  if (status.status !== 'complete') {
    await new Promise(r => setTimeout(r, 2000)) // Wait 2 seconds
  }
} while (status.status !== 'complete')

// 3. Download movies playlist
const playlist = await fetch(`http://localhost:3002/api/media/download-playlist/${id}/movies`)
const blob = await playlist.blob()
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = 'Movies.m3u8'
a.click()
```

### Example 2: Process and Review Before Download

```python
import requests
import json
import time

# 1. Start processing
urls = [
    "https://raw.githubusercontent.com/iptv-org/iptv/master/playlists/all.m3u",
    "https://example.com/channels.m3u8"
]

response = requests.post('http://localhost:3002/api/media/process-and-classify', json={'urls': urls})
job_id = response.json()['id']
print(f"Processing job: {job_id}")

# 2. Wait for completion
while True:
    status_res = requests.get(f'http://localhost:3002/api/media/process-and-classify/{job_id}/status')
    status = status_res.json()
    
    if status['status'] == 'complete':
        break
    
    print(f"Status: {status['status']}, Progress: {status['progress']}%")
    print(f"  Movies: {status['counts']['movies']}")
    print(f"  Series: {status['counts']['series']}")
    print(f"  Live TV: {status['counts']['liveTV']}")
    time.sleep(2)

# 3. Get results for review
results_res = requests.get(f'http://localhost:3002/api/media/process-and-classify/{job_id}/results')
results = results_res.json()

# 4. Display summary
print(f"\nProcessing complete in {results['processingTime']}s")
print(f"Total media: {results['summary']['total']}")
print(f"  Movies: {results['summary']['movies']['count']}")
print(f"  Series: {results['summary']['series']['count']}")
print(f"  Live TV: {results['summary']['liveTV']['count']}")

# 5. Download all three playlists
for category in ['movies', 'series', 'live-tv']:
    res = requests.get(f'http://localhost:3002/api/media/download-playlist/{job_id}/{category}')
    filename = category.replace('-', ' ').title() + '.m3u8'
    with open(filename, 'wb') as f:
        f.write(res.content)
    print(f"Downloaded: {filename}")

# 6. Clean up
requests.delete(f'http://localhost:3002/api/media/process-and-classify/{job_id}')
```

### Example 3: Real-time Progress Monitoring with WebSocket-style Polling

```javascript
class MediaProcessor {
  async processAndMonitor(urls, onProgress) {
    // Start processing
    const startRes = await fetch('http://localhost:3002/api/media/process-and-classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls })
    })
    const { id } = await startRes.json()

    // Poll with backoff
    let isComplete = false
    let pollInterval = 500 // Start with 500ms

    while (!isComplete) {
      const statusRes = await fetch(`http://localhost:3002/api/media/process-and-classify/${id}/status`)
      const status = await statusRes.json()

      onProgress({
        progress: status.progress,
        status: status.status,
        counts: status.counts,
        totalExtracted: status.extractedCount
      })

      if (status.status === 'complete' || status.status === 'error') {
        isComplete = true
        return { id, status }
      }

      // Increase polling interval as time goes on (up to 3s)
      pollInterval = Math.min(pollInterval * 1.5, 3000)
      await new Promise(r => setTimeout(r, pollInterval))
    }
  }

  async downloadPlaylists(jobId) {
    const categories = ['movies', 'series', 'live-tv']
    const downloads = {}

    for (const category of categories) {
      const res = await fetch(`http://localhost:3002/api/media/download-playlist/${jobId}/${category}`)
      if (res.ok) {
        downloads[category] = await res.blob()
      }
    }

    return downloads
  }
}

// Usage
const processor = new MediaProcessor()
const urls = [...] // Your URLs

await processor.processAndMonitor(urls, (progress) => {
  console.log(`${progress.progress}% - ${progress.status}`)
  console.log(`Movies: ${progress.counts.movies} | Series: ${progress.counts.series} | Live TV: ${progress.counts.liveTV}`)
})

const playlists = await processor.downloadPlaylists(jobId)
```

---

## Supported Playlist Formats

The pipeline automatically detects and extracts media from:

### Standard Formats
- **M3U / M3U8** - Extended playlist format with metadata (EXTINF tags)
  ```
  #EXTM3U
  #EXTINF:-1 tvg-id="123" tvg-name="Title" group-title="Category" tvg-logo="url",Display Title
  https://example.com/stream.m3u8
  ```

- **XSPF** - XML Shareable Playlist Format
- **PLS** - Playlist format
- **STRM** - XBMC/Kodi stream reference files

### Metadata Formats
- **XML/NFO** - XBMC Media Center metadata
- **JSON** - Custom playlist JSON format
- **CSV** - Comma-separated values

### Archives (Automatically Extracted)
- ZIP files containing playlists
- 7Z, RAR, TAR, TAR.GZ, TGZ archives

---

## Content Classification Rules

### Live TV Detection
Identified by patterns:
- URL contains: "live", "channel", "m3u8", "playlist", "stream"
- Title contains: "live", "channel", "news", "sports"
- Category: "Live", "Channel", "IPTV", "Broadcast"

### Series Detection
Identified by patterns:
- Title contains season/episode markers: "S01E01", "season", "episode"
- Category: "Series", "Show", "TV", "Serial"
- URL patterns: "/series/", "/show/", "/season/"

### Movie Detection
Identified by patterns:
- URL contains: "movie", "film", "cinema", "720p", "1080p"
- File extension: ".mp4", ".mkv", ".avi", ".webm"
- Category: "Movie", "Film", "Cinema"

---

## Enrichment Details

### Metadata Added During Enrichment

1. **Title Generation** - From filename or URL if not provided
2. **Genre Detection** - From title keywords and category
3. **Confidence Scoring** - Based on data completeness
4. **Source Detection** - Hostname extraction
5. **Duration** - From metadata if available
6. **Season/Episode Parsing** - For series content

### Genre Categories

Auto-detected genres include:
- Action, Comedy, Drama, Horror, Thriller, Romance
- Sci-Fi, Fantasy, Adventure, Animation, Documentary
- News, Sports, Music, Lifestyle, Educational

---

## Error Handling

### Common Errors and Solutions

**Error: "Invalid input: urls must be a non-empty array"**
```json
{
  "error": "Invalid input: urls must be a non-empty array"
}
```
- Solution: Provide valid array of URLs in request body

**Error: "Job not found"**
```json
{
  "error": "Job not found"
}
```
- Solution: Verify job ID is correct (check /status endpoint)

**Error: "Job is processing"**
```json
{
  "message": "Job is processing",
  "progress": 45,
  "status": "enriching"
}
```
- Solution: Wait for job to complete before requesting results

---

## Performance Considerations

- **Processing Time**: Depends on URL count and playlist sizes
  - ~500ms per playlist URL
  - Metadata enrichment: ~100ms per media item
  - Classification: ~50ms per media item

- **Memory Usage**:
  - Job data kept in memory while processing
  - Clear completed jobs with DELETE endpoint
  - Recommends cleanup after playlist download

- **Rate Limiting**:
  - 100 requests per 15 minutes per IP
  - Localhost (development) exempt from rate limiting

---

## Integration with Frontend

### Recommended UI Flow

1. **Input Stage** - User provides playlist URLs
2. **Processing Stage** - Real-time progress bar (polls /status)
3. **Review Stage** - Display results (GET /results)
   - Show 3 tabs: Movies | Series | Live TV
   - Preview media counts
   - Option to edit/remove entries
4. **Download Stage** - User selects which playlists to download
5. **Cleanup** - Delete job after download

### React Component Example

```typescript
import { useState, useEffect } from 'react'

export function MediaProcessor() {
  const [jobId, setJobId] = useState<string>('')
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState(null)

  const startProcessing = async (urls: string[]) => {
    const res = await fetch('/api/media/process-and-classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls })
    })
    const data = await res.json()
    setJobId(data.id)
    setStatus('processing')
  }

  useEffect(() => {
    if (!jobId || status === 'complete' || status === 'error') return

    const interval = setInterval(async () => {
      const res = await fetch(`/api/media/process-and-classify/${jobId}/status`)
      const data = await res.json()
      
      setProgress(data.progress)
      setStatus(data.status)

      if (data.status === 'complete') {
        const resultsRes = await fetch(`/api/media/process-and-classify/${jobId}/results`)
        setResults(await resultsRes.json())
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [jobId, status])

  return (
    <div className="media-processor">
      {status === 'idle' && (
        <button onClick={() => startProcessing([...])}>Process URLs</button>
      )}
      
      {status !== 'idle' && status !== 'complete' && (
        <div>
          <div className="progress-bar" style={{ width: `${progress}%` }} />
          <p>{status} - {progress}%</p>
        </div>
      )}

      {results && (
        <MediaReviewPanel results={results} jobId={jobId} />
      )}
    </div>
  )
}
```

---

## Troubleshooting

### Processing Seems Stuck

1. Check status: `GET /api/media/process-and-classify/:id/status`
2. If progress hasn't changed in 2 minutes, restart backend
3. Job will resume from last successful state

### Missing Media in Results

- Verify playlist URLs are accessible
- Check playlist format is supported (M3U, XSPF, PLS, JSON)
- Some URLs may fail extraction due to authentication or format errors

### Incorrect Classifications

- Enrichment uses pattern matching - ambiguous content may be miscategorized
- Review results before download
- Can manually move items between categories in frontend UI

---

## API Reference Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/media/process-and-classify` | POST | Start processing job |
| `/api/media/process-and-classify/:id/status` | GET | Get job status |
| `/api/media/process-and-classify/:id/results` | GET | Get classified results |
| `/api/media/generate-playlists/:id` | POST | Generate M3U files |
| `/api/media/download-playlist/:id/:category` | GET | Download M3U file |
| `/api/media/process-and-classify/:id` | DELETE | Clear job |

---

## Related Services

- **PlaylistExtractor** (`services/PlaylistExtractor.ts`) - Extracts media URLs from playlist files
- **MediaMetadataEnricher** (`services/MediaMetadataEnricher.ts`) - Enhances metadata and classifies content
- **Crawler API** (`/api/crawler/*`) - Traces media URLs to source repositories
