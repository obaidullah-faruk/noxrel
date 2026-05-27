"""
Django management command: consume video.transcoded and video.transcode_failed
Kafka events and update Video / TranscodeJob records accordingly.

Run alongside gunicorn in Docker:
  uv run python manage.py consume_transcode_events
"""

import json
import signal

import structlog
from confluent_kafka import Consumer, KafkaError
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

logger = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Consume video.transcoded and video.transcode_failed Kafka events"

    def handle(self, *args, **options) -> None:  # noqa: ANN002, ANN003
        running = True

        def _shutdown(signum, frame) -> None:  # noqa: ANN001
            nonlocal running
            logger.info("shutdown_signal", signum=signum)
            running = False

        signal.signal(signal.SIGTERM, _shutdown)
        signal.signal(signal.SIGINT, _shutdown)

        topics = ["video.transcoded", "video.transcode_failed"]
        consumer = Consumer(
            {
                "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
                "security.protocol": settings.KAFKA_SECURITY_PROTOCOL,
                "group.id": "video-service-transcode-events",
                "auto.offset.reset": "earliest",
                "enable.auto.commit": False,
            }
        )
        consumer.subscribe(topics)
        logger.info("transcode_event_consumer_started", topics=topics)

        try:
            while running:
                msg = consumer.poll(timeout=1.0)
                if msg is None:
                    continue
                err = msg.error()
                if err:
                    if err.code() == KafkaError._PARTITION_EOF:
                        continue
                    logger.error("kafka_error", error=str(err))
                    continue

                try:
                    raw = msg.value()
                    event = json.loads(raw.decode("utf-8") if raw else "{}")
                    topic = msg.topic()

                    if topic == "video.transcoded":
                        _handle_transcoded(event)
                    elif topic == "video.transcode_failed":
                        _handle_failed(event)

                    consumer.commit(message=msg)

                except Exception as exc:
                    logger.error("event_handler_error", error=str(exc), exc_info=True)
                    consumer.commit(message=msg)
        finally:
            consumer.close()
            logger.info("transcode_event_consumer_stopped")


def _handle_transcoded(event: dict) -> None:
    from videos.models import TranscodeJob, Video

    video_id = event.get("video_id")
    if not video_id:
        logger.warning("transcoded_event_missing_video_id")
        return

    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        logger.warning("transcoded_video_not_found", video_id=video_id)
        return

    video.status = Video.STATUS_READY
    video.hls_manifest_url = event.get("hls_manifest_url", "")
    video.dash_manifest_url = event.get("dash_manifest_url", "")
    video.thumbnail_url = event.get("thumbnail_url", "")
    video.sprite_url = event.get("sprite_url", "")
    video.available_qualities = event.get("available_qualities", [])
    if event.get("duration_seconds") is not None:
        video.duration_seconds = event["duration_seconds"]
    video.save(
        update_fields=[
            "status",
            "hls_manifest_url",
            "dash_manifest_url",
            "thumbnail_url",
            "sprite_url",
            "available_qualities",
            "duration_seconds",
            "updated_at",
        ]
    )

    TranscodeJob.objects.filter(video_id=video_id).update(
        status=TranscodeJob.STATUS_COMPLETED,
        completed_at=timezone.now(),
    )

    logger.info("video_marked_ready", video_id=video_id)


def _handle_failed(event: dict) -> None:
    from videos.models import TranscodeJob, Video

    video_id = event.get("video_id")
    error = event.get("error", "unknown")
    if not video_id:
        return

    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        logger.warning("failed_video_not_found", video_id=video_id)
        return

    video.status = Video.STATUS_FAILED
    video.save(update_fields=["status", "updated_at"])

    TranscodeJob.objects.filter(video_id=video_id).update(
        status=TranscodeJob.STATUS_FAILED,
        error_message=error[:2000],
        completed_at=timezone.now(),
    )

    logger.error("video_marked_failed", video_id=video_id, error=error)
