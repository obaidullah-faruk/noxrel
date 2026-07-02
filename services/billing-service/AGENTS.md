# billing-service — AGENTS.md

Read the root `AGENTS.md` first, then this file.

## What This Service Owns

Stripe-powered subscription plans, 7-day trial enforcement, webhook handling, invoice management, and payment methods. **Never issues JWT tokens — only verifies via gateway headers.**

## Tech

FastAPI · SQLAlchemy 2.0 (async) · Alembic · PostgreSQL · APScheduler · aiokafka · Stripe · Port **8003**

## Project Layout

```
services/billing-service/
  app/
    core/           # config, database, security, kafka, logging, metrics, telemetry
    billing/        # models, schemas, router, webhooks
    consumers/      # aiokafka consumer for user.registered
    jobs/           # APScheduler scheduler + scheduled job functions
    main.py         # FastAPI app (starts consumer + scheduler in lifespan)
  alembic/          # Alembic migrations
  tests/
  Dockerfile
  pyproject.toml
```

## API Contract (do not change routes without updating dependents)

All routes prefixed `/api/v1/`:

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/billing/plans` | None | List active plans |
| POST | `/billing/checkout` | Bearer | Create Stripe checkout session |
| GET | `/billing/subscription` | Bearer | Own subscription |
| POST | `/billing/subscription/cancel` | Bearer | Cancel at period end |
| POST | `/billing/subscription/reactivate` | Bearer | Un-cancel |
| GET | `/billing/invoices` | Bearer | Invoice history |
| GET | `/billing/invoices/{id}/pdf` | Bearer | Invoice PDF URL |
| GET | `/billing/payment-methods` | Bearer | List saved cards |
| POST | `/billing/payment-methods` | Bearer | Add payment method |
| DELETE | `/billing/payment-methods/{id}` | Bearer | Remove card |
| GET | `/billing/admin/subscriptions` | admin role | All subscriptions |
| POST | `/billing/admin/subscriptions/{id}/refund` | admin role | Issue refund |
| POST | `/billing/webhooks/stripe` | Stripe sig | Stripe webhook |
| GET | `/health` | None | Health check |

## Kafka Events Published

| Topic | Trigger |
|---|---|
| `billing.trial_started` | After trial subscription created |
| `payment.succeeded` | After checkout.session.completed webhook |
| `payment.failed` | After invoice.payment_failed webhook |
| `billing.subscription_cancelled` | After customer.subscription.deleted webhook (voluntary/end-of-period cancellation) |
| `billing.trial_expired` | After trial expiry Celery Beat task |
| `user.trial_expiring` | After customer.subscription.trial_will_end webhook |
| `billing.daily_stats` | Daily Celery Beat task at 01:00 UTC |

## Kafka Events Consumed

| Topic | Handler | DLQ |
|---|---|---|
| `user.registered` | `app/consumers/user_registered.py` | `user.registered.dlq` |

## Scheduled Jobs (APScheduler, in-process)

Jobs run inside the FastAPI process via `AsyncIOScheduler` (started in the
lifespan) — **no separate worker/beat container, no broker**. Each job takes a
Postgres advisory lock (`pg_try_advisory_lock`) so that with multiple API
replicas only one replica executes a given run. Identical under Compose and K8s.

| Job | Schedule | Lock key | Description |
|---|---|---|---|
| `app.jobs.tasks.expire_trials` | Daily midnight UTC | `80701` | Cancels trialing subs past trial_end with no Stripe sub |
| `app.jobs.tasks.publish_daily_stats` | Daily 01:00 UTC | `80702` | Publishes revenue stats to Kafka |

## One SQLAlchemy engine

A single **async engine** (asyncpg) serves both FastAPI endpoints
(`get_async_session()`) and the scheduled jobs (`AsyncSessionLocal`). Alembic
uses a separate sync URL (`migration_database_url`, psycopg) because Alembic
runs synchronously — that is the only place psycopg is used.

## Test Commands

```bash
cd services/billing-service
uv run pytest tests/ -v --tb=short
uv run ruff check .
uv run mypy . --ignore-missing-imports
```

## Auth

billing-service is a **downstream verifier**: it validates the RS256 `Authorization: Bearer`
token with the public key (`app/core/security.py`) and reads `sub` + `roles` from the claims —
same model as video-service and streaming-service. It **never issues tokens**. The dev public
key default in `app/core/config.py` (`_DEFAULT_PUBLIC_KEY`) is byte-identical to the other
services and matches user-service's dev private key; override with `JWT_PUBLIC_KEY` in prod.
A gateway-header path (`x-user-id`/`x-user-roles`) remains as a fallback for an auth-injecting
gateway and for tests. Admin routes require role `admin`, `superadmin`, or `billing_admin`.

## Known Gotchas

- The nginx Ingress does **not** validate JWTs or inject `x-user-*` headers — it is a plain
  reverse proxy. The service must verify the Bearer token itself; relying on gateway headers
  alone returns 401 for every authenticated call.
- Gateway-header fallback (`x-user-id`/`x-user-roles`) now requires `x-gateway-secret` to
  match `GATEWAY_SHARED_SECRET` in settings. Set this env var in both the gateway config and
  billing-service. In tests, `conftest.py` patches `settings.gateway_shared_secret` to
  `"test-gateway-secret"` and all test header fixtures include `"x-gateway-secret"`.
- Stripe webhook endpoint skips gateway auth — signature is verified via `STRIPE_WEBHOOK_SECRET`.
- SQLite is used for tests; PostgreSQL Enum DDL is skipped — models use String columns in-memory.
- Scheduled jobs run in-process; horizontal scaling of the API is safe because each
  job is guarded by a Postgres advisory lock (only one replica runs each job).
- `.venv` must stay out of the image — it is gitignored and dockerignored; host
  venv shebangs point at the local machine and break inside the container.
