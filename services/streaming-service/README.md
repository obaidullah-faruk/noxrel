# Streaming Service

Node.js 24 LTS + Fastify + TypeScript microservice responsible for:

- Fetching and quality-filtering HLS `master.m3u8` manifests from S3/LocalStack
- Enforcing subscription-tier quality caps (guest → 240p, free_trial → 480p, basic → 1080p, premium/admin → 4K)
- Saving and restoring watch positions via Redis
- Publishing `video.viewed` events to Kafka (fire-and-forget)

See [docs/phase-04-streaming.md](../../docs/phase-04-streaming.md) for the full architecture and design decisions.

---

## Endpoints

| Method | Path | Auth (headers) | Description |
|--------|------|----------------|-------------|
| `GET` | `/health` | none | Liveness probe → `{ status, service, checks: { redis, kafka } }` — 503 if any check fails |
| `GET` | `/stream/:videoId/manifest` | `x-user-id`, `x-user-tier` | Returns quality-filtered `master.m3u8` text |
| `POST` | `/stream/:videoId/heartbeat` | `x-user-id` | Body `{ position: number }` — saves watch position to Redis |
| `GET` | `/stream/:videoId/resume` | `x-user-id` | Returns `{ position: number }` (0 if no history) |

Auth headers are injected by the API Gateway from the validated JWT — services never verify tokens directly.

---

## Quality Caps by Tier

| Tier | Max Quality |
|------|-------------|
| `guest` | 240p |
| `free_trial` | 480p |
| `basic_subscriber` | 1080p |
| `premium_subscriber` | 4K |
| `admin` / `superadmin` | 4K |

---

## Local Development

### Prerequisites

- Node.js ≥ 24
- Running infra: `docker compose -f infrastructure/docker-compose.infra.yml up -d redis kafka localstack`

### Setup

```bash
cd services/streaming-service
npm install
cp .env.example .env   # edit if needed
```

### Run dev server (hot-reload)

```bash
npm run dev
```

### Run tests

```bash
npm test
```

### Typecheck

```bash
npm run typecheck
```

### Build

```bash
npm run build
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3002` | HTTP listen port |
| `AWS_REGION` | `us-east-1` | AWS region |
| `AWS_ENDPOINT_URL` | — | LocalStack endpoint (e.g. `http://localhost:4566`) |
| `AWS_ACCESS_KEY_ID` | `test` | S3 access key (LocalStack uses `test`) |
| `AWS_SECRET_ACCESS_KEY` | `test` | S3 secret key |
| `S3_TRANSCODED_BUCKET` | `transcoded-videos` | Bucket containing transcoded HLS segments |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `KAFKA_BROKERS` | `localhost:9092` | Comma-separated Kafka broker list |
| `JWT_PUBLIC_KEY` | — | RS256 PEM public key (matches `user-service`) |
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `LOG_LEVEL` | `info` | `trace` \| `debug` \| `info` \| `warn` \| `error` \| `fatal` |
| `SERVICE_NAME` | `streaming-service` | Reported in traces and health response |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector:4317` | OTel Collector gRPC endpoint |

---

## Docker

```bash
# From repo root
docker compose -f infrastructure/docker-compose.infra.yml \
               -f infrastructure/docker-compose.yml \
               up -d streaming-service
```

The service uses a multi-stage `node:24-alpine` build. Health check: `GET /health`.

---

## Phase 4B — CloudFront Migration

Currently (Phase 4A), `.ts` segments are publicly readable on S3/LocalStack. Only the master manifest is gated.

To migrate to CloudFront signed URLs (Phase 4B):
1. Apply `infrastructure/terraform/cloudfront.tf` (currently a commented stub).
2. Swap `buildSegmentUrl()` in `src/services/s3.service.ts` for `@aws-sdk/cloudfront-signer`.
3. Remove `infrastructure/localstack/init-scripts/04-streaming-bucket-policy.sh`.
4. Frontend: **no changes** — the player receives a URL string regardless of S3 or CloudFront.
