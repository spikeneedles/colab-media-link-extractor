# Changelog

All notable changes to the Media Link Scanner project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-01-XX

### 🎉 Major Features Added

#### AI Integration
- **Gemini 2.5 Flash AI Assistant**: Integrated specialized AI assistant with knowledge of IPTV, Kodi, playlists, and streaming protocols
- **Context-Aware Responses**: AI understands current scan results and provides relevant suggestions
- **URL Analysis**: Click any link to get AI-powered analysis and recommendations
- **Playlist Source Finder**: Ask AI where to find specific types of media content
- **Interactive Chat Interface**: Floating chat window with conversation history

#### Animated Mascot
- **White Rabbit Character**: Custom animated rabbit mascot with multiple states
- **State Animations**: 
  - Idle: Standing with occasional blinking
  - Hopping: Animated movement when scanning
  - Thinking: Special animation during AI processing
  - Sleeping: Peaceful animation when waiting for input
  - Success: Celebration animation on completion
- **Contextual Display**: Mascot changes based on app state

#### Dark Mode Enhancement
- **System Preference Detection**: Automatically follows OS dark/light mode
- **Manual Toggle**: Three-option theme selector (Light/Dark/System)
- **Real-time Switching**: Instant theme changes without page reload
- **Persistent State**: Remembers manual theme selections
- **Visual Indicators**: Shows when following system theme

#### Kodi Addon Tools
- **Addon Repository Browser**: Download and analyze Kodi addon repositories
- **Side-by-Side Comparison**: Compare multiple Kodi addons simultaneously
- **Link Extraction**: Find all media sources within Kodi addons
- **Config Analysis**: Deep dive into addon configurations

#### Archive Processing
- **Batch Archive Scanner**: Process multiple archives in one operation
- **7Z Support**: Full 7-Zip archive extraction
- **BZ2 Support**: BZip2 compressed file handling
- **.exe Support**: Extract resources from executable files
- **Recursive Scanning**: Navigate nested archive structures

### ✨ Features Enhanced

#### Android Package Support
- **APKM Format**: Android Package Manager files
- **APKS Format**: APK Set (split APKs)
- **APEX Format**: Android Pony EXpress format
- **APKX Format**: Extended APK format
- **Config Extraction**: Automatically extract and analyze configuration files from all package types
- **Deep Scanning**: Search configs for embedded media links

#### Archive Support
- **.rar Files**: RAR archive extraction and scanning
- **.tar Files**: TAR archive support (including .tar.gz, .tgz)
- **.exe Files**: Extract embedded resources from executables
- **Nested Archives**: Handle archives within archives

#### Config File Exploration
- **Automatic Link Discovery**: Scan extracted config files for media URLs
- **Analysis Reports**: Generate detailed reports of config file contents
- **Individual File Download**: Save specific config files
- **Batch Config Export**: Download all configs as ZIP
- **Link Statistics**: Show which configs contain media links

#### Crawler Enhancements
- **Scheduled Execution**: Set specific times for crawler runs
- **Custom Notification Sounds**: Choose from multiple completion sounds (chime, bell, success)
- **Queue Management**: Add, remove, and reorder crawler targets
- **Progress Tracking**: Real-time status for each queued target
- **Auto-advance**: Automatically moves to next target when complete

### 🐛 Bug Fixes
- Fixed validation progress calculation for large link sets
- Resolved archive extraction issues with special characters in filenames
- Fixed EPG channel logo display on failed image loads
- Corrected duplicate detection across multiple file sources
- Fixed responsive layout issues on mobile devices
- Resolved theme toggle state persistence

### 🎨 UI/UX Improvements
- Enhanced mobile responsiveness across all components
- Improved loading states with contextual animations
- Better error messages with actionable suggestions
- Streamlined filter controls with visual feedback
- Added keyboard shortcuts for common actions
- Improved accessibility for screen readers

### 🔧 Technical Improvements
- Upgraded to React 19.2
- Migrated to TypeScript 5.7
- Updated Vite to 7.2
- Optimized bundle size with code splitting
- Improved validation performance with worker threads
- Enhanced error handling and logging

---

## [1.5.0] - 2024-12-XX

### ✨ Features Added

#### URL Validation
- **Parallel Testing Engine**: Validate multiple URLs simultaneously
- **Adjustable Concurrency**: Configure 1-20 concurrent requests
- **Real-time Metrics**: Live URLs/second rate display
- **Time Estimation**: Estimated time remaining during validation
- **Status Detection**: Working, Broken, Timeout classifications
- **Response Time Tracking**: Measure and display response times
- **Filter by Status**: View only working, broken, or timeout links
- **Validation Reports**: Export detailed validation results

#### Content Classification
- **Auto-Detection**: Automatically classify as Movie, TV Series, Live TV, or VOD
- **Pattern Recognition**: Uses URL patterns and metadata for classification
- **Manual Override**: Edit classifications individually or in bulk
- **Bulk Editing**: Select multiple links and change type at once
- **Visual Indicators**: Icons for each content type
- **Export Classifications**: Save to JSON backup file
- **Import Classifications**: Restore from backup
- **Merge Backups**: Combine multiple classification files

