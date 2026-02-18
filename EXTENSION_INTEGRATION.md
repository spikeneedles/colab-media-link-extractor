# Extension Integration Guide

## Overview

The Media Link Extractor now supports direct integration with browser extensions. Extensions can capture media streams and send them to the web application for processing with crawlers and patterns.

## Architecture

### Communication Flow

```
Browser Extension
       ↓
    Register Session
       ↓
   Capture Media URLs
       ↓
   Send to Web App
       ↓
Web App API Gateway
       ↓
Processing Engine
(Patterns + Crawlers)
```

## API Endpoints

### 1. Register Extension

**POST** `/api/extension/register`

Register a new extension instance and get a session ID.

**Request:**
```json
{
  "extensionId": "unique-extension-id",
  "name": "My Extension"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "webapp-1705600000000-abc123def456",
  "message": "Extension registered successfully"
}
```

### 2. Heartbeat (Keep-Alive)

**POST** `/api/extension/heartbeat`

Send periodic heartbeats to maintain session.

**Request:**
```json
{
  "sessionId": "webapp-1705600000000-abc123def456"
}
```

**Recommended:** Send every 10-30 seconds

### 3. Capture Media

**POST** `/api/extension/capture`

Transmit captured media URL to the web app.

**Request:**
```json
{
  "sessionId": "webapp-1705600000000-abc123def456",
  "url": "https://example.com/stream.m3u8",
  "title": "Live Channel - CNN",
  "metadata": {
    "quality": "1080p",
    "language": "en",
    "codec": "h264"
  }
}
```

**Response:**
```json
{
  "success": true,
  "mediaId": "webapp-1705600000000-abc123def456-1705600050000",
  "message": "Media captured"
}
```

### 4. Get Active Sessions

**GET** `/api/extension/sessions`

List all currently active extensions.

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "id": "session-id-1",
      "name": "Firefox Extension",
      "connectedAt": "2024-01-19T08:00:00Z",
      "lastHeartbeat": "2024-01-19T08:05:30Z",
      "capturedCount": 42,
      "isAlive": true
    }
  ],
  "totalActive": 1
}
```

### 5. Get Captured Media

**GET** `/api/extension/media/all`

Retrieve all captured media from all sessions.

**Query Parameters:**
- `limit`: Max results (default: 100, max: 500)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "media": [
    {
      "id": "media-id-1",
      "url": "https://example.com/stream.m3u8",
      "title": "Live Stream",
      "timestamp": "2024-01-19T08:05:30Z",
      "sessionId": "session-id-1",
      "sessionName": "Firefox Extension",
      "metadata": { ... }
    }
  ],
  "total": 256
}
```

### 6. Process Media with Crawlers

**POST** `/api/extension/process`

Queue captured media for processing with patterns and crawlers.

**Request:**
```json
{
  "sessionId": "webapp-1705600000000-abc123def456",
  "mediaId": "webapp-1705600000000-abc123def456-1705600050000",
  "patterns": ["hc-m3u-standard", "hc-xtream-standard"],
  "crawlerConfig": {
    "maxDepth": 2,
    "followRedirects": true
  }
}
```

### 7. Disconnect Session

**DELETE** `/api/extension/sessions/:sessionId`

Gracefully disconnect an extension.

## JavaScript Integration Example

### Basic Extension Script

