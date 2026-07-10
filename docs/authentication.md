# Authentication

## Auth Model

- `x-bootstrap-token` is only for bootstrap and platform management routes under `/api/v1/admin/keys*`, `/api/v1/admin/projects*`, and `/api/v1/admin/meta*`.
- `x-api-key` is required for feedback and admin-feedback routes.
- API keys are tied to a single project.
- Admin API keys can use both project routes and admin routes for their project.
- Non-admin API keys cannot call `/api/v1/admin/feedback*`.

See [Bootstrap](./bootstrap.md) for how to generate the bootstrap token and create your first project and API keys, and [API Reference](./api.md) for the full route map.
