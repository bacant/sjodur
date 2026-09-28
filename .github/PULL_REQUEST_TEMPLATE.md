<!-- Title in Conventional Commits format, e.g. "feat(web): add category filter to transaction list" -->

## Summary

<!-- What does this change, and why is it needed? Link the issue or discussion it resolves. -->

Closes #

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring (no behaviour change)
- [ ] Documentation
- [ ] Build, CI or tooling
- [ ] Breaking change to the public API (needs a `BREAKING CHANGE:` footer and a Discussion)

## How was this tested?

<!-- Which tests were added or changed? Anything a reviewer should try manually? -->

## Checklist

- [ ] The change is scoped to one concern
- [ ] Tests added or updated; `./gradlew check` and `pnpm test` pass locally
- [ ] Formatting and lint pass (`./gradlew spotlessApply`, `pnpm lint`)
- [ ] OpenAPI spec regenerated if an endpoint changed
- [ ] New or changed UI text goes through i18n (English at minimum)
- [ ] Database changes are a new, backwards-compatible Flyway migration
- [ ] Docs updated where behaviour or setup changed (README, ADR, inline)
- [ ] Commits are signed off (`git commit -s`)

## Screenshots or recordings

<!-- For UI changes: before and after, light and dark if relevant. -->
