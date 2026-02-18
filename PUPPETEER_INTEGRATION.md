# Puppeteer Integration Guide

## Overview

The Media Link Scanner now includes powerful headless browsing capabilities using Puppeteer. This enables:

- **JavaScript Rendering**: Extract content from React, Vue, Angular, and other JavaScript-heavy sites
- **Dynamic Content**: Access AJAX-loaded content and infinite scroll pages
- **Form Automation**: Automatically fill forms and navigate through authentication
- **Screenshot Capture**: Visual verification of crawled pages
- **Network Monitoring**: Track XHR requests and API calls

## Architecture

The system uses a hybrid architecture:

```
┌─────────────────┐         ┌──────────────────┐
│  Frontend (Web) │────────▶│ Headless Browser │
│   React App     │   API   │   Module         │
└─────────────────┘         └──────────────────┘
                                     │
                           ┌─────────┴──────────┐
                           │                    │
                     ┌─────▼──────┐      ┌─────▼─────┐
                     │  Fallback  │      │ Puppeteer │
                     │  (Fetch)   │      │  Backend  │
                     └────────────┘      └───────────┘
```

**Fallback Mode**: Uses standard `fetch()` for simple static pages
**Backend Mode**: Uses Puppeteer service for JavaScript-rendered content

## Quick Start

### 1. Enable Headless Browser

In the app:
1. Click the **Advanced Crawler & Storage** section
2. Click the browser icon (🖥️) next to the scheduler
3. Toggle "Enable Headless Browser" to ON
4. (Optional) Configure backend URL if using external service

### 2. Start Puppeteer Backend (Optional but Recommended)

```bash
cd backend
npm install
npm start
```

The backend will start on `http://localhost:3001`

### 3. Configure in UI

In the Headless Browser Settings dialog:
- **Backend Service URL**: `http://localhost:3001` (or your deployed URL)
- **Block Images**: ✅ Recommended for faster crawling
- **Block Styles**: ❌ Keep enabled if site needs CSS
- **Block Fonts**: ✅ Usually safe to block
- **Page Timeout**: 30 seconds (adjust based on site speed)

## Features

### Automatic Detection

The system automatically detects when JavaScript rendering is needed:

```typescript
// Sites that will use headless browser when enabled:
- Angular apps (example.com/angular)
- React apps (app.react.example.com)
- Vue.js apps (vue.example.com)
- Next.js apps (nextjs.example.com)
- Sites with complex JavaScript
```

### Performance Optimization

The headless browser includes several optimizations:

1. **Resource Blocking**: Block unnecessary resources
   - Images: Save 50-80% bandwidth
   - Stylesheets: Faster page load
   - Fonts: Reduce requests

2. **Browser Pooling**: Reuse browser instances
   - Faster subsequent requests
   - Lower memory usage
   - Configurable pool size

3. **Response Caching**: Cache results
   - Configurable TTL
   - Per-URL caching
   - Reduced backend load

### Custom Scripts

Execute custom JavaScript on pages:

```typescript
const browser = createHeadlessBrowser({
  backendUrl: 'http://localhost:3001'
})

// Click a "Load More" button
const result = await browser.executeScript(url, `
  document.querySelector('.load-more').click();
  await new Promise(resolve => setTimeout(resolve, 2000));
  return document.querySelectorAll('.video-link').length;
`)

console.log(`Found ${result} video links after clicking`)
```

### Wait for Elements

Wait for dynamic content to load:

```typescript
const result = await browser.waitForElement(url, '.video-player', {
  timeout: 10000
})
```

### Screenshots

Capture screenshots for verification:

```typescript
const screenshot = await browser.screenshot(url, {
  fullPage: true,
  viewport: { width: 1920, height: 1080 }
})
```

## Backend Deployment

### Development

```bash
cd backend
npm run dev
```

### Production

```bash
cd backend
npm run build
npm start
```

### Docker

```bash
cd backend
docker build -t media-scanner-puppeteer .
docker run -d -p 3001:3001 media-scanner-puppeteer
```

### Docker Compose

```yaml
version: '3.8'

services:
  frontend:
    build: .
    ports:
      - "5173:5173"
    environment:
      - VITE_PUPPETEER_BACKEND=http://puppeteer:3001
  
  puppeteer:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - CORS_ORIGIN=http://localhost:5173
      - MAX_CONCURRENT_BROWSERS=5
      - CACHE_ENABLED=true
```

### Cloud Deployment

#### Heroku

```bash
cd backend
heroku create my-puppeteer-backend
git push heroku main
heroku ps:scale web=1
```

#### Railway

```bash
cd backend
railway init
railway up
```

#### Render

1. Connect repository
2. Set root directory to `backend`
3. Build command: `npm install && npm run build`
4. Start command: `npm start`

## Configuration

### Frontend Configuration

Configure in the UI or programmatically:

```typescript
import { createHeadlessBrowser } from '@/lib/headlessBrowser'

const browser = createHeadlessBrowser({
  backendUrl: 'https://your-backend.com',
  enableFallback: true,  // Use fetch() if backend fails
  maxRetries: 3,
  timeout: 30000,
})
```

### Backend Configuration

Create `.env` file:

