# Download Pipeline - Complete System Architecture

## 🏗️ System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          YOUR DOWNLOAD FOLDER                               │
│                    C:\Users\josht\Downloads\                                │
│                                                                              │
│  Breaking.Bad.S01E05.1080p.mkv                                             │
│  The.Office.S02E03.HDTV.mp4                                                │
│  Movie.Title.2024.1080p.BluRay.x264.mkv                                    │
│  Live.Stream.m3u8                                                           │
└──────────────────────────┬──────────────────────────────────────────────────┘
                           │
                           │ (5-second polls)
                           ▼
        ┌──────────────────────────────────────────────────┐
        │    DownloadMonitor Service (NEW)                │
        │  backend/src/services/DownloadMonitor.ts        │
        │                                                   │
        │  • Detects new/changed files                    │
        │  • Queues for processing                        │
        │  • Manages concurrent processing (max 3)        │
        │  • Emits events (fileDetected, fileProcessed)   │
        │  • Maintains metadata index                     │
        └──────────────────┬───────────────────────────────┘
                           │
        ┌──────────────────┴───────────────────────────┐
        │                                               │
        ▼                                               ▼
    ┌────────────────────┐               ┌────────────────────────────────┐
    │  MediaExtractor    │               │  MediaExtractor Service (NEW)  │
    │  (Parse Metadata)  │               │  Extract Images & Video Info   │
    │                    │               │                                │
    │ • S01E05 → 1,5    │               │ • FFprobe → Duration, codec   │
    │ • Year extraction │               │ • FFmpeg → Screenshots (3x)    │
    │ • Title parsing   │               │ • Video metadata → resolution │
    │ • Quality detect  │               │ • Path analysis                │
    │ • Confidence      │               │ • Content type detection       │
    │   scoring         │               │                                │
    └─────────┬──────────┘               └────────────┬───────────────────┘
              │                                       │
              └───────────────┬───────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────────────────┐
            │     Metadata Structure Built                │
            │                                             │
            │  DownloadMetadata {                        │
            │    id: "dl_1708796245_abc123"             │
            │    filename: "Breaking.Bad.S01E05..."     │
            │    filepath: "/Downloads/Breaking..."     │
            │    filesize: 2147483648                   │
            │    mediaTitle: "Breaking Bad"             │
            │    mediaType: "series"                    │
            │    season: 1                              │
            │    episode: 5                             │
            │    duration: 2700                         │
            │    resolution: "1920x1080"                │
            │    codec: "hevc"                          │
            │    processed: true                        │
            │    enriched: false                        │
            │    stored: false                          │
            │    confidence: "high"                     │
            │  }                                        │
            │                                             │
            │  Screenshots[] {                          │
            │    [0]: /thumbnails/.../screenshot_1.jpg │
            │    [1]: /thumbnails/.../screenshot_2.jpg │
            │    [2]: /thumbnails/.../screenshot_3.jpg │
            │  }                                        │
            └────────────┬──────────────────────────────┘
                         │
        ┌────────────────┴────────────────────┐
        │ (Optional Enrichment)                │
        ▼                                      ▼
    ┌──────────────────────────┐   ┌──────────────────────────┐
    │  API Enrichment         │   │  Screenshot Gallery      │
    │  (Future Integration)    │   │  Storage                 │
    │                          │   │                          │
    │  Query TMDb/TVDb:       │   │  .thumbnails/            │
    │  - Episode description  │   │  ├─ dl_123456/          │
    │  - Release date         │   │  │  ├─ screenshot_1.jpg│
    │  - Rating: 8.7/10       │   │  │  ├─ screenshot_2.jpg│
    │  - Poster image         │   │  │  └─ screenshot_3.jpg│
    │  - Genre tags           │   │  └─ dl_789012/          │
    └──────────────────────────┘   └──────────────────────────┘
                 │                           │
                 └───────────────┬───────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────────┐
                  │ StorageManager Integration (NEW) │
                  │ src/lib/storageManager.ts        │
                  │                                  │
                  │ addStoredItems([{                │
                  │   id: "dl_123456",              │
                  │   title: "Breaking Bad",         │
                  │   url: "file:///.../Breaking..." │
                  │   indexer: "download-monitor",   │
                  │   contentType: "series",         │
                  │   season: 1,                     │
                  │   episode: 5,                    │
                  │   size: 2147483648,              │
                  │   genres: ["Drama","Crime"],     │
                  │   confidence: "high",            │
                  │   processedAt: 1708796250456,    │
                  │   source: "local-download"       │
                  │ }])                              │
                  └─────────────┬────────────────────┘
                                │
                   ┌────────────┴────────────┐
                   │                         │
                   ▼                         ▼
        ┌─────────────────────┐   ┌──────────────────────┐
        │ Browser localStorage│   │ Backend Database     │
        │ (if using web UI)   │   │ (if using server)    │
        │                     │   │                      │
        │ indexer_processed_  │   │ MongoDB/SQLite:      │
        │ storage: [          │   │ downloads_metadata   │
        │   {...},            │   │ downloads_library    │
        │   {...}             │   │ media_enrichment     │
        │ ]                   │   │                      │
        └─────────────────────┘   └──────────────────────┘
                   │                         │
                   │                         │
                   └────────────┬────────────┘
                                │
                   ┌────────────────────────────┐
                   │  SEARCHABLE MEDIA LIBRARY  │
                   │                            │
                   │ "Breaking Bad"           │
                   │ ├─ S01E01                │
                   │ ├─ S01E02                │
                   │ ├─ S01E05 ← Your file!   │
                   │ └─ S01E06                │
                   │                         │
                   │ "The Office"             │
                   │ ├─ S02E01                │
                   │ ├─ S02E03 ← Your file!   │
                   │ └─ S02E04                │
                   │                         │
                   │ "Movie Title"            │
                   │ └─ [2024] ← Your file!   │
                   └────────────┬─────────────┘
                                │
                   ┌────────────────────────────┐
                   │  Stremio/Kodi Display      │
                   │  ┌──────────────────────┐ │
                   │  │ 🎬 Breaking Bad      │ │
                   │  │ Season 1, Episode 5  │ │
                   │  │                      │ │
                   │  │ [SCREENSHOT 1] [2] [3]│
                   │  │                      │ │
                   │  │ ⭐ 8.7 / 10          │ │
                   │  │ "Crazy Handful of..." │ │
                   │  │                      │ │
                   │  │ ▶ PLAY               │ │
                   │  └──────────────────────┘ │
                   └────────────────────────────┘
