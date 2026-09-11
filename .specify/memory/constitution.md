<!--
Sync Impact Report
- Version change: (unratified template) → 1.0.0
- Modified principles: none (initial ratification; template placeholders had never been filled in)
- Added sections:
  - Core Principles: I. Versioned API Contracts, II. Safe, Reversible Schema Migrations,
    III. Test-Backed Changes, IV. Explicit, Layered Authentication,
    V. Data Integrity via Uniqueness and Ordering, VI. Deliberate CI/CD and Release Boundaries,
    VII. Documentation and Architecture Stay in Sync
  - Technology & Environment Constraints
  - Development Workflow & Quality Gates
  - Governance (amendment procedure, versioning policy, compliance review)
- Removed sections: none
- Deferred / TODO placeholders: none — all fields resolved from repository conventions
  (README.md, CONTRIBUTING.md, SECURITY.md, package.json, .github/workflows/) since no prior
  ratified constitution existed to preserve values from.
- Templates requiring follow-up: none checked in this run (out of scope — this command only
  updates the constitution itself; dependent templates/commands read it at runtime).
-->

# DMTC Headless Feedback Constitution

## Core Principles

### I. Versioned API Contracts
All public HTTP surface MUST live under an explicit version prefix (`/api/v1/*` today);
a breaking request/response change MUST ship under a new version rather than mutating an
existing one in place. Every route handler change MUST update `lib/openapi-feedback.ts` in
the same change set so OpenAPI JSON and Swagger UI stay accurate, with tags/grouping kept
coherent.
**Rationale**: External systems integrate against `x-api-key`-scoped REST endpoints and the
generated docs as their only contract; silent drift between code and docs breaks integrations
without warning.

### II. Safe, Reversible Schema Migrations (NON-NEGOTIABLE)
All schema changes MUST be implemented as new, numbered files under `lib/sqlite-migrations/`,
executed through the shared runner in `lib/sqlite-migrations/index.mjs`. Existing migration
files MUST NOT be modified once merged. Every migration MUST implement both `up(db)` and
`down(db)` and MUST be safe to run against a database that already holds production data
(`CREATE TABLE`/`INDEX IF NOT EXISTS`, `PRAGMA table_info` checks, immediate backfill for new
`NOT NULL` columns). A breaking schema change MUST follow the staged rollout: add the new
shape → support both shapes in code → backfill → switch reads → remove old behavior in a
later release. Dropping columns in place, renaming without a compatibility layer, changing
column meaning without a staged rollout, or assuming a fresh database are forbidden.
`lib/db-sqlite.ts` MUST stay limited to opening the database and invoking the migration
runner; no schema-changing logic belongs there.
**Rationale**: this project ships as a Docker image applied against live deployments with
existing SQLite data; a destructive or non-idempotent migration corrupts production data with
no undo path.

### III. Test-Backed Changes
`npm run lint`, `npm test`, and `npm run build` MUST pass locally before a PR is opened. Any
change to schema behavior, uniqueness rules, ordering behavior, auth behavior, or route
payloads/responses MUST include corresponding test coverage, at minimum extending
`tests/api/endpoints.test.ts` or the relevant `tests/lib/*` or `tests/api/*` file.
**Rationale**: as a headless API consumed by other systems, regressions surface as silent
integration failures rather than visible UI bugs, so automated tests are the primary
detection mechanism.

### IV. Explicit, Layered Authentication
Bootstrap and admin setup routes MUST require `x-bootstrap-token`; project and feedback
routes MUST require a project-scoped `x-api-key`. A handler MUST NOT accept one credential
type in place of the other. API keys MUST be stored hashed, never in plaintext, and rotation
or deletion of a key MUST invalidate the prior key immediately.
**Rationale**: the API is multi-tenant and project-scoped; credential-type confusion or
plaintext key storage is a direct path to cross-project data exposure.

