# 🐰 Media Link Scanner - AI-Powered IPTV & Kodi Link Extractor

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![React](https://img.shields.io/badge/React-19.2.0-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-3178c6)

A comprehensive, AI-powered media link extraction and validation tool with support for 50+ file formats, IPTV playlists, Kodi configurations, Android packages, Git repositories, and more. Features an integrated Gemini 2.5 Flash AI assistant specialized in media streaming knowledge.

## 🌟 Key Features

### 📦 Pattern Repository Hub (NEW!)
- **Create & Share Patterns**: Build reusable patterns for URL filtering, scraping, pagination, and crawling
- **Public & Private Repositories**: Organize patterns in repositories with version control
- **Fork & Collaborate**: Fork community patterns and contribute improvements
- **Import/Export**: Share patterns as JSON files with the community
- **Pattern Library**: Access curated collections of verified patterns
- **Social Features**: Star favorites, track downloads, rate patterns

### 🌍 **Community Pattern Hub** ⭐ NEW
- **Discover & Share**: Browse and publish community-contributed streaming patterns
- **Advanced Search**: Filter by category, tags, author, verified status, rating, and downloads
- **Social Collaboration**: Star favorites, fork patterns, subscribe to updates, comment, and review
- **5-Tab Navigation**: Explore all patterns, trending, featured, your patterns, and subscriptions
- **User Profiles**: Build reputation through contributions, track your stats and achievements
- **Pattern Publishing**: Share your patterns with detailed descriptions, examples, tags, and licensing
- **Rating System**: 5-star reviews with comments help users find quality patterns
- **Hub Statistics**: Track total patterns, downloads, stars, contributors, and weekly activity
- **Collections**: Organize patterns into themed collections (coming soon)
- **See**: [COMMUNITY_PATTERN_HUB.md](COMMUNITY_PATTERN_HUB.md) for full documentation

### 🔍 **Comprehensive File Scanning**
- **50+ File Format Support**: M3U, M3U8, PLS, XSPF, ASX, WPL, SMIL, DASH, Smooth Streaming, EPG XML, and more
- **Kodi Integration**: Full support for `.nfo`, `.strm`, `.xsp`, `addon.xml`, `sources.xml`, Python plugins
- **Android Packages**: APK, AAB, XAPK, APKS, APKM, APEX, APKX with automatic config extraction
- **Archive Support**: ZIP, RAR, 7Z, TAR, TAR.GZ, TGZ, BZ2, EXE with recursive scanning
- **Recursive Folder Scanning**: Drop entire folder structures for complete analysis

### 🌐 **Advanced Scanning Methods**
- **Web URL Scanning**: Extract media links from live websites
- **Playlist URL Scanning**: Direct IPTV/M3U8 playlist analysis with authentication support
- **Xtream Codes API**: Native integration with credentials (server URL, username, password)
- **Git Repository Scanning**: GitHub, GitLab, Bitbucket, Gitea, Codeberg support
- **Automated Crawlers**: Queue-based web crawling with scheduled execution and custom targets
- **🆕 Repository Auto-Scraper**: Automatically detect source repositories from media URLs and scrape all media

### 🤖 **AI Assistant (Gemini 2.5 Flash)**
- **Specialized Knowledge**: IPTV protocols, Xtream Codes, Kodi addons, playlist formats
- **Context-Aware**: Understands your scan results and provides relevant suggestions
- **Instant Help**: Find playlist sources, understand URL patterns, troubleshoot issues
- **Interactive Chat**: Ask questions about media links, authentication, and scanning techniques
- **Pattern Generation**: AI-powered regex pattern creation from example URLs

### 🎯 **AI-Powered Pattern Generation** ⭐ NEW
- **Learn from Examples**: Add matching and non-matching URLs to train custom patterns
- **Dual-Mode Generation**: Rule-based (fast) or AI-assisted (smart) pattern creation
- **Confidence Scoring**: 0-100% accuracy rating with improvement suggestions
- **Pattern Testing**: Validate patterns against new URLs before deployment
- **Auto-Optimization**: Simplify and improve regex patterns automatically
- **Pattern Explanation**: Human-readable breakdown of complex regex components
- **URL Analysis**: Automatically detect protocols, domains, paths, extensions, and parameters

### 📊 **Content Intelligence**
- **Auto-Classification**: Detects Movies, TV Series, Live TV, VOD automatically
- **Bulk Editing**: Change content types for multiple links at once
- **Export/Import Classifications**: JSON backup and merge multiple classification files
- **Duplicate Detection**: Track occurrences with detailed file path information

### ✅ **URL Validation**
- **Parallel Testing**: Adjustable concurrent requests (1-20)
- **Real-time Metrics**: URLs/second rate, estimated time remaining
- **Status Detection**: Working, Broken, Timeout with response times
- **Filtering**: View results by validation status
- **Detailed Reports**: Export validation results with full statistics

### 📺 **EPG (Electronic Program Guide) Support**
- **Channel Parsing**: Extract channel information with logos and metadata
- **Programme Schedules**: Parse TV guide data with descriptions and ratings
- **Visual Display**: Grid and list views with channel thumbnails
- **Category Filtering**: Filter by channel groups and genres
- **URL Extraction**: Separate download for channel stream URLs

### 🎮 **Media Player**
- **Built-in Player**: Test video/audio links directly in the app
- **Playlist Queue**: Play multiple media files in sequence
- **Queue Management**: Add, remove, reorder playback queue

### 📦 **Export Options**
- **Batch ZIP Download**: All formats in one archive
- **Individual Files**: All links, unique only, duplicates, by media type
- **Config Analysis**: Detailed reports for Android package configs
- **EPG Exports**: Separate files for channels and programmes

### 🔐 **Authentication Support**
- **Basic Auth**: Username/password for protected playlists
- **API Keys**: Header or query parameter authentication
- **Bearer Tokens**: OAuth and JWT token support
- **Xtream Codes**: Dedicated API authentication

### 🛠️ **Kodi Addon Tools**
- **Repository Browser**: Download and analyze Kodi addon repositories
- **Addon Comparison**: Side-by-side comparison of multiple addons
- **Config Extraction**: Extract and analyze addon configurations
- **Link Discovery**: Scan addon files for embedded media sources

### 🔍 **Repository Auto-Scraper** ⭐ NEW
- **Automatic Detection**: Analyze media URLs to identify source repositories (GitHub, GitLab, Bitbucket, Codeberg, Gitea, Web)
- **Full Repository Scraping**: Once detected, automatically scrapes ALL media files from the entire repository
- **Smart Detection**: Recognizes CDN patterns (jsDelivr, UNPKG), raw URLs, and infers repository structure
- **Complete Documentation**: Tracks repository URL, type, confidence level, detection reason, and original media URL
- **Batch Processing**: Process multiple URLs simultaneously with automatic repository deduplication
- **Multiple Export Formats**: Text reports, JSON metadata, link lists, and M3U playlists
- **Confidence Scoring**: High/Medium/Low accuracy ratings for detection reliability

### 🎨 **Modern UI/UX**
- **Animated Rabbit Mascot**: Delightful animations for different states
- **Dark/Light Mode**: Automatic system preference detection with manual toggle
- **Responsive Design**: Mobile-first with progressive enhancement
- **Real-time Progress**: Live scanning progress with detailed status updates

## 🐳 Docker Deployment (Recommended)

The fastest way to get started is with Docker:

### Quick Start with Docker

```bash
# Make the management script executable
chmod +x docker.sh

# Start in development mode (with hot reload)
./docker.sh start-dev

# Or start in production mode
./docker.sh start

# Access the app at http://localhost
```

### Alternative: Using Make

```bash
# Start in development mode
make start-dev

# Start in production mode
make start

# Check status
make status
```

### Docker Features

- **🔧 Development Mode**: Hot reload, debug ports, Redis Commander
- **🚀 Production Mode**: Optimized build, Nginx, multiple workers
- **📊 Full Scaling**: Load balancer, 5+ workers, Redis Sentinel
- **💾 Persistent Storage**: Crawler results saved in Docker volumes
- **🔄 Auto-restart**: Services automatically restart on failure
- **📈 Resource Limits**: Configurable CPU and memory constraints

📚 **Full Docker Documentation**: See [DOCKER_SETUP.md](./DOCKER_SETUP.md) for complete guide  
⚡ **Quick Reference**: See [DOCKER_QUICKSTART.md](./DOCKER_QUICKSTART.md) for common commands

### 🔐 HTTPS/SSL Setup (Production)

Secure your deployment with SSL certificates:

```bash
# Interactive SSL setup (easiest)
chmod +x ssl-setup.sh
./ssl-setup.sh

# Manual setup for production
./scripts/generate-ssl-certs.sh          # Generate certificates
docker-compose -f docker-compose.ssl.yml up -d  # Start with SSL
./scripts/setup-letsencrypt.sh           # Get Let's Encrypt cert
./scripts/setup-cert-renewal.sh          # Setup auto-renewal
```

**Features:**
- 🔒 TLS 1.2/1.3 with modern cipher suites
- ✅ Let's Encrypt integration with auto-renewal
- 🛡️ A+ SSL Labs rating configuration
- 🔐 Self-signed certificates for development
- 📊 HSTS, OCSP stapling, perfect forward secrecy
- 🔄 Automatic certificate renewal (cron/systemd/docker)

📚 **SSL Documentation**:
- [SSL_QUICKSTART.md](./SSL_QUICKSTART.md) - Quick reference
- [SSL_SETUP.md](./SSL_SETUP.md) - Complete SSL guide

## 🚀 Manual Installation (Alternative)

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Modern web browser (Chrome, Firefox, Edge, Safari)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/media-link-scanner.git
cd media-link-scanner

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5000`

### Browser Extension

Install the companion browser extension to send links directly from your browser:

```bash
cd browser-extension
# Follow EXTENSION_INSTALL.md for Chrome/Firefox installation
```

## 📖 Usage Guide

### Basic File Scanning

1. **Upload Files**: Drag and drop files or folders into the upload area
2. **Automatic Scanning**: App recursively scans all files and archives
3. **View Results**: Browse extracted links with metadata and file paths
4. **Download**: Export results in various formats

### Advanced Scanning

#### Web URL Scanning
```
1. Navigate to "Scan Web URLs" section
2. Enter one URL per line
3. Click "Scan Web URLs"
4. Links extracted from HTML content
```

#### Playlist URL Scanning
```
1. Navigate to "Scan IPTV/Streaming Playlist URLs"
2. Enter M3U/M3U8 URLs (one per line)
3. (Optional) Add authentication credentials
4. Click "Scan Playlist URLs"
5. View detailed playlist analysis
```

#### Xtream Codes API
```
1. Navigate to "Scan Xtream Codes API"
2. Enter server URL (e.g., http://provider.tv:8080)
3. Enter username and password
4. Click "Scan Xtream Codes API"
5. Access all live TV, VOD, and series streams
```

#### Git Repository Scanning
```
1. Navigate to "Scan Git Repositories"
2. Enter repository URLs (GitHub, GitLab, etc.)
3. Click "Scan Git Repositories"
4. Analyzes all supported files in the repository
```

### Content Classification

1. **Select Links**: Use checkboxes to select links
2. **Bulk Edit**: Click "Edit Selected"
3. **Choose Type**: Movie, TV Series, Live TV, VOD
4. **Apply**: Changes reflected immediately
5. **Export**: Save classifications as JSON backup

### URL Validation

1. **Configure Speed**: Adjust concurrent requests slider (1-20)
2. **Start Validation**: Click "Validate All Links"
3. **Monitor Progress**: Watch real-time rate and time estimate
4. **Filter Results**: View by status (Working/Broken/Timeout)
5. **Export Report**: Download detailed validation report

### AI Assistant

1. **Open Assistant**: Click floating rabbit button (bottom-right)
2. **Ask Questions**: 
   - "Where can I find IPTV playlists?"
   - "How do I scan Kodi repositories?"
   - "What format is this URL?"
3. **Analyze URLs**: Click sparkle icon on any link
4. **Get Suggestions**: AI provides context-specific recommendations

## 🏗️ Architecture

### Frontend Stack
- **React 19.2** - UI framework
- **TypeScript 5.7** - Type safety
- **Vite 7.2** - Build tool and dev server
- **Tailwind CSS 4.1** - Utility-first styling
- **Framer Motion 12** - Animations
- **Shadcn UI** - Component library (40+ components)

### Key Libraries
- **JSZip** - Archive handling
- **Pako** - GZIP compression
- **Octokit** - GitHub API client
- **D3.js** - Data visualization
- **Sonner** - Toast notifications
- **Recharts** - Charts and graphs

### File Structure
```
src/
├── App.tsx                 # Main application component
├── components/
│   ├── ui/                 # Shadcn components (40+)
│   ├── MediaPlayer.tsx     # Built-in media player
│   ├── CrawlerManager.tsx  # Web crawler controls
│   ├── ArchiveManager.tsx  # Batch archive scanner
│   ├── AddonComparison.tsx # Kodi addon comparison
│   └── AnimatedRabbit.tsx  # Mascot animations
├── lib/
│   ├── linkExtractor.ts    # Core extraction engine
│   ├── epgParser.ts        # EPG XML parsing
│   ├── urlValidator.ts     # URL validation engine
│   ├── geminiAssistant.ts  # AI integration
│   └── utils.ts            # Utility functions
├── hooks/
│   └── use-mobile.ts       # Responsive hook
└── api/
    ├── crawler.ts          # Web crawler logic
    └── server.ts           # Backend API server
```

## 🔧 Configuration

### Environment Variables
```env
# Optional: Gemini API configuration (AI Assistant)
VITE_GEMINI_API_KEY=your_api_key_here

# Optional: Custom API endpoint
VITE_API_BASE_URL=http://localhost:3000
```

### Validation Settings
- **Default Concurrent Requests**: 5
- **Min Concurrent**: 1
- **Max Concurrent**: 20
- **Request Timeout**: 10 seconds

### Archive Support
- **Max File Size**: Unlimited (streams processing)
- **Supported Formats**: ZIP, RAR, 7Z, TAR, GZ, TGZ, BZ2, EXE
- **Recursive Depth**: Unlimited

## 📊 Supported Formats

### Playlist Formats (50+)
M3U, M3U8, PLS, XSPF, ASX, WPL, B4S, KPL, JSPF, SMIL, DASH (MPD), HLS, Smooth Streaming (ISM/ISML), F4M, RAM, QTLXML, M4U, VLC, ZPL, MPCPL, MXU, CUE, DPL, AIMPPL, BIO, FPL, MPLS, PLA, PLC, PLX, PLIST, SQF, WAX, WMX, XPL, RMP, RPM, SML

### Kodi Formats
.nfo, .strm, .xsp, addon.xml, sources.xml, favourites.xml, advancedsettings.xml, playercorefactory.xml, .py (Python plugins)

### Android Packages
APK, AAB, XAPK, APKS, APKM, APEX, APKX

### Archives
ZIP, RAR, 7Z, TAR, TAR.GZ, TGZ, GZ, BZ2, EXE

### Video Extensions (100+)
mp4, mkv, avi, mov, wmv, flv, webm, m4v, mpg, mpeg, m2ts, ts, vob, 3gp, ogv, and 85+ more

### Audio Extensions (60+)
mp3, aac, flac, opus, wav, m4a, ogg, wma, alac, ape, and 50+ more

### Streaming Protocols
HTTP, HTTPS, RTSP, RTMPS, RTMP, RTP, UDP, MMS, MMSH, HLS, DASH

## 🔌 API Reference

### POST /api/external-scan
Trigger external scan from browser extension or other services.

**Request:**
```json
{
  "source_url": "https://example.com/playlist.m3u8",
  "label": "My Playlist",
  "media_type": "playlist"
}
```

**Response:**
```json
{
  "job_id": "unique-job-id",
  "status": "processing"
}
```

### GET /api/job-status/:jobId
Check scan job status.

**Response:**
```json
{
  "job_id": "unique-job-id",
  "status": "completed",
  "links_found": 150,
  "scan_time": "3.2s"
}
```

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Maintain existing code style
- Add comments for complex logic
- Test all new features
- Update documentation

## 🐛 Known Issues & Limitations

- **Large Files**: Files over 100MB may take longer to process
- **Archive Password**: Password-protected archives not supported
- **Validation Rate Limits**: Some servers may throttle validation requests
- **AI Assistant**: Requires active internet connection for Gemini API

## 📝 Changelog

### v2.2.0 (Current)
- ✨ **NEW**: Community Pattern Hub - marketplace for discovering and sharing patterns
- ✨ **NEW**: Pattern discovery with search, trending, and featured sections
- ✨ **NEW**: Social features - star, fork, review, comment, and subscribe to patterns
- ✨ **NEW**: User profiles with reputation system and contribution tracking
- ✨ **NEW**: Advanced search with filters (category, tags, verified, rating, downloads)
- ✨ **NEW**: 5-tab navigation (Explore, Trending, Featured, My Patterns, Subscriptions)
- ✨ **NEW**: Pattern publishing with licensing options (MIT, Apache, GPL, BSD, CC0)
- ✨ **NEW**: Hub statistics dashboard tracking patterns, downloads, stars, contributors
- ✨ **NEW**: Pattern Repository Hub for creating and sharing patterns
- ✨ **NEW**: Public and private pattern repositories with version control
- ✨ **NEW**: Fork, star, and collaborate on community patterns
- ✨ **NEW**: Import/export patterns as JSON files
- ✨ **NEW**: Pattern categorization (URL filters, scraping rules, pagination, provider presets, crawl configs)
- ✨ **NEW**: Sample pattern library with 17+ ready-to-use patterns
- 📚 Added comprehensive pattern repository documentation
- 📚 Added comprehensive community hub documentation
- 🎨 Enhanced pattern management UI
- 🔄 Pattern forking and sharing features

### v2.1.0
- ✨ **NEW**: AI-powered pattern generation from example URLs
- ✨ **NEW**: Learn regex patterns without regex knowledge
- ✨ **NEW**: Dual-mode pattern generation (rule-based + AI)
- ✨ **NEW**: Pattern testing, optimization, and explanation tools
- ✨ **NEW**: Confidence scoring for generated patterns
- 🎨 Added pattern generator UI component
- 📚 Added comprehensive pattern generation documentation

### v2.0.0
- ✨ Added Gemini 2.5 Flash AI assistant
- ✨ Added animated rabbit mascot
- ✨ Added dark/light mode with system detection
- ✨ Added Kodi addon comparison tool
- ✨ Added batch archive scanning
- ✨ Added scheduled crawler execution
- ✨ Enhanced Android package support (APKM, APEX, APKX)
- ✨ Added .exe, .rar, .tar archive support
- ✨ Config file analysis and exploration
- 🐛 Fixed validation progress calculation
- 🎨 Improved mobile responsiveness

### v1.5.0
- ✨ Added URL validation engine
- ✨ Added EPG XML parsing
- ✨ Added content classification (Movie/TV/Live TV)
- ✨ Added bulk editing
- ✨ Added classification export/import

### v1.0.0
- 🎉 Initial release
- ✨ Basic file scanning
- ✨ M3U/M3U8 support
- ✨ Duplicate detection

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Shadcn UI** - Beautiful component library
- **Phosphor Icons** - Comprehensive icon set
- **Gemini API** - AI-powered assistance
- **Spark Framework** - Development platform
- **React Community** - Continuous inspiration

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/media-link-scanner/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/media-link-scanner/discussions)
- **Email**: support@example.com

## 🔗 Related Documentation

- **[PATTERN_GENERATOR.md](PATTERN_GENERATOR.md)** - AI-powered pattern generation guide
- **[PATTERN_REPOSITORY.md](PATTERN_REPOSITORY.md)** - Pattern sharing hub
- **[COMMUNITY_PATTERN_HUB.md](COMMUNITY_PATTERN_HUB.md)** - **NEW!** Community pattern marketplace
- **[SAMPLE_PATTERNS.md](SAMPLE_PATTERNS.md)** - Ready-to-use patterns
- **[EXTENSION_INSTALL.md](EXTENSION_INSTALL.md)** - Extension installation guide
- **[ANDROID_PACKAGE_SUPPORT.md](ANDROID_PACKAGE_SUPPORT.md)** - Android package docs
- **[API_README.md](API_README.md)** - API documentation
- **[SECURITY.md](SECURITY.md)** - Security policy
- **[PRD.md](PRD.md)** - Product requirements

---

Made with ❤️ and 🐰 by the Media Link Scanner Team
