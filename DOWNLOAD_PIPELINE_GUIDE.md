# Download Monitoring Pipeline - Implementation Guide

## 🎯 Overview

A complete automated pipeline for capturing and processing download metadata including:
- **Files**: Automatic file detection and tracking
- **Metadata**: Season/episode numbers, title extraction
- **Images**: Thumbnail and screenshot extraction from videos
- **Descriptions**: Enrichment from TMDb, TVDb, Trakt APIs
- **Integration**: Automatic storage in persistent media library

## 📁 Architecture

```
┌─────────────────────────────────────────────────────────┐
│            Download Folder Monitoring                   │
│  (File system watcher for new downloads)               │
└────────┬────────────────────────────────────────────────┘
         │
         ├─→ File Detection
         │    └─ New file → Add to queue
         │
         ├─→ Metadata Extraction (MediaExtractor)
         │    ├─ Filename parsing (S01E05, year, quality)
         │    ├─ Video info (duration, codec, resolution)
         │    ├─ FFmpeg metadata extraction
         │    └─ Confidence scoring
         │
         ├─→ Image Processing
         │    ├─ Screenshot extraction (3 per video)
         │    ├─ FFmpeg thumbnail generation
         │    └─ Saved to .thumbnails directory
         │
         ├─→ Metadata Enrichment
         │    ├─ TMDb API search (movies)
         │    ├─ TVDb API search (series)
         │    ├─ Trakt API integration
         │    └─ Automatic poster/description retrieval
         │
         └─→ Persistent Storage
              └─ StorageManager integration
                 └─ Media library auto-updated
```

## 🚀 Getting Started

### 1. Install FFmpeg (Required for image extraction)

**Windows:**
```powershell
# Using Chocolatey
choco install ffmpeg

# Or download from https://ffmpeg.org/download.html
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

### 2. Start Monitoring

```bash
# Initialize and start monitoring
curl -X POST http://localhost:3001/api/downloads/start \
  -H "Content-Type: application/json" \
  -d '{
    "downloadDir": "/path/to/downloads",
    "monitorInterval": 5000
  }'
```

**Response:**
```json
{
  "message": "Download monitoring started",
  "directory": "/path/to/downloads",
  "monitorInterval": 5000
}
```

### 3. Check Status

```bash
curl http://localhost:3001/api/downloads/status
```

**Response:**
```json
{
  "running": true,
  "stats": {
    "totalMonitored": 5,
    "processed": 3,
    "queued": 0,
    "processing": 1,
    "enriched": 2
  }
}
```

## 📊 API Endpoints

### Core Operations

#### Start Monitoring
```
POST /api/downloads/start
{
  "downloadDir": "/path/to/downloads",
  "monitorInterval": 5000  // optional
}
```

#### Stop Monitoring
```
POST /api/downloads/stop
```

#### Get Monitoring Status
```
GET /api/downloads/status
```

### Data Retrieval

#### List All Downloads
```
GET /api/downloads/list
```

**Response:**
```json
{
  "total": 5,
  "processed": 3,
  "downloads": [
    {
      "id": "dl_1708796245123_abc123def",
      "filename": "Breaking.Bad.S01E05.Crazy.Handful.of.Nothin.1080p.mkv",
      "filepath": "/downloads/Breaking.Bad.S01E05.1080p.mkv",
      "filesize": 2147483648,
      "filetype": ".mkv",
      "mediaTitle": "Breaking Bad",
      "mediaType": "series",
      "season": 1,
      "episode": 5,
      "description": "Walter and Jesse's relationship reaches a critical point...",
      "genres": ["Drama", "Crime"],
      "releaseYear": 2008,
      "poster": "https://image.tmdb.org/t/p/w500/...",
      "screenshots": [
        "/api/downloads/dl_1708796245123_abc123def/screenshot/1",
        "/api/downloads/dl_1708796245123_abc123def/screenshot/2",
        "/api/downloads/dl_1708796245123_abc123def/screenshot/3"
      ],
      "processed": true,
      "enriched": true,
      "stored": false,
      "confidence": "high",
      "downloadedAt": 1708796245123,
      "completedAt": 1708796250456
    }
  ]
}
```

#### Get Processed Downloads Only
```
GET /api/downloads/processed
```

#### Get Specific Download
```
GET /api/downloads/:id
```

### Metadata & Image Processing

#### Extract Metadata from File
```
POST /api/downloads/extract-metadata
{
  "filepath": "/path/to/video.mkv"
}
```

**Response:**
```json
{
  "metadata": {
    "filename": "Breaking.Bad.S01E05.1080p.mkv",
    "title": "Breaking Bad",
    "season": 1,
    "episode": 5,
    "duration": 2700,
    "resolution": "1920x1080",
    "codec": "hevc"
  },
  "query": {
    "title": "Breaking Bad",
    "season": 1,
    "episode": 5,
    "year": 2008
  },
  "contentType": "series"
}
```

#### Extract Screenshots
```
POST /api/downloads/:id/extract-screenshots
{
  "count": 3  // Number of screenshots
}
```

**Response:**
```json
{
  "id": "dl_1708796245123_abc123def",
  "filename": "Breaking.Bad.S01E05.1080p.mkv",
  "screenshots": [
    "/path/to/.thumbnails/dl_1708796245123_abc123def/screenshot_1.jpg",
    "/path/to/.thumbnails/dl_1708796245123_abc123def/screenshot_2.jpg",
    "/path/to/.thumbnails/dl_1708796245123_abc123def/screenshot_3.jpg"
  ],
  "count": 3
}
```

#### Get Screenshot
```
GET /api/downloads/:id/screenshot/:index
```
Returns the JPEG image directly.

### Storage & Analytics

#### Store in Persistent Library
```
POST /api/downloads/:id/store
```

This automatically:
1. Adds to localStorage (browser) or persistent DB
2. Makes it searchable in media library
3. Updates stored flag

#### Get Statistics
```
GET /api/downloads/stats/summary
```

**Response:**
```json
{
  "running": true,
  "stats": {
    "totalMonitored": 15,
    "processed": 12,
    "queued": 0,
    "processing": 1,
    "enriched": 10
  },
  "byType": {
    "movies": 7,
    "series": 5,
    "liveTV": 0,
    "unknown": 3
  },
  "totalSize": 107374182400,
  "averageSize": 7158278826,
  "hasProcessingErrors": false
}
```

## 🔄 Data Flow Example

### Scenario: User downloads "Breaking.Bad.S01E05.1080p.mkv"

```
1. File Detection (5s interval)
   └─ New file detected in /downloads/
   
