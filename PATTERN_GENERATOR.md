# AI-Powered Pattern Generation

The Media Link Scanner now includes an intelligent pattern generation system that learns from example URLs to create custom regex patterns for filtering and matching specific streaming sources.

## Features

### 🤖 Dual-Mode Pattern Generation

- **Rule-Based Mode**: Fast, deterministic pattern generation using URL structure analysis
- **AI-Assisted Mode**: Powered by Gemini 2.0 Flash for smarter, context-aware patterns

### 📚 Learning from Examples

Add URLs and mark them as:
- ✅ **Should Match** (positive examples)
- ❌ **Should NOT Match** (negative examples)

The system analyzes:
- Common protocols (HTTP, HTTPS, RTMP, RTSP, etc.)
- Domain patterns and TLDs
- Path structures and common segments
- File extensions (M3U8, TS, MP4, etc.)
- Query parameters and authentication
- Port specifications

### 🎯 Intelligent Analysis

The pattern generator automatically detects:
- Authentication patterns (username:password@)
- Port usage and common port numbers
- Path hierarchies and common segments
- File extension patterns
- Query parameter structures
- URL fragments

### 📊 Confidence Scoring

Each generated pattern includes:
- **Confidence Score**: 0-100% based on how well it matches examples
- **Visual Feedback**: Green (80%+), Yellow (60-80%), Red (<60%)
- **Improvement Suggestions**: Tips to increase accuracy

### 🧪 Pattern Testing

Test your pattern against new URLs:
- Add test URLs line-by-line
- See which ones match/don't match
- Identify edge cases before deploying

### ⚡ Pattern Optimization

Automatically optimize patterns by:
- Removing redundant expressions
- Simplifying character classes
- Replacing verbose patterns with shortcuts
- Removing unnecessary escapes

### 📖 Pattern Explanation

Get human-readable explanations:
- Overall pattern description
- Breakdown of each regex component
- Plain English for each part
- Context-aware explanations

## How to Use

### Basic Usage

1. **Add Example URLs**
   ```
   Add URL: http://provider.com/channel.m3u8
   Mark as: ✅ Should Match
   ```

2. **Add Counter Examples** (optional but recommended)
   ```
   Add URL: http://different-site.com/video.mp4
   Mark as: ❌ Should NOT Match
   ```

3. **Generate Pattern**
   - Click "Generate Pattern"
   - Review confidence score
   - Check suggestions

4. **Test & Refine**
   - Add test URLs
   - Verify matches
   - Optimize if needed

### AI-Assisted Mode

Enable AI mode for smarter patterns:

```
☑ Use AI for smarter pattern generation

Context (optional):
"Match all M3U8 streams from provider.com 
that include 'HD' or '1080p' in the path"
```

The AI considers:
- Your natural language context
- URL patterns and relationships
- Streaming protocol conventions
- Provider-specific structures

### Example Patterns

**Match all M3U8 streams from a specific provider:**
```regex
^https?://(?:www\.)?provider\.com/.*\.m3u8(?:\?[^#]*)?$
```

**Match RTMP streams with specific ports:**
```regex
^rtmp://[^:]+:(?:1935|1936)/live/.*$
```

**Match HLS streams with quality indicators:**
```regex
^https?://[^/]+/.*(?:720p|1080p|HD).*\.m3u8$
```

## Integration with Protocol Filters

Generated patterns can be used directly in:
- Protocol Filters (URL Pattern section)
- Custom scraping rules
- Bulk playlist generation filters
- Crawler target specifications

## Advanced Features

### URL Structure Analysis

The system analyzes and extracts:
- **Protocols**: HTTP, HTTPS, RTMP, RTSP, RTP, UDP, MMS
- **Domains**: Full hostname or pattern-based
- **Ports**: Specific ports or ranges
- **Paths**: Common segments and structures
- **Extensions**: Media file types
- **Query Params**: Common parameters
- **Auth Patterns**: Credential structures

### Common Substring Detection

Finds repeated patterns across examples:
- Minimum 3 characters
- Appears in 50%+ of examples
- Filters nested/overlapping matches
- Prioritizes longer strings

### Pattern Confidence Calculation

```
Confidence = (Correct Matches + Correct Non-Matches) / Total Examples × 100
```

Where:
- **Correct Matches**: Pattern matches all positive examples
- **Correct Non-Matches**: Pattern rejects all negative examples
- **Total Examples**: All provided examples

## Best Practices

### ✅ Do

- Provide at least 3-5 matching examples
- Add 2-3 non-matching examples for better precision
- Use AI mode for complex provider-specific patterns
- Test patterns before using in production
- Optimize patterns after generation

### ❌ Don't

