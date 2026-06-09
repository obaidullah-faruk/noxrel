import json
import uuid
from datetime import UTC, datetime, timedelta

import structlog
from aiokafka import AIOKafkaConsumer
from sqlalchemy import select

from app.billing.models import Subscription, SubscriptionPlan
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.kafka import publish_with_dlq as publish
from app.core.stripe_client import create_customer

logger = structlog.get_logger(__name__)


async def handle_user_registered(user_id: str, email: str) -> None:
    user_uuid = uuid.UUID(user_id)
    async with AsyncSessionLocal() as db:
        try:
            # Idempotency: skip if subscription already exists
            existing = await db.execute(select(Subscription).where(Subscription.user_id == user_uuid))
            if existing.scalars().first():
                logger.info("user_registered_already_has_subscription", user_id=user_id)
                return

            customer = await create_customer(
                email=email,
                metadata={"user_id": user_id},
            )

            trial_plan = await db.scalar(select(SubscriptionPlan).where(SubscriptionPlan.name == "free_trial"))
            if not trial_plan:
                logger.error("free_trial_plan_missing")
                return

            now = datetime.now(UTC)
            subscription = Subscription(
                user_id=user_uuid,
                plan_id=trial_plan.id,
                stripe_customer_id=customer.id,
                status="trialing",
                trial_start=now,
                trial_end=now + timedelta(days=7),
                current_period_start=now,
                current_period_end=now + timedelta(days=7),
            )
            db.add(subscription)
            await db.commit()

            await publish(
                "billing.trial_started",
                {"user_id": user_id, "trial_end": subscription.trial_end.isoformat()},
                key=user_id,
            )
            logger.info("trial_created", user_id=user_id, trial_end=subscription.trial_end.isoformat())

        except Exception as exc:
            await db.rollback()
            logger.error("handle_user_registered_failed", user_id=user_id, error=str(exc))
            raise


async def run_consumer() -> None:
    consumer = AIOKafkaConsumer(
        "user.registered",
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id=settings.kafka_consumer_group,
        value_deserializer=lambda v: json.loads(v.decode()),
        auto_offset_reset="earliest",
        enable_auto_commit=False,
    )
    dlq_topic = "user.registered.dlq"

    await consumer.start()
    logger.info("kafka_consumer_started", topic="user.registered")

    try:
        async for msg in consumer:
            try:
                payload = msg.value
                user_id = payload["user_id"]
                email = payload["email"]
                await handle_user_registered(user_id, email)
                await consumer.commit()
            except Exception as exc:
                logger.error("consumer_message_failed", error=str(exc), offset=msg.offset)
                from app.core.kafka import publish_with_dlq as kafka_publish

                await kafka_publish(dlq_topic, {"error": str(exc), "original": msg.value})
                await consumer.commit()
    finally:
        await consumer.stop()
        logger.info("kafka_consumer_stopped")
