<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/sjodur-lockup-horizontal-dunkel.svg">
    <img src="docs/brand/sjodur-lockup-horizontal.svg" alt="Sjodur" width="360">
  </picture>
</p>

<p align="center">
  Budget book, cash-flow forecasting and investment tracking in one app.<br>
  <sub>From the Icelandic <em>sjóður</em> – “fund”.</sub>
</p>

<p align="center">
  <img alt="Status: pre-alpha" src="https://img.shields.io/badge/status-pre--alpha-orange">
  <img alt="License: Apache 2.0" src="https://img.shields.io/badge/license-Apache%202.0-blue">
  <img alt="Backend: Spring Boot" src="https://img.shields.io/badge/backend-Spring%20Boot-6db33f">
  <img alt="Frontend: Vue 3 + Vike" src="https://img.shields.io/badge/frontend-Vue%203%20%2B%20Vike-42b883">
</p>

---

## What is Sjodur?

Sjodur is a personal finance application built to answer three questions at once:

1. **Where does my money go?** – a household budget book with accounts, categories, recurring transactions and imports.
2. **Where is it heading?** – a cash-flow forecast that projects balances months ahead and lets you play through scenarios (new rent, a raise, a big purchase).
3. **How do my investments fit in?** – a portfolio view for savings plans, ETFs, stocks and other assets, side by side with day-to-day finances.

Most tools do one of these well. Sjodur treats them as one picture, because that is how real households think about money.

> **Status:** Sjodur is in early development. Expect breaking changes, missing features and rough edges. The roadmap below shows what is planned; issues and discussions are open for feedback.

## Principles

- **API first.** The backend exposes a versioned, documented REST API (OpenAPI). The web frontend is one client; the planned mobile app is another. No client gets special treatment.
- **Your data is yours.** Export everything at any time in open formats (CSV, JSON). No lock-in, no selling of data, ever.
- **Built for the long run.** Boring, well-supported technology; automated tests; migrations that never lose data; observability from day one.
- **International by default.** All user-facing text goes through i18n. English and German ship first; more languages are welcome.
- **Accessible.** Keyboard navigation, screen-reader friendly components and colour choices that work for colour-blind users (gains and losses are never distinguished by red and green alone).

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Java 21+ (LTS), Spring Boot, Spring Security (OAuth 2 / OIDC), Spring Data JPA, Flyway |
| Database | PostgreSQL |
| API | REST with OpenAPI 3 specification (springdoc), semantic versioning of the public API |
| Frontend | Vue 3, Vike (SSR / file-based routing), Vite, TypeScript, Pinia |
| Testing | JUnit 5, Testcontainers, Vitest, Playwright |
| Observability | Spring Boot Actuator, Micrometer, OpenTelemetry |
| Tooling | Gradle (backend), pnpm (frontend), Docker Compose (local infrastructure), GitHub Actions (CI) |
| Mobile (planned) | Shares the same API; technology decision tracked in `docs/adr/` |

## Getting started

### Prerequisites

- Java 21 or newer
- Node.js 22 LTS or newer and [pnpm](https://pnpm.io)
- Docker (for PostgreSQL locally and for Testcontainers-based tests)

### 1. Clone and start the infrastructure

```bash
git clone https://github.com/<owner>/sjodur.git
cd sjodur
docker compose -f infra/docker-compose.yml up -d
```

This starts a local PostgreSQL instance with the credentials from `infra/.env.example`.

### 2. Run the backend

```bash
cd backend
./gradlew bootRun
```

- API: <http://localhost:8080/api>
- OpenAPI UI: <http://localhost:8080/swagger-ui.html>
- Health: <http://localhost:8080/actuator/health>

Configuration is read from environment variables (see `backend/src/main/resources/application.yml` for the full list):

| Variable | Purpose | Default |
|---|---|---|
| `SJODUR_DB_URL` | JDBC URL of the PostgreSQL database | `jdbc:postgresql://localhost:5432/sjodur` |
| `SJODUR_DB_USER` / `SJODUR_DB_PASSWORD` | Database credentials | `sjodur` / `sjodur` |
| `SJODUR_OIDC_ISSUER` | Issuer URI of the identity provider | – (auth disabled in the `local` profile) |

### 3. Run the frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Open the URL printed in the terminal (by default <http://localhost:3000>). The dev server proxies `/api` to the backend.

### 4. Run the tests

```bash
cd backend && ./gradlew check          # unit + integration tests (Testcontainers)
cd frontend && pnpm test               # Vitest
cd frontend && pnpm test:e2e           # Playwright, needs backend + frontend running
```

## Project layout

```
sjodur/
├── backend/            Spring Boot application (Gradle)
│   └── src/main/resources/db/migration/   Flyway migrations
├── frontend/           Vike + Vue 3 application (pnpm)
│   └── pages/          file-based routes
├── mobile/             planned – mobile app (see roadmap)
├── infra/              Docker Compose and local environment files
├── docs/
│   ├── adr/            architecture decision records
│   ├── api/            generated OpenAPI specification
│   └── brand/          logo and brand assets
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

## Roadmap

The order reflects priorities, not promises. Details live in the [issue tracker](https://github.com/<owner>/sjodur/issues) and in [Discussions](https://github.com/<owner>/sjodur/discussions).

- [ ] **Phase 1 – Budget book**: accounts, categories, transactions, recurring entries, CSV import, basic reports
- [ ] **Phase 2 – Forecast**: projected balances, scenarios, alerts before an account runs dry
- [ ] **Phase 3 – Investments**: portfolios, savings plans, price updates, allocation view, net-worth timeline
- [ ] **Phase 4 – Mobile app**: native or hybrid client on the same API, offline-capable entry of transactions
- [ ] **Ongoing**: multi-currency, bank connectivity, shared households, data export/import

## Contributing

Contributions are welcome – code, documentation, translations, design and testing. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first; it covers the development workflow, coding conventions and the pull-request checklist.

Found a security issue? Please **do not** open a public issue. See the security section in `CONTRIBUTING.md` for how to report it responsibly.

## Brand

The icon is the Icelandic letter *ð*, taken from *sjóður* (“fund”), the word the name comes from. Pronounce the app name “SHOH-dur”; the original is roughly “SJOU-thur”. Logo files, colours and usage rules are in [`docs/brand/`](docs/brand/). Please do not use the logo to imply endorsement of forks or third-party services.

## License

Sjodur is licensed under the [Apache License 2.0](LICENSE).
