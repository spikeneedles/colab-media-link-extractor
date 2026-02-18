# Sample Pattern Library

This directory contains sample patterns to help you get started with the Pattern Repository Hub.

## URL Filter Patterns

### 1. M3U Playlist Filter
```json
{
  "name": "M3U Playlist URLs",
  "description": "Matches M3U and M3U8 playlist files",
  "pattern": "/^https?:\\/\\/.+\\.m3u8?$/i",
  "category": "url-filter",
  "tags": ["m3u", "playlist", "streaming"],
  "exampleUrls": [
    "http://example.com/playlist.m3u",
    "https://provider.tv/streams/channel.m3u8"
  ],
  "compatibility": ["VLC", "Kodi", "IPTV Smarters", "TiviMate"]
}
```

### 2. Xtream Codes Filter
```json
{
  "name": "Xtream Codes Stream URLs",
  "description": "Matches Xtream Codes API streaming URLs for live TV, movies, and series",
  "pattern": "/^https?:\\/\\/[^\\/]+\\/(live|movie|series)\\/[^\\/]+\\/[^\\/]+\\/\\d+\\.(ts|m3u8|mp4|mkv)$/",
  "category": "url-filter",
  "tags": ["xtream", "iptv", "api"],
  "exampleUrls": [
    "http://provider.tv/live/username/password/12345.ts",
    "http://provider.tv/movie/username/password/67890.mp4",
    "http://provider.tv/series/username/password/11111.mkv"
  ],
  "compatibility": ["Xtream-compatible players"]
}
```

### 3. HLS Stream Filter
```json
{
  "name": "HLS Streaming URLs",
  "description": "Matches HTTP Live Streaming (HLS) URLs with optional query parameters",
  "pattern": "/^https?:\\/\\/.+\\.m3u8(\\?.*)?$/",
  "category": "url-filter",
  "tags": ["hls", "m3u8", "streaming", "apple"],
  "exampleUrls": [
    "https://stream.provider.com/live/channel.m3u8",
    "https://cdn.example.com/stream.m3u8?token=abc123"
  ],
  "compatibility": ["All HLS-compatible players"]
}
```

### 4. RTMP Stream Filter
```json
{
  "name": "RTMP Protocol URLs",
  "description": "Matches Real-Time Messaging Protocol streaming URLs",
  "pattern": "/^rtmp:\\/\\/.+$/",
  "category": "url-filter",
  "tags": ["rtmp", "flash", "streaming", "real-time"],
  "exampleUrls": [
    "rtmp://live.example.com/live/stream",
    "rtmp://server.tv:1935/live/channel"
  ],
  "compatibility": ["VLC", "FFmpeg", "OBS"]
}
```

### 5. DASH Manifest Filter
```json
{
  "name": "DASH Manifest URLs",
  "description": "Matches MPEG-DASH manifest files (.mpd)",
  "pattern": "/^https?:\\/\\/.+\\.mpd(\\?.*)?$/",
  "category": "url-filter",
  "tags": ["dash", "mpd", "mpeg-dash", "adaptive"],
  "exampleUrls": [
    "https://cdn.example.com/stream.mpd",
    "https://provider.tv/manifest.mpd?quality=hd"
  ],
  "compatibility": ["DASH.js", "ExoPlayer", "Shaka Player"]
}
```

## Scraping Rule Patterns

### 6. Generic Video Link Extractor
```json
{
  "name": "Video Link Scraper",
  "description": "Extracts video source URLs from HTML pages",
  "pattern": {
    "selector": "video source, a[href*='video'], a[href*='stream']",
    "attribute": "src|href",
    "multiple": true,
    "filters": ["mp4", "m3u8", "mkv", "avi"]
  },
  "category": "scraping-rule",
  "tags": ["scraping", "video", "html"],
  "exampleUrls": ["https://example.com/videos"]
}
```

### 7. JSON API Playlist Extractor
```json
{
  "name": "JSON Playlist Parser",
  "description": "Extracts playlist URLs from JSON API responses",
  "pattern": {
    "type": "json",
    "path": "$.channels[*].stream_url",
    "method": "GET",
    "headers": {
      "Accept": "application/json"
    }
  },
  "category": "scraping-rule",
  "tags": ["json", "api", "playlist"],
  "exampleUrls": ["https://api.provider.com/channels"]
}
```

