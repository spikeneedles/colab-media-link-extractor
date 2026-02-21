# Kodi Sync Endpoint - /api/kodi-sync

## Overview

The **Kodi Sync Endpoint** is the receiver interface for the Repository Auto-Scraper system. It accepts media URLs from Kodi extensions (Agent 1 - "The Bridge") and immediately queues Repository Auto-Scrape jobs (The Harvester).

**Base URL:** `http://localhost:3001/api/kodi-sync`

**Status Code:** 202 Accepted (jobs are queued asynchronously)

---

## API Endpoints

### 1. POST /api/kodi-sync/receive

**Purpose:** Receive a media URL from Kodi extension and queue an auto-scrape job

**Request:**
```http
POST /api/kodi-sync/receive HTTP/1.1
Content-Type: application/json

{
  "source_url": "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u",
  "kodi_session_id": "kodi-addon-abc123def456",
  "kodi_source": "My IPTV Addon",
  "media_type": "playlist",
  "metadata": {
    "title": "IPTV Channels - IPTV-Org",
    "category": "Live TV",
    "source_name": "IPTV-Org Public Repository"
  }
}
```

**Request Body Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source_url` | string (URL) | ✅ Yes | Media URL to scrape (must be valid HTTP/HTTPS URL) |
| `kodi_session_id` | string | ❌ No | Unique identifier for Kodi session (for tracking) |
| `kodi_source` | string | ❌ No | Name of Kodi addon/source sending the URL |
| `media_type` | string enum | ❌ No | Content type: `playlist`, `m3u`, `m3u8`, `xml`, `json`, `unknown` |
| `metadata` | object | ❌ No | Additional metadata about the media |
| `metadata.title` | string | ❌ No | Human-readable title |
| `metadata.category` | string | ❌ No | Content category (e.g., "Live TV", "Sports", "Movies") |
| `metadata.source_name` | string | ❌ No | Name of the source repository/provider |

**Response (202 Accepted):**
```json
{
  "success": true,
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "message": "Auto-scrape job queued successfully",
  "repository_detection": {
    "detected_type": "github",
    "repository_url": "https://github.com/iptv-org/iptv",
    "confidence": "high"
  },
  "tracking": {
    "status_endpoint": "/api/kodi-sync/status/550e8400-e29b-41d4-a716-446655440000",
    "results_endpoint": "/api/kodi-sync/results/550e8400-e29b-41d4-a716-446655440000"
  },
  "timestamp": "2026-02-19T10:30:00.000Z"
}
```

**Response Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Operation successful |
| `job_id` | string (UUID) | Unique job identifier for tracking |
| `status` | string | Current job status: `queued` | `detecting` | `scraping` | `completed` | `failed` |
| `message` | string | Human-readable status message |
| `repository_detection` | object | Detected repository information |
| `repository_detection.detected_type` | string | Repo type: `github` | `gitlab` | `bitbucket` | `gitea` | `codeberg` | `web` | `unknown` |
| `repository_detection.repository_url` | string | Detected repository URL |
| `repository_detection.confidence` | string | Detection confidence: `high` | `medium` | `low` |
| `tracking` | object | Endpoints for tracking job progress |
| `tracking.status_endpoint` | string | Relative URL to check job status |
| `tracking.results_endpoint` | string | Relative URL to fetch job results |
| `timestamp` | string (ISO 8601) | Job creation timestamp |

---

### 2. GET /api/kodi-sync/status/:jobId

**Purpose:** Get current status and progress of a queued/running job

**Request:**
```http
GET /api/kodi-sync/status/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
```

**Query Parameters:**
None

**Response (200 OK):**
```json
{
  "success": true,
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "scraping",
  "progress": 45,
  "repository_detection": {
    "type": "github",
    "url": "https://github.com/iptv-org/iptv",
    "confidence": "high"
  },
  "content_intelligence": {
    "media_type": "playlist",
    "category": "Live TV",
    "source_name": "IPTV-Org Public Repository",
    "is_verified": false
  },
  "timestamps": {
    "created_at": "2026-02-19T10:30:00.000Z",
    "updated_at": "2026-02-19T10:30:15.000Z"
  },
  "kodi_info": {
    "session_id": "kodi-addon-abc123def456",
    "source": "My IPTV Addon"
  },
  "results_summary": {
    "total_links_found": 250,
    "total_files_scanned": 45,
    "file_types_found": ["m3u8", "ts", "mp4", "xml", "json"]
  }
}
```

**Status Values:**
- `queued` - Job waiting to be processed
- `detecting` - Repository type detection in progress
- `scraping` - Repository auto-scraping in progress
- `completed` - Job finished successfully
- `failed` - Job failed (check error field)

---

### 3. GET /api/kodi-sync/results/:jobId

**Purpose:** Get full results of a completed job (multiple export formats)

**Request:**
```http
GET /api/kodi-sync/results/550e8400-e29b-41d4-a716-446655440000?format=json HTTP/1.1
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | `json` | Export format: `json` | `m3u` | `csv` |

