# Planning Guide

A media link extraction tool that scans uploaded files for media URLs and playlist formats, then outputs a clean text file with discovered links.

**Experience Qualities**: 
1. **Efficient** - Quick file processing with immediate visual feedback on discovered links
2. **Reliable** - Accurate detection of various media formats and playlist types without false positives
3. **Clear** - Simple interface showing scan progress and results with download option

**Complexity Level**: Light Application (multiple features with basic state)
  - Handles file upload, parsing multiple formats, pattern matching, and output generation with state management for scan results

## Essential Features

### File Upload & Scanning
- **Functionality**: Accept file uploads (50+ playlist formats including M3U, M3U8, PLS, XSPF, ASX, WPL, SMIL, DASH, Smooth Streaming, RAM, B4S, KPL, JSPF, STRM, and Kodi formats like .nfo, .xsp, .py, addon.xml, sources.xml, etc.) and scan content for media links
- **Purpose**: Allow users to extract media URLs from various file formats including Kodi media center configurations without manual parsing
- **Trigger**: User clicks upload area or drags files into the drop zone
- **Progression**: Select file → Upload → Scan begins → Progress indicator → Results display → Download option appears
- **Success criteria**: All media URLs and playlist entries are detected and displayed with accurate counts, including Kodi-specific file formats

### AI Assistant Integration
- **Functionality**: Gemini 2.5 Flash AI assistant specialized in media streaming, IPTV, playlists, and Kodi knowledge, plus AI-powered pattern generation from example URLs
- **Purpose**: Provide expert guidance on finding media sources, understanding URL patterns, identifying content types, troubleshooting playlist issues, and automatically generating regex patterns from user examples
- **Trigger**: User clicks floating AI button, "Analyze with AI" on any URL, or uses the Pattern Generator with AI mode enabled
- **Progression**: Click AI button → Chat interface opens → Ask question or analyze URL → AI responds with context-aware answers → Suggestions and related links provided; OR Add example URLs → Enable AI mode → Generate pattern → AI analyzes patterns and creates optimized regex
- **Success criteria**: AI persona knowledgeable about IPTV protocols, Xtream Codes, Kodi addons, repository structures, playlist formats, authentication methods, and content classification; provides actionable advice specific to scanning and media link extraction; generates accurate regex patterns from URL examples with confidence scoring and improvement suggestions

### Link Detection & Parsing
- **Functionality**: Identify HTTP/HTTPS/RTSP/RTMPS/RTMP/RTP/UDP/HLS/DASH/MMS URLs pointing to media files (100+ video formats: mp4, mkv, avi, webm, h264, h265, hevc, vp8, vp9, av1, etc.; 60+ audio formats: mp3, aac, flac, opus, wav, etc.) and parse playlist formats (M3U, M3U8, PLS, XSPF, ASX, WPL, SMIL, DASH MPD, Smooth Streaming ISM, RAM, Xtream Codes API, B4S, KPL, JSPF, STRM, Kodi .nfo, .xsp, addon.xml, sources.xml, etc.)
- **Purpose**: Extract all relevant media links regardless of format, protocol, or surrounding text, including from Kodi media center files
- **Trigger**: Automatically runs after file upload
- **Progression**: File content read → Kodi format detection → Regex patterns applied → Playlist format detected → Protocol support (HTTP/HTTPS/RTSP/RTMPS/RTMP/RTP/UDP/HLS/DASH/MMS/MMSH) → Links extracted → Duplicates counted → Display results
- **Success criteria**: Detects URLs with 100+ video extensions, 60+ audio extensions, 10+ streaming protocols, M3U entries, Xtream API structures, XML playlists, text-based playlists, Kodi .strm files, Kodi .nfo metadata, Kodi .xsp smart playlists, Kodi addon.xml configurations, Kodi Python plugins (.py), and Kodi sources.xml paths

### AI-Powered Pattern Generation
- **Functionality**: Learn regex patterns from example URLs using machine learning and AI analysis; supports both rule-based and AI-assisted pattern generation with pattern testing, optimization, and detailed explanations
- **Purpose**: Enable users to create custom URL filters without regex expertise by providing positive and negative examples; automatically detect common patterns in protocols, domains, paths, extensions, and query parameters
- **Trigger**: User navigates to Pattern Generator section and adds example URLs marked as "should match" or "should NOT match"
- **Progression**: Add matching examples → Add non-matching examples → Optionally enable AI mode and provide context → Generate pattern → Review confidence score and suggestions → Test pattern with additional URLs → Optimize pattern → Copy for use in protocol filters or custom rules → View detailed pattern explanation
- **Success criteria**: Generates accurate regex patterns with 80%+ confidence; provides plain English descriptions; identifies common URL components (protocols, domains, ports, paths, extensions, query parameters); validates pattern against all examples; offers optimization suggestions; explains each regex component; supports both rule-based (fast, local) and AI-powered (smart, contextual) generation; handles authentication patterns, port specifications, file extensions, and complex URL structures

