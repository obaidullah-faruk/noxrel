import uuid
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient


def _mock_stripe_pm(pm_id: str = "pm_test123") -> MagicMock:
    pm = MagicMock()
    pm.get = lambda key, default=None: {
        "type": "card",
        "card": {"brand": "visa", "last4": "4242", "exp_month": 12, "exp_year": 2030},
    }.get(key, default)
    return pm


@pytest.mark.asyncio
class TestAddPaymentMethod:
    async def test_add_first_payment_method_becomes_default(
        self, client: AsyncClient, auth_headers, active_subscription
    ):
        mock_pm = _mock_stripe_pm()
        with (
            patch("app.core.stripe_client._attach_payment_method_sync", return_value=mock_pm),
            patch("app.core.stripe_client._retrieve_payment_method_sync", return_value=mock_pm),
        ):
            resp = await client.post(
                "/api/v1/billing/payment-methods",
                json={"stripe_payment_method_id": "pm_test123"},
                headers=auth_headers,
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["is_default"] is True
        assert data["last4"] == "4242"

    async def test_add_payment_method_no_subscription_returns_404(self, client: AsyncClient):
        headers = {
            "x-user-id": str(uuid.uuid4()),
            "x-user-roles": "subscriber",
            "x-gateway-secret": "test-gateway-secret",
        }
        resp = await client.post(
            "/api/v1/billing/payment-methods",
            json={"stripe_payment_method_id": "pm_test123"},
            headers=headers,
        )
        assert resp.status_code == 404

    async def test_unauthenticated_returns_401(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/billing/payment-methods",
            json={"stripe_payment_method_id": "pm_test123"},
        )
        assert resp.status_code == 401


@pytest.mark.asyncio
class TestRemovePaymentMethod:
    async def test_remove_existing_payment_method(
        self, client: AsyncClient, auth_headers, active_subscription, db_session
    ):
        from app.billing.models import PaymentMethod

        pm = PaymentMethod(
            user_id=active_subscription.user_id,
            stripe_payment_method_id="pm_to_delete",
            type="card",
            card_brand="visa",
            last4="4242",
            exp_month=12,
            exp_year=2030,
            is_default=True,
        )
        db_session.add(pm)
        await db_session.commit()
        await db_session.refresh(pm)

        with patch("app.core.stripe_client._detach_payment_method_sync", return_value=MagicMock()):
            resp = await client.delete(
                f"/api/v1/billing/payment-methods/{pm.id}",
                headers=auth_headers,
            )

        assert resp.status_code == 204

    async def test_remove_nonexistent_returns_404(self, client: AsyncClient, auth_headers):
        resp = await client.delete(
            f"/api/v1/billing/payment-methods/{uuid.uuid4()}",
            headers=auth_headers,
        )
        assert resp.status_code == 404
