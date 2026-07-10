# Notifications

Email notifications are optional and are disabled by default. When enabled, the app can:

- notify the assigned feedback owner, or the default owner when unassigned, when feedback is submitted
- notify the original submitter when a reply is added by another actor
- notify the assigned feedback owner, or the default owner when unassigned, when a reply is added

## Configuration

```env
FEEDBACK_EMAIL_COOLDOWN_HOURS=0
FEEDBACK_EMAIL_URL_TEMPLATE=https://your-site.example/feedback?feedbackId={feedbackId}

# SMTP delivery
MAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=smtp-user
SMTP_PASS=smtp-password
SMTP_FROM=feedback@example.com

# Resend delivery
MAIL_PROVIDER=resend
RESEND_API_KEY=re_...
SMTP_FROM=feedback@example.com
```

If `FEEDBACK_EMAIL_URL_TEMPLATE` is set, notification emails use that exact URL pattern and replace `{feedbackId}` with the numeric feedback id. This is useful when email recipients should land on your own site rather than the API route.

Example:

```env
FEEDBACK_EMAIL_URL_TEMPLATE=https://your-site.example/feedback?feedbackId={feedbackId}
```

For feedback `5`, that becomes:

```text
https://your-site.example/feedback?feedbackId=5
```

Include the literal `{feedbackId}` placeholder in the template. If the placeholder is missing, the app will not append the id automatically.

## Managing Notifications via the API

```bash
curl "http://localhost:4001/api/v1/admin/meta/notification_settings" \
  -H "x-bootstrap-token: $FEEDBACK_BOOTSTRAP_TOKEN"

curl -X PATCH http://localhost:4001/api/v1/admin/meta/notification_settings/1 \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-token: $FEEDBACK_BOOTSTRAP_TOKEN" \
  -d '{"feedback_notifications_enabled":false}'

curl -X POST http://localhost:4001/api/v1/admin/meta/notification_preferences \
  -H "Content-Type: application/json" \
  -H "x-bootstrap-token: $FEEDBACK_BOOTSTRAP_TOKEN" \
  -d '{"email":"user@example.com","feedback_notifications_enabled":false}'
```

- `notification_settings` controls whether feedback notifications are enabled for the entire site.
- `notification_preferences` lets you disable feedback notifications for specific email addresses.
- `notification_audit` is read-only and exposes the recorded notification delivery audit trail.

These routes require `x-bootstrap-token`; see [Bootstrap](./bootstrap.md) and [Authentication](./authentication.md).
