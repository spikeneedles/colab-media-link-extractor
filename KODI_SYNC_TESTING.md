# Kodi Sync Endpoint - Quick Testing Guide

## 🧪 Test Environment Setup

### Prerequisites
```bash
# 1. Install dependencies
cd backend
npm install

# 2. Start the backend server
npm run dev
# or
npm start
```

The API will be available at: `http://localhost:3001/api/kodi-sync`

---

## ✅ Test Cases

### Test 1: Single URL Sync

**Scenario**: Kodi addon sends a single IPTV playlist URL

**Request**:
```bash
curl -X POST http://localhost:3001/api/kodi-sync/receive \
  -H "Content-Type: application/json" \
  -d '{
    "source_url": "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u",
    "kodi_session_id": "test-session-001",
    "kodi_source": "Test IPTV Addon",
    "media_type": "playlist",
    "metadata": {
      "title": "IPTV-Org Public Streams",
      "category": "Live TV",
      "source_name": "IPTV-Org Repository"
    }
  }'
```

**Expected Response** (202 Accepted):
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

**✅ Expected Behavior**:
- [ ] Returns 202 status code
- [ ] Includes valid UUID in job_id
- [ ] Detects GitHub repository correctly
- [ ] Confidence is "high"
- [ ] Provides tracking endpoints

---

### Test 2: Check Job Status

**Command**: Using the job_id from Test 1

```bash
curl http://localhost:3001/api/kodi-sync/status/550e8400-e29b-41d4-a716-446655440000
```

**Expected Response** (200 OK):
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
    "source_name": "IPTV-Org Repository",
    "is_verified": false
  },
  "timestamps": {
    "created_at": "2026-02-19T10:30:00.000Z",
    "updated_at": "2026-02-19T10:30:15.000Z"
  },
  "kodi_info": {
    "session_id": "test-session-001",
    "source": "Test IPTV Addon"
  },
  "results_summary": {
    "total_links_found": 250,
    "total_files_scanned": 45,
    "file_types_found": ["m3u8", "ts", "mp4", "xml", "json"]
  }
}
```

**✅ Expected Behavior**:
- [ ] Returns 200 OK
- [ ] Status transitions: queued → detecting → scraping → completed
- [ ] Progress increases from 0 to 100
- [ ] Results summary updates as job progresses

---

### Test 3: Get Results (JSON Format)

**Wait for job completion** (5+ seconds), then:

```bash
curl "http://localhost:3001/api/kodi-sync/results/550e8400-e29b-41d4-a716-446655440000?format=json"
```

**Expected Response** (200 OK):
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
    "source_name": "IPTV-Org Repository",
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
    "kodi_session": "test-session-001",
    "kodi_source": "Test IPTV Addon",
    "created_at": "2026-02-19T10:30:00.000Z",
    "completed_at": "2026-02-19T10:35:45.000Z",
    "processing_time_ms": 345000
  }
}
```

**✅ Expected Behavior**:
- [ ] Returns 200 OK when status is "completed"
- [ ] Returns 202 (still processing) if job not complete
- [ ] Includes detailed results breakdown
- [ ] Shows processing time in milliseconds

---

### Test 4: Export as M3U Playlist

```bash
curl "http://localhost:3001/api/kodi-sync/results/550e8400-e29b-41d4-a716-446655440000?format=m3u" \
  -o iptv-sync-results.m3u

# View the file
cat iptv-sync-results.m3u
```

**Expected Output**:
```m3u
#EXTM3U
#EXTINF:-1 group-title="Kodi Sync",Test IPTV Addon
https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u
```

**✅ Expected Behavior**:
- [ ] File downloaded as `iptv-sync-results.m3u`
- [ ] Content-Type header is `application/vnd.apple.mpegurl`
- [ ] M3U format is valid and playable

---

### Test 5: Export as CSV

```bash
curl "http://localhost:3001/api/kodi-sync/results/550e8400-e29b-41d4-a716-446655440000?format=csv" \
  -o iptv-sync-results.csv

# View the file
cat iptv-sync-results.csv
```

