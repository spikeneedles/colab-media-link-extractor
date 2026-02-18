# Media Link Scanner API

This is the backend API server for the Media Link Scanner. It provides REST endpoints for external applications to trigger scans and retrieve results.

## Getting Started

### Installation

The API server is included in the main project. Install dependencies:

```bash
npm install
```

### Running the Server

Start the API server:

```bash
npm run api:start
```

Or use ts-node directly:

```bash
npx ts-node src/api/server.ts
```

The server will start on port 3001 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=8080 npx ts-node src/api/server.ts
```

## API Endpoints

### Health Check

Check if the API server is running.

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "active_jobs": 3
}
```

---

### Create External Scan Job

Trigger a new scan job for a given source URL.

**Endpoint:** `POST /api/external-scan`

**Request Body:**
```json
{
  "source_url": "https://github.com/username/iptv-repo",
  "label": "My IPTV Repository",
  "media_type": "repository",
  "depth": 3,
  "auth": {
    "username": "user",
    "password": "pass"
  }
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source_url` | string | Yes | The URL to scan (repository, web page, or playlist URL) |
| `label` | string | No | A friendly label for this scan job |
| `media_type` | string | No | Type of source: `repository`, `web`, `file`, or `directory`. Auto-detected if not provided. |
| `depth` | number | No | Scan depth for repositories (default: 3) |
| `auth` | object | No | Authentication credentials for protected resources |
| `auth.username` | string | No | Basic auth username |
| `auth.password` | string | No | Basic auth password |
| `auth.apiKey` | string | No | API key (sent as X-API-Key header) |
| `auth.token` | string | No | Bearer token |

**Response:** `202 Accepted`
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "accepted",
  "message": "Scan job created for https://github.com/username/iptv-repo (My IPTV Repository)",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Error Response:** `400 Bad Request`
```json
{
  "status": "error",
  "message": "source_url is required",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### Get Job Status

Retrieve the status and results of a specific scan job.

**Endpoint:** `GET /api/jobs/:jobId`

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "started_at": "2024-01-15T10:30:00.000Z",
  "completed_at": "2024-01-15T10:32:30.000Z",
  "result": {
    "links": [
      "http://example.com/stream1.m3u8",
      "http://example.com/stream2.m3u8"
    ],
    "links_count": 2,
    "files_scanned": 15,
    "errors": []
  }
}
```

**Status Values:**
- `pending` - Job is queued
- `running` - Job is currently processing
- `completed` - Job finished successfully
- `failed` - Job encountered an error

**Error Response:** `404 Not Found`
```json
{
  "status": "error",
  "message": "Job 550e8400-e29b-41d4-a716-446655440000 not found",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### List All Jobs

Retrieve a list of all scan jobs.

**Endpoint:** `GET /api/jobs`

**Response:**
```json
{
  "jobs": [
    {
      "job_id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "completed",
      "progress": 100,
      "target_url": "https://github.com/username/iptv-repo",
      "target_type": "repository",
      "started_at": "2024-01-15T10:30:00.000Z",
      "completed_at": "2024-01-15T10:32:30.000Z",
      "links_count": 250
    }
  ],
  "total": 1,
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

---

### Delete Job

Remove a completed or failed job from the active jobs list.

**Endpoint:** `DELETE /api/jobs/:jobId`

**Response:**
```json
{
  "status": "success",
  "message": "Job 550e8400-e29b-41d4-a716-446655440000 deleted",
  "timestamp": "2024-01-15T10:40:00.000Z"
}
```

**Error Response:** `400 Bad Request` (if job is still running)
```json
{
  "status": "error",
  "message": "Cannot delete a running job",
  "timestamp": "2024-01-15T10:40:00.000Z"
}
```

---

## Usage Examples

### cURL Examples

**Create a scan job for a GitHub repository:**
```bash
curl -X POST http://localhost:3001/api/external-scan \
  -H "Content-Type: application/json" \
  -d '{
    "source_url": "https://github.com/iptv-org/iptv",
    "label": "IPTV.org Repository",
    "media_type": "repository",
    "depth": 2
  }'
```

**Create a scan job for a playlist with authentication:**
```bash
curl -X POST http://localhost:3001/api/external-scan \
  -H "Content-Type: application/json" \
  -d '{
    "source_url": "http://provider.tv/playlist.m3u8",
    "label": "IPTV Provider",
    "auth": {
      "username": "user123",
      "password": "pass456"
    }
  }'
```

**Check job status:**
```bash
curl http://localhost:3001/api/external-scan/jobs/550e8400-e29b-41d4-a716-446655440000
```

**List all jobs:**
```bash
curl http://localhost:3001/api/jobs
```

**Delete a job:**
```bash
curl -X DELETE http://localhost:3001/api/jobs/550e8400-e29b-41d4-a716-446655440000
```

---

### JavaScript/TypeScript Example

```typescript
// Create a scan job
const response = await fetch('http://localhost:3001/api/external-scan', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    source_url: 'https://github.com/iptv-org/iptv',
    label: 'IPTV.org Repository',
    media_type: 'repository',
    depth: 2
  })
})

const result = await response.json()
console.log('Job ID:', result.job_id)

// Poll for job completion
const jobId = result.job_id
let jobStatus = 'pending'

while (jobStatus === 'pending' || jobStatus === 'running') {
  await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
  
  const statusResponse = await fetch(`http://localhost:3001/api/jobs/${jobId}`)
  const statusData = await statusResponse.json()
  
  jobStatus = statusData.status
  console.log(`Job progress: ${statusData.progress}%`)
  
  if (jobStatus === 'completed') {
    console.log('Scan complete!')
    console.log('Links found:', statusData.result.links_count)
    console.log('Files scanned:', statusData.result.files_scanned)
  } else if (jobStatus === 'failed') {
    console.error('Job failed:', statusData.error)
  }
}
```

---

### Python Example

```python
import requests
import time

