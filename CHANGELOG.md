# Changelog

All notable public changes are tracked here. This project uses semantic version tags.

## v0.3.0 - 2026-07-06

### Added

- Tenant administration foundation with organizations, memberships, invitations, roles, permissions, tenant API keys, quotas, usage limits, feature flags, audit events, and support impersonation.
- Admin and super-admin surfaces for content, users, tenant controls, and impersonation.
- Locale-aware formatter helpers for server-rendered app surfaces.
- React Doctor gating with a 100/100 baseline.

### Changed

- Refactored the organization settings page into focused server components.
- Bumped workspace package versions to `0.3.0`.

## v0.2.0 - 2026-07-06

### Added

- Self-hosted authentication foundation through `@nextjs-saas/auth`.
- Auth database tables, auth migrations, auth tests, and app integration.
- Email/password, magic link, email verification, password reset, refresh sessions, passkey, MFA, and authorization primitives.

### Changed

- Bumped workspace package versions to `0.2.0`.

## v0.1.0 - 2026-07-06

### Added

- Initial application, package, governance, and database foundation.
- Next.js App Router web app, docs app shell, shared config, localization, UI, database, and jobs packages.
- Local Docker Compose services for PostgreSQL, Redis, MinIO, and Mailpit.
- CI, CodeQL, dependency review, React Doctor, Storybook, Vitest, Playwright, ESLint, Prettier, Commitlint, Husky, and lint-staged.

### Notes

- These releases are foundation milestones, not a production-ready claim.
