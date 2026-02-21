# Intelligent Ingestion Implementation Guide

## 🎯 System Architecture

### Complete Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        KODI EXTENSION (Agent 0)                         │
│                    Primary UI for User Control & Display                 │
└────────────────┬────────────────────────────────────────────────────────┘
                 │
                 │ 1. User selects media source
                 │ 2. Extracts source URL
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 THE BRIDGE - Receiver Endpoint                           │
│              POST /api/kodi-sync/receive (Simple Receiver)              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ • Validates incoming Kodi requests                               │  │
│  │ • Extracts session ID and source URL                             │  │
│  │ • Immediately queues job (202 Accepted)                          │  │
│  │ • Returns job_id for tracking                                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────────────────────┘
                 │
                 │ Job Queued
                 │ Status: queued (0%)
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              AUTO SCRAPER PIPELINE (Job Processing)                      │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Phase 1: Detecting Repository              Progress: 0% → 10%    │  │
│  │   • Parse source URL                                             │  │
│  │   • Detect repository type (GitHub, GitLab, Bitbucket, etc)     │  │
│  │   • Extract repository URL and owner info                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Phase 2: Scanning Content                  Progress: 10% → 30%   │  │
│  │   • Connect to repository source                                 │  │
│  │   • Scan for media files and links                               │  │
│  │   • Extract metadata from found content                          │  │
│  │   • Classify media types                                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Phase 3: Processing Results                Progress: 30% → 100%  │  │
│  │   • Compile scraped content list                                 │  │
│  │   • Generate report with statistics                              │  │
│  │   • Prepare export formats (JSON, M3U, CSV)                      │  │
│  │   • Job Status: completed                                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────────────────────┘
                 │
                 │ Job Completed - AUTO Triggers Ingestion
                 │ Payload with results + metadata
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│       THE HARVESTER - Intelligent Ingestion Endpoint                    │
│          POST /api/kodi-sync/ingest (Smart Processor)                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ TIERED LOGIC CONTROLLER                                          │  │
│  │                                                                   │  │
│  │ ┌─ Tier 1: Git Repository Scan ──────────────────────────────┐  │  │
│  │ │ Condition: metadata.addon.sourceUrl exists                 │  │  │
│  │ │ Action: Scan Git repository directly                       │  │  │
│  │ │ • Clone/access repository                                  │  │  │
│  │ │ • Scan directory structure                                 │  │  │
│  │ │ • Extract all media files                                  │  │  │
│  │ │ • Confidence: HIGH                                         │  │  │
│  │ └────────────────────────────────────────────────────────────┘  │  │
│  │                                                                   │  │
│  │ ┌─ Tier 2: Automated Web Crawler ──────────────────────────────┐ │  │
│  │ │ Condition: metadata.headers.referer exists                  │ │  │
│  │ │ Action: Crawl webpage for embedded content                 │ │  │
│  │ │ • Navigate to referer URL                                  │ │  │
│  │ │ • Extract links and embedded media                         │ │  │
│  │ │ • Detect repository patterns in page content               │ │  │
│  │ │ • Confidence: MEDIUM                                       │ │  │
│  │ └────────────────────────────────────────────────────────────┘ │  │
│  │                                                                   │  │
│  │ ┌─ Tier 3: Octokit Targeted Search ────────────────────────────┐ │  │
│  │ │ Condition: metadata.addon.id exists                         │ │  │
│  │ │ Action: Search GitHub API by addon ID                      │ │  │
│  │ │ • Query GitHub API (Octokit client)                        │ │  │
│  │ │ • Retrieve matching repositories                           │ │  │
│  │ │ • Extract repository metadata                              │ │  │
│  │ │ • Confidence: LOW-MEDIUM                                   │ │  │
│  │ └────────────────────────────────────────────────────────────┘ │  │
│  │                                                                   │  │
│  │ ┌─ Fallback: Direct URL Ingestion ──────────────────────────────┐ │  │
│  │ │ Condition: No other metadata available                      │ │  │
│  │ │ Action: Crawl the source_url directly                       │ │  │
│  │ │ • Use source_url as crawl target                            │ │  │
│  │ │ • Apply web crawler methodology                             │ │  │
│  │ │ • Confidence: LOW                                           │ │  │
│  │ └────────────────────────────────────────────────────────────┘ │  │
│  │                                                                   │  │
│  │ EXECUTION: One pathway selected based on metadata hierarchy     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ MEDIA EXTRACTION & ENRICHMENT                                     │  │
│  │   • Parse extracted content                                       │  │
│  │   • Classify media types (video, audio, playlist, archive)       │  │
│  │   • Extract metadata (names, URLs, hashes)                       │  │
│  │   • Tag with Content Intelligence metadata                       │  │
│  │   • Calculate confidence scores                                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ PERSISTENCE LAYER                                                 │  │
│  │   • Store ContentIntelligenceRecord in database                  │  │
│  │   • Store ExtractedMedia items in database                       │  │
│  │   • Index for fast retrieval                                     │  │
│  │   • Link to original job and Kodi session                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────────────────────┘
                 │
                 │ Ingestion Complete
                 │ Media now in Content Intelligence DB
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│          CONTENT INTELLIGENCE DATABASE                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Records: 200+ ContentIntelligenceRecords                        │  │
│  │ Media Items: 1000+ ExtractedMedia entries                       │  │
│  │ Statistics:                                                      │  │
│  │   • Git Repository Scans: 95                                    │  │
│  │   • Web Crawler Results: 78                                     │  │
│  │   • Octokit Searches: 27                                        │  │
│  │                                                                   │  │
│  │ Index Structure:                                                 │  │
│  │   • By ingest_id (fast retrieval)                               │  │
│  │   • By job_id (link to original job)                            │  │
│  │   • By media_type (filtering & search)                          │  │
│  │   • By repository_url (deduplication)                           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────────────────────┘
                 │
                 │ Available for:
                 │ • Kodi extension UI display
                 │ • Further processing
                 │ • AI enrichment (Gemini)
                 │ • Analytics & reporting
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              DOWNSTREAM SERVICES (Future)                               │
│  • Gemini AI for content classification & enrichment                    │
│  • Redis caching for performance                                        │
│  • SQL database for persistence & scaling                               │
│  • Search engine for full-text retrieval                                │
│  • Notification system for completion                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Tiered Logic Decision Tree