# Create a scan job
response = requests.post('http://localhost:3001/api/external-scan', json={
    'source_url': 'https://github.com/iptv-org/iptv',
    'label': 'IPTV.org Repository',
    'media_type': 'repository',
    'depth': 2
})

result = response.json()
job_id = result['job_id']
print(f"Job ID: {job_id}")

# Poll for job completion
while True:
    status_response = requests.get(f'http://localhost:3001/api/jobs/{job_id}')
    status_data = status_response.json()
    
    job_status = status_data['status']
    print(f"Job progress: {status_data['progress']}%")
    
    if job_status == 'completed':
        print("Scan complete!")
        print(f"Links found: {status_data['result']['links_count']}")
        print(f"Files scanned: {status_data['result']['files_scanned']}")
        break
    elif job_status == 'failed':
        print(f"Job failed: {status_data['error']}")
        break
    
    time.sleep(2)  # Wait 2 seconds before next poll
```

---

## Supported Source Types

### Repository Scanning
- GitHub repositories
- GitLab repositories
- Bitbucket repositories
- Codeberg repositories
- Other Git hosting platforms

The scanner will recursively scan the repository for:
- M3U/M3U8 playlists
- EPG XML files
- Kodi addon configurations
- Config files from packages
- Any files containing media links

### Web URL Scanning
- Direct playlist URLs (.m3u, .m3u8)
- Web pages containing media links
- IPTV provider pages

### Authentication Support
- Basic Authentication (username/password)
- API Key authentication (X-API-Key header)
- Bearer Token authentication

---

## Error Handling

All API endpoints follow a consistent error response format:

```json
{
  "status": "error",
  "message": "Description of the error",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Common HTTP status codes:
- `200 OK` - Request successful
- `202 Accepted` - Job created and queued
- `400 Bad Request` - Invalid request parameters
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Rate Limiting

Currently, there are no rate limits on the API. However, keep in mind:
- Repository scans can take several minutes for large repos
- Multiple concurrent scans will share system resources
- Consider implementing client-side throttling for production use

---

## Development

### Project Structure

```
src/
├── api/
│   └── server.ts          # Express API server
├── lib/
│   ├── crawler.ts         # Repository crawling logic
│   ├── linkExtractor.ts   # Link extraction and parsing
│   └── crawlerStorage.ts  # Job storage management
```

### Adding New Features

To add a new endpoint:

1. Define types in `server.ts`
2. Add route handler
3. Update this README with documentation

---

## Production Deployment

For production use, consider:

1. **Environment Variables:**
   - Set `PORT` for the desired port
   - Add API authentication tokens

2. **Process Management:**
   - Use PM2 or systemd for process management
   - Enable auto-restart on crashes

3. **Reverse Proxy:**
   - Place behind nginx or Apache
   - Enable HTTPS with SSL certificates

4. **Database:**
   - Currently uses in-memory storage
   - For persistence, add a database layer

5. **Rate Limiting:**
   - Add express-rate-limit middleware
   - Set appropriate limits per IP/user

---

## License

This API is part of the Media Link Scanner project.
