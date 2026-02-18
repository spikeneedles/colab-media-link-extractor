# Backend API Implementation Guide

## Overview

The browser extension sends POST requests to `/api/external-scan` with information about links to scan. Your backend needs to handle these requests, queue the scan jobs, and return a job ID for tracking.

## API Endpoint Specification

### Endpoint: `POST /api/external-scan`

### Request Headers

```
Content-Type: application/json
Authorization: Bearer <api-key>  (optional, if authentication enabled)
X-API-Key: <api-key>             (optional, if authentication enabled)
```

### Request Body

```json
{
  "source_url": "https://example.com/playlist.m3u8",
  "label": "Link from Example Page",
  "media_type": "playlist",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Fields:**
- `source_url` (string, required): The URL to scan for media links
- `label` (string, optional): A human-readable label describing where the link came from
- `media_type` (string, optional): Detected type of media (video, audio, playlist, repository, etc.)
- `timestamp` (string, optional): ISO 8601 timestamp when the request was created

### Response

**Success (200 OK):**
```json
{
  "job_id": "01HQS7X9JTQW5X9JTQW5X9JTQW",
  "message": "Scan job submitted successfully",
  "status": "pending"
}
```

**Error (400 Bad Request):**
```json
{
  "error": "source_url is required"
}
```

**Error (401 Unauthorized):**
```json
{
  "error": "Invalid or missing API key"
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Failed to queue scan job: <error details>"
}
```

## Implementation Examples

### Express.js (Node.js)

```javascript
import express from 'express';
import cors from 'cors';
import { ulid } from 'ulid';

const app = express();

