# Noxrel: Video Streaming Platform

Cloud-native, event-driven video streaming platform (microservices monorepo).

## Choose how to run the backend

| | [Docker Compose](#docker-compose) | [Kubernetes (minikube)](#kubernetes-minikube) |
|---|---|---|
| **Best for** | Fastest local dev | Learning K8s with real services |
| **Backend runs in** | Docker Compose (all services + Kong) | minikube pods + nginx Ingress |
| **Infra (Postgres, Kafka, …)** | Docker Compose | Docker Compose (`make infra-up`) |
| **API URL for frontends** | `http://localhost:8100` | `http://localhost:8100` + port-forward (macOS/Windows) |
| **Extra tools** | Docker Desktop | Docker Desktop + kubectl + minikube |

Frontends (`web-user` :3000, `web-admin` :3001) run the same way in both modes — see [Frontends](#frontends).

---

## One-time setup (both paths)

```bash
make install-hooks

cp infrastructure/.env.example infrastructure/.env
cp services/user-service/.env.example      services/user-service/.env
cp services/video-service/.env.example     services/video-service/.env
cp services/transcode-worker/.env.example  services/transcode-worker/.env
cp services/streaming-service/.env.example services/streaming-service/.env
cp services/billing-service/.env.example   services/billing-service/.env
cp frontend/web-user/.env.example          frontend/web-user/.env.local
cp frontend/web-admin/.env.example         frontend/web-admin/.env.local
```

Fill in secrets before the first run. **Stripe (billing only):** set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `services/billing-service/.env` — see [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys). Everything else works with the example defaults.

---

## Docker Compose

Everything (infra + services + Kong) in one stack. Kong is on port **8100** — frontends already point there.

```bash
make up                  # start infra + all services
make frontend-start      # web-user :3000, web-admin :3001
```

```bash
make down                # stop everything
make frontend-stop
```

---

## Kubernetes (minikube)

Infra stays in Docker Compose; app services run as pods. Follow these steps **in order**:

```bash
# 1. Cluster + ingress
minikube start --cpus=3 --memory=4096 --driver=docker
make k8s-ingress-setup          # first run may take ~10 min

# 2. Shared infra (Postgres, Redis, Kafka, LocalStack, observability)
make infra-up
make ps                         # verify containers are healthy

# 3. Build images inside minikube and deploy
make k8s-build
make k8s-up
make k8s-status                 # all pods should reach 1/1

# 4. Bridge ingress to your machine (required on macOS/Windows Docker driver)
make k8s-ingress-forward        # API at http://localhost:8100

# 5. Frontends — point at the gateway and start
make frontend-env-k8s           # sets localhost:8100 on Docker driver
make frontend-start
```

### macOS / Windows — do **not** use `minikube ip` in `.env.local`

On the Docker driver, the minikube IP (e.g. `192.168.49.2`) lives inside the Docker VM. Your browser and Next.js **cannot reach it** — requests hang and time out with *Gateway unreachable*.

Use **`make k8s-ingress-forward`** and keep the gateway URL at **`http://localhost:8100`**. If you already ran the `sed`/`minikube ip` commands, reset with:

```bash
make frontend-env-k8s
make k8s-ingress-forward
make frontend-stop && make frontend-dev    # Next.js reads .env.local only at startup
```

### Linux (kvm / qemu / hyperkit)

The minikube IP is host-routable — `make frontend-env-k8s` sets `http://$(minikube ip)` automatically. No port-forward needed.

### Verify the API

```bash
curl http://localhost:8100/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}'
```

### K8s commands

| Command | Description |
|---|---|
| `make k8s-ingress-setup` | Enable nginx Ingress (pre-pulls images) |
| `make k8s-ingress-forward` | Port-forward ingress → `localhost:8100` (Docker driver) |
| `make k8s-ingress-forward-stop` | Stop the port-forward |
| `make k8s-build` | Build all service images in minikube |
| `make k8s-up` / `make k8s-down` | Apply / remove manifests |
| `make k8s-status` | Pod status in `platform` namespace |
| `make k8s-logs SVC=user-service` | Tail service logs |
| `make k8s-restart SVC=user-service` | Rolling restart after config change |
| `make frontend-env-k8s` | Set frontend `.env.local` for K8s mode |
| `make frontend-env-compose` | Reset frontend `.env.local` for Compose mode |

**After code changes:** rebuild the image inside minikube, then restart:

```bash
eval $(minikube docker-env) && docker build --target production -t user-service:local services/user-service/
make k8s-restart SVC=user-service
```

**Stop K8s dev:**

```bash
make frontend-stop
make k8s-ingress-forward-stop
make k8s-down
make infra-down
minikube stop
```

---

## Frontends

```bash
make frontend-install    # once after clone / package changes
make frontend-dev        # web-user :3000, web-admin :3001
make frontend-stop
```

`make frontend-start` = install + dev.

| App | URL |
|---|---|
| web-user | http://localhost:3000 |
| web-admin | http://localhost:3001 |

### web-user

![noxrel viewer — discover videos](images/user-home-page.png)

![noxrel viewer — video player](images/user-ui-video-watching.png)

### web-admin

![noxrel admin dashboard](images/admin-dashboard.png)

> **Next.js reads `.env.local` only at startup.** After changing gateway URL or starting the port-forward, restart the dev server.

---

## Going live (browser streaming)

1. Sign in on **web-user** → **Go Live**
2. Choose camera or screen, enter a title, click **Go Live**
3. Stream appears on the **Live** page; admins can monitor in **web-admin → Live**

Uses WebSocket ingest through the gateway (`/api/v1/live/...`) — no RTMP client needed for browser broadcasting.

---

## API gateway routes

All browser traffic goes through the gateway (Kong on Compose, nginx Ingress on K8s):

```
http://localhost:8100/api/v1/auth/*        → user-service:8000
http://localhost:8100/api/v1/users/*       → user-service:8000
http://localhost:8100/api/v1/roles/*       → user-service:8000
http://localhost:8100/api/v1/permissions/* → user-service:8000
http://localhost:8100/api/v1/videos/*      → video-service:8001
http://localhost:8100/api/v1/catalog/*     → video-service:8001
http://localhost:8100/api/v1/stream/*      → streaming-service:3002
http://localhost:8100/api/v1/billing/*     → billing-service:8003
```

Compose: Kong admin at http://localhost:8101. K8s: routes via ingress on port 80 (reach via `localhost:8100` with port-forward).

---

## Local URLs

| UI | URL | Notes |
|---|---|---|
| web-user | http://localhost:3000 | Viewer app |
| web-admin | http://localhost:3001 | Admin dashboard |
| API gateway | http://localhost:8100 | All `/api/v1/*` traffic |
| Grafana | http://localhost:3003 | `admin` / `admin` |
| Kibana | http://localhost:5601 | `elastic` / `noxrel_dev` |
| Jaeger | http://localhost:16686 | Distributed traces |
| Kafka UI | http://localhost:8080 | Topics / messages |
| Prometheus | http://localhost:9090 | Raw metrics |
| user-service admin | http://localhost:8000/admin/ | `admin@admin.com` / `admin1234` |

### Observability

![Grafana — Noxrel overview dashboard](images/grafana.png)

![Elastic APM — services inventory](images/apm_services.png)

![Elastic APM — user-service overview](images/apm_user_service.png)

![Kafka UI — topics](images/apache_kafka.png)

---

## Architecture

| Service | Tech | Description |
|---|---|---|
| user-service | Django REST | Auth, profiles, RBAC |
| video-service | Django REST | Upload orchestration, catalog |
| transcode-worker | Python + FFmpeg | Async transcoding |
| streaming-service | Fastify | HLS manifest serving |
| live-service | Node.js + nginx-rtmp | Live streaming |
| billing-service | FastAPI | Stripe subscriptions |
| web-user / web-admin | Next.js | Frontends |

---

## Development

```bash
make lint                # run all pre-commit checks
make logs                # Docker Compose logs
```

**Git commits** follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat(scope): description`). Hooks run ruff, mypy, and format checks automatically. Bypass in emergencies: `git commit --no-verify`.

---

## Repository layout

```
services/          # Backend microservices
frontend/          # Next.js apps (web-user, web-admin)
infrastructure/    # Docker Compose, K8s manifests, Terraform, LocalStack
docs/              # Architecture and phase guides
.github/workflows/ # CI
```

---

## License

MIT — see [LICENSE](LICENSE).
