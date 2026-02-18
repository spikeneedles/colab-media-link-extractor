# Repository Auto-Scraper Documentation

## 🎯 Overview

The **Repository Auto-Scraper** is an advanced feature that automatically detects the source repository of media links, scrapes all media files from that repository, and documents everything with full metadata.

## ✨ Key Features

### 1. **Automatic Repository Detection**
- Analyzes media URLs to identify their source repository
- Supports multiple platforms:
  - **GitHub** (github.com, raw.githubusercontent.com)
  - **GitLab** (gitlab.com, gitlab.*)
  - **Bitbucket** (bitbucket.org)
  - **Gitea** (gitea.io, gitea.*)
  - **Codeberg** (codeberg.org)
  - **CDN Sources** (jsDelivr, UNPKG)
  - **Generic Web Sources**

### 2. **Full Repository Scraping**
- Once a repository is detected, automatically scrapes ALL media files
- Recursively processes all supported file formats:
  - M3U/M3U8 playlists
  - PLS, XSPF, ASX playlists
  - Config files with embedded links
  - Android APK/AAB packages
  - ZIP and other archives
  - Kodi addon files (.xsp, .nfo, .strm, addon.xml)
  - EPG XML files

### 3. **Complete Documentation**
Each discovery includes:
- **Repository URL** - Full path to source repository
- **Repository Type** - Platform (GitHub, GitLab, etc.)
- **Confidence Level** - High/Medium/Low accuracy rating
- **Detection Reason** - Explanation of how it was found
- **Original Media URL** - The link that led to discovery
- **Total Media Found** - Count of all discovered media
- **Files Scanned** - Number of files processed
- **Timestamp** - When the scan occurred

### 4. **Multiple Export Formats**

#### **Text Report**
Comprehensive human-readable report with:
- Repository details
- Scrape statistics
- Complete media link list
- Error log (if any)

#### **JSON Metadata**
Structured data export containing:
```json
[
  {
    "repositoryUrl": "https://github.com/user/repo",
    "repositoryType": "github",
    "confidence": "high",
    "reason": "Media URL is from GitHub repository",
    "originalMediaUrl": "https://raw.githubusercontent.com/user/repo/main/playlist.m3u",
    "detectedAt": "2026-02-18T10:30:00.000Z",
    "totalMediaFound": 450,
    "filesScanned": 23,
    "autoScraped": true,
    "allMediaLinks": [...]
  }
]
```

#### **Link List (TXT)**
Simple list of all discovered media URLs, one per line:
```
https://example.com/stream1.m3u8
https://example.com/stream2.m3u8
https://example.com/video.mp4
```

#### **M3U Playlist**
Standard M3U8 format with metadata:
```m3u
#EXTM3U
#EXTINF:-1 group-title="Repository: github",https://github.com/user/repo
#EXTINF:-1,playlist.m3u
https://example.com/stream1.m3u8
#EXTINF:-1,video.mp4
https://example.com/video.mp4
```

## 🚀 How to Use

### Step 1: Paste Media URLs
Enter one or more media URLs in the textarea (one per line). Examples:
```
https://raw.githubusercontent.com/iptv-org/iptv/main/streams.m3u
https://gitlab.com/myuser/playlists/-/raw/main/channels.m3u8
https://example.com/media/playlist.m3u
```

### Step 2: Detect Repository (Optional)
Click **"Detect Repository (First URL)"** to test detection on the first URL without scraping.

This shows:
- Detected repository URL
- Repository type
- Confidence level
- Detection reasoning

### Step 3: Auto-Scrape All Repositories
Click **"Auto-Scrape All Repositories"** to:
1. Detect source repository for each URL
2. Automatically scrape entire repository
3. Extract all media files
4. Document everything

Progress updates show:
- Current URL being processed
- Files scanned
- Status messages

### Step 4: Review Results
Once complete, review:
- **Repository Count** - Number of unique repositories found
- **Total Media Links** - All discovered media across all repos
- **Per-Repository Details**:
  - Repository URL and type
  - Confidence level
  - Media count
  - Files scanned
  - Video/audio breakdown

### Step 5: Export Data
Choose your export format:
- **Export Report** - Detailed text report
- **Export Metadata (JSON)** - Structured data
- **Export Links** - Simple URL list
- **Export M3U Playlist** - Playable playlist file

