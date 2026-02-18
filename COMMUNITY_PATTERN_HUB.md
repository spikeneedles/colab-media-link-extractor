# Community Pattern Hub Documentation

## 🌍 Overview

The **Community Pattern Hub** is a collaborative platform for discovering, sharing, and managing streaming media extraction patterns. It enables users to publish patterns, browse community contributions, rate patterns, fork and customize them, and stay updated with new releases.

The hub acts as a central marketplace where the community can share their expertise, help each other solve extraction challenges, and build a comprehensive library of tested and verified patterns.

## ✨ Key Features

### 📤 **Pattern Publishing**
- Publish your custom patterns to the community
- Choose visibility (public, unlisted, or private)
- Add detailed descriptions, examples, and tags
- Select appropriate licensing
- Version control with changelog

### 🔍 **Pattern Discovery**
- **Explore**: Search and filter all available patterns
- **Trending**: See what's hot in the community
- **Featured**: Official and verified patterns
- **My Patterns**: Manage your published patterns
- **Subscriptions**: Track patterns you follow

### ⭐ **Social Features**
- **Star Patterns**: Bookmark favorites for quick access
- **Fork Patterns**: Create your own versions
- **Reviews & Ratings**: 5-star rating system with comments
- **Comments**: Discuss patterns with the community
- **Subscribe**: Get notifications for pattern updates
- **User Profiles**: Build your reputation

### 📊 **Hub Statistics**
- Total patterns, users, downloads, and stars
- Weekly activity metrics
- Top contributors leaderboard
- Category breakdowns
- Personal contribution stats

### 🏆 **Recognition System**
- Reputation points for contributions
- Download count tracking
- Star accumulation
- Badges for achievements (coming soon)
- Verified pattern status

## 🚀 Getting Started

### Browsing Patterns

1. Navigate to the **Community Pattern Hub** section
2. Use the tab system to explore different views:
   - **Explore**: Full catalog with search and filters
   - **Trending**: Popular patterns this week
   - **Featured**: Officially recommended patterns
   - **My Patterns**: Your published patterns
   - **Subscriptions**: Patterns you're following

### Searching for Patterns

The Explore tab provides powerful search capabilities:

1. **Text Search**: Search by pattern name, description, author, or tags
2. **Category Filter**: Filter by pattern type (Xtream Codes, HLS, RTMP, etc.)
3. **Sort Options**:
   - **Trending**: Most active patterns this week
   - **Recent**: Latest published patterns
   - **Popular**: Most downloaded patterns
   - **Rating**: Highest rated patterns
   - **Downloads**: Most downloaded all-time
4. **Verified Only**: Toggle to show only verified patterns

**Example Search Query**: "iptv provider m3u8"

### Understanding Pattern Cards

Each pattern card displays:

- **Name & Category**: Pattern title and type badge
- **Status Badges**:
  - ✅ **Verified**: Tested and approved by moderators
  - 👑 **Featured**: Highlighted by the community
  - 🛡️ **Official**: Published by the platform team
- **Author**: Pattern creator's username
- **Statistics**:
  - Download count
  - Star count
  - View count
  - Average rating (1-5 stars with ⭐)
- **Description**: Brief explanation of the pattern
- **Tags**: Searchable keywords

### Downloading and Using Patterns

1. **Browse**: Find a pattern you want to use
2. **Review**: Click "Show More" to see the regex patterns and example URLs
3. **Details**: Click "Details" for full information including reviews
4. **Download**: Click the download button
5. **Import**: Pattern is automatically imported and ready to use

The downloaded pattern will be available in your pattern library for filtering extracted media links.

## 📤 Publishing Your Own Patterns

### Preparing Your Pattern

Before publishing, ensure you have:

1. **Tested Regex Patterns**: Verify they work across multiple URLs
2. **Example URLs**: Provide real working examples (at least 2-3)
3. **Clear Description**: Explain what the pattern does and when to use it
4. **Appropriate Category**: Choose the correct pattern type
5. **Relevant Tags**: Add searchable keywords

### Publishing Process

