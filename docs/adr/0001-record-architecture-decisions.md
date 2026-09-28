# ADR-0001: Record architecture decisions

- **Status:** accepted
- **Date:** 2026-09-28
- **Deciders:** project maintainers

## Context and problem statement

Sjodur is meant to run for years, with contributors joining and leaving. Decisions about frameworks, data model boundaries, authentication and the mobile technology shape the codebase long after the people who made them have moved on. Without a written record, later contributors either repeat the analysis or unknowingly undo it.

## Decision drivers

- Newcomers need to understand *why* things are the way they are, not only *what* they are
- Decisions should be reviewable in pull requests like code
- The format must be light enough that people actually use it

## Considered options

1. Architecture Decision Records as Markdown files in the repository
2. A wiki page per decision
3. No formal record; rely on commit messages and discussions

## Decision

We chose **Architecture Decision Records in `docs/adr/`**, one file per decision, numbered sequentially, following the template in `0000-template.md`. ADRs are proposed and reviewed through pull requests, together with the code that implements them where possible. An ADR is never edited after acceptance except to change its status; a new decision supersedes it.

## Consequences

**Good**

- Decisions are versioned with the code and visible in every clone
- The review of a decision happens in the same place as the review of its implementation
- Superseded decisions remain readable, so the history of the architecture stays intact

**Bad / accepted trade-offs**

- Writing an ADR takes time; small decisions (library upgrades, naming) do not need one
- The sequence number must be coordinated when two ADRs are proposed at the same time – the later PR renumbers

## More information

- Michael Nygard, *Documenting Architecture Decisions* (2011)
- MADR template: <https://adr.github.io/madr/>
