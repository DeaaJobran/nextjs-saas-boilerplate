# Architecture

## Workspace Shape

The repository is a pnpm workspace:

- `apps/web`: primary Next.js App Router SaaS application.
- `apps/docs`: public documentation application shell.
- `packages/auth`: self-hosted authentication, sessions, passkeys, MFA primitives, authorization helpers, and auth audit events.
- `packages/config`: product configuration, environment validation, SEO helpers, route constants, and managed content contracts.
- `packages/db`: database runtime, schema, migrations, content repository, query helpers, transactions, reset, and seed scripts.
- `packages/jobs`: background job and cron schedule primitives.
- `packages/localization`: supported locales, text direction, and locale-aware formatting helpers.
- `packages/tenant`: organizations, memberships, invitations, tenant roles, permissions, API keys, quotas, usage limits, feature flags, audit events, and impersonation.
- `packages/ui`: shared shadcn-style UI primitives, Radix-backed components, Storybook stories, and design tokens.

Marketing routes currently live in `apps/web`, but their content is managed through database-backed content records rather than static page copy. `apps/docs` is the public documentation target and should grow into setup guides, module references, and upgrade notes.

## React Baseline

The supported React baseline is React `19.2.x`, paired with Next.js `16.2.x`.

React upgrades must:

- Keep `pnpm doctor:react` at 100/100.
- Keep Storybook building.
- Keep Playwright E2E and accessibility checks passing.
- Include migration notes when behavior, rendering, or supported APIs change.

## Runtime And Persistence

- PostgreSQL is the primary production database target.
- PGlite is supported as a local development and test fallback when `DATABASE_URL` is not configured.
- Runtime migrations are committed as ordered SQL files under `packages/db/migrations` and embedded in `packages/db/src/migration-manifest.ts`.
- Seed data initializes managed content for localized marketing pages, pricing, contact forms, and legal pages.
- `docker-compose.yml` provides local PostgreSQL, Redis, MinIO, and Mailpit services.

## App Boundaries

### Public And Marketing

The marketing routes include landing, pricing, contact, and legal pages. These pages read from the managed content repository and must remain admin-manageable. New user-facing copy should be added through content data, database records, configuration, or localization files instead of being hardcoded in page components.

### Authentication

The web app consumes `@nextjs-saas/auth` through server actions, route handlers, and server-side guards. The auth package owns identity data, password and token security, session lifecycle, passkeys, MFA primitives, role checks, and audit events.

### Tenancy

The web app consumes `@nextjs-saas/tenant` through tenant context helpers and server actions. Tenant access is scoped through organization membership and permissions. Tenant-sensitive reads and writes must pass through tenant-aware service methods and must record audit events where operationally relevant.

### Admin

Admin surfaces cover content, users, tenant controls, and super-admin impersonation. Impersonation must remain explicit, time-bound, auditable, and guarded by privileged auth checks.

## Current Module Boundaries

Implemented packages:

- `auth`
- `config`
- `db`
- `jobs`
- `localization`
- `tenant`
- `ui`

Reserved future packages or module boundaries:

- `api`
- `billing`
- `currency`
- `emails`
- `files`
- `mobile`
- `notifications`
- `observability`
- `payments`
- `security`
- `storage`
- `tax`
- `testing`
- `webhooks`
- `ai`

Do not add empty packages for reserved boundaries. Introduce each one with real behavior, tests, docs, and integration points.

## Configuration Rules

- Environment variables are validated through `packages/config/src/env.ts`.
- Routes should use `appRoutes` from `@nextjs-saas/config/app` where a shared route constant exists.
- Locales and text direction should come from `@nextjs-saas/localization`.
- User-facing content should come from managed content, localization, or configuration. Hardcoded strings are acceptable only for developer-facing diagnostics, stable technical labels, or temporary code with an explicit `TODO`.

## Quality Expectations

Architecture changes should include:

- Tests in proportion to the risk and blast radius.
- Documentation for new extension points.
- Migration and rollback notes when data changes.
- Security notes for auth, sessions, tenant isolation, API keys, file upload, webhooks, payments, impersonation, and secrets.
- ADR updates when the change affects framework choices, package boundaries, persistence, auth, tenancy, localization, infrastructure, deployment, or security model.