1. Click **"Publish Pattern"** button in the top-right
2. Fill in the required fields:

#### Required Fields
- **Pattern Name**: Descriptive name (e.g., "Generic IPTV M3U8 Streams")
- **Description**: Detailed explanation of what the pattern matches
- **Regex Patterns**: One pattern per line
  ```
  https?://[^/]+/.*\.m3u8(?:\?[^s]*)?
  https?://[^/]+/live/.*\.ts
  ```

#### Optional but Recommended
- **Example URLs**: Real URLs that match your pattern
  ```
  http://example.com/stream/channel1.m3u8
  http://provider.tv/live/sports.m3u8?token=xyz
  ```
- **Tags**: Comma-separated keywords
  ```
  iptv, m3u8, hls, live-streaming
  ```

#### Settings
- **Category**: Select the appropriate pattern type
- **License**: Choose an open-source license (default: MIT)
- **Visibility**: 
  - **Public**: Visible to everyone
  - **Unlisted**: Only accessible via direct link
  - **Private**: Only you can see it

3. Click **"Publish Pattern"**
4. Your pattern is now live in the community hub!

### Pattern Categories

| Category | Description | Use Cases |
|----------|-------------|-----------|
| **Xtream Codes** | Xtream Codes API patterns | IPTV panels, VOD services |
| **HLS/M3U8** | HTTP Live Streaming | Adaptive streams, live TV |
| **RTMP** | Real-Time Messaging Protocol | Live streaming, broadcasts |
| **RTSP** | Real-Time Streaming Protocol | IP cameras, surveillance |
| **M3U Playlists** | M3U/M3U8 playlist files | Playlist collections |
| **DASH** | Dynamic Adaptive Streaming | Adaptive video streaming |
| **Generic** | General-purpose patterns | Broad matching |
| **IPTV Panel** | IPTV panel patterns | Provider panels |
| **Custom** | User-defined patterns | Specific use cases |

### Licensing Options

Choose a license that matches your sharing preferences:

- **MIT**: Very permissive, allows commercial use
- **Apache 2.0**: Permissive with patent protection
- **GPL 3.0**: Copyleft, derivative works must be open-source
- **BSD 3-Clause**: Permissive with attribution requirement
- **CC0 1.0**: Public domain dedication
- **Unlicense**: Release to public domain

## ⭐ Engaging with Patterns

### Starring Patterns

Star patterns to:
- Bookmark favorites for later
- Show appreciation to the author
- Help others discover quality patterns
- Build your starred collection

**How to Star**: Click the ⭐ button on any pattern card

### Forking Patterns

Fork patterns to:
- Create your own customized version
- Build upon existing work
- Experiment without affecting the original
- Share your improvements

**How to Fork**: Click "Fork" button → Pattern is copied to your account → Edit and republish

### Rating and Reviewing

Leave reviews to:
- Share your experience
- Help others make informed decisions
- Provide feedback to authors
- Improve pattern quality

**How to Review**:
1. Open pattern details
2. Click "Write a Review"
3. Select star rating (1-5 stars)
4. Write your comment
5. Submit review

**Review Guidelines**:
- Be constructive and respectful
- Mention what worked or didn't work
- Include details about your use case
- Rate fairly based on pattern quality

### Subscribing to Patterns

Subscribe to patterns to:
- Receive update notifications
- Track patterns you use regularly
- Stay informed about improvements
- Support pattern authors

**How to Subscribe**: Click the 🔔 bell icon on any pattern

**Subscription Benefits**:
- Version update alerts
- Security fix notifications
- Breaking change warnings
- Deprecation notices

### Commenting on Patterns

Add comments to:
- Ask questions
- Report issues
- Share tips and tricks
- Discuss use cases

**How to Comment**:
1. Open pattern details
2. Scroll to comments section
3. Write your comment
4. Submit

## 👤 User Profile & Reputation

### Profile Management

Click **"Profile"** to manage your account:

- **Username**: Your unique identifier
- **Display Name**: What others see
- **Bio**: Tell the community about yourself
- **Website**: Link to your site or portfolio