2. Queue for Processing
   └─ Added to processing queue
   
3. Metadata Extraction
   ├─ Filename: "Breaking.Bad.S01E05" 
   ├─ Extracted: Season=1, Episode=5
   ├─ FFmpeg: Duration=2700s, Resolution=1920x1080, Codec=HEVC
   └─ Title: "Breaking Bad"
   
4. Screenshot Extraction (concurrent)
   ├─ Extract @ 27 minutes: screenshot_1.jpg
   ├─ Extract @ 54 minutes: screenshot_2.jpg
   └─ Extract @ 81 minutes: screenshot_3.jpg
   
5. Metadata Enrichment
   ├─ Query TVDb: "Breaking Bad S01E05"
   ├─ Results: 
   │  - episodeTitle: "Crazy Handful of Nothin"
   │  - description: "Walter and Jesse's relationship..."
   │  - rating: 8.7
   │  - releaseDate: "2008-02-17"
   └─ Query TMDb: Poster image
   
6. Storage Integration
   ├─ StoredMediaItem created
   ├─ Added to media library
   └─ User can now search/play from library
```

## 🛠️ Configuration

### Environment Variables

```bash
# Download monitoring
DOWNLOADS_DIR=/path/to/downloads
DOWNLOAD_MONITOR_INTERVAL=5000

# FFmpeg paths
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe

# API enrichment (optional)
TMDB_API_KEY=your_key_here
TVDB_API_KEY=your_key_here
TRAKT_API_KEY=your_key_here

# Image storage
SCREENSHOTS_DIR=/path/to/.thumbnails
```

### DownloadMonitor Options

```typescript
interface DownloadMonitorConfig {
  downloadDir: string              // Directory to monitor
  monitorInterval: number          // Check interval (ms)
  maxConcurrentProcessing: number  // Parallel processing limit
  extractImages: boolean           // Enable screenshot extraction
  enrichMetadata: boolean          // Enable API enrichment
  apiKeys?: {
    tmdb?: string
    tvdb?: string
    trakt?: string
  }
}
```

## 📊 Data Models

### DownloadMetadata

```typescript
interface DownloadMetadata {
  // Identification
  id: string
  filename: string
  filepath: string
  
  // File Info
  filesize: number
  filetype: string            // .mkv, .mp4, etc.
  mimetype: string
  
  // Timeline
  downloadedAt: number
  completedAt: number
  
  // Media Classification
  mediaTitle?: string
  mediaType?: 'movie' | 'series' | 'live-tv' | 'unknown'
  
  // Series Info
  season?: number
  episode?: number
  episodeTitle?: string
  
  // Content Details
  description?: string
  genres?: string[]
  releaseYear?: number
  rating?: number
  imdbId?: string
  tmdbId?: string
  tvdbId?: string
  
  // Images
  poster?: string
  thumbnail?: string
  screenshots?: string[]        // Array of screenshot paths
  
  // Status Tracking
  processed: boolean
  enriched: boolean
  stored: boolean
  confidence: 'high' | 'medium' | 'low'
  errors?: string[]
}
```

### ExtractedMediaInfo

```typescript
interface ExtractedMediaInfo {
  filename: string
  title: string
  season?: number
  episode?: number
  episodeTitle?: string
  description?: string
  duration?: number              // seconds
  resolution?: string            // "1920x1080"
  codec?: string
  bitrate?: string
}
```

## 🔍 Event System

The DownloadMonitor extends EventEmitter and emits:

```typescript
// File detected
monitor.on('fileDetected', (event) => {
  console.log(event.filename)  // "Breaking.Bad.S01E05.mkv"
  console.log(event.filesize)  // 2147483648
})