### V. Data Integrity via Uniqueness and Ordering
`projects.slug`, `projects.name`, `feedback_status.name`, `feedback_types.name`,
`organisations.name`, and active `api_keys.name` MUST remain unique, enforced both by a
database index and by application-level validation. A duplicate create/update attempt MUST
return `409 Conflict`, never `500`. Tables carrying an `"order"` column (`projects`,
`organisations`, `feedback_types`, `feedback_status`, `feedback`, `api_keys`,
`feedback_messages`, `notification_audit`) MUST preserve `"order"` on update unless the
change intentionally reorders, and list queries MUST sort by `"order"` first with a stable
secondary sort.
**Rationale**: admin-facing consumers rely on stable, predictable ordering and
reject-on-duplicate semantics; violating either silently corrupts downstream admin UI
behavior without raising an error anyone notices.

### VI. Deliberate CI/CD and Release Boundaries
`ci.yml` MUST remain the only workflow running lint/test/build-validation on `main` and `v*`
tag pushes; `docker-validation.yml` MUST remain the only main-branch Docker build validation;
`release.yml` MUST remain the only workflow publishing images to GHCR, triggered solely by
`v*` tags. Duplicate lint/build workflows MUST NOT be reintroduced. Any change affecting
runtime behavior, packaging, or published artifacts MUST bump the `package.json` version
before a release tag is pushed. Released Docker images MUST build multi-architecture
(`linux/amd64`, `linux/arm64`) from Debian-based Node images, not Alpine.
**Rationale**: the project ships as a versioned, publicly pulled container image
(`ghcr.io/digital-metabolic-twin-centre/feedback`); ambiguous or duplicated pipelines produce
untrustworthy releases.

### VII. Documentation and Architecture Stay in Sync
When architecture changes materially, `diagrams/workspace.dsl` MUST be updated and any
regenerated images MUST replace stale ones referenced from `README.md`. A breaking change
MUST update the relevant file(s) under `docs/` in the same change set; a new environment
variable MUST be reflected in `docs/configuration.md` and `.env-example.local`.
**Rationale**: this is a headless backend other teams integrate against purely through docs
and OpenAPI; undocumented behavior is effectively unusable behavior.

## Technology & Environment Constraints

- Runtime MUST be Node.js 22 with Next.js route handlers and TypeScript; storage MUST be
  SQLite accessed via `better-sqlite3`, with `lib/sqlite-migrations/` as the sole schema
  authority (see Principle II).
- Outbound integrations (email via SMTP/Resend, issue promotion via GitLab/GitHub) MUST be
  feature-gated by configuration and MUST fail gracefully (log and continue) rather than
  blocking the core feedback-submission path when unavailable or misconfigured.
- Secrets and credentials (SMTP, GitLab/GitHub tokens, bootstrap token) MUST be supplied via
  environment variables and MUST NOT be committed to version control; `.env.local` and
  `.env-example.local` remain the canonical local-configuration references.

## Development Workflow & Quality Gates

- A PR MUST stay scoped and focused; unrelated refactors travel in a separate PR.
- Commit messages SHOULD follow the conventional `type(scope): summary` style already in use
  in this repository's history (`fix(api): ...`, `ci: ...`, `feat: ...`) so history stays
  scannable.
- Before opening a PR: run `npm run lint`, `npm test`, and `npm run build` locally; for
  API or data-layer changes, additionally run
  `npm test -- --runInBand tests/api/endpoints.test.ts`.
- Code review MUST verify, before merge: migration safety (Principle II), OpenAPI sync
  (Principle I), auth boundaries (Principle IV), and test coverage (Principle III).

## Governance

This constitution supersedes ad hoc convention wherever the two conflict. `CONTRIBUTING.md`
supplies operational detail and MUST stay consistent with the principles here; where they
diverge, this document wins and `CONTRIBUTING.md` MUST be updated to match.

Amendments are proposed as a pull request modifying `.specify/memory/constitution.md`. The PR
description MUST state the semantic version bump and the rationale for it, and the PR MUST
clear the same review bar as any other change merged to `main`. Versioning follows semantic
rules: MAJOR for a backward-incompatible removal or redefinition of a principle, MINOR for a
new principle or materially expanded guidance, PATCH for wording clarifications or typo
fixes with no semantic change.

Every pull request touching `app/api/**`, `lib/sqlite-migrations/**`, or
`lib/openapi-feedback.ts` MUST be checked against the relevant principles above before merge;
an unresolved violation blocks merge rather than being deferred to a follow-up.

**Version**: 1.0.0 | **Ratified**: 2026-09-11 | **Last Amended**: 2026-09-11
