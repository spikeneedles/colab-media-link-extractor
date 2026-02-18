# Browser Extension Quick Start

## What is the Browser Extension?

The Media Link Scanner Browser Extension allows you to quickly send URLs to the scanner directly from your browser. Right-click any link, page, or selected text to analyze it for media links.

## Prerequisites

Before installing the extension, you need to have the API server running:

```bash
# Start the API server
npm run api:start

# Or manually with ts-node
npx ts-node src/api/server.ts
```

The server will run on `http://localhost:3001` by default.

## Installing the Extension

### Chrome / Edge / Brave

1. Open your browser and go to the extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`

2. Enable **Developer mode** (toggle in the top-right corner)

3. Click **"Load unpacked"**

4. Navigate to your project directory and select the `browser-extension` folder

5. The extension should now appear in your extensions list and toolbar

### Firefox

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`

2. Click **"Load Temporary Add-on..."**

3. Navigate to the `browser-extension` folder

4. Select the `manifest.json` file

5. The extension will be loaded (note: it will be removed when you close Firefox)

For permanent Firefox installation, you'll need to sign the extension through Mozilla's Add-on Developer Hub.

## First-Time Setup

1. **Click the extension icon** in your browser toolbar

2. **Click "⚙️ Settings"** at the bottom of the popup

3. **Test the connection**:
   - Verify the API URL is `http://localhost:3001/api/external-scan`
   - Click the "🧪 Test Connection" button
   - You should see "✅ Connection successful!"

4. **Configure preferences**:
   - Enable/disable auto-open of scanner app
   - Enable/disable browser notifications
   - Add an API key if your server requires authentication

5. **Click "💾 Save Settings"**

## Using the Extension

### Method 1: Right-Click Menu

1. **Right-click any link** on a webpage
2. Select **"Send to Media Link Scanner"**
3. A notification confirms the scan started
4. The scanner app opens automatically (if enabled)

### Method 2: Extension Popup

1. **Click the extension icon** in your toolbar
2. The current page URL is pre-filled
3. Adjust the URL, label, and media type if needed
4. Click **"📡 Send to Scanner"**

### Method 3: Selected Text

1. **Highlight any URL text** on a webpage
2. Right-click the selection
3. Choose **"Send to Media Link Scanner"**

## Supported URLs

The extension can scan:

- **Git Repositories**: GitHub, GitLab, Bitbucket, Codeberg
- **Playlists**: M3U, M3U8, PLS, XSPF files
- **Media Links**: Direct video/audio URLs
- **Packages**: APK, ZIP, RAR, 7Z files
- **Web Pages**: Any page that might contain media links

## Troubleshooting

### Connection Failed

**Problem**: Extension can't reach the API server

**Fix**: 
1. Make sure the API server is running: `npm run api:start`
2. Check the API URL in extension settings
3. Click "Test Connection" in settings to diagnose

### No Context Menu

**Problem**: Right-click menu doesn't show scanner option

**Fix**:
1. Reload the extension from the extensions page
2. Refresh the webpage
3. Make sure you're right-clicking a link or the page itself

### Scans Not Working

**Problem**: Jobs fail or don't appear

**Fix**:
1. Check the API server console for errors
2. Verify the URL format is correct
3. For repositories, ensure they're public or you have access
4. Check the Recent Jobs section in the popup for error details

## Uninstalling

### Chrome / Edge / Brave

1. Go to your extensions page
2. Find "Media Link Scanner"
3. Click "Remove"

### Firefox

1. Go to `about:addons`
2. Find "Media Link Scanner"
3. Click "Remove"

## Development Notes

The extension consists of:
- `manifest.json` - Extension configuration
- `background.js` - Background service worker
- `popup.html/js` - Popup interface
- `options.html/js` - Settings page
- `icons/` - Extension icons

To modify the extension:
1. Make your changes to the relevant files
2. Go to the extensions page in your browser
3. Click the refresh/reload icon for the extension
4. Test your changes

## Security & Privacy

- **No data collection**: The extension doesn't collect or transmit personal data
- **Local storage only**: Settings and job history stay in your browser
- **Direct API calls**: Only communicates with your local API server
- **No third-party services**: No analytics or external tracking

## Need Help?

- Check the full extension README in `browser-extension/README.md`
- Review the API documentation in `src/api/README.md`
- Check the browser console for error messages
- Verify the API server is running and accessible

---

**Enjoy scanning! 🚀**
