# Video Service

Django REST Framework service handling video uploads, metadata, catalog browsing, and transcode orchestration.

## Tech Stack

- Python 3.12, Django 5.2, Django REST Framework
- PostgreSQL — videos, transcode jobs, multipart upload sessions, uploader profiles
- Redis — video metadata cache, trending scores (TTL 300s)
- S3 / LocalStack — raw uploads (`raw-videos` bucket), transcoded segments (`transcoded-videos` bucket)
- Kafka — publishes `video.uploaded` event after upload completion
- boto3 — S3 multipart presigned URL generation
- drf-spectacular — Swagger UI at `/docs/`

## Project Layout

```
services/video-service/
├── config/          # Django project package (settings, urls, wsgi, asgi, test_settings)
├── core/            # Shared utilities: logging, middleware, permissions, kafka, health
├── videos/          # Video model, TranscodeJob, UploaderProfile, CRUD + publish endpoints
├── uploaders/       # VideoMultipartUpload model, upload init/complete endpoints, s3.py
├── catalog/         # List, trending, related video endpoints
├── tests/           # pytest integration tests
├── manage.py
├── pyproject.toml   # uv project + dependencies
└── Dockerfile
```

## Running with Docker (recommended)

### 1. Copy and edit the env file

```bash
cd services/video-service
cp .env.example .env
# Defaults work out of the box for local dev
```

### 2. Start infrastructure + video-service

```bash
cd infrastructure
docker compose -f docker-compose.infra.yml -f docker-compose.yml up -d
```

On first boot the container automatically runs:
- `migrate` — applies all DB migrations

### 3. Access the service

| URL | Description |
|-----|-------------|
| `http://localhost:8001/docs/` | Swagger UI |
| `http://localhost:8001/health/` | Health check |
| `http://localhost:8001/admin/` | Django admin |

### 4. View logs

```bash
docker compose -f docker-compose.infra.yml -f docker-compose.yml logs -f video-service
```

---

## Running locally (without Docker)

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- PostgreSQL and Redis running locally
- LocalStack running locally (or real AWS credentials)

### Setup

```bash
cd services/video-service

# Install dependencies
uv sync

# Copy env and adjust DB_HOST=localhost, REDIS_URL=redis://localhost:6379/1
cp .env.example .env

# Apply migrations
uv run python manage.py migrate

# Start dev server
uv run python manage.py runserver 8001
```

---

## API Endpoints

### Upload Flow

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/videos/upload/init/` | `video:upload` | Initiate S3 multipart — returns presigned part URLs |
| POST | `/videos/upload/complete/` | `video:upload` | Complete multipart upload, publish `video.uploaded` to Kafka |

### Videos

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/videos/{id}/` | `video:watch` | Get video metadata |
| PATCH | `/videos/{id}/` | `video:upload` | Update title, description, tags (own videos only) |
| DELETE | `/videos/{id}/` | `video:delete` | Soft delete (own videos only) |
| POST | `/videos/{id}/publish/` | `video:publish` | Change status → published |

### Catalog

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/catalog/` | `video:watch` | Paginated video list (filters: `category`, `tag`) |
| GET | `/catalog/trending/` | `video:watch` | Top 50 by view count |
| GET | `/catalog/{id}/related/` | `video:watch` | Same category, sorted by view count |

### Internal (service-to-service)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/internal/videos/{id}/` | `X-Internal-Key` header | Used by Streaming, Search services |

---

## Upload Flow Detail

Video bytes never touch the application server. Only JSON metadata passes through.

```
1. POST /videos/upload/init/
   Body: { title, file_size_bytes, description?, category?, tags? }
   Returns: { video_id, upload_id, s3_upload_id, presigned_parts: [{part_number, url}] }

2. Client: PUT each chunk directly to its presigned S3 URL (parallel, 5 MB per part)
   S3 returns an ETag per part — collect these.

3. POST /videos/upload/complete/
   Body: { upload_id, part_etags: [{part_number, etag}] }
   → Server calls S3 CompleteMultipartUpload
   → Video status: uploading → processing
   → Publishes video.uploaded to Kafka
   Returns: { video_id }
```

---

## Kafka Events

| Topic | Published when | Payload |
|-------|---------------|---------|
| `video.uploaded` | Upload complete | `video_id, uploader_id, s3_bucket, s3_key, title` |

Consumed by the **Transcode Worker** which runs FFmpeg and publishes `video.transcoded` back, updating the video record to `status=ready` with HLS manifest URLs.

---

## Running Tests

```bash
# Local (SQLite in-memory, no Docker needed)
cd services/video-service
uv run pytest tests/ -v

# Via Docker
docker compose -f infrastructure/docker-compose.infra.yml -f infrastructure/docker-compose.yml \
  --profile test run --rm video-service-test
```

---

## Permission Model

Permissions are forwarded by the API Gateway in the `X-User-Permissions` header (comma-separated) after JWT validation. The video-service trusts these headers — it does not query the User Service DB.

| Permission | Grants |
|-----------|--------|
| `video:watch` | Read video metadata, browse catalog |
| `video:upload` | Initiate and complete uploads, edit own videos |
| `video:publish` | Publish a ready video |
| `video:delete` | Soft delete own videos |
