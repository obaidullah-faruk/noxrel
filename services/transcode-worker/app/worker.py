"""Main consumer loop: polls video.uploaded, runs transcode pipeline."""

import json
import signal
import sys

import structlog
from confluent_kafka import KafkaError

from app.core import config, kafka
from app.core.logging import configure
from app.transcoder.pipeline import run_with_retry

configure()
logger = structlog.get_logger(__name__)

_running = True


def _shutdown(signum, frame) -> None:  # noqa: ANN001
    global _running
    logger.info("shutdown_signal", signum=signum)
    _running = False


def main() -> None:
    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    consumer = kafka.make_consumer([config.KAFKA_TOPIC_VIDEO_UPLOADED])
    logger.info("worker_started", topic=config.KAFKA_TOPIC_VIDEO_UPLOADED, group=config.KAFKA_CONSUMER_GROUP)

    try:
        while _running:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                logger.error("kafka_consumer_error", error=str(msg.error()))
                continue

            try:
                event = json.loads(msg.value().decode("utf-8"))
                video_id = event.get("video_id", "?")
                logger.info("event_received", video_id=video_id, topic=msg.topic(), partition=msg.partition())

                run_with_retry(event)

                consumer.commit(message=msg)
                logger.info("event_committed", video_id=video_id)

            except Exception as exc:
                logger.error("event_processing_failed", error=str(exc), exc_info=True)
                # commit anyway to avoid infinite reprocessing after DLQ publish
                consumer.commit(message=msg)

    finally:
        consumer.close()
        logger.info("worker_stopped")


if __name__ == "__main__":
    sys.exit(main())