### Reputation System

Build reputation through:
- **Publishing Patterns**: +10 points per pattern
- **Pattern Downloads**: +1 point per download
- **Receiving Stars**: +2 points per star
- **Getting Verified**: +50 points for verified patterns
- **Helpful Reviews**: +5 points for helpful reviews

Your reputation is visible on your profile and pattern cards.

### Statistics Dashboard

Track your contributions:
- **Patterns Published**: Total patterns you've shared
- **Total Downloads**: Combined downloads across all patterns
- **Total Stars**: Stars received across all patterns
- **Reputation**: Overall community standing

## 📊 Pattern Statistics

Each pattern tracks:

### Public Metrics
- **Downloads**: Total times pattern was downloaded
- **Weekly Downloads**: Downloads in the last 7 days
- **Monthly Downloads**: Downloads in the last 30 days
- **Stars**: Users who starred the pattern
- **Forks**: Times pattern was forked
- **Views**: Pattern detail page views
- **Comments**: Number of comments
- **Reviews**: Number of reviews
- **Average Rating**: 1-5 star average

### Author-Only Metrics (Coming Soon)
- Usage analytics
- Geographic distribution
- Referral sources
- Error reports

## 🔎 Advanced Features

### Pattern Collections (Coming Soon)

Create themed collections:
- Group related patterns
- Share curated sets
- Organize by use case or provider
- Follow collections from other users

### Pattern Dependencies (Coming Soon)

Declare dependencies:
- Required base patterns
- Compatible patterns
- Replacement suggestions
- Version compatibility

### Automated Testing (Coming Soon)

Pattern validation:
- Automated testing against example URLs
- Regex syntax validation
- Performance benchmarks
- Compatibility checks

### Version Control (Coming Soon)

Track pattern changes:
- Semantic versioning (1.0.0, 1.1.0, 2.0.0)
- Changelog entries
- Breaking change notifications
- Rollback to previous versions

## 💡 Best Practices

### For Pattern Authors

1. **Test Thoroughly**: Verify patterns work across multiple real-world URLs
2. **Provide Examples**: Include 3-5 example URLs that demonstrate pattern usage
3. **Write Clear Descriptions**: Explain what the pattern does, when to use it, and limitations
4. **Use Specific Patterns**: Avoid overly broad patterns that match unintended URLs
5. **Add Comprehensive Tags**: Help users discover your pattern through search
6. **Choose Appropriate Category**: Select the most relevant category
7. **Keep Patterns Updated**: Update when provider formats change
8. **Respond to Feedback**: Engage with users who comment or report issues
9. **Document Changes**: Maintain a changelog for updates
10. **Follow Naming Conventions**: Use descriptive, searchable names

**Example Good Pattern Name**: ✅ "Xtream Codes Live Streams and VOD"  
**Example Poor Pattern Name**: ❌ "Pattern123"

### For Pattern Users

1. **Read Descriptions**: Understand what the pattern does before downloading
2. **Check Examples**: Verify the pattern matches your use case
3. **Review Ratings**: Look at community feedback and ratings
4. **Test Before Using**: Try patterns on sample URLs first
5. **Leave Feedback**: Help others by rating and reviewing patterns you use
6. **Report Issues**: Comment if you find problems or bugs
7. **Star Quality Patterns**: Support authors who create useful patterns
8. **Subscribe to Favorites**: Get notified when patterns you depend on are updated
9. **Fork When Customizing**: Create forks instead of duplicating patterns
10. **Give Credit**: Mention original authors when sharing forked patterns

## 🔒 Privacy and Security

### Data Storage

- **Local First**: Pattern data stored locally in browser localStorage
- **No Account Required**: Use the hub anonymously
- **No Personal Data**: No email, phone, or personally identifiable information
- **Export Anytime**: Download your patterns as JSON

### Pattern Safety

- **Review Before Using**: Always review patterns before applying them
- **Regex Safety**: Patterns are regex strings, not executable code
- **No Credential Storage**: Never include passwords or API keys in patterns
- **Public by Default**: Assume published patterns are visible to all