// CORS configuration - IMPORTANT for extension support
app.use(cors({
  origin: function(origin, callback) {
    // Allow extension origins
    if (!origin || 
        origin.startsWith('chrome-extension://') || 
        origin.startsWith('moz-extension://') ||
        origin === 'http://localhost:5173') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Optional: API key authentication middleware
function authenticateAPIKey(req, res, next) {
  const apiKey = req.headers.authorization?.replace('Bearer ', '') || 
                 req.headers['x-api-key'];
  
  const validKey = process.env.API_KEY; // Store in environment variable
  
  // Skip auth if no key is configured
  if (!validKey) {
    return next();
  }
  
  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  
  next();
}

// Health check endpoint (optional but recommended)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
});

// Main external scan endpoint
app.post('/api/external-scan', authenticateAPIKey, async (req, res) => {
  try {
    const { source_url, label, media_type, timestamp } = req.body;
    
    // Validate input
    if (!source_url) {
      return res.status(400).json({ 
        error: 'source_url is required' 
      });
    }
    
    // Validate URL format
    try {
      new URL(source_url);
    } catch {
      return res.status(400).json({ 
        error: 'source_url must be a valid URL' 
      });
    }
    
    // Generate unique job ID
    const jobId = ulid();
    
    // Queue the scan job (integrate with your existing crawler logic)
    await queueScanJob({
      jobId,
      sourceUrl: source_url,
      label: label || 'External scan',
      mediaType: media_type || 'unknown',
      timestamp: timestamp || new Date().toISOString(),
      source: 'browser-extension'
    });
    
    // Log for debugging
    console.log(`Queued scan job ${jobId} for ${source_url}`);
    
    // Return success response
    res.status(200).json({
      job_id: jobId,
      message: 'Scan job submitted successfully',
      status: 'pending'
    });
    
  } catch (error) {
    console.error('Error processing external scan:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
});

// Example queue function - integrate with your crawler
async function queueScanJob(job) {
  // Option 1: Add to in-memory queue
  jobQueue.push(job);
  
  // Option 2: Add to Redis queue
  // await redisClient.lpush('scan-jobs', JSON.stringify(job));
  
  // Option 3: Add to database
  // await db.jobs.insert(job);
  
  // Option 4: Trigger your existing crawler directly
  // await startCrawler(job);
}

const PORT = process.env.PORT || 5173;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Integration with Existing Crawler

If you already have crawler logic in your app, integrate it like this:

```javascript
import { scanWebUrls } from './lib/crawler'; // Your existing crawler

async function queueScanJob(job) {
  const { jobId, sourceUrl, label, mediaType } = job;
  
  // Determine scan method based on media type
  let scanFunction;
  
  switch (mediaType) {
    case 'repository':
      scanFunction = scanRepositoryUrls;
      break;
    case 'playlist':
      scanFunction = scanPlaylistUrls;
      break;
    case 'android-package':
      scanFunction = scanAPKUrl;
      break;
    default:
      scanFunction = scanWebUrls;
  }
  
  // Run scan asynchronously (don't block the response)
  scanFunction([sourceUrl], (current, total) => {
    // Update job progress in database
    updateJobProgress(jobId, current, total);
  })
    .then(results => {
      // Store results in database
      storeJobResults(jobId, results);
      
      // Update job status
      updateJobStatus(jobId, 'completed');
      
      console.log(`Job ${jobId} completed with ${results.length} results`);
    })
    .catch(error => {
      console.error(`Job ${jobId} failed:`, error);
      updateJobStatus(jobId, 'failed', error.message);
    });
}
```

### Vite Dev Server Integration

Since your app uses Vite, you can add the API to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import express from 'express';

export default defineConfig({
  // ... your existing config
  
  server: {
    // Setup proxy or middleware
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  
  // Or use a plugin to add Express middleware
  plugins: [
    // ... your existing plugins
    {
      name: 'api-server',
      configureServer(server) {
        server.middlewares.use('/api', express.json());
        
        server.middlewares.use('/api/external-scan', (req, res) => {
          if (req.method === 'POST') {
            // Handle the POST request
            // ... (implementation from above)
          }
        });
      }
    }
  ]
});
```

## Job Storage

You'll need to store job information for tracking. Options:

### Option 1: In-Memory (Simple, Development)

```javascript
const jobs = new Map();

function storeJob(jobId, jobData) {
  jobs.set(jobId, {
    ...jobData,
    status: 'pending',
    createdAt: new Date(),
    results: null
  });
}

function updateJobStatus(jobId, status, error = null) {
  const job = jobs.get(jobId);
  if (job) {
    job.status = status;
    job.error = error;
    job.updatedAt = new Date();
  }
}

function getJob(jobId) {
  return jobs.get(jobId);
}
```

### Option 2: Database (Recommended, Production)

```javascript
// Example with MongoDB
const jobsCollection = db.collection('scan_jobs');

async function storeJob(jobId, jobData) {
  await jobsCollection.insertOne({
    _id: jobId,
    ...jobData,
    status: 'pending',
    createdAt: new Date(),
    results: null
  });
}

async function updateJobStatus(jobId, status, error = null) {
  await jobsCollection.updateOne(
    { _id: jobId },
    { 
      $set: { 
        status, 
        error, 
        updatedAt: new Date() 
      } 
    }
  );
}

async function getJob(jobId) {
  return await jobsCollection.findOne({ _id: jobId });
}
```

### Option 3: File System (Simple, Persistent)

```javascript
import fs from 'fs/promises';
import path from 'path';

const JOBS_DIR = './data/jobs';

async function storeJob(jobId, jobData) {
  const jobFile = path.join(JOBS_DIR, `${jobId}.json`);
  await fs.mkdir(JOBS_DIR, { recursive: true });
  await fs.writeFile(jobFile, JSON.stringify({
    ...jobData,
    status: 'pending',
    createdAt: new Date().toISOString()
  }, null, 2));
}

async function getJob(jobId) {
  try {
    const jobFile = path.join(JOBS_DIR, `${jobId}.json`);
    const data = await fs.readFile(jobFile, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}
```

## Job Status Endpoint (Optional)

Allow checking job status:

```javascript
app.get('/api/external-scan/:jobId', authenticateAPIKey, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ 
        error: 'Job not found' 
      });
    }
    
    res.json({
      job_id: job.jobId,
      status: job.status,
      created_at: job.createdAt,
      updated_at: job.updatedAt,
      results: job.results,
      error: job.error
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: error.message 
    });
  }
});
```

## CORS Configuration Details

**Critical**: Extensions have special origins (`chrome-extension://` or `moz-extension://`) that must be explicitly allowed.

### Express CORS Configuration

```javascript
import cors from 'cors';

app.use(cors({
  origin: function(origin, callback) {
    // Extension origins
    if (!origin || 
        origin.startsWith('chrome-extension://') || 
        origin.startsWith('moz-extension://')) {
      return callback(null, true);
    }
    
    // Your web app origin
    if (origin === 'http://localhost:5173' || 
        origin === 'https://yourdomain.com') {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));
```

### Manual CORS Headers

```javascript
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (origin && (
    origin.startsWith('chrome-extension://') || 
    origin.startsWith('moz-extension://') ||
    origin === 'http://localhost:5173'
  )) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});
```

## Testing the API

### Using curl

```bash
# Test POST request
curl -X POST http://localhost:5173/api/external-scan \
  -H "Content-Type: application/json" \
  -d '{
    "source_url": "https://example.com/playlist.m3u8",
    "label": "Test scan",
    "media_type": "playlist"
  }'

# With API key
curl -X POST http://localhost:5173/api/external-scan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{
    "source_url": "https://example.com/playlist.m3u8",
    "label": "Test scan",
    "media_type": "playlist"
  }'

# Test health endpoint
curl http://localhost:5173/api/health
```

### Using JavaScript

```javascript
async function testAPI() {
  const response = await fetch('http://localhost:5173/api/external-scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-api-key'
    },
    body: JSON.stringify({
      source_url: 'https://example.com/test.m3u8',
      label: 'Test from JS',
      media_type: 'playlist'
    })
  });
  
  const data = await response.json();
  console.log('Response:', data);
}
```

## Security Considerations

1. **Validate URLs**: Prevent SSRF attacks by validating URLs
2. **Rate Limiting**: Limit requests per IP/API key
3. **API Keys**: Store securely, never in code
4. **Input Sanitization**: Sanitize all user inputs
5. **Error Messages**: Don't expose sensitive info in errors

## Next Steps

1. Implement the endpoint in your backend
2. Test with curl or Postman
3. Configure the extension with your endpoint URL
4. Test the integration end-to-end
5. Add job status tracking if needed
6. Implement authentication if required

## Support

If you need help integrating this with your specific backend framework, check the examples or open an issue.