### 8. Dynamic Content Scraper
```json
{
  "name": "JavaScript-Heavy Page Scraper",
  "description": "Extracts links from pages with dynamic JavaScript content",
  "pattern": {
    "waitForSelector": ".video-container",
    "timeout": 10000,
    "executeScript": "() => Array.from(document.querySelectorAll('.stream-link')).map(el => el.href)",
    "delay": 2000
  },
  "category": "scraping-rule",
  "tags": ["javascript", "dynamic", "spa", "puppeteer"],
  "exampleUrls": ["https://dynamic-site.com/channels"]
}
```

## Pagination Rule Patterns

### 9. Next Button Pagination
```json
{
  "name": "Next Button Crawler",
  "description": "Follows 'Next' button through paginated content",
  "pattern": {
    "nextButtonSelector": ".next-page, a[rel='next']",
    "maxPages": 50,
    "delay": 1000,
    "stopCondition": "!document.querySelector('.next-page')"
  },
  "category": "pagination-rule",
  "tags": ["pagination", "next-button", "crawling"],
  "exampleUrls": ["https://example.com/channels?page=1"]
}
```

### 10. URL Pattern Pagination
```json
{
  "name": "Numbered Page Crawler",
  "description": "Crawls pages with numbered URL patterns",
  "pattern": {
    "urlPattern": "https://example.com/channels?page={page}",
    "startPage": 1,
    "maxPages": 100,
    "stopOnEmpty": true,
    "delay": 1500
  },
  "category": "pagination-rule",
  "tags": ["pagination", "url-pattern", "numbered"],
  "exampleUrls": ["https://example.com/channels?page=1"]
}
```

### 11. Load More Button
```json
{
  "name": "Load More Button Handler",
  "description": "Clicks 'Load More' button to load additional content",
  "pattern": {
    "buttonSelector": ".load-more, button[data-action='load-more']",
    "maxClicks": 20,
    "waitAfterClick": 2000,
    "stopWhenDisabled": true
  },
  "category": "pagination-rule",
  "tags": ["pagination", "load-more", "infinite-scroll"],
  "exampleUrls": ["https://example.com/playlists"]
}
```

## Provider Preset Patterns

### 12. IPTV-Org Provider
```json
{
  "name": "IPTV-Org GitHub Repository",
  "description": "Complete preset for scanning the IPTV-Org GitHub repository",
  "pattern": {
    "provider": "iptv-org",
    "baseUrl": "https://iptv-org.github.io/iptv",
    "endpoints": {
      "index": "/index.m3u",
      "countries": "/index.country.m3u",
      "languages": "/index.language.m3u",
      "categories": "/index.category.m3u"
    },
    "format": "m3u",
    "encoding": "utf-8",
    "updateFrequency": "daily"
  },
  "category": "provider-preset",
  "tags": ["iptv-org", "github", "free-iptv"],
  "exampleUrls": ["https://iptv-org.github.io/iptv/index.m3u"]
}
```

### 13. Xtream Codes Provider Template
```json
{
  "name": "Xtream Codes API Template",
  "description": "Generic template for Xtream Codes IPTV providers",
  "pattern": {
    "provider": "xtream-codes",
    "authType": "basic",
    "endpoints": {
      "authenticate": "/player_api.php?username={username}&password={password}",
      "live": "/player_api.php?username={username}&password={password}&action=get_live_streams",
      "vod": "/player_api.php?username={username}&password={password}&action=get_vod_streams",
      "series": "/player_api.php?username={username}&password={password}&action=get_series"
    },
    "streamFormat": "/{type}/{username}/{password}/{stream_id}.{extension}",
    "supportedExtensions": ["ts", "m3u8", "mp4", "mkv"]
  },
  "category": "provider-preset",
  "tags": ["xtream-codes", "api", "template"],
  "exampleUrls": ["http://provider.tv:8080/player_api.php"]
}
```

### 14. Free-IPTV GitHub
```json
{
  "name": "Free-IPTV Repository",
  "description": "Preset for scanning the Free-IPTV GitHub repository",
  "pattern": {
    "provider": "free-iptv",
    "type": "github",
    "repository": "Free-IPTV/Free-IPTV",
    "branch": "main",
    "paths": [
      "playlist/m3u",
      "playlist/txt"
    ],
    "fileTypes": [".m3u", ".m3u8", ".txt"],
    "updateFrequency": "weekly"
  },
  "category": "provider-preset",
  "tags": ["free-iptv", "github", "open-source"],
  "exampleUrls": ["https://github.com/Free-IPTV/Free-IPTV"]
}
```

