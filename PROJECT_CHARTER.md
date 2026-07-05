# Project Charter

## Identity

- Repository name: `nextjs-saas-boilerplate`
- Package name: `nextjs-saas-boilerplate`
- Description: open-source Next.js SaaS boilerplate for launching production-minded products faster.
- License: MIT.
- Primary audience: developers and teams building SaaS products that need a serious starting point for auth, tenancy, billing, localization, observability, and deployment.

## Product Boundary

The boilerplate is a reusable starter, not a finished SaaS product. It should provide secure defaults, composable modules, implementation examples, and documented extension points.

## Non-Goals

- No Kubernetes baseline for the first VPS architecture.
- No public database admin UI.
- No custom legal, tax, or compliance guarantees.
- No mandatory AI module in the core starter.
- No hidden hosted-service dependency for critical runtime features.

## Runtime Support

- Node.js: `>=22.12 <27`.
- pnpm: `>=11.7 <12`.
- PostgreSQL: target 17+.
- Browsers: latest two stable versions of Chromium, Firefox, and Safari.

## Architecture Decisions

- Use a monorepo architecture as the target structure.
- Keep the current app simple until package boundaries are introduced during application architecture work.
- Use Next.js App Router and React.
- Use TypeScript strict mode.
- Use Drizzle ORM with PostgreSQL as the primary database.
- Support SQLite or PGlite only as optional development/test paths.
- Use Better Auth as the planned self-hosted auth foundation, with provider adapters behind module boundaries.
- Use provider abstractions for billing, storage, email, AI, tax, and currency.
- Billing starts with a local/mock adapter for tests and examples, plus a Stripe adapter as the first external payment provider when billing implementation begins.
- Tax starts with manual rules and provider abstraction; do not claim tax compliance without a production tax provider integration.
- Email starts with React Email templates, local preview, and an SMTP adapter; Resend/Postmark/Mailgun-style adapters are optional provider implementations.
- Use Docker Compose for local and single-VPS operations.
- Use Caddy for reverse proxy and automatic HTTPS in the first infrastructure guide.
- Enable Docker image dependency updates when Docker manifests are introduced; do not run Docker Dependabot jobs before Dockerfiles exist.

## Module Policy

Required core modules:

- `core`
- `ui`
- `config`
- `db`
- `auth`
- `tenant`
- `security`
- `observability`
- `localization`
- `testing`

Optional modules:

- `billing`
- `payments`
- `currency`
- `tax`
- `storage`
- `files`
- `emails`
- `notifications`
- `api`
- `webhooks`
- `mobile`
- `ai`
- `jobs`
- `admin`

Optional modules must be removable or adoptable without rewriting the core application.

## Coding Standards

- Use TypeScript strict mode.
- Prefer explicit module boundaries.
- Prefer stable, maintained, open-source libraries.
- Keep business rules in server-side modules, not directly inside UI components.
- Use structured validation for inputs, outputs, environment variables, and API contracts.
- Add tests in proportion to risk and blast radius.
- Document extension points before marking a module complete.

## Release Policy

- Use Conventional Commits.
- Prefer squash merges into `main`.
- Keep `main` deployable.
- Use semantic versioning once the first public release is cut.
- Publish changelogs from release automation once release tooling is added.

## Definition Of Production-Ready

A feature can be called production-ready only when it has:

- Documented configuration and extension points.
- Input and authorization validation.
- Error, loading, and empty states where user-facing.
- Tests for critical behavior and security boundaries.
- Observability hooks where operationally relevant.
- Migration and rollback guidance where data is affected.
- Security review for auth, billing, storage, API keys, webhooks, impersonation, and file uploads.

## First Public Release Target

The first public release target proves the foundation:

- Repository governance and branch protection.
- Clean quality gates.
- Stable app structure.
- UI/layout primitives.
- Local services through Docker Compose.
- PostgreSQL and Drizzle migrations.
- Auth core.
- Organization and RBAC core.
- English and Arabic RTL/LTR foundations.
- Demo deployment path.

## First Demo Target

The first demo should include:

- Marketing landing page.
- Authenticated dashboard.
- Organization switching.
- Basic admin surface.
- Localized English and Arabic routes.
- Seeded demo tenant and users.
- Public docs explaining setup and extension points.
