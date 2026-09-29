# Authentication and authorisation

Sjodur uses OpenID Connect. Keycloak is the identity provider, the Spring backend is a pure
OAuth 2 resource server, and the web frontend's own server (Hono) acts as a *backend for
frontend* (BFF): it runs the login flow and keeps the tokens, the browser only ever holds an
opaque session cookie. The mobile app runs the same flow natively and talks to the API directly.

```
Browser ──cookie──▶ Hono (frontend/server/auth) ──Bearer──▶ Spring /api
   │                     │  login, callback, logout,
   │                     │  session store, token refresh
   └──────login page─────▶ Keycloak ◀─────────────── JWKS ────┘

Mobile app ──────────────── Bearer ───────────────▶ Spring /api
   └──── Authorization Code + PKCE (AppAuth) ─────▶ Keycloak
```

## Roles of the parts

| Part | Responsibility | OIDC role |
|---|---|---|
| Keycloak (`infra/`) | users, login UI, MFA, token issuing, refresh, sessions | identity provider |
| Hono (`frontend/server/auth`) | Authorization Code + PKCE, session cookie, `/api` proxy with Bearer, refresh | confidential client `sjodur-web` |
| Spring (`backend/…/security`) | JWT validation (signature, issuer, expiry, audience `sjodur-api`), role mapping | resource server |
| Mobile app | Authorization Code + PKCE via AppAuth, tokens in Keychain/Keystore | public client `sjodur-mobile` |

## The web flow

1. `GET /auth/login` – Hono creates a PKCE verifier, `state` and `nonce`, stores them in a signed
   ten-minute cookie and redirects to Keycloak.
2. Keycloak authenticates the user and redirects to `/auth/callback?code=…&state=…`.
3. Hono verifies `state` and `nonce`, exchanges the code (with the PKCE verifier and the client
   secret), creates a server-side session with the tokens and sets `sjodur_session`
   (HttpOnly, SameSite=Lax, Secure in production, 12 h idle).
4. Every `/api/*` request passes through `apiProxy`: it looks up the session, refreshes the access
   token when it expires within 30 s (one refresh per session at a time, refresh tokens rotate),
   removes the cookie and attaches `Authorization: Bearer …`. Anonymous requests are forwarded
   without a token; the backend decides whether that is enough.
5. Cookie-authenticated writes must be same-origin (`Sec-Fetch-Site`, fallback `Origin`) –
   together with SameSite=Lax this is the CSRF protection.
6. `GET /auth/logout` deletes the session, clears the cookie and redirects to Keycloak's
   end-session endpoint so the SSO session ends too.

Pages read the user from `pageContext.user` (`lib/user.ts`); `/app/**` is protected by
`pages/app/+guard.ts`, which redirects anonymous visitors to the login. Links to `/auth/*` carry
`rel="external"` so Vike performs a full page load instead of client-side routing.

## Configuration

### Frontend (`frontend/.env`, see `.env.example`)

| Variable | Default | Meaning |
|---|---|---|
| `SJODUR_OIDC_ISSUER` | `http://localhost:8081/realms/sjodur` | issuer URL; discovery happens lazily on first use |
| `SJODUR_OIDC_CLIENT_ID` | `sjodur-web` | confidential client |
| `SJODUR_OIDC_CLIENT_SECRET` | dev secret | must be set in production |
| `SJODUR_PUBLIC_URL` | `http://localhost:3000` | origin the browser sees; redirect URIs derive from it |
| `SJODUR_SESSION_SECRET` | dev secret | signs the login cookie; ≥ 32 random chars in production |
| `SJODUR_SESSION_TTL` | `43200` | idle session lifetime in seconds |
| `REDIS_URL` | – | session store; without it sessions are in memory (dev only) |
| `SJODUR_API_URL` | `http://localhost:8080` | backend for the proxy |

`assertProductionReady()` refuses to start with development secrets when `NODE_ENV=production`.

### Backend (`application.yml`)

```yaml
spring.security.oauth2.resourceserver.jwt.issuer-uri: ${SJODUR_OIDC_ISSUER}
spring.security.oauth2.resourceserver.jwt.audiences: sjodur-api
```

Realm roles arrive as `realm_access.roles` and become `ROLE_<NAME>` authorities
(`SecurityConfig.realmRoles`). Use `@PreAuthorize("hasRole('ADMIN')")` on services and
`@AuthenticationPrincipal Jwt jwt` for the caller; `jwt.getSubject()` is the stable user id.
Create your own user record on first contact, keyed by `sub`; never store tokens or passwords.

### Keycloak realm (`infra/keycloak/realm-sjodur.json`)

Imported on the first start of the container. Contains the clients `sjodur-web` (confidential,
PKCE S256 enforced, redirect `http://localhost:3000/auth/callback`) and `sjodur-mobile` (public,
PKCE S256, redirect `io.sjodur.app:/oauth2redirect`), an audience mapper adding `aud: sjodur-api`
to access tokens, the realm roles `user` and `admin`, five-minute access tokens with refresh
token rotation, and two test users:

| User | Password | Roles |
|---|---|---|
| `anna` | `sjodur` | user |
| `nils` | `sjodur` | user, admin |

Admin console: <http://localhost:8081> (admin / admin). After changing the realm in the console,
export it (Realm settings → Action → Partial export, with clients and roles) and commit the JSON.

## Local development

1. `./gradlew dev` (or `cd backend && ./gradlew bootRun` – it starts Postgres, Keycloak and Redis
   from `infra/docker-compose.yml`; Keycloak needs about half a minute the first time).
2. `cp frontend/.env.example frontend/.env` once; the defaults match the realm.
3. Open <http://localhost:3000>, click *Anmelden*, sign in as `anna`, land on `/app`.
4. `/app` calls `/api/me` through the proxy – if it shows "reachable, token accepted", the whole
   chain works.

Tests: `pnpm test` in `frontend/` runs the auth unit tests and a full login flow against a mock
OpenID provider (`server/auth/flow.test.ts`); `./gradlew test` runs `SecurityConfigTest`, which
exercises the filter chain with self-signed tokens.

## Production checklist

- HTTPS in front of the frontend; `SJODUR_PUBLIC_URL` with `https://` (turns on Secure cookies).
- Real `SJODUR_OIDC_CLIENT_SECRET` and `SJODUR_SESSION_SECRET`, `REDIS_URL` set.
- Keycloak with `start` (not `start-dev`), a real database, `KC_HOSTNAME` set to the public URL,
  MFA enabled for the realm, brute-force detection on, e-mail configured for password resets.
- Redirect URIs and post-logout URIs of `sjodur-web` changed to the production origin.
- Backend: `SJODUR_OIDC_ISSUER` equals the token issuer *exactly*. If the backend reaches
  Keycloak via an internal hostname, keep `issuer-uri` public and set `jwk-set-uri` to the
  internal JWKS endpoint (see `application-prod.yml`).
- Clock sync (NTP) on all hosts; token validation allows 60 s skew.

## Mobile app (later)

Use AppAuth (iOS/Android) or its Capacitor equivalent with the public client `sjodur-mobile`:
Authorization Code + PKCE, no client secret, redirect through the app link, tokens in the
Keychain/Keystore, refresh token rotation. The API needs no change – it only ever sees Bearer tokens.
