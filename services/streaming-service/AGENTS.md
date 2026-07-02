# streaming-service — AGENTS.md

Read the root `AGENTS.md` first, then this file.

## What This Service Owns

HLS manifest serving, adaptive bitrate quality gating per user tier, Redis watch-position tracking, and streaming heartbeat/analytics events.

## Tech

Node.js · Fastify · TypeScript · Redis · Port **3002**

## Project Layout

```
services/streaming-service/
  src/
    routes/        # Fastify route handlers
    services/      # Business logic (manifest, position, quality)
    core/          # logger, config, redis client, kafka client, health
    types/         # Shared TypeScript interfaces
  tests/           # Vitest test files
  package.json
  tsconfig.json
  vitest.config.ts
```

## API Contract (do not change routes without updating dependents)

| Method | Path | Auth (header) | Description |
|---|---|---|---|
| GET | `/stream/{video_id}/manifest` | `x-user-id`, `x-user-tier` | Returns HLS manifest (quality-gated) |
| POST | `/stream/{video_id}/heartbeat` | `x-user-id` | Updates watch position in Redis |
| GET | `/stream/{video_id}/position` | `x-user-id` | Returns last watch position |
| GET | `/health` | None | Health check |

Auth headers are injected by API Gateway — never issued by this service.

## Quality Gating Rules

| Tier | Max quality |
|---|---|
| `guest` | 480p |
| `basic_subscriber` | 720p |
| `premium_subscriber` | 1080p + 4K |

Manifest filtering happens in `src/services/manifest.ts`. Do not change tier names without updating `user-service` RBAC definitions.

## Kafka Events Published

| Topic | Trigger |
|---|---|
| `stream.started` | First heartbeat for a session |
| `stream.completed` | Heartbeat with `completed: true` |

Every topic has a `.dlq` counterpart.

## Kafka Events Consumed

None at this stage.

## Redis Keys

- `watch:{user_id}:{video_id}` — last position in seconds, TTL 30 days

## Cross-Service Dependencies

- Reads HLS manifest path from **video-service** via internal HTTP (`GET /api/v1/catalog/{id}/`). The manifest URL field name is `hls_manifest_url`.
- User tier comes from `x-user-tier` header (API Gateway sources it from **user-service** RBAC).

## Test Commands

```bash
cd services/streaming-service
npm test
```

## Known Gotchas

- 23 tests passing as of Phase 04. Run tests before and after any change.
- Manifest quality gating is the core business rule — test it for all three tiers on every change.
- No database — Redis only. Watch position is best-effort; data loss on Redis flush is acceptable.
- TypeScript strict mode is on — no `any` without a comment.
