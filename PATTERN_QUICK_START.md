# Quick Start: AI Pattern Generator

Get started with the AI-powered pattern generator in 5 minutes!

## What is it?

The Pattern Generator learns from example URLs to create custom regex patterns. No regex knowledge required!

## When to Use It

✅ **Use Pattern Generator when you want to:**
- Filter URLs from specific IPTV providers
- Match only HD/4K quality streams
- Create custom protocol filters
- Extract URLs matching specific patterns
- Build provider-specific playlists

❌ **Don't use it when:**
- You want to match ALL URLs (use Protocol Filters instead)
- You only have 1-2 example URLs
- URLs have completely random structures

## Quick Start Guide

### Step 1: Navigate to Pattern Generator (5 seconds)

Scroll down to the **"AI Pattern Generator"** section in the app.

### Step 2: Add Matching Examples (30 seconds)

Add 3-5 URLs that **SHOULD match** your pattern:

```
Example: Filter provider.tv streams

1. Type or paste URL: http://provider.tv/stream1.m3u8
2. Ensure green ✓ button is selected
3. Click + button
4. Repeat for more examples
```

### Step 3: Add Non-Matching Examples (30 seconds)

Add 2-3 URLs that **SHOULD NOT match** your pattern:

```
1. Type or paste URL: http://different-site.com/stream.m3u8
2. Click red ✗ button
3. Click + button
4. Repeat for more examples
```

### Step 4: Generate Pattern (2 seconds)

Click **"Generate Pattern"** button and wait for results.

### Step 5: Review Results (1 minute)

Check the generated pattern:
- ✅ **Green badge (80-100%)**: Great! Ready to use
- 🟡 **Yellow badge (60-79%)**: Good, but consider adding more examples
- 🔴 **Red badge (0-59%)**: Add more examples or try AI mode

### Step 6: Test Pattern (30 seconds)

Switch to **"Test Pattern"** tab:
1. Paste URLs you want to test (one per line)
2. Click **"Test Pattern"**
3. See which URLs match ✅ and which don't ❌

### Step 7: Use Your Pattern (10 seconds)

Click the **copy button** 📋 to copy your regex pattern, then use it in:
- Protocol Filters
- Crawler targets
- Custom scraping rules
- Bulk playlist generators

## Example: Filter IPTV Provider in 60 Seconds

### Scenario
You want to match only URLs from "streamserver.tv" that are M3U8 files.

### Quick Setup

**Matching Examples (3 URLs):**
```
✅ http://streamserver.tv/live/channel1.m3u8
✅ http://streamserver.tv/vod/movie.m3u8
✅ http://streamserver.tv/series/show.m3u8
```

**Non-Matching Examples (2 URLs):**
```
❌ http://different-server.com/live/channel1.m3u8
❌ http://streamserver.tv/stream.ts
```

**Click "Generate Pattern"**

**Result:**
```regex
^http://streamserver\.tv/(?:live|vod|series)/[^/]+\.m3u8$
```
Confidence: 100% ✅

**Done!** Copy and use in Protocol Filters.

## Pro Tips

### 🚀 Tip 1: Use AI Mode for Complex Patterns

Enable **"Use AI for smarter pattern generation"** checkbox and add context:

```
Context example:
"Match M3U8 streams from streamserver.tv 
that contain either 'HD' or '1080p' in the path"
```

AI will understand your intent and create a smarter pattern.

### 🎯 Tip 2: Start with Obvious Examples

Don't overthink it! Start with the most obvious examples:
- ✅ URLs you definitely want to match
- ❌ URLs you definitely DON'T want to match

You can always refine later.

### 🔄 Tip 3: Iterate and Improve

1. Generate pattern
2. Test with real URLs
3. Add examples for failed cases
4. Regenerate
5. Repeat until confident

### 📊 Tip 4: Aim for 80%+ Confidence

If your confidence is below 80%:
1. Add 2-3 more matching examples
2. Add 1-2 more non-matching examples
3. Regenerate

### ⚡ Tip 5: Optimize After Generation

Click the **Sparkle** ✨ button to optimize your pattern:
- Removes redundancy
- Simplifies expressions
- Improves readability

## Common Use Cases

### Use Case 1: Provider Filtering
**Goal:** Match only your IPTV provider's URLs

**Examples Needed:**
- 3-5 URLs from your provider ✅
- 2-3 URLs from other providers ❌

**Result:** Provider-specific filter

---

### Use Case 2: Quality Filtering
**Goal:** Match only HD/4K streams

**Examples Needed:**
- 3-5 HD/4K URLs with quality in path ✅
- 2-3 SD/low quality URLs ❌

**Result:** Quality-based filter

---

### Use Case 3: Protocol Filtering
**Goal:** Match only RTMP streams

