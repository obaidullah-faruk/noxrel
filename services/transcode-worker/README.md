# Transcode Worker

Kafka consumer that transcodes uploaded videos into multi-bitrate HLS using FFmpeg, then uploads segments to S3 and publishes the result back to Kafka. No HTTP interface — runs as a long-lived background process.

## Tech Stack

- Python 3.12, confluent-kafka, boto3, tenacity, structlog
- FFmpeg — HLS transcoding, thumbnail extraction, sprite sheet generation
- S3 / LocalStack — reads from `raw-videos`, writes to `transcoded-videos`
- Kafka — consumes `video.uploaded`, publishes `video.transcoded` or `video.transcode_failed`

## Project Layout

```
services/transcode-worker/
├── app/
│   ├── core/
│   │   ├── config.py       # All settings via env vars
│   │   ├── kafka.py        # Producer + consumer factory
│   │   ├── logging.py      # Structured JSON logging (structlog)
│   │   └── s3.py           # S3 download/upload helpers, public URL builder
│   ├── transcoder/
│   │   ├── profiles.py     # Quality profiles: 240p, 480p, 720p, 1080p, 4K
│   │   ├── ffmpeg.py       # FFmpeg wrappers: HLS transcode, master manifest, thumbnails
│   │   └── pipeline.py     # Orchestrates full flow + retry + DLQ on failure
│   └── worker.py           # Consumer loop entry point (SIGTERM-safe)
├── tests/
│   ├── test_ffmpeg.py      # FFmpeg helper unit tests (subprocess mocked)
│   ├── test_pipeline.py    # Pipeline integration tests (all I/O mocked)
│   └── test_s3.py          # S3 upload/download roundtrip via moto
├── pyproject.toml
├── Dockerfile
└── .env.example
```

## Transcode Pipeline

```
1. Consume video.uploaded event
   Payload: { video_id, s3_bucket, s3_key, uploader_id, ... }

2. Download raw video from S3 (raw-videos bucket) to a temp directory

3. Run FFmpeg for each quality profile:
   240p → 480p → 720p → 1080p → 4K (HLS segments + index.m3u8 per quality)

4. Write master.m3u8 referencing all quality variants

5. Extract thumbnails:
   - thumb_poster.jpg  (frame at t=10s)
   - sprite.jpg        (1 frame/10s, 160×90, tiled 10×10 for scrub preview)

6. Upload entire output directory to S3 (transcoded-videos bucket):
   transcoded-videos/{video_id}/
   ├── master.m3u8
   ├── 240p/index.m3u8 + segments/
   ├── 480p/ …
   ├── 720p/ …
   ├── 1080p/ …
   ├── 4K/ …
   └── thumbnails/thumb_poster.jpg, sprite.jpg

7. Publish video.transcoded event with manifest URLs + available qualities

On any failure: retry up to 3× (exponential backoff 2s→8s),
then publish video.transcode_failed + route original event to video.uploaded.dlq
```

## Quality Profiles

| Name  | Resolution  | Video Bitrate | Audio Bitrate |
|-------|-------------|---------------|---------------|
| 240p  | 426×240     | 400k          | 64k           |
| 480p  | 854×480     | 1000k         | 128k          |
| 720p  | 1280×720    | 2500k         | 128k          |
| 1080p | 1920×1080   | 5000k         | 192k          |
| 4K    | 3840×2160   | 15000k        | 192k          |

## Kafka Events

| Topic | Direction | Payload |
|-------|-----------|---------|
| `video.uploaded` | Consumed | `video_id, s3_bucket, s3_key, uploader_id, title` |
| `video.transcoded` | Published | `video_id, hls_manifest_url, thumbnail_url, sprite_url, available_qualities, duration_seconds` |
| `video.transcode_failed` | Published on failure | `video_id, error` |
| `video.uploaded.dlq` | Published on final failure | original event payload |

## Running with Docker (recommended)

### 1. Copy env file

```bash
cd services/transcode-worker
cp .env.example .env
# Defaults work out of the box for local dev
```

### 2. Start infrastructure + worker

```bash
cd infrastructure
docker compose -f docker-compose.infra.yml -f docker-compose.yml up -d
```

### 3. View logs

```bash
docker compose -f docker-compose.infra.yml -f docker-compose.yml logs -f transcode-worker
```

---

## Running locally (without Docker)

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- FFmpeg installed: `brew install ffmpeg` (macOS) / `apt install ffmpeg` (Linux)
- LocalStack running locally (or real AWS credentials)
- Kafka running locally

### Setup

```bash
cd services/transcode-worker

uv sync

cp .env.example .env
# Edit .env: set KAFKA_BOOTSTRAP_SERVERS=localhost:9092, AWS_S3_ENDPOINT_URL=http://localhost:4566

uv run python -m app.worker
```

---

## Running Tests

```bash
cd services/transcode-worker

# No infra needed — Kafka and S3 are fully mocked
uv run pytest tests/ -v
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka broker address |
| `KAFKA_CONSUMER_GROUP` | `transcode-worker` | Consumer group ID |
| `S3_RAW_BUCKET` | `raw-videos` | Bucket containing original uploads |
| `S3_TRANSCODED_BUCKET` | `transcoded-videos` | Bucket for HLS output |
| `CLOUDFRONT_BASE_URL` | `http://localstack:4566/transcoded-videos` | Base URL prepended to S3 keys in event payloads. Set to your CloudFront distribution URL in production. |
| `FFMPEG_PRESET` | `fast` | FFmpeg encoding preset (`ultrafast`→`veryslow`) |
| `FFMPEG_CRF` | `23` | Constant rate factor (lower = higher quality, larger file) |
| `HLS_SEGMENT_DURATION` | `6` | HLS segment length in seconds |
| `TRANSCODE_MAX_RETRIES` | `3` | Max retry attempts before routing to DLQ |