## Crawl Configuration Patterns

### 15. Repository Scanner
```json
{
  "name": "GitHub Repository Scanner",
  "description": "Comprehensive configuration for scanning GitHub repositories for media links",
  "pattern": {
    "startUrls": ["{repository_url}"],
    "crawlRules": {
      "maxDepth": 3,
      "respectRobotsTxt": false,
      "followRedirects": true,
      "userAgent": "MediaLinkScanner/1.0",
      "timeout": 30000
    },
    "extractionRules": {
      "fileExtensions": [".m3u", ".m3u8", ".txt", ".json", ".xml"],
      "linkPatterns": [
        "a[href*='.m3u']",
        "a[href*='stream']",
        "a[href*='playlist']"
      ]
    },
    "rateLimiting": {
      "requestsPerSecond": 2,
      "maxConcurrent": 5,
      "retryAttempts": 3
    },
    "dataExtraction": {
      "parseM3U": true,
      "parseJSON": true,
      "parseXML": true
    }
  },
  "category": "crawl-config",
  "tags": ["github", "repository", "crawler", "automation"],
  "exampleUrls": ["https://github.com/iptv-org/iptv"]
}
```

### 16. Website Crawler
```json
{
  "name": "Website Media Link Crawler",
  "description": "General-purpose website crawler for extracting media links",
  "pattern": {
    "startUrls": ["{website_url}"],
    "crawlRules": {
      "maxDepth": 2,
      "maxPages": 100,
      "respectRobotsTxt": true,
      "allowedDomains": ["{domain}"],
      "excludePatterns": ["/login", "/admin", "/user"]
    },
    "extractionRules": {
      "selectors": [
        "a[href$='.m3u']",
        "a[href$='.m3u8']",
        "video source",
        "iframe[src*='stream']"
      ],
      "attributes": ["href", "src", "data-src"]
    },
    "rateLimiting": {
      "delayBetweenRequests": 1000,
      "maxConcurrent": 3
    }
  },
  "category": "crawl-config",
  "tags": ["website", "crawler", "general-purpose"],
  "exampleUrls": ["https://example.com"]
}
```

### 17. Scheduled Crawler
```json
{
  "name": "Scheduled Daily Crawler",
  "description": "Automated crawler that runs on a daily schedule",
  "pattern": {
    "schedule": {
      "frequency": "daily",
      "time": "02:00",
      "timezone": "UTC"
    },
    "targets": [
      "https://iptv-org.github.io/iptv",
      "https://github.com/Free-IPTV/Free-IPTV"
    ],
    "crawlRules": {
      "maxDepth": 2,
      "timeout": 60000
    },
    "notifications": {
      "onComplete": true,
      "onError": true,
      "sound": "chime"
    },
    "storage": {
      "saveResults": true,
      "format": "json",
      "path": "/crawl-results"
    }
  },
  "category": "crawl-config",
  "tags": ["scheduled", "automation", "daily", "cron"],
  "exampleUrls": ["N/A - Automated scheduler"]
}
```

## How to Use These Samples

1. **Copy the JSON** from any pattern above
2. **Create a new file** with the pattern content
3. **Import into the Pattern Repository** using the "Import Pattern" button
4. **Customize** as needed for your specific use case
5. **Test** with the provided example URLs
6. **Share** your improved versions with the community

## Contributing Your Own Patterns

We encourage you to create and share your own patterns! Follow these guidelines:

1. **Test thoroughly** before sharing
2. **Document clearly** with examples
3. **Use appropriate tags** for discoverability
4. **Specify compatibility** with applications
5. **Include example URLs** that work
6. **Version your patterns** semantically

## Pattern Combinations

Many workflows require combining multiple patterns:

**Example: Complete IPTV Provider Scan**
1. Use **Provider Preset** to connect to API
2. Apply **URL Filter** to match stream formats
3. Use **Scraping Rule** to extract metadata
4. Apply **Pagination Rule** for large lists
5. Use **Crawl Config** for automated updates

## License

These sample patterns are provided under CC0 1.0 Universal (Public Domain). Feel free to use, modify, and share without restriction.

---

**Happy Pattern Creation! 🚀**
