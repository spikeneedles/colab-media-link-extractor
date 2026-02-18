# Puppeteer Backend Service

This directory contains the optional backend service that provides headless browser capabilities using Puppeteer. This enhances the crawler and scraper functionality by enabling JavaScript rendering and sophisticated page interactions.

## Why a Backend Service?

Puppeteer is a Node.js library that cannot run directly in the browser. This backend service provides:

- **JavaScript Rendering**: Full execution of page JavaScript before content extraction
- **Dynamic Content**: Access to content loaded via AJAX, React, Vue, Angular, etc.
- **Advanced Interactions**: Form filling, button clicking, scrolling, waiting for elements
- **Screenshot Capture**: Visual verification of pages
- **Network Monitoring**: Intercept and analyze network requests
- **PDF Generation**: Convert pages to PDF for archival

## Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

```bash
cd backend
npm install
```

### Running the Service

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
```

The service will start on `http://localhost:3001` by default.

### Configuration

Create a `.env` file in the backend directory:

```env
PORT=3001
CORS_ORIGIN=http://localhost:5173
PUPPETEER_HEADLESS=true
PUPPETEER_TIMEOUT=30000
MAX_CONCURRENT_BROWSERS=5
ENABLE_SCREENSHOTS=true
CACHE_ENABLED=true
CACHE_TTL=3600
```

## API Endpoints

### POST /api/headless-browse

Navigate to a URL and extract content with JavaScript rendering.

**Request:**
```json
{
  "url": "https://example.com",
  "options": {
    "timeout": 30000,
    "waitForSelector": ".content-loaded",
    "executeScript": "document.querySelector('.data').textContent",
    "captureScreenshot": true,
    "blockImages": true,
    "blockStyles": false,
    "userAgent": "Mozilla/5.0...",
    "viewport": { "width": 1920, "height": 1080 }
  }
}
```

**Response:**
```json
{
  "html": "<html>...</html>",
  "text": "Page text content",
  "links": ["https://example.com/page1", "https://example.com/page2"],
  "scripts": ["https://cdn.example.com/app.js"],
  "metadata": {
    "title": "Page Title",
    "description": "Page description",
    "keywords": ["keyword1", "keyword2"],
    "ogImage": "https://example.com/image.jpg"
  },
  "screenshot": "data:image/png;base64,...",
  "executionTime": 1234
}
```

### POST /api/headless-execute

Execute custom JavaScript in the context of a page.

**Request:**
```json
{
  "url": "https://example.com",
  "script": "return document.querySelectorAll('video').length;",
  "options": {
    "timeout": 30000,
    "waitForSelector": "video"
  }
}
```

**Response:**
```json
{
  "data": 5,
  "executionTime": 1234
}
```

### POST /api/headless-screenshot

Capture a screenshot of a page.

**Request:**
```json
{
  "url": "https://example.com",
  "options": {
    "fullPage": true,
    "viewport": { "width": 1920, "height": 1080 }
  }
}
```

**Response:**
```json
{
  "screenshot": "data:image/png;base64,...",
  "executionTime": 1234
}
```

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "uptime": 12345,
  "activeBrowsers": 2,
  "maxBrowsers": 5
}
```

## Connecting the Frontend

In your frontend code, configure the headless browser with the backend URL:

```typescript
import { createHeadlessBrowser } from '@/lib/headlessBrowser'

const browser = createHeadlessBrowser({
  backendUrl: 'http://localhost:3001',
  enableFallback: true,
  maxRetries: 3,
  timeout: 30000,
})

// Navigate to a URL with JavaScript rendering
const result = await browser.navigate('https://example.com', {
  waitForSelector: '.content',
  captureScreenshot: true,
})

console.log('Links found:', result.links)
console.log('Metadata:', result.metadata)
```

## Docker Deployment

### Build the Image

```bash
docker build -t media-scanner-puppeteer .
```

### Run the Container

```bash
docker run -d \
  --name media-scanner-puppeteer \
  -p 3001:3001 \
  -e CORS_ORIGIN=https://your-frontend-domain.com \
  -e MAX_CONCURRENT_BROWSERS=5 \
  --restart unless-stopped \
  media-scanner-puppeteer
```

### Docker Compose

```yaml
version: '3.8'

services:
  puppeteer-backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - CORS_ORIGIN=http://localhost:5173
      - PUPPETEER_HEADLESS=true
      - MAX_CONCURRENT_BROWSERS=5
    restart: unless-stopped
    volumes:
      - ./cache:/app/cache
```

## Performance Optimization

### Browser Pool Management

The service maintains a pool of browser instances to improve performance:

- Reuses browser instances across requests
- Configurable max concurrent browsers
- Automatic cleanup of idle instances
- Queue management for high load

### Caching

Results are cached to reduce load:

- Configurable TTL (time-to-live)
- Cache invalidation strategies
- Memory-efficient storage

### Resource Blocking

Block unnecessary resources to speed up rendering:

```typescript
const result = await browser.navigate(url, {
  blockImages: true,  // Block images
  blockStyles: true,  // Block CSS
  blockFonts: true,   // Block web fonts
})
```

## Security Considerations

### CORS Configuration

Configure allowed origins in `.env`:

```env
CORS_ORIGIN=https://your-domain.com,https://another-domain.com
```

### Rate Limiting

Built-in rate limiting prevents abuse:

- Per-IP rate limits
- Global rate limits
- Configurable thresholds

### Input Validation

All inputs are validated and sanitized:

- URL validation
- Script injection prevention
- Resource limits

## Monitoring

### Health Checks

Monitor service health:

```bash
curl http://localhost:3001/api/health
```

### Logs

Service logs include:

- Request/response times
- Error tracking
- Browser pool statistics
- Memory usage

### Metrics

Available metrics:

- Request count
- Average response time
- Active browsers
- Cache hit rate
- Error rate

## Troubleshooting

### Common Issues

**Browser fails to launch:**
```bash
# Install missing dependencies (Linux)
sudo apt-get install -y \
  libnss3 \
  libatk-bridge2.0-0 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libasound2
```

**Out of memory:**
- Reduce `MAX_CONCURRENT_BROWSERS`
- Enable resource blocking
- Increase container memory limits

**Timeout errors:**
- Increase `PUPPETEER_TIMEOUT`
- Check network connectivity
- Verify target URL is accessible

## Development

### Running Tests

```bash
npm test
```

### Debugging

Enable debug logging:

```bash
DEBUG=puppeteer:* npm start
```

### Hot Reload

Development mode with automatic restart:

```bash
npm run dev
```

## Alternative: Browserless Integration

Instead of self-hosting, you can use Browserless.io:

```typescript
const browser = createHeadlessBrowser({
  backendUrl: 'https://chrome.browserless.io',
  // Add your Browserless API token in headers
})
```

## License

Same as main project (MIT)