```

## 🔄 Data Flow Timeline

```
TIME: 00:00
├─ User puts video file in Downloads folder
└─ File: Breaking.Bad.S01E05.1080p.mkv (2.1 GB)

TIME: 00:05 (First check)
├─ DownloadMonitor detects new file
├─ Emits: fileDetected event
└─ Queued for processing

TIME: 00:06 (Processing starts)
├─ MediaExtractor begins analysis
├─ Parse filename:
│  └─ title="Breaking Bad", season=1, episode=5
├─ FFprobe video info:
│  └─ duration=2700s, resolution=1920x1080, codec=hevc
├─ Screenshot extraction (concurrent):
│  ├─ screenshot_1.jpg @ 27 min
│  ├─ screenshot_2.jpg @ 54 min
│  └─ screenshot_3.jpg @ 81 min
└─ Metadata ready: processed=true

TIME: 00:10 (Optional enrichment)
├─ Query APIs (if configured):
│  ├─ TMDb: Fetch poster
│  ├─ TVDb: Get episode title "Crazy Handful of Nothin"
│  └─ TVDb: Get episode description
└─ Enrich: enriched=true

TIME: 00:15 (Store in library)
├─ Call: POST /api/downloads/:id/store
├─ StorageManager adds to media library
├─ Indexing complete
└─ Emits: fileProcessed event

