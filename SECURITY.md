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

Billing integrations must verify webhook signatures against the raw request body before processing events. Provider API keys and webhook secrets must stay in environment variables or external secret storage; database provider records store only secret references, capabilities, and non-secret configuration.

## Runtime Security Defaults

The web app enables a restrictive Content Security Policy, clickjacking and MIME
sniffing protection, a permissions policy, a strict referrer policy, and HSTS in
production. Next.js validates Server Action origins; authentication and public
form paths add explicit same-origin validation and durable rate limits. API CORS
is allowlist-based and denied origins receive no allow-origin header.

Rate-limit identifiers and security audit network metadata are HMAC-hashed before
storage. Forwarded addresses are ignored unless `TRUSTED_PROXY_COUNT` matches the
number of trusted reverse proxies. Proxies must overwrite inbound forwarding
headers. Role-based MFA enforcement is configured through
`SECURITY_MFA_ENFORCED_ROLES` and routes affected users to the existing enrollment
flow.

## Secrets Management

Never use `.env.example` values in production. Supply `AUTH_SECRET`,
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, storage and webhook signing secrets,
database credentials, and provider credentials through the deployment runtime or
an external secrets manager. Use independent high-entropy values per environment,
limit read access, rotate deliberately, and keep the same active values across
all app instances during a deployment. Secrets, raw tokens, password hashes, API
key hashes, and signing material must not be logged or included in support data.

## Privacy Workflows

New self-service registrations record the exact version and fingerprint of the
managed terms and privacy documents accepted by the user. Account settings expose
acceptance history and privacy-request history. Authenticated users can download
an allowlisted JSON export that excludes credentials, token hashes, API-key
hashes, and provider secrets. Password-confirmed deletion creates an audited
privacy request, revokes sessions, and soft-deletes the identity so downstream
products can apply their documented retention and legal-hold policies before
irreversible purge. These workflows are implementation examples, not legal
advice; downstream products must replace the seeded legal content and define
jurisdiction-specific retention rules before launch.

## Disclosure Policy

Maintainers will acknowledge valid reports, investigate privately, prepare a fix, and publish a security advisory when appropriate. Public disclosure should wait until a fix or mitigation is available.
