# Media Streaming API Documentation

## Overview

The Media Streaming API provides endpoints for proxying and streaming media content to Android media players and other IPTV/streaming applications. It supports range requests, automatic content type detection, and M3U playlist generation with proxy URLs.

## Base URL

```
http://localhost:3001/api/media
```

## Endpoints

### 1. Stream Media

**Endpoint:** `GET /api/media/stream`

Streams media content with full support for range requests (HTTP 206 Partial Content), making it compatible with Android media players, VLC, Kodi, and other streaming applications.

**Query Parameters:**
- `url` (required): The source media URL to stream
- `title` (optional): Display title for the media file
- `type` (optional): Force content type (e.g., `video/mp4`, `audio/mpeg`)

**Headers:**
- Supports `Range` header for seeking and partial content delivery
- Returns `Content-Range`, `Accept-Ranges`, and `Content-Length` headers
- Sets appropriate CORS headers for browser playback

**Example Request:**
```bash
curl -i "http://localhost:3001/api/media/stream?url=http://example.com/video.mp4&title=My%20Video"
```

**Example with Range Request:**
```bash
curl -H "Range: bytes=0-1023" "http://localhost:3001/api/media/stream?url=http://example.com/video.mp4"
```

**Response Headers:**
```
HTTP/1.1 206 Partial Content
Content-Type: video/mp4
Accept-Ranges: bytes
Content-Range: bytes 0-1023/102400
Content-Length: 1024
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=3600
```

**Use Cases:**
- Stream IPTV channels to Android TV apps
- Play media in VLC with seeking support
- Proxy restricted media sources
- Add CORS headers for browser-based players

---

### 2. Get Media Information

**Endpoint:** `GET /api/media/info`

Retrieves metadata about a media URL without downloading the content. Useful for validation and pre-flight checks.

**Query Parameters:**
- `url` (required): The media URL to inspect

**Example Request:**
```bash
curl "http://localhost:3001/api/media/info?url=http://example.com/video.mp4"
```

**Example Response:**
```json
{
  "contentType": "video/mp4",
  "contentLength": 102400000,
  "acceptRanges": true,
  "lastModified": "Wed, 21 Oct 2024 07:28:00 GMT",
  "etag": "\"5f8c6a5b-61a0000\"",
  "status": 200,
  "available": true
}
```

**Response Fields:**
- `contentType`: MIME type of the media
- `contentLength`: Size in bytes (null if unknown)
- `acceptRanges`: Whether the server supports range requests
- `lastModified`: Last modification date
- `etag`: Entity tag for caching
- `status`: HTTP status code
- `available`: Boolean indicating if media is accessible

---

### 3. Generate M3U Playlist with Proxy URLs

**Endpoint:** `POST /api/media/generate-m3u`

Generates an M3U playlist file with all URLs proxied through the streaming endpoint. Perfect for creating Android TV-compatible playlists from restricted sources.

**Request Body:**
```json
{
  "links": [
    {
      "url": "http://example.com/video1.mp4",
      "title": "Action Movie",
      "category": "Movies",
      "tvgLogo": "http://example.com/logo1.png",
      "tvgId": "movie1",
      "duration": -1
    },
    {
      "url": "http://example.com/channel2.m3u8",
      "title": "Live Sports",
      "category": "Sports",
      "tvgLogo": "http://example.com/logo2.png",
      "tvgId": "sports1",
      "duration": -1
    }
  ],
  "playlistName": "My Android TV Playlist",
  "playlistDescription": "Proxied media for Android TV"
}
```

**Link Object Fields:**
- `url` (required): Source media URL
- `title` (optional): Display name for the media
- `category` (optional): Group category (for filtering in players)
- `tvgLogo` (optional): Logo image URL
- `tvgId` (optional): Unique identifier for EPG matching
- `duration` (optional): Duration in seconds (-1 for live streams)

**Example Request:**
```bash
curl -X POST http://localhost:3001/api/media/generate-m3u \
  -H "Content-Type: application/json" \
  -d '{
    "links": [
      {
        "url": "http://example.com/video.mp4",
        "title": "My Video",
        "category": "Movies"
      }
    ],
    "playlistName": "Android TV Playlist"
  }'
```

**Example Response:**
```
#EXTM3U
#PLAYLIST:Android TV Playlist
#EXTINF:-1 group-title="Movies" My Video
http://localhost:3001/api/media/stream?url=http%3A%2F%2Fexample.com%2Fvideo.mp4
```

**Response Headers:**
```
Content-Type: application/vnd.apple.mpegurl
Content-Disposition: attachment; filename="Android TV Playlist.m3u"
```

---

## Integration Examples

### Android ExoPlayer (Kotlin)

```kotlin
import com.google.android.exoplayer2.ExoPlayer
import com.google.android.exoplayer2.MediaItem
import com.google.android.exoplayer2.source.hls.HlsMediaSource
import com.google.android.exoplayer2.upstream.DefaultHttpDataSource

val proxyUrl = "http://your-server:3001/api/media/stream?url=" + 
    URLEncoder.encode(originalUrl, "UTF-8")

val player = ExoPlayer.Builder(context).build()
val mediaItem = MediaItem.fromUri(proxyUrl)
player.setMediaItem(mediaItem)
player.prepare()
player.play()
```