```javascript
// extension-content.js or background.js

class MediaLinkCapturer {
  constructor(webAppUrl = 'http://localhost:5173') {
    this.webAppUrl = webAppUrl
    this.sessionId = null
    this.apiBase = `${webAppUrl}/api/extension`
  }

  async register(extensionName = 'My Extension') {
    try {
      const response = await fetch(`${this.apiBase}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extensionId: chrome.runtime.id,
          name: extensionName,
        }),
      })

      const data = await response.json()
      this.sessionId = data.sessionId
      console.log('Extension registered:', this.sessionId)

      // Start heartbeat
      this.startHeartbeat()

      return this.sessionId
    } catch (error) {
      console.error('Registration failed:', error)
    }
  }

  startHeartbeat() {
    setInterval(() => {
      fetch(`${this.apiBase}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId }),
      }).catch((err) => console.warn('Heartbeat error:', err))
    }, 15000)
  }

  async captureMedia(url, title, metadata = {}) {
    if (!this.sessionId) {
      console.error('Not registered')
      return
    }

    try {
      const response = await fetch(`${this.apiBase}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          url,
          title,
          metadata,
        }),
      })

      const data = await response.json()
      console.log('Media captured:', data.mediaId)
      return data.mediaId
    } catch (error) {
      console.error('Capture failed:', error)
    }
  }

  async processMedia(mediaId, patterns = [], crawlerConfig = {}) {
    try {
      const response = await fetch(`${this.apiBase}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          mediaId,
          patterns,
          crawlerConfig,
        }),
      })

      return await response.json()
    } catch (error) {
      console.error('Processing failed:', error)
    }
  }

  async disconnect() {
    fetch(`${this.apiBase}/sessions/${this.sessionId}`, {
      method: 'DELETE',
    }).catch((err) => console.warn('Disconnect error:', err))
  }
}

// Usage
const capturer = new MediaLinkCapturer()

// On extension load
chrome.runtime.onInstalled.addListener(() => {
  capturer.register('My Custom Extension')
})

// Capture when media is found
window.addEventListener('play', (e) => {
  const media = e.target
  if (media.src) {
    capturer.captureMedia(media.src, document.title)
  }
}, true)

// Listen for <video> source changes
document.addEventListener('DOMContentLoaded', () => {
  const videos = document.querySelectorAll('video')
  videos.forEach((video) => {
    const observer = new MutationObserver(() => {
      const sources = video.querySelectorAll('source')
      sources.forEach((source) => {
        if (source.src) {
          capturer.captureMedia(source.src, document.title, {
            type: source.type,
            element: 'video-source',
          })
        }
      })
    })

    observer.observe(video, { childList: true })
  })
})
```

## Integration Points

### 1. Video Element Interception

Capture URLs from `<video>` elements:

```javascript
// Intercept video source tags
document.querySelectorAll('video source').forEach((source) => {
  capturer.captureMedia(source.src, 'Video Title')
})
```

### 2. Network Interception

Capture from network requests:

```javascript
// In Chrome extension background script
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.url.includes('.m3u8') || details.url.includes('.ts')) {
      capturer.captureMedia(details.url, details.method)
    }
  },
  { urls: ['<all_urls>'] }
)
```

### 3. Player Injection

Hook into player APIs:

```javascript
// Example: Hooking into video.js player
if (window.videojs) {
  const player = videojs('my-player')
  const originalSrc = player.src

  player.src = function (source) {
    if (source && source.src) {
      capturer.captureMedia(source.src, source.type)
    }
    return originalSrc.call(this, source)
  }
}
```

### 4. Stream Simulation

Mock player interaction for testing:

```javascript
// Simulate media capture
async function simulateMediaCapture() {
  const testUrls = [
    'https://example.com/live.m3u8',
    'http://provider.tv/live/user/pass/123.ts',
    'https://cdn.example.com/video.mp4',
  ]

  for (const url of testUrls) {
    await capturer.captureMedia(url, `Test Media - ${Date.now()}`)
  }
}
```

## Manifest Configuration (Chrome Extension v3)

```json
{
  "manifest_version": 3,
  "name": "Media Link Extractor Integration",
  "version": "1.0.0",
  "permissions": [
    "webRequest",
    "tabs",
    "storage"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ]
}
```

## Web App Integration

### Import Components

```tsx
import { ExtensionManager } from '@/components/ExtensionManager'
import { useExtensionBridge } from '@/hooks/useExtensionBridge'

export function App() {
  return <ExtensionManager />
}
```

### Use Hook in Components

```tsx
function MyComponent() {
  const bridge = useExtensionBridge()

  useEffect(() => {
    bridge.registerExtension('My App')
  }, [])

  return (
    <div>
      <p>Connected: {bridge.isConnected ? '✓' : '✗'}</p>
      <p>Captured: {bridge.stats.totalCaptured}</p>
    </div>
  )
}
```

## Best Practices

### 1. Error Handling

Always handle network errors gracefully:

```javascript
try {
  await capturer.captureMedia(url, title)
} catch (error) {
  console.error('Capture failed:', error)
  // Retry logic or user notification
}
```

### 2. Rate Limiting

Don't send too many captures at once:

```javascript
const queue = []
const processQueue = async () => {
  while (queue.length > 0) {
    const item = queue.shift()
    await capturer.captureMedia(item.url, item.title)
    await new Promise((r) => setTimeout(r, 100)) // 100ms delay
  }
}
```

### 3. Metadata Enrichment

Include useful metadata:

```javascript
capturer.captureMedia(url, title, {
  source: 'video-element',
  quality: video.videoHeight + 'p',
  mimeType: source.type,
  timestamp: new Date().toISOString(),
  headers: {
    referer: document.referrer,
    userAgent: navigator.userAgent,
  },
})
```

### 4. Session Management

Properly handle disconnection:

```javascript
window.addEventListener('beforeunload', () => {
  capturer.disconnect()
})
```

## Testing

### Mock Capture

Use the mock player in the web app to test:

1. Open Extension Manager
2. Click "Launch Mock Media Player"
3. Enter test URL: `https://example.com/stream.m3u8`
4. Click "Capture & Send to Bridge"
5. Verify media appears in captured list

### API Testing

Test endpoints directly with curl:

```bash
# Register
curl -X POST http://localhost:5173/api/extension/register \
  -H "Content-Type: application/json" \
  -d '{"extensionId":"test-123","name":"Test"}'

# Capture
curl -X POST http://localhost:5173/api/extension/capture \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"xxx","url":"https://example.com/stream.m3u8","title":"Test"}'

# Get media
curl http://localhost:5173/api/extension/media/all
```

## Troubleshooting

### Extension Not Connecting

1. Check web app is running on correct port
2. Verify CORS is enabled
3. Check browser console for errors
4. Ensure API endpoints are accessible

### Media Not Captured

1. Verify extension has proper permissions
2. Check content script is injected
3. Verify video/media elements are accessible
4. Check network tab for actual URLs

### Performance Issues

1. Implement rate limiting
2. Batch captures together
3. Clean up old media regularly
4. Use pagination for large datasets

---

**Ready to build your extension?** Start with the Basic Extension Script above and customize for your needs!