## 🔍 Detection Examples

### Example 1: GitHub Raw URL
**Input:**
```
https://raw.githubusercontent.com/free-iptv/list/main/channels.m3u
```

**Detection:**
- Repository: `https://github.com/free-iptv/list`
- Type: GitHub
- Confidence: High
- Reason: "Media URL is from GitHub repository"

**Result:**
- Scrapes entire `free-iptv/list` repository
- Finds all M3U, M3U8, and config files
- Extracts ALL media links from repository

### Example 2: GitLab Raw URL
**Input:**
```
https://gitlab.com/myuser/streams/-/raw/master/iptv.m3u8
```

**Detection:**
- Repository: `https://gitlab.com/myuser/streams`
- Type: GitLab
- Confidence: High
- Reason: "Media URL is from GitLab repository"

**Result:**
- Scrapes entire GitLab repository
- Processes all supported file formats
- Extracts all media links

### Example 3: CDN with GitHub Source
**Input:**
```
https://cdn.jsdelivr.net/gh/user/repo@main/playlist.m3u
```

**Detection:**
- Repository: `https://github.com/user/repo`
- Type: GitHub
- Confidence: High
- Reason: "Media URL is served via jsDelivr CDN from GitHub"

**Result:**
- Traces back to GitHub repository
- Scrapes original repository
- Extracts all media

### Example 4: Generic Web Source
**Input:**
```
https://example.com/media/channels/playlist.m3u
```

**Detection:**
- Repository: `https://example.com/media/channels`
- Type: Web
- Confidence: Medium
- Reason: "Playlist file - will scan parent directory"

**Result:**
- Crawls website directory
- Follows related links
- Extracts discovered media

## 📊 Use Cases

### 1. **IPTV Aggregation**
- Paste IPTV playlist URLs
- Auto-discover source repositories
- Extract ALL playlists from repositories
- Get comprehensive channel lists

### 2. **Media Archive Discovery**
- Find media links in the wild
- Trace back to source repositories
- Discover related media collections
- Build comprehensive media libraries

### 3. **Repository Monitoring**
- Track multiple repository sources
- Automatically detect new media
- Monitor content changes
- Update media collections

### 4. **Bulk Repository Analysis**
- Process multiple URLs at once
- Deduplicate repositories
- Aggregate all media links
- Generate unified playlists

### 5. **Research & Documentation**
- Document media sources
- Track repository origins
- Maintain attribution
- Generate reports

## 🛠️ Advanced Features

### Batch Processing
- Process multiple URLs simultaneously
- Automatic repository deduplication
- Parallel scraping operations
- Progress tracking per URL

### Smart Detection
- Handles various URL formats
- Recognizes CDN patterns
- Infers repository structure
- Confidence scoring system

### Error Handling
- Graceful failure recovery
- Partial result preservation
- Detailed error messages
- Continues processing on error

### Rate Limiting
Built-in delays to respect server resources:
- 100ms between GitHub API requests
- 200ms between web crawl requests
- Respectful Robot.txt compliance

## 📋 Configuration

### Default Settings
- **Max Depth:** 3 levels for Git repositories
- **Max Pages:** 50 pages for web crawls
- **Max Depth (Web):** 2 levels
- **Rate Limit:** 100-200ms between requests

### Customization
Currently using default settings. Future versions may allow:
- Custom depth limits
- Rate limit adjustment
- Include/exclude patterns
- File type filters

## 🔒 Privacy & Security

### Data Processing
- **All processing is local** - No data sent to third parties
- **Direct API calls** - Connects directly to Git platforms
- **No tracking** - No usage analytics or telemetry
- **Open source** - All code is inspectable

### API Limits
- Uses public APIs only
- No authentication required
- Subject to platform rate limits
- GitHub: ~60 requests/hour (unauthenticated)

### Best Practices
1. Don't abuse repository owners' bandwidth
2. Respect platform rate limits
3. Use responsibly for legitimate purposes
4. Cache results to avoid repeated scraping

## ⚠️ Limitations

### Detection Accuracy
- **High Confidence** - Direct repository URLs (GitHub raw, GitLab raw)
- **Medium Confidence** - Inferred paths (CDN hints, parent directories)
- **Low Confidence** - Generic web sources, domain root fallback

### Platform Support
✅ **Fully Supported:**
- GitHub, GitLab, Bitbucket, Codeberg, Gitea

