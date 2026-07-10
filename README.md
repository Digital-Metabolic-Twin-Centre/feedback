# DMTC  Headless Feedback

Headless feedback management backend built with Next.js route handlers and SQLite.

## Overview

- Versioned REST API under `/api/v1/*`
- Project-scoped API keys via `x-api-key`
- Bootstrap-token protected admin key and project management
- Feedback thread support with initial and follow-up messages
- Email notifications for submissions and replies via SMTP or Resend
- Promotion sync to GitLab issues and/or GitHub issues
- OpenAPI JSON and Swagger UI docs
- SQLite-backed storage with hashed API keys

## Architecture

![DMTC  Headless Feedback container architecture](./diagrams/img/system-context.png)

Additional generated diagrams are available in [`diagrams/`](./diagrams), including the system context and Docker deployment views.

## Quick Start

```bash
npm ci
npm run migrate:up-seed
npm run dev
```

See [Getting Started](./docs/getting-started.md) for environment setup, running checks, and troubleshooting.

## Documentation

| Doc | Covers |
| --- | --- |
| [Getting Started](./docs/getting-started.md) | Overview, architecture, local development |
| [Configuration](./docs/configuration.md) | `.env.local` variables |
| [Authentication](./docs/authentication.md) | `x-bootstrap-token` vs `x-api-key`, auth model |
| [Bootstrap](./docs/bootstrap.md) | Creating the first project and API keys |
| [API Reference](./docs/api.md) | Route map, thread model, request examples |
| [Notifications](./docs/notifications.md) | Email delivery via SMTP/Resend, notification API |
| [Issue Sync](./docs/issue-sync.md) | GitLab/GitHub promotion sync |
| [Migrations](./docs/migrations.md) | SQLite schema migrations |
| [Docker](./docs/docker.md) | Container image releases and running with Docker |

## API Docs (Runtime)

- OpenAPI JSON: `http://localhost:4001/api/v1/openapi.json`
- Swagger UI: `http://localhost:4001/api/v1/docs`
