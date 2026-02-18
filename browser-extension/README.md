# Media Link Scanner Browser Extension

A Chrome/Firefox extension that allows you to quickly send URLs to the Media Link Scanner for analysis. Right-click any link, page, or selected text to scan for media links, playlists, and IPTV sources.

## Features

- **Context Menu Integration**: Right-click any link or page to send it to the scanner
- **Popup Interface**: Quick access to scan URLs directly from the extension popup
- **Recent Jobs Tracking**: View your recent scan jobs and their status
- **Auto-Open Scanner**: Automatically open the scanner app when a scan starts
- **Multiple Source Types**: Supports repositories, playlists, web pages, and package files
- **Authentication Support**: Configure API keys and authentication for protected resources
- **Browser Notifications**: Get notified when scans complete or fail

## Installation

### Chrome/Edge

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `browser-extension` folder from this project
5. The extension icon should appear in your toolbar

### Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Navigate to the `browser-extension` folder
4. Select the `manifest.json` file
5. The extension will be loaded temporarily

## Setup

### 1. Start the API Server

Before using the extension, make sure the Media Link Scanner API server is running:

```bash
# From the project root directory
npm run api:start

# Or use ts-node directly
npx ts-node src/api/server.ts
```

The server will start on `http://localhost:3001` by default.

### 2. Configure Extension Settings

1. Click the extension icon in your toolbar
2. Click the "⚙️ Settings" link at the bottom of the popup
3. Verify the API URL is correct (default: `http://localhost:3001/api/external-scan`)
4. Click "🧪 Test Connection" to verify the server is reachable
5. (Optional) Add an API key if your server requires authentication

## Usage

### Method 1: Context Menu

1. **Right-click any link** on a webpage
2. Select "Send to Media Link Scanner" from the context menu
3. The extension will automatically detect the type (repository, playlist, etc.)
4. A notification will confirm the scan has started
5. The scanner app will open in a new tab (if auto-open is enabled)

### Method 2: Popup Interface

1. **Click the extension icon** in your toolbar
2. The current page URL will be pre-filled
3. Modify the URL if needed, add a label
4. Select the media type or leave it on "Auto-detect"
5. Click "📡 Send to Scanner"
6. Monitor the job status in the "Recent Jobs" section

### Method 3: Selected Text

1. **Select any URL text** on a webpage
2. Right-click the selection
3. Choose "Send to Media Link Scanner"
4. The URL will be extracted and sent to the scanner

## Supported URL Types

The extension automatically detects and handles:

### Repositories
- GitHub: `https://github.com/username/repo`
- GitLab: `https://gitlab.com/username/project`
- Bitbucket: `https://bitbucket.org/username/repo`
- Codeberg: `https://codeberg.org/username/repo`

### Playlists & Media
- M3U/M3U8 playlists: `http://provider.tv/playlist.m3u8`
- PLS playlists: `http://example.com/channels.pls`
- XSPF playlists: `http://example.com/playlist.xspf`
- Direct media URLs

### Packages & Archives
- APK files: `http://example.com/app.apk`
- ZIP archives: `http://example.com/files.zip`
- Other package formats: `.aab`, `.xapk`, `.apks`, etc.

### Web Pages
- Any webpage that might contain media links
- IPTV provider pages
- Streaming service pages

## Settings

### API Configuration

- **API Endpoint URL**: The URL of your Media Link Scanner API (default: `http://localhost:3001/api/external-scan`)
- **API Key**: Optional authentication key for secured API servers

### Extension Behavior

- **Automatically open scanner**: Open the scanner app in a new tab when a scan starts
- **Show browser notifications**: Display desktop notifications for scan events

## API Communication

The extension communicates with the backend API using the following flow:

1. **POST** `/api/external-scan` - Create a new scan job
   ```json
   {
     "source_url": "https://github.com/iptv-org/iptv",
     "label": "IPTV.org Repository",
     "media_type": "repository",
     "depth": 3
   }
   ```

2. **Receive Job ID** - Server responds with a unique job ID
   ```json
   {
     "job_id": "550e8400-e29b-41d4-a716-446655440000",
     "status": "accepted",
     "message": "Scan job created",
     "timestamp": "2024-01-15T10:30:00.000Z"
   }
   ```

3. **Poll Job Status** (optional) - Check job progress
   ```
   GET /api/jobs/{job_id}
   ```

## Recent Jobs

The extension keeps track of your last 20 scan jobs, showing:
- Job label/URL
- Status badge (pending, running, completed, failed)
- Time since job was created

You can clear the job history by clicking the "Clear" button in the Recent Jobs section.

## Troubleshooting

### "Connection failed" error

**Problem**: Extension cannot reach the API server

**Solutions**:
1. Make sure the API server is running: `npm run api:start`
2. Verify the API URL in settings matches your server URL
3. Check that port 3001 is not blocked by a firewall
4. Try the "Test Connection" button in settings

### "Scan failed" notification

**Problem**: Server rejected the scan request

**Solutions**:
1. Check the API server console for error messages
2. Verify the URL format is correct
3. For repositories, ensure the repo is public or credentials are provided
4. For playlists with authentication, set up credentials first

### Extension icon not appearing

**Problem**: Extension not loaded properly

**Solutions**:
1. Check that Developer Mode is enabled in Chrome/Firefox
2. Reload the extension from the extensions page
3. Check browser console for any loading errors

### No context menu options

**Problem**: Right-click menu doesn't show scanner options

**Solutions**:
1. Reload the extension
2. Refresh the webpage you're on
3. Check that you're right-clicking on a link or the page (not an image)

## Development

### File Structure

```
browser-extension/
├── manifest.json          # Extension manifest (Chrome/Firefox)
├── background.js          # Background service worker
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic
├── options.html          # Settings page UI
├── options.js            # Settings page logic
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md            # This file
```

### Building for Production

For Firefox, create a signed `.xpi` file:
```bash
web-ext build --source-dir=browser-extension/
```

For Chrome, create a `.crx` file:
1. Go to `chrome://extensions/`
2. Click "Pack extension"
3. Select the `browser-extension` directory

### Testing

1. Load the extension in development mode
2. Start the API server
3. Test all context menu options
4. Test popup interface
5. Verify notifications appear
6. Check settings page functionality

## Privacy & Security

- **No Data Collection**: The extension does not collect or transmit any personal data
- **Local Storage Only**: Settings and job history are stored locally in your browser
- **API Communication**: Only communicates with your configured API server
- **No External Services**: No third-party analytics or tracking

## License

This extension is part of the Media Link Scanner project.

## Support

For issues, feature requests, or questions:
- Check the main project README
- Review the API documentation
- Check browser console for error messages
