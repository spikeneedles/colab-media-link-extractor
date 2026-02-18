# Docker Setup for Scrapers and Crawlers

This document explains the Docker setup for the Media Link Scanner's scraper and crawler infrastructure.

## 🐳 Architecture Overview

The application is containerized into multiple services:

- **Frontend (media-link-scanner)**: React web application served by Nginx
- **Backend API (scraper-backend)**: Express API with Puppeteer for web scraping
- **Worker Pool (scraper-worker-*)**: Multiple worker instances for parallel processing
- **Redis**: Job queue and caching layer
- **Nginx Load Balancer**: Routes traffic to multiple backend instances (production only)

## 📋 Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB+ RAM available
- 10GB+ disk space

## 🚀 Quick Start

### Development Mode

```bash
# Start development environment with hot reload
./docker.sh start-dev

# Access services:
# Frontend: http://localhost:5173
# Backend: http://localhost:3001
# Redis Commander: http://localhost:8081
```

### Production Mode

```bash
# Start basic production setup
./docker.sh start

# Access app at http://localhost
```

### Full Production with Scaling

```bash
# Start with load balancing and 5 workers
./docker.sh start-prod

# Access app at http://localhost
```

## 🛠️ Docker Compose Files

### `docker-compose.yml` (Default/Production)

Basic production setup with:
- 1 Frontend instance
- 1 Backend API instance
- 2 Worker instances
- 1 Redis instance

```bash
docker-compose up -d
```

### `docker-compose.dev.yml` (Development)

Development setup with:
- Hot reload for frontend
- Auto-restart for backend (nodemon)
- Redis Commander for debugging
- Debug ports exposed

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### `docker-compose.prod.yml` (Full Production)

Production setup with:
- Nginx load balancer
- 2 Backend API instances (load balanced)
- 5 Worker instances
- Redis with Sentinel for high availability
- Resource limits and health checks

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 🎯 Docker Images

### Frontend Image (`Dockerfile`)

Multi-stage build:
1. **Builder stage**: Installs dependencies and builds React app
2. **Production stage**: Serves static files with Nginx

### Scraper Image (`Dockerfile.scraper`)

Specialized image for scraping:
- Node.js 20 slim base
- Chromium and dependencies for Puppeteer
- Storage directories for crawler results
- Optimized environment variables

### Development Images

- `Dockerfile.dev`: Frontend with hot reload
- `backend/Dockerfile.dev`: Backend with nodemon

## 📊 Service Configuration

### Environment Variables

#### Backend/Scraper Services

```bash
NODE_ENV=production
PORT=3001
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-gpu
MAX_CONCURRENT_SCRAPERS=5
SCRAPER_TIMEOUT=300000
CRAWLER_STORAGE_PATH=/app/storage/crawlers
SCRAPER_STORAGE_PATH=/app/storage/scrapers
REDIS_URL=redis://redis:6379
```

#### Worker Services

```bash
NODE_ENV=production
WORKER_MODE=true
WORKER_ID=1
REDIS_URL=redis://redis:6379
MAX_CONCURRENT_JOBS=3
```

### Resource Limits

Workers have resource constraints:
```yaml
deploy:
  resources:
    limits:
      cpus: '1.5'
      memory: 1.5G
    reservations:
      cpus: '0.5'
      memory: 512M
```

### Health Checks

All services include health checks:
- Frontend: HTTP check on port 80
- Backend: HTTP check on `/api/health` endpoint
- Redis: `redis-cli ping` command
- Workers: Node.js HTTP check

## 🔧 Management Script (`docker.sh`)

Convenient script for managing Docker services.

### Basic Commands

```bash
# Start services
./docker.sh start          # Production
./docker.sh start-dev      # Development
./docker.sh start-prod     # Full production with scaling

# Stop services
./docker.sh stop

# Restart services
./docker.sh restart

# View status
./docker.sh status
./docker.sh stats
./docker.sh health
```

### Log Management

```bash
# View all logs
./docker.sh logs

# View specific service logs
./docker.sh logs scraper-backend
./docker.sh logs scraper-worker-1

# View scraper logs
./docker.sh logs-scraper

# View all worker logs
./docker.sh logs-workers
```

### Scaling Workers

```bash
# Scale to 10 worker instances
./docker.sh scale-workers 10

# Scale to 3 worker instances
./docker.sh scale-workers 3
```

### Build Commands

```bash
# Build all images
./docker.sh build

# Build scraper image only
./docker.sh build-scraper
```

### Shell Access

```bash
# Open shell in backend
./docker.sh shell scraper-backend

# Open shell in worker 1
./docker.sh shell-worker 1

# Connect to Redis CLI
./docker.sh redis-cli
```

### Backup and Restore

```bash
# Backup scraper storage
./docker.sh backup-storage

# Restore from backup
./docker.sh restore-storage scraper_storage_backup_20240101_120000.tar.gz
```

### Cleanup

