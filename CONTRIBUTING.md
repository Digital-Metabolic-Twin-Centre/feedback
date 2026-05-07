# Contributing

This repository is a Next.js-based headless feedback API backed by SQLite. This guide captures the conventions contributors should follow so changes stay compatible with existing deployments.

## Project Basics

- Runtime: Node.js 22, Next.js 16, TypeScript
- Storage: SQLite
- API style: versioned REST routes under `/api/v1/*`
- Auth:
  - `x-bootstrap-token` for bootstrap/admin setup routes
  - `x-api-key` for project and admin feedback routes

## Local Development

Install dependencies and start from a seeded local database:

```bash
npm ci
npm run migrate:sqlite-seed
npm run dev
```

Useful commands:

```bash
npm run lint
npm test
npm run build
```

If the Next.js build cache gets stale:

```bash
pkill -f "next dev" || true
npm run clean
```

## CI And Release Workflows

GitHub Actions are split into two workflows:

- `.github/workflows/ci.yml`
  runs on branch pushes and pull requests
  includes:
  - `lint`
  - `test`
  - `build-validation`

- `.github/workflows/release.yml`
  runs only on tag pushes matching `v*`
  publishes Docker images to GHCR

When changing CI:

- keep branch/PR validation in `ci.yml`
- keep tag-based image publishing in `release.yml`
- do not reintroduce duplicate lint/build workflows

## Docker Release Notes

Tagged releases publish multi-architecture images for:

- `linux/amd64`
- `linux/arm64`

Images are published to:

```bash
ghcr.io/digital-metabolic-twin-centre/feedback
```

The Docker build uses Debian-based Node images rather than Alpine to reduce native-module issues during multi-arch builds.

## Database Schema Changes

This project is not using a formal migration framework. Schema evolution currently happens inside [lib/db-sqlite.ts](/home/sbgchidi/Documents/codebase/feedbacks/lib/db-sqlite.ts:1).

That means contributors must treat schema changes carefully.

### Safe pattern

When changing schema:

1. Update the `CREATE TABLE IF NOT EXISTS` definition for fresh databases.
2. Add an idempotent compatibility check for existing databases.
3. Use `PRAGMA table_info(...)` to detect whether a column exists.
4. If missing, add it with `ALTER TABLE ... ADD COLUMN ...`.
5. Backfill old rows immediately with a safe default.
6. Keep reads/writes compatible with existing installations during rollout.

Example pattern:

```ts
const columns = db.prepare(`PRAGMA table_info(projects)`).all() as Array<{ name: string }>;
const hasOrder = columns.some((col) => col.name === "order");

if (!hasOrder) {
  db.exec(`ALTER TABLE projects ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0`);
}

db.exec(`UPDATE projects SET "order" = id WHERE "order" = 0`);
```

### Avoid breaking deployed databases

Do not:

- drop columns in place
- rename columns without a compatibility layer
- change column meaning without a staged rollout
- add `NOT NULL` columns without defaults/backfill
- assume every contributor or deployment has a fresh database

If a change is breaking, use a staged approach:

1. add the new column/table
2. support both old and new shapes in code
3. backfill data
4. switch reads to the new shape
5. remove old behavior in a later release

## Ordering Conventions

Many tables now have an `"order"` column so records can be displayed in a predictable sequence.

Tables with an `"order"` field include:

- `projects`
- `organisations`
- `feedback_types`
- `feedback_status`
- `feedback`
- `api_keys`
- `feedback_messages`
- `notification_audit`

When working with records that are displayed to users or admins:

- preserve `"order"` on update unless intentionally changing it
- include `"order"` in create/update payloads where supported
- sort by `"order"` first, then use a stable secondary sort

## Uniqueness Rules

The following values are expected to remain unique:

- `projects.slug`
- `projects.name`
- `feedback_status.name`
- `feedback_types.name`
- `organisations.name`
- active `api_keys.name`

Uniqueness is enforced in both:

- database indexes
- application-level validation

When adding new create/update flows for these tables, make sure duplicate attempts return `409 Conflict` rather than `500`.

## API Changes

When changing API routes:

- update the relevant route handler under `app/api/...`
- update shared helpers if the behavior belongs in `lib/`
- update [lib/openapi-feedback.ts](/home/sbgchidi/Documents/codebase/feedbacks/lib/openapi-feedback.ts:1) so docs stay accurate
- keep tags/grouping coherent for Swagger/OpenAPI
- add or update endpoint coverage in [tests/api/endpoints.test.ts](/home/sbgchidi/Documents/codebase/feedbacks/tests/api/endpoints.test.ts:1)

## HTTP Request Collections

Request files live under [`http/`](/home/sbgchidi/Documents/codebase/feedbacks/http:1) and are grouped by API area:

- `platform/`
- `bootstrap-admin/`
- `meta/`
- `feedback/`
- `admin-feedback/`
- `cleanup/`

When you add or change endpoints:

- update the relevant grouped `.http` file
- keep the existing variable flow intact where possible
- prefer grouped request files over reintroducing one giant request file

## Architecture Diagrams

Structurizr assets live under [`diagrams/`](/home/sbgchidi/Documents/codebase/feedbacks/diagrams:1).

Important files:

- `workspace.dsl`
- `docker-compose.yml`
- generated images in `diagrams/img/`

Run Structurizr locally from that folder:

```bash
docker compose up
```

If architecture changes materially:

- update `workspace.dsl`
- regenerate the exported images if needed
- keep README references aligned with the generated filenames

## Testing Expectations

Before opening a PR, run the most relevant checks locally:

```bash
npm run lint
npm test
npm run build
```

For API/data-layer changes, at minimum run:

```bash
npm test -- --runInBand tests/api/endpoints.test.ts
```

Add tests when you change:

- schema behavior
- uniqueness rules
- ordering behavior
- auth behavior
- route payloads or responses

## Commit And Release Guidance

Use clear commit messages that describe the type of change, for example:

- `fix(api): enforce unique API key names`
- `ci: split branch validation and tag release workflows`
- `fix(docker): publish multi-arch images with safer Debian-based build`

If the change affects runtime behavior, packaging, or published artifacts, bump the version before tagging a release.
