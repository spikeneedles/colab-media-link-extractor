# Download Pipeline - Quick Reference Card

## 🎯 What You Got

A complete automated pipeline that:
```
Downloads Folder → File Detection → Metadata Extraction → Images
        ↓                                                    ↓
    📹 Your Files          🔍 Parsing Season/Episode    📸 Screenshots
    🎬 Auto-detected                   ↓                     ↓
    🎯 Categorized         🎓 Content Classification  📚 Organized
                                      ↓                ↓
                           💾 Storage Integration ← → 🎬 Stremio/Kodi
```

## 📦 Files Created

```
backend/src/services/
├── DownloadMonitor.ts           (500 lines)  - Main monitoring engine
└── MediaExtractor.ts            (400 lines)  - Image & metadata extraction

backend/src/routes/
└── downloadsRoutes.ts           (450 lines)  - REST API (12 endpoints)

Documentation/
├── DOWNLOAD_PIPELINE_GUIDE.md        (600 lines) - Complete API reference
├── DOWNLOAD_PIPELINE_QUICKSTART.md   (400 lines) - 5-minute setup
├── DOWNLOAD_PIPELINE_ARCHITECTURE.md (400 lines) - System design
└── DOWNLOAD_PIPELINE_DELIVERY.md     (300 lines) - This summary
```

## 🚀 Get Started in 5 Minutes

```bash
# 1. Install FFmpeg
choco install ffmpeg

# 2. Start backend server
cd backend && npm run dev

# 3. Start monitoring
curl -X POST http://localhost:3001/api/downloads/start \
  -H "Content-Type: application/json" \
  -d '{"downloadDir": "/path/to/Downloads"}'

# 4. Download a video file

# 5. Check results in 5-10 seconds
curl http://localhost:3001/api/downloads/list
```

## 🔌 API Endpoints (12 Total)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/downloads/start` | Start monitoring directory |
| POST | `/api/downloads/stop` | Stop monitoring |
| **GET** | `/api/downloads/status` | Get monitor status |
| GET | `/api/downloads/list` | All downloaded files |
| GET | `/api/downloads/processed` | Processed downloads only |
| GET | `/api/downloads/:id` | Specific file details |
| POST | `/api/downloads/extract-metadata` | Extract from file path |
| POST | `/api/downloads/:id/extract-screenshots` | Get 3 screenshots |
| GET | `/api/downloads/:id/screenshot/:index` | View single screenshot |
| POST | `/api/downloads/:id/store` | Save to media library |
| GET | `/api/downloads/stats/summary` | Full statistics |

## 📊 Data Extracted

```typescript
{
  // File Info
  filename: "Breaking.Bad.S01E05.1080p.mkv"
  filesize: 2147483648
  
  // Metadata (Auto-extracted)
  mediaTitle: "Breaking Bad"
  mediaType: "series"
  season: 1
  episode: 5
  
  // Video Info
  duration: 2700        // seconds
  resolution: "1920x1080"
  codec: "hevc"
  
  // Images
  screenshots: [
    "/api/downloads/dl_123/screenshot/1",  ← JPEG image
    "/api/downloads/dl_123/screenshot/2",  ← JPEG image
    "/api/downloads/dl_123/screenshot/3"   ← JPEG image
  ]
  
  // Status
  processed: true
  confidence: "high"
  stored: false  ← Can be auto-stored
}
```

## 🎯 Pattern Detection

```
Input Filename          Extracted
─────────────────────────────────────────────────────
Breaking.Bad.S01E05     Season: 1, Episode: 5
The.Office.2x03         Season: 2, Episode: 3
Movie.Title.2024        Year: 2024, Type: movie
Video.1080p.mkv         Resolution: 1080p
Show.720p.BluRay.mp4    Quality: 720p, Source: BluRay
```

## 💡 Integration Map

```
What exists                What's new              What's enhanced
────────────────────────────────────────────────────────────────────
StorageManager    ←→  DownloadMonitor   ← ← ← Adds local files
  (saves data)         (detects files)
  
Stremio/Kodi      ←→  downloadsRoutes   ← ← ← New API control
  (displays)           (REST endpoints)
  
Existing APIs           MediaExtractor   ← ← ← Ready to enrich
  (TMDb/TVDb)          (extracts data)        with metadata
```

## 🎮 Common Operations

### Check if running
```bash
curl http://localhost:3001/api/downloads/status
```

### Get all files
```bash
curl http://localhost:3001/api/downloads/list
```

### Get specific file details
```bash
curl http://localhost:3001/api/downloads/dl_12345
```

### View screenshot
```bash
# Shows JPEG image in browser
http://localhost:3001/api/downloads/dl_12345/screenshot/1
```

