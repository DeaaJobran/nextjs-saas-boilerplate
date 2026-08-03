# Architecture

## Workspace Shape

The repository is a pnpm workspace:

- `apps/web`: primary Next.js App Router SaaS application.
- `apps/docs`: public documentation application shell.
- `packages/api`: versioned public API contracts, authentication, scopes, OAuth/OIDC adapters, mobile sessions, OpenAPI, SDK generation, webhooks, and usage tracking.
- `packages/auth`: self-hosted authentication, sessions, passkeys, MFA primitives, authorization helpers, and auth audit events.
- `packages/billing`: billing, payment adapters, currency utilities, tax abstraction, subscriptions, invoices, refunds, usage metering, entitlements, and webhook processing.
- `packages/config`: product configuration, environment validation, SEO helpers, route constants, and managed content contracts.
- `packages/db`: database runtime, schema, migrations, content repository, query helpers, transactions, reset, and seed scripts.
- `packages/emails`: transactional email, provider adapters, queue-backed delivery, localization, notification preferences, and in-app/push/SMS contracts.
- `packages/jobs`: background job and cron schedule primitives.
- `packages/localization`: supported locales, text direction, and locale-aware formatting helpers.
- `packages/observability`: structured logging, durable metrics and spans, health/readiness checks, uptime monitoring, retention, and audit aggregation.
- `packages/security`: secure response policy, origin/CORS enforcement, durable rate limiting, validation helpers, MFA policy, legal acceptance, and privacy workflows.
- `packages/storage`: tenant-isolated storage services, local and object-storage adapters, validation, media processing, quotas, lifecycle cleanup, and audit records.
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
- `@nextjs-saas/db/sqlite` provides an explicit Node SQLite runtime for lightweight service-foundation modules. Its Drizzle adapter requires Node.js 24 or newer for lossless array-shaped query results. It has its own schema and migration path; it is not a drop-in runtime for application modules that deliberately use PostgreSQL SQL.
- Runtime migrations are committed as ordered SQL files under `packages/db/migrations` and embedded in `packages/db/src/migration-manifest.ts`.
- Seed data initializes managed content for localized marketing pages, pricing, contact forms, and legal pages.
- `docker-compose.yml` provides local PostgreSQL, Redis, MinIO, and Mailpit services.

PostgreSQL migrations install tenant row-level-security policies for strictly tenant-owned rows in a disabled state. Nullable tenant columns and identity/bootstrap tables remain outside RLS so API-key discovery, tenant selection, invitation acceptance, and global workers can operate before a tenant context exists. Deployments may opt in through `configureTenantRowLevelSecurity()` after establishing a privileged migration/worker bypass path. Tenant-scoped requests must set `app.current_tenant_id` transaction-locally through `withTenantRlsTransaction()`; RLS supplements service authorization and never replaces membership or permission checks.

## App Boundaries

### Public And Marketing

The marketing routes include landing, pricing, contact, legal, and API documentation pages. Landing, pricing, contact, and legal page copy comes from the managed content repository and remains admin-manageable. A managed page is public only when its state is `published` and its optional publication time is not in the future. Routing, navigation, legal acceptance, sitemap generation, and locale alternates share that publication contract. Pricing combines managed page copy with provider-aware billing plans and configured content plans, so checkout targets, currencies, and intervals do not come from hardcoded page data. New user-facing copy should be added through content data, database records, configuration, or localization files instead of being hardcoded in page components.

### Authentication

The web app consumes `@nextjs-saas/auth` through server actions, route handlers, and server-side guards. The auth package owns identity data, password and token security, session lifecycle, passkeys, MFA primitives, OAuth/OIDC adapter contracts, role checks, and audit events. Authentication action links receive their routes through `AuthActionRoutes`; the web app supplies the centralized `authActionRoutes` configuration so localized applications can change route placement without patching the auth domain.

### Public API And Mobile

`@nextjs-saas/api` owns the versioned route catalog, request/response contracts, API principals and scopes, idempotency, OAuth/OIDC provider adapters, mobile sessions and devices, mobile upload intents, OpenAPI output, TypeScript SDK generation, webhooks, realtime event streams, and API usage records. Route handlers remain thin adapters around the service. They must authenticate a principal, enforce the route contract's scopes and tenant boundary, validate input, and return the shared success or error envelope.

### Tenancy

The web app consumes `@nextjs-saas/tenant` through tenant context helpers and server actions. Tenant access is scoped through organization membership and permissions. Tenant-sensitive reads and writes must pass through tenant-aware service methods and must record audit events where operationally relevant.

### Billing

