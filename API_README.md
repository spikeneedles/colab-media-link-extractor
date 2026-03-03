# Media Link Scanner - AI-Powered IPTV & Kodi Scanner

An advanced media link extraction and validation tool with AI assistance, crawler capabilities, and REST API.

## 🚀 Features

### Core Scanning
- **File Scanning**: Scan M3U, M3U8, PLS, XSPF, and 50+ formats
- **Archive Support**: ZIP, RAR, 7Z, TAR, BZ2 with recursive extraction
- **Android Packages**: APK, AAB, XAPK, APKS, APKM, APEX, APKX scanning
- **Repository Scanning**: GitHub, GitLab, Bitbucket, Codeberg support
- **Web Scanning**: Extract links from web pages and playlists
- **Kodi Support**: Scan .xsp, .nfo, .strm, addon.xml, and Python plugins
- **EPG Parsing**: Electronic Program Guide XML with channel extraction

### Advanced Features
- **URL Validation**: Test links with parallel validation and speed control
- **Content Classification**: Auto-detect movies, TV series, and live TV
- **AI Assistant**: Gemini 2.5 Flash integration for finding sources
- **Media Player**: Built-in player with queue management
- **Crawler/Scraper**: Automated namespace navigation and link collection
- **Xtream Codes**: Direct API integration for IPTV providers
- **Batch Operations**: Archive scanning and Kodi addon downloads
- **Config Analysis**: Extract and analyze config files from packages

### 🆕 REST API (New!)
- **External Integration**: Trigger scans programmatically
- **Job Management**: Create, monitor, and retrieve scan results
- **Authentication Support**: Basic Auth, API Keys, Bearer Tokens
- **Async Processing**: Non-blocking job queue with progress tracking

## 📡 API Server

### Quick Start

```bash
# Start the API server
cd src/api
npx ts-node start.ts
```

The API server runs on `http://localhost:3001` by default.

### API Endpoints

#### Create Scan Job
```bash
POST /api/external-scan
```

**Request:**
```json
{
  "source_url": "https://github.com/iptv-org/iptv",
  "label": "IPTV Repository Scan",
  "media_type": "repository",
  "depth": 3,
  "auth": {
    "username": "user",
    "password": "pass"
  }
}
```

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "accepted",
  "message": "Scan job created",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Check Job Status
```bash
GET /api/jobs/:jobId
```

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "progress": 100,
  "result": {
    "links": ["http://example.com/stream.m3u8"],
    "links_count": 250,
    "files_scanned": 45,
    "errors": []
  }
}
```

#### Other Endpoints
- `GET /api/health` - Health check
- `GET /api/jobs` - List all jobs
- `DELETE /api/jobs/:jobId` - Delete a job

### Full API Documentation

See detailed documentation:
- **[API README](src/api/README.md)** - Complete API reference
- **[Integration Guide](src/api/INTEGRATION.md)** - Integration patterns and examples
- **[Example Client](src/api/example-client.ts)** - TypeScript client implementation

## � Nexus Media Streaming API (NEW!)

### Advanced Unified Streaming Endpoint

The **Nexus streaming handler** provides intelligent, protocol-agnostic media streaming with automatic resolution of:
- **Magnet links** → HTTP streams via TorrentIO
- **Prowlarr redirects** → Full redirect chain resolution
- **HLS manifests** → Transparent URL rewriting
- **Local files** → file:// protocol support

### GET /api/media/stream

Unified endpoint for streaming any media type with automatic protocol conversion.

**Query Parameters:**
```
url    (string, required) - Media URL: magnet:, http://, https://, file://
title  (string, optional) - Media title for Content-Disposition header
type   (string, optional) - Explicit MIME type override
```

**Examples:**
```bash
# Magnet link resolution (auto- converts to HTTP via TorrentIO)
GET /api/media/stream?url=magnet:?xt=urn:btih:...&title=MovieName

# HTTP streaming with title
GET /api/media/stream?url=https://example.com/video.mp4&title=MyVideo

# HLS manifest (auto-proxies segments through backend)
GET /api/media/stream?url=https://example.com/playlist.m3u8

