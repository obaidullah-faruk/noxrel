# AGENTS.md

Guidance for AI agents working in this repository. Read this file first, then the relevant service-level `AGENTS.md` before touching any service.

---

## Project Status

Active development. Phases implemented so far:

| Phase | Status |
|---|---|
| 01 Foundation | Done |
| 02 Auth & Users | Done (`services/user-service`) |
| 03 Video Pipeline | Done (`services/video-service`, `services/transcode-worker`) |
| 04 Streaming & CDN | Done (`services/streaming-service`) |
| 05 Live Streaming | Done (`services/live-service`, `infrastructure/nginx-rtmp`) |
| 06–12 | Pending |

Docs are in `docs/`. Start with `docs/Master_Plan.md` → `docs/architecture.md` → the relevant `docs/phase-NN-*.md` before planning any new phase work.

---

## Quick Commands

```bash
# Infrastructure (Kafka, DBs, LocalStack)
docker compose -f infrastructure/docker-compose.infra.yml up -d

# All services
docker compose -f infrastructure/docker-compose.infra.yml -f infrastructure/docker-compose.yml up -d

# Logs
docker compose logs -f <service-name>

# Python service — test / lint
cd services/<service-name>
uv run pytest tests/ -v --tb=short
uv run ruff check .
uv run mypy . --ignore-missing-imports

# Node.js service — test
cd services/<service-name>
npm test

# LocalStack S3
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url=http://localhost:4566 s3 ls
```

---

## Architecture — Service Map

| Service | Tech | DB | Port |
|---|---|---|---|
| user-service | Django REST | PostgreSQL + Redis | 8000 |
| video-service | Django REST | PostgreSQL + S3 | 8001 |
| transcode-worker | Python + FFmpeg | S3 only | — |
| streaming-service | Node.js (Fastify + TS) | Redis | 3002 |
| live-service | Node.js (Fastify + TS) + nginx-rtmp | PostgreSQL + Redis + MongoDB (chat) | 3003 |
| social-service | FastAPI | MongoDB | — |
| billing-service | FastAPI + SQLAlchemy 2.0 | PostgreSQL | 8003 |
| search-service | FastAPI | Elasticsearch | — |
| notification-service | FastAPI | — | — |
| ai-service | FastAPI + Claude API | PostgreSQL + Redis | — |
| web-user | Next.js | — | 3000 |
| web-admin | Next.js | — | 3001 |

All traffic routes through Kong (local and production).

---

## Monorepo Layout

```
services/<service-name>/        # one directory per service
  <app>/                        # Django apps at service root (no apps/ wrapper)
  config/ or core/              # Django project package named config or core
  tests/
  Dockerfile
  pyproject.toml | package.json

frontend/
  web-user/                     # viewer app — port 3000
  web-admin/                    # admin app — port 3001

infrastructure/
  docker-compose.infra.yml
  docker-compose.yml
  terraform/
  localstack/init-scripts/

docs/                           # phase plans and architecture
.github/workflows/              # CI: lint + test per service
.claude/
  agents/                       # sub-agent definitions
  settings.local.json           # allowed commands and hooks
```

---

## Non-Negotiable Architectural Rules

**No shared library.** Every service owns `core/` (logging, config, jwt_verify, kafka, health, exceptions). Never import across service boundaries — not even utilities.

**Database ownership is absolute.** Service A never connects to Service B's database. Cross-service reads = internal HTTP call to the owner. Cross-service async = Kafka event + local projection.

**Event-driven.** Services communicate async via Kafka. Every consumer must have a DLQ topic (`<topic>.dlq`). Key topics: `user.registered`, `video.uploaded`, `video.transcoded`, `payment.succeeded`, `payment.failed`, `live.started`, `comment.created`, `support.ticket_created`.

**JWT.** `user-service` holds the RS256 private key and issues all tokens. Every other service only verifies with the public key — never issues. API Gateway injects `x-user-id` and `x-user-roles` headers after validation. RBAC is cached in Redis with a 60 s TTL (`rbac:{user_id}`).

**Video bytes never touch app servers.** Browser PUTs directly to S3 presigned URLs. `video-service` issues presigned URLs and calls `CompleteMultipartUpload` only.

**Two frontends, one API.** `web-user` and `web-admin` are separate Next.js apps, same backend, different token permissions.

