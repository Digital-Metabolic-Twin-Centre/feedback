# Feedbacks Headless API

Headless feedback management backend built with Next.js route handlers and SQLite.

## Features

- Versioned REST API under `/api/v1/*`
- API key authentication (`x-api-key`) with hashed keys stored in SQLite
- Optional multi-project isolation (one deployment, many consumers)
- Admin-only actions scoped by admin API keys
- OpenAPI spec + Swagger UI docs
- Healthcheck endpoint for monitoring

## Available Routes

- `GET /api/healthcheck`
- `GET /api/v1/admin/keys` (bootstrap token protected)
- `POST /api/v1/admin/keys` (bootstrap token protected)
- `DELETE /api/v1/admin/keys/:id` (bootstrap token protected)
- `POST /api/v1/admin/keys/:id/rotate` (bootstrap token protected)
- `GET /api/v1/admin/projects` (bootstrap token protected)
- `POST /api/v1/admin/projects` (bootstrap token protected)
- `GET /api/v1/openapi.json`
- `GET /api/v1/docs`
- `POST /api/v1/feedbacks` (API key)
- `GET /api/v1/feedbacks/:id` (API key, project scoped)
- `GET /api/v1/feedbacks/meta` (API key)
- `GET /api/v1/admin/feedbacks` (admin API key)
- `GET /api/v1/admin/feedbacks/:id` (admin API key)
- `GET /api/v1/admin/feedbacks/:id/messages` (admin API key)
- `POST /api/v1/admin/feedbacks/:id/messages` (admin API key)
- `PATCH /api/v1/admin/feedbacks/:id` (admin API key)

## Auth Model

- `x-api-key` is required for all `/api/v1/feedbacks*` and `/api/v1/admin/feedbacks*` routes.
- Admin operations require an API key created with `isAdmin: true`.
- API keys are project-bound; feedback data is isolated by `project_id`.
- Initial key creation uses `x-bootstrap-token` on `POST /api/v1/admin/keys`.
- Key listing uses `x-bootstrap-token` on `GET /api/v1/admin/keys`.
- Key revocation uses `x-bootstrap-token` on `DELETE /api/v1/admin/keys/:id`.

## Environment

Create `.env.local` (or copy from `.env.local.example`) with at least:

```env
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:4001
NEXT_PUBLIC_FEEDBACK_API_URL=http://localhost:4001
NEXTAUTH_URL=http://localhost:4001
NEXTAUTH_SECRET=<openssl rand -base64 32>
FEEDBACK_BOOTSTRAP_TOKEN=<openssl rand -hex 24>
MAIL_PROVIDER=disabled
```

SQLite defaults to:

```env
SQLITE_PATH=./data/feedback.db
```

## Local Development

```bash
npm install
npm run migrate:sqlite-seed
npm run dev
```

If you hit stale `.next`/manifest issues:

```bash
pkill -f "next dev" || true
npm run clean
npm run dev
```

## Generate Your First Admin API Key

```bash
curl -X POST http://localhost:4001/api/v1/admin/keys \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-token: $FEEDBACK_BOOTSTRAP_TOKEN" \
  -d '{"projectSlug":"default","projectName":"Default Project","keyName":"admin","isAdmin":true}'
```

Use the returned key as:

```http
x-api-key: fbk_...
```

Revoke an API key by id:

```bash
curl -X DELETE http://localhost:4001/api/v1/admin/keys/1 \
  -H "x-bootstrap-token: $FEEDBACK_BOOTSTRAP_TOKEN"
```

Rotate an API key by id:

```bash
curl -X POST http://localhost:4001/api/v1/admin/keys/1/rotate \
  -H "x-bootstrap-token: $FEEDBACK_BOOTSTRAP_TOKEN"
```

List API keys:

```bash
curl "http://localhost:4001/api/v1/admin/keys?includeRevoked=false" \
  -H "x-bootstrap-token: $FEEDBACK_BOOTSTRAP_TOKEN"
```

Create project:

```bash
curl -X POST http://localhost:4001/api/v1/admin/projects \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-token: $FEEDBACK_BOOTSTRAP_TOKEN" \
  -d '{"slug":"project-alpha","name":"Project Alpha"}'
```

List projects:

```bash
curl "http://localhost:4001/api/v1/admin/projects" \
  -H "x-bootstrap-token: $FEEDBACK_BOOTSTRAP_TOKEN"
```

## Quick API Examples

Create feedback:

```bash
curl -X POST http://localhost:4001/api/v1/feedbacks \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"email":"user@example.com","page":"/home","initial_message":"Great app"}'
```

List feedbacks (admin key):

```bash
curl "http://localhost:4001/api/v1/admin/feedbacks?page=1&pageSize=50" \
  -H "x-api-key: $ADMIN_API_KEY"
```

Update feedback status (admin key):

```bash
curl -X PATCH http://localhost:4001/api/v1/admin/feedbacks/1 \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{"action":"status","value":2}'
```

Get feedback detail (project key):

```bash
curl "http://localhost:4001/api/v1/feedbacks/1?includeMessages=true" \
  -H "x-api-key: $API_KEY"
```

Add admin thread message:

```bash
curl -X POST http://localhost:4001/api/v1/admin/feedbacks/1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{"message":"Thanks, this is now being worked on."}'
```

## Docs

- OpenAPI JSON: `http://localhost:4001/api/v1/openapi.json`
- Swagger UI: `http://localhost:4001/api/v1/docs`
