import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.billing.models import Invoice


@pytest.mark.asyncio
class TestInvoices:
    async def test_list_invoices_empty(self, client: AsyncClient, auth_headers, active_subscription):
        resp = await client.get("/api/v1/billing/invoices", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_invoices_with_data(self, client: AsyncClient, auth_headers, active_subscription, db_session):
        invoice = Invoice(
            subscription_id=active_subscription.id,
            stripe_invoice_id="in_test_001",
            amount_usd=Decimal("9.99"),
            status="paid",
            billing_reason="subscription_cycle",
            paid_at=datetime.now(UTC),
        )
        db_session.add(invoice)
        await db_session.commit()

        resp = await client.get("/api/v1/billing/invoices", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["stripe_invoice_id"] == "in_test_001"

    async def test_list_invoices_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/v1/billing/invoices")
        assert resp.status_code == 401

    async def test_invoice_pdf_not_found(self, client: AsyncClient, auth_headers):
        resp = await client.get(f"/api/v1/billing/invoices/{uuid.uuid4()}/pdf", headers=auth_headers)
        assert resp.status_code == 404
