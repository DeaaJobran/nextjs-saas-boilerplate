# Authentication

`@nextjs-saas/auth` is the self-hosted identity and session domain. It owns users, password policy, login-attempt protection, email verification, password reset, magic links, refresh-token rotation, session revocation, passkeys, TOTP factors, OAuth/OIDC account linking, invitations, auth audit events, and role-based authorization helpers.

## Service configuration

Create the service on the server and inject runtime configuration at the application boundary:

```ts
import { createAuthService } from "@nextjs-saas/auth";
import { authActionRoutes } from "@nextjs-saas/config/app";

const auth = createAuthService({
  actionRoutes: authActionRoutes,
  appBaseUrl: process.env.NEXT_PUBLIC_APP_URL,
  authSecret: process.env.AUTH_SECRET,
});
```

The service uses the shared database runtime by default. Tests and composed services can inject a `Queryable`, clock, relying-party ID, token lifetimes, or password-breach check without changing domain code.

## Authentication action routes

`AuthActionRoutes` defines the application-owned destinations embedded in email and invitation links:

- invitation acceptance;
- magic-link sign-in;
- password reset;
- email verification;
- email-change verification.

Keep those values centralized with the application's route configuration. Moving an auth page should require changing the route configuration once, not patching link generation in the auth package. `appBaseUrl` must be an absolute trusted origin; tokens are appended through the URL API.

## Notifications and localization

Auth operations write `auth.notification` records to the database outbox. The messaging worker owns localized rendering and provider delivery. The auth package supplies the recipient, event kind, link, and safe metadata; it does not send provider-specific email directly.

Applications should resolve the user's locale before rendering auth pages and notifications. Route placement and localized copy belong to the application and messaging layers, while token validation and consumption remain in this package.

## Authorization and security

Use `requirePageAccess()` and `requireApiAccess()` for simple global-role checks. Tenant membership and permission checks belong to `@nextjs-saas/tenant`; do not substitute global roles for tenant authorization.

Production deployments require a strong `AUTH_SECRET`. Keep session cookies HTTP-only and secure, preserve refresh-token rotation, record client context for sensitive events, and route authentication endpoints through the shared security rate-limit and origin policy. Passkey registration and authentication should use the configured application origin and relying-party ID.

## Verification

Run:

```bash
pnpm --filter @nextjs-saas/auth test
pnpm --filter @nextjs-saas/auth typecheck
pnpm --filter @nextjs-saas/db test
```

Tests cover password and token workflows, session rotation and revocation, passkeys, TOTP, invitations, OAuth/OIDC linking, action-route link generation, audit events, and authorization helpers.
