# API Authentication & Security Guide

## Overview

The Media Link Scanner API now supports optional API key authentication to secure media streaming endpoints. This feature allows you to control access to your media proxy server and prevent unauthorized usage.

## Features

✅ **API Key Authentication** - Secure endpoints with unique API keys  
✅ **Rate Limiting per API Key** - Prevent abuse with per-key request limits  
✅ **Flexible Configuration** - Enable/disable auth and customize protected endpoints  
✅ **Multiple Authentication Methods** - Header or query parameter based auth  
✅ **Admin Key Generation** - Securely generate new API keys programmatically  
✅ **Automatic Cleanup** - Expired rate limit data is cleaned up automatically  

## Quick Start

### 1. Enable Authentication

Edit your `.env` file:

```env
AUTH_ENABLED=true
```

### 2. Generate an API Key

Run the key generation script:

```bash
npm run generate-key
```

Or generate manually using Node.js crypto:

```bash
node -e "const crypto = require('crypto'); console.log('mls_' + crypto.randomBytes(32).toString('hex'))"
```

### 3. Add API Keys to Configuration

Add your generated keys to `.env`:

```env
API_KEYS=mls_abc123def456...,mls_xyz789ghi012...
```

Multiple keys should be comma-separated.

### 4. (Optional) Set Admin Key

If you want to generate keys programmatically via API:

```env
ADMIN_KEY=your_secure_admin_key_here
```

### 5. Restart the Server

```bash
npm run dev
# or
npm start
```

## Using the API with Authentication

### Method 1: Header Authentication (Recommended)

Include your API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: mls_your_api_key_here" \
  "http://localhost:3001/api/media/stream?url=http://example.com/video.mp4"
```

**JavaScript/Fetch Example:**

```javascript
const response = await fetch('http://localhost:3001/api/media/stream?url=...', {
  headers: {
    'X-API-Key': 'mls_your_api_key_here'
  }
});
```

### Method 2: Query Parameter Authentication

Include your API key as a query parameter:

```bash
curl "http://localhost:3001/api/media/stream?url=http://example.com/video.mp4&apiKey=mls_your_api_key_here"
```

**JavaScript Example:**

```javascript
const apiKey = 'mls_your_api_key_here';
const mediaUrl = 'http://example.com/video.mp4';
const streamUrl = `http://localhost:3001/api/media/stream?url=${encodeURIComponent(mediaUrl)}&apiKey=${apiKey}`;

