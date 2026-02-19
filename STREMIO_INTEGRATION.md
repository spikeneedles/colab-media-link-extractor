# Stremio Integration Guide

## Overview

The Media Link Extractor now includes full **Stremio addon** support, allowing you to stream your extracted media links directly in Stremio. This integration works similarly to the existing Kodi support but uses Stremio's addon protocol.

## What is Stremio?

Stremio is a modern media center application that uses addons to provide content. Unlike Kodi which uses file-based addons, Stremio addons are HTTP-based services that implement a specific API protocol.

## Features

- **Automatic Link Export**: Export extracted media links to your Stremio addon with one click
- **Auto-Discovery & Playlists**: Capture Stremio stream requests, crawl the source domain, and generate playlists automatically
- **Content Classification**: Automatically categorizes links as movies, series, live TV, or channels
- **Custom Configuration**: Personalize your addon's name, description, and logo
- **Easy Installation**: One-click installation directly into Stremio
- **Real-time Management**: Add, remove, and update links without restarting

## How It Works

### Architecture

```
Media Link Extractor → Extract Links → Export to Stremio Addon → Stream in Stremio
                                              ↓
                                      Backend Server
                                    (Implements Stremio Protocol)
```

### Stremio Addon Protocol

The addon implements the official Stremio addon protocol with three main endpoints:

1. **Manifest** (`/manifest.json`) - Describes the addon
2. **Catalog** (`/catalog/{type}/{id}.json`) - Lists available content
3. **Stream** (`/stream/{type}/{id}.json`) - Provides playable stream links

### Auto-Discovery Workflow

When Stremio requests a stream, the addon:

1. Saves the stream URL into a playlist
2. Crawls the source domain and scrapes related media links
3. Generates an M3U playlist from discovered content
4. Optionally adds discovered links back into the addon

## Setup Instructions

### 1. Start the Backend Server

Make sure your backend server is running:

```bash
cd backend
npm run dev
```

The Stremio addon will be available at: `http://localhost:3001/stremio`

### 2. Extract Media Links

Use the Media Link Extractor as normal to extract links from:
- M3U/M3U8 playlists
- Kodi files (.strm, .xsp, .nfo, addon.xml)
- Web URLs
- Archive files (ZIP, RAR, 7Z)
- Android packages (APK)
- Git repositories
- And 50+ other formats

### 3. Export to Stremio

1. After extracting links, scroll to the **Stremio Integration** section
2. Go to the **Export Links** tab
3. Click **Export to Stremio**
4. Your links are now available in the addon!

### 4. Install in Stremio

1. Click the **Install Addon** tab
2. Click **Open in Stremio** button
   - Or copy the Install URL and paste it into Stremio's addon search
3. Stremio will open and prompt you to install the addon
4. Click **Install** in Stremio

### 5. Access Your Content

1. Open Stremio
2. Go to the Discover section
3. You'll see your custom addon with extracted links
4. Browse and stream your content!

## Usage Guide

### Export Links Tab

**Export Extracted Links**: 
- Shows how many links are ready to export
- Displays current total links in the addon
- **Export to Stremio** button sends links to the addon
- **Refresh Status** updates the link count
- **Clear All Links** removes all links from the addon

### Install Addon Tab

**Installation Options**:
- **Open in Stremio**: Direct installation (recommended)
- **Install URL**: Copy and paste manually
- **Stremio Protocol URL**: Alternative installation method

**Installation URLs**:
- `http://localhost:3001/stremio/manifest.json` (local development)
- `http://your-server.com/stremio/manifest.json` (production)

### Configure Tab

**Customize Your Addon**:
- **Addon Name**: Change the display name
- **Description**: Customize the addon description
- **Logo URL**: Set a custom logo (256x256px recommended)

After making changes, click **Update Addon Configuration**.

### Auto-Discovery Tab

**Auto-Discovery & Playlists**:
- **Start Auto-Discovery** with a URL (manual trigger)
- **Track Discovery Jobs** (status, progress, link counts)
- **Download Generated Playlists** (M3U/M3U8)
- **Add Discovered Links** back into the Stremio addon

## Content Classification

Links are automatically classified based on:

1. **Content Type** field from extraction
2. **Title** keywords (movie, series, episode, season, live, channel)
3. **URL** patterns

Classification types:
- **Movie**: Single films and movies
- **Series**: TV shows, episodes, seasons
- **TV**: Live television channels
- **Channel**: IPTV channels and streams

## API Reference

### Management Endpoints

#### Add Links
```http
POST /stremio/api/links
Content-Type: application/json

{
  "links": [
    {
      "url": "https://example.com/stream.m3u8",
      "title": "My Stream",
      "category": "Movies",
      "type": "movie"
    }
  ],
  "category": "extracted"
}
```

#### Get Addon Info
```http
GET /stremio/api/info
```

Response:
```json
{
  "manifest": { ... },
  "totalLinks": 42,
  "installUrl": "http://localhost:3001/stremio/manifest.json",
  "stremioUrl": "stremio://localhost:3001/stremio/..."
}
```

#### Clear Links
```http
DELETE /stremio/api/links
```

#### Update Manifest
```http
PUT /stremio/api/manifest
Content-Type: application/json

{
  "name": "My Custom Addon",
  "description": "Custom description",
  "logo": "https://example.com/logo.png"
}
```

