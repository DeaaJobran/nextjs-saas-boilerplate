# ADR 0002: Foundation Stack

- Status: Accepted
- Date: 2026-07-06

## Context

The boilerplate needs a modern, self-hostable, open-source-first foundation that supports SaaS features such as auth, tenancy, billing, localization, observability, and VPS deployment.

## Decision

Use the following baseline:

- Next.js App Router for the web application.
- React and TypeScript strict mode.
- pnpm for package management.
- Monorepo architecture as the target repository shape.
- Tailwind CSS with shadcn/ui or an equivalent component system.
- Radix UI primitives.
- Drizzle ORM with PostgreSQL as the primary database.
- Better Auth as the planned self-hosted authentication foundation.
- next-intl for localization and RTL/LTR support.
- React Email, local preview, and SMTP as the first email implementation path.
- A billing provider abstraction with local/mock and Stripe adapters as the first implementation target.
- Docker Compose for local and single-VPS infrastructure.
- Caddy for reverse proxy and automatic HTTPS in the initial infrastructure guide.

## Consequences

- The app can support self-hosted deployment without requiring a proprietary platform.
- Advanced modules must expose provider boundaries rather than hard-coding vendors.
- The first implementation phases should avoid billing, tax, AI, and mobile API work until the core foundation is stable.

## References

- Better Auth Next.js example documents email/password, social sign-in, passkeys, email verification, password reset, two-factor authentication, profile update, sessions, organizations, members, and roles.
- Drizzle ORM documents native PostgreSQL support.
- next-intl provides i18n support for Next.js, including message formatting, dates, times, and numbers.
