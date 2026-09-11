# Project Notes

## 1. Last Updated

Last updated: 2026-09-11

## 2. Working Context

This project is `dmtc-feedback`, a headless feedback management backend built with Next.js route handlers, TypeScript, and SQLite. It exposes a versioned REST API under `/api/v1/*`, stores feedback threads and metadata, manages project-scoped API keys, optionally sends email notifications, and can mirror promoted feedback to GitLab and GitHub issues.

The service primarily serves host applications that need a feedback API rather than a bundled user interface. It also serves support/admin operators who manage projects, API keys, metadata, feedback status/type/assignment, notification preferences, and issue-tracker promotion.

The main risk posture is data-protection and access-control heavy. Feedback can contain user contact details, free-form user text, product/page context, operational metadata, assignment data, issue-tracker links, notification audit records, and potentially sensitive health, clinical, or research-adjacent context depending on the deploying system. Treat privacy, project scoping, API-key handling, logging, notification delivery, and issue export as high-risk surfaces.

Existing behavior to treat as contractual:

- Public runtime API routes live under `/api/v1/*`.
- Feedback and admin-feedback routes require `x-api-key`.
- Bootstrap/platform setup routes require `x-bootstrap-token`.
- API keys are project-scoped and stored hashed, with only `key_prefix` retained for display.
- Admin API keys can access admin feedback routes for their project; non-admin keys cannot.
- Project scoping must prevent keys for one project from reading or changing another project's feedback.
- `POST /api/v1/feedback` creates the feedback row; `initial_message`, when present, creates the first `feedback_messages` row with author role `User`.
- Closed feedback cannot accept new user replies.
- Promoted feedback can sync to GitLab, GitHub, or both when the corresponding env vars are configured.
- Admin promote/close/draft/status actions that require configured platform sync should surface configured platform failures rather than silently succeed.
- Email notification delivery is optional and should not make feedback submission fail when providers are unavailable.
- `notification_audit` is read-only through meta routes.
- SQLite migrations are tracked in `schema_migrations`; the baseline migration must not be casually replaced.

## 3. Repository Shape

Key directories and ownership:

- `app/` owns Next.js App Router route handlers and app shell files.
- `app/api/healthcheck/route.ts` owns the health endpoint.
- `app/api/v1/feedback/` owns project-scoped feedback create/read/reply routes.
- `app/api/v1/admin/feedback/` owns admin feedback list/detail/actions/thread message routes.
- `app/api/v1/admin/keys/` owns bootstrap-token protected API key create/list/delete/rotate routes.
- `app/api/v1/admin/projects/` owns bootstrap-token protected project management.
- `app/api/v1/admin/meta/` owns bootstrap-token protected metadata CRUD for supported resources.
- `app/api/v1/openapi.json/route.ts` owns the OpenAPI JSON route.
- `pages/api/v1/docs.ts` owns Swagger UI docs.
- `lib/` owns business logic, storage access, auth helpers, OpenAPI generation, notifications, platform sync, env validation, and logging.
- `lib/feedback/sqlite-queries.ts` is the main data access layer for feedback, metadata, notification preferences, notification audit, and issue-link persistence.
- `lib/api-v1.ts` owns shared v1 response, CORS, bootstrap authorization, API-key authentication, and admin enforcement helpers.
- `lib/api-keys.ts` owns API key generation, hashing, validation, rotation, revocation, listing, and uniqueness rules.
- `lib/projects.ts` owns project CRUD and uniqueness rules.
- `lib/admin-meta.ts` owns generic metadata route behavior and resource-specific rules.
- `lib/sqlite-migrations/` owns tracked database migrations.
- `scripts/` owns migration CLI helpers.
- `tests/` owns Jest tests split by `tests/api/`, `tests/lib/`, and focused subfolders such as `tests/lib/feedback/`.
- `docs/` owns stable repo documentation for setup, configuration, auth, API, notifications, issue sync, migrations, Docker, and bootstrap flows.
- `.specify/` owns spec workflow templates and memory used by the local specification tooling.
- `diagrams/` owns architecture diagrams and diagram source.
- `.github/workflows/` owns CI, Docker validation, and release automation.

