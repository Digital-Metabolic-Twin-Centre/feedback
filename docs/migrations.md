# Migrations

SQLite schema changes are managed through the shared runner in [`lib/sqlite-migrations/index.mjs`](../lib/sqlite-migrations/index.mjs). Migrations are tracked in the `schema_migrations` table, and the initial live schema is captured by [`lib/sqlite-migrations/0001-baseline.mjs`](../lib/sqlite-migrations/0001-baseline.mjs).

To add a future schema change:

1. Create a new numbered migration file in `lib/sqlite-migrations/`.
2. Keep it additive where possible.
3. Run `npm run migrate:up`.
4. Add or update tests covering the new shape.
5. Add both `up(db)` and `down(db)` so it can be rolled back one step at a time.

You can generate the next numbered migration file automatically with:

```bash
npm run migrate:create -- add-feedback-priority
```

To roll back exactly one applied migration:

```bash
npm run migrate:down
```

If you change your mind before commit, you can remove a generated migration by name or filename:

```bash
npm run migrate:remove -- add-feedback-priority
```
