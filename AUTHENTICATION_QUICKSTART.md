# API Authentication Quick Start

## 🚀 5-Minute Setup

### Step 1: Generate an API Key

```bash
cd backend
npm run generate-key
```

This will output something like:

```
🔐 API Key Generator for Media Link Scanner

════════════════════════════════════════════════════════════

🔑 Key 1:
   mls_abc123def456789...

════════════════════════════════════════════════════════════

📋 Setup Instructions:

1. Add the following to your .env file:

   API_KEYS=mls_abc123def456789...
```

### Step 2: Update .env File

Edit `backend/.env` (create from `.env.example` if needed):

```env
AUTH_ENABLED=true
API_KEYS=mls_abc123def456789...
```

### Step 3: Restart Server

```bash
npm run dev
```

### Step 4: Test It!

**Test with curl:**

```bash
curl -H "X-API-Key: mls_abc123def456789..." \
  "http://localhost:3001/api/media/stream?url=http://example.com/video.mp4"
```

**Test in browser (with query parameter):**

```
http://localhost:3001/api/media/stream?url=http://example.com/video.mp4&apiKey=mls_abc123def456789...
```

## 🎯 Usage in Your App

### Frontend (React/JavaScript)

```javascript
const API_KEY = 'mls_abc123def456789...';
const BACKEND_URL = 'http://localhost:3001';

// Method 1: Header (recommended)
fetch(`${BACKEND_URL}/api/media/stream?url=${encodeURIComponent(mediaUrl)}`, {
  headers: {
    'X-API-Key': API_KEY
  }
})

// Method 2: Query parameter (for video/audio tags)
const streamUrl = `${BACKEND_URL}/api/media/stream?url=${encodeURIComponent(mediaUrl)}&apiKey=${API_KEY}`;
videoElement.src = streamUrl;
```

### Android App

```kotlin
val apiKey = "mls_abc123def456789..."
val streamUrl = "http://your-server.com:3001/api/media/stream?url=${URLEncoder.encode(mediaUrl, "UTF-8")}&apiKey=$apiKey"

// Use in ExoPlayer or MediaPlayer
player.setMediaItem(MediaItem.fromUri(streamUrl))
```

## 🔐 Security Recommendations

**Development:**
- Auth enabled: `AUTH_ENABLED=false` (easier testing)
  
**Production:**
- Auth enabled: `AUTH_ENABLED=true`
- Use HTTPS (setup SSL/TLS)
- Rotate keys regularly
- One key per client/app
- Monitor usage logs

## 📖 Full Documentation

See [AUTHENTICATION.md](./AUTHENTICATION.md) for:
- Complete API reference
- Error handling
- Rate limiting details
- Advanced configuration
- Troubleshooting guide

## ❓ Common Issues

**"Authentication required" error?**
→ Add API key to request (see examples above)

**"Invalid API key" error?**
→ Check key in `.env` file, restart server

**"Rate limit exceeded" error?**
→ Increase `API_KEY_RATE_LIMIT` or wait for reset

## 🆘 Need Help?

1. Check [AUTHENTICATION.md](./AUTHENTICATION.md)
2. View API docs: `http://localhost:3001/api/auth/docs`
3. Check server logs for authentication status

---

**Next Steps:** Read full authentication guide in [AUTHENTICATION.md](./AUTHENTICATION.md)
