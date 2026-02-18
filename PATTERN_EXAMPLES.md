# Pattern Generator - Usage Examples

## Example 1: Filter Specific IPTV Provider

### Scenario
You want to match only URLs from "provider.tv" that serve TS streams.

### Step 1: Add Matching Examples
```
✅ http://provider.tv:8080/live/user123/pass456/12345.ts
✅ http://provider.tv:8080/live/user123/pass456/67890.ts
✅ http://provider.tv:8080/live/demo/demo/99999.ts
```

### Step 2: Add Non-Matching Examples
```
❌ http://other-provider.com/stream.m3u8
❌ http://provider.tv:8080/vod/movie.mp4
❌ https://different-site.tv/live/stream.ts
```

### Step 3: Generate Pattern

**Rule-Based Result:**
```regex
^http://provider\.tv:8080/live/[^/]+/[^/]+/\d+\.ts$
```

**Confidence:** 100%

**Description:** Matches URLs with http protocol, domain provider.tv, port 8080, ts extension

**Test URLs:**
```
http://provider.tv:8080/live/newuser/newpass/11111.ts  → ✅ Match
http://provider.tv/live/user/pass/12345.ts             → ❌ No Match (missing port)
http://provider.tv:8080/live/12345.ts                  → ❌ No Match (wrong path structure)
```

---

## Example 2: Match HD Quality Streams

### Scenario
You want to match only HD/1080p/720p streams from any provider.

### Step 1: Add Matching Examples
```
✅ http://cdn.com/stream_1080p.m3u8
✅ http://cdn.com/channel_720p_HD.m3u8
✅ https://other-cdn.net/HD_movie_1080p.m3u8
✅ http://provider.tv/HD/stream.ts
```

### Step 2: Add Non-Matching Examples
```
❌ http://cdn.com/stream_480p.m3u8
❌ http://cdn.com/SD_channel.m3u8
❌ http://provider.tv/stream.ts
```

### Step 3: Generate Pattern

**AI-Assisted Result (with context: "Match only HD quality streams"):**
```regex
^https?://[^/]+/.*(?:1080p|720p|HD).*\.(?:m3u8|ts)$
```

**Confidence:** 86%

**Description:** Matches URLs with http or https protocol, containing 1080p, 720p, or HD in the path, with m3u8 or ts extension

**Suggestions:**
- Pattern may match URLs with HD/1080p/720p in domain name
- Consider adding more examples with quality indicators in different positions

**Test URLs:**
```
http://cdn.com/HD_sports_720p.m3u8      → ✅ Match
https://stream.net/movie_1080p_HD.ts    → ✅ Match
http://cdn.com/SD_movie_480p.m3u8       → ❌ No Match
http://hd-provider.com/lowquality.m3u8  → ❌ No Match (HD in domain, not path)
```

---

## Example 3: Match RTMP Streams Only

### Scenario
You want to match RTMP/RTMPS streams regardless of domain.

### Step 1: Add Matching Examples
```
✅ rtmp://live.server.com/app/stream
✅ rtmps://secure.server.com:443/live/channel
✅ rtmp://stream.tv:1935/vod/movie
```

### Step 2: Add Non-Matching Examples
```
❌ http://server.com/stream.m3u8
❌ https://server.com/video.mp4
❌ hls://server.com/playlist.m3u8
```

### Step 3: Generate Pattern

**Rule-Based Result:**
```regex
^rtmps?://[^/]+(?::[0-9]+)?/.*$
```

**Confidence:** 100%

**Description:** Matches URLs with rtmp or rtmps protocol

**Pattern Explanation:**
```
^           - Start of string
rtmps?      - Match "rtmp" or "rtmps"
://         - Protocol separator
[^/]+       - One or more non-slash characters (domain)
(?::[0-9]+)?- Optional port (like :443 or :1935)
/           - Path separator
.*          - Any path
$           - End of string
```

---

## Example 4: Provider-Specific with Authentication

### Scenario
Match URLs from a specific provider that include authentication credentials.

### Step 1: Add Matching Examples
```
✅ http://user:pass@provider.tv/stream.m3u8
✅ http://demo:demo@provider.tv/live/channel.ts
✅ http://trial:trial123@provider.tv/vod/movie.mp4
```

### Step 2: Add Non-Matching Examples
```
❌ http://provider.tv/stream.m3u8
❌ http://user:pass@other-provider.com/stream.m3u8
```

### Step 3: Generate Pattern

**AI-Assisted Result:**
```regex
^http://[^:]+:[^@]+@provider\.tv/.*\.(?:m3u8|ts|mp4)$
```

**Confidence:** 100%

**Description:** Matches URLs with http protocol, authentication credentials, domain provider.tv, with m3u8, ts, or mp4 extension

**Optimized Version:**
```regex
^http://\w+:\w+@provider\.tv/.*\.(?:m3u8|ts|mp4)$
```

**Improvements Made:**
- Replaced `[^:]+` with `\w+` for username (more specific)
- Replaced `[^@]+` with `\w+` for password (more specific)

---

## Example 5: Complex Multi-Parameter URLs

### Scenario
Match Xtream Codes API URLs with specific parameters.

### Step 1: Add Matching Examples
```
✅ http://provider.tv/live/username/password/12345.ts
✅ http://provider.tv/movie/username/password/67890.mp4
✅ http://provider.tv/series/username/password/99999.mkv
```

### Step 2: Add Non-Matching Examples
```
❌ http://provider.tv/live/12345.ts
❌ http://other-provider.com/live/user/pass/12345.ts
```

