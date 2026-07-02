# video-service — AGENTS.md

Read the root `AGENTS.md` first, then this file.

## What This Service Owns

Video metadata, catalog, upload orchestration (S3 presigned multipart URLs), publish flow, and transcode trigger. **Video bytes never pass through this service — the browser PUTs directly to S3.**

## Tech

Django REST Framework · PostgreSQL · LocalStack/AWS S3 · Port **8001**

## Project Layout

```
services/video-service/
  config/          # Django project package (settings, urls, wsgi, asgi)
  core/            # logging, jwt_verify, kafka, health, exceptions
  videos/          # Video model, CRUD, publish/unpublish
  uploaders/       # Presigned URL generation, multipart complete
  catalog/         # Public catalog endpoints (listing, search, detail)
  tests/           # All tests
  manage.py
  pyproject.toml
```

## API Contract (do not change routes without updating dependents)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/upload/initiate` | Bearer (admin) | Start multipart upload → returns upload_id + presigned URLs |
| POST | `/api/v1/upload/complete` | Bearer (admin) | Call CompleteMultipartUpload on S3 |
| GET | `/api/v1/catalog/` | Bearer | List published videos |
| GET | `/api/v1/catalog/{id}/` | Bearer | Video detail |
| PATCH | `/api/v1/videos/{id}/publish` | Bearer (admin) | Publish a video |
| PATCH | `/api/v1/videos/{id}/unpublish` | Bearer (admin) | Unpublish |
| GET | `/health/` | None | Health check |

## Kafka Events Published

| Topic | Trigger |
|---|---|
| `video.uploaded` | S3 multipart complete confirmed |
| `video.published` | Video marked published |
| `video.unpublished` | Video marked unpublished |

Every topic has a `.dlq` counterpart.

## Kafka Events Consumed

| Topic | Action |
|---|---|
| `video.transcoded` | Updates video status and stores HLS manifest path |

## S3 Buckets Used

- `raw-videos` — original uploads (write)
- `transcoded-videos` — HLS output (read, path stored after transcoding)
- `thumbnails` — thumbnail images (read, path stored after transcoding)

## Cross-Service Dependencies

- **transcode-worker** consumes `video.uploaded` and publishes `video.transcoded`.
- **streaming-service** reads video metadata (manifest path) via internal HTTP — do not change the catalog API shape.
- **web-admin** calls upload and catalog endpoints directly.

## Test Commands

```bash
cd services/video-service
uv run pytest tests/ -v --tb=short
uv run ruff check .
uv run mypy . --ignore-missing-imports
```

## Known Gotchas

- S3 calls use LocalStack locally (`AWS_ENDPOINT_URL=http://localhost:4566`). The same code path runs against real S3 in production — never add a `if localstack` branch.
- CORS on `raw-videos` bucket is configured for `localhost:3000` and `localhost:3001` in `infrastructure/localstack/init-scripts/`.
- Presigned URLs expire in 3600 s — do not extend without checking the frontend upload chunking logic.
- Django apps are at the service root, not inside an `apps/` wrapper.
