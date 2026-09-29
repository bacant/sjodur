#!/bin/sh
# Generates keycloak/realm-sjodur.json from the template with the domain and client secret from .env.
# Run once before the first `docker compose up`; the realm is imported only when it does not exist yet.
set -eu
cd "$(dirname "$0")/.."
[ -f .env ] || { echo ".env missing – copy .env.example first"; exit 1; }
set -a; . ./.env; set +a
: "${SJODUR_DOMAIN:?}"; : "${SJODUR_OIDC_CLIENT_SECRET:?}"
sed -e "s|__SJODUR_DOMAIN__|${SJODUR_DOMAIN}|g" \
    -e "s|__SJODUR_OIDC_CLIENT_SECRET__|${SJODUR_OIDC_CLIENT_SECRET}|g" \
    keycloak/realm-sjodur.template.json > keycloak/realm-sjodur.json
echo "wrote keycloak/realm-sjodur.json for https://${SJODUR_DOMAIN}"
