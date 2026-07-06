# Project Charter

## Identity

- Repository name: `nextjs-saas-boilerplate`
- Package name: `nextjs-saas-boilerplate`
- Current release: `v0.3.0`
- License: MIT
- Primary audience: developers and teams building SaaS products that need a serious starting point for auth, tenancy, localization, data, quality gates, and deployment.

## Product Boundary

The boilerplate is a reusable starter, not a finished SaaS product. It should provide secure defaults, composable modules, implementation examples, and documented extension points.

The project is release-tagged but not production-ready yet. A feature can be described as implemented only when the code path, UI where applicable, data model, tests, and documentation are fully complete for downstream users to adopt intentionally.

## Non-Goals

- No Kubernetes baseline for the first VPS architecture.
- No public database admin UI.
- No custom legal, tax, or compliance guarantees.
- No mandatory AI module in the core starter.
- No hidden hosted-service dependency for critical runtime features.
- No static hardcoded marketing pages where admin-managed content is required.

## Runtime Support

- Node.js: `>=22.12 <27`
- pnpm: `>=11.7 <12`
- React: `19.2.x`
- Next.js: `16.2.x`
- PostgreSQL: target 17+
- Browsers: latest two stable versions of Chromium, Firefox, and Safari

## Architecture Decisions

- Use a pnpm monorepo architecture.
- Use Next.js App Router and React.
- Use TypeScript strict mode.
- Use Tailwind CSS and shadcn-style UI primitives built on Radix where appropriate.
- Use Drizzle ORM with PostgreSQL as the primary database.
- Support PGlite as an optional development and test path.
- Maintain an internal `@nextjs-saas/auth` package as the default self-hosted authentication foundation.
- Maintain an internal `@nextjs-saas/tenant` package for organizations, memberships, roles, permissions, tenant controls, and tenant audit.
- Use `next-intl` and `@nextjs-saas/localization` for localization and RTL/LTR behavior.
- Keep managed marketing content database-backed and admin-manageable.
- Use provider abstractions for billing, storage, email, AI, tax, and currency when those modules are implemented.
- Billing starts with a local/mock adapter for tests and examples, plus a Stripe adapter as the first external payment provider when billing implementation begins.
- Tax starts with manual rules and provider abstraction; do not claim tax compliance without a production tax provider integration.
- Email starts with React Email templates, local preview, and an SMTP adapter; Resend/Postmark/Mailgun-style adapters are optional provider implementations.
- Use Docker Compose for local and single-VPS operations.
- Use Caddy as the preferred first reverse proxy guide unless implementation work proves another open-source proxy is a better fit.
- Enable Docker image dependency updates when Docker manifests are introduced; do not run Docker Dependabot jobs before Dockerfiles exist.

## Module Policy

Implemented core packages:

- `auth`
- `config`
- `db`
- `jobs`
- `localization`
- `tenant`
- `ui`

Required future module boundaries:

- `api`
- `observability`
- `security`
- `testing`

Optional future modules:

- `billing`
- `payments`
- `currency`
- `tax`
- `storage`
- `files`
- `emails`
- `notifications`
- `webhooks`
- `mobile`
- `ai`

Optional modules must be removable or adoptable without rewriting the core application.

## Coding Standards

- Use TypeScript strict mode.
- Prefer explicit module boundaries.
- Prefer stable, maintained, open-source libraries.
- Keep business rules in server-side modules, not directly inside UI components.
- Use structured validation for inputs, outputs, environment variables, and API contracts.
- Add tests in proportion to risk and blast radius.
- Document extension points before marking a module complete.
- Keep UI responsive across mobile, tablet, laptop, desktop, and wide desktop widths.
- Account for RTL/LTR behavior in layouts, spacing, typography, icons, tables, and forms.
- Prefer shadcn/ui components before hand-rolled primitives when a maintained component fits.

## Release Policy

- Use Conventional Commits.
- Prefer squash merges into `main`.
- Keep `main` deployable.
- Use semantic version tags for public milestones.
- Keep `CHANGELOG.md` updated for release-tagged changes.
- Publish automated changelogs when release tooling is added.

## Definition Of Production-Ready

A feature can be called production-ready only when it has:

- Documented configuration and extension points.
- Input and authorization validation.
- Error, loading, and empty states where user-facing.
- Tests for critical behavior and security boundaries.
- Observability hooks where operationally relevant.
- Migration and rollback guidance where data is affected.
- Security review for auth, billing, storage, API keys, webhooks, impersonation, and file uploads.

## Foundation Release Target

The early release line proves the foundation:

- Repository governance and branch protection.
- Clean quality gates.
- Stable app structure.
- UI/layout primitives.
- Local services through Docker Compose.
- PostgreSQL and Drizzle migrations.
- Auth core.
- Organization and RBAC core.
- English and Arabic RTL/LTR foundations.
- Managed marketing content.
- Admin and super-admin foundation.
- Demo deployment path.

## First Demo Target

The first demo should include:

- Database-managed landing page.
- Authenticated dashboard.
- Organization switching.
- Basic admin surface.
- Localized English and Arabic routes.
- Seeded demo tenant and users.
- Public docs explaining setup and extension points.