**Response (200 OK) - JSON Format:**
```json
{
  "success": true,
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "repository": {
    "source_url": "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u",
    "detected_type": "github",
    "repository_url": "https://github.com/iptv-org/iptv",
    "confidence": "high"
  },
  "content_intelligence": {
    "media_type": "playlist",
    "category": "Live TV",
    "source_name": "IPTV-Org Public Repository",
    "is_verified": false
  },
  "results": {
    "total_links_found": 456,
    "total_files_scanned": 78,
    "media_breakdown": {
      "video_count": 350,
      "audio_count": 75,
      "playlist_count": 31
    },
    "file_types_found": ["m3u8", "ts", "mp4", "xml", "json"]
  },
  "metadata": {
    "kodi_session": "kodi-addon-abc123def456",
    "kodi_source": "My IPTV Addon",
    "created_at": "2026-02-19T10:30:00.000Z",
    "completed_at": "2026-02-19T10:35:45.000Z",
    "processing_time_ms": 345000
  }
}
```

**Response (202 Accepted) - Still Processing:**
```json
{
  "error": "Job still processing",
  "code": "JOB_IN_PROGRESS",
  "current_status": "scraping",
  "progress": 65
}
```

**Export Formats:**
- `json` - Structured JSON with full metadata
- `m3u` - M3U8 playlist format (downloadable file)
- `csv` - CSV spreadsheet (downloadable file)

---

### 4. GET /api/kodi-sync/session/:sessionId

**Purpose:** Get all jobs for a Kodi session

**Request:**
```http
GET /api/kodi-sync/session/kodi-addon-abc123def456 HTTP/1.1
```

**Response (200 OK):**
```json
{
  "success": true,
  "session_id": "kodi-addon-abc123def456",
  "jobs": [
    {
      "job_id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "completed",
      "progress": 100,
      "source_url": "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u",
      "repo_type": "github",
      "created_at": "2026-02-19T10:30:00.000Z",
      "updated_at": "2026-02-19T10:35:45.000Z"
    },
    {
      "job_id": "660f9511-f30c-52e5-b827-557766551111",
      "status": "scraping",
      "progress": 45,
      "source_url": "https://gitlab.com/free-iptv/list/-/raw/main/iptv.m3u",
      "repo_type": "gitlab",
      "created_at": "2026-02-19T10:40:00.000Z",
      "updated_at": "2026-02-19T10:42:30.000Z"
    }
  ],
  "total": 2,
  "summary": {
    "queued": 0,
    "detecting": 0,
    "scraping": 1,
    "completed": 1,
    "failed": 0
  }
}
```

---

### 5. POST /api/kodi-sync/batch

**Purpose:** Queue multiple URLs for batch processing

**Request:**
```json
POST /api/kodi-sync/batch HTTP/1.1
Content-Type: application/json

{
  "urls": [
    "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u",
    "https://gitlab.com/free-iptv/list/-/raw/main/iptv.m3u",
    "https://bitbucket.org/user/iptv/raw/main/channels.m3u8"
  ],
  "kodi_session_id": "kodi-addon-abc123def456",
  "kodi_source": "My IPTV Addon",
  "metadata": {
    "category": "Live TV",
    "media_type": "playlist"
  }
}
```

**Request Body Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `urls` | array[string] | ✅ Yes | Array of media URLs to process (1-100 URLs) |
| `kodi_session_id` | string | ❌ No | Session ID for tracking all jobs |
| `kodi_source` | string | ❌ No | Name of Kodi addon/source |
| `metadata` | object | ❌ No | Shared metadata for all URLs |

**Response (202 Accepted):**
```json
{
  "success": true,
  "batch_size": 3,
  "results": [
    {
      "source_url": "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u",
      "job_id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "queued",
      "repo_type": "github"
    },
    {
      "source_url": "https://gitlab.com/free-iptv/list/-/raw/main/iptv.m3u",
      "job_id": "660f9511-f30c-52e5-b827-557766551111",
      "status": "queued",
      "repo_type": "gitlab"
    },
    {
      "source_url": "https://bitbucket.org/user/iptv/raw/main/channels.m3u8",
      "job_id": "770g0622-g41d-63f6-c938-668877662222",
      "status": "queued",
      "repo_type": "bitbucket"
    }
  ],
  "session_id": "kodi-addon-abc123def456",
  "tracking": {
    "session_endpoint": "/api/kodi-sync/session/kodi-addon-abc123def456"
  }
}
```

---

### 6. DELETE /api/kodi-sync/jobs/:jobId

**Purpose:** Cancel a pending or running job

