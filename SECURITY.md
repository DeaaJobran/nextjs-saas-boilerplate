# Security Policy

## Supported Versions

The project is in foundation stage. Security fixes target `main` and the latest tagged release line. Older foundation tags may receive fixes only when maintainers decide a backport is necessary.

| Version  | Supported   |
| -------- | ----------- |
| `v0.3.x` | Yes         |
| `v0.2.x` | Best effort |
| `v0.1.x` | Best effort |

## Reporting A Vulnerability

Do not open a public issue for suspected vulnerabilities.

Use GitHub private vulnerability reporting when available. If private reporting is not available, contact the maintainers privately through GitHub and include:

- Affected area.
- Reproduction steps.
- Impact assessment.
- Any proof-of-concept code needed to understand the issue.
- Suggested fix if known.

## Security Review Areas

Security-sensitive changes require explicit review notes in the pull request:

- Authentication and sessions.
- Authorization, RBAC, and tenant isolation.
- Billing, payments, refunds, and webhooks.
- API keys and personal access tokens.
- File upload, storage, signed URLs, and file ownership.
- Admin, support, and impersonation workflows.
- Environment variables and secrets.
- CORS, CSRF, rate limiting, and secure headers.
- Data deletion and privacy workflows.
- Release, migration, and upgrade behavior when security-sensitive data changes.

## Disclosure Policy

Maintainers will acknowledge valid reports, investigate privately, prepare a fix, and publish a security advisory when appropriate. Public disclosure should wait until a fix or mitigation is available.