### Security Best Practices

1. ✅ **DO**: Share generic patterns that match URL structures
2. ✅ **DO**: Use pattern descriptions to explain usage
3. ✅ **DO**: Report malicious or misleading patterns
4. ❌ **DON'T**: Include authentication credentials in patterns
5. ❌ **DON'T**: Share private provider URLs publicly
6. ❌ **DON'T**: Publish patterns that violate terms of service

## 🐛 Troubleshooting

### Pattern Not Matching Expected URLs

**Problem**: Downloaded pattern doesn't match your URLs

**Solutions**:
1. Check example URLs to verify pattern compatibility
2. Review regex syntax carefully
3. Test pattern against your specific URLs
4. Comment on pattern to report issue
5. Consider forking and modifying the pattern

### Cannot Publish Pattern

**Problem**: Publish button doesn't work or shows errors

**Solutions**:
1. Ensure pattern name and regex patterns are not empty
2. Verify regex syntax is valid
3. Check browser console for JavaScript errors
4. Try different browser if issue persists
5. Clear browser cache and reload page

### Pattern Not Appearing in Search

**Problem**: Your published pattern doesn't show up in search results

**Solutions**:
1. Check pattern visibility is set to "Public"
2. Verify you're searching with relevant keywords
3. Add more tags to improve discoverability
4. Ensure pattern wasn't accidentally deleted
5. Refresh the page to reload pattern list

### Stars/Downloads Not Updating

**Problem**: Statistics don't update immediately

**Solutions**:
1. Refresh the page to reload latest data
2. Statistics update may take a few seconds
3. Check if localStorage has sufficient space
4. Try in incognito mode to verify functionality

## 📱 Mobile Usage

The Community Pattern Hub is fully responsive and works on mobile devices:

- **Touch-Friendly**: Large buttons and tap targets
- **Responsive Layout**: Adapts to screen size
- **Scroll Areas**: Smooth scrolling for long content
- **Mobile Filters**: Collapsible filter panels
- **Quick Actions**: Swipe gestures (coming soon)

## 🔮 Upcoming Features

### Phase 1: Enhanced Discovery
- Advanced search with operators (AND, OR, NOT)
- Saved search queries
- Pattern recommendations based on usage
- Related patterns suggestions

### Phase 2: Social Features
- User profiles with avatars
- Follow other users
- Pattern activity feed
- Direct messaging
- Collaboration requests

### Phase 3: Advanced Management
- Bulk pattern operations
- Pattern collections and bundles
- Import from URL
- Automated testing framework
- Pattern analytics dashboard

### Phase 4: Integration
- Backend API integration
- Real-time synchronization
- Cloud backup and sync
- Team collaboration features
- Enterprise features (private hubs)

## 🤝 Contributing to the Hub

### Becoming a Verified Author

Verified status is granted to authors who:
1. Publish high-quality, well-documented patterns
2. Maintain patterns and respond to feedback
3. Follow community guidelines
4. Accumulate positive reviews and stars
5. Demonstrate expertise in streaming protocols

**Benefits of Verification**:
- ✅ Verified badge on all your patterns
- Higher visibility in search results
- Featured in "Top Contributors"
- Early access to new features
- Increased reputation multiplier

### Community Guidelines

1. **Be Respectful**: Treat all users with respect and kindness
2. **Be Helpful**: Provide constructive feedback
3. **Be Honest**: Don't manipulate ratings or reviews
4. **Be Original**: Don't copy patterns without attribution
5. **Be Responsible**: Don't publish malicious patterns
6. **Be Professional**: Use appropriate language

### Reporting Issues

Report problems through:
- Pattern comments for pattern-specific issues
- GitHub issues for platform bugs
- Community forums for general questions

## 📚 Pattern Examples

### Example 1: Xtream Codes Pattern

