from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestHealth:
    async def test_health_structure(self, client: AsyncClient):
        with patch("app.main.get_producer", new_callable=AsyncMock):
            resp = await client.get("/health")

        assert resp.status_code in (200, 503)
        data = resp.json()
        assert data["service"] == "billing-service"
        assert set(data["checks"].keys()) == {"database", "kafka"}

    async def test_health_degraded_when_db_down(self, client: AsyncClient):
        with (
            patch("app.main.async_engine") as mock_engine,
            patch("app.main.get_producer", new_callable=AsyncMock),
        ):
            mock_engine.connect.side_effect = Exception("DB down")
            resp = await client.get("/health")

        data = resp.json()
        assert data["service"] == "billing-service"
        assert data["checks"]["database"] is False
