# API Reference

## Route Map

### Platform

- `GET /api/healthcheck`
- `GET /api/v1/openapi.json`
- `GET /api/v1/docs`

### Bootstrap-Protected Admin Setup

- `GET /api/v1/admin/keys`
- `POST /api/v1/admin/keys`
- `DELETE /api/v1/admin/keys/:id`
- `POST /api/v1/admin/keys/:id/rotate`
- `GET /api/v1/admin/projects`
- `POST /api/v1/admin/projects`
- `GET /api/v1/admin/meta/:resource`
- `POST /api/v1/admin/meta/:resource`
- `GET /api/v1/admin/meta/:resource/:id`
- `PATCH /api/v1/admin/meta/:resource/:id`
- `DELETE /api/v1/admin/meta/:resource/:id`

These routes require `x-bootstrap-token`. See [Bootstrap](./bootstrap.md) for setup examples.

Supported `:resource` values include:

- `feedback_status`
- `feedback_types`
- `organisations`
- `assigned_to`
- `notification_audit`
- `notification_settings`
- `notification_preferences`
- `projects`
- `api_keys`

### Project API Key Routes

- `POST /api/v1/feedback`
- `GET /api/v1/feedback/:id`
- `POST /api/v1/feedback/:id`
- `GET /api/v1/feedback/meta`

These routes require `x-api-key`. Access is scoped to the project attached to the key.

### Admin API Key Routes

- `GET /api/v1/admin/feedback`
- `GET /api/v1/admin/feedback/:id`
- `PATCH /api/v1/admin/feedback/:id`
- `GET /api/v1/admin/feedback/:id/messages`
- `POST /api/v1/admin/feedback/:id/messages`
- `PATCH /api/v1/admin/feedback/:id/messages`

These routes require an API key created with `isAdmin: true`.

See [Authentication](./authentication.md) for the full auth model.

## Thread Model

Feedback creation and thread replies are separate operations.

- `POST /api/v1/feedback` creates the feedback row.
- If `initial_message` is supplied during creation, it is inserted as the first thread message with author role `User`.
- `POST /api/v1/feedback/:id` adds a later user follow-up message to the same thread.
- `POST /api/v1/admin/feedback/:id/messages` adds an admin reply.
- `PATCH /api/v1/admin/feedback/:id/messages` updates an existing thread message by `messageId`.
- Closed feedback cannot accept new replies.
- Replies on promoted feedback are synced to every configured issue platform. See [Issue Sync](./issue-sync.md).

## Feedback API Examples

Create feedback with an initial thread message:

```bash
curl -X POST http://localhost:4001/api/v1/feedback \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "email":"user@example.com",
    "page":"/home",
    "initial_message":"Great app"
  }'
```

Get feedback detail with messages:

```bash
curl "http://localhost:4001/api/v1/feedback/1?includeMessages=true" \
  -H "x-api-key: $API_KEY"
```

Add a user follow-up message:

```bash
curl -X POST http://localhost:4001/api/v1/feedback/1 \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"message":"I have more details to add."}'
```

Create feedback already marked as promoted or draft:

```bash
curl -X POST http://localhost:4001/api/v1/feedback \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "email":"user@example.com",
    "page":"/home",
    "initial_message":"Please escalate this",
    "promote": true,
    "draft": false
  }'
```

Get feedback form metadata:

```bash
curl "http://localhost:4001/api/v1/feedback/meta" \
  -H "x-api-key: $API_KEY"
```

## Admin Feedback Examples

List feedback:

```bash
curl "http://localhost:4001/api/v1/admin/feedback?page=1&pageSize=50" \
  -H "x-api-key: $ADMIN_API_KEY"
```

Get feedback detail:

```bash
curl "http://localhost:4001/api/v1/admin/feedback/1" \
  -H "x-api-key: $ADMIN_API_KEY"
```

Update feedback:

```bash
curl -X PATCH http://localhost:4001/api/v1/admin/feedback/1 \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{"action":"status","value":2}'

curl -X PATCH http://localhost:4001/api/v1/admin/feedback/1 \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{"action":"type","value":1}'

curl -X PATCH http://localhost:4001/api/v1/admin/feedback/1 \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{"action":"draft","value":true}'

curl -X PATCH http://localhost:4001/api/v1/admin/feedback/1 \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{"action":"promote","value":true}'

curl -X PATCH http://localhost:4001/api/v1/admin/feedback/1 \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{"action":"promote","value":"yes"}'

curl -X PATCH http://localhost:4001/api/v1/admin/feedback/1 \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{"action":"close"}'

curl -X DELETE http://localhost:4001/api/v1/admin/feedback/1 \
  -H "x-api-key: $ADMIN_API_KEY"
```

Supported `action` values for `PATCH /api/v1/admin/feedback/:id`:

- `type`
- `status`
- `assign`
- `close`
- `wontfix`
- `promote`
- `draft`
- `delete`
- `restore`

For `promote` and `draft`, the API accepts booleans and boolean-like strings such as `"true"`, `"false"`, `"yes"`, and `"no"`.

For `assign`, the API accepts:

- an assignee id such as `{"action":"assign","value":3}`
- `null` to clear the assignment

Manage assignees with the bootstrap meta routes:

```bash
curl -X POST http://localhost:4001/api/v1/admin/meta/assigned_to \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-token: $FEEDBACK_BOOTSTRAP_TOKEN" \
  -d '{"name":"Alex Admin","title":"Support Lead","email":"alex@example.com"}'

curl "http://localhost:4001/api/v1/admin/meta/assigned_to" \
  -H "x-bootstrap-token: $FEEDBACK_BOOTSTRAP_TOKEN"

curl -X PATCH http://localhost:4001/api/v1/admin/feedback/1 \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{"action":"assign","value":1}'
```

For notification management routes (`notification_settings`, `notification_preferences`, `notification_audit`), see [Notifications](./notifications.md).

List thread messages:

```bash
curl "http://localhost:4001/api/v1/admin/feedback/1/messages" \
  -H "x-api-key: $ADMIN_API_KEY"
```

Add an admin reply:

```bash
curl -X POST http://localhost:4001/api/v1/admin/feedback/1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{"message":"Thanks, this is now being worked on."}'
```

Update a thread message:

```bash
curl -X PATCH http://localhost:4001/api/v1/admin/feedback/1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{"messageId":2,"message":"Updated reply text."}'
```

## Docs

- OpenAPI JSON: `http://localhost:4001/api/v1/openapi.json`
- Swagger UI: `http://localhost:4001/api/v1/docs`