# Local file streaming  
GET /api/media/stream?url=file:///C:/Videos/movie.mp4

# Prowlarr redirect handling (auto-follows redirects, resolves magnet links)
GET /api/media/stream?url=http://prowlarr.local:9696/download/123
```

**Features:**
- ✅ Universal resolver loop (handles 3-level redirect chains)
- ✅ M3U8 manifest rewriting (proxies all segments)
- ✅ Android client optimization
- ✅ TMDb metadata enrichment (with TMDB_API_KEY)
- ✅ Range request support for seeking
- ✅ CORS enabled for cross-origin streaming
- ✅ Prowlarr auth cookie forwarding

**See Also:** [NEXUS_IMPLEMENTATION.md](NEXUS_IMPLEMENTATION.md) - Complete architecture and testing guide

## �🎯 Use Cases

### For Developers
- Integrate IPTV scanning into your app via REST API
- Build automated playlist validators
- Create media aggregation pipelines
- Monitor repositories for new content

### For IPTV Enthusiasts
- Scan and validate playlists
- Extract links from repositories
- Test channel availability
- Organize media collections

### For Automation
- Schedule repository scans
- Batch process multiple sources
- Aggregate links from various platforms
- Validate large playlists efficiently

## 🛠️ Installation

```bash
# Clone the repository
git clone <your-repo-url>

# Install dependencies
npm install

# Start the web UI
npm run dev

# Start the API server (in another terminal)
cd src/api
npx ts-node start.ts
```

## 💻 Web Interface

The web interface provides a full-featured UI for:
- File and folder drag-and-drop scanning
- Real-time validation with progress tracking
- EPG channel grid view
- Media player with playlist queue
- AI assistant chat
- Crawler management
- Archive batch processing
- Kodi addon comparison

Access at `http://localhost:5000` after running `npm run dev`.

## 📚 Documentation

- **[API Documentation](src/api/README.md)** - REST API reference
- **[Integration Guide](src/api/INTEGRATION.md)** - How to integrate the API
- **[PRD.md](PRD.md)** - Product requirements and design specs
- **[Android Package Support](ANDROID_PACKAGE_SUPPORT.md)** - APK scanning details

## 🔧 Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Express, Node.js
- **AI**: Google Gemini 2.5 Flash
- **Components**: Radix UI, shadcn/ui v4
- **Icons**: Phosphor Icons
- **Parsing**: JSZip, Pako, Octokit

## 🤖 AI Integration

Built-in Gemini AI assistant helps you:
- Find IPTV playlist sources
- Understand URL patterns
- Get scanning recommendations
- Troubleshoot issues

Access via the sparkle button in the bottom-right corner.

## 🔐 Security

### API Security Recommendations
- Enable authentication for production
- Use environment variables for secrets
- Implement rate limiting
- Validate and sanitize inputs
- Use HTTPS in production

See [Integration Guide](src/api/INTEGRATION.md) for security setup examples.

## 📦 Supported Formats

**Playlists**: M3U, M3U8, PLS, XSPF, ASX, WPL, SMIL, JSPF, B4S, KPL, and 40+ more

**Archives**: ZIP, RAR, 7Z, TAR, TAR.GZ, TGZ, BZ2, BZIP2

**Android**: APK, AAB, XAPK, APKS, APKM, APEX, APKX

**Kodi**: .xsp, .nfo, .strm, addon.xml, sources.xml, .py

**Protocols**: HTTP, HTTPS, RTSP, RTMP, RTP, UDP, HLS, DASH, MMS

## 🌟 Recent Updates

- ✅ **NEW: REST API** - External scan integration with job management
- ✅ Config file deep scanning for media links
- ✅ Automated link extraction and validation
- ✅ Export config analysis reports
- ✅ Gemini AI assistant integration
- ✅ Kodi addon comparison tool
- ✅ Batch archive scanning (7Z, BZ2)
- ✅ Scheduled crawler support
- ✅ Custom notification sounds

## 🤝 Contributing

Contributions are welcome! This project is built with modern web technologies and follows best practices for code quality and user experience.

## 📄 License

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.

---

**Need help?** Check the documentation or use the built-in AI assistant!
