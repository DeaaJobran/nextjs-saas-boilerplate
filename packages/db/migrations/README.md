# Database Migrations

Runtime migrations are tracked as ordered SQL files in this directory and embedded in `packages/db/src/migration-manifest.ts` so scripts, tests, and packaged runtime code apply the same migration list.

Current runtime migrations:

- `0001_content_foundation.sql`: managed marketing content, pricing, contact, legal content, and content audit tables.
- `0002_service_foundation.sql`: event log, outbox, idempotency keys, generic API keys, rate-limit buckets, background jobs, and cron schedules.
- `0003_auth_identity_foundation.sql`: self-hosted auth users, accounts, sessions, tokens, challenges, passkeys, MFA, invitations, login attempts, OAuth states, and auth audit events.
- `0004_tenant_admin_foundation.sql`: organizations, memberships, invitations, feature flags, usage limits, quotas, impersonation sessions, and tenant audit events.
- `0008_storage_file_management.sql`: provider-neutral tenant file records, upload intents, access grants, variants, usage accounting, and storage audit events.
- `0009_storage_maintenance_queues.sql`: provider-specific queue routing for recurring storage maintenance jobs.
- `0010_emails_notifications_messaging.sql`: notification preferences, in-app notifications, queue-backed message delivery logs, and messaging audit events.
- `0011_observability_monitoring.sql`: structured logs, metric points, trace spans, uptime monitors, and uptime check history.

`pnpm db:generate` writes Drizzle draft migrations to `packages/db/migrations/generated/`. Treat those files as local review artifacts: inspect the generated SQL, promote the reviewed statements into the next numbered runtime migration, and add the same SQL to the migration manifest before committing.

Run migrations with:

```bash
pnpm db:migrate
```

Reset local data with:

```bash
pnpm db:reset
```

Seed managed content with:

```bash
pnpm db:seed
```
