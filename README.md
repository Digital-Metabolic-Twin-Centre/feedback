# Feedbacks Headless API

Headless feedback management backend built on Next.js route handlers and SQLite.

## What this service provides

- Versioned REST API under `/api/v1/*`
- API key authentication (`x-api-key`) with DB-backed key hashing
- Optional multi-project isolation (one deployment, many project keys)
- CORS enabled for cross-origin consumers
- OpenAPI spec + Swagger UI docs

## API endpoints

- `POST /api/v1/feedbacks`
- `GET /api/v1/feedbacks/meta`
- `GET /api/v1/admin/feedbacks`
- `PATCH /api/v1/admin/feedbacks/:id`
- `POST /api/v1/admin/keys` (bootstrap token protected)
- `GET /api/v1/openapi.json`
- `GET /api/v1/docs`
- `GET /api/healthcheck`

## Environment

Minimum variables:

```env
NODE_ENV=development
NEXTAUTH_SECRET=<openssl rand -base64 32>
FEEDBACK_BOOTSTRAP_TOKEN=<openssl rand -hex 24>
MAIL_PROVIDER=disabled
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_FEEDBACK_API_URL=http://localhost:3000
```

SQLite path defaults to `./data/feedback.db`.

## Run locally

```bash
npm install
npm run migrate:sqlite -- --seed
npm run dev
```

## Generate first admin API key

```bash
curl -X POST http://localhost:3000/api/v1/admin/keys \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-token: $FEEDBACK_BOOTSTRAP_TOKEN" \
  -d '{"projectSlug":"default","projectName":"Default Project","keyName":"admin","isAdmin":true}'
```

Then use the returned key as:

```http
x-api-key: fbk_...
```

## Docs

- OpenAPI JSON: `http://localhost:3000/api/v1/openapi.json`
- Swagger UI: `http://localhost:3000/api/v1/docs`