Business logic lives primarily in `lib/`. Authorization lives in `lib/api-v1.ts`, `lib/api-keys.ts`, and the route handlers that call `authenticateApiKey`, `authorizeBootstrap`, and `requireAdmin`. Migrations live in `lib/sqlite-migrations/` and are executed by `scripts/migrate-sqlite.mjs`. Tests live under `tests/`. Stable docs live in `docs/`, while change-specific specs and workflow templates live under `.specify/`.

## 4. Local Commands

- Dev server: `npm run dev`
- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit`
- Test: `npm test`
- Coverage: `npm run test:coverage`
- Build: `npm run build`
- Clean Next build cache: `npm run clean`
- Run migrations: `npm run migrate:up`
- Run migrations with seed data: `npm run migrate:up-seed`
- Recreate local SQLite database and migrate: `npm run migrate:up-fresh`
- Roll back one migration: `npm run migrate:down`
- Create migration: `npm run migrate:create -- add-feedback-priority`
- Remove generated migration before commit: `npm run migrate:remove -- add-feedback-priority`
- Full local verification: `npm run lint && npx tsc --noEmit && npm test && npm run build`

There is no dedicated `typecheck` npm script at the time of this note. Use `npx tsc --noEmit` directly.

## 5. Prerequisites

- Runtime: Node.js 22.x is the CI and Docker baseline.
- Language/tooling: TypeScript with Next.js, Jest, ESLint, and npm lockfile-based installs.
- Package manager: npm is expected. Use `npm ci` for clean installs because `package-lock.json` is committed.
- Database: SQLite through `better-sqlite3`; local default path is `./data/feedback.db`.
- Auth provider setup: there is no external identity provider for the feedback API. Runtime access is via `x-api-key`; platform setup is via `x-bootstrap-token`. `NEXTAUTH_*` env vars are still present for NextAuth-compatible runtime configuration.
- Optional services: SMTP, Resend, GitLab issues, GitHub issues.
- Container baseline: `node:22-bookworm-slim`, app port `4001`, SQLite data expected under `/app/data` in the runtime image.

## 6. Local Bootstrap

1. Install dependencies with `npm ci`.
2. Copy the env template from `.env -example.local` to `.env.local`.
3. Fill required env vars:
   - `NODE_ENV=development`
   - `NEXT_PUBLIC_APP_URL=http://localhost:4001`
   - `NEXT_PUBLIC_FEEDBACK_API_URL=http://localhost:4001`
   - `NEXTAUTH_URL=http://localhost:4001`
   - `NEXTAUTH_SECRET`
   - `FEEDBACK_BOOTSTRAP_TOKEN`
   - `MAIL_PROVIDER=disabled` for local no-email mode
   - `SQLITE_PATH=./data/feedback.db`
4. Create/init the database with `npm run migrate:up`.
5. Use seed data when helpful with `npm run migrate:up-seed`.
6. Start the app with `npm run dev`.
7. First run URL: `http://localhost:4001`.
8. Runtime docs:
   - OpenAPI JSON: `http://localhost:4001/api/v1/openapi.json`
   - Swagger UI: `http://localhost:4001/api/v1/docs`

Authentication setup gotchas:

- `FEEDBACK_BOOTSTRAP_TOKEN` must be at least 16 characters and is needed for `/api/v1/admin/keys*`, `/api/v1/admin/projects*`, and `/api/v1/admin/meta*`.
- Bootstrap setup does not require an API key.
- Use bootstrap routes to create a project and an API key.
- API keys returned by creation/rotation are shown once. Only hashes and prefixes are persisted.
- Use `x-api-key: fbk_...` for feedback and admin-feedback routes.
- Admin feedback routes require a key created with `isAdmin: true`.

## 7. Environment and Runtime

Env template location: `.env -example.local`.

Secrets policy:

- Never commit real `.env.local`, `.env`, API keys, bootstrap tokens, SMTP passwords, Resend tokens, GitLab tokens, GitHub tokens, or `NEXTAUTH_SECRET`.
- Do not paste real secrets into docs, tests, logs, comments, screenshots, issue bodies, or generated files.
- Docker builds use dummy env values and `SKIP_ENV_VALIDATION=true`; real secrets are injected only at runtime.

