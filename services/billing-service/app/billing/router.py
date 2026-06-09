import uuid
from decimal import Decimal
from typing import Annotated

import stripe
import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.billing.models import Invoice, PaymentMethod, Subscription, SubscriptionPlan
from app.billing.schemas import (
    AddPaymentMethodIn,
    AdminSubscriptionOut,
    CheckoutSessionIn,
    CheckoutSessionOut,
    InvoiceOut,
    PaymentMethodOut,
    RefundIn,
    RefundOut,
    SubscriptionOut,
    SubscriptionPlanOut,
)
from app.billing.webhooks import (
    handle_checkout_completed,
    handle_payment_failed,
    handle_payment_succeeded,
    handle_subscription_deleted,
    handle_subscription_updated,
    handle_trial_ending,
)
from app.core.config import settings
from app.core.database import get_async_session
from app.core.security import BillingAdmin, CurrentUser
from app.core.stripe_client import (
    attach_payment_method,
    create_customer,
    create_refund,
    detach_payment_method,
    retrieve_invoice,
    retrieve_payment_method,
)
from app.core.stripe_client import (
    create_checkout_session as stripe_create_checkout_session,
)

logger = structlog.get_logger(__name__)

router = APIRouter()
AsyncDB = Annotated[AsyncSession, Depends(get_async_session)]

# ---------------------------------------------------------------------------
# Plans
# ---------------------------------------------------------------------------


@router.get("/billing/plans", response_model=list[SubscriptionPlanOut], tags=["plans"])
async def list_plans(db: AsyncDB):
    result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.is_active == True))  # noqa: E712
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Checkout
# ---------------------------------------------------------------------------


@router.post(
    "/billing/checkout", response_model=CheckoutSessionOut, status_code=status.HTTP_201_CREATED, tags=["billing"]
)  # noqa: E501
async def create_checkout_session(body: CheckoutSessionIn, user: CurrentUser, db: AsyncDB):
    plan = await db.get(SubscriptionPlan, body.plan_id)
    if not plan or not plan.is_active:
        raise HTTPException(status_code=404, detail="Plan not found")
    if not plan.stripe_price_id:
        raise HTTPException(status_code=422, detail="Plan has no Stripe price configured")

    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id).order_by(Subscription.created_at.desc())
    )
    existing_sub = sub_result.scalars().first()

    trial_end_ts = None
    if existing_sub and existing_sub.status == "trialing" and existing_sub.trial_end:
        trial_end_ts = int(existing_sub.trial_end.timestamp())

    customer_id = existing_sub.stripe_customer_id if existing_sub else None
    if not customer_id:
        customer = await create_customer(metadata={"user_id": str(user.id)})
        customer_id = customer.id

    subscription_data: dict = {}
    if trial_end_ts:
        subscription_data["trial_end"] = trial_end_ts

    session = await stripe_create_checkout_session(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": plan.stripe_price_id, "quantity": 1}],
        mode="subscription",
        subscription_data=subscription_data if subscription_data else None,
        success_url=settings.stripe_success_url + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=settings.stripe_cancel_url,
        metadata={"user_id": str(user.id), "plan_id": str(plan.id)},
    )
    return CheckoutSessionOut(checkout_url=session.url, session_id=session.id)


# ---------------------------------------------------------------------------
# Subscription
# ---------------------------------------------------------------------------


@router.get("/billing/subscription", response_model=SubscriptionOut, tags=["billing"])
async def get_my_subscription(user: CurrentUser, db: AsyncDB):
    result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == user.id)
        .options(selectinload(Subscription.plan))
        .order_by(Subscription.created_at.desc())
    )
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="No subscription found")
    return sub


@router.post("/billing/subscription/cancel", response_model=SubscriptionOut, tags=["billing"])
async def cancel_subscription(user: CurrentUser, db: AsyncDB):
    result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == user.id, Subscription.status.in_(["active", "trialing"]))
        .options(selectinload(Subscription.plan))
    )
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription found")

    if sub.stripe_subscription_id:
        from app.core.stripe_client import modify_subscription

        await modify_subscription(sub.stripe_subscription_id, cancel_at_period_end=True)

    sub.cancel_at_period_end = True
    await db.commit()
    await db.refresh(sub)
    return sub


@router.post("/billing/subscription/reactivate", response_model=SubscriptionOut, tags=["billing"])
async def reactivate_subscription(user: CurrentUser, db: AsyncDB):
    result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == user.id, Subscription.cancel_at_period_end == True)  # noqa: E712
        .options(selectinload(Subscription.plan))
    )
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="No cancelled subscription found")

    if sub.stripe_subscription_id:
        from app.core.stripe_client import modify_subscription

        await modify_subscription(sub.stripe_subscription_id, cancel_at_period_end=False)

    sub.cancel_at_period_end = False
    await db.commit()
    await db.refresh(sub)
    return sub


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------


@router.get("/billing/invoices", response_model=list[InvoiceOut], tags=["invoices"])
async def list_invoices(user: CurrentUser, db: AsyncDB):
    result = await db.execute(
        select(Invoice).join(Subscription).where(Subscription.user_id == user.id).order_by(Invoice.created_at.desc())
    )
    return result.scalars().all()


