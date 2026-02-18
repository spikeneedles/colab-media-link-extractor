# Extension Integration Quick Reference

## What Just Got Built

### 1. **Backend Extension API** (`backend/src/routes/extensionRoutes.ts`)
- HTTP endpoints for extension communication
- Session management
- Media capture handling
- Crawler integration pipeline

### 2. **Frontend Components**
- **ExtensionManager** (`src/components/ExtensionManager.tsx`)
  - Dashboard to view connected extensions
  - Display captured media
  - Process media with crawlers
  - Mock player for testing

- **MockMediaPlayer** (`src/components/MockMediaPlayer.tsx`)
  - Simulates a video player
  - Captures URLs when "played"
  - Tests extension integration

### 3. **React Hooks**
- **useExtensionBridge** (`src/hooks/useExtensionBridge.ts`)
  - Register extensions
  - Capture media
  - Manage sessions
  - Fetch captured media

### 4. **Sample Extension** (`extension-sample/`)
```
extension-sample/
├── manifest.json     # Extension configuration
├── background.js     # Extension service worker
├── content.js        # Content script for media capture
├── popup.html        # Extension popup UI
└── popup.js          # Popup logic
```

## How It Works

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   USER WATCHES VIDEO                        │
│              (on any website via extension)                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│            EXTENSION DETECTS VIDEO/MEDIA URL               │
│         (from <video> tags, network requests, etc)         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│          BACKGROUND SCRIPT SENDS TO WEB APP                 │
│         POST /api/extension/capture                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│        WEB APP PROCESSES WITH PATTERNS & CRAWLERS           │
│     (Using AI patterns + human-created patterns)            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│          USER VIEWS ALL CAPTURED MEDIA IN UI                │
│         (ExtensionManager dashboard)                        │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

### For Extensions

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/extension/register` | POST | Register new extension |
| `/api/extension/heartbeat` | POST | Keep-alive signal |
| `/api/extension/capture` | POST | Send captured URL |
| `/api/extension/sessions` | GET | List active sessions |
| `/api/extension/media/all` | GET | Get all captured media |
| `/api/extension/process` | POST | Process with crawlers |
| `/api/extension/sessions/:id` | DELETE | Disconnect session |

### For Web App

```tsx
import { ExtensionManager } from '@/components/ExtensionManager'

export default function App() {
  return <ExtensionManager />
}
```

## Installing the Sample Extension

### Chrome/Edge

1. Go to `chrome://extensions/` (or `edge://extensions/`)
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension-sample/` folder
5. Extension appears in toolbar

### Firefox

1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `extension-sample/manifest.json`
4. Extension loads (temporary until restart)

## Testing the Integration

### Step 1: Start Web App
```bash
npm run dev
```

### Step 2: Install Extension
- Load `extension-sample/` as described above

### Step 3: Open Extension Manager
- Go to http://localhost:5173
- Should show "Extension Manager" page

### Step 4: Test Mock Player
1. Click "Launch Mock Media Player"
2. Enter test URL: `https://example.com/stream.m3u8`
3. Click "Capture & Send to Bridge"
4. Media appears in captured list

### Step 5: Test Real Extension
1. Visit any website with video content
2. Check if media URLs appear in Extension Manager
3. Click "Process with Crawler" to analyze

## Customizing for Your Needs

### Change Web App URL
In `extension-sample/background.js`:
```javascript
const WEB_APP_URL = 'http://localhost:5173' // Change here
```

### Add More Media Detection
Modify `extension-sample/content.js`:
```javascript
const mediaPatterns = [
  '.m3u8',
  '.ts',
  'stream',
  // Add more patterns here
]
```

### Filter Captured URLs
In `useExtensionBridge`:
```typescript
const captureMedia = useCallback(async (url, title, metadata) => {
  // Add filtering logic here
  if (!shouldCapture(url)) return
  // ...
})
```

## Key Features

✅ **Real-time Capture** - Automatically detect media as it loads  
✅ **Multi-session** - Support multiple extensions simultaneously  
✅ **Heartbeat System** - Keep sessions alive  
✅ **Metadata** - Capture quality, format, source info  
✅ **Mock Player** - Test without real extensions  
✅ **Dashboard** - View all captured media  
✅ **Crawler Integration** - Process captured URLs with patterns  
✅ **Pattern Support** - Use 50+ built-in patterns or AI-generated ones  

## Performance Tips

1. **Rate Limiting**: Don't send more than 5 captures/second
2. **Deduplication**: Skip duplicate URLs (already implemented)
3. **Cleanup**: Remove old sessions after 30+ seconds inactive
4. **Batching**: Group captures into batches of 5-10
5. **Storage**: Media stored in-memory, persists across extension reload

## Troubleshooting

### Extension Not Connecting
- [ ] Check web app is running (http://localhost:5173)
- [ ] Verify extension has proper permissions
- [ ] Check browser console for errors
- [ ] Ensure `WEB_APP_URL` is correct

### Media Not Captured
- [ ] Extension may not have permission for that site
- [ ] Video might be encrypted/protected
- [ ] Check if content script is injected
- [ ] Look for network errors in DevTools

### Slow Performance
- [ ] Reduce capture frequency
- [ ] Clear old media periodically
- [ ] Check browser memory usage
- [ ] Reduce heartbeat interval

## Next Steps

1. **Customize** the sample extension for your use case
2. **Deploy** your extension to Chrome Web Store
3. **Integrate** pattern system with crawlers
4. **Monitor** captured media in production
5. **Optimize** based on real-world usage

## Resources

- [EXTENSION_INTEGRATION.md](EXTENSION_INTEGRATION.md) - Full integration guide
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Web App Patterns](data/patterns-human.json) - Available patterns
- [API Documentation](backend/src/routes/extensionRoutes.ts) - API reference

---

**Ready to capture media? Start with the mock player, then deploy the real extension!** 🚀
