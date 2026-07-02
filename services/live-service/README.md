# live-service

RTMP ingest → real-time multi-quality HLS → adaptive-bitrate live playback,
with live chat, viewer counts, and automatic VOD replay. Part of the video
streaming platform (Phase 05).

## What it does

1. A broadcaster pushes RTMP to `nginx-rtmp` (`rtmp://<host>:1935/live/<stream_key>`).
2. nginx-rtmp calls this service's `on_publish` hook; the stream key is validated
   and a `LiveSession` is created.
3. This service spawns one FFmpeg process that transcodes the live input into a
   4-rung HLS ladder (1080p/720p/480p/360p) and writes segments to scratch.
4. A 2-second sync loop uploads new segments + playlists to the `live-segments`
   S3 bucket and indexes each segment in PostgreSQL.
5. Viewers play the HLS master from CloudFront/S3 (never from this service) and
   chat over a JWT-authenticated socket.io connection.
6. When the stream ends, a VOD replay is stitched from the segment index and
   registered with video-service so it plays as a normal video.

## Run

Always run via the platform compose stack (it provisions Postgres, Redis,
MongoDB, Kafka, LocalStack, nginx-rtmp):

```bash
docker compose -f infrastructure/docker-compose.infra.yml -f infrastructure/docker-compose.yml up -d live-service nginx-rtmp
```

The container applies DB migrations on startup. On a pre-existing Postgres
volume, create the database first (the init script only runs on a fresh volume):

```sql
CREATE DATABASE live_service;
```

Ports: `3003` (host) → `3000` (container) for the HTTP/WS API; `1935` for RTMP.

## Local development

```bash
cd services/live-service
npm install
cp .env.example .env        # adjust hostnames to localhost if running outside compose
npm run migrate up          # apply schema to live_service db
npm run dev                 # tsx watch
```

For a lighter local encode, trim the ladder: `RENDITIONS=720p,480p` in `.env`.

## Test / lint

```bash
npm test          # vitest
npm run typecheck
npm run lint
```

## Try a stream (OBS)

- Server: `rtmp://localhost:1935/live`
- Stream key: a key created via `POST /api/v1/live/stream-keys`

Watch at `web-user` `/live/<sessionId>`, or list active streams at `/live`.

See `AGENTS.md` for the full API contract, data stores, and conventions.
