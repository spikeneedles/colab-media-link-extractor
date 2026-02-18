# Pattern Repository Hub Documentation

## Overview

The Pattern Repository Hub is a comprehensive pattern sharing and management system for the Media Link Scanner. It allows users to create, share, discover, and fork scraping patterns, URL filters, pagination rules, provider presets, and crawling configurations.

## Features

### 🏗️ Pattern Management
- **Create Custom Patterns**: Build reusable patterns for URL filtering, web scraping, pagination, and more
- **Import/Export**: Share patterns as JSON files with the community
- **Version Control**: Track pattern versions and updates
- **Categorization**: Organize patterns by type (URL Filter, Scraping Rule, Pagination Rule, Provider Preset, Crawl Config)

### 📦 Repository System
- **Public Repositories**: Share your pattern collections with the community
- **Private Repositories**: Keep sensitive patterns private
- **Collaborative Features**: Multiple contributors can work on the same repository
- **Licensing**: Choose from MIT, Apache 2.0, GPL-3.0, BSD, or CC0 licenses

### 🌟 Social Features
- **Star Patterns**: Bookmark your favorite patterns for quick access
- **Fork Patterns**: Create your own versions of existing patterns
- **Download Tracking**: See how popular patterns are
- **Ratings & Reviews**: Community feedback on pattern quality

### 🔍 Discovery & Search
- **Advanced Search**: Find patterns by name, description, or tags
- **Category Filtering**: Filter by pattern type
- **Sorting Options**: Sort by recent, popular, stars, or downloads
- **Visibility Filters**: Show only public or private patterns

## Pattern Types

### 1. URL Filters
Regular expressions or string patterns that match specific URL formats.

**Example:**
```regex
/^https?:\/\/.+\.m3u8?$/
```

**Use Cases:**
- Match specific streaming protocols (HLS, DASH, RTMP)
- Filter by domain or provider
- Extract URLs with specific query parameters

### 2. Scraping Rules
JSON configuration for extracting media links from web pages.

**Example:**
```json
{
  "selector": ".video-link",
  "attribute": "href",
  "waitForSelector": true,
  "timeout": 5000
}
```

**Use Cases:**
- Extract video links from HTML
- Parse JSON responses
- Handle dynamic JavaScript content

### 3. Pagination Rules
Configuration for crawling multi-page content.

**Example:**
```json
{
  "nextButtonSelector": ".next-page",
  "maxPages": 10,
  "delay": 2000,
  "urlPattern": "https://example.com/page/{page}"
}
```

**Use Cases:**
- Crawl paginated IPTV lists
- Navigate through channel directories
- Process large playlists split across pages

### 4. Provider Presets
Complete provider configurations with URLs, authentication, and parsing rules.

**Example:**
```json
{
  "name": "Example IPTV Provider",
  "baseUrl": "https://provider.tv",
  "endpoints": {
    "playlists": "/api/playlists",
    "channels": "/api/channels"
  },
  "authentication": {
    "type": "bearer",
    "tokenEndpoint": "/auth/token"
  },
  "parsing": {
    "format": "m3u",
    "encoding": "utf-8"
  }
}
```

**Use Cases:**
- Quick setup for popular IPTV providers
- Xtream Codes configurations
- M3U playlist providers

### 5. Crawl Configurations
Settings for automated crawling tasks.

**Example:**
```json
{
  "startUrls": ["https://example.com"],
  "crawlRules": {
    "maxDepth": 3,
    "respectRobotsTxt": true,
    "userAgent": "MediaLinkScanner/1.0"
  },
  "extractionRules": {
    "linkSelectors": ["a[href*='.m3u']", "a[href*='stream']"]
  },
  "rateLimiting": {
    "requestsPerSecond": 2,
    "maxConcurrent": 5
  }
}
```

**Use Cases:**
- Automated repository scanning
- Bulk URL extraction
- Scheduled crawling tasks

## Creating Patterns

### Step 1: Choose Pattern Type
Select the appropriate category for your pattern:
- URL Filter: For matching specific URL patterns
- Scraping Rule: For extracting content from web pages
- Pagination Rule: For crawling multi-page content
- Provider Preset: For complete provider configurations
- Crawl Config: For automated crawling tasks

### Step 2: Define Pattern Content
Enter your pattern content based on the type:
- **Regex patterns** for URL filters
- **JSON objects** for scraping rules and configurations
- **JavaScript code** for advanced scraping logic

### Step 3: Add Metadata
- **Name**: Short, descriptive name
- **Description**: Detailed explanation of what the pattern does
- **Tags**: Keywords for discoverability (e.g., "m3u", "xtream", "hls")
- **Version**: Semantic versioning (e.g., "1.0.0")
- **Compatibility**: List of compatible applications (e.g., "VLC, Kodi")

### Step 4: Test with Examples
Provide example URLs that the pattern should match or process. This helps others understand how to use your pattern.

### Step 5: Set Visibility
Choose whether your pattern should be:
- **Public**: Visible to everyone, can be starred and forked
- **Private**: Only visible to you

## Creating Repositories

### Benefits of Repositories
- **Organization**: Group related patterns together
- **Collaboration**: Allow others to contribute
- **Distribution**: Share multiple patterns as a package
- **Documentation**: Include README and usage instructions

### Repository Structure
```
Repository Name
├── README.md          # Documentation and usage guide
├── LICENSE            # Open source license
├── patterns/
│   ├── url-filters/   # URL matching patterns
│   ├── scraping/      # Web scraping rules
│   ├── pagination/    # Multi-page crawling
│   ├── providers/     # Provider configurations
│   └── crawlers/      # Automated crawling configs
└── metadata.json      # Repository information
```

