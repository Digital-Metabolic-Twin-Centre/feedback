# Configuration

Create `.env.local` with at least:

```env
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:4001
NEXT_PUBLIC_FEEDBACK_API_URL=http://localhost:4001
NEXTAUTH_URL=http://localhost:4001
NEXTAUTH_SECRET=<openssl rand -base64 32>
FEEDBACK_BOOTSTRAP_TOKEN=<openssl rand -hex 24>
MAIL_PROVIDER=disabled
SQLITE_PATH=./data/feedback.db
```

Optional configuration lives in their own docs:

- [Notifications](./notifications.md) — email delivery via SMTP or Resend
- [Issue Sync](./issue-sync.md) — GitLab and GitHub promotion sync