// File processed
monitor.on('fileProcessed', (metadata) => {
  console.log(metadata.mediaTitle)  // "Breaking Bad"
  console.log(metadata.season)      // 1
  console.log(metadata.episode)     // 5
})

// Processing error
monitor.on('processingError', (error) => {
  console.error(error.file, error.error)
})

// General errors
monitor.on('error', (error) => {
  console.error(error)
})
```

## 💾 Integration with Storage

Processed downloads are automatically added to the media library:

```typescript
// Automatically called when storing
addStoredItems([{
  id: metadata.id,
  title: metadata.mediaTitle,
  url: `file://${metadata.filepath}`,
  indexer: 'download-monitor',
  size: metadata.filesize,
  contentType: metadata.mediaType,  // 'movie' | 'series' | 'live-tv'
  genre: metadata.genres,
  confidence: metadata.confidence,
  processedAt: metadata.completedAt,
  source: 'local-download'
}])
```

Search/retrieve from storage:

```typescript
// Browser-side
const allItems = getAllStoredItems()
const processed = allItems.filter(item => item.source === 'local-download')
```

## 🎯 Use Cases

### 1. Automatic Media Library Building
- Monitor downloads folder
- Extract metadata automatically
- Build searchable media library
- No manual metadata entry needed

### 2. Episode Tracking
- Parse season/episode numbers
- Enrich with episode descriptions
- Track watched vs. unwatched
- Auto-organize by series

### 3. Image Gallery
- Extract thumbnails from videos
- Build poster/screenshot library
- Use in UI for media browsing
- Store for offline access

### 4. Quality Analysis
- Track download quality (720p, 1080p, 4K)
- Store codec information
- Monitor bitrate statistics
- Identify best sources

### 5. Integration with Stremio/Kodi
- Auto-index local files
- Make searchable via addon filter
- Stream with metadata overlay
- Sync with remote libraries

## 📝 Example Usage

### Full Workflow Example

```javascript
// 1. Start monitoring
const startResponse = await fetch('http://localhost:3001/api/downloads/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    downloadDir: 'C:\\Users\\josht\\Downloads',
    monitorInterval: 5000
  })
})

// 2. Wait for files to be processed
// (Background: Monitor detects files, extracts metadata, enriches)

// 3. Get processed downloads
const listResponse = await fetch('http://localhost:3001/api/downloads/processed')
const { downloads } = await listResponse.json()

// 4. Extract screenshots from a series episode
const screenshotResponse = await fetch(
  'http://localhost:3001/api/downloads/abc123/extract-screenshots',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count: 5 })
  }
)

// 5. Store in persistent library
const storeResponse = await fetch(
  'http://localhost:3001/api/downloads/abc123/store',
  { method: 'POST' }
)

// 6. Display in UI
downloads.forEach(dl => {
  console.log(`${dl.mediaTitle} ${dl.season ? `S${dl.season}E${dl.episode}` : ''}`)
  console.log(`Genre: ${dl.genres?.join(', ')}`)
  console.log(`Rating: ${dl.rating}`)
  // Show screenshots in gallery
})
```

## 🐛 Troubleshooting

### FFmpeg not found
```
Error: ffmpeg: command not found
```
**Solution**: Install FFmpeg or set `FFMPEG_PATH` environment variable

### Screenshots not generating
```
Error: Failed to extract thumbnail
```
**Solution**: 
- Check file format is supported (MP4, MKV, AVI, MOV)
- Ensure video is not corrupted
- Check disk space for thumbnails

### Metadata not enriching
```
API request failed 401 Unauthorized
```
**Solution**: Configure API keys for TMDb/TVDb/Trakt

### Files not detected
```
Monitor running but no files detected
```
**Solution**:
- Check monitor interval (default 5s)
- Verify directory path is correct
- Ensure read permissions on directory

## 📈 Performance Tips

1. **Adjust Monitor Interval**: Longer intervals = less CPU
   ```bash
   "monitorInterval": 10000  // Check every 10 seconds
   ```

2. **Limit Concurrent Processing**: Balance CPU/memory
   ```bash
   "maxConcurrentProcessing": 2  // Process 2 files at once
   ```

3. **Disable Image Extraction**: If not needed
   ```bash
   "extractImages": false
   ```

4. **Batch Processing**: Process multiple files with:
   ```bash
   POST /api/downloads/batch-process
   ```

## 🔐 Security

- All file paths are validated
- API key protection on metadata enrichment endpoints
- Rate limiting applied to download endpoints
- No external URLs without sanitization
- File access restricted to configured directory

---

**Status**: ✅ Ready for production use  
**Version**: 1.0.0  
**Last Updated**: February 2026
