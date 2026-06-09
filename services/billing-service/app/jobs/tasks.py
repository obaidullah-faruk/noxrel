"""Scheduled maintenance jobs.

These run inside the FastAPI process via APScheduler (see scheduler.py).
Each job is wrapped in a Postgres advisory lock so that with multiple API
replicas only one replica executes a given run — no broker, no beat singleton.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, date, datetime

import structlog
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.billing.models import Subscription
from app.core.database import AsyncSessionLocal
from app.core.kafka import publish_with_dlq as publish

logger = structlog.get_logger(__name__)

# Stable lock keys — one per job. Arbitrary distinct integers.
LOCK_EXPIRE_TRIALS = 80701
LOCK_DAILY_STATS = 80702


@asynccontextmanager
async def advisory_lock(session: AsyncSession, key: int) -> AsyncIterator[bool]:
    """Try to grab a session-level Postgres advisory lock.

    Yields True if this replica won the lock, False if another holds it.
    The lock is released automatically when the session connection closes.
    """
    acquired = await session.scalar(text("SELECT pg_try_advisory_lock(:k)"), {"k": key})
    try:
        yield bool(acquired)
    finally:
        if acquired:
            await session.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": key})


async def expire_trials() -> dict:
    """Cancel trialing subscriptions past trial_end that never converted to Stripe."""
    async with AsyncSessionLocal() as session:
        async with advisory_lock(session, LOCK_EXPIRE_TRIALS) as locked:
            if not locked:
                logger.info("expire_trials_skipped_locked")
                return {"expired": 0, "skipped": True}

            expired = (
                await session.scalars(
                    select(Subscription).where(
                        Subscription.status == "trialing",
                        Subscription.trial_end < datetime.now(UTC),
                        Subscription.stripe_subscription_id.is_(None),
                    )
                )
            ).all()

            now = datetime.now(UTC)
            for sub in expired:
                sub.status = "cancelled"
                sub.cancelled_at = now
            await session.commit()
            logger.info("trials_expired", count=len(expired))

            for sub in expired:
                await publish("billing.trial_expired", {"user_id": str(sub.user_id)})

            return {"expired": len(expired)}


async def publish_daily_stats() -> dict:
    """Compute today's subscription stats and publish them to Kafka."""
    async with AsyncSessionLocal() as session:
        async with advisory_lock(session, LOCK_DAILY_STATS) as locked:
            if not locked:
                logger.info("publish_daily_stats_skipped_locked")
                return {"skipped": True}

            today = date.today()
            today_start = datetime(today.year, today.month, today.day, tzinfo=UTC)

            new_subs = (
                await session.scalar(select(func.count(Subscription.id)).where(Subscription.created_at >= today_start))
                or 0
            )

            churned = (
                await session.scalar(
                    select(func.count(Subscription.id)).where(
                        Subscription.status == "cancelled",
                        Subscription.cancelled_at >= today_start,
                    )
                )
                or 0
            )

            trialing_today = (
                await session.scalar(
                    select(func.count(Subscription.id)).where(
                        Subscription.status == "trialing",
                        Subscription.created_at >= today_start,
                    )
                )
                or 0
            )

            converted_today = (
                await session.scalar(
                    select(func.count(Subscription.id)).where(
                        Subscription.status == "active",
                        Subscription.trial_start.isnot(None),
                        Subscription.current_period_start >= today_start,
                    )
                )
                or 0
            )

            trial_conversion_rate = round(converted_today / trialing_today, 2) if trialing_today > 0 else 0.0

            payload = {
                "date": today.isoformat(),
                "new_subscriptions": new_subs,
                "churned_subscriptions": churned,
                "trial_conversions": converted_today,
                "trial_conversion_rate": trial_conversion_rate,
            }

            await publish("billing.daily_stats", payload)
            logger.info("daily_stats_published", date=today.isoformat())
            return payload
