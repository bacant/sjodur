# Sjodur – web frontend

Vue 3 + [Vike](https://vike.dev) (SSR, file-based routing) served by [Hono](https://hono.dev), styled with Tailwind CSS 4 and the Sjodur design tokens. Scaffolded with Bati (`--vue --tailwindcss --hono --docker --eslint --prettier`) and extended with Pinia, vue-i18n, Vitest and Playwright.

## Scripts

| Command                             | What it does                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                          | Dev server with HMR on <http://localhost:3000>; `/api/*` is proxied to the backend                            |
| `pnpm build`                        | Production build into `dist/` (client + server)                                                               |
| `pnpm start`                        | Run the production build (`node dist/server/index.mjs`)                                                       |
| `pnpm lint` / `pnpm lint:fix`       | ESLint (flat config, Vue + TypeScript + Prettier)                                                             |
| `pnpm format` / `pnpm format:check` | Prettier                                                                                                      |
| `pnpm test` / `pnpm test:watch`     | Vitest unit and component tests (`**/*.test.ts`)                                                              |
| `pnpm test:e2e`                     | Playwright end-to-end tests in `e2e/` (starts the dev server itself; run `pnpm exec playwright install` once) |

Requires Node 22+ and pnpm (version pinned in `package.json` → `packageManager`).

## Backend connection

The Hono server forwards every request under `/api/*` to the Spring Boot backend, in development and production alike. The browser therefore only talks to one origin and no CORS setup is needed.

| Variable         | Default                 | Purpose                                                               |
| ---------------- | ----------------------- | --------------------------------------------------------------------- |
| `SJODUR_API_URL` | `http://localhost:8080` | Base URL of the backend (`http://backend:8080` inside Docker Compose) |
| `PORT`           | `3000`                  | Port of the production server                                         |

## Project layout

```
pages/            file-based routes (+Page.vue), global +Layout.vue, +Head.vue, +config.ts
  +onCreateApp.ts installs vue-i18n; Pinia comes from vike-vue-pinia
components/       shared components (BrandLogo, AmountChip, LocaleSwitch, ...)
lib/              framework-free helpers (i18n setup, money formatting)
locales/          UI strings, one file per language (de.ts is the schema, en.ts must match it)
stores/           Pinia stores
styles/app.css    Tailwind entry with all design tokens
server/hono.ts    Hono app: API proxy + Vike
public/           static files: favicons and brand assets under public/brand/
e2e/              Playwright tests
```

## Design tokens and font

All colours live in `styles/app.css` as Tailwind theme variables and are used through utility classes:

- Brand colours: `navy`, `ivory`, `glacier`, `glacier-deep`, `fjord`, `mist`, `ice`, `deepsea`, `slate`, `amber`, `amber-tint`, `amber-deep`, `coral` (e.g. `bg-navy`, `text-glacier`).
- Semantic colours that follow the colour scheme automatically: `ground`, `surface`, `ink`, `muted`, `line` (e.g. `bg-ground text-ink border-line`). Dark mode is driven by `prefers-color-scheme`.
- Gains are shown in glacier, expenses in amber – never red vs. green – see `lib/money.ts` and `AmountChip.vue`.
- Radii and shadows: `rounded-card`, `shadow-card`.

The brand typeface Schibsted Grotesk is self-hosted through `@fontsource-variable/schibsted-grotesk` (imported in `pages/+Head.vue`) and set as the default `font-sans`. No request goes to Google Fonts.

Logo files come from the brand package (`docs/brand/` in the repository root); the horizontal lockup and its inverse for dark mode are in `public/brand/` and rendered by `components/BrandLogo.vue`. Store icons and favicons are in `public/`.

## Authentication

`server/auth/` is the OpenID Connect "backend for frontend": `/auth/login`, `/auth/callback`, `/auth/logout` (POST + CSRF token), `/auth/me`, a session store (memory or Redis), CSRF protection for cookie-authenticated writes, and the `/api` proxy that attaches the Bearer token and refreshes it. Pages get `pageContext.user` and `pageContext.csrfToken`; call the API with `useApi().apiFetch` so the token travels along. `/app/**` is protected by `pages/app/+guard.ts`. Configuration lives in `.env` (see `.env.example`); the full picture is in `../docs/auth.md`.

## Internationalisation

UI text goes through vue-i18n (`useI18n()` → `t("home.title")`). German is the default, English the fallback; `locales/de.ts` defines the message schema and `locales/en.ts` is typed against it, so a missing key fails at type-check time. Number and currency formatting uses `Intl` with the locale mapped in `lib/i18n.ts`.

## Docker

`docker compose up -d --build` builds the multi-stage image (`Dockerfile`, pnpm) and runs it on port 3000. Set `SJODUR_API_URL` to reach the backend from inside the container.
