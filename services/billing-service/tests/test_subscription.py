import uuid
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestGetSubscription:
    async def test_get_subscription_success(self, client: AsyncClient, auth_headers, active_subscription):
        resp = await client.get("/api/v1/billing/subscription", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "active"
        assert "plan" in data

    async def test_get_subscription_not_found(self, client: AsyncClient):
        headers = {
            "x-user-id": str(uuid.uuid4()),
            "x-user-roles": "subscriber",
            "x-gateway-secret": "test-gateway-secret",
        }
        resp = await client.get("/api/v1/billing/subscription", headers=headers)
        assert resp.status_code == 404

    async def test_get_subscription_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/v1/billing/subscription")
        assert resp.status_code == 401


@pytest.mark.asyncio
class TestCancelSubscription:
    async def test_cancel_marks_period_end(self, client: AsyncClient, auth_headers, active_subscription):
        with patch("app.billing.router.stripe.Subscription.modify") as mock_modify:
            mock_modify.return_value = MagicMock()
            resp = await client.post("/api/v1/billing/subscription/cancel", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["cancel_at_period_end"] is True

    async def test_cancel_no_subscription(self, client: AsyncClient):
        headers = {
            "x-user-id": str(uuid.uuid4()),
            "x-user-roles": "subscriber",
            "x-gateway-secret": "test-gateway-secret",
        }
        resp = await client.post("/api/v1/billing/subscription/cancel", headers=headers)
        assert resp.status_code == 404


@pytest.mark.asyncio
class TestReactivateSubscription:
    async def test_reactivate_requires_cancelled_flag(self, client: AsyncClient, auth_headers, active_subscription):
        # active_subscription has cancel_at_period_end=False → nothing to reactivate
        resp = await client.post("/api/v1/billing/subscription/reactivate", headers=auth_headers)
        assert resp.status_code == 404
