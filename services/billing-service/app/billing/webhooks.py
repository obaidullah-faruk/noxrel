import uuid
from datetime import UTC, datetime
from decimal import Decimal

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.billing.models import Invoice, Subscription
from app.core.kafka import publish_with_dlq as publish
from app.core.stripe_client import retrieve_subscription

logger = structlog.get_logger(__name__)


async def handle_checkout_completed(session_obj, db: AsyncSession) -> None:
    stripe_sub_id = session_obj.get("subscription")
    if not stripe_sub_id:
        return

    # Resolve the user from session metadata — avoids a race where a user with
    # two pending checkouts would have the wrong subscription updated if we
    # queried by stripe_customer_id alone.
    metadata = session_obj.get("metadata") or {}
    user_id_str = metadata.get("user_id")
    if not user_id_str:
        logger.warning("checkout_completed_missing_user_id_metadata", stripe_sub_id=stripe_sub_id)
        return

    stripe_sub = await retrieve_subscription(stripe_sub_id)

    result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == uuid.UUID(user_id_str),
            Subscription.stripe_subscription_id.is_(None),
        )
    )
    sub = result.scalars().first()
    if not sub:
        logger.warning("checkout_completed_no_pending_subscription", user_id=user_id_str)
        return

    sub.stripe_subscription_id = stripe_sub_id
    sub.status = stripe_sub.status
    sub.current_period_start = datetime.fromtimestamp(stripe_sub.current_period_start, tz=UTC)
    sub.current_period_end = datetime.fromtimestamp(stripe_sub.current_period_end, tz=UTC)
    await db.commit()

    await publish("payment.succeeded", {"user_id": str(sub.user_id), "plan": sub.plan_id and str(sub.plan_id)})
    logger.info("checkout_completed", user_id=str(sub.user_id), stripe_sub_id=stripe_sub_id)


async def handle_payment_succeeded(invoice_obj, db: AsyncSession) -> None:
    stripe_sub_id = invoice_obj.get("subscription")
    if not stripe_sub_id:
        return

    result = await db.execute(select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_id))
    sub = result.scalar_one_or_none()
    if not sub:
        return

    stripe_invoice_id = invoice_obj.get("id", "")
    existing = await db.execute(select(Invoice).where(Invoice.stripe_invoice_id == stripe_invoice_id))
    if existing.scalar_one_or_none():
        return  # idempotent

    invoice = Invoice(
        subscription_id=sub.id,
        stripe_invoice_id=stripe_invoice_id,
        amount_usd=Decimal(invoice_obj.get("amount_paid", 0)) / 100,
        status="paid",
        invoice_pdf_url=invoice_obj.get("invoice_pdf", ""),
        billing_reason=invoice_obj.get("billing_reason", "subscription_cycle"),
        paid_at=datetime.now(UTC),
    )
    db.add(invoice)
    sub.status = "active"
    await db.commit()

    # Emit payment.succeeded for renewal payments so downstream access-control
    # and notification services stay in sync on every billing cycle, not just
    # the initial checkout.
    await publish("payment.succeeded", {"user_id": str(sub.user_id), "plan": sub.plan_id and str(sub.plan_id)})
    logger.info("invoice_paid", user_id=str(sub.user_id), invoice_id=stripe_invoice_id)


async def handle_payment_failed(invoice_obj, db: AsyncSession) -> None:
    stripe_sub_id = invoice_obj.get("subscription")
    if not stripe_sub_id:
        return

    result = await db.execute(select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_id))
    sub = result.scalar_one_or_none()
    if not sub:
        return

    sub.status = "past_due"
    await db.commit()
    await publish("payment.failed", {"user_id": str(sub.user_id)})
    logger.info("payment_failed", user_id=str(sub.user_id))


async def handle_subscription_updated(stripe_sub_obj, db: AsyncSession) -> None:
    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_obj.get("id"))
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return

    sub.status = stripe_sub_obj.get("status", sub.status)
    sub.cancel_at_period_end = stripe_sub_obj.get("cancel_at_period_end", False)
    sub.current_period_start = datetime.fromtimestamp(stripe_sub_obj["current_period_start"], tz=UTC)
    sub.current_period_end = datetime.fromtimestamp(stripe_sub_obj["current_period_end"], tz=UTC)
    await db.commit()


async def handle_subscription_deleted(stripe_sub_obj, db: AsyncSession) -> None:
    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_obj.get("id"))
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return

    sub.status = "cancelled"
    sub.cancelled_at = datetime.now(UTC)
    await db.commit()
    # Use a dedicated topic — not payment.failed — so that voluntary
    # cancellations do not trigger payment-failure flows in downstream services.
    await publish("billing.subscription_cancelled", {"user_id": str(sub.user_id)})
    logger.info("subscription_deleted", user_id=str(sub.user_id))


async def handle_trial_ending(stripe_sub_obj, db: AsyncSession) -> None:
    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_obj.get("id"))
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return

    trial_end = stripe_sub_obj.get("trial_end")
    await publish(
        "user.trial_expiring",
        {
            "user_id": str(sub.user_id),
            "trial_end": datetime.fromtimestamp(trial_end, tz=UTC).isoformat() if trial_end else None,
        },
    )
    logger.info("trial_will_end", user_id=str(sub.user_id))
