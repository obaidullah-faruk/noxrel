from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.billing.models import Invoice, Subscription
from app.billing.webhooks import (
    handle_checkout_completed,
    handle_payment_failed,
    handle_payment_succeeded,
    handle_subscription_deleted,
    handle_trial_ending,
)


@pytest.mark.asyncio
class TestCheckoutCompletedWebhook:
    async def test_links_stripe_subscription_to_pending_sub(
        self, db_session: AsyncSession, trialing_subscription: Subscription
    ):
        # trialing_subscription has no stripe_subscription_id yet (pending checkout)
        mock_stripe_sub = MagicMock()
        mock_stripe_sub.status = "active"
        mock_stripe_sub.current_period_start = int(datetime.now(UTC).timestamp())
        mock_stripe_sub.current_period_end = int((datetime.now(UTC) + timedelta(days=30)).timestamp())

        session_obj = {
            "subscription": "sub_stripe123",
            "metadata": {"user_id": str(trialing_subscription.user_id)},
        }

        with (
            patch("app.billing.webhooks.publish", new_callable=AsyncMock) as mock_pub,
            patch("app.billing.webhooks.retrieve_subscription", new_callable=AsyncMock, return_value=mock_stripe_sub),
        ):
            await handle_checkout_completed(session_obj, db_session)

        await db_session.refresh(trialing_subscription)
        assert trialing_subscription.stripe_subscription_id == "sub_stripe123"
        assert trialing_subscription.status == "active"
        mock_pub.assert_awaited_once()
        assert mock_pub.call_args[0][0] == "payment.succeeded"

    async def test_no_subscription_field_is_noop(self, db_session: AsyncSession):
        with patch("app.billing.webhooks.publish", new_callable=AsyncMock) as mock_pub:
            await handle_checkout_completed({}, db_session)
        mock_pub.assert_not_awaited()

    async def test_missing_user_id_metadata_is_noop(self, db_session: AsyncSession):
        with patch("app.billing.webhooks.publish", new_callable=AsyncMock) as mock_pub:
            await handle_checkout_completed({"subscription": "sub_x", "metadata": {}}, db_session)
        mock_pub.assert_not_awaited()


@pytest.mark.asyncio
class TestPaymentSucceededWebhook:
    async def test_records_invoice_and_emits_event(self, db_session: AsyncSession, active_subscription: Subscription):
        invoice_obj = {
            "id": "in_test_new",
            "subscription": active_subscription.stripe_subscription_id,
            "amount_paid": 999,
            "invoice_pdf": "https://invoice.pdf",
            "billing_reason": "subscription_cycle",
        }

        with patch("app.billing.webhooks.publish", new_callable=AsyncMock) as mock_pub:
            await handle_payment_succeeded(invoice_obj, db_session)

        mock_pub.assert_awaited_once()
        assert mock_pub.call_args[0][0] == "payment.succeeded"

    async def test_idempotent_on_duplicate_invoice(self, db_session: AsyncSession, active_subscription: Subscription):
        existing_invoice = Invoice(
            subscription_id=active_subscription.id,
            stripe_invoice_id="in_dup",
            amount_usd=Decimal("9.99"),
            status="paid",
            billing_reason="subscription_cycle",
        )
        db_session.add(existing_invoice)
        await db_session.commit()

        invoice_obj = {
            "id": "in_dup",
            "subscription": active_subscription.stripe_subscription_id,
            "amount_paid": 999,
        }

        with patch("app.billing.webhooks.publish", new_callable=AsyncMock) as mock_pub:
            await handle_payment_succeeded(invoice_obj, db_session)

        mock_pub.assert_not_awaited()

    async def test_unknown_subscription_is_noop(self, db_session: AsyncSession):
        with patch("app.billing.webhooks.publish", new_callable=AsyncMock) as mock_pub:
            await handle_payment_succeeded({"id": "in_x", "subscription": "sub_unknown"}, db_session)
        mock_pub.assert_not_awaited()


@pytest.mark.asyncio
class TestSubscriptionCancelledEvent:
    async def test_subscription_deleted_emits_cancelled_not_payment_failed(
        self, db_session: AsyncSession, active_subscription: Subscription
    ):
        stripe_sub_obj = {"id": active_subscription.stripe_subscription_id}

        with patch("app.billing.webhooks.publish", new_callable=AsyncMock) as mock_pub:
            await handle_subscription_deleted(stripe_sub_obj, db_session)

        mock_pub.assert_awaited_once()
        assert mock_pub.call_args[0][0] == "billing.subscription_cancelled"
        assert mock_pub.call_args[0][0] != "payment.failed"


@pytest.mark.asyncio
class TestPaymentFailedWebhook:
    async def test_sets_status_past_due(self, db_session: AsyncSession, active_subscription: Subscription):
        invoice_obj = {"subscription": active_subscription.stripe_subscription_id}

        with patch("app.billing.webhooks.publish", new_callable=AsyncMock):
            await handle_payment_failed(invoice_obj, db_session)

        await db_session.refresh(active_subscription)
        assert active_subscription.status == "past_due"

    async def test_unknown_subscription_noop(self, db_session: AsyncSession):
        invoice_obj = {"subscription": "sub_nonexistent"}
        with patch("app.billing.webhooks.publish", new_callable=AsyncMock):
            await handle_payment_failed(invoice_obj, db_session)


@pytest.mark.asyncio
class TestTrialEndingWebhook:
    async def test_publishes_trial_expiring_event(self, db_session: AsyncSession, trialing_subscription: Subscription):
        trial_end_ts = int((datetime.now(UTC) + timedelta(days=3)).timestamp())
        stripe_sub_obj = {
            "id": trialing_subscription.stripe_subscription_id or "sub_none",
            "trial_end": trial_end_ts,
        }

        # give it a stripe_subscription_id so lookup works
        trialing_subscription.stripe_subscription_id = stripe_sub_obj["id"]
        await db_session.commit()

        with patch("app.billing.webhooks.publish", new_callable=AsyncMock) as mock_publish:
            await handle_trial_ending(stripe_sub_obj, db_session)

        mock_publish.assert_awaited_once()
        call_args = mock_publish.call_args
        assert call_args[0][0] == "user.trial_expiring"
        assert "user_id" in call_args[0][1]


@pytest.mark.asyncio
class TestSubscriptionDeletedWebhook:
    async def test_sets_status_cancelled(self, db_session: AsyncSession, active_subscription: Subscription):
        stripe_sub_obj = {"id": active_subscription.stripe_subscription_id}

        with patch("app.billing.webhooks.publish", new_callable=AsyncMock):
            await handle_subscription_deleted(stripe_sub_obj, db_session)

        await db_session.refresh(active_subscription)
        assert active_subscription.status == "cancelled"
        assert active_subscription.cancelled_at is not None