Required services:

- SQLite database file, normally `SQLITE_PATH=./data/feedback.db`.
- A stable `FEEDBACK_BOOTSTRAP_TOKEN` for platform setup and key/project/meta administration.

Optional integrations:

- Email via `MAIL_PROVIDER=smtp` plus `SMTP_*`.
- Email via `MAIL_PROVIDER=resend` plus `RESEND_API_KEY` and `SMTP_FROM`.
- GitLab sync via `GITLAB_REPORTING_PROJECT_ID` and `GITLAB_ISSUES_REPORTING_TOKEN`.
- GitHub sync via `GITHUB_REPORTING_OWNER`, `GITHUB_REPORTING_REPO`, and `GITHUB_ISSUES_REPORTING_TOKEN`.
- `FEEDBACK_EMAIL_URL_TEMPLATE`, when set, must include `{feedbackId}` if the id should appear in generated email links.

Important runtime validation rules:

- Env validation is defined in `lib/env-validation.ts` with Zod.
- `NODE_ENV` must be `development`, `production`, or `test`.
- `SQLITE_PATH` defaults to `./data/feedback.db`.
- URL env vars must be valid URLs when provided.
- `FEEDBACK_BOOTSTRAP_TOKEN` must be at least 16 characters when provided.
- `FEEDBACK_EMAIL_COOLDOWN_HOURS` is coerced to an integer in the range `0..168`.
- Validation is skipped during production build phase, test phase, or when `SKIP_ENV_VALIDATION=true`.

## 8. Deployment and Release Flow

Production build/start:

- Build: `npm run build`
- Start: `npm run start`
- Runtime port: `4001`

Docker/container:

- Build image locally: `docker build -t dmtc-feedback .`
- Run with Docker using env vars and a persistent data mount for `/app/data`.
- Compose file: `docker-compose.yml`
- Docker docs: `docs/docker.md`
- Runtime image expects SQLite persistence under `/app/data/feedback.db`.

CI/CD source of truth:

- `.github/workflows/ci.yml` runs lint, migration with seed, tests, and build on `main` pushes and `v*` tags.
- `.github/workflows/docker-validation.yml` builds the Docker image on `main` pushes without pushing.
- `.github/workflows/release.yml` builds and pushes multi-architecture Docker images to GHCR on `v*` tags.

Release gates:

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- Docker build validation for container-impacting changes.
- Migration up/down review for schema changes.
- Auth/project-scope tests for route or data access changes.
- Notification and issue-sync tests for side-effect changes.

Migration review expectations:

- Add a numbered migration in `lib/sqlite-migrations/`.
- Include both `up(db)` and `down(db)` unless the migration is the immutable baseline.
- Prefer additive schema changes.
- Confirm existing data is adopted or backfilled deliberately.
- Run migration tests and any affected API tests.

## 9. Data and Schema Rules

Migration tool:

- Migration runner: `lib/sqlite-migrations/index.mjs`
- CLI runner: `scripts/migrate-sqlite.mjs`
- Migration files: `lib/sqlite-migrations/*.mjs`
- Tracking table: `schema_migrations`

Schema ownership:

- SQLite is the source of truth for feedback-related tables.
- `lib/feedback/sqlite-queries.ts` is the main query registry and should remain the central place for feedback data access.
- `lib/admin-meta.ts`, `lib/api-keys.ts`, and `lib/projects.ts` own higher-level rules for their resources.

Additive-change preference:

- Add columns/tables/indexes where possible.
- Keep soft-delete and draft behavior intact.
- Preserve normalized uniqueness indexes for names/slugs/key names.
- Preserve `order` columns where metadata sorting is expected.

Rollback expectations:

- Every new migration should roll back one step with `npm run migrate:down`.
- Baseline rollback intentionally throws and should not be used as a normal rollback path.
- Test both forward and rollback behavior when a migration carries data movement or new constraints.

Views/query contracts:

