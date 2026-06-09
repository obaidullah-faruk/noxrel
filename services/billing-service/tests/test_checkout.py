from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestCreateCheckout:
    async def test_creates_checkout_session(self, client: AsyncClient, auth_headers, plan):
        mock_session = MagicMock()
        mock_session.url = "https://checkout.stripe.com/pay/cs_test_123"
        mock_session.id = "cs_test_123"

        mock_customer = MagicMock()
        mock_customer.id = "cus_new"

        with (
            patch("app.core.stripe_client._create_customer_sync", return_value=mock_customer),
            patch("app.core.stripe_client._create_checkout_session_sync", return_value=mock_session),
        ):
            resp = await client.post(
                "/api/v1/billing/checkout",
                json={"plan_id": str(plan.id)},
                headers=auth_headers,
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["checkout_url"] == mock_session.url
        assert data["session_id"] == mock_session.id

    async def test_plan_not_found_returns_404(self, client: AsyncClient, auth_headers):
        import uuid

        resp = await client.post(
            "/api/v1/billing/checkout",
            json={"plan_id": str(uuid.uuid4())},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_unauthenticated_returns_401(self, client: AsyncClient, plan):
        resp = await client.post("/api/v1/billing/checkout", json={"plan_id": str(plan.id)})
        assert resp.status_code == 401
