# Feature Priorities

This backlog groups the requested feature set into implementation areas with ownership and acceptance criteria. Detailed implementation tasks are maintained locally during planning; tracked project files keep the public scope, priorities, and quality bar clear.

| Area | Priority | Owner | Acceptance Criteria |
| --- | --- | --- | --- |
| Repository governance | P0 | Core maintainers | Public repo has license, contribution docs, security policy, issue templates, PR template, CODEOWNERS, Dependabot, and protected `main`. |
| Core application shell | P0 | Core maintainers | Next.js App Router, TypeScript strict mode, Tailwind, layouts, theming, SEO primitives, reusable states, and baseline UI primitives are implemented and documented. |
| Developer experience | P0 | Core maintainers | Fresh clone supports one-command install, local development, lint, typecheck, build, and CI validation. |
| Database foundation | P0 | Core maintainers | PostgreSQL-first Drizzle setup supports migrations, seeds, reset, transactions, audit columns, tenant IDs, and migration tests. |
| Authentication | P0 | Auth module owner | Email/password, email verification, password reset, sessions, security events, authorization helpers, and auth tests are complete before advanced auth ships. |
| Organizations and tenancy | P0 | Tenant module owner | Organizations, memberships, invitations, role/permission checks, tenant query enforcement, and cross-tenant tests are complete. |
| Localization and RTL | P0 | Localization module owner | English and Arabic routes, RTL/LTR switching, localized metadata, translation validation, and core layout checks are complete. |
| Security foundation | P0 | Security module owner | Environment validation, secure headers, rate limits, CORS/CSRF policy, API key hashing, webhook verification utilities, and audit trails are implemented. |
| Testing foundation | P0 | Testing module owner | Unit, integration, E2E, accessibility, migration, auth permission, and CI test strategy are implemented for critical paths. |
| Infrastructure baseline | P0 | Infrastructure module owner | Docker Compose, Caddy routing, VPS hardening, backup/restore scripts, and deployment templates are documented and tested. |
| Billing and payments | P1 | Billing module owner | Provider abstraction, subscriptions, trials, invoices, entitlements, usage metering, idempotent signed webhooks, and webhook tests are complete. |
| Currency and tax | P1 | Billing module owner | Currency formatting/conversion abstractions, rounding rules, tax settings, VAT fields, provider abstraction, and invoice tax breakdowns are complete. |
| Storage and files | P1 | Storage module owner | Provider adapters, signed URLs, validation, ownership checks, quotas, cleanup, previews, malware hook, and adapter tests are complete. |
| Emails and notifications | P1 | Messaging module owner | React Email templates, local preview, provider adapters, queueing, retries, delivery logs, localization, branding, and preferences are complete. |
| Public API and mobile support | P1 | API module owner | Versioned API, validation, standard errors, pagination/filtering/sorting, token auth, scopes, CORS, OpenAPI, SDK path, and API tests are complete. |
| Observability | P1 | Observability module owner | Structured logs, metrics, tracing, health/readiness checks, audit logs, request logs, job logs, and monitoring examples are complete. |
| Admin and super-admin | P1 | Admin module owner | Admin dashboards, support workflows, super-admin mode, impersonation safeguards, and strict audit logging are complete. |
| AI module | P2 | AI module owner | Provider abstraction, prompt management, token/cost tracking, tenant limits, streaming, RAG, pgvector, safety, audit, and tests are complete as an optional module. |
| Advanced release automation | P2 | Core maintainers | Semantic release, changelog automation, package publishing strategy, and release documentation are complete. |

## Priority Definitions

- P0: required before the project can claim a serious foundation.
- P1: required before a broad production-ready SaaS starter release.
- P2: optional or advanced modules that should not block the foundation.

## Ownership Rule

Each module must have an explicit owner before implementation begins. Until maintainers are added, owners are placeholders assigned to the core maintainers.

