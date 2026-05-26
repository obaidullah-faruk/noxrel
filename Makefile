.PHONY: up down logs ps infra-up infra-down install-hooks lint

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