```bash
# Remove all containers, volumes, and images
./docker.sh clean
```

## 📦 Volumes

### Persistent Volumes

```yaml
volumes:
  scraper-storage:      # Crawler/scraper results
  redis-data:           # Redis persistence
  redis-sentinel-data:  # Sentinel data (production)
```

### Storage Structure

```
scraper-storage/
├── crawlers/          # Crawler results
│   ├── job-1234/
│   └── job-5678/
├── scrapers/          # Scraper results
│   ├── site-abc/
│   └── site-xyz/
└── temp/              # Temporary files
```

## 🌐 Networking

All services communicate via the `app-network` bridge network.

### Port Mappings

**Default Production:**
- Frontend: `80:80`
- Backend: `3001:3001`
- Redis: `6379:6379`

**Development:**
- Frontend: `5173:5173`
- Backend: `3001:3001`, `9229:9229` (debug)
- Redis: `6379:6379`
- Redis Commander: `8081:8081`

**Full Production:**
- Nginx Load Balancer: `80:80`, `443:443`
- Backend instances: Internal only
- Workers: Internal only

## 🔐 Security

### Network Isolation

Services communicate via internal Docker network. Only necessary ports are exposed to the host.

### Resource Limits

Workers have CPU and memory limits to prevent resource exhaustion.

### Rate Limiting

Nginx load balancer includes rate limiting:
- API endpoints: 10 req/s with burst of 20
- Scraper endpoints: 2 req/s with burst of 5

### Puppeteer Security

Scraper containers run with security flags:
```bash
--no-sandbox
--disable-setuid-sandbox
--disable-dev-shm-usage
```

## 📈 Scaling Strategies

### Horizontal Scaling

Scale worker instances based on load:

```bash
# Development/Testing: 2-3 workers
./docker.sh scale-workers 3

# Production: 5-10 workers
./docker.sh scale-workers 10

# Heavy load: 15-20 workers
./docker.sh scale-workers 20
```

### Vertical Scaling

Adjust resource limits in `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'      # Increase CPU
      memory: 2G       # Increase memory
```

## 🚨 Troubleshooting

### Container Won't Start

```bash
# Check logs
./docker.sh logs scraper-backend

# Check container status
./docker.sh status

# Rebuild image
./docker.sh build-scraper
```

### Out of Memory

```bash
# Check resource usage
./docker.sh stats

# Reduce concurrent workers
./docker.sh scale-workers 3

# Increase Docker memory allocation
```

### Redis Connection Issues

```bash
# Check Redis health
./docker.sh redis-cli
> ping

# Restart Redis
docker-compose restart redis
```

### Puppeteer Crashes

```bash
# Check worker logs
./docker.sh logs-workers

# Common issues:
# - Insufficient shared memory: Add --disable-dev-shm-usage
# - Memory limits: Increase worker memory limits
# - Too many concurrent jobs: Reduce MAX_CONCURRENT_JOBS
```

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/docker.yml
- name: Build and push Docker images
  run: |
    docker-compose build
    docker-compose push
```

### Automated Deployment

```bash
# Pull latest images
docker-compose pull

# Restart with new images
./docker.sh restart
```

## 📊 Monitoring

### Health Checks

```bash
# Check all service health
./docker.sh health
```

### Resource Usage

```bash
# View real-time stats
./docker.sh stats

# Or use Docker stats directly
docker stats
```

### Redis Monitoring

In development mode, access Redis Commander:
```
http://localhost:8081
```

## 🎯 Best Practices

1. **Use development mode for local development**
   ```bash
   ./docker.sh start-dev
   ```

2. **Use basic production mode for single-server deployments**
   ```bash
   ./docker.sh start
   ```

3. **Use full production mode for high-traffic deployments**
   ```bash
   ./docker.sh start-prod
   ```

4. **Regularly backup scraper storage**
   ```bash
   ./docker.sh backup-storage
   ```

5. **Monitor resource usage**
   ```bash
   ./docker.sh stats
   ```

6. **Scale workers based on queue length**
   ```bash
   # Check queue in Redis Commander
   # Scale accordingly
   ./docker.sh scale-workers 10
   ```

7. **Clean up unused resources periodically**
   ```bash
   docker system prune -a
   ```

## 📝 Environment Files

Create `.env` file for custom configuration:

```bash
# Backend
PORT=3001
MAX_CONCURRENT_SCRAPERS=5
SCRAPER_TIMEOUT=300000

# Redis
REDIS_URL=redis://redis:6379

# Puppeteer
PUPPETEER_HEADLESS=true
```

## 🆘 Support

For issues related to Docker setup:
1. Check service logs: `./docker.sh logs [service]`
2. Check service status: `./docker.sh status`
3. Check health: `./docker.sh health`
4. View resource usage: `./docker.sh stats`

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Puppeteer in Docker](https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#running-puppeteer-in-docker)
- [Redis Docker Image](https://hub.docker.com/_/redis)
