#!/bin/bash

# Docker Management Script for Media Link Scanner
# Provides easy commands to manage Docker containers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Main commands
case "$1" in
    start)
        print_info "Starting Media Link Scanner in production mode..."
        docker-compose up -d
        print_success "Services started successfully!"
        print_info "Access the app at http://localhost"
        ;;
    
    start-dev)
        print_info "Starting Media Link Scanner in development mode..."
        docker-compose -f docker-compose.dev.yml up -d
        print_success "Development environment started!"
        print_info "Frontend: http://localhost:5173"
        print_info "Backend: http://localhost:3001"
        print_info "Redis Commander: http://localhost:8081"
        ;;
    
    start-prod)
        print_info "Starting Media Link Scanner with full production scaling..."
        docker-compose -f docker-compose.prod.yml up -d
        print_success "Production environment started with load balancing!"
        ;;
    
    stop)
        print_info "Stopping all services..."
        docker-compose down
        docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
        docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
        print_success "All services stopped"
        ;;
    
    restart)
        print_info "Restarting services..."
        $0 stop
        sleep 2
        $0 start
        ;;
    
    logs)
        if [ -z "$2" ]; then
            docker-compose logs -f
        else
            docker-compose logs -f "$2"
        fi
        ;;
    
    logs-scraper)
        print_info "Showing scraper backend logs..."
        docker-compose logs -f scraper-backend
        ;;
    
    logs-workers)
        print_info "Showing all worker logs..."
        docker-compose logs -f scraper-worker-1 scraper-worker-2
        ;;
    
    scale-workers)
        if [ -z "$2" ]; then
            print_error "Please specify number of workers (e.g., ./docker.sh scale-workers 5)"
            exit 1
        fi
        print_info "Scaling scraper workers to $2 instances..."
        docker-compose up -d --scale scraper-worker="$2"
        print_success "Workers scaled to $2 instances"
        ;;
    
    status)
        print_info "Service Status:"
        docker-compose ps
        ;;
    
    stats)
        print_info "Resource Usage:"
        docker stats --no-stream
        ;;
    
    build)
        print_info "Building all Docker images..."
        docker-compose build
        print_success "Build complete!"
        ;;
    
    build-scraper)
        print_info "Building scraper image only..."
        docker-compose build scraper-backend
        print_success "Scraper image built!"
        ;;
    
    clean)
        print_warning "This will remove all containers, volumes, and images. Continue? (y/N)"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            print_info "Cleaning up Docker resources..."
            docker-compose down -v --rmi all
            docker-compose -f docker-compose.dev.yml down -v --rmi all 2>/dev/null || true
            docker-compose -f docker-compose.prod.yml down -v --rmi all 2>/dev/null || true
            print_success "Cleanup complete!"
        else
            print_info "Cleanup cancelled"
        fi
        ;;
    
    shell)
        if [ -z "$2" ]; then
            service="scraper-backend"
        else
            service="$2"
        fi
        print_info "Opening shell in $service..."
        docker-compose exec "$service" sh
        ;;
    
    shell-worker)
        if [ -z "$2" ]; then
            worker="scraper-worker-1"
        else
            worker="scraper-worker-$2"
        fi
        print_info "Opening shell in $worker..."
        docker-compose exec "$worker" sh
        ;;
    
    redis-cli)
        print_info "Connecting to Redis CLI..."
        docker-compose exec redis redis-cli
        ;;
    
    backup-storage)
        timestamp=$(date +%Y%m%d_%H%M%S)
        backup_file="scraper_storage_backup_${timestamp}.tar.gz"
        print_info "Creating storage backup: $backup_file"
        docker run --rm -v "$(docker volume ls -q | grep scraper-storage)":/data -v "$(pwd)":/backup alpine tar czf "/backup/$backup_file" -C /data .
        print_success "Backup created: $backup_file"
        ;;
    
    restore-storage)
        if [ -z "$2" ]; then
            print_error "Please specify backup file (e.g., ./docker.sh restore-storage backup.tar.gz)"
            exit 1
        fi
        print_warning "This will replace current storage data. Continue? (y/N)"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            print_info "Restoring storage from $2..."
            docker run --rm -v "$(docker volume ls -q | grep scraper-storage)":/data -v "$(pwd)":/backup alpine sh -c "cd /data && tar xzf /backup/$2"
            print_success "Storage restored from $2"
        else
            print_info "Restore cancelled"
        fi
        ;;
    
    health)
        print_info "Health Check Status:"
        echo ""
        
        # Check frontend
        if curl -sf http://localhost/ > /dev/null 2>&1; then
            print_success "Frontend: Healthy"
        else
            print_error "Frontend: Down"
        fi
        
        # Check backend
        if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
            print_success "Backend: Healthy"
        else
            print_error "Backend: Down"
        fi
        
        # Check Redis
        if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
            print_success "Redis: Healthy"
        else
            print_error "Redis: Down"
        fi
        ;;
    
    help|*)
        echo ""
        echo "Media Link Scanner - Docker Management Script"
        echo ""
        echo "Usage: ./docker.sh [command] [options]"
        echo ""
        echo "Commands:"
        echo "  start              Start services in production mode"
        echo "  start-dev          Start services in development mode"
        echo "  start-prod         Start services with full production scaling"
        echo "  stop               Stop all services"
        echo "  restart            Restart all services"
        echo "  logs [service]     Show logs (optionally for specific service)"
        echo "  logs-scraper       Show scraper backend logs"
        echo "  logs-workers       Show all worker logs"
        echo "  scale-workers N    Scale scraper workers to N instances"
        echo "  status             Show service status"
        echo "  stats              Show resource usage statistics"
        echo "  build              Build all Docker images"
        echo "  build-scraper      Build scraper image only"
        echo "  clean              Remove all containers, volumes, and images"
        echo "  shell [service]    Open shell in service (default: scraper-backend)"
        echo "  shell-worker [N]   Open shell in worker N (default: 1)"
        echo "  redis-cli          Connect to Redis CLI"
        echo "  backup-storage     Create backup of scraper storage"
        echo "  restore-storage    Restore storage from backup file"
        echo "  health             Check health of all services"
        echo "  help               Show this help message"
        echo ""
        echo "Examples:"
        echo "  ./docker.sh start"
        echo "  ./docker.sh logs scraper-backend"
        echo "  ./docker.sh scale-workers 10"
        echo "  ./docker.sh shell-worker 3"
        echo ""
        ;;
esac
