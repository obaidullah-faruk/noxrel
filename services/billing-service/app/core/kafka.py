import json
from typing import Any

import structlog
from aiokafka import AIOKafkaProducer

from app.core.config import settings

logger = structlog.get_logger(__name__)

_producer: AIOKafkaProducer | None = None


async def get_producer() -> AIOKafkaProducer:
    global _producer
    if _producer is None:
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.kafka_bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode(),
            key_serializer=lambda k: k.encode() if k else None,
            acks="all",
            enable_idempotence=True,
        )
        await _producer.start()
    return _producer


async def publish(topic: str, payload: dict[str, Any], key: str | None = None) -> None:
    try:
        producer = await get_producer()
        await producer.send_and_wait(topic, value=payload, key=key)
        logger.debug("kafka_published", topic=topic)
    except Exception as exc:
        logger.error("kafka_publish_failed", topic=topic, error=str(exc))
        raise


async def publish_with_dlq(topic: str, payload: dict[str, Any], key: str | None = None) -> None:
    """Publish to topic; on failure write to the topic's DLQ instead of dropping the event."""
    try:
        await publish(topic, payload, key=key)
    except Exception as primary_exc:
        dlq_topic = f"{topic}.dlq"
        try:
            producer = await get_producer()
            await producer.send_and_wait(
                dlq_topic,
                value={"error": str(primary_exc), "original_topic": topic, "original_payload": payload},
                key=key,
            )
            logger.warning("kafka_sent_to_dlq", topic=topic, dlq=dlq_topic)
        except Exception as dlq_exc:
            logger.error("kafka_dlq_failed", topic=topic, dlq=dlq_topic, error=str(dlq_exc))


async def stop_producer() -> None:
    global _producer
    if _producer:
        await _producer.stop()
        _producer = None
