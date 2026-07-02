# user-service — AGENTS.md

Read the root `AGENTS.md` first, then this file.

## What This Service Owns

JWT issuance (RS256), authentication, user profiles, RBAC roles, subscription tier tracking, and 7-day trial state. **Only this service holds the RS256 private key.**

## Tech

Django REST Framework · PostgreSQL · Redis (RBAC cache + session) · Port **8000**

## Project Layout

```
services/user-service/
  config/          # Django project package (settings, urls, wsgi, asgi)
  core/            # logging, jwt_verify, kafka, health, exceptions — never import from another service
  accounts/        # User model, registration, profile
  auth_api/        # Login, token refresh, logout endpoints
  roles/           # RBAC: Role, Permission models
  subscriptions/   # SubscriptionTier, Trial, trial expiry logic
  tests/           # All tests live here
  manage.py
  pyproject.toml
```

## API Contract (do not change routes without updating dependents)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/login` | None | Returns access + refresh JWT |
| POST | `/api/v1/auth/refresh` | Refresh token | Rotates tokens |
| POST | `/api/v1/auth/logout` | Bearer | Blacklists token |
| GET | `/api/v1/users/me` | Bearer | Current user profile |
| GET | `/api/v1/users/{id}` | Bearer (admin) | User detail |
| GET/PUT | `/api/v1/users/{id}/roles` | Bearer (admin) | RBAC management |
| GET | `/health` | None | Health check |

Internal header convention (set by API Gateway, not clients):
- `x-user-id` — UUID string
- `x-user-roles` — comma-separated roles

## Kafka Events Published

| Topic | Trigger |
|---|---|
| `user.registered` | New user created |
| `user.subscription_changed` | Tier or trial state changes |

Every topic has a corresponding `.dlq` topic for failed messages.

## Kafka Events Consumed

None at this stage.

## Redis Keys

- `rbac:{user_id}` — serialized permissions, TTL 60 s
- `token:blacklist:{jti}` — blacklisted token JTIs

## Cross-Service Dependencies

- **video-service** reads user tier via `x-user-roles` header (set by gateway) — no direct DB access.
- **streaming-service** reads `x-user-tier` header (set by gateway) for quality gating.
- **billing-service** will consume `user.registered` to create billing records.

## Test Commands

```bash
cd services/user-service
uv run pytest tests/ -v --tb=short
uv run ruff check .
uv run mypy . --ignore-missing-imports
```

## Known Gotchas

- RS256 keys are hardcoded in `.env.local` for local dev — do not move them to a file path config.
- RBAC cache TTL is 60 s — role changes take up to 60 s to propagate in running sessions.
- Django apps are at the service root, not inside an `apps/` wrapper.