### Creating a Repository
1. **Click "Create Repository"**
2. **Enter basic information:**
   - Name (e.g., "iptv-providers")
   - Description
   - Tags (comma-separated)
3. **Choose visibility** (public/private)
4. **Select a license** (MIT, Apache, GPL, etc.)
5. **Add README** (optional, supports Markdown)

## Using Patterns

### Import from File
1. Click "Import Pattern"
2. Select a `.json` pattern file
3. Pattern is added to your collection

### Fork Existing Patterns
1. Browse community patterns
2. Click "Fork" on any pattern
3. Make modifications to your forked version
4. Share your improved version

### Star Favorites
- Click the star icon on any pattern
- Access starred patterns quickly
- Track popular patterns

### Apply to Scanner
1. Click "View" on a pattern
2. Review pattern details
3. Click "Use Pattern" to apply
4. Pattern is loaded into the appropriate scanner component

## Sharing Patterns

### Export as JSON
```json
{
  "id": "pattern-1234567890",
  "name": "Xtream Codes URL Filter",
  "description": "Matches Xtream Codes streaming URLs",
  "pattern": "/^https?:\\/\\/.+\\/(live|movie|series)\\/.+$/",
  "category": "url-filter",
  "version": "1.0.0",
  "tags": ["xtream", "iptv", "streaming"],
  "exampleUrls": [
    "http://provider.tv/live/username/password/12345.ts",
    "http://provider.tv/movie/username/password/12345.mp4"
  ],
  "compatibility": ["VLC", "Kodi", "IPTV Smarters"],
  "author": "Your Name"
}
```

### Share via Clipboard
1. Click "Share" on a pattern
2. Pattern data is copied to clipboard
3. Paste in chat, forum, or documentation
4. Others can import using "Import Pattern"

## Community Guidelines

### Creating Quality Patterns
- ✅ Test patterns thoroughly before sharing
- ✅ Provide clear descriptions and examples
- ✅ Use descriptive names and tags
- ✅ Document compatibility and requirements
- ✅ Keep patterns focused and simple

### Pattern Best Practices
- **Specificity**: Make patterns as specific as needed
- **Documentation**: Explain complex regex or logic
- **Examples**: Always include working examples
- **Versioning**: Update version numbers when making changes
- **Testing**: Verify patterns work before publishing

### Repository Guidelines
- Include comprehensive README
- Add examples and usage instructions
- Maintain organized structure
- Use appropriate license
- Respond to issues and feedback

## Advanced Features

### Pattern Dependencies
Some patterns may depend on others. Document dependencies in your pattern:

```json
{
  "dependencies": [
    "base-url-filter",
    "authentication-handler"
  ]
}
```

### Regex Pattern Examples

**Match M3U URLs:**
```regex
/^https?:\/\/.+\.m3u8?$/i
```

**Match Xtream Codes Live TV:**
```regex
/^https?:\/\/[^\/]+\/live\/[^\/]+\/[^\/]+\/\d+\.(ts|m3u8)$/
```

**Match HLS Streams:**
```regex
/^https?:\/\/.+\.m3u8(\?.*)?$/
```

**Match RTMP Streams:**
```regex
/^rtmp:\/\/.+$/
```

### JSON Scraping Rule Examples

**Basic Link Extraction:**
```json
{
  "selector": "a[href*='stream']",
  "attribute": "href",
  "multiple": true
}
```

**With JavaScript Wait:**
```json
{
  "waitForSelector": ".video-container",
  "timeout": 5000,
  "selector": "video source",
  "attribute": "src"
}
```

**Complex Extraction:**
```json
{
  "steps": [
    {"action": "click", "selector": ".show-more"},
    {"action": "wait", "duration": 2000},
    {"action": "extract", "selector": ".video-link", "attribute": "href"}
  ]
}
```

## API Integration

Patterns can be integrated programmatically:

```typescript
import { PatternRepository } from '@/components/PatternRepository'

// Use in your component
<PatternRepository 
  onImportPattern={(pattern) => {
    // Apply pattern to scanner
    console.log('Applying pattern:', pattern.name)
    // Use pattern.pattern, pattern.category, etc.
  }}
/>
```

## Data Storage

Patterns are stored locally using the Spark KV system:
- **my-patterns**: Your created and imported patterns
- **pattern-repositories**: Your repositories
- **starred-patterns**: IDs of patterns you've starred
- **forked-patterns**: IDs of patterns you've forked

All data persists between sessions and is stored securely in your browser.

## Future Enhancements

- 🌍 **Community Hub**: Central repository for sharing patterns
- 🔄 **Auto-Updates**: Automatic pattern updates from repositories
- 📊 **Analytics**: Track pattern usage and effectiveness
- 🤖 **AI Generation**: Gemini-powered pattern generation
- 🔐 **Authentication**: User accounts for tracking contributions
- 💬 **Comments**: Discuss patterns with the community
- 🏆 **Leaderboards**: Top contributors and most popular patterns
- 📦 **NPM Integration**: Publish patterns as npm packages

## Troubleshooting

### Pattern Not Working
1. Check pattern syntax (regex, JSON)
2. Verify compatibility with target site
3. Test with example URLs
4. Check browser console for errors

### Import Failed
1. Verify JSON file is valid
2. Check pattern structure matches expected format
3. Ensure all required fields are present

### Repository Not Saving
1. Check browser storage permissions
2. Clear browser cache if needed
3. Export patterns as backup before troubleshooting

## Support

For issues, questions, or contributions:
- Review pattern examples in the documentation
- Test patterns with provided example URLs
- Check community patterns for similar use cases
- Fork and modify existing patterns as starting points

## License

Patterns shared in public repositories follow their specified licenses. Always respect the license terms when using or modifying patterns.

---

**Happy Pattern Sharing! 🎉**
