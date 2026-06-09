import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.billing.models import Subscription
from app.consumers.user_registered import handle_user_registered


@pytest.mark.asyncio
class TestHandleUserRegistered:
    async def test_creates_trial_subscription(self, db_session: AsyncSession, free_trial_plan):
        user_id = str(uuid.uuid4())
        mock_customer = MagicMock()
        mock_customer.id = "cus_new_trial"

        async def fake_session_context():
            return db_session

        # Patch AsyncSessionLocal to yield the test session
        mock_session_ctx = MagicMock()
        mock_session_ctx.__aenter__ = AsyncMock(return_value=db_session)
        mock_session_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_session_factory = MagicMock(return_value=mock_session_ctx)

        with (
            patch("app.core.stripe_client._create_customer_sync", return_value=mock_customer),
            patch("app.consumers.user_registered.publish", new_callable=AsyncMock) as mock_pub,
            patch("app.consumers.user_registered.AsyncSessionLocal", mock_session_factory),
        ):
            await handle_user_registered(user_id, "user@example.com")

        mock_pub.assert_awaited_once()
        assert mock_pub.call_args[0][0] == "billing.trial_started"

        result = await db_session.execute(select(Subscription).where(Subscription.user_id == uuid.UUID(user_id)))
        sub = result.scalar_one_or_none()
        assert sub is not None
        assert sub.status == "trialing"
        assert sub.stripe_customer_id == "cus_new_trial"

    async def test_idempotent_on_duplicate_user_registered(
        self, db_session: AsyncSession, active_subscription: Subscription
    ):
        user_id = str(active_subscription.user_id)

        mock_session_ctx = MagicMock()
        mock_session_ctx.__aenter__ = AsyncMock(return_value=db_session)
        mock_session_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_session_factory = MagicMock(return_value=mock_session_ctx)

        with (
            patch("app.consumers.user_registered.publish", new_callable=AsyncMock) as mock_pub,
            patch("app.consumers.user_registered.AsyncSessionLocal", mock_session_factory),
        ):
            await handle_user_registered(user_id, "user@example.com")

        # Already has a subscription — no new publish, no error
        mock_pub.assert_not_awaited()

    async def test_missing_trial_plan_logs_error_and_returns(self, db_session: AsyncSession):
        user_id = str(uuid.uuid4())
        mock_customer = MagicMock()
        mock_customer.id = "cus_no_plan"

        mock_session_ctx = MagicMock()
        mock_session_ctx.__aenter__ = AsyncMock(return_value=db_session)
        mock_session_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_session_factory = MagicMock(return_value=mock_session_ctx)

        with (
            patch("app.core.stripe_client._create_customer_sync", return_value=mock_customer),
            patch("app.consumers.user_registered.publish", new_callable=AsyncMock) as mock_pub,
            patch("app.consumers.user_registered.AsyncSessionLocal", mock_session_factory),
        ):
            # No free_trial_plan fixture in this test → scalar returns None
            await handle_user_registered(user_id, "user@example.com")

        mock_pub.assert_not_awaited()
