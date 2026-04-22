# Feedback Platform

A lightweight, self-hosted feedback management tool built with Next.js. Users submit feedback from any page; admins review, respond, update status, and promote issues to GitLab — all without a login system.

---

## Features

- **Public feedback submission** — anyone can submit feedback (no account required)
- **Identity-based admin access** — enter a configured email address to unlock the admin panel
- **Admin panel** — change status, reply, promote to GitLab issue, soft-delete
- **Thread messaging** — back-and-forth conversation per feedback item
- **SQLite storage** — zero-config database, no external service needed
- **GitLab integration** — promote feedbacks directly to GitLab issues

---

## Requirements

- **Node.js** 18 or later (22 recommended)
- **npm** 9 or later
- A PostgreSQL instance is referenced in the codebase for auth session logging — if you are not using auth sessions, the app will still run without it as long as `DATABASE_URL` is set (it can point to any valid Postgres or be left as a dummy value if that path is never hit)

---

## Getting Started

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd feedbacks
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

The minimum required variables to get the app running:

```env
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<run: openssl rand -base64 32>

# Comma-separated emails that unlock the admin panel (no password needed)
NEXT_PUBLIC_ADMIN_EMAILS=admin@admin.com

# SQLite path is automatic (./data/feedback.db) — no config needed

# Set to disabled if you don't want email notifications
MAIL_PROVIDER=disabled
```

> See `.env.local.example` for the full list of available options.

### 3. Set up the SQLite database

All feedback data is stored in a local SQLite file at `./data/feedback.db`.

Run the migration + seed script to create the schema and populate reference data (feedback types, statuses, organisations):

```bash
npm run migrate:sqlite -- --seed
```

Other migration commands:

```bash
npm run migrate:sqlite              # create / migrate without re-seeding
npm run migrate:sqlite -- --fresh   # drop everything, recreate, and seed
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Database

The app uses **SQLite** (`better-sqlite3`) as its primary data store. No database server is required.

| Table | Purpose |
|---|---|
| `feedbacks` | Feedback submissions |
| `feedback_messages` | Per-feedback thread messages |
| `feedback_types` | Reference: Bug Report, Feature Request, etc. |
| `feedback_status` | Reference: Open, In Progress, Closed, etc. |
| `organisations` | Reference: clinical sites / organisations |
| `notification_audit` | Email notification deduplication log |

The database file is created at `./data/feedback.db` on first migration. The `data/` directory is git-ignored.

---

## Admin Access

There is no login system. Admin access is granted by email address:

1. Set `NEXT_PUBLIC_ADMIN_EMAILS` in `.env.local` to a comma-separated list of admin emails
2. Open the app, click **"Identify yourself"** in the top bar, and enter an admin email
3. The **Admin** nav link appears and the admin panel unlocks

The identity is stored in `localStorage` — clearing it or using a different email reverts to regular user access.

**Test admin email:** `admin@admin.com` (pre-configured in the example env file)

---

## Admin Panel

Navigate to `/admin` after identifying as an admin. From there you can:

- View all submitted feedbacks
- Change feedback status (Open → In Progress → Resolved → Closed → Won't Fix)
- Reply to feedback via the thread
- Promote a feedback to a **GitLab issue** (requires `GITLAB_REPORTING_PROJECT_ID` and `GITLAB_ISSUES_REPORTING_TOKEN`)
- Soft-delete feedbacks

---

## GitLab Integration

To enable promoting feedbacks to GitLab issues, add to `.env.local`:

```env
GITLAB_REPORTING_PROJECT_ID=your-project-id
GITLAB_ISSUES_REPORTING_TOKEN=glpat-your-token
```

When an admin clicks **Promote**, the app creates a GitLab issue with the feedback details and thread messages, and marks the feedback as promoted in the database.

---

## Production Build

```bash
npm run build
npm run start
```

Or with Docker:

```bash
docker compose up --build
```

---

## Project Structure

```
app/
  feedbacks/       # Public feedback submission and list
  admin/           # Admin management panel
  api/             # API routes (select, create, update, delete, admin)
components/        # Shared UI components
hooks/             # React hooks (form state, admin identity, etc.)
layout/            # Page layout wrappers
lib/
  feedback/        # SQLite queries and database logic
  gitlab-feedback-sync.ts  # GitLab issue promotion
scripts/
  migrate-sqlite.mjs       # Database migration and seed script
data/              # SQLite database file (git-ignored)
```

---

## Reporting Issues

When reporting a bug, please include:
1. A clear description of the problem
2. Steps to reproduce
3. Expected vs actual behaviour
4. Environment info (OS, browser, Node version)
5. Relevant error logs or screenshots

---

## Technology

- **Next.js 15** — React framework
- **SQLite / better-sqlite3** — embedded database
- **shadcn/ui + Tailwind CSS** — UI components and styling
- **TanStack Table** — data table
- **Resend / SMTP** — email notifications (optional)
- **GitLab API** — issue promotion (optional)