- Feedback lists order by `updated_at DESC, id DESC`.
- Project-scoped feedback queries must filter by `project_id`.
- Non-admin/self-facing query paths should not expose unrelated project data.
- Thread count/latest message calculations depend on non-soft-deleted `feedback_messages`.
- Issue sync uses hidden message markers to deduplicate external comments/notes.

## 10. Compliance and Data Protection

Sensitive data categories:

- Submitter emails and derived submitter references.
- Free-form feedback and thread messages.
- Page/context fields.
- Organisation/site metadata.
- Assignment names, titles, and emails.
- Notification preferences and audit records.
- External issue URLs/ids and mirrored issue content.
- API key prefixes and key metadata.

GDPR/privacy/data retention notes:

- Treat submitter email and free-form feedback text as personal data.
- Free-form messages may contain special-category or confidential data supplied by users.
- Soft-delete fields exist for several tables; do not assume soft-deleted data is gone from storage.
- Retention, deletion, and export handling should be explicitly reviewed before production policy changes.

Consent/withdrawal implications:

- Notification preferences can disable feedback notification delivery for specific email addresses.
- Global notification settings can disable feedback notifications for the site.
- Consent or withdrawal requirements can affect whether feedback is retained, replied to, notified, or mirrored externally.
- Promoting feedback to GitLab/GitHub exports content outside the SQLite database boundary.

Logging restrictions:

- Do not log raw API keys, bootstrap tokens, SMTP credentials, Resend tokens, GitLab tokens, GitHub tokens, or message bodies unless there is an explicit redaction policy.
- Notification logging redacts recipient emails in provider-disabled/failure paths; keep that behavior.
- Avoid logging full request bodies for feedback or admin message routes.

Export restrictions:

- GitLab/GitHub promotion exports feedback details and thread messages to configured repositories/projects.
- Validate external target ownership, visibility, and retention before enabling issue sync.
- Do not add new bulk export surfaces without privacy and access review.

Audit requirements:

- Notification sends and outage-suppressed attempts are recorded through `notification_audit`.
- API key `last_used_at` updates on successful validation.
- Changes that touch audit behavior should include tests.

## 11. Authorization and Security

Auth provider:

- API auth is custom header-based auth through `x-bootstrap-token` and `x-api-key`.
- NextAuth env vars exist for runtime compatibility, but API route protection here does not rely on an external identity provider.

Authorization layers:

- `authorizeBootstrap(req)` in `lib/api-v1.ts` checks `x-bootstrap-token`.
- `authenticateApiKey(req)` in `lib/api-v1.ts` validates `x-api-key`.
- `requireAdmin(auth)` in `lib/api-v1.ts` enforces admin API key access.
- `validateApiKey` in `lib/api-keys.ts` rejects missing, draft, soft-deleted, and inactive-project keys.
- Route handlers must pass `auth.projectId` into data access for project-scoped reads/writes.

High-risk security surfaces:

- API key creation, rotation, revocation, display, and hashing.
- Bootstrap-token protected platform routes.
- Project scoping in feedback/admin-feedback routes.
- Metadata CRUD that affects visible options and notification settings.
- External issue sync and email notification delivery.
- CORS policy in `lib/api-v1.ts`.
- OpenAPI docs if route metadata drifts from implementation.

Validation rules:

- Use existing route validation patterns before adding new request shapes.
- Keep numeric ids validated before querying.
- Preserve boolean and boolean-like string handling for `promote` and `draft` actions.
- Preserve max-length and non-empty validation for thread message updates.
- Preserve unique normalized names/slugs/key names where applicable.

Upload rules:

- There is no upload feature in the current route map.
- Do not introduce file upload handling without size limits, type validation, storage policy, malware scanning expectations, and privacy review.

Export safety rules:

- Treat GitLab/GitHub issue sync as data export.
- Keep hidden feedback/message markers for idempotency.
- Do not include raw API keys, bootstrap tokens, or operational secrets in issue titles, descriptions, comments, notes, or labels.

Generic access-control pitfalls:

- Forgetting `requireAdmin` on `/api/v1/admin/feedback*`.
- Forgetting project scoping on feedback id lookups.
- Treating bootstrap token as a user/session credential.
- Returning full API keys after initial creation/rotation.
- Letting draft or soft-deleted API keys authenticate.
- Assuming CORS allowance means a route is public.

