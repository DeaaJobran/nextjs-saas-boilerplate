# ADR 0004: Self-Hosted Authentication Foundation

- Status: Accepted
- Date: 2026-07-06

## Context

The boilerplate must provide production-ready identity without forcing downstream
projects into a hosted authentication vendor. Authentication also needs to share
tenant, billing, audit, API, and mobile session boundaries with the rest of the
application.

## Decision

Build and maintain an internal `@nextjs-saas/auth` package as the default
self-hosted authentication implementation.

The package owns:

- Email/password, magic-link, email verification, password reset, and account
  deletion workflows.
- Database-backed users, accounts, sessions, refresh tokens, verification
  tokens, password reset tokens, magic links, MFA factors, passkeys, OAuth
  accounts, invitations, and audit events.
- Password policy enforcement, scrypt password hashing, token hashing, login
  lockout, session expiration, refresh-token rotation, and device/session
  revocation.
- TOTP MFA, recovery code hashing, and WebAuthn/passkey registration and
  authentication through `@simplewebauthn/server`.
- Role-based and permission-based authorization helpers for pages and API
  routes.
- Adapter boundaries for OAuth/OIDC providers, email delivery, and audit event
  handling.

The web app consumes this package through server actions, route handlers, and
server-side guards. Browser passkey flows use `@simplewebauthn/browser`.

## Consequences

- The default boilerplate can run fully self-hosted with PostgreSQL/PGlite.
- Security behavior is inspectable, testable, and extensible by downstream
  users.
- Hosted identity providers remain possible through adapters instead of becoming
  the core dependency.
- Production deployments must provide a strong `AUTH_SECRET`; development and
  test environments may use local secrets.
