import os

import pytest

# Minimal env so config.py doesn't need real infra
os.environ.setdefault("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "test")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "test")
os.environ.setdefault("AWS_S3_ENDPOINT_URL", "http://localhost:4566")
os.environ.setdefault("S3_RAW_BUCKET", "raw-videos")
os.environ.setdefault("S3_TRANSCODED_BUCKET", "transcoded-videos")
os.environ.setdefault("S3_THUMBNAIL_BUCKET", "thumbnails")
os.environ.setdefault("DEBUG", "true")


@pytest.fixture
def sample_event() -> dict:
    return {
        "video_id": "11111111-1111-1111-1111-111111111111",
        "uploader_id": "22222222-2222-2222-2222-222222222222",
        "s3_bucket": "raw-videos",
        "s3_key": "raw/uploads/11111111-1111-1111-1111-111111111111/original",
        "raw_file_size_bytes": 10_000_000,
        "title": "Test Video",
    }
