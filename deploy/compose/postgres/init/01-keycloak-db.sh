#!/bin/sh
# Runs once, on the first start of an empty data directory: Keycloak gets its own database and role.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE keycloak WITH LOGIN PASSWORD '${KEYCLOAK_DB_PASSWORD}';
CREATE DATABASE keycloak OWNER keycloak;
SQL
