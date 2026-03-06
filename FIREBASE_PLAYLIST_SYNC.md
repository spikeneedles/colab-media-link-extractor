# Firebase Playlist Sync System

Complete integration between the media-link-extractor backend and the Android IPTV app for automatic playlist synchronization using Firebase/Firestore.

## Architecture Overview

```
Backend (media-link-extractor)
  ├── Crawler Events (categoryComplete, cycleComplete)
  ├── PlaylistPushService (debouncing, change detection)
  └── FirebaseAdminService (Firestore sync)
           ↓
      Firestore Cloud
      playlists/{category}
           ↓
Android App (MyApplication)
  ├── PlaylistSyncService (Firestore listener)
  ├── usePlaylistSync hook
  └── PlaylistSyncIndicator UI
```

## Features

✅ **Automatic Push** - Playlists pushed to Firestore after each crawl session
✅ **Offline-First Sync** - Works even when device is not connected
✅ **Real-time Updates** - Firestore listeners trigger immediate sync
✅ **Change Detection** - Only syncs when playlist content changes (MD5 hash)
✅ **Debouncing** - Prevents excessive pushes during rapid crawler events (30s)
✅ **Retry Logic** - Automatic retry on download failures (3 attempts)
✅ **Progress Tracking** - Visual sync status indicators
✅ **Manual Controls** - Trigger sync manually per category or all

## Setup Instructions

### 1. Backend Configuration

#### Install Dependencies

```bash
cd backend
npm install firebase-admin
```

#### Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **iptv-react-native**
3. Navigate to **Project Settings > Service Accounts**
4. Click **Generate New Private Key**
5. Save as `firebase-service-account.json`
6. Place file in one of these locations:
   - `backend/firebase-service-account.json`
   - `backend/config/firebase-service-account.json`
   - `/etc/secrets/firebase-service-account.json`

#### Environment Variables

Add to `backend/.env`:

```env
# Firebase Admin SDK
FIREBASE_ENABLED=true
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# Backend API URL (used in playlist URLs)
BACKEND_URL=http://your-server:3002
```

#### Verify Backend Setup

Start the backend:

```bash
cd backend
npm run dev
```

Check logs for:
```
[FirebaseAdmin] Service account loaded from: ./firebase-service-account.json
[FirebaseAdmin] Firebase Admin initialized successfully
[PlaylistPush] Playlist push service initialized
```

Test the API:

```bash
# Check Firebase status
curl http://localhost:3002/api/playlist-push/status

# Trigger manual push
curl -X POST http://localhost:3002/api/playlist-push/trigger
```

### 2. Android App Configuration

#### Install Dependencies

```bash
cd MyApplication
npm install @react-native-async-storage/async-storage
```

#### Firebase Client SDK

Already configured in `services/firebase.ts`:
- Project ID: `iptv-react-native`
- Firestore enabled

#### Enable Firestore Security Rules

In Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Playlists collection - read-only for all, write for server only
    match /playlists/{category} {
      allow read: if true;
      allow write: if false; // Server-side only
    }
    
    // Notifications collection - read-only for all
    match /notifications/{notificationId} {
      allow read: if true;
      allow write: if false; // Server-side only
    }
  }
}
```

#### Using the Sync System

**Basic Usage:**

```tsx
import { usePlaylistSync } from '@/hooks/use-playlist-sync'

function MyComponent() {
  const { statuses, stats, syncAll, isReady } = usePlaylistSync()
  
  return (
    <View>
      <Text>Synced: {stats.syncedPlaylists} / {stats.totalPlaylists}</Text>
      <Button title="Sync All" onPress={syncAll} />
    </View>
  )
}
```

**Sync Status Indicator:**

```tsx
import PlaylistSyncIndicator from '@/components/PlaylistSyncIndicator'

function SettingsScreen() {
  return <PlaylistSyncIndicator />
}
```

**Access Synced Playlists:**

```tsx
import { usePlaylist } from '@/hooks/use-playlist-sync'

