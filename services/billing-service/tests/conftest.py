import os
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.billing.models import Subscription, SubscriptionPlan
from app.core.database import Base, get_async_session
from app.main import app

# Use a real Postgres DB when TEST_DB_URL is provided (CI / docker-compose test
# profile). Fall back to SQLite for local runs without a running DB.
# Note: Postgres ENUM DDL is skipped under SQLite — models use String columns
# in tests. The docker-compose billing-service-test profile wires the real DB.
TEST_DB_URL = os.getenv("TEST_DB_URL", "sqlite+aiosqlite:///:memory:")

# Stable shared secret used across all test fixtures so gateway-header auth
# passes through _user_from_gateway_headers without a real Bearer token.
_TEST_GATEWAY_SECRET = "test-gateway-secret"


@pytest_asyncio.fixture(autouse=True)
def patch_gateway_secret(monkeypatch):
    """Inject the gateway shared secret into settings so header auth works in tests."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "gateway_shared_secret", _TEST_GATEWAY_SECRET)


@pytest_asyncio.fixture
async def engine():
    connect_args = {"check_same_thread": False} if TEST_DB_URL.startswith("sqlite") else {}
    _engine = create_async_engine(TEST_DB_URL, connect_args=connect_args)
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield _engine
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _engine.dispose()


@pytest_asyncio.fixture
async def db_session(engine) -> AsyncGenerator[AsyncSession, None]:
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_session():
        yield db_session

    app.dependency_overrides[get_async_session] = override_session

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
def user_id() -> str:
    return str(uuid.uuid4())


@pytest.fixture
def auth_headers(user_id: str) -> dict:
    return {"x-user-id": user_id, "x-user-roles": "subscriber", "x-gateway-secret": _TEST_GATEWAY_SECRET}


@pytest.fixture
def admin_headers() -> dict:
    return {"x-user-id": str(uuid.uuid4()), "x-user-roles": "admin", "x-gateway-secret": _TEST_GATEWAY_SECRET}


@pytest_asyncio.fixture
async def plan(db_session: AsyncSession) -> SubscriptionPlan:
    p = SubscriptionPlan(
        name="basic",
        stripe_price_id="price_test_basic",
        stripe_product_id="prod_test",
        billing_interval="month",
        price_usd=Decimal("9.99"),
        max_quality="1080p",
        simultaneous_streams=1,
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


@pytest_asyncio.fixture
async def free_trial_plan(db_session: AsyncSession) -> SubscriptionPlan:
    p = SubscriptionPlan(
        name="free_trial",
        billing_interval="month",
        price_usd=Decimal("0.00"),
        max_quality="1080p",
        simultaneous_streams=1,
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


@pytest_asyncio.fixture
async def active_subscription(db_session: AsyncSession, plan: SubscriptionPlan, user_id: str) -> Subscription:
    now = datetime.now(UTC)
    sub = Subscription(
        user_id=uuid.UUID(user_id),
        plan_id=plan.id,
        stripe_customer_id="cus_test123",
        stripe_subscription_id="sub_test123",
        status="active",
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    db_session.add(sub)
    await db_session.commit()
    await db_session.refresh(sub)
    return sub


@pytest_asyncio.fixture
async def trialing_subscription(
    db_session: AsyncSession, free_trial_plan: SubscriptionPlan, user_id: str
) -> Subscription:
    now = datetime.now(UTC)
    sub = Subscription(
        user_id=uuid.UUID(user_id),
        plan_id=free_trial_plan.id,
        stripe_customer_id="cus_trial123",
        status="trialing",
        trial_start=now,
        trial_end=now + timedelta(days=7),
        current_period_start=now,
        current_period_end=now + timedelta(days=7),
    )
    db_session.add(sub)
    await db_session.commit()
    await db_session.refresh(sub)
    return sub