### Duplicate Detection & Analysis
- **Functionality**: Track occurrence count for each discovered link and identify duplicates across files
- **Purpose**: Help users understand which links appear multiple times and identify redundancy in their sources
- **Trigger**: Automatically runs during link extraction
- **Progression**: Links collected → Occurrence count calculated → Results sorted by frequency → Display with counts
- **Success criteria**: Shows total occurrences, unique count, duplicate count, and per-link occurrence badges

### Results Display & Export
- **Functionality**: Show found links in a scrollable list with occurrence counts, file path information, and two views (with counts / unique only), plus provide download options for individual or batch files
- **Purpose**: Allow users to review discovered links, identify duplicates, see where links originated, and export clean results in various formats
- **Trigger**: Scan completes successfully
- **Progression**: Results appear → User switches between views → Reviews links with counts and file paths → Expands individual links to see source files → Choose download option → Individual .txt files or ZIP archive with all files generated
- **Success criteria**: Two tabs showing links with counts and unique-only view, expandable file path details for each link, individual downloads for all-links.txt (with file paths), unique-links.txt (with file paths), and duplicates.txt (with file paths and counts), plus batch ZIP download containing all files with a summary

### Media Type Filtering
- **Functionality**: Filter discovered links by media type (All, Video, Audio) with visual indicators and counts for each category
- **Purpose**: Allow users to focus on specific media types and quickly identify video vs. audio content
- **Trigger**: User clicks filter buttons after scan completes
- **Progression**: Results displayed → User selects media filter → Links filtered in real-time → Visual indicators show media type → Filter persists across tab switches
- **Success criteria**: Accurate categorization of video/audio links based on extensions and URL patterns, filter buttons show counts for each category, video/audio icons displayed next to links, batch download includes separate video-links.txt and audio-links.txt files

### Batch Download
- **Functionality**: Generate a single ZIP archive containing all export formats (all links with file paths, unique links with file paths, duplicates with counts and file paths, video links, audio links, and summary report)
- **Purpose**: Provide convenient one-click download of all file variations with complete source tracking without multiple downloads
- **Trigger**: User clicks "Download All Files (ZIP)" button
- **Progression**: Click batch download → ZIP generation progress toast → All files packaged with file path metadata → Single .zip download → Success notification
- **Success criteria**: ZIP archive contains all-links.txt, unique-links.txt, duplicates.txt (if applicable), video-links.txt, audio-links.txt, and summary.txt with scan statistics including media type breakdown; all files include file path information as comments

### Batch Processing
- **Functionality**: Accept multiple files at once and aggregate all discovered links
- **Purpose**: Process entire folders of playlist files efficiently
- **Trigger**: User uploads multiple files simultaneously
- **Progression**: Multiple files selected → Each scanned sequentially → Combined results → Download all links
- **Success criteria**: All files processed, links deduplicated across files, total count displayed

### EPG Data Parsing & Display
- **Functionality**: Parse EPG (Electronic Program Guide) XML files to extract channel and programme information including logos, icons, and metadata
- **Purpose**: Provide comprehensive view of IPTV channel lineup with visual identification through logos and programme artwork
- **Trigger**: Automatically detects and parses EPG XML during file scanning
- **Progression**: EPG XML uploaded → Channels extracted with logos → Programmes parsed with icons → Display in dedicated EPG tab → Export options available
- **Success criteria**: Channel logos displayed as 48×48px thumbnails with fallback handling, programme icons shown as 64×64px thumbnails, all metadata (rating, episode number, language) properly categorized, separate download options for channels and programmes data

## Edge Case Handling

- **Empty Files** - Display message "No links found" instead of showing empty results
- **Invalid File Types** - Accept attempt but show clear feedback if no parseable content detected
- **Malformed URLs** - Skip incomplete or broken URLs, only include valid HTTP/HTTPS links
- **Large Files** - Show processing indicator, handle files up to several MB without freezing UI
- **Duplicate Links** - Track and display duplicate occurrences with counts, allow viewing with or without duplicate indicators
- **Mixed Content** - Extract links even from files with mixed text, code, or metadata
- **Unknown Media Types** - Links that cannot be categorized as video/audio show in "All" filter only, downloads always include all links regardless of filter state
- **Missing Logos** - Channel/programme logos that fail to load are gracefully hidden without breaking layout
- **Invalid Image URLs** - Images with broken URLs use onError handler to hide the image element

