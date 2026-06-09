import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestPlans:
    async def test_list_plans_public(self, client: AsyncClient, plan):
        resp = await client.get("/api/v1/billing/plans")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert any(p["name"] == "basic" for p in data)

    async def test_list_plans_empty(self, client: AsyncClient):
        resp = await client.get("/api/v1/billing/plans")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
