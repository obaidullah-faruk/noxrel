# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml uv.lock* ./

FROM base AS production
RUN uv sync --frozen --no-dev
COPY . .

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD pgrep -f "python.*worker" || exit 1

CMD ["uv", "run", "python", "-m", "app.worker"]

FROM base AS test
RUN uv sync --frozen
COPY . .
