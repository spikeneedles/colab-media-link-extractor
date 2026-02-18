# 🐳 Docker Quick Start Guide

This guide will help you get the Media Link Scanner up and running with Docker in minutes.

## Prerequisites

- Docker Desktop or Docker Engine installed
- Docker Compose installed (usually included with Docker Desktop)
- At least 4GB RAM available
- At least 10GB disk space

## Installation

### Option 1: Using the Management Script (Recommended)

Make the script executable:
```bash
chmod +x docker.sh
```

Start the application:
```bash
# Development mode (with hot reload)
./docker.sh start-dev

# Production mode
./docker.sh start

# Full production with scaling
./docker.sh start-prod
```

### Option 2: Using Make

```bash
# Development mode
make start-dev

# Production mode
make start

# Full production with scaling
make start-prod
```

### Option 3: Using Docker Compose Directly

```bash
# Development mode
docker-compose -f docker-compose.dev.yml up -d

# Production mode
docker-compose up -d

# Full production
docker-compose -f docker-compose.prod.yml up -d
```

## Access the Application

### Development Mode
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Redis Commander**: http://localhost:8081

### Production Mode
- **Application**: http://localhost

## Common Commands

### Start/Stop Services

```bash
# Start
./docker.sh start
# or
make start

# Stop
./docker.sh stop
# or
make stop

# Restart
./docker.sh restart
# or
make restart
```

### View Logs

```bash
# All services
./docker.sh logs

# Specific service
./docker.sh logs scraper-backend

# Worker logs
./docker.sh logs-workers
```

### Check Status

```bash
# Service status
./docker.sh status
# or
make status

# Resource usage
./docker.sh stats
# or
make stats

# Health check
./docker.sh health
# or
make health
```

### Scale Workers

```bash
# Scale to 10 workers
./docker.sh scale-workers 10
# or
make scale-workers N=10
```

### Shell Access

```bash
# Open shell in backend
./docker.sh shell scraper-backend

# Open shell in worker 1
./docker.sh shell-worker 1

# Connect to Redis
./docker.sh redis-cli
```

### Backup and Restore

```bash
# Create backup
./docker.sh backup-storage

# Restore from backup
./docker.sh restore-storage backup_file.tar.gz
```

## Environment Modes

### Development Mode

Best for:
- Local development
- Testing new features
- Debugging

Features:
- Hot reload for frontend and backend
- Debug ports exposed
- Redis Commander for database inspection
- Source code mounted as volumes

```bash
./docker.sh start-dev
```

### Basic Production Mode

Best for:
- Single-server deployments
- Low to medium traffic
- Quick production setup

Features:
- 1 frontend instance
- 1 backend instance
- 2 worker instances
- Redis for job queue

```bash
./docker.sh start
```

### Full Production Mode

Best for:
- High-traffic deployments
- Production environments
- Scalability requirements

Features:
- Nginx load balancer
- 2 backend instances (load balanced)
- 5 worker instances
- Redis with Sentinel for high availability
- Resource limits and health checks

```bash
./docker.sh start-prod
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
./docker.sh logs [service-name]

# Check status
./docker.sh status

# Rebuild
./docker.sh build
```

### Out of Memory

```bash
# Check resource usage
./docker.sh stats

# Reduce workers
./docker.sh scale-workers 2

# Increase Docker memory limit in Docker Desktop settings
```

### Port Already in Use

Change ports in `docker-compose.yml`:
```yaml
ports:
  - "8080:80"  # Change 80 to 8080
```

### Redis Connection Failed

```bash
# Check Redis status
./docker.sh redis-cli

# Restart Redis
docker-compose restart redis
```

## Updating

Pull latest changes and rebuild:

```bash
# Using script
./docker.sh build
./docker.sh restart

# Using make
make update
```

## Cleanup

Remove all containers, volumes, and images:

```bash
# Using script
./docker.sh clean

# Using make
make clean
```

Remove unused Docker resources:

```bash
docker system prune -a
```

## Performance Tips

1. **Allocate sufficient resources** in Docker Desktop:
   - RAM: 4GB minimum, 8GB recommended
   - CPU: 2 cores minimum, 4 cores recommended

2. **Scale workers based on load**:
   - Light load: 2-3 workers
   - Medium load: 5-10 workers
   - Heavy load: 10-20 workers

3. **Use development mode only for development**:
   - Development mode has overhead from hot reload
   - Always use production mode for deployment

4. **Monitor resource usage**:
   ```bash
   ./docker.sh stats
   ```

5. **Regular backups**:
   ```bash
   ./docker.sh backup-storage
   ```

## Getting Help

View all available commands:

```bash
# Using script
./docker.sh help

# Using make
make help
```

## Next Steps

- Read the [full Docker documentation](./DOCKER_SETUP.md)
- Configure environment variables
- Set up SSL certificates for HTTPS
- Configure monitoring and logging
- Set up automated backups

## Support

If you encounter issues:
1. Check service logs: `./docker.sh logs [service]`
2. Check service status: `./docker.sh status`
3. Check health: `./docker.sh health`
4. View resource usage: `./docker.sh stats`
5. Review the [troubleshooting guide](./DOCKER_SETUP.md#-troubleshooting)
