# Android Package Format Support

This Media Link Scanner supports comprehensive scanning of all major Android package formats for media links and configuration files.

## Supported Android Package Formats

### 1. **APK (Android Package)**
- Standard Android application package
- Scans: assets/, res/raw/, res/values/, lib/, META-INF/ folders
- Extracts: Configuration files, media links, IPTV settings

### 2. **AAB (Android App Bundle)**
- Google Play's publishing format
- Scans: Base modules and feature modules
- Extracts: Module-level configurations and nested ZIP content

### 3. **XAPK (Extended APK)**
- Third-party installation format
- Contains: Main APK + split APKs + OBB files
- Scans: All nested APKs and top-level config files

### 4. **APKS (APK Set)**
- Collection of split APKs for different device configurations
- Scans: Each individual APK in the set
- Extracts: Links from all splits (base, architecture-specific, language-specific)

### 5. **APKM (APK Mirror Bundle)**
- APKMirror's packaging format
- Similar to XAPK with metadata
- Scans: Nested APKs and manifest files

### 6. **APEX (Android Pony EXpress)**
- System-level updatable components
- Contains: Compressed filesystem with binaries
- Scans: Configuration files and system settings

### 7. **APKX (APK Extended)**
- Alternative extended APK format
- Contains: Split APKs for modular installations
- Scans: All APK splits for media configurations

## What Gets Extracted

### Media Links
- HTTP/HTTPS streaming URLs
- RTSP/RTMP/RTP streams
- HLS (m3u8) playlists
- DASH manifests
- UDP/MMS protocols
- Local file references

### Configuration Files
The scanner extracts configuration files from these locations:
- `assets/` - Application assets
- `res/raw/` - Raw resource files
- `res/values/` - Value resources (strings, configs)
- `lib/` - Native libraries folder
- `config/` - Configuration directories
- `META-INF/` - Metadata files

### Supported Config File Types
- `.json` - JSON configuration
- `.xml` - XML settings
- `.properties` - Java properties
- `.ini` - INI configuration
- `.txt` - Text files
- `.conf` / `.cfg` - Config files
- `.m3u` / `.m3u8` - M3U playlists
- `.pls` - PLS playlists
- `.xspf` - XSPF playlists

### Common IPTV/Streaming Config Patterns
The scanner looks for files containing:
- `config` - Configuration files
- `settings` - App settings
- `channels` - Channel lists
- `servers` - Server configurations
- `playlist` - Playlist files
- `urls` / `links` - URL lists
- `streams` - Stream definitions
- `media` - Media references
- `iptv` - IPTV configurations
- `api` / `endpoints` - API configurations
- `data` - Data files

## How It Works

### For Container Formats (XAPK, APKM, APKS, APKX)
1. Opens the container package
2. Extracts top-level configuration files
3. Finds all nested APK files
4. Recursively scans each nested APK
5. Combines all found links and configurations

### For Bundle Formats (AAB)
1. Opens the app bundle
2. Scans base module configurations
3. Extracts feature module ZIPs
4. Scans each module's contents
5. Aggregates all configurations

### For Standard Formats (APK, APEX)
1. Opens package as ZIP archive
2. Scans predefined folders (assets, res, lib)
3. Identifies configuration files by extension and name
4. Extracts media links using pattern matching
5. Returns all found URLs and configs

## Features

✅ **Link Extraction** - Automatically finds all media URLs in package files
✅ **Config Extraction** - Downloads all configuration files as ZIP archive
✅ **Deep Scanning** - Recursively scans nested packages (APK within XAPK)
✅ **Format Detection** - Auto-detects M3U, JSON, XML, and other playlist formats
✅ **Validation** - Test extracted URLs to verify they're working
✅ **AI Analysis** - Use Gemini AI to understand extracted configurations

## Usage in the App

### Scanning Android Packages
1. Drag and drop any Android package file (APK, AAB, XAPK, etc.)
2. The scanner automatically detects the format
3. Extracts all media links and configurations
4. Displays results with counts and categories

### Downloading Config Files
1. After scanning completes, look for "Extracted Configuration Files" section
2. Click "Download All Config Files" button
3. Receives a ZIP archive with all extracted configurations
4. File structure preserves original package paths

### Validating Links
1. Use "Validate All Links" to test URLs
2. Shows working/broken status with response times
3. Filter results by validation status
4. Export validation report

## Technical Implementation

### File Processing
```typescript
// Detects Android packages
const isAndroidPackage = 
  fileName.endsWith('.apk') || 
  fileName.endsWith('.aab') || 
  fileName.endsWith('.xapk') || 
  fileName.endsWith('.apks') || 
  fileName.endsWith('.apkm') || 
  fileName.endsWith('.apex') || 
  fileName.endsWith('.apkx')

// Scans using JSZip library
const zip = await JSZip.loadAsync(file)
const links = await scanAPK(file)
const configs = await extractConfigFilesFromPackage(file)
```

### Config Extraction Logic
- Checks file extensions against whitelist
- Verifies location in relevant folders
- Matches filename patterns for common configs
- Extracts content preserving UTF-8 encoding
- Tracks file size and type metadata

## Limitations

- Only text-based configuration files are extracted (binary configs are skipped)
- Very large packages (>100MB) may take longer to process
- Obfuscated or encrypted configs cannot be analyzed
- Some apps may store configs in databases (not extracted)

## Best Practices

1. **IPTV Apps**: Look for files in `assets/` folder with names like `channels.json`, `servers.txt`, `playlist.m3u`
2. **Streaming Apps**: Check `res/raw/` for embedded playlists
3. **Kodi Addons**: Scan for `addon.xml`, `default.py`, and settings files
4. **Multi-APK Packages**: Use XAPK/APKS formats to scan all splits at once

## Security Note

⚠️ **Privacy**: This scanner runs entirely in your browser. No files are uploaded to any server. All processing happens locally on your device.

⚠️ **Legal**: Only scan packages you have the right to analyze. Respect app developers' terms of service and intellectual property rights.