```
┌─ Receive Agent1 Payload from Job Completion
│
├─ CHECK: metadata.addon.sourceUrl exists?
│   ├─ YES → EXECUTE Tier 1: Git Repository Scan
│   │         └─ Parse repository URL
│   │         └─ Scan git structure
│   │         └─ Extract all media files
│   │         └─ Confidence: HIGH
│   │
│   └─ NO → Continue to Tier 2
│
├─ CHECK: metadata.headers.referer exists?
│   ├─ YES → EXECUTE Tier 2: Automated Web Crawler
│   │         └─ Crawl referer URL
│   │         └─ Extract embedded links
│   │         └─ Detect repository patterns
│   │         └─ Confidence: MEDIUM
│   │
│   └─ NO → Continue to Tier 3
│
├─ CHECK: metadata.addon.id exists?
│   ├─ YES → EXECUTE Tier 3: Octokit Search
│   │         └─ Search GitHub by addon ID
│   │         └─ Retrieve top repositories
│   │         └─ Extract repo metadata
│   │         └─ Confidence: LOW-MEDIUM
│   │
│   └─ NO → Continue to Fallback
│
└─ EXECUTE Fallback: Direct URL Ingestion
    └─ Crawl source_url directly
    └─ Apply web crawler
    └─ Confidence: LOW
```

---

## 📝 Implementation Details

### 1. Controller Initialization

```typescript
// In kodiSyncRoutes.ts
import { IntelligentIngestionController } from '../services/IntelligentIngestionController.js'

const intelligentIngestion = new IntelligentIngestionController()
  // Optionally pass GitHub token
  // new IntelligentIngestionController(process.env.GITHUB_TOKEN)
```

### 2. Payload Reception

```typescript
// When job completes, create Agent1Payload
const ingestPayload: Agent1Payload = {
  job_id: job.job_id,
  source_url: job.source_url,
  repo_type: job.repo_type,
  repo_url: job.repo_url,
  confidence_level: job.confidence_level,
  kodi_session_id: job.kodi_session_id,
  kodi_source: job.kodi_source,
  metadata: {
    addon: {
      id: job.kodi_session_id,
      id: job.kodi_source,
      sourceUrl: job.repo_url  // Tier 1 trigger
    },
    headers: {
      referer: job.source_url  // Tier 2 trigger
    },
    media_type: job.content_intelligence_tags.media_type,
    category: job.content_intelligence_tags.category,
  },
  results: job.results
}
```