// Use in video player
const video = document.querySelector('video');
video.src = streamUrl;
```

## Protected Endpoints

By default, all `/api/media/*` endpoints require authentication:

- `GET /api/media/stream` - Stream media files
- `GET /api/media/info` - Get media file information
- `POST /api/media/generate-m3u` - Generate M3U playlists

## Public Endpoints

These endpoints do not require authentication:

- `GET /api/health` - Server health and status
- `GET /api/auth/docs` - API authentication documentation
- `POST /api/headless-browse` - Headless browsing (can be protected via config)
- `POST /api/headless-execute` - JavaScript execution (can be protected via config)
- `POST /api/headless-screenshot` - Screenshot capture (can be protected via config)

## Rate Limiting

Each API key has independent rate limiting:

**Default Limits:**
- 1,000 requests per hour per API key
- Configurable via `API_KEY_RATE_LIMIT` and `API_KEY_RATE_WINDOW`

**Rate Limit Headers:**

The API returns rate limit information in response headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1704067200000
```

**Rate Limit Exceeded Response:**

```json
{
  "error": "Rate limit exceeded",
  "message": "API key has exceeded the rate limit of 1000 requests per hour",
  "resetTime": 1704067200000,
  "resetIn": 3456
}
```

## Error Responses

### 401 Unauthorized

API key not provided:

```json
{
  "error": "Authentication required",
  "message": "API key must be provided in X-API-Key header or apiKey query parameter",
  "docs": "/api/auth/docs"
}
```

### 403 Forbidden

Invalid or revoked API key:

```json
{
  "error": "Invalid API key",
  "message": "The provided API key is not valid or has been revoked"
}
```

### 429 Too Many Requests

Rate limit exceeded:

```json
{
  "error": "Rate limit exceeded",
  "message": "API key has exceeded the rate limit of 1000 requests per hour",
  "resetTime": 1704067200000,
  "resetIn": 3456
}
```

## Advanced Configuration

### Custom Protected Endpoints

Customize which endpoints require authentication in `.env`:

```env
AUTH_REQUIRED_ENDPOINTS=/api/media/*,/api/headless-*
```

Patterns support wildcards (`*`). Multiple patterns are comma-separated.

### Adjust Rate Limits

```env
# Max requests per window
API_KEY_RATE_LIMIT=1000

# Window duration in milliseconds (default: 1 hour)
API_KEY_RATE_WINDOW=3600000
```

### Disable Authentication

Set to `false` to disable (useful for development):

```env
AUTH_ENABLED=false
```

## Programmatic API Key Generation

Generate new API keys via API (requires admin key):

```bash
curl -X POST -H "X-Admin-Key: your_admin_key" \
  "http://localhost:3001/api/auth/generate-key"
```

**Response:**

```json
{
  "key": "mls_abc123def456...",
  "message": "API key generated successfully. Add this to your API_KEYS environment variable.",
  "warning": "Store this key securely. It will not be shown again."
}
```

## Security Best Practices

1. **Use HTTPS in Production** - Always use SSL/TLS to encrypt API keys in transit
2. **Rotate Keys Regularly** - Generate new keys periodically and revoke old ones
3. **Unique Keys per Client** - Issue separate keys for each application or user
4. **Monitor Usage** - Check logs for suspicious patterns or unauthorized access attempts
5. **Secure Storage** - Store API keys in environment variables, never in code
6. **Admin Key Protection** - Keep your admin key secret and never expose it publicly
7. **Rate Limiting** - Adjust limits based on your infrastructure capacity

## Integration Examples

### React/Frontend Example

```typescript
const API_BASE = 'http://localhost:3001';
const API_KEY = process.env.REACT_APP_API_KEY;

async function streamMedia(url: string) {
  const streamUrl = `${API_BASE}/api/media/stream?url=${encodeURIComponent(url)}`;
  
  const response = await fetch(streamUrl, {
    headers: {
      'X-API-Key': API_KEY
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return streamUrl;
}
```

### M3U Playlist Generation

```bash
curl -X POST -H "X-API-Key: mls_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "links": [
      {"url": "http://example.com/video1.mp4", "title": "Video 1"},
      {"url": "http://example.com/video2.mp4", "title": "Video 2"}
    ],
    "playlistName": "My Playlist"
  }' \
  "http://localhost:3001/api/media/generate-m3u"
```

### Android App Integration

```kotlin
class MediaApiClient(private val apiKey: String) {
    private val baseUrl = "http://your-server.com:3001"
    
    fun getStreamUrl(mediaUrl: String): String {
        return "$baseUrl/api/media/stream?url=${URLEncoder.encode(mediaUrl, "UTF-8")}&apiKey=$apiKey"
    }
    
    suspend fun getMediaInfo(mediaUrl: String): MediaInfo {
        val url = "$baseUrl/api/media/info?url=${URLEncoder.encode(mediaUrl, "UTF-8")}"
        val request = Request.Builder()
            .url(url)
            .header("X-API-Key", apiKey)
            .build()
        
        val response = client.newCall(request).execute()
        return gson.fromJson(response.body?.string(), MediaInfo::class.java)
    }
}
```

## Monitoring & Management

### Check Authentication Status

```bash
curl "http://localhost:3001/api/health"
```

Returns:

```json
{
  "status": "ok",
  "uptime": 123456,
  "auth": {
    "enabled": true,
    "keysConfigured": 3
  },
  ...
}
```

### View API Documentation

```bash
curl "http://localhost:3001/api/auth/docs"
```

Returns comprehensive API documentation with authentication details, examples, and error codes.

## Troubleshooting

### "Authentication required" Error

**Problem:** Missing API key in request

**Solution:** Add `X-API-Key` header or `apiKey` query parameter

### "Invalid API key" Error

**Problem:** API key is not in the `API_KEYS` environment variable

**Solution:** 
1. Verify key is added to `.env` file
2. Check for typos in the key
3. Restart the server after updating `.env`

### "Rate limit exceeded" Error

**Problem:** Too many requests from single API key

**Solution:**
1. Wait for rate limit window to reset (check `resetIn` seconds)
2. Increase `API_KEY_RATE_LIMIT` if legitimate high usage
3. Use multiple API keys to distribute load

### Authentication Not Working

**Problem:** `AUTH_ENABLED=true` but no authentication required

**Solution:**
1. Check logs on server startup for authentication status
2. Verify `AUTH_REQUIRED_ENDPOINTS` pattern matches your endpoint
3. Ensure `.env` file is loaded (check with `console.log(process.env.AUTH_ENABLED)`)

## FAQ

**Q: Can I use the same API key for multiple applications?**  
A: Yes, but it's recommended to use unique keys per application for better tracking and security.

**Q: How do I revoke an API key?**  
A: Remove it from the `API_KEYS` environment variable and restart the server.

**Q: Can I have unlimited rate limits for certain keys?**  
A: Not directly, but you can set a very high `API_KEY_RATE_LIMIT` value (e.g., 1000000).

**Q: Is authentication required in development mode?**  
A: Only if `AUTH_ENABLED=true`. Set to `false` for easier local development.

**Q: Can I use JWT tokens instead of API keys?**  
A: The current implementation uses static API keys. JWT support can be added as a future enhancement.

## Support

For issues, questions, or feature requests related to authentication:

1. Check this documentation
2. Review error messages in server logs
3. Test with `/api/auth/docs` endpoint
4. Open an issue on GitHub with details

## License

Same as main project license.
