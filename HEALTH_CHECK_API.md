# Health Check & SSL Certificate Monitoring API

Comprehensive health monitoring system for the Media Link Scanner with SSL certificate validity reporting.

## Features

- ✅ Real-time system health monitoring
- 🔒 SSL certificate validity checking
- 📊 Performance metrics tracking
- 💾 Memory and CPU usage monitoring
- 📡 Active jobs tracking
- ⚡ Request rate monitoring
- 🔔 Certificate expiration warnings

## API Endpoints

### 1. Comprehensive Health Check

Get complete system health including SSL certificate validation.

**Endpoint:** `GET /api/health`

**Query Parameters:**
- `ssl_domains` (optional): Domain(s) to check SSL certificates. Can be repeated for multiple domains.

**Example Request:**
```bash
curl "http://localhost:3001/api/health?ssl_domains=example.com&ssl_domains=another-domain.com"
```

**Example Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "api": {
      "status": "up",
      "responseTime": 5,
      "lastCheck": "2024-01-15T10:30:00.000Z",
      "message": "API service is operational"
    },
    "database": {
      "status": "up",
      "lastCheck": "2024-01-15T10:30:00.000Z",
      "message": "In-memory storage operational",
      "details": {
        "jobsStored": 42
      }
    },
    "crawler": {
      "status": "up",
      "lastCheck": "2024-01-15T10:30:00.000Z",
      "message": "Crawler service operational",
      "details": {
        "activeJobs": 2
      }
    },
    "ssl": {
      "status": "valid",
      "certificates": [
        {
          "subject": {
            "CN": "example.com",
            "O": "Example Inc"
          },
          "issuer": {
            "CN": "Let's Encrypt Authority",
            "O": "Let's Encrypt"
          },
          "validFrom": "2024-01-01T00:00:00.000Z",
          "validTo": "2024-04-01T00:00:00.000Z",
          "daysRemaining": 75,
          "isValid": true,
          "isExpired": false,
          "isExpiringSoon": false,
          "serialNumber": "ABC123",
          "fingerprint": "12:34:56:78...",
          "fingerprint256": "AB:CD:EF...",
          "subjectAltNames": ["example.com", "www.example.com"]
        }
      ],
      "warnings": [],
      "errors": []
    }
  },
  "system": {
    "memory": {
      "total": 16777216000,
      "used": 8388608000,
      "free": 8388608000,
      "usagePercent": 50
    },
    "cpu": {
      "loadAverage": [1.5, 1.2, 1.0],
      "coresCount": 8
    },
    "process": {
      "pid": 12345,
      "uptime": 3600,
      "memoryUsage": {
        "rss": 104857600,
        "heapTotal": 52428800,
        "heapUsed": 41943040,
        "external": 1048576
      }
    }
  },
  "metrics": {
    "totalJobs": 100,
    "activeJobs": 2,
    "completedJobs": 95,
    "failedJobs": 3,
    "totalLinksScanned": 5000,
    "averageJobDuration": 12.5,
    "requestsPerMinute": 45
  }
}
```

**Status Codes:**
- `200 OK` - System is healthy or degraded
- `503 Service Unavailable` - System is unhealthy

---

### 2. Simple Health Check

Quick health check without SSL validation.

**Endpoint:** `GET /api/health/simple`

**Example Request:**
```bash
curl http://localhost:3001/api/health/simple
```

**Example Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "active_jobs": 2
}
```

---

### 3. Single Domain SSL Check

Check SSL certificate for a specific domain.

**Endpoint:** `GET /api/health/ssl/:domain`

**Example Request:**
```bash
curl http://localhost:3001/api/health/ssl/example.com
```