- Use only 1-2 examples (low confidence)
- Skip non-matching examples (over-matching risk)
- Ignore confidence scores below 80%
- Copy patterns without testing
- Use patterns with errors

## Pattern Examples by Use Case

### IPTV Provider Filtering

**Match specific provider's streams:**
```
Matching Examples:
✅ http://provider.tv:8080/live/user/pass/12345.ts
✅ http://provider.tv:8080/live/user/pass/67890.ts

Non-Matching:
❌ http://other-provider.com/stream.m3u8
❌ http://provider.tv:8080/vod/movie.mp4

Generated Pattern:
^http://provider\.tv:8080/live/[^/]+/[^/]+/\d+\.ts$
```

### Quality-Based Filtering

**Match only HD streams:**
```
Matching Examples:
✅ http://cdn.com/stream_1080p.m3u8
✅ http://cdn.com/channel_720p_HD.m3u8

Non-Matching:
❌ http://cdn.com/stream_480p.m3u8
❌ http://cdn.com/channel_SD.m3u8

Generated Pattern:
^https?://[^/]+/.*(?:720p|1080p|HD).*\.m3u8$
```

### Protocol-Specific Filtering

**Match RTMP streams only:**
```
Matching Examples:
✅ rtmp://live.server.com/app/stream
✅ rtmps://secure.server.com:443/live/channel

Non-Matching:
❌ http://server.com/stream.m3u8
❌ https://server.com/video.mp4

Generated Pattern:
^rtmps?://[^/]+(?::[0-9]+)?/.*$
```

## API Reference

### `generatePatternFromExamples(examples, options)`

Generate pattern using rule-based algorithm.

**Parameters:**
- `examples`: Array of `{ url: string, shouldMatch: boolean }`
- `options`: Configuration object
  - `strictness`: 'loose' | 'medium' | 'strict' (default: 'medium')
  - `includeProtocol`: boolean (default: true)
  - `includeDomain`: boolean (default: true)
  - `includePath`: boolean (default: true)
  - `includeQuery`: boolean (default: false)

**Returns:** `GeneratedPattern` object

### `generatePatternWithAI(examples, context)`

Generate pattern using AI assistance.

**Parameters:**
- `examples`: Array of `{ url: string, shouldMatch: boolean }`
- `context`: Optional string describing the matching criteria

**Returns:** `Promise<GeneratedPattern>`

### `testPattern(regex, testUrls)`

Test a pattern against URLs.

**Parameters:**
- `regex`: Regex pattern string
- `testUrls`: Array of URLs to test

**Returns:** Array of test results with match status

### `optimizePattern(regex)`

Optimize a regex pattern.

**Parameters:**
- `regex`: Regex pattern string

**Returns:** Optimized pattern and list of improvements

### `explainPattern(regex)`

Get human-readable explanation.

**Parameters:**
- `regex`: Regex pattern string

**Returns:** Pattern breakdown with explanations

## Troubleshooting

### Low Confidence Score

**Problem**: Pattern has <80% confidence

**Solutions:**
- Add more matching examples (aim for 5+)
- Add non-matching examples for contrast
- Use AI mode for complex patterns
- Simplify URL structure expectations

### Pattern Too Broad

**Problem**: Pattern matches unwanted URLs

**Solutions:**
- Add non-matching examples
- Enable stricter options
- Manually refine the pattern
- Be more specific with examples

### Pattern Too Narrow

**Problem**: Pattern misses valid URLs

**Solutions:**
- Add more diverse matching examples
- Use looser strictness setting
- Check for optional URL components
- Review pattern explanation

### AI Mode Not Working

**Problem**: AI generation fails

**Solutions:**
- Ensure internet connection
- Check if examples are valid URLs
- Provide clearer context description
- Falls back to rule-based mode automatically

## Future Enhancements

Planned features for future releases:

- 📊 **Pattern Library**: Save and reuse common patterns
- 🔄 **Pattern Sharing**: Import/export pattern configurations
- 📈 **Usage Analytics**: Track which patterns work best
- 🎓 **Learning Mode**: Improve patterns based on validation results
- 🔗 **Pattern Chaining**: Combine multiple patterns with logic
- 🌐 **Multi-Language Support**: Context in multiple languages
- 📱 **Mobile Optimization**: Better mobile pattern editing

## Contributing

Found a bug or have a suggestion? Please open an issue on GitHub with:
- Example URLs that cause problems
- Expected vs actual pattern behavior
- Steps to reproduce
- Confidence scores and suggestions shown

---

**Related Documentation:**
- [Protocol Filters](../src/lib/protocolFilters.ts)
- [URL Validator](../src/lib/urlValidator.ts)
- [Gemini Assistant](../src/lib/geminiAssistant.ts)