TIME: 00:20+ (Available in UI)
├─ Show up in Stremio/Kodi search
├─ Display with screenshots
├─ Show metadata overlay
└─ Ready to play!
```

## 🔌 REST API Endpoints

```
Frontend/App
    │
    ├─→ POST   /api/downloads/start
    │          └─ { downloadDir, monitorInterval }
    │
    ├─→ GET    /api/downloads/status
    │          └─ { running, stats }
    │
    ├─→ GET    /api/downloads/list
    │          └─ { total, processed, downloads[] }
    │
    ├─→ GET    /api/downloads/processed
    │          └─ { total, downloads[] }
    │
    ├─→ GET    /api/downloads/:id
    │          └─ { DownloadMetadata }
    │
    ├─→ POST   /api/downloads/extract-metadata
    │          └─ { filepath } → { metadata, query, contentType }
    │
    ├─→ POST   /api/downloads/:id/extract-screenshots
    │          └─ { count } → { screenshots[] }
    │
    ├─→ GET    /api/downloads/:id/screenshot/:index
    │          └─ [JPEG Image Data]
    │
    ├─→ POST   /api/downloads/:id/store
    │          └─ Stores in StorageManager
    │
    ├─→ POST   /api/downloads/stop
    │          └─ Stops monitoring
    │
    └─→ GET    /api/downloads/stats/summary
               └─ { stats, byType, totalSize, errors }
```

## 📊 Service Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                     Backend Services                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DownloadMonitor                                            │
│  ├─ Extends EventEmitter                                   │
│  ├─ Returns: DownloadMetadata[]                            │
│  └─ Calls: MediaExtractor.extractVideoMetadata()           │
│                                                             │
│  MediaExtractor                                             │
│  ├─ Uses: ffmpeg, ffprobe                                  │
│  ├─ Returns: ExtractedMediaInfo                            │
│  └─ Calls: extractSeasonEpisode(), detectContentType()     │
│                                                             │
│  downloadsRoutes (Express Router)                          │
│  ├─ Depends: DownloadMonitor instance                      │
│  ├─ Depends: MediaExtractor instance                       │
│  ├─ Calls: addStoredItems() from StorageManager            │
│  └─ Returns: JSON responses                                │
│                                                             │
│  StorageManager (Existing)                                 │
│  ├─ Called by: downloadsRoutes                             │
│  ├─ Stores: StoredMediaItem[]                              │
│  └─ Used by: Stremio/Kodi addons                           │
│                                                             │
│  mediaProcessingRoutes (Existing)                          │
│  ├─ Complements: Download pipeline                         │
│  ├─ Uses: MediaMetadataEnricher                            │
│  └─ Performs: Additional classification                    │
│                                                             │
│  apiProviderService (Existing)                             │
│  ├─ Future integration point                               │
│  ├─ Provides: TMDb, TVDb, Trakt APIs                       │
│  └─ Can enrich: DownloadMetadata                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 📈 Data Model Relationships

```
DownloadMetadata (from Monitor)
├─ Basic Info
│  ├─ id: string (unique identifier)
│  ├─ filename: string
│  ├─ filepath: string
│  └─ filesize: number
│
├─ Extracted Metadata (from MediaExtractor)
│  ├─ mediaTitle: string
│  ├─ mediaType: enum (movie|series|live-tv)
│  ├─ season: number?
│  ├─ episode: number?
│  ├─ duration: number (seconds)
│  ├─ resolution: string ("1920x1080")
│  └─ codec: string
│
├─ Images (from MediaExtractor)
│  ├─ poster?: string (URL)
│  ├─ thumbnail?: string (URL)
│  └─ screenshots?: string[] (file paths)
│
├─ Enrichment (from APIs)
│  ├─ description?: string
│  ├─ genres?: string[]
│  ├─ releaseYear?: number
│  ├─ rating?: number
│  ├─ imdbId?: string
│  ├─ tmdbId?: string
│  └─ tvdbId?: string
│
└─ Status Flags
   ├─ processed: boolean
   ├─ enriched: boolean
   ├─ stored: boolean
   └─ confidence: enum (high|medium|low)
        │
        └─→ Stored in StorageManager as:
            {
              id, title, url, contentType, season, 
              episode, genres, confidence, source
            }
