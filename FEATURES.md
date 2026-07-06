# Feature Priorities

This backlog groups the requested feature set into public implementation areas with ownership, status, and acceptance criteria. Detailed implementation tasks are maintained locally in ignored notes; tracked project files keep the public scope, priorities, and quality bar clear.

## Status Legend

- Shipped: implemented in the current release line.
- Partial: foundation exists, but the area is not fully complete and should not be marketed as production-ready.
- Planned: not implemented beyond placeholders, schema preparation, or policy.

| Area                          | Priority | Status  | Owner                       | Acceptance Criteria                                                                                                                                                                   |
| ----------------------------- | -------- | ------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository governance         | P0       | Shipped | Core maintainers            | Public repo has license, contribution docs, security policy, issue templates, PR template, CODEOWNERS, Dependabot, protected `main`, and release tags.                                |
| Core application shell        | P0       | Shipped | Core maintainers            | Next.js App Router, TypeScript strict mode, Tailwind, layouts, theming, SEO primitives, reusable states, and baseline UI primitives are implemented and documented.                   |
| Developer experience          | P0       | Shipped | Core maintainers            | Fresh clone supports install, local development, services, lint, typecheck, test, build, Storybook, React Doctor, and CI validation.                                                  |
| Database foundation           | P0       | Shipped | Core maintainers            | PostgreSQL-first Drizzle setup supports migrations, seeds, reset, transactions, audit columns, tenant IDs, and migration tests.                                                       |
| Managed content               | P0       | Shipped | Core maintainers            | Landing, pricing, contact, and legal pages are backed by database-managed content with admin editing and seeded localized content.                                                    |
| Authentication                | P0       | Shipped | Auth module owner           | Email/password, magic link, email verification, password reset, sessions, security events, authorization helpers, passkey/MFA primitives, and auth tests exist.                       |
| Organizations and tenancy     | P0       | Shipped | Tenant module owner         | Organizations, memberships, invitations, role/permission checks, tenant query enforcement, tenant API keys, quotas, usage limits, audit, and tests exist.                             |
| Localization and RTL          | P0       | Shipped | Localization module owner   | English and Arabic routing, RTL/LTR switching, locale metadata, translation validation, active locale administration, preferred locales, formatters, templates, and RTL checks exist. |
| Security foundation           | P0       | Partial | Security module owner       | Environment validation, auth security, tenant permissions, API key hashing, and audit foundations exist; broader headers, CORS/CSRF, rate limit UI, and workflows remain.             |
| Testing foundation            | P0       | Partial | Testing module owner        | Unit, migration, auth, tenant, E2E, accessibility, Storybook, CI, and React Doctor exist; visual regression and broader integration coverage remain.                                  |
| Infrastructure baseline       | P0       | Partial | Infrastructure module owner | Docker Compose local services exist; VPS hardening, reverse proxy examples, backup/restore scripts, deployment templates, and rollback docs remain.                                   |
| Billing and payments          | P1       | Planned | Billing module owner        | Provider abstraction, subscriptions, trials, invoices, entitlements, usage metering, idempotent signed webhooks, and webhook tests are complete.                                      |
| Currency and tax              | P1       | Planned | Billing module owner        | Currency formatting/conversion abstractions, rounding rules, tax settings, VAT fields, provider abstraction, and invoice tax breakdowns are complete.                                 |
| Storage and files             | P1       | Planned | Storage module owner        | Provider adapters, signed URLs, validation, ownership checks, quotas, cleanup, previews, malware hook, and adapter tests are complete.                                                |
| Emails and notifications      | P1       | Planned | Messaging module owner      | React Email templates, local preview, provider adapters, queueing, retries, delivery logs, localization, branding, and preferences are complete.                                      |
| Public API and mobile support | P1       | Planned | API module owner            | Versioned API, validation, standard errors, pagination/filtering/sorting, token auth, scopes, CORS, OpenAPI, SDK path, and API tests are complete.                                    |
| Observability                 | P1       | Planned | Observability module owner  | Structured logs, metrics, tracing, health/readiness checks, audit logs, request logs, job logs, and monitoring examples are complete.                                                 |
| Admin and super-admin         | P1       | Partial | Admin module owner          | Content, user, tenant, and super-admin impersonation surfaces exist; complete production safeguards, operations workflows, and audit review UX remain.                                |
| AI module                     | P2       | Planned | AI module owner             | Provider abstraction, prompt management, token/cost tracking, tenant limits, streaming, RAG, pgvector, safety, audit, and tests are complete as an optional module.                   |
| Advanced release automation   | P2       | Planned | Core maintainers            | Semantic release, changelog automation, package publishing strategy, and release documentation are complete.                                                                          |

## Priority Definitions

- P0: required before the project can claim a serious foundation.
- P1: required before a broad production-ready SaaS starter release.
- P2: optional or advanced modules that should not block the foundation.

## Ownership Rule

Each module must have an explicit owner before implementation begins. Until maintainers are added, owners are placeholders assigned to the core maintainers.

## Completion Rule

Do not mark an area as shipped unless its code, UI where relevant, data model, tests, documentation, and security notes are all accurate. If a feature is intentionally incomplete, keep it marked as partial or planned.
