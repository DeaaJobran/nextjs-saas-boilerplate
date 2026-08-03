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
- `0012_security_privacy_hardening.sql`: legal acceptances, privacy workflows, security audit events, and the initial managed legal pages.
- `0015_optional_tenant_rls.sql`: disabled-by-default policies for strictly tenant-owned rows and an explicit production defense-in-depth opt-in. Migration numbers `0013` and `0014` are reserved for the billing integrity changes that this work builds on.

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

## SQLite foundation adapter

`@nextjs-saas/db/sqlite` exposes a Node SQLite runtime, repeatable service-foundation migrations, serialized transactions, and reset support. On Node.js 24 or newer it also exposes an async Drizzle adapter with lossless array-shaped query results, including joins with duplicate column names. Its matching schema is exported from `@nextjs-saas/db/sqlite-schema`. This path is intended for lightweight embedded modules and prototypes that use SQLite SQL explicitly.

The full web application is PostgreSQL-first. Use PostgreSQL in production or PGlite for embedded development when application packages need PostgreSQL features such as JSONB, row-level security, and PostgreSQL locking semantics.

## Optional row-level security

Migration `0015` creates `tenant_isolation` policies without enabling them. Nullable tenant columns plus identity and tenant-bootstrap tables are deliberately excluded so global work, API-key discovery, tenant selection, and invitation acceptance do not require a tenant context. This keeps normal development, migrations, and global queue workers unchanged. A deployment that opts in must:

1. run migrations with a privileged database role;
2. preserve a deliberate bypass role for migrations and cross-tenant workers;
3. call `configureTenantRowLevelSecurity({ enabled: true, forceForTableOwner: true })` during deployment;
4. wrap tenant-scoped database work in `withTenantRlsTransaction(tenantId, callback)`;
5. retain service-layer membership and permission checks.

Disable the policies through `configureTenantRowLevelSecurity({ enabled: false })` if recovery requires it. The migration is forward-only and non-destructive because policies remain disabled until the deployment explicitly opts in.
