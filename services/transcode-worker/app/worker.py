"""Main consumer loop: polls video.uploaded, runs transcode pipeline."""

import json
import signal
from pathlib import Path

import structlog
from confluent_kafka import KafkaError
from opentelemetry import trace

from app.core import config, kafka
from app.core.logging import configure
from app.core.telemetry import setup_telemetry
from app.transcoder.pipeline import run_with_retry

configure()
setup_telemetry()
logger = structlog.get_logger(__name__)
tracer = trace.get_tracer(config.SERVICE_NAME)

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
            err = msg.error()
            if err:
                if err.code() == KafkaError._PARTITION_EOF:
                    continue
                logger.error("kafka_consumer_error", error=str(err))
                continue

            try:
                raw = msg.value()
                event = json.loads(raw.decode("utf-8") if raw is not None else "{}")
                video_id = event.get("video_id", "?")
                logger.info("event_received", video_id=video_id, topic=msg.topic(), partition=msg.partition())

                with tracer.start_as_current_span(
                    "transcode_job",
                    attributes={"video_id": video_id, "kafka.topic": msg.topic()},
                ):
                    run_with_retry(event)

                consumer.commit(message=msg)
                Path(config.LIVENESS_FILE).touch()
                logger.info("event_committed", video_id=video_id)

            except Exception as exc:
                logger.error("event_processing_failed", error=str(exc), exc_info=True)
                # commit anyway to avoid infinite reprocessing after DLQ publish
                consumer.commit(message=msg)

    finally:
        consumer.close()
        logger.info("worker_stopped")


if __name__ == "__main__":
    main()
