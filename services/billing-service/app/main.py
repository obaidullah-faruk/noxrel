import asyncio
import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import stripe
import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.billing.router import router as billing_router
from app.core.config import settings
from app.core.database import async_engine  # noqa: F401 — re-exported for test patching
from app.core.kafka import get_producer, stop_producer
from app.core.logging import configure_logging
from app.core.metrics import metrics_endpoint, metrics_middleware
from app.core.telemetry import setup_telemetry

configure_logging()
logger = structlog.get_logger(__name__)

stripe.api_key = settings.stripe_secret_key


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    from app.consumers.user_registered import run_consumer
    from app.jobs.scheduler import start_scheduler

    asyncio.create_task(run_consumer())
    start_scheduler()
    logger.info("billing_service_started")

    yield

    from app.jobs.scheduler import shutdown_scheduler

    shutdown_scheduler()
    await stop_producer()
    logger.info("billing_service_stopped")


app = FastAPI(
    title="Billing Service",
    description="Subscription plans, Stripe billing, invoices, and trial management.",
    version="1.0.0",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)

setup_telemetry(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next) -> Response:  # noqa: ANN001
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    trace_id = request.headers.get("x-trace-id", request_id)

    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        trace_id=trace_id,
        method=request.method,
        path=request.url.path,
    )

    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000, 2)

    response.headers["X-Request-ID"] = request_id
    logger.info("request_completed", status_code=response.status_code, duration_ms=duration_ms)
    return response


app.middleware("http")(metrics_middleware)

app.include_router(billing_router, prefix="/api/v1")

app.add_route("/metrics", metrics_endpoint)


@app.get("/health", tags=["health"])
async def health_check():
    from sqlalchemy import text

    checks: dict[str, bool] = {"database": False, "kafka": False}

    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:
        pass

    try:
        await get_producer()
        checks["kafka"] = True
    except Exception:
        pass

    ok = all(checks.values())
    return {
        "status": "ok" if ok else "degraded",
        "service": settings.service_name,
        "checks": checks,
    }
