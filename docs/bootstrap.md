# Bootstrap Setup

Bootstrap setup does not require an existing `x-api-key`. For first-time setup, use only `x-bootstrap-token` to create the first project and/or admin API key.

Create an admin API key:

```bash
curl -X POST http://localhost:4001/api/v1/admin/keys \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-token: $FEEDBACK_BOOTSTRAP_TOKEN" \
  -d '{"projectSlug":"default","projectName":"Default Project","keyName":"admin","isAdmin":true}'
```

Key creation fields:

- `projectSlug` optional
- `projectName` optional
- `keyName` optional
- `isAdmin` optional, defaults to `false`

If `projectSlug` is omitted, the API uses the first active project. If no active project exists, the default project is used/created.

Use the returned key as:

```http
x-api-key: fbk_...
```

List keys:

```bash
curl "http://localhost:4001/api/v1/admin/keys?includeRevoked=false" \
  -H "x-bootstrap-token: $FEEDBACK_BOOTSTRAP_TOKEN"
```

Rotate a key:

```bash
curl -X POST http://localhost:4001/api/v1/admin/keys/1/rotate \
  -H "x-bootstrap-token: $FEEDBACK_BOOTSTRAP_TOKEN"
```

Revoke a key:

```bash
curl -X DELETE http://localhost:4001/api/v1/admin/keys/1 \
  -H "x-bootstrap-token: $FEEDBACK_BOOTSTRAP_TOKEN"
```

Create a project:

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