## 12. Core Workflows

Main product/user workflows:

- Submit feedback with `POST /api/v1/feedback`.
- Include `initial_message` to start a thread at creation time.
- Retrieve project-scoped feedback detail with `GET /api/v1/feedback/:id`.
- Add a user follow-up with `POST /api/v1/feedback/:id`.
- Read metadata for a feedback form through `GET /api/v1/feedback/meta`.

Admin workflows:

- Create/list projects with `/api/v1/admin/projects`.
- Create/list/revoke/rotate API keys with `/api/v1/admin/keys`.
- List, inspect, update, close, promote, draft, delete, and restore feedback through `/api/v1/admin/feedback*`.
- List, add, and update feedback thread messages through `/api/v1/admin/feedback/:id/messages`.
- Manage metadata through `/api/v1/admin/meta/:resource`.
- Read notification audit and manage notification settings/preferences through meta routes.

Background/operational workflows:

- SQLite database initialization and migrations run when `lib/db-sqlite.ts` first opens the database.
- Migration CLI can be run explicitly during setup or CI.
- Notification delivery can record audit rows and enforce cooldown behavior.
- Issue sync creates/reuses external issues and deduplicates thread comments/notes by hidden markers.

Integrations:

- SMTP and Resend for email.
- GitLab Issues for promoted feedback.
- GitHub Issues for promoted feedback.
- Swagger UI/OpenAPI for API consumers.

## 13. Notifications, Audit, and Side Effects

Important side effects:

- Successful API key validation updates `api_keys.last_used_at`.
- Feedback creation can send internal notification email when notifications are enabled and recipients exist.
- Admin/user replies can notify the submitter and/or internal feedback recipients.
- Notification attempts can record audit rows.
- Promotion creates or updates GitLab/GitHub issues when configured.
- Replies on promoted feedback sync as external comments/notes.
- Closing or reopening promoted feedback updates external issue state.

Behavioral contracts:

- Email provider failure is non-fatal for feedback/reply workflows and is logged with redacted metadata.
- Notification audit still records eligible recipients during provider outages so cooldown behavior applies.
- Global notification setting and per-email preferences must be respected.
- Promoted feedback sync is idempotent with hidden feedback/message markers.
- Configured platform sync failures should fail the admin operation that initiated the sync.

Post-commit/transaction expectations:

- Keep database mutation and external side effects ordered deliberately.
- Avoid sending notifications or syncing external platforms before required local validation succeeds.
- For multi-step operations, tests should cover the local state when optional side effects are disabled or fail.

## 14. Architecture Rationale

The project structure keeps route handlers thin and puts reusable rules in `lib/`. This makes API behavior testable without relying on a full browser or app UI. The `app/api` routes own HTTP concerns; `lib` owns auth, data, sync, notification, OpenAPI, and validation behavior.

SQLite is used because this service is a compact headless backend with straightforward relational data, low operational overhead, and simple container persistence. `better-sqlite3` gives synchronous access suited to route-level operations. WAL mode and foreign keys are enabled when the database opens.

The migration approach exists to support both fresh installs and existing database adoption. `0001-baseline.mjs` captures the initial live schema, includes compatibility/backfill helpers, and records migrations in `schema_migrations`. Do not replace the migration runner or baseline casually because it protects installed databases.

The auth setup exists to separate platform bootstrap power from project API usage. `x-bootstrap-token` is used for creating projects, keys, and metadata. `x-api-key` is used for feedback and admin feedback. This keeps deployed clients project-scoped while leaving a separate operational setup path.

Specific tradeoffs:

- Header API keys are simple for server-to-server and embedded client integrations, but require careful storage and rotation.
- SQLite simplifies deployment but needs explicit persistence and migration discipline.
- Optional notification and issue integrations keep the core service usable without external services.
- Swagger/OpenAPI docs are generated from code in `lib/openapi-feedback.ts`, reducing drift when maintained with route changes.

Do not casually replace:

