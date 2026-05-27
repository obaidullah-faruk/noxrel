"""S3 multipart upload helpers. Works against LocalStack and real AWS."""

import boto3
import structlog
from django.conf import settings

logger = structlog.get_logger(__name__)


def _client():
    kwargs = {
        "region_name": settings.AWS_REGION,
        "aws_access_key_id": settings.AWS_ACCESS_KEY_ID,
        "aws_secret_access_key": settings.AWS_SECRET_ACCESS_KEY,
    }
    if settings.AWS_S3_ENDPOINT_URL:
        kwargs["endpoint_url"] = settings.AWS_S3_ENDPOINT_URL
    return boto3.client("s3", **kwargs)


def _rewrite_presigned_url(url: str) -> str:
    """
    Rewrite the host in a presigned URL so browsers can reach it.

    In local dev the service connects to LocalStack via the Docker-internal
    hostname (e.g. http://localstack:4566), but browsers on the host must use
    http://localhost:4566.  S3_PRESIGNED_URL_BASE=http://localhost:4566 handles
    this.  Empty / unset → URL is returned unchanged.
    """
    base = getattr(settings, "S3_PRESIGNED_URL_BASE", "").rstrip("/")
    if not base or not settings.AWS_S3_ENDPOINT_URL:
        return url
    internal = settings.AWS_S3_ENDPOINT_URL.rstrip("/")
    return url.replace(internal, base, 1)


def create_multipart_upload(bucket: str, key: str) -> str:
    """Initiate S3 multipart upload. Returns upload_id."""
    resp = _client().create_multipart_upload(Bucket=bucket, Key=key)
    return resp["UploadId"]


def generate_presigned_part_urls(
    bucket: str,
    key: str,
    upload_id: str,
    part_count: int,
    ttl: int,
) -> list[dict]:
    """
    Return a list of {part_number, url} for each chunk.
    Part numbers are 1-indexed (S3 requirement).
    """
    client = _client()
    urls = []
    for part_number in range(1, part_count + 1):
        url = client.generate_presigned_url(
            "upload_part",
            Params={
                "Bucket": bucket,
                "Key": key,
                "UploadId": upload_id,
                "PartNumber": part_number,
            },
            ExpiresIn=ttl,
        )
        urls.append({"part_number": part_number, "url": _rewrite_presigned_url(url)})
    return urls


def complete_multipart_upload(
    bucket: str,
    key: str,
    upload_id: str,
    parts: list[dict],
) -> str:
    """
    Complete the multipart upload. `parts` must be [{PartNumber, ETag}].
    Returns the assembled S3 object key.
    """
    _client().complete_multipart_upload(
        Bucket=bucket,
        Key=key,
        UploadId=upload_id,
        MultipartUpload={"Parts": parts},
    )
    logger.info("s3_multipart_complete", bucket=bucket, key=key)
    return key


def abort_multipart_upload(bucket: str, key: str, upload_id: str) -> None:
    try:
        _client().abort_multipart_upload(Bucket=bucket, Key=key, UploadId=upload_id)
    except Exception as exc:
        logger.warning("s3_abort_failed", bucket=bucket, key=key, error=str(exc))