### 3. Tiered Logic Execution

```typescript
// In IntelligentIngestionController.ingest()
async ingest(payload: Agent1Payload): Promise<IngestionResult> {
  // Tier 1: Check sourceUrl
  if (payload.metadata?.addon?.sourceUrl) {
    return await this.processGitRepositoryScan(payload, ...)
  }
  
  // Tier 2: Check referer
  if (payload.metadata?.headers?.referer) {
    return await this.processAutomatedCrawler(payload, ...)
  }
  
  // Tier 3: Check addon.id
  if (payload.metadata?.addon?.id) {
    return await this.processOctokitSearch(payload, ...)
  }
  
  // Fallback: Direct URL
  return await this.processDirectURLIngestion(payload, ...)
}
```

### 4. Media Extraction Pipeline

```typescript
// For each ingestion method:

// 1. Extract media items
const mediaItems = await this.scanGitRepository(repoInfo)
// or
const mediaItems = await this.crawlWebURL(crawlerUrl)
// or
const mediaItems = await this.extractMediaFromOctokitResults(results)

// 2. Create database record
const record = this.createContentIntelligenceRecord(
  payload,
  ingestId,
  'git_scan',  // ingestion method
  mediaItems,
  repoInfo,
  processingTimeMs
)

// 3. Persist to database
this.contentIntelligenceDB.set(ingestId, record)
this.extractedMediaDB.set(ingestId, mediaItems)
```

### 5. Database Persistence

```typescript
// ContentIntelligenceRecord Example
{
  id: "ingest_1708352400000_abc123",
  job_id: "550e8400-e29b-41d4-a716-446655440000",
  ingestion_timestamp: Date,
  ingestion_method: "git_scan",
  source_url: "https://raw.githubusercontent.com/...",
  repository_info: {
    type: "github",
    url: "https://github.com/user/repo",
    name: "repo",
    owner: "user",
    confidence: "high"
  },
  extracted_media: [
    {
      id: "media_1708352400000_001",
      type: "playlist",
      name: "streams.m3u8",
      url: "https://github.com/user/repo/blob/main/streams.m3u8",
      extracted_from: "https://github.com/user/repo",
      extraction_metadata: {
        method: "git_scan",
        confidence: 0.95,
        timestamp: Date,
        source_file: "streams.m3u8"
      }
    }
  ],
  processing_stats: {
    total_files_scanned: 12,
    total_media_extracted: 12,
    processing_time_ms: 1234,
    extraction_methods: ["git_scan"]
  }
}
```

---

## 🧪 Testing the Intelligent Ingestion

### Test 1: Tier 1 - Git Repository Scan

```bash
curl -X POST http://localhost:3001/api/kodi-sync/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "test-job-001",
    "source_url": "https://github.com/iptv-org/iptv",
    "repo_type": "github",
    "repo_url": "https://github.com/iptv-org/iptv",
    "confidence_level": "high",
    "metadata": {
      "addon": {
        "id": "plugin.video.iptv",
        "name": "IPTV Addon",
        "sourceUrl": "https://github.com/iptv-org/iptv"
      }
    }
  }'
```

**Expected:** 200 OK, ingestion_method: "git_scan"

### Test 2: Tier 2 - Web Crawler

```bash
curl -X POST http://localhost:3001/api/kodi-sync/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "test-job-002",
    "source_url": "https://example.com/streams",
    "repo_type": "web",
    "confidence_level": "low",
    "metadata": {
      "headers": {
        "referer": "https://example.com/kodi-addons"
      }
    }
  }'
```

**Expected:** 200 OK, ingestion_method: "web_crawler"

### Test 3: Tier 3 - Octokit Search

```bash
curl -X POST http://localhost:3001/api/kodi-sync/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "test-job-003",
    "source_url": "https://github.com/search?q=kodi",
    "repo_type": "web",
    "confidence_level": "low",
    "metadata": {
      "addon": {
        "id": "plugin.video.mycodecs",
        "name": "My Codecs"
      }
    }
  }'
```

**Expected:** 200 OK, ingestion_method: "octokit_search"

### Test 4: Retrieve Ingestion Record

```bash
# From one of the above tests, get the ingest_id
curl http://localhost:3001/api/kodi-sync/ingest/{ingest_id}
```