- `lib/api-v1.ts` auth helper contract.
- `lib/api-keys.ts` hashing/rotation semantics.
- `lib/feedback/sqlite-queries.ts` as the data access center.
- `lib/sqlite-migrations/index.mjs` and existing migrations.
- Project-scoped route behavior.
- Issue sync marker strategy.
- Notification redaction/audit behavior.

## 15. Testing Guidance

Test command examples:

- All tests: `npm test`
- Coverage: `npm run test:coverage`
- Focus API tests: `npm test -- tests/api/feedback-route.test.ts`
- Focus auth helpers: `npm test -- tests/lib/api-v1.test.ts tests/lib/api-keys.test.ts`
- Focus migrations: `npm test -- tests/lib/sqlite-migrations.test.ts`
- Focus sync: `npm test -- tests/lib/promoted-feedback-sync.test.ts tests/lib/github-feedback-sync.test.ts tests/lib/gitlab-feedback-sync.test.ts`

Risk-based testing expectations:

- Auth or project-scope changes need positive and negative route tests.
- Schema changes need migration tests and at least one behavior test for the new shape.
- Notification changes need provider-disabled, failure, preference, audit, and cooldown coverage.
- Issue sync changes need configured/unconfigured platform tests and idempotency marker tests.
- API response-shape changes should update OpenAPI tests and docs.

Known slow/hanging patterns:

- Tests run with `jest --runInBand`; keep database-global state isolated.
- Avoid real network calls in GitHub/GitLab/Resend/SMTP tests.
- Avoid starting a Next dev server inside Jest.
- Be careful with modules that import `lib/db-sqlite.ts`, because opening the database can run migrations.

Mocking patterns:

- Mock `fetch` for GitHub/GitLab sync.
- Mock mail providers for notification tests.
- Mock `next/server` primitives only where route handlers require request/response behavior.
- Reset module state where env validation or database globals are involved.

Useful focused tests:

- `tests/lib/api-v1.test.ts`
- `tests/lib/api-keys.test.ts`
- `tests/lib/projects.test.ts`
- `tests/lib/sqlite-migrations.test.ts`
- `tests/api/feedback-route.test.ts`
- `tests/api/feedback-route-branches.test.ts`
- `tests/api/feedback-create-promote-sync.test.ts`
- `tests/api/feedback-meta-route.test.ts`
- `tests/api/admin-key-rotate-route.test.ts`
- `tests/lib/feedback-notifications.test.ts`
- `tests/lib/notification-preferences.test.ts`
- `tests/lib/promoted-feedback-sync.test.ts`
- `tests/lib/github-feedback-sync.test.ts`
- `tests/lib/gitlab-feedback-sync.test.ts`

## 16. Specs and Documentation Split

Permanent rules live in source code and stable docs:

- `lib/api-v1.ts` for v1 auth/CORS/response helpers.
- `lib/api-keys.ts` for API key rules.
- `lib/feedback/sqlite-queries.ts` for feedback query behavior.
- `lib/sqlite-migrations/` for schema history.
- `docs/authentication.md`, `docs/api.md`, `docs/migrations.md`, `docs/notifications.md`, and `docs/issue-sync.md` for stable reference behavior.

Change-specific specs live under `.specify/` when the local spec workflow is used. Templates are in `.specify/templates/`, workflow definition is in `.specify/workflows/`, and durable process memory is in `.specify/memory/constitution.md`.

Stable reference docs live under `docs/`. Concrete examples:

- `docs/getting-started.md`
- `docs/configuration.md`
- `docs/bootstrap.md`
- `docs/authentication.md`
- `docs/api.md`
- `docs/notifications.md`
- `docs/issue-sync.md`
- `docs/migrations.md`
- `docs/docker.md`

User-facing runtime docs are available at:

- `/api/v1/openapi.json`
- `/api/v1/docs`

## 17. Dependency Notes

Pinned dependencies and rationale:

