#!/bin/bash
# Creates per-service databases in the shared PostgreSQL instance.
# Runs automatically on first container start via /docker-entrypoint-initdb.d/

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE video_service;
    GRANT ALL PRIVILEGES ON DATABASE video_service TO $POSTGRES_USER;
EOSQL