**Expected Output**:
```csv
job_id,status,source_url,repo_type,confidence,total_links_found,files_scanned,created_at
550e8400-e29b-41d4-a716-446655440000,completed,https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u,github,high,456,78,2026-02-19T10:30:00.000Z
```

**✅ Expected Behavior**:
- [ ] File downloaded as `iptv-sync-results.csv`
- [ ] Content-Type header is `text/csv`
- [ ] Proper CSV formatting with headers

---

### Test 6: Batch Processing

**Scenario**: Send multiple URLs at once

```bash
curl -X POST http://localhost:3001/api/kodi-sync/batch \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u",
      "https://gitlab.com/free-iptv/list/-/raw/main/iptv.m3u",
      "https://bitbucket.org/user/iptv/raw/main/channels.m3u8"
    ],
    "kodi_session_id": "batch-test-001",
    "kodi_source": "Batch Test Addon",
    "metadata": {
      "category": "Live TV"
    }
  }'
```

**Expected Response** (202 Accepted):
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
  "session_id": "batch-test-001",
  "tracking": {
    "session_endpoint": "/api/kodi-sync/session/batch-test-001"
  }
}
```

**✅ Expected Behavior**:
- [ ] Returns 202 Accepted
- [ ] Each URL gets its own job_id
- [ ] All URLs queued simultaneously
- [ ] Repository type correctly detected for each

---

### Test 7: Get Session Jobs

**Using the session_id from Test 6**:

```bash
curl http://localhost:3001/api/kodi-sync/session/batch-test-001
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "session_id": "batch-test-001",
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
      "progress": 65,
      "source_url": "https://gitlab.com/free-iptv/list/-/raw/main/iptv.m3u",
      "repo_type": "gitlab",
      "created_at": "2026-02-19T10:32:00.000Z",
      "updated_at": "2026-02-19T10:35:30.000Z"
    },
    {
      "job_id": "770g0622-g41d-63f6-c938-668877662222",
      "status": "queued",
      "progress": 0,
      "source_url": "https://bitbucket.org/user/iptv/raw/main/channels.m3u8",
      "repo_type": "bitbucket",
      "created_at": "2026-02-19T10:34:00.000Z",
      "updated_at": "2026-02-19T10:34:00.000Z"
    }
  ],
  "total": 3,
  "summary": {
    "queued": 1,
    "detecting": 0,
    "scraping": 1,
    "completed": 1,
    "failed": 0
  }
}
```

**✅ Expected Behavior**:
- [ ] Returns all jobs for session
- [ ] Shows status of each job
- [ ] Summary correctly counts job statuses
- [ ] Can track multiple jobs from single batch

---

### Test 8: Cancel Job

**Before job completes**:

```bash
# Start a new job
JOB_ID=$(curl -X POST http://localhost:3001/api/kodi-sync/receive \
  -H "Content-Type: application/json" \
  -d '{"source_url": "https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u"}' \
  | jq -r '.job_id')

# Cancel it quickly
curl -X DELETE http://localhost:3001/api/kodi-sync/jobs/$JOB_ID
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Job cancelled",
  "job_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**✅ Expected Behavior**:
- [ ] Returns 200 OK
- [ ] Job status changes to "failed"
- [ ] Cannot cancel already completed jobs (400 error)

---

### Test 9: Service Health Check

```bash
curl http://localhost:3001/api/kodi-sync/health
```

**Expected Response** (200 OK):
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

**✅ Expected Behavior**:
- [ ] Returns 200 OK
- [ ] Status is "operational"
- [ ] Shows accurate queue statistics
- [ ] Reflects all recent job activity

---

### Test 10: Error Cases

#### 10a: Missing source_url
```bash
curl -X POST http://localhost:3001/api/kodi-sync/receive \
  -H "Content-Type: application/json" \
  -d '{"kodi_session_id": "test"}'
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "source_url is required",
  "code": "MISSING_URL"
}
```

#### 10b: Invalid URL format
```bash
curl -X POST http://localhost:3001/api/kodi-sync/receive \
  -H "Content-Type: application/json" \
  -d '{"source_url": "not-a-valid-url"}'
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "Invalid URL format",
  "code": "INVALID_URL"
}
```