**Request:**
```http
DELETE /api/kodi-sync/jobs/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Job cancelled",
  "job_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (400 Bad Request) - Cannot Cancel Completed Job:**
```json
{
  "error": "Cannot cancel completed job",
  "code": "INVALID_JOB_STATE"
}
```

---

### 7. GET /api/kodi-sync/health

**Purpose:** Get sync service health and queue statistics

**Request:**
```http
GET /api/kodi-sync/health HTTP/1.1
```

**Response (200 OK):**
```json
{
  "success": true,
  "status": "operational",
  "queue_stats": {
    "total_jobs": 45,
    "queued": 5,
    "detecting": 2,
    "scraping": 8,
    "completed": 28,
    "failed": 2
  },
  "active_sessions": 12,
  "uptime_ms": 3600000,
  "timestamp": "2026-02-19T10:45:00.000Z"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "source_url is required",
  "code": "MISSING_URL"
}
```

### 404 Not Found
```json
{
  "error": "Job not found",
  "code": "JOB_NOT_FOUND",
  "job_id": "invalid-job-id"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to queue sync job",
  "message": "Database connection failed",
  "code": "JOB_QUEUE_ERROR"
}
```

---

## Data Models

### Job Object
```typescript
interface KodiSyncJob {
  job_id: string                    // UUID v4
  status: string                    // queued | detecting | scraping | completed | failed
  progress: number                  // 0-100
  source_url: string                // Original media URL
  repo_type: string                 // github | gitlab | bitbucket | gitea | codeberg | web | unknown
  repo_url?: string                 // Detected repository URL
  confidence_level: string          // high | medium | low
  created_at: Date                  // ISO 8601
  updated_at: Date                  // ISO 8601
  kodi_session_id?: string          // Kodi session identifier
  kodi_source?: string              // Kodi addon name
  content_intelligence_tags: {
    media_type?: string             // movie | tv-series | live-tv | vod | unknown
    category?: string               // Content category
    source_name?: string            // Repository/provider name
    is_verified?: boolean           // Link validation status
    last_validation?: Date          // Last validation timestamp
  }
  results?: {
    total_links_found?: number      // Count of extracted links
    total_files_scanned?: number    // Count of processed files
    media_breakdown?: {
      video_count?: number
      audio_count?: number
      playlist_count?: number
    }
    file_types_found?: string[]     // Extensions discovered
    error?: string                  // Error message if failed
  }
}
```

---

## Repository Type Detection

The endpoint automatically detects repository types based on URL patterns:

| URL Pattern | Detected Type | Confidence |
|------------|---------------|-----------|
| `github.com/user/repo` | `github` | High |
| `gitlab.com/user/repo` | `gitlab` | High |
| `bitbucket.org/user/repo` | `bitbucket` | High |
| `codeberg.org/user/repo` | `codeberg` | High |
| `*.gitea.io/user/repo` | `gitea` | Medium |
| `cdn.jsdelivr.net/gh/` | `web` | Medium |
| Any other domain | `web` | Low |

---

## Content Intelligence Tags

The system automatically tags extracted content with:

- **Media Type**: movie, tv-series, live-tv, vod, unknown
- **Category**: User-provided or inferred from metadata
- **Source Name**: Repository or addon name
- **Verification Status**: Whether links have been validated
- **Validation Timestamp**: Last time links were checked

---

## Workflow Example

### 1. Kodi Extension Sends URL
```bash
curl -X POST http://localhost:3001/api/kodi-sync/receive \
  -H "Content-Type: application/json" \
  -d '{
    "source_url": "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u",
    "kodi_session_id": "kodi-addon-xyz",
    "kodi_source": "My IPTV Addon",
    "metadata": {"category": "Live TV"}
  }'
```

### 2. Server Queues Job and Returns job_id
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued"
}
```

### 3. Poll Job Status
```bash
curl http://localhost:3001/api/kodi-sync/status/550e8400-e29b-41d4-a716-446655440000
```

### 4. Retrieve Results When Complete
```bash
curl "http://localhost:3001/api/kodi-sync/results/550e8400-e29b-41d4-a716-446655440000?format=json"
```

### 5. Export as M3U
```bash
curl "http://localhost:3001/api/kodi-sync/results/550e8400-e29b-41d4-a716-446655440000?format=m3u" \
  -o extracted-links.m3u
```

---

## Integration with Kodi Extension

**Expected Kodi Extension Behavior:**

1. When user selects "Sync with Scanner" in Kodi addon
2. Extract current playlist/source URL
3. POST to `/api/kodi-sync/receive` with session info
4. Receive `job_id` in response
5. Store `job_id` for tracking
6. Optionally poll `/api/kodi-sync/status/:jobId`
7. Fetch results with `/api/kodi-sync/results/:jobId`

---

## Rate Limiting

- **Global Limit**: 100 requests / 15 minutes per IP
- **Job Queue**: No specific limit (handles async)
- **Batch Max**: 100 URLs per batch request

---

## Security Considerations

✅ **URL Validation**: All URLs validated as valid HTTP(S) before queuing
✅ **Repository Detection**: Only public repositories detected
✅ **No Authentication Bypass**: Cannot access private repos without creds
✅ **Rate Limiting**: Prevents abuse with IP-based rate limiting
✅ **Sandboxed Processing**: Each job isolated and independent

---

## Support

For issues or questions about the Kodi Sync endpoint:
1. Check this documentation
2. Review response error codes
3. Check server logs for detailed errors
4. Submit issue with job_id for debugging
