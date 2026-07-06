# Next.js SaaS Boilerplate

[![CI](https://github.com/DeaaJobran/nextjs-saas-boilerplate/actions/workflows/ci.yml/badge.svg)](https://github.com/DeaaJobran/nextjs-saas-boilerplate/actions/workflows/ci.yml) [![React Doctor](https://github.com/DeaaJobran/nextjs-saas-boilerplate/actions/workflows/react-doctor.yml/badge.svg)](https://github.com/DeaaJobran/nextjs-saas-boilerplate/actions/workflows/react-doctor.yml)

An open-source, production-minded Next.js SaaS boilerplate for developers who want to launch serious products faster without inheriting hidden architectural debt.

## Status

Current release: `v0.3.0`.

The project has a working foundation for the web app, database, self-hosted identity, tenant administration, managed marketing content, local services, and quality gates. It is still not a finished production SaaS starter. Billing, storage provider adapters, email delivery, public API/mobile support, deployment guides, and observability are still roadmap items.

## Principles

- Greenfield architecture with no legacy compatibility layers.
- Open-source first dependencies and self-hostable infrastructure.
- Strong defaults for security, testing, localization, accessibility, and developer experience.
- Dynamic data and configuration instead of hardcoded product behavior.
- Clear separation between reusable starter code, optional modules, and example integrations.

## Implemented Foundation

- Next.js App Router with React `19.2.x`, TypeScript strict mode, Tailwind CSS, and locale-aware routing.
- English and Arabic locale support with RTL/LTR layout switching through `next-intl` and `@nextjs-saas/localization`.
- Shared shadcn-style UI package with Radix-backed primitives, forms, cards, dialogs, toasts, tables, charts, and state components.
- Database package with PostgreSQL runtime, PGlite local fallback, Drizzle schema, migrations, seeds, reset scripts, transactions, query helpers, and migration tests.
- Database-managed landing, pricing, contact, and legal content with admin editing surfaces and seeded content.
- Self-hosted `@nextjs-saas/auth` package with email/password, magic links, email verification, password reset, refresh sessions, passkeys, TOTP MFA primitives, authorization helpers, audit events, and auth tests.
- Tenant package with organizations, memberships, invitations, roles, permissions, tenant API keys, quotas, usage limits, feature flags, audit logs, support impersonation, and tenant tests.
- Admin and super-admin surfaces for content, users, tenant controls, and impersonation workflows.
- Jobs package with background job and cron schedule primitives.
- Local Docker Compose services for PostgreSQL, Redis, MinIO, and Mailpit.
- GitHub Actions for CI, CodeQL, dependency review, and React Doctor.
- Storybook, Vitest, Playwright E2E, Playwright accessibility checks, ESLint, Prettier, Commitlint, Husky, lint-staged, and React Doctor.

## Roadmap Highlights

- Billing, payments, currency, tax, invoices, usage metering, and webhook handling.
- Storage/file module with provider adapters, signed URLs, validation, ownership policies, previews, cleanup, and malware scanning hooks.
- Email and notification provider adapters with React Email templates and delivery logs.
- Public API, OpenAPI generation, mobile session support, OAuth/OIDC support, SDK path, and API usage tracking.
- Observability module with structured logs, metrics, tracing, health checks, uptime checks, and operational dashboards.
- Production deployment examples, VPS hardening, reverse proxy guides, backup/restore, maintenance mode, and rollback strategy.
- Optional AI module with provider abstraction, token tracking, RAG, pgvector, safety, evaluation, and audit trail.

See [Feature priorities](FEATURES.md) for the tracked public backlog.

## Supported Runtime Baseline

- Node.js: `>=22.12 <27`
- pnpm: `>=11.7 <12`
- React: `19.2.x`
- Next.js: `16.2.x`
- PostgreSQL target: 17+
- Browsers: latest two stable versions of Chromium, Firefox, and Safari

## Getting Started

Install dependencies:

```bash
pnpm install
```

Copy the environment template:

```bash
cp .env.example .env
```

Start local infrastructure:

```bash
pnpm services:up
```

Run database migrations and seed managed content:

```bash
pnpm db:migrate
pnpm db:seed
```

Start the web app:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful local service URLs:

- Mailpit: [http://localhost:8025](http://localhost:8025)
- MinIO console: [http://localhost:9001](http://localhost:9001)
- PostgreSQL: `127.0.0.1:5432`
- Redis: `127.0.0.1:6379`

## Quality Checks

Common local checks:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm doctor:react
```

Full validation:

```bash
pnpm validate
```

Playwright-powered E2E and accessibility checks need Chromium installed:

```bash
pnpm playwright:install
pnpm test:e2e
pnpm test:a11y
```

Storybook:

```bash
pnpm storybook
pnpm build:storybook
```

## Workspace

- `apps/web`: primary Next.js SaaS application.
- `apps/docs`: public documentation app shell.
- `packages/auth`: self-hosted identity and session domain.
- `packages/config`: app configuration, environment validation, SEO, and managed content contracts.
- `packages/db`: database runtime, schema, migrations, content repository, query helpers, and scripts.
- `packages/jobs`: background job and cron primitives.
- `packages/localization`: locale definitions, direction helpers, and locale-aware formatting.
- `packages/tenant`: organizations, memberships, invitations, tenant permissions, tenant API keys, quotas, feature flags, audit, and impersonation.
- `packages/ui`: shared UI primitives, components, styles, and Storybook stories.

## Project Documents

- [Project charter](PROJECT_CHARTER.md)
- [Architecture](ARCHITECTURE.md)
- [Feature priorities](FEATURES.md)
- [Quality gates](docs-quality.md)
- [Changelog](CHANGELOG.md)
- [Architecture decisions](adr/)
- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Support policy](SUPPORT.md)

Local implementation notes under `/docs` are intentionally ignored by Git. Public, tracked documentation belongs in root Markdown files, ADRs, package docs, and `apps/docs`.

## License

MIT