- `nodemailer` is pinned at `10.0.3` and also enforced through `overrides`.
- `xlsx` is sourced from the SheetJS CDN tarball at `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.
- `uuid` is overridden to `11.1.1`.
- The Docker image and CI use Node.js 22.x.

Audit/security handling:

- Use `npm audit` findings as a review input, but validate whether findings affect runtime paths.
- Changes to auth, email, issue sync, document/export dependencies, and database drivers deserve focused review.
- Keep `package-lock.json` committed with dependency changes.

Upgrade cautions:

- Next.js major upgrades can affect route handlers, Next Jest integration, build env behavior, and generated `.next/types`.
- React major upgrades can affect test rendering if UI code is added later.
- `better-sqlite3` upgrades can require native build compatibility checks in Docker and CI.
- Mail provider and issue-tracker SDK/API changes can alter failure behavior.
- Do not remove `overrides` without understanding the security or compatibility reason they were added.

## 18. Safe Change Strategy

Before changing code:

- Read the route handler and the corresponding `lib` module.
- Read the relevant tests in `tests/api/` and `tests/lib/`.
- Check docs under `docs/` for documented behavior.
- Check migrations before changing table shape.
- Check OpenAPI generation before changing request/response contracts.

How to identify ownership:

- HTTP shape: `app/api/**/route.ts` or `pages/api/v1/docs.ts`.
- Shared v1 auth/response behavior: `lib/api-v1.ts`.
- API key behavior: `lib/api-keys.ts`.
- Feedback data behavior: `lib/feedback/sqlite-queries.ts`.
- Metadata behavior: `lib/admin-meta.ts`.
- Project behavior: `lib/projects.ts`.
- Env behavior: `lib/env-validation.ts`.
- Notification behavior: `lib/feedback-notifications.ts`.
- Issue sync behavior: `lib/promoted-feedback-sync.ts`, `lib/github-feedback-sync.ts`, `lib/gitlab-feedback-sync.ts`, `lib/platform-detector.ts`.
- Schema behavior: `lib/sqlite-migrations/`.

How to avoid broad refactors:

- Change the smallest route/module surface that owns the behavior.
- Preserve route paths, header names, response success/error shape, and status codes unless a spec says otherwise.
- Add helpers only when several routes share the same rule.
- Keep docs and OpenAPI changes aligned with behavior changes.

How to validate safely:

- Run focused tests first.
- Run `npm run lint`.
- Run `npx tsc --noEmit`.
- Run `npm test`.
- Run `npm run build` before release or when touching Next config/routes/env behavior.
- For schema changes, run up/down migrations against a disposable SQLite path.

## 19. Common Pitfalls

Practical repo mistakes:

- Editing docs or OpenAPI without changing route behavior, or the reverse.
- Adding route behavior that bypasses the shared auth helpers.
- Letting tests depend on local `data/feedback.db` state.
- Forgetting that importing `lib/db-sqlite.ts` can create directories, open the database, and run migrations.

Auth mistakes:

- Using `x-bootstrap-token` for normal feedback routes.
- Creating only non-admin API keys and then trying admin feedback routes.
- Returning raw API keys outside create/rotate responses.
- Forgetting draft/soft-delete checks on keys and projects.

Schema mistakes:

- Editing the baseline migration for a new schema change instead of adding a new migration.
- Adding columns without rollback logic.
- Dropping or renaming fields used by API responses, OpenAPI docs, or issue sync.
- Breaking normalized unique indexes.
- Ignoring soft-delete/draft filtering.

Test mistakes:

- Making real network calls to issue trackers or email providers.
- Not resetting env/module state in env-sensitive tests.
- Forgetting `--runInBand` assumptions around SQLite/global state.
- Testing only successful auth paths.

Deployment mistakes:

- Not persisting `/app/data` in Docker.
- Expecting the container to generate the bootstrap token.
- Using `latest` when a pinned release tag is required.
- Forgetting runtime env vars because build-time dummy vars exist.
- Skipping Docker build validation after native dependency or Dockerfile changes.

Data visibility mistakes:

- Returning feedback across projects from admin routes.
- Exposing soft-deleted or draft records unintentionally.
- Mirroring feedback externally without reviewing target visibility.
- Logging full feedback message content or request bodies.

## 20. Useful First Places to Look

Important files/modules:

- `README.md`
- `package.json`
- `next.config.ts`
- `jest.config.cjs`
- `Dockerfile`
- `docker-compose.yml`

Auth files:

- `lib/api-v1.ts`
- `lib/api-keys.ts`
- `docs/authentication.md`
- `docs/bootstrap.md`

Route constants/API surface:

- `app/api/v1/feedback/route.ts`
- `app/api/v1/feedback/[id]/route.ts`
- `app/api/v1/feedback/meta/route.ts`
- `app/api/v1/admin/feedback/route.ts`
- `app/api/v1/admin/feedback/[id]/route.ts`
- `app/api/v1/admin/feedback/[id]/messages/route.ts`
- `app/api/v1/admin/keys/route.ts`
- `app/api/v1/admin/projects/route.ts`
- `app/api/v1/admin/meta/[resource]/route.ts`
- `app/api/v1/admin/meta/[resource]/[id]/route.ts`

Menus/navigation:

- This is primarily a headless API service. There is no product navigation surface in the current route map.
- Do not add internal notes to README, menus, Swagger UI, or runtime docs unless explicitly requested.

Query registry:

- `lib/feedback/sqlite-queries.ts`
- `lib/admin-meta.ts`
- `lib/projects.ts`
- `lib/api-keys.ts`

API validation:

- `lib/api-v1.ts`
- Route handlers under `app/api/v1/**/route.ts`
- `lib/env-validation.ts`
- `lib/openapi-feedback.ts`

Migrations:

- `lib/sqlite-migrations/index.mjs`
- `lib/sqlite-migrations/0001-baseline.mjs`
- `scripts/migrate-sqlite.mjs`
- `scripts/create-sqlite-migration.mjs`
- `scripts/remove-sqlite-migration.mjs`

Tests:

- `tests/api/`
- `tests/lib/`
- `tests/lib/feedback/`

## 21. Release Checklist

- Run focused tests for touched modules.
- Run `npm run lint`.
- Run `npx tsc --noEmit`.
- Run `npm test`.
- Run `npm run build`.
- For container changes, validate Docker build.
- For migrations, run migration up/down on a disposable database.
- For auth changes, validate bootstrap, API key, admin, non-admin, draft, soft-delete, and project-scope cases.
- For notification changes, validate disabled provider, SMTP/Resend config paths, preferences, audit, cooldown, and failure handling.
- For issue sync changes, validate GitHub, GitLab, both-platform, no-platform, idempotency, close/reopen, and failure behavior.
- Check logs for secrets, tokens, raw keys, full request bodies, and unnecessary personal data.
- Update docs/specs/OpenAPI when external behavior changes.

## 22. Critical Do-Nots

- Do not commit secrets or private credentials.
- Do not expose raw API keys after create/rotate responses.
- Do not store API keys unhashed.
- Do not remove project scoping from feedback/admin queries.
- Do not let non-admin keys call admin feedback routes.
- Do not treat the bootstrap token as a normal user credential.
- Do not change route paths or auth headers casually.
- Do not make `notification_audit` writable through public/admin meta routes.
- Do not export feedback to GitLab/GitHub without respecting configured platform behavior and marker idempotency.
- Do not log raw feedback payloads, message bodies, tokens, or provider credentials.
- Do not edit `0001-baseline.mjs` for ordinary new schema work.
- Do not remove migration rollback support for new migrations without explicit review.
- Do not break soft-delete/draft filtering.
- Do not remove Docker data persistence expectations for `/app/data`.
- Do not add upload or bulk export features without a security/privacy review.

## 23. Escalation Map

Keep escalation role-based unless named contacts are explicitly approved elsewhere.

- Schema changes: database owner or backend maintainer responsible for SQLite migrations.
- Data access: backend maintainer plus privacy/compliance owner.
- Security/auth: security owner plus backend maintainer.
- Production incidents: operations owner, service owner, and backend maintainer.
- Compliance/privacy: privacy/compliance owner and service owner.
- Integrations: owner of the GitHub/GitLab/SMTP/Resend integration plus backend maintainer.
- Notifications: support/operations owner plus backend maintainer.
- API contract changes: API/service owner plus consumers of the affected endpoints.
- Release automation: DevOps/release owner.
- Secrets rotation: operations owner and security owner.