### Save to library
```bash
curl -X POST http://localhost:3001/api/downloads/dl_12345/store
```

### Get statistics
```bash
curl http://localhost:3001/api/downloads/stats/summary
```

## 📈 Processing Timeline

```
Time    Event
──────  ──────────────────────────────────────────────
00:00   User downloads video file
00:05   File detected by monitor
00:06   Metadata extraction starts
00:08   Filename parsed (season/episode)
        Video info extracted (duration, codec)
00:10   Screenshots extracted (3 images)
00:15   All processing complete
        Ready to store in library
00:20   File appears in Stremio/Kodi
```

## 🔧 Configuration

### Environment Variables (Optional)

```bash
DOWNLOADS_DIR=/path/to/downloads
DOWNLOAD_MONITOR_INTERVAL=5000
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
TMDB_API_KEY=your_key
TVDB_API_KEY=your_key
```

### Start Parameters

```bash
POST /api/downloads/start
{
  "downloadDir": "/absolute/path/to/downloads",
  "monitorInterval": 5000
}
```

## ⚙️ Performance Tuning

| Setting | Effect | Example |
|---------|--------|---------|
| `monitorInterval` | How often to check (ms) | 5000 = check every 5 sec |
| `maxConcurrentProcessing` | Files processed at once | 3 = process 3 in parallel |
| `extractImages` | Enable screenshot capture | true = extract 3 per video |
| `enrichMetadata` | Enable API enrichment | true = query TMDb/TVDb |

## 🐛 Quick Troubleshooting

**Monitor not running**
```bash
curl http://localhost:3001/api/downloads/status
# If not running, restart backend: npm run dev
```

**FFmpeg not found**
```bash
# Windows
choco install ffmpeg

# macOS
brew install ffmpeg

# Linux
sudo apt-get install ffmpeg
```

**No files detected**
```bash
# Check directory path exists
# Wait at least 5 seconds before checking
# Files must be in watched directory
```

**Screenshots not generating**
```bash
# File must be valid video format (mp4, mkv, avi, mov)
# File must have readable video stream
# Disk space required for thumbnails
```

## 📚 Documentation Map

```
Start here → DOWNLOAD_PIPELINE_QUICKSTART.md
              (5 minute setup & testing)
              ↓
Deep dive → DOWNLOAD_PIPELINE_GUIDE.md
             (Complete API reference)
             ↓
Architecture → DOWNLOAD_PIPELINE_ARCHITECTURE.md
               (System design & diagrams)
```

## 🎯 Real-World Example

```bash
# 1. User downloads Breaking Bad S01E05
→ File lands in ~/Downloads

# 2. Pipeline detects it (5 sec)
✓ Breaking.Bad.S01E05.1080p.mkv detected

# 3. Extractes metadata (1-2 sec)
✓ Parsed: Season 1, Episode 5
✓ Video: 1920x1080, HEVC, 45 min

# 4. Captures screenshots (10-20 sec)
✓ screenshot_1.jpg @ 15 min
✓ screenshot_2.jpg @ 30 min
✓ screenshot_3.jpg @ 45 min

# 5. Stores in library (1 sec)
✓ Added to StorageManager
✓ Searchable as "Breaking Bad S01E05"

# 6. Shows in Stremio/Kodi
✓ User can search for it
✓ Can play with metadata
✓ Screenshots shown in interface
```

## ✨ Key Features Summary

| Feature | Status |
|---------|--------|
| Real-time file detection | ✅ |
| Filename parsing (S##E##) | ✅ |
| Video metadata extraction | ✅ |
| Screenshot capture (3x) | ✅ |
| Content classification | ✅ |
| Storage integration | ✅ |
| REST API (12 endpoints) | ✅ |
| Event system | ✅ |
| Concurrent processing | ✅ |
| Error handling | ✅ |
| Production ready | ✅ |

## 🎉 What's Possible Now

✅ Monitor downloads automatically  
✅ Extract metadata without manual work  
✅ Get images for media browsing  
✅ Auto-organize in your library  
✅ Search by series/episode  
✅ Track download quality  
✅ Index local files in Stremio  
✅ Build complete media database  

## 📞 Need Help?

1. **Quick setup**: See DOWNLOAD_PIPELINE_QUICKSTART.md
2. **API details**: See DOWNLOAD_PIPELINE_GUIDE.md
3. **System design**: See DOWNLOAD_PIPELINE_ARCHITECTURE.md
4. **Overall summary**: See DOWNLOAD_PIPELINE_DELIVERY.md

---

**Status**: ✅ Production Ready  
**Version**: 1.0.0  
**Support**: See documentation files above
