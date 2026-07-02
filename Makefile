.PHONY: up down logs ps infra-up infra-down install-hooks lint frontend-install frontend-dev frontend-build frontend-start frontend-stop \
        frontend-env-compose frontend-env-k8s \
        k8s-build k8s-up k8s-down k8s-status k8s-logs k8s-restart k8s-ingress-setup \
        k8s-ingress-forward k8s-ingress-forward-stop

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

# Point frontends at Kong on localhost:8100 (Docker Compose mode)
frontend-env-compose:
	@$(MAKE) _frontend-env-set GATEWAY=http://localhost:8100

# Point frontends at the K8s ingress (auto-detects minikube driver)
frontend-env-k8s:
	@DRIVER=$$(minikube config get driver 2>/dev/null || echo docker); \
	if [ "$$DRIVER" = "docker" ] || [ "$$DRIVER" = "podman" ]; then \
	  $(MAKE) _frontend-env-set GATEWAY=http://localhost:8100; \
	  echo ""; \
	  echo "Docker driver detected — minikube IP is not reachable from your browser."; \
	  echo "Run: make k8s-ingress-forward"; \
	  echo "Then restart frontends: make frontend-stop && make frontend-dev"; \
	else \
	  $(MAKE) _frontend-env-set GATEWAY=http://$$(minikube ip); \
	fi

_frontend-env-set:
	@for app in web-user web-admin; do \
	  f=frontend/$$app/.env.local; \
	  [ -f $$f ] || cp frontend/$$app/.env.example $$f; \
	  sed -i.bak "s|^API_GATEWAY_URL=.*|API_GATEWAY_URL=$(GATEWAY)|" $$f; \
	  sed -i.bak "s|^NEXT_PUBLIC_API_GATEWAY_URL=.*|NEXT_PUBLIC_API_GATEWAY_URL=$(GATEWAY)|" $$f; \
	done
	@echo "Set API gateway to $(GATEWAY) in frontend/web-user and frontend/web-admin .env.local"

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
	  docker build --target production -t transcode-worker:local   services/transcode-worker/ && \
	  docker build --target production -t billing-service:local    services/billing-service/ && \
	  docker build --target production -t live-service:local        services/live-service/ && \
	  docker build --target migrate    -t live-service-migrate:local services/live-service/ && \
	  docker build --platform=linux/amd64 -t nginx-rtmp:local           infrastructure/nginx-rtmp/
	@echo "All images built inside minikube."

# Enable the nginx ingress controller addon (run once per minikube cluster)
k8s-ingress-setup:
	@echo "Pre-pulling ingress-nginx images (first enable can take several minutes)..."
	@minikube ssh -- docker pull registry.k8s.io/ingress-nginx/controller:v1.14.3 || true
	@minikube ssh -- docker pull registry.k8s.io/ingress-nginx/kube-webhook-certgen:v1.6.7 || true
	-minikube addons enable ingress
	@echo "Waiting for ingress-nginx controller to be ready..."
	@kubectl wait --namespace ingress-nginx \
	  --for=condition=ready pod \
	  --selector=app.kubernetes.io/component=controller \
	  --timeout=600s || (kubectl get pods -n ingress-nginx && exit 1)
	@echo "ingress-nginx is ready."

# Apply namespace, configmaps, secrets, observability, service manifests, and ingress
k8s-up:
	kubectl apply -f $(K8S_DIR)/namespaces.yml
	kubectl apply -f $(K8S_DIR)/configmaps/
	kubectl apply -f $(K8S_DIR)/secrets/
	kubectl apply -f $(K8S_DIR)/observability/
	kubectl apply -f $(K8S_DIR)/services/
	kubectl apply -f $(K8S_DIR)/ingress.yml
	@echo "Applied. Watch pods with: make k8s-status"

# Delete all resources in the platform namespace (leaves the namespace itself)
k8s-down:
	kubectl delete -f $(K8S_DIR)/ingress.yml    --ignore-not-found
	kubectl delete -f $(K8S_DIR)/services/      --ignore-not-found
	kubectl delete -f $(K8S_DIR)/observability/ --ignore-not-found
	kubectl delete -f $(K8S_DIR)/secrets/       --ignore-not-found
	kubectl delete -f $(K8S_DIR)/configmaps/    --ignore-not-found

# Show pod status
k8s-status:
	kubectl get pods -n $(K8S_NS)

# Tail logs for a service: make k8s-logs SVC=user-service
k8s-logs:
	kubectl logs -n $(K8S_NS) -l app=$(SVC) -f --tail=100

# Rolling restart after a configmap/secret change: make k8s-restart SVC=user-service
k8s-restart:
	kubectl rollout restart deployment/$(SVC) -n $(K8S_NS)

# Bridge host -> ingress controller in the background (minikube's Docker driver
# isn't directly routable on macOS). Detached with a PID file so it survives
# closing the terminal; reach the cluster at http://localhost:8100.
INGRESS_FWD_PID = /tmp/noxrel-ingress-forward.pid
k8s-ingress-forward:
	@if [ -f $(INGRESS_FWD_PID) ] && kill -0 $$(cat $(INGRESS_FWD_PID)) 2>/dev/null; then \
	  echo "Already forwarding on :8100 (pid $$(cat $(INGRESS_FWD_PID)))"; \
	else \
	  nohup kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8100:80 \
	    >/tmp/noxrel-ingress-forward.log 2>&1 & echo $$! > $(INGRESS_FWD_PID); \
	  echo "Forwarding ingress on http://localhost:8100 (pid $$(cat $(INGRESS_FWD_PID)), log: /tmp/noxrel-ingress-forward.log)"; \
	fi

# Stop the background ingress port-forward
k8s-ingress-forward-stop:
	@if [ -f $(INGRESS_FWD_PID) ]; then \
	  kill $$(cat $(INGRESS_FWD_PID)) 2>/dev/null || true; rm -f $(INGRESS_FWD_PID); \
	  echo "Stopped ingress forward"; \
	else echo "No ingress forward running"; fi
