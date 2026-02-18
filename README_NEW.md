# 🎬 Media Link Scanner

An AI-powered web application and browser extension for scanning and analyzing IPTV playlists, Kodi addons, streaming media links, and repositories. Extract URLs from 50+ file formats, validate links, and organize media content with intelligent classification.

## ✨ Features

### Core Scanning
- **Multi-Format Support**: M3U, M3U8, PLS, XSPF, EPG XML, Android packages (APK, AAB, XAPK, etc.), archives (ZIP, 7Z, RAR, TAR), and 50+ more formats
- **Repository Scanning**: GitHub, GitLab, Bitbucket, Codeberg, and other Git platforms
- **Web & Playlist Scanning**: Direct URLs, streaming playlists, IPTV providers
- **Kodi Integration**: Scan Kodi addons, plugins, configurations (.nfo, .strm, .xsp, addon.xml)
- **Package Analysis**: Extract and analyze config files from Android packages
- **Recursive Scanning**: Automatically scans folders and nested archives

### Media Analysis
- **Link Validation**: Test URLs to identify working vs broken streams
- **Content Classification**: Automatically detect movies, TV series, live TV, and VOD
- **EPG Parsing**: Extract Electronic Program Guide data with channel logos
- **Duplicate Detection**: Find and remove duplicate links with occurrence counts
- **Metadata Extraction**: Titles, categories, and channel information

### Advanced Features
- **AI Assistant**: Gemini 2.0 Flash integration for finding sources and troubleshooting
- **Media Player**: Built-in preview player with playlist queue
- **Batch Operations**: Bulk editing, classification export/import/merge
- **Web Crawler**: Automated scanning with scheduled tasks and custom targets
- **Archive Manager**: Batch archive scanning and Kodi addon downloader
- **URL Validation**: Parallel validation with adjustable speed control

### Browser Extension
- **Right-Click Integration**: Send any link or page directly to the scanner
- **Quick Popup**: Scan URLs without leaving your current tab
- **Recent Jobs Tracking**: Monitor your scan history
- **Auto-Detection**: Automatically identifies repository, playlist, or media types

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Web Application

```bash
npm run dev
```

The app will open at `http://localhost:5173`

### 3. Start the API Server (Optional - for Browser Extension)

```bash
npm run api:start
```

The API server runs at `http://localhost:3001`

### 4. Install Browser Extension (Optional)

See [EXTENSION_INSTALL.md](EXTENSION_INSTALL.md) for detailed instructions.

**Quick steps:**
1. Go to `chrome://extensions/` (Chrome) or `about:debugging` (Firefox)
2. Enable Developer Mode
3. Load the `browser-extension` folder as an unpacked extension

## 📖 Usage

### Scanning Files

1. **Drag & Drop**: Drop files or folders directly onto the upload area
2. **File Browser**: Click the upload area to select files
3. **Supported Formats**: Playlists, packages, archives, Kodi files, EPG XML, and more

### Scanning URLs

**Web URLs**: Enter website URLs to extract media links
```
https://example.com/media-page
```

**Playlists**: Scan M3U/M3U8 playlist URLs directly
```
http://provider.tv/playlist.m3u8
```

**Repositories**: Scan Git repositories for media files
```
https://github.com/iptv-org/iptv
```

**Xtream Codes API**: Connect with server credentials
- Server URL: `http://provider.tv:8080`
- Username & Password

### Using the Browser Extension

1. **Right-click any link** → "Send to Media Link Scanner"
2. **Click the extension icon** → Enter URL → "Send to Scanner"
3. **Select text with URLs** → Right-click → Send to scanner

### AI Assistant

Click the AI button (bottom-right) to:
- Find IPTV playlist sources
- Analyze specific URLs
- Get help with media link patterns
- Troubleshoot scanning issues

## 🔧 API Endpoints

### POST `/api/external-scan`

Create a new scan job.

**Request:**
```json
{
  "source_url": "https://github.com/iptv-org/iptv",
  "label": "IPTV.org Repository",
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

### GET `/api/jobs/:jobId`

Get scan job status and results.

### GET `/api/jobs`

List all scan jobs.

### DELETE `/api/jobs/:jobId`

Delete a completed scan job.

See [src/api/README.md](src/api/README.md) for full API documentation.

## 📦 Project Structure

```
.
├── browser-extension/       # Chrome/Firefox browser extension
│   ├── manifest.json       # Extension manifest
│   ├── background.js       # Background service worker
│   ├── popup.html          # Extension popup
│   └── options.html        # Settings page
├── src/
│   ├── api/                # Backend API server
│   │   └── server.ts       # Express server with endpoints
│   ├── components/         # React components
│   │   ├── MediaPlayer.tsx
│   │   ├── CrawlerManager.tsx
│   │   └── ArchiveManager.tsx
│   ├── lib/                # Core logic
│   │   ├── linkExtractor.ts   # Link extraction & parsing
│   │   ├── urlValidator.ts    # URL validation
│   │   ├── epgParser.ts       # EPG XML parsing
│   │   ├── crawler.ts         # Web crawling
│   │   └── geminiAssistant.ts # AI integration
│   └── App.tsx             # Main application
└── index.html
```

## 🎯 Use Cases

### IPTV Providers
- Scan and validate M3U/M3U8 playlists
- Extract channel lists with EPG data
- Test stream availability
- Organize by category and content type

### Kodi Users
- Analyze addon repositories
- Extract media links from addons
- Compare multiple addon sources
- Download and inspect config files

### Media Archivists
- Scan large collections of files
- Extract and organize media URLs
- Remove duplicates
- Classify content by type

### Developers
- API integration for automated scanning
- Bulk repository analysis
- Scheduled crawling tasks
- Custom workflow automation

## 🔐 Security & Privacy

- **No Data Collection**: All scanning happens locally or on your configured server
- **Local Storage**: Browser extension uses local storage only
- **No Third-Party Services**: Direct communication with your API server
- **API Authentication**: Optional API key support for secured endpoints

## 📚 Documentation

- [Browser Extension Installation](EXTENSION_INSTALL.md)
- [API Documentation](src/api/README.md)
- [Android Package Support](ANDROID_PACKAGE_SUPPORT.md)
- [Security Policy](SECURITY.md)
- [Product Requirements](PRD.md)

## 🛠️ Development

### Prerequisites
- Node.js 18+
- npm 9+

### Running Locally

```bash
# Install dependencies
npm install

# Start web app (development)
npm run dev

# Start API server
npm run api:start

# Build for production
npm run build
```

### Tech Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Express, Node.js
- **Browser Extension**: Vanilla JS (Chrome Extension Manifest V3)
- **AI**: Google Gemini 2.0 Flash
- **Libraries**: JSZip, D3, Framer Motion, React Hook Form

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch
3. Make your changes with clear commit messages
4. Test thoroughly (web app, API, and extension)
5. Submit a pull request

## 📄 License

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.

## 🙏 Acknowledgments

- Built with [Spark](https://github.com/github/spark)
- Icons by [Phosphor Icons](https://phosphoricons.com)
- UI components by [shadcn/ui](https://ui.shadcn.com)
- AI powered by [Google Gemini](https://deepmind.google/technologies/gemini/)

---

**Happy Scanning! 🎬✨**
