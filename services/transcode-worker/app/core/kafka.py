import json
from typing import Any

import structlog
from confluent_kafka import Consumer, KafkaException, Producer

from app.core import config

logger = structlog.get_logger(__name__)

_producer: Producer | None = None


def _get_producer() -> Producer:
    global _producer
    if _producer is None:
        _producer = Producer(
            {
                "bootstrap.servers": config.KAFKA_BOOTSTRAP_SERVERS,
                "security.protocol": config.KAFKA_SECURITY_PROTOCOL,
                "acks": "all",
                "retries": 3,
            }
        )
    return _producer


def _delivery_report(err, msg) -> None:  # noqa: ANN001
    if err:
        logger.error("kafka_delivery_failed", topic=msg.topic(), error=str(err))
    else:
        logger.debug("kafka_delivery_ok", topic=msg.topic(), offset=msg.offset())


def publish(topic: str, payload: dict[str, Any], key: str | None = None) -> None:
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


def make_consumer(topics: list[str]) -> Consumer:
    consumer = Consumer(
        {
            "bootstrap.servers": config.KAFKA_BOOTSTRAP_SERVERS,
            "security.protocol": config.KAFKA_SECURITY_PROTOCOL,
            "group.id": config.KAFKA_CONSUMER_GROUP,
            "auto.offset.reset": "earliest",
            "enable.auto.commit": False,
            # Transcode jobs can take >5 min for 4K. Give 2 hours before
            # Kafka considers the consumer dead and triggers rebalance.
            "max.poll.interval.ms": 7_200_000,
            "session.timeout.ms": 60_000,
            "heartbeat.interval.ms": 20_000,
        }
    )
    consumer.subscribe(topics)
    return consumer