function MoviesPlayer() {
  const { status, playlist, sync } = usePlaylist('movies')
  
  useEffect(() => {
    if (playlist) {
      // Parse M3U content and load into player
      console.log('Movies playlist loaded:', playlist.length, 'bytes')
    }
  }, [playlist])
  
  return (
    <View>
      <Text>Status: {status?.status}</Text>
      {status?.itemCount && <Text>{status.itemCount} movies</Text>}
      <Button title="Refresh" onPress={sync} />
    </View>
  )
}
```

## Firestore Data Structure

### Playlists Collection

Document ID: Category name (e.g., `movies`, `livetv`, `series`)

```json
{
  "playlistUrl": "http://localhost:3002/api/archivist/playlist/movies",
  "itemCount": 1523,
  "fileSize": 245678,
  "hash": "a3b4c5d6e7f8...",
  "lastUpdated": "2024-01-15T10:30:00.000Z"
}
```

### Notifications Collection

Document ID: Auto-generated

```json
{
  "type": "playlist_update",
  "categories": ["movies", "livetv"],
  "timestamp": "2024-01-15T10:30:00.000Z",
  "message": "2 playlists updated"
}
```

## Playlist Categories

| Category | Description | Master File |
|----------|-------------|-------------|
| `movies` | Movies | `movies_master.m3u` |
| `livetv` | Live TV channels | `livetv_master.m3u` |
| `series` | TV series | `series_master.m3u` |
| `adult_movies` | Adult movies | `adult_movies_master.m3u` |
| `adult_livetv` | Adult live TV | `adult_livetv_master.m3u` |
| `adult_series` | Adult series | `adult_series_master.m3u` |

## Backend Services

### FirebaseAdminService

**Location:** `backend/src/services/FirebaseAdminService.ts`

**Responsibilities:**
- Initialize Firebase Admin SDK
- Push playlist updates to Firestore
- Create notification documents
- Cleanup old notifications

**Key Methods:**
```typescript
pushPlaylistUpdate(update: PlaylistUpdate): Promise<void>
pushAllPlaylists(updates: PlaylistUpdate[]): Promise<void>
notifyPlaylistUpdate(categories: string[]): Promise<void>
cleanupNotifications(): Promise<void>
```

### PlaylistPushService

**Location:** `backend/src/services/PlaylistPushService.ts`

**Responsibilities:**
- Listen to crawler events
- Debounce rapid updates (30s)
- Calculate MD5 hashes for change detection
- Coordinate with FirebaseAdminService

**Event Handlers:**
```typescript
onCrawlComplete(crawlResult: CrawlResult): void  // Per-category
onCycleComplete(): void                          // Full cycle
manualPush(categories?: string[]): Promise<void> // Manual trigger
```

### API Endpoints

**Base Path:** `/api/playlist-push`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | Check Firebase enabled status |
| POST | `/trigger` | Manually push all playlists |
| POST | `/category/:category` | Push single category |
| GET | `/metadata/:category` | Get Firestore metadata |

**Example:**

```bash
# Get sync status
curl http://localhost:3002/api/playlist-push/status

# Manually trigger movies sync
curl -X POST http://localhost:3002/api/playlist-push/category/movies

# Get movies metadata from Firestore
curl http://localhost:3002/api/playlist-push/metadata/movies
```

## Android App Services

### PlaylistSyncService

**Location:** `services/playlistSyncService.ts`

**Responsibilities:**
- Listen to Firestore playlist collection
- Download M3U files when hash changes
- Store locally using AsyncStorage
- Manage sync queue and retry logic

**Key Methods:**
```typescript
startSync(): void                                    // Start Firestore listener
stopSync(): void                                     // Stop listener
manualSync(category: PlaylistCategory): Promise<void>
manualSyncAll(): Promise<void>
getLocalPlaylist(category: PlaylistCategory): Promise<string | null>
onStatusChange(callback: StatusCallback): UnsubscribeFn
```

### usePlaylistSync Hook

**Location:** `hooks/use-playlist-sync.ts`

**Returns:**
```typescript
{
  statuses: Map<string, PlaylistSyncStatus>  // All sync statuses
  stats: SyncStats                           // Overall statistics
  isReady: boolean                           // Service initialized
  syncAll: () => Promise<void>               // Sync all playlists
  syncCategory: (cat) => Promise<void>       // Sync one category
  getPlaylist: (cat) => Promise<string>      // Get local M3U
  getAllPlaylists: () => Promise<Map>        // Get all local M3Us
}
```

### usePlaylist Hook

**Location:** `hooks/use-playlist-sync.ts`

Single-category convenience hook:

```typescript
const { status, playlist, sync } = usePlaylist('movies')
```

## Workflow

### Automatic Sync Flow

1. **Backend Crawl** - BackgroundCrawler processes sources
2. **Category Complete** - Emits `categoryComplete` event
3. **Debounce** - PlaylistPushService waits 30s for more events
4. **Change Detection** - Calculates MD5 hash of playlist file
5. **Push to Firestore** - Updates Firestore document if changed
6. **Firestore Listener** - Android app receives real-time update
7. **Download M3U** - PlaylistSyncService downloads playlist
8. **Local Storage** - Saves to AsyncStorage
9. **UI Update** - Components re-render with new data

### Manual Sync Flow

**Backend:**
```bash
curl -X POST http://localhost:3002/api/playlist-push/trigger
```

**Android App:**
```tsx
const { syncAll } = usePlaylistSync()
await syncAll()
```

## Testing

### End-to-End Test

1. **Start Backend:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Trigger Crawl:**
   ```bash
   # Via API
   curl -X POST http://localhost:3002/api/automation/start
   
   # Or trigger manual push
   curl -X POST http://localhost:3002/api/playlist-push/trigger
   ```

3. **Check Firestore:**
   - Open Firebase Console
   - Navigate to Firestore Database
   - Verify `playlists` collection has 6 documents

4. **Run Android App:**
   ```bash
   cd MyApplication
   npm start
   ```

5. **Verify Sync:**
   - Add `<PlaylistSyncIndicator />` to a screen
   - Should show "6 / 6 synced"
   - Check AsyncStorage for playlist data

### Debugging

**Backend Logs:**
```
[FirebaseAdmin] Pushing playlist update: movies
[PlaylistPush] Debounce timer started for movies (30s)
[PlaylistPush] Processing category: movies (hash: a3b4c5d6...)
```

**Android Logs:**
```
[PlaylistSync] Received 1 playlist updates
[PlaylistSync] modified: movies
[PlaylistSync] Downloading movies from http://localhost:3002/...
[PlaylistSync] ✓ movies synced (1523 items)
```

## Troubleshooting

### Backend Issues

**Firebase Admin not initializing:**
- Check service account JSON file exists
- Verify path in logs: `[FirebaseAdmin] Service account loaded from: ...`
- Ensure JSON has valid credentials

**Playlists not pushing:**
- Check crawler is running: `curl http://localhost:3002/api/automation/status`
- Verify ArchivistService created master playlists: `ls backend/data/playlists/`
- Check event hooks in `backend/src/index.ts`