**Examples Needed:**
- 3-5 RTMP URLs ✅
- 2-3 HTTP/HLS URLs ❌

**Result:** Protocol-specific filter

---

### Use Case 4: Content Type Filtering
**Goal:** Match only VOD (not live TV)

**Examples Needed:**
- 3-5 VOD URLs with /vod/ or /movie/ in path ✅
- 2-3 live TV URLs with /live/ in path ❌

**Result:** Content-type filter

## Keyboard Shortcuts

- **Enter** - Add example URL
- **Ctrl/Cmd + C** - Copy pattern (when pattern is selected)
- **Tab** - Navigate between example input and buttons

## Mobile Usage

Pattern Generator works great on mobile:
1. Tap input field to enter URL
2. Tap ✓ or ✗ to set match type
3. Tap + to add example
4. Scroll down and tap "Generate Pattern"
5. Swipe to see confidence and suggestions
6. Tap copy icon to copy pattern

## Troubleshooting in 30 Seconds

### Problem: Low confidence score

**Fix:** Add 2-3 more examples (both matching and non-matching)

---

### Problem: Pattern too broad (matches too much)

**Fix:** Add non-matching examples that show what you DON'T want

---

### Problem: Pattern too narrow (misses valid URLs)

**Fix:** Add more diverse matching examples

---

### Problem: Can't think of non-matching examples

**Fix:** Use URLs from:
- Different providers
- Different protocols
- Different file extensions
- Different domain names

## Next Steps

### After Creating Your Pattern

1. **Test in Protocol Filters**
   - Copy your pattern
   - Open Protocol Filters
   - Paste into "Custom URL Pattern"
   - See filtered results

2. **Use in Crawlers**
   - Add pattern as target filter
   - Crawler only follows matching URLs

3. **Create Playlist Filters**
   - Use in Bulk Playlist Generator
   - Filter links by pattern
   - Generate provider-specific playlists

4. **Save for Later**
   - Copy pattern to a text file
   - Document what it matches
   - Build a pattern library

## FAQs

### Q: How many examples do I need?

**A:** Minimum 3 matching, recommended 5 matching + 2-3 non-matching.

---

### Q: Should I use AI mode?

**A:** Use AI mode for:
- Complex URL structures
- Multiple providers with subtle differences
- When you want contextual understanding

Use rule-based for:
- Simple patterns
- Fast generation
- Offline usage

---

### Q: What's a good confidence score?

**A:** 
- **80-100%**: Excellent, ready to use
- **60-79%**: Good, test before production use
- **Below 60%**: Add more examples

---

### Q: Can I edit the generated pattern?

**A:** Yes! Copy it and edit manually if you know regex. Or regenerate with different examples.

---

### Q: Do patterns work across all features?

**A:** Yes! Patterns are standard regex that works in:
- Protocol Filters
- Crawlers
- Scrapers
- Custom rules
- Any regex-compatible tool

## Learn More

- 📖 [Full Documentation](PATTERN_GENERATOR.md)
- 📝 [Pattern Examples](PATTERN_EXAMPLES.md)
- 🔧 [Protocol Filters Guide](../src/lib/protocolFilters.ts)
- 🤖 [AI Assistant](../src/lib/geminiAssistant.ts)

## Getting Help

Having trouble? The AI Assistant can help!

1. Click the floating rabbit button 🐰
2. Ask questions like:
   - "How do I create a pattern for M3U8 streams?"
   - "Why is my pattern not matching?"
   - "Show me examples of RTMP patterns"
3. Get instant, context-aware help

## Success Story

**Before Pattern Generator:**
```
User: *manually writes regex*
^(?:https?|rtmp)://(?:www\.)?provider\.tv(?::\d+)?/(?:live|vod)/.*\.(?:m3u8|ts)$

User: *spends 30 minutes debugging regex*
User: *tests with URLs*
User: *realizes pattern is wrong*
User: *repeats process*
```

**With Pattern Generator:**
```
User: *pastes 5 example URLs*
User: *clicks Generate Pattern*
User: *gets working pattern in 10 seconds*
User: *tests and confirms it works*
User: ✅ Done!
```

## Real-World Example

**User Need:** "I want to scan only provider.tv streams, ignore everything else"

**Solution:**

1. Scan files to get URLs
2. Copy 5 provider.tv URLs → Mark as ✅
3. Copy 3 other provider URLs → Mark as ❌
4. Click "Generate Pattern"
5. Get: `^https?://(?:www\.)?provider\.tv/.*$`
6. Copy pattern to Protocol Filters
7. See only provider.tv URLs in results

**Time saved:** 25 minutes vs manual regex writing

---

**Ready to start?** Scroll down to the Pattern Generator section and try it now! 🚀

---

Still have questions? Ask the AI Assistant! 🐰
