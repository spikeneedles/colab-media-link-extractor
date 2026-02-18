# Makefile for Media Link Scanner Docker Management
# Alternative to docker.sh for those who prefer make

.PHONY: help start start-dev start-prod stop restart logs build clean

# Colors
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m

help: ## Show this help message
	@echo ""
	@echo "$(BLUE)Media Link Scanner - Docker Management$(NC)"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

start: ## Start services in production mode
	@echo "$(BLUE)Starting Media Link Scanner in production mode...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ Services started successfully!$(NC)"
	@echo "$(BLUE)Access the app at http://localhost$(NC)"

start-dev: ## Start services in development mode
	@echo "$(BLUE)Starting Media Link Scanner in development mode...$(NC)"
	docker-compose -f docker-compose.dev.yml up -d
	@echo "$(GREEN)✓ Development environment started!$(NC)"
	@echo "$(BLUE)Frontend: http://localhost:5173$(NC)"
	@echo "$(BLUE)Backend: http://localhost:3001$(NC)"
	@echo "$(BLUE)Redis Commander: http://localhost:8081$(NC)"

start-prod: ## Start services with full production scaling
	@echo "$(BLUE)Starting Media Link Scanner with full production scaling...$(NC)"
	docker-compose -f docker-compose.prod.yml up -d
	@echo "$(GREEN)✓ Production environment started with load balancing!$(NC)"

stop: ## Stop all services
	@echo "$(BLUE)Stopping all services...$(NC)"
	docker-compose down
	-docker-compose -f docker-compose.dev.yml down 2>/dev/null
	-docker-compose -f docker-compose.prod.yml down 2>/dev/null
	@echo "$(GREEN)✓ All services stopped$(NC)"

restart: stop start ## Restart all services

logs: ## Show logs from all services
	docker-compose logs -f

logs-scraper: ## Show scraper backend logs
	@echo "$(BLUE)Showing scraper backend logs...$(NC)"
	docker-compose logs -f scraper-backend

logs-workers: ## Show all worker logs
	@echo "$(BLUE)Showing all worker logs...$(NC)"
	docker-compose logs -f scraper-worker-1 scraper-worker-2

status: ## Show service status
	@echo "$(BLUE)Service Status:$(NC)"
	docker-compose ps

stats: ## Show resource usage statistics
	@echo "$(BLUE)Resource Usage:$(NC)"
	docker stats --no-stream

build: ## Build all Docker images
	@echo "$(BLUE)Building all Docker images...$(NC)"
	docker-compose build
	@echo "$(GREEN)✓ Build complete!$(NC)"

build-scraper: ## Build scraper image only
	@echo "$(BLUE)Building scraper image only...$(NC)"
	docker-compose build scraper-backend
	@echo "$(GREEN)✓ Scraper image built!$(NC)"

scale-workers: ## Scale scraper workers (usage: make scale-workers N=5)
	@if [ -z "$(N)" ]; then \
		echo "$(RED)✗ Please specify number of workers: make scale-workers N=5$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Scaling scraper workers to $(N) instances...$(NC)"
	docker-compose up -d --scale scraper-worker=$(N)
	@echo "$(GREEN)✓ Workers scaled to $(N) instances$(NC)"

shell: ## Open shell in backend (usage: make shell or make shell SVC=scraper-backend)
	@SERVICE=$${SVC:-scraper-backend}; \
	echo "$(BLUE)Opening shell in $$SERVICE...$(NC)"; \
	docker-compose exec $$SERVICE sh

shell-worker: ## Open shell in worker (usage: make shell-worker N=1)
	@WORKER_NUM=$${N:-1}; \
	echo "$(BLUE)Opening shell in scraper-worker-$$WORKER_NUM...$(NC)"; \
	docker-compose exec scraper-worker-$$WORKER_NUM sh

redis-cli: ## Connect to Redis CLI
	@echo "$(BLUE)Connecting to Redis CLI...$(NC)"
	docker-compose exec redis redis-cli

backup-storage: ## Create backup of scraper storage
	@TIMESTAMP=$$(date +%Y%m%d_%H%M%S); \
	BACKUP_FILE="scraper_storage_backup_$${TIMESTAMP}.tar.gz"; \
	echo "$(BLUE)Creating storage backup: $$BACKUP_FILE$(NC)"; \
	VOLUME=$$(docker volume ls -q | grep scraper-storage); \
	docker run --rm -v "$$VOLUME":/data -v "$$(pwd)":/backup alpine tar czf "/backup/$$BACKUP_FILE" -C /data .; \
	echo "$(GREEN)✓ Backup created: $$BACKUP_FILE$(NC)"

restore-storage: ## Restore storage from backup (usage: make restore-storage FILE=backup.tar.gz)
	@if [ -z "$(FILE)" ]; then \
		echo "$(RED)✗ Please specify backup file: make restore-storage FILE=backup.tar.gz$(NC)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)⚠ This will replace current storage data. Continue? (y/N)$(NC)" && read ans && [ $${ans:-N} = y ]
	@echo "$(BLUE)Restoring storage from $(FILE)...$(NC)"
	@VOLUME=$$(docker volume ls -q | grep scraper-storage); \
	docker run --rm -v "$$VOLUME":/data -v "$$(pwd)":/backup alpine sh -c "cd /data && tar xzf /backup/$(FILE)"
	@echo "$(GREEN)✓ Storage restored from $(FILE)$(NC)"

health: ## Check health of all services
	@echo "$(BLUE)Health Check Status:$(NC)"
	@echo ""
	@if curl -sf http://localhost/ > /dev/null 2>&1; then \
		echo "$(GREEN)✓ Frontend: Healthy$(NC)"; \
	else \
		echo "$(RED)✗ Frontend: Down$(NC)"; \
	fi
	@if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then \
		echo "$(GREEN)✓ Backend: Healthy$(NC)"; \
	else \
		echo "$(RED)✗ Backend: Down$(NC)"; \
	fi
	@if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then \
		echo "$(GREEN)✓ Redis: Healthy$(NC)"; \
	else \
		echo "$(RED)✗ Redis: Down$(NC)"; \
	fi

clean: ## Remove all containers, volumes, and images
	@echo "$(YELLOW)⚠ This will remove all containers, volumes, and images. Continue? (y/N)$(NC)" && read ans && [ $${ans:-N} = y ]
	@echo "$(BLUE)Cleaning up Docker resources...$(NC)"
	docker-compose down -v --rmi all
	-docker-compose -f docker-compose.dev.yml down -v --rmi all 2>/dev/null
	-docker-compose -f docker-compose.prod.yml down -v --rmi all 2>/dev/null
	@echo "$(GREEN)✓ Cleanup complete!$(NC)"

prune: ## Remove unused Docker resources
	@echo "$(BLUE)Pruning unused Docker resources...$(NC)"
	docker system prune -f
	@echo "$(GREEN)✓ Prune complete!$(NC)"

update: ## Pull latest images and restart
	@echo "$(BLUE)Pulling latest images...$(NC)"
	docker-compose pull
	@echo "$(BLUE)Restarting services...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ Update complete!$(NC)"