```json
{
  "name": "Xtream Codes API - Live TV",
  "description": "Matches Xtream Codes live stream URLs with username/password authentication",
  "category": "xtream",
  "patterns": [
    "https?://[^/]+:\\d+/live/[^/]+/[^/]+/\\d+\\.ts",
    "https?://[^/]+/live/[^/]+/[^/]+/\\d+\\.m3u8"
  ],
  "exampleUrls": [
    "http://provider.tv:8080/live/username/password/12345.ts",
    "http://example.com/live/user123/pass456/67890.m3u8"
  ],
  "tags": ["xtream-codes", "iptv", "live-tv", "authentication"]
}
```

### Example 2: Generic M3U8 Pattern

```json
{
  "name": "Generic M3U8 Streams",
  "description": "Matches standard M3U8 HLS streams from any provider",
  "category": "hls",
  "patterns": [
    "https?://[^\\s]+\\.m3u8(?:\\?[^\\s]*)?"
  ],
  "exampleUrls": [
    "http://stream.example.com/live/channel.m3u8",
    "https://cdn.provider.tv/hls/stream.m3u8?token=abc123"
  ],
  "tags": ["hls", "m3u8", "streaming", "generic"]
}
```

### Example 3: RTMP Live Stream Pattern

```json
{
  "name": "RTMP Live Broadcasts",
  "description": "Matches RTMP live streaming URLs with optional path parameters",
  "category": "rtmp",
  "patterns": [
    "rtmp://[^/]+/live/[^\\s]+",
    "rtmps://[^/]+/[^\\s]+"
  ],
  "exampleUrls": [
    "rtmp://broadcast.example.com/live/stream123",
    "rtmps://secure.streaming.tv/channel/live_event"
  ],
  "tags": ["rtmp", "live-streaming", "broadcast", "real-time"]
}
```

## ❓ FAQ

### General Questions

**Q: Do I need an account to use the hub?**  
A: No, the hub works locally and anonymously. Your profile is stored in your browser.

**Q: Are patterns stored in the cloud?**  
A: Currently, patterns are stored locally in your browser's localStorage. Cloud sync is planned for a future update.

**Q: Can I use patterns commercially?**  
A: It depends on the pattern's license. Check the license field before commercial use.

**Q: How do I update a published pattern?**  
A: Version control is coming soon. For now, you can delete and republish with the same name.

### Technical Questions

**Q: What regex flavor is used?**  
A: JavaScript regex (ECMAScript standard). Test your patterns with JavaScript regex testers.

**Q: Can I use lookaheads and lookbehinds?**  
A: Yes, JavaScript supports positive/negative lookaheads and lookbehinds.

**Q: Are patterns case-sensitive?**  
A: By default yes, unless you use the `(?i)` flag for case-insensitive matching.

**Q: Can patterns execute code?**  
A: No, patterns are pure regex strings. They cannot execute JavaScript or any other code.

### Contribution Questions

**Q: How do I become a verified author?**  
A: Publish quality patterns, engage with feedback, and build reputation over time.

**Q: Can I edit someone else's pattern?**  
A: No, but you can fork it and publish your modified version.

**Q: Can I make patterns private?**  
A: Yes, set visibility to "Private" when publishing.

**Q: How do I delete a pattern?**  
A: Go to "My Patterns" tab and manage your published patterns.

## 🎓 Learn More

### Resources

- **Pattern Generator**: Use the AI-powered Pattern Generator to create custom patterns
- **Pattern Library**: Browse pre-made patterns for common streaming services
- **Pattern Repository**: Manage and organize your pattern collections
- **Documentation**: Full regex documentation and streaming protocol guides

### Related Features

- **Link Extractor**: Main scanning tool that uses patterns
- **Protocol Filters**: Filter results by protocol type
- **Bulk Playlist Generator**: Create playlists from filtered results
- **Archive Scanner**: Extract patterns from downloaded archives

## 📧 Support

For help and support:
- Check this documentation first
- Review troubleshooting section
- Search existing pattern comments
- Ask in pattern-specific discussions
- Report bugs via GitHub issues

---

**Happy Pattern Sharing! 🎉**

The Community Pattern Hub thrives on your contributions. Every pattern you share helps other users discover and enjoy streaming content more easily. Thank you for being part of the community!
