# Video Streaming Platform

A cloud-native, event-driven video streaming platform built as a microservices monorepo.

## Architecture

| Service | Tech | DB | Description |
|---|---|---|---|
| auth-service | FastAPI | PostgreSQL + Redis | RS256 JWT issuance, login, token refresh |
| user-service | Django REST | PostgreSQL + Redis | Profiles, RBAC, trial tracking |
| video-ingest-service | FastAPI | PostgreSQL + S3 | Presigned URL generation, multipart upload |
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

| Service | Port |
|---|---|
| PostgreSQL | 5432 |
| MongoDB | 27017 |
| Redis | 6379 |
| Elasticsearch | 9200 |
| Kafka | 9092 |
| Kafka UI | 8080 |
| LocalStack (AWS) | 4566 |
| Traefik dashboard | 8081 |

## Quick Start

### Prerequisites

- Docker Desktop ≥ 4.x
- `make`
- AWS CLI (for LocalStack inspection): `brew install awscli`

### Start infrastructure

```bash
make infra-up
```

### Start everything

```bash
make up
```

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

## Services

| Service | Status | README |
|---|---|---|
| user-service | ✅ implemented | [services/user-service/README.md](services/user-service/README.md) |
| video-ingest-service | planned | — |
| transcode-worker | planned | — |
| streaming-service | planned | — |
| live-service | planned | — |
| social-service | planned | — |
| billing-service | planned | — |
| search-service | planned | — |
| notification-service | planned | — |
| ai-service | planned | — |

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