**Example Response:**
```json
{
  "domain": "example.com",
  "certificate": {
    "subject": {
      "CN": "example.com",
      "O": "Example Inc"
    },
    "issuer": {
      "CN": "Let's Encrypt Authority",
      "O": "Let's Encrypt"
    },
    "validFrom": "2024-01-01T00:00:00.000Z",
    "validTo": "2024-04-01T00:00:00.000Z",
    "daysRemaining": 75,
    "isValid": true,
    "isExpired": false,
    "isExpiringSoon": false,
    "serialNumber": "ABC123",
    "fingerprint": "12:34:56:78...",
    "fingerprint256": "AB:CD:EF...",
    "subjectAltNames": ["example.com", "www.example.com"]
  },
  "status": "valid",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Status Codes:**
- `200 OK` - Certificate check successful
- `400 Bad Request` - Domain parameter missing
- `500 Internal Server Error` - SSL check failed

---

### 4. Batch SSL Check

Check SSL certificates for multiple domains at once.

**Endpoint:** `POST /api/health/ssl/batch`

**Request Body:**
```json
{
  "domains": [
    "example.com",
    "another-domain.com",
    "https://third-domain.com"
  ]
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3001/api/health/ssl/batch \
  -H "Content-Type: application/json" \
  -d '{"domains": ["example.com", "another-domain.com"]}'
```

**Example Response:**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "total_domains": 2,
  "certificates": {
    "example.com": {
      "status": "valid",
      "certificate": {
        "subject": { "CN": "example.com" },
        "validTo": "2024-04-01T00:00:00.000Z",
        "daysRemaining": 75,
        "isValid": true,
        "isExpired": false
      }
    },
    "another-domain.com": {
      "status": "expiring",
      "certificate": {
        "subject": { "CN": "another-domain.com" },
        "validTo": "2024-02-10T00:00:00.000Z",
        "daysRemaining": 25,
        "isValid": true,
        "isExpiringSoon": true
      }
    }
  }
}
```

**Status Codes:**
- `200 OK` - Batch check successful
- `400 Bad Request` - Invalid domains array
- `500 Internal Server Error` - Batch check failed

---

## Health Status Levels

### Overall System Status

- **`healthy`** - All services operational, no issues detected
- **`degraded`** - Services running but performance issues or warnings present
- **`unhealthy`** - Critical issues detected, service may be unavailable

### SSL Certificate Status

- **`valid`** - Certificate is valid and not expiring soon (>30 days)
- **`expiring`** - Certificate is valid but expires within 30 days
- **`expired`** - Certificate has expired
- **`invalid`** - Certificate is invalid or not yet valid
- **`unavailable`** - Unable to retrieve certificate information

---

## Integration Examples

### Node.js / JavaScript

```javascript
// Check health with SSL monitoring
async function checkHealth() {
  const domains = ['example.com', 'api.example.com']
  const queryString = domains.map(d => `ssl_domains=${d}`).join('&')
  
  const response = await fetch(`http://localhost:3001/api/health?${queryString}`)
  const health = await response.json()
  
  if (health.status === 'unhealthy') {
    console.error('System is unhealthy:', health)
    // Send alert
  }
  
  // Check for expiring certificates
  if (health.services.ssl) {
    health.services.ssl.certificates.forEach(cert => {
      if (cert.isExpiringSoon) {
        console.warn(`Certificate for ${cert.subject.CN} expires in ${cert.daysRemaining} days!`)
      }
    })
  }
}

// Batch SSL check
async function checkMultipleSSL() {
  const response = await fetch('http://localhost:3001/api/health/ssl/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domains: ['example.com', 'api.example.com', 'cdn.example.com']
    })
  })
  
  const result = await response.json()
  console.log(`Checked ${result.total_domains} certificates`)
}
```

### Python

```python
import requests

def check_health_with_ssl(domains):
    params = {'ssl_domains': domains}
    response = requests.get('http://localhost:3001/api/health', params=params)
    health = response.json()
    
    if health['status'] == 'unhealthy':
        print(f"System unhealthy: {health}")
    
    # Check SSL certificates
    if 'ssl' in health['services']:
        for cert in health['services']['ssl']['certificates']:
            if cert['isExpiringSoon']:
                print(f"Warning: {cert['subject']['CN']} expires in {cert['daysRemaining']} days")

def batch_ssl_check(domains):
    response = requests.post(
        'http://localhost:3001/api/health/ssl/batch',
        json={'domains': domains}
    )
    result = response.json()
    return result['certificates']

# Usage
check_health_with_ssl(['example.com', 'api.example.com'])
certificates = batch_ssl_check(['example.com', 'another.com'])
```

### cURL

```bash
# Simple health check
curl http://localhost:3001/api/health/simple

# Full health check with SSL monitoring
curl "http://localhost:3001/api/health?ssl_domains=example.com&ssl_domains=api.example.com"

# Single domain SSL check
curl http://localhost:3001/api/health/ssl/example.com

