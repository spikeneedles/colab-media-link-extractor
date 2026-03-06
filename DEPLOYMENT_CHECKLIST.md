# Firebase Playlist Sync - Deployment Checklist

## Overview

This checklist walks you through deploying the Firebase playlist sync integration step-by-step.

**Estimated Time:** 30-45 minutes

---

## Prerequisites

- [ ] Firebase project exists ("iptv-react-native")
- [ ] Backend server accessible (media-link-extractor on port 3002)
- [ ] Android development environment set up (React Native/Expo)
- [ ] Firebase Console access (admin permissions)
- [ ] Node.js and npm installed

---

## Phase 1: Backend Setup

### Step 1.1: Install Dependencies

```bash
cd backend
npm install firebase-admin
```

**Verify:**
```bash
grep "firebase-admin" backend/package.json
```

Expected output:
```json
"firebase-admin": "^12.0.0"
```

---

### Step 1.2: Download Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **iptv-react-native**
3. Click Settings (gear icon) > **Project Settings**
4. Navigate to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Click **Generate Key** (confirms download)
7. Save downloaded JSON file

**Placement:**
```bash
# Option 1 (recommended):
mv ~/Downloads/iptv-react-native-*.json backend/firebase-service-account.json

# Option 2 (alternative):
mv ~/Downloads/iptv-react-native-*.json backend/config/firebase-service-account.json
```

**Security:**
```bash
chmod 600 backend/firebase-service-account.json
```

**Verify:**
```bash
ls -lh backend/firebase-service-account.json
```

Expected: `-rw------- 1 user user 2.3K ... firebase-service-account.json`

---

### Step 1.3: Configure Environment Variables

Edit `backend/.env`:

```env
# Firebase Configuration
FIREBASE_ENABLED=true
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# Backend URL (for playlist URLs in Firestore)
BACKEND_URL=http://localhost:3002

# Optional: Debounce delay (milliseconds)
PLAYLIST_PUSH_DEBOUNCE=30000
```

**Verify:**
```bash
grep "FIREBASE_ENABLED" backend/.env
```

---

### Step 1.4: Add to .gitignore

Edit `backend/.gitignore` (if not already present):

```
# Firebase service account
firebase-service-account.json
config/firebase-service-account.json
```

**Verify:**
```bash
git status backend/firebase-service-account.json
```

Expected: `No such file or directory` (not tracked)

---

### Step 1.5: Start Backend

```bash
cd backend
npm run dev
```

**Expected Logs:**
```
[FirebaseAdmin] Service account loaded from: ./firebase-service-account.json
[FirebaseAdmin] Firebase Admin initialized successfully
[Backend] Server listening on port 3002
```

**Test API:**
```bash
curl http://localhost:3002/api/playlist-push/status
```

Expected response:
```json
{
  "enabled": true,
  "status": "Firebase Admin SDK initialized successfully"
}
```

✅ **Checkpoint:** Backend configured and running

---

## Phase 2: Firestore Configuration

### Step 2.1: Create Firestore Database

