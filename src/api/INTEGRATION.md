# API Integration Guide

This guide explains how to integrate the Media Link Scanner API into your application or automation workflow.

## Quick Start

### 1. Start the API Server

```bash
# From project root
cd src/api
npx ts-node start.ts
```

The server will start on `http://localhost:3001` by default.

### 2. Create Your First Scan

```bash
curl -X POST http://localhost:3001/api/external-scan \
  -H "Content-Type: application/json" \
  -d '{
    "source_url": "https://github.com/iptv-org/iptv",
    "label": "Test Scan"
  }'
```

### 3. Check the Status

```bash
# Replace JOB_ID with the ID from step 2
curl http://localhost:3001/api/jobs/JOB_ID
```

---

## Integration Patterns

### Pattern 1: Synchronous Scanning (Poll for Results)

Best for: CLI tools, scripts, simple integrations

```javascript
async function scanAndWait(sourceUrl) {
  // 1. Create scan job
  const response = await fetch('http://localhost:3001/api/external-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_url: sourceUrl })
  })
  
  const { job_id } = await response.json()
  
  // 2. Poll for completion
  while (true) {
    const status = await fetch(`http://localhost:3001/api/jobs/${job_id}`)
    const data = await status.json()
    
    if (data.status === 'completed') {
      return data.result
    }
    
    if (data.status === 'failed') {
      throw new Error(data.error)
    }
    
    await sleep(2000) // Wait 2 seconds
  }
}
```

### Pattern 2: Webhook Callback (Future Enhancement)

Best for: Web applications, microservices

*Note: This pattern is planned but not yet implemented*

```javascript
// Create scan with callback URL
const response = await fetch('http://localhost:3001/api/external-scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    source_url: 'https://github.com/user/repo',
    callback_url: 'https://your-app.com/webhook/scan-complete'
  })
})
```

### Pattern 3: Job Queue Integration

Best for: Background workers, batch processing

```javascript
// Add multiple scans to queue
const urls = [
  'https://github.com/repo1',
  'https://github.com/repo2',
  'https://github.com/repo3'
]

const jobs = await Promise.all(
  urls.map(url => 
    fetch('http://localhost:3001/api/external-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_url: url })
    }).then(r => r.json())
  )
)

// Monitor all jobs
const jobIds = jobs.map(j => j.job_id)
```

---

## Use Cases

### Use Case 1: Automated Repository Monitoring

Monitor GitHub repositories for new IPTV playlists daily:

```javascript
const REPOS_TO_MONITOR = [
  'https://github.com/iptv-org/iptv',
  'https://github.com/Free-TV/IPTV'
]

async function dailyScan() {
  for (const repo of REPOS_TO_MONITOR) {
    const response = await fetch('http://localhost:3001/api/external-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_url: repo,
        label: `Daily Scan ${new Date().toISOString()}`,
        media_type: 'repository'
      })
    })
    
    const { job_id } = await response.json()
    console.log(`Scan started for ${repo}: ${job_id}`)
  }
}

// Run daily at midnight
schedule.scheduleJob('0 0 * * *', dailyScan)
```

### Use Case 2: Playlist Validation Service

Build a service that validates IPTV playlists:

```javascript
app.post('/validate-playlist', async (req, res) => {
  const { playlistUrl, username, password } = req.body
  
  // Trigger scan
  const scanResponse = await fetch('http://localhost:3001/api/external-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_url: playlistUrl,
      auth: { username, password }
    })
  })
  
  const { job_id } = await scanResponse.json()
  
  // Return job ID to client
  res.json({
    status: 'processing',
    job_id,
    check_status_url: `/validate-playlist/${job_id}`
  })
})

app.get('/validate-playlist/:jobId', async (req, res) => {
  const status = await fetch(`http://localhost:3001/api/jobs/${req.params.jobId}`)
  const data = await status.json()
  
  res.json({
    status: data.status,
    links_found: data.result?.links_count,
    progress: data.progress
  })
})
```

### Use Case 3: Link Aggregation Pipeline

Aggregate links from multiple sources:

```javascript
async function aggregateLinks(sources) {
  // Start all scans
  const jobs = await Promise.all(
    sources.map(source =>
      fetch('http://localhost:3001/api/external-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source)
      }).then(r => r.json())
    )
  )
  
  // Wait for all to complete
  const results = await Promise.all(
    jobs.map(job => waitForCompletion(job.job_id))
  )
  
  // Aggregate all links
  const allLinks = results.flatMap(r => r.result.links)
  
  // Remove duplicates
  const uniqueLinks = [...new Set(allLinks)]
  
  return uniqueLinks
}

