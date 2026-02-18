# Browser Extension Installation Guide

## Quick Start

### Step 1: Generate Icons

1. Open `browser-extension/icons/generate-icons.html` in your web browser
2. Click "Download All Icons" button
3. Save all 4 icon files (icon16.png, icon32.png, icon48.png, icon128.png)
4. The files should already be in the `icons/` folder, but if you downloaded them, move them there

### Step 2: Install Extension in Browser

#### Chrome / Edge / Brave / Opera

1. Open your browser and go to the extensions page:
   - **Chrome**: `chrome://extensions/`
   - **Edge**: `edge://extensions/`
   - **Brave**: `brave://extensions/`
   - **Opera**: `opera://extensions/`

2. Enable **Developer mode** (toggle switch in top-right corner)

3. Click **"Load unpacked"** button

4. Navigate to and select the `browser-extension` folder (the entire folder, not individual files)

5. The extension should now appear in your extensions list and toolbar

6. Pin the extension to your toolbar for easy access (click the puzzle piece icon → pin)

#### Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`

2. Click **"Load Temporary Add-on..."**

3. Navigate to the `browser-extension` folder and select the `manifest.json` file

4. The extension will be loaded temporarily (it will be removed when you close Firefox)

**For permanent installation in Firefox:**
- You need to sign the extension through Mozilla's Add-on Developer Hub
- Visit [addons.mozilla.org/developers/](https://addons.mozilla.org/developers/) to submit

### Step 3: Configure the Extension

1. Click the extension icon in your browser toolbar

2. Click the **"Settings"** button

3. Configure your API endpoint:
   - **Local Development**: `http://localhost:5173/api/external-scan`
   - **Production**: `https://your-domain.com/api/external-scan`

4. (Optional) Enter an API key if your backend requires authentication

5. Click **"Test Connection"** to verify everything is working

6. Click **"Save Settings"**

### Step 4: Test the Extension

1. Navigate to any webpage with links

2. Right-click on a link

3. You should see **"Send to Media Link Scanner"** in the context menu

4. Click it to send the link to your scanner

5. A notification should appear confirming the submission

6. Click the extension icon to view the job history

## Verifying Installation

### Check Extension is Active

- The extension icon should appear in your toolbar
- If not visible, click the puzzle piece icon (Extensions menu) and pin it

### Check Context Menu

- Right-click anywhere on a webpage
- You should see "Send to Media Link Scanner" in the menu
- If not visible, try refreshing the page or reloading the extension

### Check Settings Page

- Click the extension icon → "Settings"
- The settings page should open in a new tab
- All form fields should be visible and functional

### Test API Connection

- In settings, click "Test Connection"
- Should show "Connection successful" or "Endpoint reachable"
- If it fails, check:
  - Is your Media Link Scanner app running?
  - Is the URL correct?
  - Are there any CORS issues?

## Common Issues

### Extension Not Loading

**Problem**: Error when loading unpacked extension

**Solutions**:
- Make sure you selected the entire `browser-extension` folder, not just `manifest.json`
- Check that all required files exist (manifest.json, background.js, popup.html, etc.)
- Look at the error message - it usually tells you what's wrong
- Ensure all files are in the correct locations

### Context Menu Not Appearing

**Problem**: Right-click menu doesn't show "Send to Media Link Scanner"

**Solutions**:
- Refresh the webpage (F5 or Cmd/Ctrl + R)
- Reload the extension (go to extensions page → click reload icon)
- Check browser console for errors (F12 → Console tab)
- Try restarting the browser

### Icons Not Showing

**Problem**: Extension shows default icon or broken image

**Solutions**:
- Make sure icon files exist in `browser-extension/icons/` folder
- Generate icons using `icons/generate-icons.html`
- Check that icon files are named exactly: `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`
- Reload the extension after adding icons

### API Connection Failed

**Problem**: "Failed to submit scan request" error

**Solutions**:
- Verify your Media Link Scanner app is running
- Check the API endpoint URL in settings (should end with `/api/external-scan`)
- Test the endpoint manually:
  ```bash
  curl -X POST http://localhost:5173/api/external-scan \
    -H "Content-Type: application/json" \
    -d '{"source_url":"https://example.com","label":"test","media_type":"unknown"}'
  ```
- Check browser console (F12) for detailed error messages
- Look for CORS errors - your backend must allow extension origins

### CORS Errors

**Problem**: "Access to fetch at '...' from origin 'chrome-extension://...' has been blocked by CORS policy"

**Solutions**:
- Your backend needs to allow CORS from extension origins
- Add CORS headers to your API:
  ```javascript
  // Example for Express.js
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://'))) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    }
    next();
  });
  ```

### Firefox Temporary Installation

**Problem**: Extension disappears when Firefox closes

**Solutions**:
- This is expected behavior for unsigned extensions in Firefox
- For development: Use Firefox Developer Edition or Nightly (allows unsigned extensions)
- For production: Submit extension to Mozilla Add-ons for signing
- Alternative: Use `web-ext` tool for easier development:
  ```bash
  npm install -g web-ext
  cd browser-extension
  web-ext run
  ```

## Updating the Extension

### After Making Changes

1. Go to your browser's extensions page
2. Find "Media Link Scanner"
3. Click the **reload/refresh** icon
4. The extension will reload with your changes

### After Updating Code

- No need to re-install
- Just click reload on the extensions page
- If popup or options page is open, you may need to close and reopen them

## Uninstalling

### Chrome / Edge / Brave

1. Go to extensions page (`chrome://extensions/`)
2. Find "Media Link Scanner"
3. Click **"Remove"**
4. Confirm removal

### Firefox

1. Go to `about:addons`
2. Find "Media Link Scanner"
3. Click **"Remove"**
4. Confirm removal

## Development Mode vs Production

### Development (Current Setup)

- Extension loaded from local files
- Can be updated instantly
- Shows as "unpacked" or "temporary"
- Only available on your computer

### Production Distribution

To share with others:

1. **Chrome Web Store** (Paid, $5 developer fee):
   - Create ZIP of `browser-extension` folder
   - Sign up at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
   - Upload and submit for review

2. **Firefox Add-ons** (Free):
   - Submit to [addons.mozilla.org](https://addons.mozilla.org/developers/)
   - Must pass automated and manual review

3. **Self-Hosted** (Free):
   - Provide ZIP file for download
   - Users install via "Load unpacked" (Chrome) or "Load Temporary Add-on" (Firefox)
   - Not as convenient but works immediately

## Next Steps

Once installed and configured:

1. **Test with different content types**:
   - M3U playlist links
   - Video streaming URLs
   - GitHub repositories
   - Regular web pages

2. **Check job tracking**:
   - Click extension icon
   - View recent scans
   - Verify job IDs match backend logs

3. **Monitor performance**:
   - Open browser console (F12)
   - Look for any errors
   - Check network tab for API requests

4. **Customize settings**:
   - Adjust notification preferences
   - Update API endpoint for production
   - Add API key for authentication

## Support

For help:
- Check browser console for error messages (F12)
- Review backend logs for API errors
- See main README.md for API implementation details
- Open an issue in the repository

## Security Notes

- Extension only has permissions for what it needs
- API keys stored securely in browser's encrypted storage
- No data is sent to third parties
- All communication is between extension and your own backend

## Browser Compatibility

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome | ✅ Fully Supported | Manifest V3 |
| Edge | ✅ Fully Supported | Chromium-based |
| Brave | ✅ Fully Supported | Chromium-based |
| Opera | ✅ Fully Supported | Chromium-based |
| Firefox | ⚠️ Temporary Only | Needs signing for permanent install |
| Safari | ❌ Not Supported | Different extension format required |

Safari support would require a complete rewrite using Safari's extension format.
