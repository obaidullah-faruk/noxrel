import uuid
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestAdminListSubscriptions:
    async def test_admin_can_list_subscriptions(self, client: AsyncClient, admin_headers, active_subscription):
        resp = await client.get("/api/v1/billing/admin/subscriptions", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    async def test_subscriber_cannot_access_admin_endpoint(
        self, client: AsyncClient, auth_headers, active_subscription
    ):
        resp = await client.get("/api/v1/billing/admin/subscriptions", headers=auth_headers)
        assert resp.status_code == 403

    async def test_unauthenticated_returns_401(self, client: AsyncClient):
        resp = await client.get("/api/v1/billing/admin/subscriptions")
        assert resp.status_code == 401

    async def test_page_size_capped_at_200(self, client: AsyncClient, admin_headers):
        resp = await client.get(
            "/api/v1/billing/admin/subscriptions?page_size=99999",
            headers=admin_headers,
        )
        assert resp.status_code == 422


@pytest.mark.asyncio
class TestAdminRefund:
    async def test_refund_issues_stripe_refund(
        self, client: AsyncClient, admin_headers, active_subscription, db_session
    ):
        from app.billing.models import Invoice

        invoice = Invoice(
            subscription_id=active_subscription.id,
            stripe_invoice_id="in_test123",
            amount_usd=Decimal("9.99"),
            status="paid",
            billing_reason="subscription_create",
        )
        db_session.add(invoice)
        await db_session.commit()

        mock_invoice = MagicMock()
        mock_invoice.get = lambda key, default=None: {"charge": "ch_test123"}.get(key, default)

        mock_refund = MagicMock()
        mock_refund.id = "re_test123"
        mock_refund.amount = 999
        mock_refund.status = "succeeded"

        with (
            patch("app.core.stripe_client._retrieve_invoice_sync", return_value=mock_invoice),
            patch("app.core.stripe_client._create_refund_sync", return_value=mock_refund),
        ):
            resp = await client.post(
                f"/api/v1/billing/admin/subscriptions/{active_subscription.id}/refund",
                json={"reason": "duplicate"},
                headers=admin_headers,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["refund_id"] == "re_test123"
        assert data["status"] == "succeeded"

    async def test_refund_nonexistent_subscription_returns_404(self, client: AsyncClient, admin_headers):
        resp = await client.post(
            f"/api/v1/billing/admin/subscriptions/{uuid.uuid4()}/refund",
            json={},
            headers=admin_headers,
        )
        assert resp.status_code == 404

    async def test_subscriber_cannot_refund(self, client: AsyncClient, auth_headers, active_subscription):
        resp = await client.post(
            f"/api/v1/billing/admin/subscriptions/{active_subscription.id}/refund",
            json={},
            headers=auth_headers,
        )
        assert resp.status_code == 403
