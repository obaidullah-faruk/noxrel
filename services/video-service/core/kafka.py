import json
from typing import Any

import structlog
from confluent_kafka import KafkaException, Producer
from django.conf import settings

logger = structlog.get_logger(__name__)

_producer: Producer | None = None


def _get_producer() -> Producer:
    global _producer
    if _producer is None:
        _producer = Producer(
            {
                "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
                "security.protocol": settings.KAFKA_SECURITY_PROTOCOL,
                "acks": "all",
                "retries": 3,
            }
        )
    return _producer


def _delivery_report(err, msg) -> None:
    if err:
        logger.error("kafka_delivery_failed", topic=msg.topic(), error=str(err))
    else:
        logger.debug("kafka_delivery_ok", topic=msg.topic(), offset=msg.offset())


def publish(topic: str, payload: dict[str, Any], key: str | None = None) -> None:
    """Publish a message. Non-fatal — logs on failure rather than raising."""
    try:
        producer = _get_producer()
        producer.produce(
            topic=topic,
            key=key.encode() if key else None,
            value=json.dumps(payload).encode(),
            callback=_delivery_report,
        )
        producer.poll(0)
    except KafkaException as exc:
        logger.error("kafka_publish_failed", topic=topic, error=str(exc))


def flush() -> None:
    if _producer:
        _producer.flush(timeout=5)
