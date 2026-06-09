import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class SubscriptionPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    billing_interval: str
    price_usd: Decimal
    max_quality: str
    simultaneous_streams: int
    can_download: bool


class SubscriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    plan_id: uuid.UUID
    stripe_subscription_id: str | None
    status: str
    trial_start: datetime | None
    trial_end: datetime | None
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool
    cancelled_at: datetime | None
    created_at: datetime
    plan: SubscriptionPlanOut


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    subscription_id: uuid.UUID
    stripe_invoice_id: str
    amount_usd: Decimal
    status: str
    invoice_pdf_url: str
    billing_reason: str
    created_at: datetime
    paid_at: datetime | None


class PaymentMethodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    stripe_payment_method_id: str
    type: str
    card_brand: str
    last4: str
    exp_month: int
    exp_year: int
    is_default: bool
    created_at: datetime


class CheckoutSessionIn(BaseModel):
    plan_id: uuid.UUID


class CheckoutSessionOut(BaseModel):
    checkout_url: str
    session_id: str


class AddPaymentMethodIn(BaseModel):
    stripe_payment_method_id: str


class AdminSubscriptionOut(SubscriptionOut):
    stripe_customer_id: str


class RefundIn(BaseModel):
    amount_usd: Decimal | None = None  # None = full refund
    reason: str = "requested_by_customer"


class RefundOut(BaseModel):
    refund_id: str
    amount_usd: Decimal
    status: str
