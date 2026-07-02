# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml uv.lock ./

# --- production image: no dev deps ---
FROM base AS production
ENV UV_NO_DEV=1
RUN uv sync --frozen --no-dev
COPY . .

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8001/health/ || exit 1

CMD ["uv", "run", "--frozen", "--no-dev", "gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8001", \
     "--workers", "4", \
     "--timeout", "60", \
     "--access-logfile", "-"]

# --- test image: includes dev deps ---
FROM base AS test
RUN uv sync --frozen
COPY . .
