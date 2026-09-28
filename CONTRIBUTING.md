# Contributing to Sjodur

Thank you for taking the time to contribute. This document explains how the project works day to day: how to get set up, how changes flow from an idea to `main`, and what we expect from a pull request. It applies to code, documentation, translations and design alike.

## Ways to contribute

- **Report a bug** – open an issue with steps to reproduce, what you expected and what happened instead. Include versions and logs where relevant.
- **Propose a feature** – open a Discussion first for anything larger than a small enhancement. Agreeing on the shape of a change before writing it saves everyone time.
- **Improve the docs** – typos, unclear explanations and missing setup steps are all worth a pull request.
- **Translate** – UI strings live in `frontend/locales/`. New languages and corrections are welcome.
- **Pick up an issue** – issues labelled `good first issue` are scoped for newcomers; `help wanted` marks work we would love a hand with.

Please search existing issues and discussions before opening a new one.

## Development setup

Follow the *Getting started* section in the [README](README.md). In short: Java 21+, Node.js 22+ with pnpm, Docker, then `docker compose up`, `./gradlew bootRun` and `pnpm dev`.

If something in the setup instructions does not work on your machine, that is a bug in the docs – please report it.

## Workflow

1. **Fork** the repository and create a branch from `main`:
   `feat/<short-description>`, `fix/<short-description>`, `docs/<short-description>`, `chore/<short-description>`.
2. **Keep changes focused.** One pull request per concern. Refactorings go in their own PR, separate from behaviour changes.
3. **Write tests** (see below) and make sure the full check passes locally.
4. **Open a pull request** against `main`. Fill in the template, link the issue it resolves and describe *why* the change is needed, not only what it does.
5. **Review.** Every PR needs a green CI run and at least one approving review from a maintainer. Reviews are about the code, never about the person; expect questions and suggestions, and feel free to push back with reasons.
6. **Merge.** Maintainers squash-merge; the PR title becomes the commit message, so keep it in Conventional Commits format (below).

`main` is protected and always deployable. Work in progress is fine in a PR – mark it as a draft.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org):

```
<type>(<scope>): <summary>

<body – optional, explains why>

<footer – optional, e.g. "Closes #123", "BREAKING CHANGE: ...">
```

- **Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`, `chore`
- **Scopes:** `backend`, `web`, `mobile`, `api`, `db`, `docs`, `infra` (omit if the change is global)
- Summary in the imperative mood, lower-case, no trailing period: `feat(web): add category filter to transaction list`
- Reference a breaking change of the public API with a `BREAKING CHANGE:` footer. Breaking changes require a major version bump of the API and a note in the changelog.

## Sign-off

Commits must be signed off to certify the [Developer Certificate of Origin](https://developercertificate.org):

```bash
git commit -s
```

By contributing you agree that your contributions are licensed under the project's [Apache License 2.0](LICENSE), as set out in section 5 of that license.

## Code conventions

**General**

- Code, comments, commit messages and documentation are written in English.
- Prefer clarity over cleverness. A reader who joins the project next year should understand the code without asking you.
- Do not add a dependency without a reason that would survive a review; prefer what Spring, Vue and the standard libraries already offer.

**Backend (Java / Spring)**

- Formatting is enforced with Spotless; run `./gradlew spotlessApply` before committing.
- Package by feature (`transactions`, `forecast`, `portfolio`), not by layer. Each feature owns its controller, service, repository and DTOs.
- Domain logic lives in services, not in controllers or entities. Controllers translate HTTP to and from the domain and nothing else.
- Every endpoint is documented through its OpenAPI annotations; the generated spec in `docs/api/` must be updated in the same PR (`./gradlew generateOpenApiDocs`).
- Validate input at the boundary (`jakarta.validation`), fail fast, and never leak stack traces or internal identifiers to clients.
- Money is never a `double`. Use `BigDecimal` for amounts and store currency codes explicitly (ISO 4217).

**Frontend (Vue / Vike / TypeScript)**

- `pnpm lint` (ESLint) and `pnpm format` (Prettier) must pass; both run in CI.
- Composition API with `<script setup lang="ts">`; typed props and emits; no `any` without a comment explaining why.
- State that survives navigation goes in Pinia stores; everything else stays local to the component.
- All user-visible text goes through i18n keys. No hard-coded strings in templates, including error messages.
- Components must be usable by keyboard and screen reader. Use semantic elements first, ARIA only where semantics fall short.

## Tests

We would rather merge a small change with tests than a large one without.

- **Backend:** unit tests for domain logic, integration tests against a real PostgreSQL through Testcontainers for repositories and HTTP endpoints. Bug fixes come with a regression test that fails without the fix.
- **Frontend:** Vitest for components, composables and stores; Playwright for the critical user journeys (sign-in, entering a transaction, viewing a forecast).
- Tests are deterministic. No sleeps, no reliance on the current date or on external services. Use fixed clocks and fixtures.
- Run everything before opening a PR: `./gradlew check` in `backend/`, `pnpm test` in `frontend/`.

## Database migrations

- Schema changes are Flyway migrations in `backend/src/main/resources/db/migration/`, named `V<yyyyMMddHHmm>__<description>.sql`.
- A migration that has been merged to `main` is immutable. Fix mistakes with a new migration.
- Migrations must be backwards compatible with the previous application version (expand first, migrate data, contract in a later release). Never drop or rename a column that the running version still reads.
- Migrations that touch user data need a rollback note in the PR description.

## Public API

The REST API is a contract with the web app, the planned mobile app and anyone who integrates with Sjodur.

- Additive changes (new fields, new endpoints) are fine within a major version.
- Removing or renaming fields, changing types or semantics is a breaking change: it needs a Discussion, a deprecation period with a `Deprecation` header, and a major version bump.
- Keep the OpenAPI spec the single source of truth. If the spec and the behaviour disagree, the behaviour is the bug.

## Pull request checklist

Before requesting a review, please confirm:

- [ ] The change is scoped to one concern and linked to an issue or discussion
- [ ] Tests added or updated, and the full local check passes
- [ ] Formatting and lint checks pass (`spotlessApply`, `pnpm lint`)
- [ ] OpenAPI spec regenerated if an endpoint changed
- [ ] New or changed UI text is available through i18n in at least English
- [ ] Database changes come as a new, backwards-compatible migration
- [ ] Documentation updated (README, ADR, or inline docs) where behaviour or setup changed
- [ ] Commits are signed off and follow Conventional Commits

## Architecture decisions

Decisions with lasting consequences (framework choices, data model boundaries, authentication approach, the mobile technology) are recorded as short Architecture Decision Records in `docs/adr/`. If your change implies such a decision, add an ADR to the PR. Existing ADRs are a good place to understand *why* things are the way they are.

## Reporting security issues

Please do not report security vulnerabilities through public issues, discussions or pull requests. Send a description of the issue, steps to reproduce and, if possible, a suggested fix to **security@<your-domain>**. You will receive an acknowledgement within a few days, and we will work with you on a fix and a coordinated disclosure. We credit reporters in the release notes unless they prefer otherwise.

## Code of conduct

Be kind, be direct, assume good intent. Harassment, discrimination and personal attacks are not tolerated anywhere in this project. Maintainers may edit, remove or lock content and block contributors who violate this. If you experience or witness unacceptable behaviour, contact the maintainers privately.

## Questions?

Open a Discussion. There are no stupid questions, only missing documentation.