# Batch SSL check
curl -X POST http://localhost:3001/api/health/ssl/batch \
  -H "Content-Type: application/json" \
  -d '{"domains": ["example.com", "api.example.com", "cdn.example.com"]}'
```

---

## Monitoring Dashboard

The application includes a built-in React-based health monitoring dashboard accessible via the UI. Features include:

- 📊 Real-time system metrics visualization
- 🔄 Auto-refresh capability
- 🔒 SSL certificate monitoring with expiration warnings
- 📈 Performance graphs and statistics
- ⚠️ Visual alerts for degraded/unhealthy status
- 📱 Responsive design for mobile and desktop

### Using the Dashboard

1. Navigate to the Health Check section in the app
2. Add domains to monitor SSL certificates
3. Enable auto-refresh for continuous monitoring
4. View detailed certificate information including:
   - Subject and issuer details
   - Validity period
   - Days until expiration
   - Subject alternative names (SANs)
   - Certificate fingerprints

---

## Setting Up Monitoring

### Kubernetes Health Probes

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: media-scanner
spec:
  containers:
  - name: media-scanner
    image: media-scanner:latest
    livenessProbe:
      httpGet:
        path: /api/health/simple
        port: 3001
      initialDelaySeconds: 30
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /api/health
        port: 3001
      initialDelaySeconds: 10
      periodSeconds: 5
```

### Docker Health Check

```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health/simple', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"
CMD ["npm", "start"]
```

### Monitoring with Prometheus

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'media-scanner'
    scrape_interval: 30s
    metrics_path: /api/health
    static_configs:
      - targets: ['localhost:3001']
```

---

## Alerts and Notifications

Set up alerts based on health check responses:

### Certificate Expiration Alert

```javascript
async function checkAndAlert() {
  const response = await fetch('http://localhost:3001/api/health?ssl_domains=example.com')
  const health = await response.json()
  
  if (health.services.ssl) {
    health.services.ssl.certificates.forEach(cert => {
      if (cert.daysRemaining < 7) {
        sendCriticalAlert(`Certificate for ${cert.subject.CN} expires in ${cert.daysRemaining} days!`)
      } else if (cert.isExpiringSoon) {
        sendWarningAlert(`Certificate for ${cert.subject.CN} expires in ${cert.daysRemaining} days`)
      }
    })
    
    if (health.services.ssl.errors.length > 0) {
      sendCriticalAlert(`SSL Errors: ${health.services.ssl.errors.join(', ')}`)
    }
  }
}
```

---

## Best Practices

1. **Regular Monitoring**: Check health endpoints every 30-60 seconds
2. **SSL Certificate Checks**: Monitor certificates at least once per day
3. **Alert Thresholds**: 
   - Critical: < 7 days until expiration
   - Warning: < 30 days until expiration
4. **Memory Usage**: Alert if > 85% memory usage
5. **Failed Jobs**: Investigate if failure rate > 5%
6. **Response Time**: Alert if API response time > 1000ms

---

## Troubleshooting

### SSL Certificate Check Fails

**Issue:** Cannot retrieve SSL certificate

**Possible Causes:**
- Domain doesn't support HTTPS
- Certificate is self-signed
- Firewall blocking port 443
- Invalid domain name

**Solution:**
```bash
# Test manually with OpenSSL
openssl s_client -connect example.com:443 -servername example.com

# Check if domain resolves
nslookup example.com
```

### High Memory Usage

**Issue:** Memory usage > 90%

**Solution:**
- Restart the service
- Clear completed jobs
- Reduce concurrent validations
- Check for memory leaks

### Degraded Performance

**Issue:** Slow response times

**Possible Causes:**
- Too many active jobs
- High concurrent validations
- System resource constraints

**Solution:**
- Reduce `concurrentRequests` setting
- Clear old jobs
- Scale horizontally

---

## Environment Variables

```bash
# API Configuration
PORT=3001
NODE_ENV=production

# Health Check Settings
HEALTH_CHECK_INTERVAL=30000  # 30 seconds
SSL_CHECK_TIMEOUT=5000       # 5 seconds
MAX_CERTIFICATE_WARNINGS=10

# Monitoring
ENABLE_METRICS=true
METRICS_RETENTION_DAYS=30
```

---

## License

Part of Media Link Scanner - AI-Powered IPTV & Kodi Scanner
