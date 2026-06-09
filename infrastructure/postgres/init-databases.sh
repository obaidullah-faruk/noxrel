#!/bin/bash
# Creates per-service databases in the shared PostgreSQL instance.
# Runs automatically on first container start via /docker-entrypoint-initdb.d/

set -e

# POSTGRES_USER (=noxrel) and the POSTGRES_DB (=noxrel, used by user-service) are
# created automatically by the postgres entrypoint. Here we add the second
# per-service database (video_service), owned by the same user.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE video_service;
    GRANT ALL PRIVILEGES ON DATABASE video_service TO $POSTGRES_USER;
    CREATE DATABASE billing_service;
    GRANT ALL PRIVILEGES ON DATABASE billing_service TO $POSTGRES_USER;
EOSQL