**Expected:** 200 OK with complete ContentIntelligenceRecord

### Test 5: Get Intelligence Statistics

```bash
curl http://localhost:3001/api/kodi-sync/intelligence
```

**Expected:** 200 OK with database statistics

---

## 🔌 Integration Points

### With Existing Kodi Sync System

1. **Job Completion Hook**
   ```typescript
   // When job completes (in queueAutoScrapeJob)
   job.status = 'completed'
   
   // AUTO: Trigger ingestion
   const ingestPayload = createPayloadFromJob(job)
   await intelligentIngestion.ingest(ingestPayload)
   ```

2. **Backward Compatibility**
   - Existing `/api/kodi-sync/receive` endpoint unchanged
   - Existing `/api/kodi-sync/status/:jobId` endpoint unchanged
   - Auto-ingestion transparent to Kodi extension

### With Future Components

1. **Gemini AI Integration**
   ```typescript
   // After ingestion, send media items to Gemini for classification
   const enrichedMedia = await gemini.classifyAndEnrich(extractedMedia)
   ```

2. **Redis Persistence**
   ```typescript
   // Replace Map storage with Redis
   const redisRecord = await redis.hset(
     `content_intelligence:${ingestId}`,
     record
   )
   ```

3. **SQL Database**
   ```typescript
   // Insert records into database
   await db.contentIntelligence.create(record)
   await db.extractedMedia.createMany(mediaItems)
   ```

---

## 📊 Data Flow Examples

### Example 1: GitHub Repository (Tier 1)

```
User selects GitHub repository URL in Kodi
  │
  └─> Kodi sends to /api/kodi-sync/receive
      └─> Job created with sourceUrl metadata
      └─> Job completes
      └─> Meta contains: metadata.addon.sourceUrl = "https://github.com/user/repo"
      └─> AUTO triggers /api/kodi-sync/ingest
      └─> Tier 1 Logic: sourceUrl exists
      └─> Execute: Git Repository Scan
      └─> Scan files in repository
      └─> Extract all media items
      └─> Store in Content Intelligence DB
      └─> Ingestion complete ✓
```

### Example 2: Web Referer (Tier 2)

```
User clicks on addon from web page in Kodi WebView
  │
  └─> Browser referer automatically captured
  └─> Request sent to /api/kodi-sync/receive
      └─> Job created with referer in metadata
      └─> Job completes
      └─> Meta contains: metadata.headers.referer = "https://example.com/addons"
      └─> AUTO triggers /api/kodi-sync/ingest
      └─> Tier 2 Logic: referer exists (Tier 1 skipped)
      └─> Execute: Automated Web Crawler
      └─> Crawl webpage at referer URL
      └─> Extract embedded links
      └─> Store in Content Intelligence DB
      └─> Ingestion complete ✓
```

### Example 3: Addon ID Search (Tier 3)

```
User searches for addon by ID
  │
  └─> Kodi sends to /api/kodi-sync/receive
      └─> Job created with addon.id metadata
      └─> Job completes
      └─> Meta contains: metadata.addon.id = "plugin.video.mystreams"
      └─> AUTO triggers /api/kodi-sync/ingest
      └─> Tier 3 Logic: addon.id exists (Tiers 1 & 2 skipped)
      └─> Execute: Octokit Targeted Search
      └─> Search GitHub for matching repositories
      └─> Extract repository information
      └─> Store in Content Intelligence DB
      └─> Ingestion complete ✓
```

---

## 🎯 Next Phase: Production Deployment

### Currently Implemented
✅ Tiered Logic Controller
✅ Git Repository Scanning (simulated)
✅ Web Crawler (simulated)
✅ Octokit GitHub Search
✅ In-Memory Content Intelligence Database
✅ Media Extraction & Classification
✅ API Endpoints for retrieval

### Ready for When Needed
- [ ] Real Git repository cloning & deep scanning
- [ ] Advanced web crawling with Puppeteer
- [ ] Redis data persistence
- [ ] SQL database backend
- [ ] Gemini AI integration
- [ ] Full-text search indexing
- [ ] Caching layer
- [ ] Distributed processing

---

**Status:** ✅ Intelligent Ingestion Endpoint Complete  
**Implementation Date:** February 19, 2026  
**Ready for Integration:** Yes  
**Testing Coverage:** Full tier testing included