#### 10c: Job not found
```bash
curl http://localhost:3001/api/kodi-sync/status/invalid-job-id
```

**Expected Response** (404 Not Found):
```json
{
  "error": "Job not found",
  "code": "JOB_NOT_FOUND",
  "job_id": "invalid-job-id"
}
```

#### 10d: Cannot cancel completed job
```bash
curl -X DELETE http://localhost:3001/api/kodi-sync/jobs/completed-job-id
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "Cannot cancel completed job",
  "code": "INVALID_JOB_STATE"
}
```

---

## 🔍 Repository Detection Test Cases

| URL | Expected Type | Expected Confidence | Expected Repo URL |
|-----|---------------|-----------|-----------|
| `https://raw.githubusercontent.com/user/repo/main/file.m3u` | github | high | `https://github.com/user/repo` |
| `https://gitlab.com/user/repo/-/raw/main/file.m3u` | gitlab | high | `https://gitlab.com/user/repo` |
| `https://bitbucket.org/user/repo/raw/main/file.m3u` | bitbucket | high | `https://bitbucket.org/user/repo` |
| `https://codeberg.org/user/repo/raw/branch/file.m3u` | codeberg | high | `https://codeberg.org/user/repo` |
| `https://cdn.jsdelivr.net/gh/user/repo@main/file.m3u` | web | medium | jsDelivr |
| `https://example.com/iptv/playlist.m3u` | web | low | `https://example.com` |

---

## 📊 Performance Testing

### Load Test: Submit 100 URLs

```bash
#!/bin/bash
for i in {1..100}; do
  curl -X POST http://localhost:3001/api/kodi-sync/batch \
    -H "Content-Type: application/json" \
    -d "{
      \"urls\": [
        \"https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u\",
        \"https://gitlab.com/free-iptv/list/-/raw/main/iptv.m3u\"
      ],
      \"kodi_session_id\": \"load-test-$i\"
    }" &
done
wait
```

**✅ Expected Behavior**:
- [ ] All requests succeed with 202 status
- [ ] Response times < 500ms
- [ ] Health check shows correct job counts

---

## 🐛 Debugging Tips

### Enable Detailed Logging
```bash
# In backend code add:
console.log('[Kodi Sync]', 'Action', jobData)
```

### Monitor Job Lifecycle
```bash
# Poll status every second
for i in {1..10}; do
  curl http://localhost:3001/api/kodi-sync/status/$JOB_ID | jq '.progress,.status'
  sleep 1
done
```

### Watch Queue Statistics
```bash
# Monitor queue every 2 seconds
watch -n 2 'curl -s http://localhost:3001/api/kodi-sync/health | jq ".queue_stats"'
```

### Export Results for Analysis
```bash
# Get all results as JSON
curl "http://localhost:3001/api/kodi-sync/results/$JOB_ID?format=json" | jq . > results.json

# Get as CSV for spreadsheet analysis
curl "http://localhost:3001/api/kodi-sync/results/$JOB_ID?format=csv" > results.csv
```

---

## ✨ Test Summary Checklist

### Basic Functionality
- [ ] Single URL sync (Test 1)
- [ ] Job status tracking (Test 2)
- [ ] JSON results retrieval (Test 3)
- [ ] M3U export (Test 4)
- [ ] CSV export (Test 5)

### Advanced Features
- [ ] Batch processing (Test 6)
- [ ] Session management (Test 7)
- [ ] Job cancellation (Test 8)
- [ ] Health monitoring (Test 9)

### Error Handling
- [ ] Missing required fields (Test 10a)
- [ ] Invalid URL format (Test 10b)
- [ ] Non-existent job (Test 10c)
- [ ] Invalid state transitions (Test 10d)

### Repository Detection
- [ ] GitHub detection
- [ ] GitLab detection
- [ ] Bitbucket detection
- [ ] Codeberg detection
- [ ] CDN detection

### Performance
- [ ] Response time < 500ms
- [ ] Batch processing 100+ URLs
- [ ] Concurrent job handling
- [ ] Memory usage acceptable

---

**All tests passed = ✅ Endpoint ready for production**