The web app consumes `@nextjs-saas/billing` through tenant/admin server actions and a raw-body webhook route. Billing owns plans, localized plan translations, prices, provider configuration, tenant billing settings, tax settings, tax rates, subscriptions, invoices, invoice items, payment methods, refunds, usage meters, usage records, entitlements, billing audit events, and idempotent webhook event logs.

Billing state must be derived from signed provider events, not client redirects. Checkout and portal redirects are user-flow helpers only. Provider adapters must verify raw webhook payloads, expose explicit capabilities, and keep secret values in environment variables or external secret storage by reference. The first adapters are local mock payments and a Stripe-compatible REST adapter. Currency and tax code is an abstraction layer and must not be described as legal, accounting, or tax compliance advice.

### Storage, Messaging, Observability, And Security

Storage access goes through `@nextjs-saas/storage` so provider selection, tenant ownership, validation, quotas, lifecycle cleanup, and auditing remain consistent. Messaging goes through `@nextjs-saas/emails`, which persists delivery work before queue processing and keeps provider-specific delivery behind adapters. Operational logs, metrics, spans, health checks, uptime checks, and retention belong to `@nextjs-saas/observability`. Response headers, origin/CORS policy, durable rate limits, bot checks, validation helpers, MFA policy, legal acceptance, and privacy workflows belong to `@nextjs-saas/security`.

### Admin

Admin surfaces cover content, billing, users, tenant controls, and super-admin impersonation. Impersonation must remain explicit, time-bound, auditable, and guarded by privileged auth checks.

### Localization

Locale routing is handled by `next-intl` with English and Arabic as compiled locales. Runtime support is managed through the content repository: admins control the active locale list and default locale, while the app uses those settings for route availability, navigation, and sitemap output. User and tenant preferred locales are persisted in the auth and tenant domains and validated against supported locales.

UI code must use logical direction utilities and logical Tailwind classes (`start`, `end`, `ps`, `pe`, `border-e`, `text-start`) so components work in both LTR and RTL. Shared UI controls should document and preserve direction-safe spacing when they become reusable primitives.

## Current Module Boundaries

Implemented packages:

- `api`
- `auth`
- `billing`
- `config`
- `db`
- `emails`
- `jobs`
- `localization`
- `observability`
- `security`
- `storage`
- `tenant`
- `ui`

Potential future standalone package boundary:

- `ai`

Files, mobile support, notifications, payments, currency, tax, webhooks, and testing currently live inside the domain packages or repository tooling that owns their behavior. Do not split them into standalone packages without a concrete reuse or ownership boundary. Do not add empty packages for future boundaries; introduce each one with real behavior, tests, docs, and integration points.

## Adding Or Splitting A Module

Add a workspace package only when it owns a coherent server-side domain, reusable runtime contract, or independently testable adapter boundary:

1. Create the package with a private workspace name, explicit exports, strict TypeScript configuration, and package-scoped typecheck/test scripts.
2. Put business rules and provider contracts in the package; keep Next.js route handlers, Server Actions, cookies, navigation, and translations in the application layer.
3. Inject database clients, clocks, external adapters, secrets, and application URLs at the service factory boundary so tests remain deterministic.
4. Enforce authentication, tenant permissions, validation, idempotency, audit, and error contracts inside the service whenever they protect domain behavior.
5. Add database migrations and reset/seed changes through the database package, including migration parity tests and rollback notes where data compatibility is affected.
6. Add package tests, application integration, environment validation, a package README describing configuration and extension points, and root architecture/feature/changelog updates.
7. Add the package to CI and dead-code/dependency checks before describing it as shipped.

When functionality naturally belongs to an existing owner—for example mobile endpoints in API, notifications in messaging, or currency and tax in billing—extend that package instead of creating a label-only workspace.

## Configuration Rules

- Environment variables are validated through `packages/config/src/env.ts`.
- Routes should use `appRoutes` from `@nextjs-saas/config/app` where a shared route constant exists. Route families belong in `privateAppRoutePrefixes` and `publicAppRoutePrefixes`; crawler policy derives from `crawlerConfig`, and authentication links derive from `authActionRoutes`.
- Locales and text direction should come from `@nextjs-saas/localization`.
- Message files under `apps/web/src/messages` must pass `pnpm i18n:check` before merging.
- User-facing content should come from managed content, localization, or configuration. Hardcoded strings are acceptable only for developer-facing diagnostics, stable technical labels, or temporary code with an explicit `TODO`.

## Quality Expectations

Architecture changes should include:

- Tests in proportion to the risk and blast radius.
- Documentation for new extension points.
- Migration and rollback notes when data changes.
- Security notes for auth, sessions, tenant isolation, API keys, file upload, webhooks, payments, impersonation, and secrets.
- ADR updates when the change affects framework choices, package boundaries, persistence, auth, tenancy, localization, infrastructure, deployment, or security model.