@router.get("/billing/invoices/{invoice_id}/pdf", tags=["invoices"])
async def get_invoice_pdf(invoice_id: uuid.UUID, user: CurrentUser, db: AsyncDB):
    result = await db.execute(
        select(Invoice).join(Subscription).where(Invoice.id == invoice_id, Subscription.user_id == user.id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not invoice.invoice_pdf_url:
        raise HTTPException(status_code=404, detail="PDF not available")
    return {"pdf_url": invoice.invoice_pdf_url}


# ---------------------------------------------------------------------------
# Payment methods
# ---------------------------------------------------------------------------


@router.get("/billing/payment-methods", response_model=list[PaymentMethodOut], tags=["payment-methods"])
async def list_payment_methods(user: CurrentUser, db: AsyncDB):
    result = await db.execute(
        select(PaymentMethod).where(PaymentMethod.user_id == user.id).order_by(PaymentMethod.created_at.desc())
    )
    return result.scalars().all()


@router.post(
    "/billing/payment-methods",
    response_model=PaymentMethodOut,
    status_code=status.HTTP_201_CREATED,
    tags=["payment-methods"],
)  # noqa: E501
async def add_payment_method(body: AddPaymentMethodIn, user: CurrentUser, db: AsyncDB):
    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id).order_by(Subscription.created_at.desc())
    )
    existing_sub = sub_result.scalars().first()
    if not existing_sub:
        raise HTTPException(status_code=404, detail="No subscription found")

    try:
        await attach_payment_method(body.stripe_payment_method_id, customer=existing_sub.stripe_customer_id)
        pm = await retrieve_payment_method(body.stripe_payment_method_id)
    except stripe.error.StripeError as exc:
        raise HTTPException(status_code=422, detail=str(exc.user_message)) from exc

    card = pm.get("card", {})
    existing_defaults = await db.execute(
        select(PaymentMethod).where(PaymentMethod.user_id == user.id, PaymentMethod.is_default == True)  # noqa: E712
    )
    has_default = existing_defaults.scalars().first() is not None

    payment_method = PaymentMethod(
        user_id=user.id,
        stripe_payment_method_id=body.stripe_payment_method_id,
        type=pm.get("type", "card"),
        card_brand=card.get("brand", ""),
        last4=card.get("last4", ""),
        exp_month=card.get("exp_month", 0),
        exp_year=card.get("exp_year", 0),
        is_default=not has_default,
    )
    db.add(payment_method)
    await db.commit()
    await db.refresh(payment_method)
    return payment_method


@router.delete("/billing/payment-methods/{pm_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["payment-methods"])
async def remove_payment_method(pm_id: uuid.UUID, user: CurrentUser, db: AsyncDB):
    result = await db.execute(select(PaymentMethod).where(PaymentMethod.id == pm_id, PaymentMethod.user_id == user.id))
    pm = result.scalar_one_or_none()
    if not pm:
        raise HTTPException(status_code=404, detail="Payment method not found")

    try:
        await detach_payment_method(pm.stripe_payment_method_id)
    except stripe.error.StripeError as exc:
        raise HTTPException(status_code=422, detail=str(exc.user_message)) from exc

    await db.delete(pm)
    await db.commit()


# ---------------------------------------------------------------------------
# Stripe webhook
# ---------------------------------------------------------------------------


@router.post("/billing/webhooks/stripe", tags=["webhooks"])
async def stripe_webhook(request: Request, db: AsyncDB):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

    handlers = {
        "checkout.session.completed": handle_checkout_completed,
        "invoice.payment_succeeded": handle_payment_succeeded,
        "invoice.payment_failed": handle_payment_failed,
        "customer.subscription.updated": handle_subscription_updated,
        "customer.subscription.deleted": handle_subscription_deleted,
        "customer.subscription.trial_will_end": handle_trial_ending,
    }

    handler = handlers.get(event["type"])
    if handler:
        await handler(event["data"]["object"], db)

    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------


@router.get("/billing/admin/subscriptions", response_model=list[AdminSubscriptionOut], tags=["admin"])
async def admin_list_subscriptions(
    user: BillingAdmin,
    db: AsyncDB,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
):
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Subscription)
        .options(selectinload(Subscription.plan))
        .order_by(Subscription.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    return result.scalars().all()


@router.post("/billing/admin/subscriptions/{subscription_id}/refund", response_model=RefundOut, tags=["admin"])
async def admin_refund_subscription(
    subscription_id: uuid.UUID,
    body: RefundIn,
    user: BillingAdmin,
    db: AsyncDB,
):
    result = await db.execute(select(Subscription).where(Subscription.id == subscription_id))
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    invoice_result = await db.execute(
        select(Invoice)
        .where(Invoice.subscription_id == subscription_id, Invoice.status == "paid")
        .order_by(Invoice.created_at.desc())
    )
    latest_invoice = invoice_result.scalars().first()
    if not latest_invoice:
        raise HTTPException(status_code=404, detail="No paid invoice found")

    stripe_invoice = await retrieve_invoice(latest_invoice.stripe_invoice_id)
    charge_id = stripe_invoice.get("charge")
    if not charge_id:
        raise HTTPException(status_code=422, detail="No charge associated with invoice")

    refund_params: dict = {"charge": charge_id, "reason": body.reason}
    if body.amount_usd is not None:
        refund_params["amount"] = int(body.amount_usd * 100)

    try:
        refund = await create_refund(**refund_params)
    except stripe.error.StripeError as exc:
        raise HTTPException(status_code=422, detail=str(exc.user_message)) from exc

    logger.info("admin_refund_issued", subscription_id=str(subscription_id), refund_id=refund.id)
    return RefundOut(
        refund_id=refund.id,
        amount_usd=Decimal(refund.amount) / 100,
        status=refund.status,
    )
