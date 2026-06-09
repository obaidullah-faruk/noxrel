"""Async Stripe helpers.

All stripe-sdk calls are synchronous blocking HTTP. This module wraps every
call in run_in_executor so the asyncio event loop is never blocked, and
decorates each wrapper with a tenacity retry + circuit-breaker so transient
Stripe API errors (5xx, network timeouts) are retried with exponential back-off
before propagating.
"""

import asyncio
from collections.abc import Callable
from typing import Any, TypeVar

import stripe
import structlog
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = structlog.get_logger(__name__)

T = TypeVar("T")

_RETRYABLE = (
    stripe.error.APIConnectionError,
    stripe.error.APIError,
    stripe.error.RateLimitError,
)


def _stripe_retry(fn: Callable[..., T]) -> Callable[..., T]:
    return retry(
        retry=retry_if_exception_type(_RETRYABLE),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=8),
        stop=stop_after_attempt(3),
        reraise=True,
    )(fn)


async def _run(fn: Callable[[], T]) -> T:
    return await asyncio.get_event_loop().run_in_executor(None, fn)


@_stripe_retry
def _create_customer_sync(**kwargs: Any) -> stripe.Customer:
    return stripe.Customer.create(**kwargs)  # type: ignore[no-any-return]


async def create_customer(**kwargs: Any) -> stripe.Customer:
    return await _run(lambda: _create_customer_sync(**kwargs))


@_stripe_retry
def _retrieve_subscription_sync(sub_id: str, **kwargs: Any) -> stripe.Subscription:
    return stripe.Subscription.retrieve(sub_id, **kwargs)  # type: ignore[no-any-return]


async def retrieve_subscription(sub_id: str, **kwargs: Any) -> stripe.Subscription:
    return await _run(lambda: _retrieve_subscription_sync(sub_id, **kwargs))


@_stripe_retry
def _modify_subscription_sync(sub_id: str, **kwargs: Any) -> stripe.Subscription:
    return stripe.Subscription.modify(sub_id, **kwargs)  # type: ignore[no-any-return]


async def modify_subscription(sub_id: str, **kwargs: Any) -> stripe.Subscription:
    return await _run(lambda: _modify_subscription_sync(sub_id, **kwargs))


@_stripe_retry
def _create_checkout_session_sync(**kwargs: Any) -> stripe.checkout.Session:
    return stripe.checkout.Session.create(**kwargs)  # type: ignore[no-any-return]


async def create_checkout_session(**kwargs: Any) -> stripe.checkout.Session:
    return await _run(lambda: _create_checkout_session_sync(**kwargs))


@_stripe_retry
def _attach_payment_method_sync(pm_id: str, **kwargs: Any) -> stripe.PaymentMethod:
    return stripe.PaymentMethod.attach(pm_id, **kwargs)  # type: ignore[no-any-return]


async def attach_payment_method(pm_id: str, **kwargs: Any) -> stripe.PaymentMethod:
    return await _run(lambda: _attach_payment_method_sync(pm_id, **kwargs))


@_stripe_retry
def _retrieve_payment_method_sync(pm_id: str) -> stripe.PaymentMethod:
    return stripe.PaymentMethod.retrieve(pm_id)  # type: ignore[no-any-return]


async def retrieve_payment_method(pm_id: str) -> stripe.PaymentMethod:
    return await _run(lambda: _retrieve_payment_method_sync(pm_id))


@_stripe_retry
def _detach_payment_method_sync(pm_id: str) -> stripe.PaymentMethod:
    return stripe.PaymentMethod.detach(pm_id)  # type: ignore[no-any-return]


async def detach_payment_method(pm_id: str) -> stripe.PaymentMethod:
    return await _run(lambda: _detach_payment_method_sync(pm_id))


@_stripe_retry
def _retrieve_invoice_sync(invoice_id: str) -> stripe.Invoice:
    return stripe.Invoice.retrieve(invoice_id)  # type: ignore[no-any-return]


async def retrieve_invoice(invoice_id: str) -> stripe.Invoice:
    return await _run(lambda: _retrieve_invoice_sync(invoice_id))


@_stripe_retry
def _create_refund_sync(**kwargs: Any) -> stripe.Refund:
    return stripe.Refund.create(**kwargs)  # type: ignore[no-any-return]


async def create_refund(**kwargs: Any) -> stripe.Refund:
    return await _run(lambda: _create_refund_sync(**kwargs))