### Android App Issues

**Firestore listener not working:**
- Verify Firebase client SDK initialized: check `services/firebase.ts`
- Ensure Firestore security rules allow read access
- Check network connectivity

**Playlists not downloading:**
- Verify `BACKEND_URL` is accessible from Android device/emulator
- For emulator, use `http://10.0.2.2:3002` instead of `localhost`
- Check AsyncStorage permissions

**State not updating:**
- Ensure `usePlaylistSync()` called in component
- Check React Native logs for errors
- Verify hook mounted before attempting sync

## Configuration Options

### Backend Environment Variables

```env
# Firebase
FIREBASE_ENABLED=true
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# API URL (must be accessible from Android device)
BACKEND_URL=http://your-server:3002

# Playlist push debounce time (milliseconds)
PLAYLIST_PUSH_DEBOUNCE=30000
```

### Android App Configuration

Update `services/playlistSyncService.ts`:

```typescript
// Change backend URL
const BACKEND_URL = 'http://your-server:3002'

// Change retry settings
const MAX_RETRY_ATTEMPTS = 5
const RETRY_DELAY_MS = 5000
```

## Security Considerations

1. **Firestore Rules** - Enforce read-only access for clients
2. **Service Account** - Never commit `firebase-service-account.json` to git
3. **HTTPS** - Use HTTPS for production backend URLs
4. **API Authentication** - Enable backend auth (`AUTH_ENABLED=true`)
5. **Content Validation** - Validate M3U content before parsing

## Performance Tips

1. **Batch Writes** - FirebaseAdminService uses batch writes for multiple playlists
2. **Local Caching** - PlaylistSyncService stores metadata to avoid redundant downloads
3. **Debouncing** - 30s debounce prevents excessive Firestore writes
4. **Hash Comparison** - Only downloads when content actually changes
5. **Firestore Limits** - Cleanup notifications to stay under quota

## Future Enhancements

- [ ] Playlist diff viewer (show what changed)
- [ ] Partial sync (only download changed entries)
- [ ] Background sync worker for iOS
- [ ] Sync scheduling (daily, weekly, etc.)
- [ ] Playlist versioning/rollback
- [ ] Compression for large playlists
- [ ] Peer-to-peer sync for local network
- [ ] Export/import sync settings

## Files Created

### Backend
- `backend/src/services/FirebaseAdminService.ts` (185 lines)
- `backend/src/services/PlaylistPushService.ts` (203 lines)
- `backend/src/routes/playlistPushRoutes.ts` (148 lines)
- `backend/src/index.ts` (modified - event hooks + route registration)

### Android App
- `services/playlistSyncService.ts` (400+ lines)
- `hooks/use-playlist-sync.ts` (150 lines)
- `components/PlaylistSyncIndicator.tsx` (250 lines)

## Support

For issues or questions:
1. Check backend logs: `backend/logs/`
2. Check Android logs: `npx react-native log-android`
3. Verify Firestore data in Firebase Console
4. Test API endpoints with curl
5. Review this README for configuration

---

**Status:** ✅ Complete and ready for testing
**Last Updated:** 2024-01-15
