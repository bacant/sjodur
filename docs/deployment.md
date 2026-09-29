# Deployment

The unit of deployment is a container image. `deploy/compose/` is the reference installation
for one host (or a few); the same images run unchanged on Kubernetes, Nomad, Swarm or a PaaS.

```
Internet ──▶ Caddy (TLS, HTTP/3)
              ├─ sjodur.example.com       ──▶ frontend ×N  (SSR, /auth, /api proxy)  ──▶ backend ×N
              ├─ auth.sjodur.example.com  ──▶ keycloak
              └─ api.sjodur.example.com   ──▶ backend ×N   (Bearer clients: mobile, integrations)

              internal network: postgres (sjodur + keycloak databases), redis (sessions), backup
```

## Images

`.github/workflows/release.yml` builds both images on every version tag and pushes them to the
GitHub Container Registry:

```bash
git tag v1.0.0 && git push --tags
# → ghcr.io/<owner>/sjodur-frontend:1.0.0, :1.0, :latest  (and the same for sjodur-backend)
```

The backend image is built from the repository root (`docker build -f backend/Dockerfile .`)
because it needs `frontend/locales` for the shared message catalogs. It uses Spring Boot's
layered jar, so a code change only invalidates the top layer. Both images run as non-root,
log JSON to stdout and expose a health endpoint (`/healthz`, `/actuator/health/readiness`).

Make the packages public in the GitHub package settings, or log in with a token on the host
(`docker login ghcr.io`).

## First installation

Prerequisites: a host with Docker Engine and Compose v2, three DNS records pointing at it
(`SJODUR_DOMAIN`, `SJODUR_AUTH_DOMAIN`, `SJODUR_API_DOMAIN`), ports 80 and 443 reachable.

```bash
git clone https://github.com/<owner>/sjodur.git && cd sjodur/deploy/compose
cp .env.example .env && chmod 600 .env
$EDITOR .env                      # domains, image owner, secrets (openssl rand -base64 32 for each)
./scripts/render-realm.sh         # Keycloak realm with your domain and client secret
docker compose up -d
docker compose logs -f caddy      # certificate issuance; then the app is up
```

Then in Keycloak (<https://auth.…/admin>, bootstrap admin from `.env`): create the first user in
realm `sjodur`, give it the `user` role (and `admin` if needed), enable OTP in the realm's
authentication settings if you want MFA. The bootstrap admin only exists to create a proper
admin user; delete it afterwards.

What the compose file wires for you:

| Concern | Setting |
|---|---|
| Issuer / JWKS | backend validates against the public issuer (`iss` claim) but fetches keys internally (`jwk-set-uri`) – avoids the round trip and the issuer mismatch pitfall |
| Keycloak behind TLS proxy | `KC_HOSTNAME`, `KC_HTTP_ENABLED`, `KC_PROXY_HEADERS=xforwarded` |
| Secrets | only in `.env`; `assertProductionReady()` refuses dev defaults |
| Sessions | Redis with persistence; `--maxmemory-policy allkeys-lru` keeps it bounded |
| Networks | `internal` has no route to the internet; only Caddy publishes ports |
| Logs | JSON on stdout, rotated by Docker (`50m × 5` per container) |

## Updates

```bash
$EDITOR .env                      # SJODUR_VERSION=1.1.0
docker compose pull && docker compose up -d
```

Flyway migrates the database on backend start; migrations are backwards compatible by
contract (CONTRIBUTING), so the previous version keeps working during the switch. Compose
restarts containers in place, which means a few seconds of downtime per service – acceptable
here; zero-downtime rollouts are what an orchestrator adds.

## Scaling

```bash
docker compose up -d --scale frontend=2 --scale backend=2
```

or set `FRONTEND_REPLICAS` / `BACKEND_REPLICAS` in `.env`. Caddy discovers replicas through
DNS (`dynamic a`) and balances with `least_conn`. Nothing needs sticky sessions: the backend
is stateless, frontend sessions live in Redis, and token refresh is serialised across
instances (see `docs/auth.md`). Across several hosts, use Swarm or Kubernetes and point
Redis/Postgres to shared services.

Keycloak stays a single node until it becomes the bottleneck; existing sessions survive a
Keycloak restart because the frontend refreshes tokens only on expiry.

## Backups and restore

The `backup` service dumps both databases every `BACKUP_INTERVAL_SECONDS` (default daily)
into the `backups` volume and keeps `BACKUP_KEEP_DAYS`. Copy that volume off the host –
restic, rclone or an object store; a backup on the same disk protects against mistakes,
not against losing the machine.

Restore (into a fresh stack):

```bash
docker compose up -d postgres
docker compose exec -T postgres psql -U sjodur -d postgres < backups/<stamp>/globals.sql
docker compose exec -T postgres pg_restore -U sjodur -d sjodur --clean --if-exists < backups/<stamp>/sjodur.dump
docker compose exec -T postgres pg_restore -U sjodur -d keycloak --clean --if-exists < backups/<stamp>/keycloak.dump
docker compose up -d
```

Test the restore once before you rely on it.

## Monitoring

- `/actuator/health/readiness` and `/healthz` for liveness; `/actuator/metrics` (Prometheus
  format with `micrometer-registry-prometheus`) when you add Prometheus/Grafana.
- Logs are ECS JSON from both services with a shared `trace.id`; Loki + Grafana or any
  JSON-aware pipeline can index them straight from the Docker log driver.
- E-mail digests for backend errors: add `mail` to `SPRING_PROFILES_ACTIVE` and set
  `SJODUR_MAIL_HOST` / `SJODUR_ALERT_MAIL`.

## Other platforms

Everything platform-specific lives in `deploy/compose/`. For Kubernetes the translation is
mechanical: one Deployment + Service per image, a Secret for `.env`, an Ingress (or Gateway)
instead of Caddy, PostgreSQL and Redis as operators or managed services, the Flyway migration
as an init container or Job. A Helm chart can be added under `deploy/helm/` when needed; the
images and their environment variables do not change.

## Troubleshooting

| Symptom | Cause |
|---|---|
| backend logs `The iss claim is not valid` | `SJODUR_OIDC_ISSUER` differs from Keycloak's `KC_HOSTNAME` + `/realms/sjodur` |
| frontend exits with `Refusing to start in production` | development secrets or no `REDIS_URL` – see `.env` |
| login loop / "Login failed" | redirect URI in the realm does not match `https://<SJODUR_DOMAIN>/auth/callback` – re-run `render-realm.sh` or fix it in the console |
| Caddy cannot get a certificate | DNS not pointing at the host yet, or port 80 blocked (ACME HTTP challenge) |
| Keycloak unhealthy for minutes on first start | normal: it initialises its database and imports the realm (`start_period` is 90 s) |
