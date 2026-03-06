# Firebase Playlist Sync - Quick Setup

This script installs dependencies and verifies the setup for the Firebase playlist sync system.

## Prerequisites

- Node.js 18+ installed
- Firebase project created (iptv-react-native)
- Firebase service account JSON downloaded

## Backend Setup

### 1. Install Dependencies

```bash
cd backend
npm install firebase-admin
```

### 2. Place Service Account

Save your `firebase-service-account.json` to:
- `backend/firebase-service-account.json`, OR
- `backend/config/firebase-service-account.json`

### 3. Configure Environment

Add to `backend/.env`:

```env
FIREBASE_ENABLED=true
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
BACKEND_URL=http://localhost:3002
```

### 4. Start Backend

```bash
cd backend
npm run dev
```

Look for these logs:
```
[FirebaseAdmin] Service account loaded from: ./firebase-service-account.json
[FirebaseAdmin] Firebase Admin initialized successfully
[PlaylistPush] Playlist push service initialized
```

### 5. Test API

```bash
# Check status
curl http://localhost:3002/api/playlist-push/status

# Should return:
# { "enabled": true, "status": "Firebase Admin initialized" }

# Trigger manual push
curl -X POST http://localhost:3002/api/playlist-push/trigger
```

## Android App Setup

### 1. Install Dependencies

```bash
cd MyApplication
npm install @react-native-async-storage/async-storage
```

### 2. Configure Backend URL

For **Android Emulator**, update `services/playlistSyncService.ts`:

```typescript
// Change from:
const BACKEND_URL = 'http://localhost:3002'

// To:
const BACKEND_URL = 'http://10.0.2.2:3002'  // Emulator localhost
```

For **Real Device**, use your computer's IP:

```typescript
const BACKEND_URL = 'http://192.168.1.100:3002'  // Replace with your IP
```

### 3. Update Firestore Security Rules

In Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /playlists/{category} {
      allow read: if true;
      allow write: if false;
    }
    match /notifications/{notificationId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

Click **Publish**.

### 4. Add Sync Indicator to App

Edit `app/(tabs)/index.tsx` (or any screen):

```tsx
import PlaylistSyncIndicator from '@/components/PlaylistSyncIndicator'

export default function HomeScreen() {
  return (
    <View>
      <PlaylistSyncIndicator />
    </View>
  )
}
```

### 5. Run App

```bash
npm start
```

Press `a` for Android.

## Verification Checklist

### Backend

- [ ] Firebase Admin SDK installed
- [ ] Service account JSON in place
- [ ] Environment variables configured
- [ ] Backend starts without errors
- [ ] `/api/playlist-push/status` returns `enabled: true`
- [ ] Master playlist files exist in `backend/data/playlists/`

### Firebase Console

- [ ] Firestore Database enabled
- [ ] Security rules published
- [ ] `playlists` collection created (after first push)
- [ ] 6 documents in playlists collection (movies, livetv, series, adult_movies, adult_livetv, adult_series)

### Android App

- [ ] AsyncStorage dependency installed
- [ ] `BACKEND_URL` configured correctly
- [ ] App builds without errors
- [ ] `PlaylistSyncIndicator` renders
- [ ] Shows "6 / 6 synced" after sync completes

## Testing Flow

### 1. Trigger Backend Push

```bash
# Manual push all playlists
curl -X POST http://localhost:3002/api/playlist-push/trigger

# Or push single category
curl -X POST http://localhost:3002/api/playlist-push/category/movies
```

### 2. Verify Firestore

- Open Firebase Console
- Navigate to Firestore Database
- Check `playlists` collection
- Should see 6 documents with `playlistUrl`, `itemCount`, `hash`, `lastUpdated`

### 3. Check Android App

- Open app
- Navigate to screen with `PlaylistSyncIndicator`
- Should see:
  - "6 / 6 synced"
  - Green checkmarks for all categories
  - Item counts for each playlist

### 4. Test Auto-Sync

```bash
# Start a crawl (this will trigger auto-push)
curl -X POST http://localhost:3002/api/automation/start

# Watch backend logs for:
# [PlaylistPush] Category complete: movies
# [PlaylistPush] Pushing to Firebase: movies
```

Android app should automatically sync within seconds.

## Troubleshooting

### "Cannot find module 'firebase-admin'"

```bash
cd backend
npm install firebase-admin
```

### "Service account not found"

Check these locations:
```bash
ls backend/firebase-service-account.json
ls backend/config/firebase-service-account.json
```

### "Failed to fetch" in Android app

**Emulator:**
```typescript
const BACKEND_URL = 'http://10.0.2.2:3002'
```

**Real Device:**
- Ensure device on same network as backend
- Use computer's IP address
- Check firewall allows port 3002

### Firestore permission denied

- Check security rules in Firebase Console
- Ensure `allow read: if true` for playlists collection
- Click Publish after editing rules

### Playlists not syncing

**Backend:**
```bash
# Check if playlists exist
ls backend/data/playlists/

# Should show:
# movies_master.m3u
# livetv_master.m3u
# series_master.m3u
# adult_movies_master.m3u
# adult_livetv_master.m3u
# adult_series_master.m3u
```

**Android:**
```javascript
// Check AsyncStorage in Chrome DevTools
// React Native Debugger > AsyncStorage
// Should see keys: playlist_m3u_movies, playlist_meta_movies, etc.
```

## Common Commands

### Backend

```bash
# Start dev server
cd backend
npm run dev

# Check playlist push status
curl http://localhost:3002/api/playlist-push/status

# Manual push all
curl -X POST http://localhost:3002/api/playlist-push/trigger

# Manual push single category
curl -X POST http://localhost:3002/api/playlist-push/category/movies

# Get Firestore metadata
curl http://localhost:3002/api/playlist-push/metadata/movies
```

### Android App

```bash
# Install dependencies
npm install @react-native-async-storage/async-storage

# Start Metro bundler
npm start

# Run on Android
npm run android

# View logs
npx react-native log-android
```

### Firebase CLI (Optional)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# View Firestore data
firebase firestore:get playlists/movies
```

## Next Steps

After successful setup:

1. **Integrate with Media Player** - Use `usePlaylist('movies')` hook in player components
2. **Add Sync Schedule** - Implement weekly auto-sync
3. **Sync Notifications** - Show toast when new playlists available
4. **Offline Mode** - Handle graceful degradation when offline
5. **Settings Screen** - Add sync controls to app settings

## Support Files

- **Full Documentation:** `FIREBASE_PLAYLIST_SYNC.md`
- **Backend Service:** `backend/src/services/FirebaseAdminService.ts`
- **Playlist Push:** `backend/src/services/PlaylistPushService.ts`
- **API Routes:** `backend/src/routes/playlistPushRoutes.ts`
- **Android Service:** `services/playlistSyncService.ts`
- **React Hook:** `hooks/use-playlist-sync.ts`
- **UI Component:** `components/PlaylistSyncIndicator.tsx`

---

**Quick Test:**

```bash
# 1. Backend
cd backend
npm install firebase-admin
# (Place firebase-service-account.json)
npm run dev

# 2. Test API
curl -X POST http://localhost:3002/api/playlist-push/trigger

# 3. Check Firestore Console
# Should see 6 documents in playlists collection

# 4. Android App
cd ../MyApplication
npm install @react-native-async-storage/async-storage
npm run android

# 5. Verify sync in app
# Open PlaylistSyncIndicator component
```

✅ **Setup complete!**
