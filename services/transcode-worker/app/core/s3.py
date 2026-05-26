"""S3 helpers for downloading raw video and uploading transcoded outputs."""

import os
from pathlib import Path

import boto3
import structlog

from app.core import config

logger = structlog.get_logger(__name__)


def _client():  # noqa: ANN202
    kwargs: dict = {
        "region_name": config.AWS_REGION,
        "aws_access_key_id": config.AWS_ACCESS_KEY_ID,
        "aws_secret_access_key": config.AWS_SECRET_ACCESS_KEY,
    }
    if config.AWS_S3_ENDPOINT_URL:
        kwargs["endpoint_url"] = config.AWS_S3_ENDPOINT_URL
    return boto3.client("s3", **kwargs)


def download_file(bucket: str, key: str, local_path: Path) -> None:
    local_path.parent.mkdir(parents=True, exist_ok=True)
    logger.info("s3_download_start", bucket=bucket, key=key, dest=str(local_path))
    _client().download_file(bucket, key, str(local_path))
    logger.info("s3_download_done", size_bytes=local_path.stat().st_size)


def upload_file(local_path: Path, bucket: str, key: str, content_type: str = "application/octet-stream") -> None:
    logger.debug("s3_upload", bucket=bucket, key=key)
    _client().upload_file(
        str(local_path),
        bucket,
        key,
        ExtraArgs={"ContentType": content_type},
    )


def upload_directory(local_dir: Path, bucket: str, prefix: str) -> list[str]:
    """Recursively upload a local directory. Returns list of uploaded S3 keys."""
    uploaded: list[str] = []
    for root, _, files in os.walk(local_dir):
        for fname in files:
            fpath = Path(root) / fname
            rel = fpath.relative_to(local_dir)
            key = f"{prefix}/{rel}"
            content_type = _guess_content_type(fname)
            upload_file(fpath, bucket, key, content_type)
            uploaded.append(key)
    return uploaded


def _guess_content_type(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    return {
        ".m3u8": "application/vnd.apple.mpegurl",
        ".ts": "video/mp2t",
        ".mpd": "application/dash+xml",
        ".m4s": "video/iso.segment",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
    }.get(ext, "application/octet-stream")


def public_url(bucket: str, key: str) -> str:
    """Return a CloudFront URL if configured, otherwise a LocalStack-friendly URL."""
    if config.CLOUDFRONT_BASE_URL:
        return f"{config.CLOUDFRONT_BASE_URL.rstrip('/')}/{key}"
    endpoint = config.AWS_S3_ENDPOINT_URL or "https://s3.amazonaws.com"
    return f"{endpoint.rstrip('/')}/{bucket}/{key}"