---

## Coding Standards — Apply to Every Change

### General
- Production-grade fix by default. Quick fixes only when explicitly asked.
- No comments unless the *why* is non-obvious (hidden constraint, workaround, subtle invariant).
- No cheap names. `video_upload_handler` not `handler`. `presigned_url_service` not `svc`.
- No premature abstractions. Three similar lines is better than a wrong abstraction.
- No error handling for scenarios that cannot happen. Trust framework guarantees. Validate only at system boundaries (user input, external APIs).

### Python (Django / FastAPI services)
- Package manager: `uv`. Never `pip install` directly.
- Formatter/linter: `ruff`. Type checker: `mypy`.
- Use Pydantic Settings for all config — no `os.getenv()` scattered in code.
- DB migrations: Django migrations (Django services) or Alembic (FastAPI). Never raw SQL.
- Circuit breaker on every external HTTP call (tenacity).
- Structured JSON logging: `{ts, level, service, message, trace_id, request_id}`.

### TypeScript / Node.js (streaming-service, live-service, frontends)
- Runtime: Node.js. Package manager: npm.
- Framework: Fastify (services), Next.js (frontends).
- Strict TypeScript — no `any` without a comment explaining why.
- Config via dotenv / environment variables only.

### React / Next.js
- Always write reusable components. If a UI pattern appears more than once, extract it.
- Co-locate component, its types, and its styles in one folder.
- Server Components by default; Client Components only when interactivity requires it.
- `app/` router (Next.js 13+). No `pages/` directory.

### Tests
- Run tests after every feature or fix before reporting done.
- Python: `pytest` with `--tb=short`. Minimum: one happy-path + one failure case per endpoint.
- Node.js: `vitest`. Same minimum.
- No mocking the database in integration tests — use the real DB via Docker.
- Test file mirrors source file: `tests/test_views.py` ↔ `videos/views.py`.

### Packages
- Use the latest stable version unless a version is explicitly pinned.
- Add to `pyproject.toml` via `uv add <pkg>` (Python) or `npm install <pkg>` (Node).

### README
- Update `README.md` when a new feature changes how to run, configure, or use the service — not for internal refactors.

---

## Per-Service Conventions

- Every service: `/health` endpoint returning `{"status": "ok", "service": "<name>"}`.
- Secrets: `.env.local` locally (never committed), AWS Secrets Manager in production.
- No hardcoded credentials in source. Dev-only RS256 keys in `.env.local` are fine.
- `docker-compose.yml` lives in `infrastructure/`, not inside a service directory.
- `.gitignore` lives at the monorepo root only.

---

## Local Infrastructure Ports

| Component | Port |
|---|---|
| PostgreSQL | 5432 |
| MongoDB | 27017 |
| Redis | 6379 |
| Elasticsearch | 9200 |
| Kafka | 9092 |
| Kafka UI | 8080 |
| LocalStack (S3) | 4566 |
| Kong admin | 8101 |

LocalStack S3 buckets: `raw-videos`, `transcoded-videos`, `thumbnails`, `static-assets`.

---

## Token-Efficiency Strategy (How to Work Without Breaking Things)

Agents read the root `AGENTS.md` plus the service-level `AGENTS.md` for the service being changed. This gives the contract without loading the entire codebase.

**Before touching a service:** read its `AGENTS.md` first — it lists every app, public API contract, Kafka events published/consumed, and known cross-service dependencies.

**Before adding a new endpoint:** grep for existing usages of that route in `frontend/` and other services to avoid silent breakage.

**Before changing a model:** check migrations and any Kafka event serializers that reference the field.

**Before changing a Kafka topic name or event shape:** grep the entire repo — every consumer breaks silently.

Service-level `AGENTS.md` files live at:
- `services/user-service/AGENTS.md`
- `services/video-service/AGENTS.md`
- `services/streaming-service/AGENTS.md`
- `services/transcode-worker/AGENTS.md`
- `services/live-service/AGENTS.md`
- `services/billing-service/AGENTS.md`

Add one for every new service before its first implementation session.

---

## Phase Order

Foundation → Auth/RBAC → Video Pipeline → Streaming/CDN → Live → Social → Billing → Observability → Scale → Mobile → Kubernetes → AI/Chatbot

See `docs/phases.md` for durations and deliverables.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
