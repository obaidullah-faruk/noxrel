# User Service

Django REST Framework service handling authentication, user profiles, dynamic RBAC, and subscriptions.

## Tech Stack

- Python 3.12, Django 5.2, Django REST Framework
- PostgreSQL — users, roles, permissions, subscriptions
- Redis — token blacklist, RBAC cache (60s TTL)
- Kafka — publishes `user.registered`, `user.trial_expired` events
- simplejwt **RS256** JWT — 15-min access, 30-day refresh (asymmetric key pair — not a shared secret)
- drf-spectacular — Swagger UI at `/api/v1/schema/swagger-ui/`

## Project Layout

```
services/user-service/
├── config/          # Django project package (settings, urls, wsgi, asgi)
├── core/            # Shared utilities: logging, middleware, permissions, kafka, health
├── accounts/        # User model, UserProfile, OAuthConnection
├── auth_api/        # Register, login, refresh, logout, Google OAuth
├── roles/           # Role, Permission, UserRole — dynamic RBAC
├── subscriptions/   # SubscriptionTier, UserSubscription
├── tests/           # pytest integration tests
├── manage.py
├── pyproject.toml   # uv project + dependencies
└── Dockerfile
```

## Running with Docker (recommended)

### 1. Copy and edit the env file

```bash
cd services/user-service
cp .env.example .env
# Edit .env if needed — defaults work out of the box for local dev
```

### 2. Start infrastructure + user-service

```bash
cd infrastructure
docker compose -f docker-compose.infra.yml -f docker-compose.yml up -d
```

On first boot the container automatically runs:
- `migrate` — applies all DB migrations
- `seed_rbac` — creates built-in roles & permissions
- `create_dev_admin` — creates the dev superuser

### 3. Access the service

| URL | Description |
|-----|-------------|
| `http://localhost:8000/api/v1/schema/swagger-ui/` | Swagger UI |
| `http://localhost:8000/health` | Health check |
| `http://localhost:8000/admin/` | Django admin |

**Django admin credentials** (from `.env`):
- Email: `admin@admin.com`
- Password: `admin1234`

### 4. View logs

```bash
docker compose -f docker-compose.infra.yml -f docker-compose.yml logs -f user-service
```

---

## Running locally (without Docker)

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- PostgreSQL running locally
- Redis running locally

### Setup

```bash
cd services/user-service

# Install dependencies
uv sync

# Copy env
cp .env.example .env
# Update DB_HOST=localhost and REDIS_URL=redis://localhost:6379/0

# Apply migrations
uv run python manage.py migrate

# Seed RBAC data
uv run python manage.py seed_rbac

# Create dev admin
uv run python manage.py create_dev_admin

# Start dev server
uv run python manage.py runserver 8000
```

---

## API Endpoints (v1)

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | public | Register — returns JWT pair |
| POST | `/api/v1/auth/login` | public | Login — returns JWT pair |
| POST | `/api/v1/auth/refresh` | public | Rotate refresh token |
| POST | `/api/v1/auth/logout` | Bearer | Blacklist refresh token |
| GET  | `/api/v1/auth/me` | Bearer | Current user from token |
| GET  | `/api/v1/auth/oauth/google` | public | Google OAuth redirect URL |
| GET  | `/api/v1/auth/oauth/google/callback` | public | Exchange code → JWT |

### Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET/PATCH | `/api/v1/users/me` | Bearer | Own profile |
| GET/PATCH | `/api/v1/users/{id}` | admin | Any user's profile |
| PATCH | `/api/v1/users/{id}/roles` | admin | Assign/remove roles |
| GET | `/api/v1/users/me/subscription` | Bearer | Own subscription |
| GET | `/api/v1/users/{id}/subscription` | admin | Any user's subscription |

### Roles & Permissions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/roles` | admin | List all roles |
| POST | `/api/v1/roles/create` | superadmin | Create new role |
| PATCH | `/api/v1/roles/{id}/permissions` | superadmin | Edit role permissions |
| GET | `/api/v1/permissions` | admin | List all permissions |

---

## Management Commands

```bash
# Seed built-in roles and permissions (idempotent)
uv run python manage.py seed_rbac

# Create dev superadmin (idempotent)
uv run python manage.py create_dev_admin

# Expire free trials (run as daily cron)
uv run python manage.py expire_trials
```

---

## Running Tests

```bash
# Run from the repo root
docker compose -f infrastructure/docker-compose.infra.yml -f infrastructure/docker-compose.yml \
  --profile test run --rm user-service-test
```

---

## JWT Token Payload

> **RS256** RS256 uses an
> RSA key *pair*: the private key signs tokens (held only by this service), and the public key verifies them
> (shared with all other services). This means other services can validate tokens without ever having the
> signing key.

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "username": "johndoe",
  "roles": ["free_trial"],
  "permissions": ["video:watch", "comment:create"],
  "trial_ends_at": "2024-02-01T00:00:00Z",
  "iat": 1706745600,
  "exp": 1706746500
}
```
