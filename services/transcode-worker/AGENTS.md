# transcode-worker — AGENTS.md

Read the root `AGENTS.md` first, then this file.

## What This Service Owns

FFmpeg-based video transcoding: downloads raw video from S3, transcodes to HLS (multiple qualities), uploads segments + manifest to S3, publishes `video.transcoded` Kafka event.

**No HTTP interface.** This service is Kafka-consumer-only.

## Tech

Python · FFmpeg · boto3 · aiokafka · LocalStack/AWS S3

## Project Layout

```
services/transcode-worker/
  core/            # logging, config, kafka, exceptions
  worker/          # transcode pipeline, S3 download/upload, FFmpeg wrapper
  tests/
  pyproject.toml
```

## Kafka Events Consumed

| Topic | Action |
|---|---|
| `video.uploaded` | Download raw video, transcode, upload HLS, emit `video.transcoded` |

DLQ: `video.uploaded.dlq` — failed messages land here after max retries.

## Kafka Events Published

| Topic | Payload fields |
|---|---|
| `video.transcoded` | `video_id`, `hls_manifest_path`, `thumbnail_path`, `qualities[]`, `duration_s` |

## S3 Buckets Used

- `raw-videos` — download source
- `transcoded-videos` — HLS segments + manifest upload destination
- `thumbnails` — generated thumbnail upload destination

## Output HLS Qualities

| Label | Resolution | Bitrate |
|---|---|---|
| 480p | 854×480 | 1400k |
| 720p | 1280×720 | 2800k |
| 1080p | 1920×1080 | 5000k |

Do not change quality labels without updating `streaming-service` quality gating.

## Cross-Service Dependencies

- Reads raw video from S3 (no HTTP call to video-service).
- Publishes `video.transcoded` consumed by `video-service` to update status.

## Test Commands

```bash
cd services/transcode-worker
uv run pytest tests/ -v --tb=short
uv run ruff check .
uv run mypy . --ignore-missing-imports
```

## Known Gotchas

- FFmpeg must be installed in the Docker image (`apt-get install -y ffmpeg`). Local dev requires FFmpeg on PATH.
- S3 calls use `AWS_ENDPOINT_URL=http://localhost:4566` locally — never add conditional branches.
- Transcoding is idempotent: re-running for the same `video_id` overwrites S3 objects safely.
- Max retries before DLQ: 3. Do not increase without considering S3 cost on large files.
