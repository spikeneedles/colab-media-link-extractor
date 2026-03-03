# Downloads Management System

The Nexus streaming handler now includes integrated disk saving and downloads management. Stream media **while simultaneously saving to disk** with automatic mega-list tracking.

---

## Features

✅ **Stream & Save** - Download files while streaming them to the client  
✅ **Mega List** - JSON file tracking all downloads with metadata  
✅ **Range Support** - Resume downloads and seek in videos  
✅ **Auto-Cleanup** - Delete individual downloads or clear all at once  
✅ **File Metadata** - Track title, size, content type, download time  
✅ **Direct Playback** - Re-download saved files from the downloads API  

---

## Usage

### Save a File During Streaming

Add `?save=true` to any media stream request to save to disk:

```bash
# Save magnet link to disk
GET /api/media/stream?url=magnet%3A...&title=MyMovie&save=true

# Save HTTP stream to disk
GET /api/media/stream?url=https%3A%2F%2Fexample.com%2Fvideo.mp4&save=true

# Save M3U8 manifest to disk
GET /api/media/stream?url=https%3A%2F%2F...%2Fstream.m3u8&save=true
```

**Response:** File is streamed to client AND saved to disk simultaneously.

---

## Downloads API Endpoints

### Get Mega List (All Downloads)

```bash
GET /api/media/downloads

Response:
{
  "downloads": [
    {
      "id": "1708876234567",
      "title": "Movie Title",
      "url": "https://stream.example.com/movie.mp4",
      "originalUrl": "magnet:?xt=urn:btih:...",
      "fileSize": 1073741824,
      "filePath": "/backend/downloads/movie-title.mp4",
      "contentType": "video/mp4",
      "downloadedAt": "2026-02-25T12:34:56.789Z",
      "exists": true,
      "actualSize": 1073741824
    }
    // ... more downloads
  ],
  "total": 42,
  "downloadPath": "/path/to/downloads",
  "storagePath": "/path/to/downloads/mega-list.json"
}
```

### Download a Saved File

```bash
GET /api/media/downloads/{id}

# With range request (for seeking in video players)
GET /api/media/downloads/{id}?Range=bytes=0-999999
```

Returns the file with proper headers for streaming/playback.

### Delete a Single Download

```bash
DELETE /api/media/downloads/{id}

Response:
{
  "message": "Download deleted successfully",
  "deletedEntry": { ... },
  "remaining": 41
}
```

### Clear All Downloads

```bash
POST /api/media/downloads/clear/all

Response:
{
  "message": "All downloads cleared",
  "deletedFiles": 42,
  "deletedEntries": 42
}
```

---

## Mega List File Structure

The mega list is stored as JSON at: `/backend/downloads/mega-list.json`

```json
[
  {
    "id": "1708876234567",
    "title": "Movie Title",
    "url": "https://stream.example.com/movie.mp4",
    "originalUrl": "magnet:?xt=urn:btih:...",
    "fileSize": 1073741824,
    "filePath": "/absolute/path/to/downloads/movie-title.mp4",
    "contentType": "video/mp4",
    "downloadedAt": "2026-02-25T12:34:56.789Z",
    "duration": "120 minutes",
    "thumbnail": null
  }
]
```

---

## File Organization

```
backend/
├── downloads/               # Downloads directory
│   ├── mega-list.json      # Master tracking file
│   ├── movie-title.mp4     # Downloaded file
│   ├── show-episode.mkv    # Downloaded file
│   └── music-track.mp3     # Downloaded file
├── dist/                   # Compiled JavaScript
├── src/                    # TypeScript source
└── ...
```

---

## Example Workflows

### Workflow 1: Stream + Save

```bash
# Request streams the file to browser AND saves to disk
curl "http://localhost:3002/api/media/stream?url=magnet%3A...&title=MyMovie&save=true"

# File is now available for direct download/replay
curl "http://localhost:3002/api/media/downloads" | jq '.downloads[0]'

# Download the saved file
curl "http://localhost:3002/api/media/downloads/1708876234567" -o myfile.mp4
```

### Workflow 2: Magnet → Stream → Save → Replay

1. **User sends magnet link with save flag**
   ```
   /api/media/stream?url=magnet:..&save=true
   ```

2. **Backend:**
   - Resolves magnet → HTTP via TorrentIO
   - Fetches from HTTP source
   - Pipes to client (streaming)
   - Saves to disk simultaneously
   - Adds entry to mega-list.json

3. **User can now:**
   - Stream from downloads: `/api/media/downloads/{id}`
   - List all downloads: `/api/media/downloads`
   - Delete specific file: `DELETE /api/media/downloads/{id}`
   - Clear all: `POST /api/media/downloads/clear/all`

### Workflow 3: Frontend Integration

Frontend can:

```javascript
// Check available downloads
const response = await fetch('/api/media/downloads');
const { downloads } = await response.json();

// Display mega list to user
downloads.forEach(file => {
  console.log(`${file.title} - ${file.fileSize} bytes - ${file.downloadedAt}`);
});

// Re-download saved file
const url = `/api/media/downloads/${file.id}`;
const a = document.createElement('a');
a.href = url;
a.download = file.title;
a.click();
```

---

## Important Notes

1. **Simultaneous Operations**
   - File is saved to disk AND streamed to client at same time
   - No buffering delay - client receives data immediately

2. **Disk Space**
   - Ensure sufficient disk space in `backend/downloads/`
   - Monitor downloads folder size regularly
   - Use `POST /api/media/downloads/clear/all` to free space

3. **File Names**
   - Automatically sanitized: spaces → dashes, lowercase
   - Format: `{title}.{extension}`
   - Extensions auto-detected from content type

4. **Mega List Persistence**
   - Automatically created on first download
   - Survives server restarts
   - Can be manually edited (not recommended)

5. **Range Request Support**
   - Supports HTTP range requests for seeking
   - Perfect for video players that need to skip/seek
   - Status code 206 for partial content

---

## File Types Supported

Automatic extension detection for:
- **Video**: MP4, MKV, AVI, WebM, TS
- **Audio**: MP3, M3U8
- **Images**: JPG, PNG
- **Manifests**: M3U8, M3U
- **Other**: Binary files with `.bin` extension

---

## Performance Considerations

1. **Stream is not written to disk twice**
   - Single read → written to both client and disk simultaneously
   - Uses Node.js streams for efficiency

2. **Downloads don't block streaming**
   - Asynchronous tracking
   - Client gets data with no delay

3. **Mega list stays lean**
   - JSON array, not a database
   - Fast lookups and parsing
   - Scales to thousands of entries

---

## Environment Variables

No new environment variables required - downloads go to:
```
{BACKEND_ROOT}/downloads/
```

To change location, modify `DOWNLOADS_DIR` in `nexusStream.ts`.

---

## Summary

You now have a **complete downloads management system**:
- ✅ Stream and save simultaneously
- ✅ Track all downloads in mega-list.json
- ✅ Query, download, and delete files
- ✅ Supports all media types and protocols
