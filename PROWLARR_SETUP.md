# Prowlarr Setup Guide

Prowlarr is a free torrent indexer aggregator that handles all torrent searching through a single API.

## Why Prowlarr?

- ✅ **Bypasses network restrictions** - Runs locally, no ISP/firewall blocks
- ✅ **Free and open-source** - No cost, community-driven
- ✅ **Handles bot protection** - Manages Cloudflare, captchas, etc.
- ✅ **Aggregates multiple indexers** - One API for 100+ torrent sites
- ✅ **Rate limiting built-in** - Prevents IP bans
- ✅ **Auto retry/fallback** - Smart failover between indexers

## Installation

### Option 1: Windows Installer (Recommended)
1. Download from: https://prowlarr.com/#downloads
2. Run the installer
3. Prowlarr will start automatically on port 9696

### Option 2: Chocolatey
```powershell
choco install prowlarr
```

### Option 3: Docker
```bash
docker run -d \
  --name=prowlarr \
  -p 9696:9696 \
  -v /path/to/prowlarr/config:/config \
  --restart unless-stopped \
  linuxserver/prowlarr:latest
```

## Configuration

### 1. Access Prowlarr UI
Open your browser to: http://localhost:9696

### 2. Get API Key
1. Go to **Settings** → **General**
2. Scroll to **Security** section
3. Copy your **API Key**

### 3. Configure Your Backend
Edit `backend/.env`:
```env
PROWLARR_URL=http://localhost:9696
PROWLARR_API_KEY=your_api_key_here
```

### 4. Add Indexers (Important!)
Prowlarr needs indexers configured to search torrents:

1. Go to **Indexers** tab
2. Click **Add Indexer**
3. Add free public indexers:
   - **ThePirateBay** (various proxies available)
   - **1337x**
   - **RARBG** (mirrors like TorrentAPI)
   - **EZTV** (TV shows)
   - **Torrentz2** (meta-search)
   - **YTS** (movies)
   - **Nyaa** (anime)

**Tip:** Search for "public" in the indexer list to see all free options.

### 5. Test Configuration
```powershell
# Test Prowlarr API directly
Invoke-RestMethod -Uri "http://localhost:9696/api/v1/search?query=Inception&type=search" -Headers @{"X-Api-Key"="your_api_key"}

# Test through your backend
Invoke-RestMethod -Uri "http://localhost:3002/api/discovery/search/torrents?q=Inception"
```

## How It Works

1. **Your backend** sends search query to Prowlarr API
2. **Prowlarr** searches all configured indexers simultaneously
3. **Results aggregated** and returned in standardized format
4. **Your backend** converts to magnet links
5. **Real-Debrid** (if configured) converts magnets to streams

## Indexer Recommendations

### Best Free Public Indexers
- **1337x.to** - Movies, TV, good quality
- **ThePirateBay** - Largest selection, use proxies
- **EZTV** - Best for TV shows
- **YTS/YIFY** - High-quality movie encodes (smaller files)
- **Torrentz2** - Meta-search across multiple sites

### Private Trackers (Optional)
If you have accounts:
- **TorrentLeech**
- **IPTorrents**
- **AlphaRatio**

Many private trackers are supported but require invites/payments.

## Troubleshooting

### Prowlarr returns no results
- Check that indexers are configured (Indexers tab)
- Test individual indexers in Prowlarr UI
- Some indexers may be down temporarily

### Connection refused error
- Verify Prowlarr is running: http://localhost:9696
- Check Windows Firewall isn't blocking port 9696
- Restart Prowlarr service

### API Key invalid
- Copy fresh API key from Settings > General > Security
- Don't include spaces in .env file
- Restart your backend after updating .env

### Indexers failing
- Some sites may be blocked by your ISP
- Try different indexers
- Use VPN if needed (Prowlarr supports proxy settings)

## Advanced Configuration

### Custom Prowlarr Port
If using different port, update both:
```env
PROWLARR_URL=http://localhost:CUSTOM_PORT
```

### Multiple Categories
Prowlarr supports category filtering:
- Movies: 2000
- TV: 5000
- Anime: 5070

### FlareSolverr Integration
For Cloudflare-protected sites:
1. Install FlareSolverr: https://github.com/FlareSolverr/FlareSolverr
2. Configure in Prowlarr Settings > Indexers > FlareSolverr

## Benefits Over Direct Scraping

| Feature | Direct Scraping | Prowlarr |
|---------|----------------|----------|
| Bypass bot protection | ❌ | ✅ |
| Handle CAPTCHAs | ❌ | ✅ |
| Aggregate results | ❌ | ✅ |
| Auto failover | ❌ | ✅ |
| Rate limiting | Manual | ✅ Built-in |
| Unified API | ❌ | ✅ |
| Network restrictions | Blocked | ✅ Local bypass |

## Next Steps

After Prowlarr is configured:
1. Restart your backend server
2. Test torrent search: `/api/discovery/search/torrents?q=test`
3. Configure Real-Debrid for magnet → stream conversion
4. Process your M3U8 playlist with full metadata + torrents + streams