### Step 3: Generate Pattern with Context

**Context:** "Match Xtream Codes API URLs from provider.tv with username/password authentication"

**AI-Assisted Result:**
```regex
^http://provider\.tv/(?:live|movie|series)/[^/]+/[^/]+/\d+\.(?:ts|mp4|mkv)$
```

**Confidence:** 100%

**Description:** Matches Xtream Codes API format URLs from provider.tv with live, movie, or series content types, including username and password authentication

**Pattern Breakdown:**
```
^                              - Start
http://provider\.tv           - Specific provider
/(?:live|movie|series)        - Content type (non-capturing group)
/[^/]+                         - Username
/[^/]+                         - Password
/\d+                           - Stream ID (digits only)
\.(?:ts|mp4|mkv)              - File extension
$                              - End
```

---

## Example 6: Cross-Provider Pattern

### Scenario
Match M3U8 streams from multiple CDN providers that share similar URL structures.

### Step 1: Add Matching Examples
```
✅ http://cdn1.provider.com/hls/stream.m3u8
✅ http://cdn2.provider.com/hls/channel.m3u8
✅ http://cdn3.provider.net/hls/live.m3u8
✅ http://cdn-east.provider.org/hls/vod.m3u8
```

### Step 2: Add Non-Matching Examples
```
❌ http://cdn1.provider.com/dash/stream.mpd
❌ http://other-cdn.different.com/hls/stream.m3u8
```

### Step 3: Generate Pattern

**Rule-Based Result:**
```regex
^http://cdn[^.]*\.provider\.(?:com|net|org)/hls/[^/]+\.m3u8$
```

**Confidence:** 88%

**Description:** Matches URLs with http protocol, CDN subdomain, domain starting with provider, HLS path, m3u8 extension

**Suggestions:**
- Pattern matches CDN subdomains but may be too specific
- Consider if you want to match other subdomain patterns

**Test URLs:**
```
http://cdn4.provider.com/hls/new.m3u8        → ✅ Match
http://cdn-west.provider.net/hls/test.m3u8   → ✅ Match
http://cdn1.provider.com/hls/stream.ts       → ❌ No Match (wrong extension)
http://cdn1.different.com/hls/stream.m3u8    → ❌ No Match (wrong domain)
```

---

## Tips for Better Patterns

### 1. Start Simple
Begin with 3-5 matching examples and 2-3 non-matching examples.

### 2. Add Diversity
Include examples with:
- Different paths
- Different subdomains
- Different query parameters
- Different ports

### 3. Use AI for Complex Patterns
Enable AI mode when:
- URLs have complex structures
- Multiple providers with subtle differences
- Need contextual understanding
- Trying to match semantic patterns

### 4. Test Thoroughly
After generating a pattern:
1. Test with known good URLs
2. Test with known bad URLs
3. Test edge cases
4. Verify confidence score

### 5. Iterate and Refine
If confidence < 80%:
- Add more examples
- Add non-matching examples
- Simplify URL structure
- Use AI mode with context

### 6. Optimize Before Using
Always run optimization:
- Removes redundancy
- Simplifies expressions
- Improves performance
- Makes pattern more readable

---

## Common Patterns Reference

### Match Any HTTP/HTTPS URL
```regex
^https?://.*$
```

### Match Specific File Extensions
```regex
^.*\.(?:m3u8|ts|mp4|mkv)$
```

### Match URLs with Port
```regex
^https?://[^:]+:[0-9]+/.*$
```

### Match URLs with Authentication
```regex
^https?://[^:]+:[^@]+@.*$
```

### Match Specific Domain
```regex
^https?://(?:www\.)?example\.com/.*$
```

### Match Subdomain Pattern
```regex
^https?://[^.]+\.example\.com/.*$
```

### Match Path with Specific Segment
```regex
^https?://[^/]+/live/.*$
```

### Match Query Parameter
```regex
^.*\?.*token=[^&]+.*$
```

---

## Integration Examples

### Use with Protocol Filters

1. Generate pattern for provider
2. Copy regex to clipboard
3. Open Protocol Filters
4. Paste into "Custom URL Pattern"
5. Apply filter to scan results

### Use with Crawlers

1. Generate pattern for target site
2. Copy regex
3. Open Crawler Manager
4. Add new target
5. Set URL pattern filter
6. Start crawler

### Use with Bulk Playlist Generator

1. Generate patterns for each category
2. Create filter configurations
3. Apply patterns to categorize links
4. Generate separate playlists
5. Export with custom names

---

## Troubleshooting

### Pattern Too Broad (Matches Too Much)

**Problem:** Pattern matches URLs you don't want

**Solution:**
- Add more non-matching examples
- Be more specific with domain patterns
- Include file extension requirements
- Add path structure requirements

### Pattern Too Narrow (Misses Valid URLs)

**Problem:** Pattern doesn't match URLs you want

**Solution:**
- Add more matching examples
- Use looser strictness setting
- Make components optional: `(?:...)?`
- Use broader character classes

### Low Confidence Score

**Problem:** Pattern confidence < 80%

**Solution:**
- Add 5+ matching examples
- Add 3+ non-matching examples
- Ensure examples are representative
- Try AI mode with context

### Pattern Doesn't Work in Practice

**Problem:** Pattern works in generator but not in real use

**Solution:**
- Test with actual URLs from your source
- Check for URL encoding issues
- Verify regex flavor compatibility
- Add more real-world examples
