# Security and privacy

`@nextjs-saas/security` centralizes secure response headers, CSP generation,
same-origin and CORS policy, trusted-proxy address handling, database-backed rate
limits with hashed identifiers, bot-protection hooks, schema-bound input/output
helpers, timing-safe webhook signatures, role-based MFA policy, security audit
events, legal acceptance records, and privacy request/export workflows.

The web application applies the secure headers globally, relies on Next.js'
built-in same-origin Server Action checks plus explicit origin checks for public
and authentication forms. Database-backed limits cover authentication and
contact actions plus passkey, export, and deletion endpoints. Rate-limited HTTP
handlers return `429`; Server Actions surface localized errors. Denied CORS
origins never receive an `Access-Control-Allow-Origin` header. Public API routes
must add their own policy before claiming general API rate-limit coverage.

Account settings provide a portable JSON export, legal acceptance history,
privacy request history, and password-confirmed account deletion. The export
uses an explicit allowlist of personal-data columns and never includes password,
token, API-key, or provider-secret hashes.

See `.env.example` for CORS, CSP, proxy, rate-limit, MFA enforcement, and Server
Action configuration. Production secrets must be injected through the runtime
environment or an external secrets manager, rotated deliberately, excluded from
logs and source control, and shared consistently across horizontally scaled app
instances. `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `AUTH_SECRET`, webhook secrets,
storage signing secrets, provider credentials, and database credentials must be
unique production values.

Forwarded client-address headers are ignored unless `TRUSTED_PROXY_COUNT` is a
positive value. Set it to the exact number of trusted reverse proxies in front
of the app, and configure those proxies to overwrite inbound forwarding headers.