## Design Direction

The design should feel technical and purpose-built, like a developer tool - clean, functional, and focused on efficiency. Visual style should communicate precision and reliability with a modern, slightly technical aesthetic.

## Color Selection

A technical, high-contrast scheme with terminal-inspired accents that feels professional and dev-focused.

- **Primary Color**: Deep charcoal `oklch(0.25 0.01 260)` - Communicates technical sophistication and focus
- **Secondary Colors**: 
  - Dark slate background `oklch(0.15 0.01 260)` for cards/surfaces
  - Medium gray `oklch(0.45 0.005 260)` for borders and subtle dividers
- **Accent Color**: Bright cyan `oklch(0.75 0.15 195)` - Eye-catching for CTAs, progress, and discovered link counts
- **Foreground/Background Pairings**: 
  - Primary (Deep Charcoal `oklch(0.25 0.01 260)`): White text `oklch(0.98 0 0)` - Ratio 12.5:1 ✓
  - Accent (Bright Cyan `oklch(0.75 0.15 195)`): Dark text `oklch(0.15 0.01 260)` - Ratio 9.8:1 ✓
  - Background (Dark Slate `oklch(0.15 0.01 260)`): Light text `oklch(0.88 0.01 260)` - Ratio 11.2:1 ✓

## Font Selection

Monospace primary font for technical feel with clean sans-serif for UI elements - communicating precision and code-adjacent functionality.

- **Typographic Hierarchy**: 
  - H1 (App Title): Space Mono Bold/32px/tight letter spacing
  - H2 (Section Headers): Space Mono Bold/20px/normal spacing
  - Body (Instructions): Inter Regular/16px/relaxed line-height (1.6)
  - Code/Links: JetBrains Mono Regular/14px/tabular numbers
  - Counts/Stats: Space Mono Bold/18px/tabular figures

## Animations

Animations should reinforce technical precision - quick, purposeful transitions that communicate scanning activity and completion states without decoration.

Key moments: file upload drop zone highlight (150ms scale), scan progress pulse on accent elements (300ms), results fade-in with stagger (200ms delay per 5 items), download button hover lift (100ms).

## Component Selection

- **Components**: 
  - Card (main container for upload area and results)
  - Button (primary for download, secondary for clear/reset)
  - ScrollArea (for displaying long lists of discovered links)
  - Progress (linear indicator during scan)
  - Badge (counts for links found, duplicates detected, occurrence counts)
  - Tabs (switching between "with counts" and "unique only" views)
  - Separator (dividing upload from results)
  - Alert (for error states or empty results)
  
- **Customizations**: 
  - Custom file drop zone with dashed border that animates on drag-over
  - Monospace link list component with alternating subtle background rows
  - Download button with icon and file size preview
  
- **States**: 
  - Buttons: Solid accent on primary, hover lifts 2px with shadow, active scales 98%
  - Drop zone: Default dashed border, drag-over solid accent border with background tint, uploading shows progress overlay
  - Links: Hover highlights row with accent background at 10% opacity
  
- **Icon Selection**: 
  - Upload: UploadSimple (Phosphor)
  - Scan/Process: MagnifyingGlass or Detective
  - Download: DownloadSimple
  - Batch Download: Package (Phosphor) for ZIP archive
  - File types: FileText, FilmStrip for media indicators
  - Media types: VideoCamera for video, MusicNote for audio, Television for EPG/channels
  - Filter: FunnelSimple for filter indicator
  - File paths: File for individual file indicators, CaretRight/CaretDown for expand/collapse
  - Success: CheckCircle
  - Clear: X or Trash
  - Images: Channel logos (48×48px rounded), programme thumbnails (64×64px rounded with object-cover)
  
- **Spacing**: 
  - Container padding: p-8
  - Card spacing: gap-6 for main sections
  - List items: py-3 px-4
  - Button groups: gap-3
  - Section margins: mb-6
  
- **Mobile**: 
  - Drop zone reduces padding to p-4
  - Font sizes scale down (H1 to 24px, body to 14px)
  - Two-column stats become single column stack
  - Buttons go full-width with gap-2 stacking
  - ScrollArea max height reduces to 50vh on mobile
