# ADR-0002: Vike (with vike-vue and Hono) as the web frontend framework

- **Status:** accepted
- **Date:** 2026-09-29
- **Deciders:** project maintainers
- **Related:** ADR-0001, `docs/auth.md`, `frontend/scripts/check-licenses.mjs`

## Context and problem statement

Sjodur needs a Vue 3 web frontend that renders on the server (fast first paint, crawlable
public pages, no blank screen on slow connections), runs on a small Node server we control
(the OpenID Connect "backend for frontend" lives there, see `docs/auth.md`), and stays a thin
layer over an API-first Spring backend that a mobile app will use as well. The project is
public under Apache-2.0, so every dependency must be licence-compatible and must stay so.

## Decision drivers

- Vue 3 as the UI framework (team preference, ecosystem, i18n and Pinia)
- Server-side rendering with file-based routing without owning the SSR plumbing
- Full control over the HTTP server: the auth BFF, the API proxy and CSRF protection are
  server code we write, not framework magic
- Small surface: the frontend must not become a second backend
- Licence clarity and predictability for an Apache-2.0 project meant to live for years
- Independence from a hosting vendor

## Considered options

1. Vike with `vike-vue`, served by Hono through `@vikejs/hono`
2. Nuxt
3. Plain Vite + Vue (SPA, or hand-rolled SSR with Vite's SSR API)

## Decision

We chose **Vike with vike-vue and Hono**.

Vike gives us file-based routing, SSR/SSG, `+guard`/`+data` hooks and a clean way to hand
request-scoped data (`pageContext.user`, `pageContext.csrfToken`) from the server to pages,
while the server itself stays ours: Hono handles `/auth/*` and `/api/*` and passes everything
else to Vike. It is framework-agnostic, has no ties to a hosting company, and is released
under the MIT licence (Git repository and, as of today, the npm packages `vike`, `vike-vue`,
`vike-vue-pinia`, `@vikejs/hono`).

### Licensing note

Vike has announced an "Open Source Pricing" model (vike.dev/pricing), not yet implemented on
2026-09-29. The plan as published: the Git repository stays MIT; the npm package `vike` may
adopt a proprietary licence under which teams of three or more developers in larger
organisations need a licence key (one-time fee, free for small organisations and sponsors,
key may be committed to public repositories); enforcement is an offline heuristic plus a
development-time notice. This does not affect Sjodur's own Apache-2.0 licence, but it would
change the terms under which contributors and companies deploying Sjodur use the frontend
toolchain.

### Exit strategy

If the npm packages we depend on leave the MIT licence (or any OSI-approved licence), Sjodur
migrates to **plain Vite + Vue** – `vue-router` for routing, Vite's SSR API (`createSSRApp`,
`renderToString`) behind the existing Hono server, or an SPA if SSR turns out not to be
worth the plumbing. **Nuxt is explicitly not the fallback**: it would replace one framework
dependency with a heavier one owned by a hosting company, and it would take the HTTP server
out of our hands again.

To keep that exit cheap, the Vike-specific surface is kept deliberately thin:

| Vike-specific today | Replacement in plain Vite + Vue |
|---|---|
| `pages/**/+Page.vue`, `+Layout.vue`, `+Head.vue`, `+config.ts` | `vue-router` routes, a root layout component, `<head>` handling in the SSR entry |
| `pages/app/+guard.ts` | `router.beforeEach` guard |
| `pageContext.user` / `pageContext.csrfToken` via `passToClient` | state serialised into the HTML by our own SSR entry |
| `+onCreateApp.ts` (vue-i18n), `vike-vue-pinia` | `createApp`/`createSSRApp` with `app.use(i18n)`, `app.use(pinia)` and manual Pinia hydration |
| `@vikejs/hono` universal middleware | a Hono route that calls our SSR render function |

Everything else – components, stores, i18n messages, design tokens, `lib/`, the whole
`server/auth` module – is framework-independent and moves unchanged. Estimated effort: a few
days, not weeks.

### Safeguards

- `pnpm licenses:check` (`frontend/scripts/check-licenses.mjs`) runs in CI and fails when
  any production dependency uses a licence outside the allow-list, or when a Vike package's
  declared licence or licence text is no longer MIT. `pnpm licenses:notices` generates
  `THIRD-PARTY-NOTICES.md`, which the Docker image ships.
- Versions are pinned through `pnpm-lock.yaml`; Dependabot proposes updates as pull
  requests, so a licence change arrives as a reviewable diff, never silently.
- New Vike features are adopted only when they replace code we would otherwise write
  ourselves; convenience that deepens the coupling is declined.

## Consequences

**Good**

- SSR with file-based routing and typed `pageContext` at very little cost
- The HTTP server is plain Hono code: auth, proxy and CSRF are testable without the framework
- Vendor-neutral deployment (any Node host, Docker)
- A documented, mechanically guarded exit if the licence situation changes

**Bad / accepted trade-offs**

- Vike is pre-1.0 (0.4.x): occasional breaking changes between minor versions, to be caught
  by the lockfile, CI and the changelog on upgrade
- Smaller community and fewer ready-made integrations than Nuxt
- Some Vike conventions (`+` files, universal middleware) have a learning curve; the
  `userContext` middleware in `server/auth/middleware.ts` documents one pitfall

## Pros and cons of the options

### Vike + vike-vue + Hono

- Good: MIT (today), framework-agnostic, server stays ours, thin, SSR/SSG built in
- Bad: pre-1.0, announced pricing model creates uncertainty, smaller ecosystem

### Nuxt

- Good: MIT, large ecosystem, many modules, strong documentation
- Bad: owns the server (Nitro) and the conventions, heavier, tied to a hosting company's
  roadmap; the auth BFF would have to be rebuilt inside its server layer

### Plain Vite + Vue

- Good: no framework beyond Vite and Vue, maximal control, the exit target anyway
- Bad: we would write and maintain SSR entry points, routing conventions, head management
  and hydration ourselves from day one – time better spent on the product now

## More information

- Vike licence and pricing: <https://vike.dev/pricing>, <https://vike.dev/license>
- Vite SSR guide (the exit target): <https://vite.dev/guide/ssr>
- Licence guard: `frontend/scripts/check-licenses.mjs`