```

## 🎯 Integration with Existing Pipeline

```
Your Application Architecture
─────────────────────────────

Frontend (Web/Stremio/Kodi)
    │
    ├─ mediaProcessingRoutes (existing)
    │  └─ For playlists & URL extraction
    │
    ├─ apiDiscoveryRoutes (existing)
    │  └─ For metadata & torrent search
    │
    └─ downloadsRoutes (NEW)
       └─ For local file monitoring

All converge to:

    StorageManager
    ├─ Stores media items
    ├─ Searchable index
    └─ Used by Addons


Addon Display (Search for media)
    └─ Shows movies, series, episodes
       (from downloads + other sources)
```

## 🚀 Deployment Architecture

```
Development Setup
─────────────────
Frontend: localhost:5173 (Vite dev server)
Backend:  localhost:3001 (Express)
Monitor:  /path/to/Downloads

Production Setup
────────────────
Frontend: Docker container (Nginx)
Backend:  Docker container (Node.js)
Monitor:  /mnt/downloads (volume-mounted)
Storage:  MongoDB (docker service)

docker-compose.yml
├─ frontend service
│  ├─ Port: 80
│  └─ Volume: dist/
│
├─ backend service (with monitor)
│  ├─ Port: 3001
│  ├─ Env: DOWNLOADS_DIR=/mnt/downloads
│  └─ Volume: /mnt/downloads (shared)
│
└─ mongodb service
   ├─ Port: 27017
   └─ Volume: data/
```

## 🔐 Security Architecture

```
Request Flow
────────────

External Request
    │
    ├─→ CORS Validation
    │   └─ Allow: localhost:5173, *.yourdomain.com
    │
    ├─→ Rate Limiting
    │   └─ 100 requests per 15 minutes
    │
    ├─→ Authentication Middleware
    │   ├─ Check API Key (if enabled)
    │   └─ Add auth context
    │
    ├─→ Route Handler
    │   ├─ Validate input
    │   ├─ Check file paths (no traversal)
    │   └─ Process request
    │
    ├─→ File Operations
    │   ├─ Only within configured dir
    │   ├─ No symlink following
    │   └─ Read permissions only
    │
    └─→ Response
        ├─ JSON with helmet headers
        ├─ Compression enabled
        └─ Rate limit headers
```

## 📊 Performance Characteristics

```
Optimizations
─────────────
• Max 3 concurrent file processing
  └─ Prevents CPU/disk thrashing
  
• 5-second monitor interval
  └─ Detects new files within 5-10 seconds
  
• Queued processing
  └─ Files processed in order
  
• Background events
  └─ Non-blocking frontend updates
  
• FFmpeg parallelization
  └─ Multiple screenshots extracted in parallel
  
• Indexed file map
  └─ Fast duplicate detection (O(1))

Expected Performance
──────────────────
• File detection: <5 seconds
• Metadata extraction: 1-2 seconds per file
• Screenshot extraction: 10-30 seconds per video
• API enrichment: 1-3 seconds per API call
• Total end-to-end: 15-60 seconds depending on size

Bottlenecks
──────────
• FFmpeg (I/O intensive)
  └─ Adjust maxConcurrent if CPU-bound
  
• Network (API calls)
  └─ Cache results, use batch endpoints
  
• Disk I/O (large files)
  └─ Consider SSD, tune monitor interval
```

---

**System Status**: ✅ Complete and Ready  
**Version**: 1.0.0  
**Components**: 3 new services + 1 API route file + 2 documentation files