#### Health Check
```http
GET /stremio/api/health
```

#### Start Auto-Discovery
```http
POST /stremio/api/discovery/start
Content-Type: application/json

{
  "url": "https://example.com/media",
  "title": "Example Source",
  "category": "discovered"
}
```

#### List Discovery Jobs
```http
GET /stremio/api/discovery/jobs
```

#### Get Discovery Job
```http
GET /stremio/api/discovery/jobs/{jobId}
```

#### List Playlists
```http
GET /stremio/api/playlists
```

#### Download Playlist
```http
GET /stremio/api/playlists/{playlistId}/download
```

#### Add Discovered Links to Addon
```http
POST /stremio/api/discovery/add-to-addon
Content-Type: application/json

{
  "jobId": "discovery-123"
}
```

### Stremio Protocol Endpoints

#### Manifest
```http
GET /stremio/manifest.json
```

#### Catalog
```http
GET /stremio/catalog/movie/extracted-movies.json
GET /stremio/catalog/series/extracted-series.json
GET /stremio/catalog/tv/extracted-tv.json
GET /stremio/catalog/channel/extracted-channels.json
```

#### Stream
```http
GET /stremio/stream/{type}/{id}.json
```

## Deployment

### Development

Backend runs on `http://localhost:3001` by default. The addon URL will be:
```
http://localhost:3001/stremio/manifest.json
```

⚠️ **Note**: Localhost addons only work on the same device running Stremio.

### Production

For remote access, deploy the backend to a server with a public IP or domain:

1. **Deploy Backend**:
   ```bash
   npm run build
   npm start
   ```

2. **Update CORS** in `.env`:
   ```env
   CORS_ORIGIN=*
   PORT=3001
   ```

3. **Install in Stremio** using your public URL:
   ```
   https://your-domain.com/stremio/manifest.json
   ```

### Docker Deployment

```bash
# Build
docker build -t media-link-extractor .

# Run
docker run -p 3001:3001 media-link-extractor
```

### Remote Access with ngrok

For quick testing with remote access:

```bash
# Install ngrok
npm install -g ngrok

# Start tunnel
ngrok http 3001

# Use the ngrok URL in Stremio
https://abc123.ngrok.io/stremio/manifest.json
```

## Troubleshooting

### Addon Not Showing in Stremio

1. **Check Backend Status**: Visit `http://localhost:3001/stremio/api/health`
2. **Verify Links**: Call `http://localhost:3001/stremio/api/info` to see link count
3. **Reinstall Addon**: Uninstall from Stremio and reinstall
4. **Check CORS**: Make sure CORS is configured correctly

### Streams Not Playing

1. **Check URL Format**: Ensure URLs are valid and accessible
2. **Protocol Support**: Some protocols (RTSP, RTMP) may not work in Stremio web player
3. **Authentication**: URLs with authentication may not work
4. **Proxy Required**: Some streams may need to be proxied

### Links Not Appearing

1. **Export Links**: Make sure you clicked "Export to Stremio"
2. **Refresh Catalog**: Close and reopen Stremio
3. **Check Classification**: Links may be in different content type tabs
4. **Clear and Re-export**: Try clearing all links and exporting again

## Comparison: Kodi vs Stremio

| Feature | Kodi | Stremio |
|---------|------|---------|
| **Architecture** | File-based addons | HTTP-based addons |
| **Installation** | Manual file placement | One-click URL install |
| **Configuration** | Edit XML/Python files | Web API configuration |
| **Platform** | Desktop, Android, iOS | Desktop, Android, Web |
| **Our Integration** | Parse config files | Serve via addon API |

## Advanced Usage

### Custom Content Types

Modify `stremioAddon.ts` to add custom content types:

```typescript
const manifest: StremioManifest = {
  // ...
  types: ['movie', 'series', 'tv', 'channel', 'anime', 'documentary'],
  catalogs: [
    {
      type: 'anime',
      id: 'extracted-anime',
      name: 'Extracted Anime'
    }
  ]
}
```

### Persistent Storage

By default, links are stored in memory. For production, implement database storage:

```typescript
class StremioAddonManager {
  private db: Database // Your database
  
  async addLinks(category: string, links: StreamioLink[]): Promise<void> {
    await this.db.insert('links', { category, links })
  }
  
  async getLinks(category: string): Promise<StreamioLink[]> {
    return await this.db.query('links', { category })
  }
}
```

### Authentication

Add API key authentication to the management endpoints:

```typescript
router.post('/api/links', authMiddleware, handleAddLinks)
```

## Support

For issues or questions:
1. Check the [Stremio addon documentation](https://github.com/Stremio/stremio-addon-sdk)
2. Review the backend logs for errors
3. Test the addon endpoints directly with curl/Postman

## Future Enhancements

Planned features:
- [ ] Metadata enrichment (fetch posters, descriptions from TMDB)
- [ ] EPG integration for live TV
- [ ] Stream proxying for authentication
- [ ] Multi-user support with individual addons
- [ ] Link validation and health monitoring
- [ ] Automatic link refresh and updates
- [ ] Categories as individual catalogs
- [ ] Search functionality
- [ ] Subtitle support

## License

This Stremio integration is part of the Media Link Extractor project and uses the same license as the main project.