### VLC Android

```kotlin
import org.videolan.libvlc.LibVLC
import org.videolan.libvlc.Media
import org.videolan.libvlc.MediaPlayer

val libVLC = LibVLC(context)
val mediaPlayer = MediaPlayer(libVLC)

val proxyUrl = "http://your-server:3001/api/media/stream?url=" + 
    URLEncoder.encode(originalUrl, "UTF-8")

val media = Media(libVLC, Uri.parse(proxyUrl))
mediaPlayer.media = media
mediaPlayer.play()
```

### React Native Video

```javascript
import Video from 'react-native-video';

const proxyUrl = `http://your-server:3001/api/media/stream?url=${encodeURIComponent(originalUrl)}`;

<Video
  source={{ uri: proxyUrl }}
  style={{ width: '100%', height: 300 }}
  controls={true}
  resizeMode="contain"
/>
```

### HTML5 Video Player

```html
<video width="640" height="360" controls>
  <source 
    src="http://your-server:3001/api/media/stream?url=http%3A%2F%2Fexample.com%2Fvideo.mp4" 
    type="video/mp4"
  >
</video>
```

---

## Features

### ✅ Range Request Support
Full HTTP 206 Partial Content support for seeking in videos and resuming downloads.

### ✅ CORS Enabled
All endpoints include CORS headers, allowing browser-based players to access the streams.

### ✅ Android Optimized
User-Agent headers and content negotiation optimized for Android media frameworks.

### ✅ Auto Content-Type Detection
Automatically detects and forwards the correct MIME type from the source server.

### ✅ Caching Headers
Includes `Cache-Control` headers to reduce bandwidth usage and improve performance.

### ✅ M3U Playlist Generation
Generate complete M3U playlists with all URLs proxied through the streaming endpoint.

### ✅ Error Handling
Graceful error handling with appropriate HTTP status codes and error messages.

---

## Rate Limiting

The API is protected by rate limiting:
- **Window:** 15 minutes
- **Max Requests:** 100 per IP address
- **Scope:** All `/api/*` endpoints

---

## Security Considerations

1. **URL Validation:** All URLs are validated before proxying
2. **Timeout Protection:** 30-second timeout on all external requests
3. **Stream Error Handling:** Automatic cleanup on stream errors
4. **Rate Limiting:** Prevents abuse and DoS attacks
5. **CORS Configuration:** Can be restricted to specific origins via environment variables

---

## Environment Configuration

Add these to your `.env` file:

```env
PORT=3001
CORS_ORIGIN=http://localhost:5173,https://your-domain.com
MAX_CONCURRENT_BROWSERS=5
CACHE_ENABLED=true
CACHE_TTL=3600
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "URL parameter is required"
}
```

### 404 Not Found
```json
{
  "error": "Failed to fetch media: Request failed with status code 404",
  "status": 404
}
```

### 500 Internal Server Error
```json
{
  "error": "Stream error"
}
```

---

## Performance Tips

1. **Enable Caching:** Set `CACHE_ENABLED=true` for better performance
2. **Use Range Requests:** Always implement range request support in your player
3. **CDN Integration:** Put the proxy behind a CDN for global distribution
4. **Connection Pooling:** The server uses HTTP keep-alive for better performance
5. **Compression:** Response compression is enabled automatically for metadata endpoints

---

## Troubleshooting

### Player Can't Seek in Video
- Ensure the source server supports range requests
- Check that `Accept-Ranges: bytes` header is present
- Verify the player sends `Range` headers

### CORS Errors in Browser
- Add your domain to `CORS_ORIGIN` environment variable
- Check browser console for specific CORS error messages

### Stream Buffering Issues
- Increase `CACHE_TTL` for better performance
- Check network bandwidth between server and source
- Consider using a CDN

### Rate Limit Errors
- Reduce request frequency
- Implement client-side caching
- Consider increasing rate limit in production

---

## Use Cases

1. **Android TV App Development**
   - Stream IPTV channels through your app
   - Add CORS and authentication to restricted sources
   - Generate dynamic playlists

2. **IPTV Service Proxy**
   - Proxy multiple IPTV providers through one endpoint
   - Add analytics and usage tracking
   - Implement custom authentication

3. **Media Library Web App**
   - Stream personal media collection from cloud storage
   - Add browser-based playback to restricted sources
   - Create shareable playlists

4. **Kodi/Plex Plugin**
   - Proxy sources that don't support direct playback
   - Add range request support to sources that lack it
   - Convert between streaming protocols

---

## Testing

Test the stream endpoint with curl:

```bash
# Test basic streaming
curl -i "http://localhost:3001/api/media/stream?url=https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"

# Test range requests
curl -H "Range: bytes=0-1000" "http://localhost:3001/api/media/stream?url=https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"

# Test media info
curl "http://localhost:3001/api/media/info?url=https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"

# Test playlist generation
curl -X POST http://localhost:3001/api/media/generate-m3u \
  -H "Content-Type: application/json" \
  -d '{
    "links": [{"url": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", "title": "Test Stream"}],
    "playlistName": "Test Playlist"
  }'
```

---

## License

This API is part of the Media Link Scanner project and follows the same license terms.
