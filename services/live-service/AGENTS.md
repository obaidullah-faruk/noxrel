# live-service — AGENTS.md

Read the root `AGENTS.md` first, then this file.

## What This Service Owns

Ingest orchestration — both RTMP (OBS/external encoders via nginx-rtmp) and
browser-based go-live (MediaRecorder webm over the `/live-ingest` socket.io
namespace, piped to FFmpeg stdin) — real-time HLS transcoding (one FFmpeg child
process per live session), live + replay HLS delivery via S3/CloudFront, live
chat, and viewer-count tracking. After a stream ends it stitches a VOD replay and
registers it with video-service so it plays as a normal video.

**Media bytes never pass through application logic for delivery** — viewers
fetch HLS from CloudFront/S3 directly. live-service only writes segments to S3
and serves JSON/WebSocket APIs.

## Tech

Node.js 24 · Fastify · TypeScript · PostgreSQL (`live_service` db) · Redis ·
MongoDB (`live_service` db, chat) · S3 (`live-segments`) · FFmpeg · Port **3003**
(host) / **3000** (container)

## Project Layout

```
services/live-service/
  src/
    routes/        # Fastify routes (stream-keys, sessions, internal RTMP hooks)
    handlers/      # request handlers + vod-finalize
    services/      # ffmpeg, segment-sync, s3, kafka, redis, mongo, vod-register, reconcile, nginx-control, hls
    chat/          # socket.io gateway + chat service
    db/            # pg pool, repos, SQL migrations
    core/          # logging, health, exceptions, jwt, auth
  tests/           # vitest
  Dockerfile       # includes the ffmpeg binary
```

## API Contract (do not change routes without updating dependents)

All public routes are under `/api/v1/live` (Kong forwards with `strip_path: false`).

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/live/stream-keys` | Bearer JWT | Create stream key (ULID) |
| GET | `/api/v1/live/stream-keys` | Bearer JWT | List own keys |
| DELETE | `/api/v1/live/stream-keys/:id` | Bearer JWT (owner) | Revoke + drop active publisher |
| GET | `/api/v1/live/sessions` | public | List live sessions |
| GET | `/api/v1/live/sessions/:id` | public | Session detail (+ `vodVideoId` once ended) |
| POST | `/api/v1/live/sessions/:id/heartbeat` | public | Viewer presence beat (15 s) |
| DELETE | `/api/v1/live/sessions/:id` | Bearer JWT (admin) | Force-end |
| WS | `/api/v1/live/socket.io` | JWT in handshake | Chat |
| WS | `/api/v1/live/socket.io` ns `/live-ingest` | JWT in handshake | Browser go-live: MediaRecorder webm `chunk`s → FFmpeg stdin. `title` in handshake query; server mints the stream key. Emits `live_started` / `ingest_error`; `stop`/disconnect finalizes. |
| GET | `/health` | none | Health check |
| POST | `/internal/rtmp/on_publish` | docker network only | nginx-rtmp start hook |
| POST | `/internal/rtmp/on_publish_done` | docker network only | nginx-rtmp end hook |

JWT is verified in-service with the user-service RS256 public key — this service
never issues tokens. Chat identity comes from the verified JWT, never a
client-supplied field.

## Kafka Events Published

| Topic | Trigger |
|---|---|
| `live.started` | Broadcaster connects (RTMP on_publish, or `/live-ingest` socket connects) |
| `live.ended` | VOD finalize completes + replay registered |
| `live.viewer_count` | 30 s viewer snapshot |

Payloads are snake_case with `event` + `ts` fields, message key = `session_id`
(matches streaming-service convention). Producer only — no consumers this phase.

## Cross-Service Dependencies

- **video-service**: `POST /internal/videos/from_live` (header `X-Internal-Key`)
  registers the replay. Idempotent on `live_session_id`. Retried with backoff.
- **transcode-worker**: NOT used. Live never goes through it.
- **streaming-service**: NOT used. Live/replay HLS bypasses it (served from
  `live-segments`, not `transcoded-videos`).
- **nginx-rtmp**: ingest edge; `on_publish`/`on_publish_done` hooks + `rtmp_control`
  for dropping publishers.

## Data Stores

- PostgreSQL `live_service`: `stream_keys`, `live_sessions`, `live_segments`.
  Partial unique index enforces one active session per key. `live_segments` is
  the source of truth for replay playlists (real durations, crash-safe).
- Redis: viewer-presence ZSET (`live:session:{id}:viewers`), chat rate-limit
  (`chat_rate:{userId}`, 1 s TTL), socket.io pub/sub adapter.
- MongoDB `live_service`: `live_chat_messages` (90-day TTL).
- S3 `live-segments`: `sessions/{id}/` — live segments ARE the replay segments.
  **No lifecycle rule** — cleanup is app-driven (reconcile.service).

## Test Commands

```bash
cd services/live-service
npm test            # vitest
npm run typecheck
npm run lint
```

## Known Gotchas

- Session IDs are `crypto.randomUUID()` (UUID column). ULID is only the
  stream-key string.
- FFmpeg uses a single process with `-var_stream_map` + `filter_complex` split.
  `-master_pl_name` writes the master at start so ABR works while live.
- The segment-sync loop deletes local `.ts` files only after a confirmed S3
  upload — a transient S3 error never loses replay segments.
- `finalizeVod` is idempotent via an atomic `live|stitch_failed → stitching`
  transition; the FFmpeg close handler, the stale sweeper, and the retry job all
  call it safely.
- `RENDITIONS` env trims the ladder for dev (e.g. `720p,480p`) — a 4-rung
  software encode is heavy on a laptop.
- TypeScript strict mode is on — no `any` without a comment.