```env
PORT=3001
CORS_ORIGIN=https://your-frontend.com
PUPPETEER_HEADLESS=true
PUPPETEER_TIMEOUT=30000
MAX_CONCURRENT_BROWSERS=5
ENABLE_SCREENSHOTS=true
CACHE_ENABLED=true
CACHE_TTL=3600
```

## Security

### CORS Configuration

Restrict backend access:

```env
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
```

### Rate Limiting

Built-in rate limiting:
- 100 requests per 15 minutes per IP
- Configurable in `backend/src/index.ts`

### Input Validation

All URLs are validated before processing:
- URL format validation
- Protocol whitelist (http/https)
- No local file access

## Troubleshooting

### Backend Won't Start

**Error**: `Failed to launch browser`

**Solution**: Install dependencies

```bash
# Ubuntu/Debian
sudo apt-get install -y \
  libnss3 libatk-bridge2.0-0 libx11-xcb1 \
  libxcomposite1 libxdamage1 libxrandr2 \
  libgbm1 libasound2

# macOS
# No additional dependencies needed

# Windows
# No additional dependencies needed
```

### Timeout Errors

**Error**: `Navigation timeout of 30000 ms exceeded`

**Solutions**:
1. Increase timeout in settings
2. Check if site is accessible
3. Enable resource blocking for faster loading
4. Check network connectivity

### Memory Issues

**Error**: `Out of memory` or high memory usage

**Solutions**:
1. Reduce `MAX_CONCURRENT_BROWSERS` in `.env`
2. Enable resource blocking (images, styles, fonts)
3. Increase Docker container memory limit
4. Enable page cleanup after each request

### Connection Refused

**Error**: `ECONNREFUSED` when connecting to backend

**Solutions**:
1. Verify backend is running: `curl http://localhost:3001/api/health`
2. Check firewall settings
3. Verify correct port in frontend configuration
4. Check CORS settings

## Performance Tips

### 1. Resource Blocking

Block unnecessary resources for 2-5x faster crawling:

```typescript
{
  blockImages: true,   // 50-80% bandwidth savings
  blockStyles: true,   // 20-30% faster load
  blockFonts: true,    // 10-20% fewer requests
}
```

### 2. Browser Pooling

Adjust concurrent browsers based on your server:

```env
# Low-end server (1-2 GB RAM)
MAX_CONCURRENT_BROWSERS=2

# Medium server (4-8 GB RAM)
MAX_CONCURRENT_BROWSERS=5

# High-end server (16+ GB RAM)
MAX_CONCURRENT_BROWSERS=10
```

### 3. Caching

Enable caching for repeated URLs:

```env
CACHE_ENABLED=true
CACHE_TTL=3600  # 1 hour
```

### 4. Selective Usage

Only use headless browser when needed:
- JavaScript-heavy sites: ✅ Use headless browser
- Static HTML sites: ❌ Use fallback fetch()
- API endpoints: ❌ Use fallback fetch()

## API Reference

### Frontend API

```typescript
import { createHeadlessBrowser } from '@/lib/headlessBrowser'

const browser = createHeadlessBrowser(config)

// Navigate to URL
const result = await browser.navigate(url, options)

// Execute script
const data = await browser.executeScript(url, script, options)

// Wait for element
const result = await browser.waitForElement(url, selector, options)

// Take screenshot
const screenshot = await browser.screenshot(url, options)
```

### Backend API

See `PUPPETEER_BACKEND.md` for complete API documentation.

## Monitoring

### Health Check

```bash
curl http://localhost:3001/api/health
```

Response:
```json
{
  "status": "ok",
  "uptime": 12345,
  "activeBrowsers": 2,
  "availableBrowsers": 3,
  "maxBrowsers": 5,
  "totalPages": 5,
  "cache": {
    "enabled": true,
    "stats": {
      "keys": 45,
      "hits": 120,
      "misses": 45,
      "ksize": 45,
      "vsize": 1024000
    }
  }
}
```

### Logs

Backend logs include:
- Request/response times
- Browser pool statistics
- Cache hit/miss rates
- Error tracking

## Examples

### Basic Crawl with Headless Browser

```typescript
// Enable in settings first, then:
const targetUrl = 'https://example-spa.com'
await crawlWebsite(targetUrl, {
  maxDepth: 3,
  maxPages: 50
})
```

### Extract Video Links from React App

```typescript
const browser = createHeadlessBrowser({
  backendUrl: 'http://localhost:3001'
})

const result = await browser.navigate('https://react-video-site.com', {
  waitForSelector: '.video-player',
  timeout: 15000
})

const videoUrls = extractMediaFromRenderedPage(result.html, result.url)
console.log(`Found ${videoUrls.length} videos`)
```

### Automated Login

```typescript
const result = await browser.executeScript(
  'https://example.com/login',
  `
    document.querySelector('#username').value = 'user';
    document.querySelector('#password').value = 'pass';
    document.querySelector('#submit').click();
    await new Promise(resolve => setTimeout(resolve, 2000));
    return document.cookie;
  `
)
```

## Support

For issues or questions:
1. Check this guide
2. Review `PUPPETEER_BACKEND.md`
3. Check backend logs
4. Open an issue on GitHub

## License

Same as main project (MIT)