#### EPG Support
- **Channel Parsing**: Extract channel data from EPG XML
- **Programme Schedules**: Parse TV guide information
- **Channel Logos**: Display channel icons and thumbnails
- **Programme Icons**: Show programme artwork
- **Category Filtering**: Filter by channel groups
- **Metadata Display**: Ratings, episode numbers, descriptions
- **Separate Exports**: Individual files for channels and programmes

### 🔧 Improvements
- Enhanced duplicate detection algorithm
- Improved file path tracking
- Better error handling for malformed files
- Optimized memory usage for large scans

---

## [1.2.0] - 2024-11-XX

### ✨ Features Added

#### Advanced Scanning
- **Web URL Scanning**: Extract links from live websites
- **Playlist URL Scanning**: Direct M3U8/M3U URL analysis
- **Authentication Support**: Basic Auth, API keys, Bearer tokens
- **Xtream Codes API**: Native integration with credentials
- **Git Repository Scanning**: GitHub, GitLab, Bitbucket support

#### Media Player
- **Built-in Player**: Test media links without leaving the app
- **Video/Audio Support**: Playback for all common formats
- **Playlist Queue**: Sequential playback of multiple files
- **Queue Management**: Add, remove, reorder items

### 🔧 Improvements
- Added progress indicators for all scanning operations
- Enhanced error messages with context
- Improved mobile layout and touch interactions

---

## [1.0.0] - 2024-10-XX

### 🎉 Initial Release

#### Core Features
- **File Upload**: Drag and drop or click to upload
- **Multi-format Support**: M3U, M3U8, PLS, XSPF, ASX, WPL, and more
- **Recursive Scanning**: Process folders and all contents
- **Link Extraction**: Detect HTTP/HTTPS/RTSP/RTMP URLs
- **Duplicate Detection**: Track occurrence counts
- **File Path Tracking**: Show where links were found
- **Multiple Views**: With counts vs. unique only
- **Export Options**: Individual files or batch ZIP
- **Media Type Filtering**: Filter by video/audio
- **Visual Feedback**: Progress bars and status updates

#### Kodi Support
- **.nfo files**: Kodi metadata
- **.strm files**: Stream files
- **.xsp files**: Smart playlists
- **addon.xml**: Addon configurations
- **sources.xml**: Source definitions
- **Python plugins**: .py file scanning

#### Android Support
- **APK files**: Android application packages
- **AAB files**: Android App Bundles
- **XAPK files**: Extended APK format

#### Archive Support
- **ZIP files**: ZIP archive extraction
- **Recursive archives**: Archives within archives

#### UI Components
- Modern card-based layout
- Responsive design (mobile-first)
- Smooth animations with Framer Motion
- Toast notifications for feedback
- Collapsible sections for file paths

---

## Roadmap

### Planned for v2.1.0
- [ ] Browser extension for Chrome and Firefox
- [ ] Cloud storage integration (Google Drive, Dropbox)
- [ ] Advanced filtering with regex patterns
- [ ] Export to other formats (JSON, CSV, XML)
- [ ] Playlist editor and generator
- [ ] IPTV provider database integration

### Planned for v3.0.0
- [ ] Multi-language support (i18n)
- [ ] User accounts and saved scans
- [ ] Collaborative scanning and sharing
- [ ] Advanced analytics dashboard
- [ ] API rate limiting and quotas
- [ ] WebSocket real-time updates

---

## Breaking Changes

### v2.0.0
- Theme toggle now has three states (Light/Dark/System) instead of binary
- localStorage key changed from `darkMode` to include system preference flag
- AI assistant requires Gemini API configuration for full functionality
- Config file extraction enabled by default (may increase processing time)

### v1.5.0
- Validation results now stored in Map instead of Array (affects custom integrations)
- Content type field added to link objects (affects export format)
- EPG data structure changed to include validation status

### v1.0.0
- Initial stable release (no breaking changes from beta)

---

## Migration Guide

### Upgrading from v1.x to v2.0

1. **Theme Settings**: Existing theme preferences will be preserved, but users may need to reconfigure if they want automatic system following.

2. **Classification Backups**: Old classification JSON files are fully compatible. No migration needed.

3. **API Endpoints**: If using custom integrations, update to new `/api/external-scan` endpoint format.

4. **Config Files**: Enable automatic config extraction in settings if you want to scan Android package configs.

---

## Contributors

Special thanks to all contributors who helped make this project possible!

- Lead Developer: [Your Name]
- AI Integration: [Contributor Name]
- UI/UX Design: [Contributor Name]
- Testing & QA: [Contributor Name]

## Support

For questions, issues, or feature requests, please visit:
- GitHub Issues: https://github.com/yourusername/media-link-scanner/issues
- Discussions: https://github.com/yourusername/media-link-scanner/discussions

---

**Legend:**
- 🎉 Major Features
- ✨ New Features
- 🔧 Improvements
- 🐛 Bug Fixes
- 🎨 UI/UX Changes
- 🔒 Security Updates
- ⚠️ Breaking Changes
