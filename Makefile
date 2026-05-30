.PHONY: up down logs ps infra-up infra-down install-hooks lint frontend-install frontend-dev frontend-build frontend-start frontend-stop

# Start infrastructure + all services
up:
	docker compose -f infrastructure/docker-compose.infra.yml -f infrastructure/docker-compose.yml up -d

# Start infrastructure only
infra-up:
	docker compose -f infrastructure/docker-compose.infra.yml up -d

# Stop everything
down:
	docker compose -f infrastructure/docker-compose.infra.yml -f infrastructure/docker-compose.yml down

# Stop infrastructure only
infra-down:
	docker compose -f infrastructure/docker-compose.infra.yml down

# Tail logs
logs:
	docker compose -f infrastructure/docker-compose.infra.yml -f infrastructure/docker-compose.yml logs -f

# Show running containers
ps:
	docker compose -f infrastructure/docker-compose.infra.yml -f infrastructure/docker-compose.yml ps

# Install pre-commit hooks (run once after cloning)
install-hooks:
	@pip3 install pre-commit --quiet
	@pre-commit install --hook-type pre-commit --hook-type commit-msg
	@echo "pre-commit hooks installed"

# Run all linters across the repo manually
lint:
	pre-commit run --all-files

# Install frontend dependencies (run once after cloning)
frontend-install:
	cd frontend/web-user && npm install
	cd frontend/web-admin && npm install

# Start both frontends in dev mode (web-user: 3000, web-admin: 3001)
frontend-dev:
	cd frontend/web-user && npm run dev &
	cd frontend/web-admin && npm run dev

# Build both frontends for production
frontend-build:
	cd frontend/web-user && npm run build
	cd frontend/web-admin && npm run build

# Install deps and start both frontends in dev mode
frontend-start: frontend-install frontend-dev

# Kill both frontend dev servers
frontend-stop:
	@pkill -f "next dev" 2>/dev/null || true
	@echo "Frontend dev servers stopped"