// Usage
const sources = [
  { source_url: 'https://github.com/repo1', media_type: 'repository' },
  { source_url: 'http://provider.tv/playlist.m3u8', auth: {...} },
  { source_url: 'https://example.com/media-page' }
]

const links = await aggregateLinks(sources)
console.log(`Aggregated ${links.length} unique links`)
```

---

## Advanced Features

### Custom Progress Tracking

```javascript
async function scanWithProgress(sourceUrl, onProgress) {
  const response = await fetch('http://localhost:3001/api/external-scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_url: sourceUrl })
  })
  
  const { job_id } = await response.json()
  
  while (true) {
    const status = await fetch(`http://localhost:3001/api/jobs/${job_id}`)
    const data = await status.json()
    
    onProgress({
      progress: data.progress,
      status: data.status,
      links_found: data.result?.links_count || 0
    })
    
    if (data.status === 'completed' || data.status === 'failed') {
      return data
    }
    
    await sleep(1000)
  }
}

// Usage
await scanWithProgress('https://github.com/repo', (progress) => {
  console.log(`${progress.progress}% - ${progress.links_found} links found`)
})
```

### Error Handling Best Practices

```javascript
async function robustScan(sourceUrl, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('http://localhost:3001/api/external-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_url: sourceUrl }),
        timeout: 30000 // 30 second timeout
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message)
      }
      
      const { job_id } = await response.json()
      return await waitForCompletion(job_id)
      
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message)
      
      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`)
      }
      
      // Exponential backoff
      await sleep(Math.pow(2, attempt) * 1000)
    }
  }
}
```

---

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose API port
EXPOSE 3001

# Start API server
CMD ["node", "dist/api/start.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  media-scanner-api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    restart: unless-stopped
    volumes:
      - ./data:/app/data
```

---

## Security Considerations

### 1. API Authentication (Recommended for Production)

Add authentication middleware:

```javascript
// Add to server.ts
const API_KEY = process.env.API_KEY

app.use('/api', (req, res, next) => {
  const apiKey = req.headers['x-api-key']
  
  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  next()
})
```

### 2. Rate Limiting

```javascript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})

app.use('/api', limiter)
```

### 3. Input Validation

```javascript
app.post('/api/external-scan', (req, res) => {
  const { source_url } = req.body
  
  // Validate URL format
  try {
    new URL(source_url)
  } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }
  
  // Whitelist allowed domains (optional)
  const allowedDomains = ['github.com', 'gitlab.com', 'bitbucket.org']
  const url = new URL(source_url)
  
  if (!allowedDomains.includes(url.hostname)) {
    return res.status(400).json({ error: 'Domain not allowed' })
  }
  
  // Continue with scan...
})
```

---

## Troubleshooting

### Problem: API not responding

**Check if server is running:**
```bash
curl http://localhost:3001/api/health
```

**Check logs for errors:**
```bash
# If running with ts-node
npx ts-node src/api/start.ts

# Look for error messages in console
```

### Problem: Job stuck in "pending" status

**Possible causes:**
1. Server overloaded with jobs
2. Network issues accessing source URL
3. Rate limiting from source server

**Solution:**
- Check server logs for errors
- Verify source URL is accessible
- Reduce concurrent scans

### Problem: Authentication failing

**Verify credentials:**
```bash
curl -X POST http://localhost:3001/api/external-scan \
  -H "Content-Type: application/json" \
  -d '{
    "source_url": "http://provider.tv/playlist.m3u8",
    "auth": {
      "username": "test",
      "password": "test"
    }
  }' -v
```

Check response for authentication errors.

---

## Performance Tips

1. **Batch small scans:** Group multiple small scans into one if possible
2. **Cache results:** Store job results in your database to avoid re-scanning
3. **Set appropriate depth:** Lower depth = faster scans for repositories
4. **Clean up old jobs:** Delete completed jobs regularly to free memory

---

## Support

For issues or questions:
1. Check the API documentation in `/src/api/README.md`
2. Review example client code in `/src/api/example-client.ts`
3. Check the main project documentation

---

## License

Part of the Media Link Scanner project.