1. Firebase Console > **Firestore Database**
2. Click **Create Database**
3. Select mode: **Production mode** (we'll set custom rules)
4. Choose location: **us-central** (or nearest)
5. Click **Enable**

Wait ~1 minute for provisioning.

---

### Step 2.2: Set Security Rules

1. Firestore Database > **Rules** tab
2. Replace existing rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Playlists collection: Read-only for clients, write via Admin SDK only
    match /playlists/{category} {
      allow read: if true;
      allow write: if false;
    }
    
    // Notifications collection: Read-only for clients
    match /notifications/{notificationId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

3. Click **Publish**

**Verify:**
- No errors shown after publish
- Rules tab shows updated rules

---

### Step 2.3: Test Backend Push

Trigger manual push:

```bash
curl -X POST http://localhost:3002/api/playlist-push/trigger
```

Expected response:
```json
{
  "success": true,
  "message": "Pushed 6 playlists to Firebase"
}
```

**Verify in Firestore Console:**

1. Firestore Database > **Data** tab
2. You should see **playlists** collection
3. Click to expand - should show 6 documents:
   - movies
   - livetv
   - series
   - adult_movies
   - adult_livetv
   - adult_series

**Click on any document** - should show fields:
- `playlistUrl`: `http://localhost:3002/api/archivist/playlist/movies`
- `itemCount`: (number)
- `fileSize`: (number)
- `hash`: (MD5 string)
- `lastUpdated`: (timestamp)

✅ **Checkpoint:** Firestore configured and receiving data

---

## Phase 3: Android App Setup

### Step 3.1: Install Dependencies

```bash
cd MyApplication
npm install @react-native-async-storage/async-storage
```

**Verify:**
```bash
grep "@react-native-async-storage" MyApplication/package.json
```

Expected:
```json
"@react-native-async-storage/async-storage": "^1.21.0"
```

---

### Step 3.2: Configure Backend URL

Edit `services/playlistSyncService.ts`:

**For Android Emulator:**
```typescript
// Line ~5-10
const BACKEND_URL = 'http://10.0.2.2:3002'  // Emulator uses this to reach host machine
```

**For Real Android Device:**
```typescript
// First, get your computer's IP:
// Windows: ipconfig | findstr IPv4
// Mac/Linux: ifconfig | grep "inet "
// Example: 192.168.1.100

const BACKEND_URL = 'http://192.168.1.100:3002'  // Replace with YOUR IP
```

**Verify Backend Accessible:**
```bash
# From your Android device's browser or terminal:
curl http://10.0.2.2:3002/api/playlist-push/status  # Emulator
# OR
curl http://192.168.1.100:3002/api/playlist-push/status  # Real device
```

Expected: `{"enabled":true,...}`

---

### Step 3.3: Add Sync Indicator to UI

Edit `app/(tabs)/index.tsx` (or any screen):

```tsx
import { PlaylistSyncIndicator } from '@/components/PlaylistSyncIndicator'

export default function HomeScreen() {
  return (
    <ScrollView>
      {/* ... existing content ... */}
      
      <PlaylistSyncIndicator />
      
      {/* ... more content ... */}
    </ScrollView>
  )
}
```

---

### Step 3.4: Start Android App

**For Emulator:**
```bash
npm run android
```

**For Expo:**
```bash
npx expo start
# Then press 'a' for Android
```

**Expected Logs:**
```
[PlaylistSync] Starting Firestore listener
[PlaylistSync] Received 6 playlist updates
[PlaylistSync] modified: movies
[PlaylistSync] Downloading movies from http://10.0.2.2:3002/...
[PlaylistSync] ✓ movies synced (1523 items)
[PlaylistSync] ✓ livetv synced (892 items)
...
```

**In App:**
- PlaylistSyncIndicator should appear
- Shows "Playlist Sync" header
- Shows "6 / 6 synced" after ~10-30 seconds
- Each category shows green checkmark (✓)

✅ **Checkpoint:** Android app syncing successfully

---

## Phase 4: End-to-End Testing

### Test 1: Automatic Sync After Crawl

1. **Trigger Backend Crawl:**
   ```bash
   curl -X POST http://localhost:3002/api/automation/start
   ```

2. **Monitor Backend Logs:**
   Look for:
   ```
   [Backend] Category complete: movies
   [PlaylistPush] Pending categories: Set(1) { 'movies' }
   [PlaylistPush] Debounce timer started (30s)
   ...
   [PlaylistPush] Processing pending categories
   [PlaylistPush] movies: hash changed, pushing update
   ```

3. **Check Android App:**
   - Should see download animation (⟳) briefly
   - Then green checkmark (✓)
   - Last sync time updates

**Expected:** Playlist updates arrive in app within 1-2 minutes of crawl completion

---

### Test 2: Manual Sync

1. **In Android App:**
   - Tap "Sync All" button in PlaylistSyncIndicator
   - Should see loading indicators
   - All 6 categories download

2. **Or via API:**
   ```bash
   curl -X POST http://localhost:3002/api/playlist-push/category/movies
   ```

**Expected:** Movies category re-syncs immediately

---

### Test 3: Offline/Online Behavior

1. **While App Running:**
   - Enable airplane mode on device
   - Backend continues crawling

2. **Trigger Update:**
   ```bash
   curl -X POST http://localhost:3002/api/playlist-push/trigger
   ```

3. **Disable Airplane Mode:**
   - App should auto-sync within seconds
   - Shows all missed updates

**Expected:** Firestore catches up automatically on reconnect

---

### Test 4: Access Synced Playlists

```tsx
import { usePlaylist } from '@/hooks/use-playlist-sync'

function TestComponent() {
  const { playlist, status } = usePlaylist('movies')
  
  useEffect(() => {
    if (playlist) {
      console.log('Movies M3U content:', playlist.substring(0, 200))
      // Parse M3U here
    }
  }, [playlist])
  
  return <Text>{status?.status}</Text>
}
```

**Expected:** Console shows M3U content starting with `#EXTM3U`

---

## Phase 5: Production Preparation

### Step 5.1: Update Backend URL for Production

**Backend `.env`:**
```env
BACKEND_URL=https://your-production-domain.com
```

**Android `playlistSyncService.ts`:**
```typescript
const BACKEND_URL = 'https://your-production-domain.com'
```

---

### Step 5.2: Enable HTTPS

**Backend:**
```bash
# Option 1: SSL certificates (see SSL_SETUP.md)
# Option 2: Reverse proxy (nginx, see nginx-ssl.conf)
# Option 3: Cloud hosting (automatically provided)
```

---

### Step 5.3: Configure Firewall

**Allow Port 3002:**
```bash
# Windows Firewall
New-NetFirewallRule -DisplayName "Backend API" -Direction Inbound -LocalPort 3002 -Protocol TCP -Action Allow

# Linux (ufw)
sudo ufw allow 3002/tcp
```

---

### Step 5.4: Set Up Monitoring

**Backend Logging:**
```env
LOG_LEVEL=info
LOG_FILE=./logs/backend.log
```

**Firebase Usage:**
- Monitor Firestore reads/writes in [Firebase Console > Usage](https://console.firebase.google.com/)
- Free tier: 50K reads, 20K writes per day
- Current usage: ~6 writes per crawl, ~6 reads per app start

---

### Step 5.5: Backup Strategy

**Firestore Export:**
```bash
gcloud firestore export gs://your-bucket/firestore-backup
```

**Schedule:** Daily via Cloud Scheduler

---

## Troubleshooting

### Issue: "Cannot find module 'firebase-admin'"

**Fix:**
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

---

### Issue: "Service account not found"

**Check Paths:**
```bash
ls backend/firebase-service-account.json
ls backend/config/firebase-service-account.json
```

**Re-download** from Firebase Console if missing.

---

### Issue: "Firestore permission denied"

**Verify Rules:**
```javascript
match /playlists/{category} {
  allow read: if true;  // Must be true for client reads
}
```

**Publish** rules again if changed.

---

### Issue: Android app not syncing

**Check Network:**
```bash
# From Android device terminal (adb shell):
ping 10.0.2.2  # Emulator
ping 192.168.1.100  # Real device
curl http://10.0.2.2:3002/api/playlist-push/status
```

**Check Logs:**
```bash
npx react-native log-android | grep PlaylistSync
```

---

### Issue: Hash always changes (constant re-downloads)

**Debugging:**
```bash
# Check backend hash calculation
curl http://localhost:3002/api/playlist-push/metadata/movies
# Note the "hash" field

# Manually calculate hash
cd backend/data/playlists
md5sum movies_master.m3u
```

**Should match** Firestore hash.

---

## Verification Checklist

Before deploying to production:

### Backend
- [ ] `firebase-admin` installed
- [ ] Service account JSON placed and secured (chmod 600)
- [ ] Environment variables set
- [ ] Backend starts without errors
- [ ] `/api/playlist-push/status` returns `{"enabled":true}`
- [ ] Manual push creates 6 Firestore documents
- [ ] Crawler events trigger automatic pushes
- [ ] Logs show successful Firestore writes

### Firestore
- [ ] Database created in production mode
- [ ] Security rules published
- [ ] `playlists` collection has 6 documents
- [ ] Each document has required fields (playlistUrl, itemCount, etc.)
- [ ] Android app can read documents (no permission errors)

### Android App
- [ ] `@react-native-async-storage/async-storage` installed
- [ ] Backend URL configured correctly
- [ ] Network connectivity verified (curl test)
- [ ] Firebase client SDK initialized (services/firebase.ts)
- [ ] PlaylistSyncIndicator shows "6 / 6 synced"
- [ ] Logs show successful downloads
- [ ] AsyncStorage contains playlists (DevTools check)
- [ ] usePlaylist hook returns M3U content

### Integration
- [ ] End-to-end test: crawl → Firestore → app (passes)
- [ ] Manual sync test (passes)
- [ ] Offline/online test (passes)
- [ ] Hash change detection working (no redundant downloads)
- [ ] All 6 categories syncing

---

## Next Steps

After deployment:

1. **Media Player Integration:**
   - Use `usePlaylist(category)` in player components
   - Parse M3U content
   - Load video sources

2. **UI Enhancements:**
   - Add refresh button to home screen
   - Show last sync time in app header
   - Add settings for auto-sync preferences

3. **Monitoring:**
   - Set up Firebase usage alerts
   - Monitor AsyncStorage size
   - Track sync success rate

4. **Optimizations:**
   - Implement playlist compression
   - Add partial sync (delta updates)
   - Background sync worker

---

## Support Resources

- **Full Documentation:** [FIREBASE_PLAYLIST_SYNC.md](./FIREBASE_PLAYLIST_SYNC.md)
- **Quick Start:** [FIREBASE_SYNC_QUICKSTART.md](./FIREBASE_SYNC_QUICKSTART.md)
- **Implementation Details:** [FIREBASE_SYNC_IMPLEMENTATION.md](./FIREBASE_SYNC_IMPLEMENTATION.md)
- **Firebase Console:** https://console.firebase.google.com/
- **Android Debug Logs:** `npx react-native log-android`
- **Backend Logs:** `backend/logs/` or console output

---

**Status:** Ready for deployment
**Estimated Completion:** ✅ 100%
**Prerequisites Met:** Pending user action

Good luck! 🚀
