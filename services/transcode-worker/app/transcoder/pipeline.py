"""End-to-end transcode pipeline: S3 download → FFmpeg → S3 upload → Kafka events."""

import tempfile
from pathlib import Path

import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core import config, kafka, s3
from app.transcoder import ffmpeg
from app.transcoder.profiles import QUALITY_PROFILES

logger = structlog.get_logger(__name__)


def run(event: dict) -> None:
    """
    Process a video.uploaded Kafka event.
    Raises on unrecoverable failure so the caller can route to DLQ.
    """
    video_id: str = event["video_id"]
    raw_bucket: str = event["s3_bucket"]
    raw_key: str = event["s3_key"]

    log = logger.bind(video_id=video_id)
    log.info("transcode_start")

    with tempfile.TemporaryDirectory(prefix=f"transcode_{video_id}_") as tmpdir:
        work = Path(tmpdir)
        input_path = work / "original.mp4"
        output_dir = work / "output"
        thumb_dir = work / "output" / "thumbnails"

        _download_raw(raw_bucket, raw_key, input_path, log)

        duration = ffmpeg.probe_duration(input_path)
        log.info("video_probed", duration_seconds=duration)

        _transcode_all_profiles(input_path, output_dir, log)
        ffmpeg.write_master_manifest(output_dir, QUALITY_PROFILES)

        _extract_thumbnails(input_path, thumb_dir, log)

        hls_keys = s3.upload_directory(
            output_dir,
            config.S3_TRANSCODED_BUCKET,
            prefix=video_id,
        )
        log.info("s3_upload_done", files=len(hls_keys))

    master_key = f"{video_id}/master.m3u8"
    hls_url = s3.public_url(config.S3_TRANSCODED_BUCKET, master_key)
    poster_key = f"{video_id}/thumbnails/thumb_poster.jpg"
    thumbnail_url = s3.public_url(config.S3_TRANSCODED_BUCKET, poster_key)
    sprite_key = f"{video_id}/thumbnails/sprite.jpg"
    sprite_url = s3.public_url(config.S3_TRANSCODED_BUCKET, sprite_key)

    available_qualities = [p.name for p in QUALITY_PROFILES]

    kafka.publish(
        topic=config.KAFKA_TOPIC_VIDEO_TRANSCODED,
        payload={
            "video_id": video_id,
            "uploader_id": event.get("uploader_id"),
            "hls_manifest_url": hls_url,
            "dash_manifest_url": "",
            "thumbnail_url": thumbnail_url,
            "sprite_url": sprite_url,
            "available_qualities": available_qualities,
            "duration_seconds": duration,
        },
        key=video_id,
    )
    kafka.flush()

    log.info("transcode_complete", hls_url=hls_url)


def run_with_retry(event: dict) -> None:
    """Wrap run() with tenacity retries. On final failure publishes to DLQ topic."""
    video_id = event.get("video_id", "unknown")
    try:
        _run_with_retries(event)
    except Exception as exc:
        logger.error("transcode_final_failure", video_id=video_id, error=str(exc))
        kafka.publish(
            topic=config.KAFKA_TOPIC_VIDEO_TRANSCODE_FAILED,
            payload={
                "video_id": video_id,
                "error": str(exc),
            },
            key=video_id,
        )
        kafka.publish(
            topic=config.KAFKA_TOPIC_DLQ,
            payload=event,
            key=video_id,
        )
        kafka.flush()
        raise


@retry(
    stop=stop_after_attempt(config.TRANSCODE_MAX_RETRIES),
    wait=wait_exponential(multiplier=1, min=2, max=8),
    reraise=True,
)
def _run_with_retries(event: dict) -> None:
    run(event)


def _download_raw(bucket: str, key: str, dest: Path, log) -> None:  # noqa: ANN001
    log.info("s3_download", bucket=bucket, key=key)
    s3.download_file(bucket, key, dest)


def _transcode_all_profiles(input_path: Path, output_dir: Path, log) -> None:  # noqa: ANN001
    for profile in QUALITY_PROFILES:
        log.info("transcoding_profile", profile=profile.name)
        ffmpeg.transcode_hls(input_path, output_dir, profile)
        log.info("profile_done", profile=profile.name)


def _extract_thumbnails(input_path: Path, thumb_dir: Path, log) -> None:  # noqa: ANN001
    log.info("thumbnail_extract")
    try:
        ffmpeg.extract_thumbnail(input_path, thumb_dir)
        ffmpeg.extract_sprite(input_path, thumb_dir)
    except Exception as exc:
        log.warning("thumbnail_failed", error=str(exc))
