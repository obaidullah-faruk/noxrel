.PHONY: up down logs ps infra-up infra-down install-hooks lint frontend-install frontend-dev frontend-build frontend-start frontend-stop \
        k8s-build k8s-up k8s-down k8s-status k8s-logs k8s-restart

ENV_FILE = infrastructure/.env
COMPOSE_BASE = docker compose --env-file $(ENV_FILE) -f infrastructure/docker-compose.infra.yml
COMPOSE      = $(COMPOSE_BASE) -f infrastructure/docker-compose.yml

# Start infrastructure + all services
up:
	$(COMPOSE) up -d

# Start infrastructure only
infra-up:
	$(COMPOSE_BASE) up -d

# Stop everything
down:
	$(COMPOSE) down

# Stop infrastructure only
infra-down:
	$(COMPOSE_BASE) down

# Tail logs
logs:
	$(COMPOSE) logs -f

# Show running containers
ps:
	$(COMPOSE) ps

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

# =============================================================================
# Kubernetes (minikube) — app services only; infra stays in Docker Compose
# Run `make infra-up` first so Postgres/Redis/Kafka/LocalStack are available.
# =============================================================================

K8S_DIR = infrastructure/k8s
K8S_NS  = platform

# Build all service images inside minikube's Docker daemon (imagePullPolicy: Never)
k8s-build:
	@echo "Pointing shell at minikube's Docker daemon..."
	@eval $$(minikube docker-env) && \
	  docker build --target production -t user-service:local       services/user-service/ && \
	  docker build --target production -t video-service:local      services/video-service/ && \
	  docker build --target production -t streaming-service:local  services/streaming-service/ && \
	  docker build --target production -t transcode-worker:local   services/transcode-worker/
	@echo "All images built inside minikube."

# Apply namespace, configmaps, secrets, and all service manifests
k8s-up:
	kubectl apply -f $(K8S_DIR)/namespaces.yml
	kubectl apply -f $(K8S_DIR)/configmaps/
	kubectl apply -f $(K8S_DIR)/secrets/
	kubectl apply -f $(K8S_DIR)/services/
	@echo "Applied. Watch pods with: make k8s-status"

# Delete all resources in the platform namespace (leaves the namespace itself)
k8s-down:
	kubectl delete -f $(K8S_DIR)/services/   --ignore-not-found
	kubectl delete -f $(K8S_DIR)/secrets/    --ignore-not-found
	kubectl delete -f $(K8S_DIR)/configmaps/ --ignore-not-found

# Show pod status
k8s-status:
	kubectl get pods -n $(K8S_NS)

# Tail logs for a service: make k8s-logs SVC=user-service
k8s-logs:
	kubectl logs -n $(K8S_NS) -l app=$(SVC) -f --tail=100

# Rolling restart after a configmap/secret change: make k8s-restart SVC=user-service
k8s-restart:
	kubectl rollout restart deployment/$(SVC) -n $(K8S_NS)