⚠️ **Partially Supported:**
- CDN sources (jsDelivr, UNPKG)
- Generic web servers with directory listings

❌ **Not Supported:**
- Private repositories (requires authentication)
- Password-protected websites
- Dynamic content (JavaScript-generated links)
- Streaming sources without file structure

### Scraping Limitations
- Cannot bypass authentication
- Cannot access private repositories
- Cannot process dynamically loaded content
- Limited to public, static content

## 📚 Technical Details

### Detection Algorithm
1. Parse media URL
2. Extract hostname and path
3. Match against known patterns:
   - Git platform patterns (github.com, gitlab.com, etc.)
   - CDN patterns (jsdelivr, unpkg)
   - File path patterns (.m3u, .m3u8, etc.)
4. Calculate confidence score
5. Generate repository URL
6. Return detection result

### Scraping Process
1. Determine repository type
2. Choose appropriate scraper:
   - **Git Repositories:** Use platform API to fetch file tree
   - **Web Sources:** Recursive web crawler with link following
   - **CDN:** Attempt directory listing or fallback to API
3. Process each file:
   - Check file extension
   - Download file content
   - Extract media links
   - Parse metadata
4. Aggregate results
5. Generate documentation

### File Processing
Supported file types:
- **Playlists:** M3U, M3U8, PLS, XSPF, ASX, WPL, B4S, ZPL, etc.
- **Config Files:** JSON, XML, properties, INI, conf
- **Archives:** ZIP, RAR, 7Z, TAR, GZ, BZ2
- **Android:** APK, AAB, XAPK, APKS, APKM, APEX, APKX
- **Kodi:** XSP, NFO, STRM, addon.xml, sources.xml, Python plugins
- **EPG:** Electronic Program Guide XML

## 🐛 Troubleshooting

### "No repository detected"
**Cause:** URL doesn't match known repository patterns.

**Solution:** 
- Check URL format
- Ensure URL contains repository hints
- Try direct repository URL instead

### "Unsupported repository type"
**Cause:** Platform not yet supported.

**Solution:**
- Check list of supported platforms
- Use generic web scraping (may have limited results)
- Request support for new platform

### "Repository does not expose directory listing"
**Cause:** CDN or web server doesn't provide file listings.

**Solution:**
- Try original repository URL
- Check if public API is available
- Manual repository URL input

### "Failed to fetch repository tree"
**Cause:** API rate limit, network error, or invalid repository.

**Solution:**
- Wait a few minutes (rate limit)
- Check internet connection
- Verify repository exists and is public
- Try again later

### Empty results
**Cause:** Repository contains no supported media files.

**Solution:**
- Check repository actually contains media
- Verify file extensions are supported
- Increase max depth if files are deeply nested

## 🔄 Future Enhancements

Planned features:
- [ ] Authentication support for private repositories
- [ ] Configurable scraping parameters
- [ ] Scheduled auto-scraping
- [ ] Change detection and notifications
- [ ] More CDN platform support
- [ ] Database storage for historical tracking
- [ ] API integration for programmatic access
- [ ] Browser extension integration
- [ ] Diff reports (what changed since last scrape)
- [ ] Auto-categorization of discovered media

## 📞 Support

### Common Questions

**Q: Can it access private repositories?**  
A: Not currently. Only public repositories are supported.

**Q: How often should I scrape?**  
A: Respect rate limits. Wait at least 1 hour between scrapes of the same repository.

**Q: Can I scrape my own repository?**  
A: Yes! Perfect for maintaining media collections.

**Q: Does it cost anything?**  
A: No. Uses free public APIs and local processing.

**Q: Is it legal?**  
A: Yes, for public repositories with proper attribution. Respect copyright and terms of service.

### Getting Help

1. Check this documentation
2. Review error messages
3. Check GitHub Issues
4. Submit bug report with:
   - URL that failed
   - Error message
   - Expected behavior
   - Actual behavior

## 📄 License

This feature is part of the Media Link Scanner project.  
Open source under the project license.

## 🙏 Acknowledgments

Built with:
- Link extraction engine
- Git platform APIs
- Web crawler system
- React and TypeScript
- Shadcn UI components

---

**Version:** 1.0.0  
**Last Updated:** February 18, 2026  
**Author:** Media Link Scanner Team
