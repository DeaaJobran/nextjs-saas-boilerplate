# Public API and mobile support

`@nextjs-saas/api` provides the versioned API contract catalog and service layer used by the `/api/v1` route handlers. It includes scoped personal access tokens and tenant API keys, consistent response envelopes, cursor pagination, filtering and sorting, idempotency, tenant webhooks, OAuth/OIDC adapters, mobile sessions and devices, push subscriptions, deep links, upload intents, realtime event streams, OpenAPI output, TypeScript SDK generation, and usage/audit records.

## Contracts and route handlers

Add or change an endpoint in the shared `apiRouteCatalog` and its Zod input schema before implementing the route handler. The catalog is the source for required scopes, OpenAPI generation, and the generated SDK. Route handlers should remain thin:

1. parse the request with the contract schema;
2. authenticate through `createApiService()`;
3. enforce the declared scopes and tenant boundary;
4. call the service method;
5. return `apiSuccess()` or the normalized `apiFailure()` response.

Do not add undocumented route-only response shapes or bypass service-level tenant checks.

## Service configuration

`createApiService()` accepts injected database, clock, storage, OAuth adapters, secrets, CORS origins, and idempotency/upload lifetimes. Production applications normally obtain defaults from validated environment configuration:

- `NEXT_PUBLIC_APP_URL` defines the canonical application origin.
- `API_CORS_ORIGINS` is the explicit browser-origin allow-list.
- `AUTH_SECRET` signs auth-owned tokens and is also a fallback secret where documented.
- `API_LOOKUP_HASH_SECRET` protects deterministic API lookup hashes.
- `MOBILE_DEEP_LINK_SECRET` signs mobile deep links.

Use unique production secrets and keep them synchronized across horizontally scaled instances.

## Authentication, scopes, and tenancy

The service recognizes personal access tokens, tenant API keys, and mobile sessions. Each principal carries explicit scopes. Tenant-scoped operations additionally verify organization membership and permissions; a matching scope never bypasses tenant membership. API keys are stored as hashes and returned in plaintext only when created.

Mutation routes that support retries accept an idempotency key and persist the result for the configured lifetime. Reusing a key with a different operation or payload is rejected.

## OAuth/OIDC and mobile extensions

Add an OAuth/OIDC provider by implementing `OAuthProviderAdapter` and injecting it through `oauthAdapters`. Provider secrets remain runtime configuration. The adapter maps the provider profile into the package's normalized identity shape.

Mobile sessions use rotating refresh tokens and a device registry. Device revocation invalidates linked sessions. Push delivery remains a provider abstraction. Mobile uploads use short-lived, token-bound intents and delegate storage validation and byte persistence to `@nextjs-saas/storage`.

## OpenAPI and SDK

`generateOpenApiSpec()` derives OpenAPI 3.1 paths and security metadata from the route catalog. `generateTypeScriptSdk()` creates the typed client source served by the SDK route. Regenerate both through the catalog instead of maintaining parallel handwritten definitions.

## Verification

Run:

```bash
pnpm --filter @nextjs-saas/api test
pnpm --filter @nextjs-saas/api typecheck
pnpm --filter @nextjs-saas/db test
pnpm --filter @nextjs-saas/web typecheck
```

Tests cover token and tenant isolation, scopes, idempotency, pagination, webhooks, mobile rotation/revocation, push/deep-link/upload flows, OAuth adapters, OpenAPI generation, and usage records.
