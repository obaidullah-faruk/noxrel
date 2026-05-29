# Noxrel: Video Streaming Platform

A cloud-native, event-driven video streaming platform built as a microservices monorepo.

## Architecture

| Service | Tech | DB | Description |
|---|---|---|---|
| auth-service | FastAPI | PostgreSQL + Redis | RS256 JWT issuance, login, token refresh |
| user-service | Django REST | PostgreSQL + Redis | Profiles, RBAC, trial tracking |
| video-service | Django REST | PostgreSQL + S3 | Multipart upload orchestration, video catalog, transcode trigger |
| transcode-worker | Python + FFmpeg | S3 | Async video transcoding |
| streaming-service | Node.js | Redis | HLS/DASH manifest serving |
| live-service | Node.js + nginx-rtmp | Redis | RTMP ingest + live HLS |
| social-service | FastAPI | MongoDB | Comments, likes, follows |
| billing-service | Django REST | PostgreSQL | Subscriptions, payments |
| search-service | FastAPI | Elasticsearch | Full-text video/channel search |
| notification-service | FastAPI | — | Email, push, in-app notifications |
| ai-service | FastAPI + Claude API | PostgreSQL + Redis | AI-powered features |
| web-user | Next.js | — | Viewer-facing app (port 3000) |
| web-admin | Next.js | — | Admin dashboard (port 3001) |

## Local Infrastructure

| Service | Port | Notes |
|---|---|---|
| PostgreSQL | 5432 | |
| MongoDB | 27017 | |
| Redis | 6379 | |
| Elasticsearch | 9200 | |
| Kafka | 9092 | |
| Kafka UI | 8080 | |
| LocalStack (AWS) | 4566 | S3, SQS, SNS, SSM, Secrets Manager |
| Kong admin | 8101 | Kong config/status |
| **Kong proxy** | **8100** | **All API traffic goes here** |
| Kong admin | 8101 | Status, route inspection |
| user-service | 8000 | Direct access (bypasses Kong) |
| video-service | 8001 | Direct access (bypasses Kong) |
| streaming-service | 3002 | Direct access (bypasses Kong) |

## Quick Start

### Prerequisites

- Docker Desktop ≥ 4.x
- `make`
- Python ≥ 3.12 (for pre-commit and service tooling)
- AWS CLI (for LocalStack inspection): `brew install awscli`

### First-time setup (after cloning)

```bash
make install-hooks
```

This installs [pre-commit](https://pre-commit.com/) hooks that run automatically on every `git commit`. You only need to do this once per clone.

### Environment files

Each service and frontend ships an `.env.example`. Copy it to the appropriate local file before starting anything:

```bash
# Backend services (copy to .env)
cp services/user-service/.env.example      services/user-service/.env
cp services/video-service/.env.example     services/video-service/.env
cp services/transcode-worker/.env.example  services/transcode-worker/.env
cp services/streaming-service/.env.example services/streaming-service/.env

# Frontends (copy to .env.local)
cp frontend/web-user/.env.example  frontend/web-user/.env.local
cp frontend/web-admin/.env.example frontend/web-admin/.env.local
```

Edit each file to fill in secrets (JWT keys, etc.) before the first run.



### Start infrastructure

```bash
make infra-up
```

### Start everything (infrastructure + all services + Kong)

```bash
make up
```

### Install frontend dependencies

```bash
make frontend-install
```

This runs `npm install` for both `web-user` and `web-admin`. Run once after cloning, and again after pulling changes that add or update frontend packages.

### Stop

```bash
make down
```

### Tail logs

```bash
make logs
```

### Inspect LocalStack S3

```bash
aws --endpoint-url=http://localhost:4566 s3 ls
```

### Kong API Gateway

All browser/client API traffic goes through Kong on port 8100:

```
http://localhost:8100/api/v1/auth/*       → user-service:8000
http://localhost:8100/api/v1/users/*      → user-service:8000
http://localhost:8100/api/v1/roles/*      → user-service:8000
http://localhost:8100/api/v1/permissions/* → user-service:8000
http://localhost:8100/api/v1/videos/*     → video-service:8001
http://localhost:8100/api/v1/catalog/*    → video-service:8001
http://localhost:8100/api/v1/stream/*     → streaming-service:3002
```

Kong admin API (inspect live config/routes): `http://localhost:8101`

Kong is configured in **DB-less declarative mode** — all config lives in `infrastructure/kong/kong.yml`. Reload after changes with `docker exec infrastructure-kong-1 kong reload`.

## Git Workflow

### Commit message format

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/). The `commit-msg` hook enforces this automatically.

```
<type>(<scope>): <description>

feat(user-service): add email verification endpoint
fix(auth-service): refresh token expiry off by one
docs: update local dev setup in README
ci: add billing-service to test matrix
```

**Allowed types:** `feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`

**Breaking change:** append `!` before the colon — `feat(auth)!: drop v1 token support`

### What the hooks check on every commit

| Hook | What it does |
|---|---|
| `trailing-whitespace` | Strips trailing whitespace |
| `end-of-file-fixer` | Ensures files end with a newline |
| `check-yaml` / `check-json` / `check-toml` | Validates config file syntax |
| `check-merge-conflict` | Blocks accidental merge conflict markers |
| `detect-private-key` | Blocks accidental secret commits |
| `check-added-large-files` | Blocks files > 1 MB |
| `ruff` (with `--fix`) | Lints Python, auto-fixes what it can |
| `ruff-format` | Formats Python code |
| `mypy` | Type-checks all services |
| `commitizen` | Validates conventional commit format |

### Run all checks manually (without committing)

```bash
make lint
```

### Bypass hooks in an emergency

```bash
git commit --no-verify -m "chore: emergency hotfix"
```

Use sparingly — CI runs the same checks and will catch any bypass.

## Services

| Service | Status | README |
|---|---|---|
| user-service | ✅ implemented | [services/user-service/README.md](services/user-service/README.md) |
| video-service | ✅ implemented | [services/video-service/README.md](services/video-service/README.md) |
| transcode-worker | ✅ implemented | [services/transcode-worker/README.md](services/transcode-worker/README.md) |
| streaming-service | ✅ implemented | [services/streaming-service/README.md](services/streaming-service/README.md) |
| web-admin | ✅ implemented | [frontend/web-admin/README.md](frontend/web-admin/README.md) |
| live-service | planned | — |
| social-service | planned | — |
| billing-service | planned | — |
| search-service | planned | — |
| notification-service | planned | — |
| ai-service | planned | — |
| web-user | ✅ implemented | [frontend/web-user/README.md](frontend/web-user/README.md) |

## Repository Layout

```
services/          # Backend microservices
frontend/          # Next.js apps (web-user, web-admin)
infrastructure/    # Docker Compose, Terraform, LocalStack init scripts
docs/              # Architecture docs and per-phase implementation guides
.github/workflows/ # CI: lint + test matrix per service
```

## Key Conventions

- Every service exposes a `/health` endpoint.
- All logging is structured JSON: `{ts, level, service, message, trace_id, request_id}`.
- Config via environment variables — never commit secrets.
- DB migrations: Alembic (FastAPI), Django migrations (Django).
- Cross-service async communication via Kafka; every consumer has a DLQ.

## License

MIT License — see [LICENSE](LICENSE) for details.
