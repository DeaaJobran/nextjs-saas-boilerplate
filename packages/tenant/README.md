# Organizations and tenancy

`@nextjs-saas/tenant` owns organizations, memberships, invitations, roles, permissions, tenant API keys, feature flags, usage limits, quotas, audit events, and time-bound support impersonation.

## Service boundary

Use `createTenantService()` for tenant reads and writes. The service accepts an injected database, clock, and application URL for tests and composed runtimes. Application pages may hide unavailable actions, but authorization must still run inside the service method.

Every tenant-sensitive operation identifies the organization and effective user. Use `requireMembership()` with the relevant `TenantPermission`; never trust an organization ID, role, or permission supplied by the client. Cross-tenant access must fail before returning whether a resource exists.

## Roles and permissions

`tenantRoleConfig`, `tenantPermissionCatalog`, and `tenantRolePermissions` are the central policy. Extend the catalog and role mapping together, then update server enforcement, UI visibility, translations, and tests. Prefer a specific permission over testing role names throughout the application.

Global application roles and tenant roles are different boundaries. A global support or admin role does not automatically grant organization data access. Support impersonation requires explicit privileged authorization, an expiry, visible disclosure, and audit events.

## Invitations and organization switching

Invitation creation and acceptance are service workflows with normalized email matching, expiration, role validation, and audit records. Organization switching changes the active context only after membership is verified. Route guards and server actions should obtain the active tenant context through the web application helper rather than parsing tenant identifiers directly from untrusted input.

## API keys, limits, and quotas

Tenant API keys expose plaintext only at creation and persist hashes plus a non-secret prefix. Scopes are validated against the catalog. Feature flags, usage limits, and quotas are tenant-scoped configuration and must be evaluated on the server before protected work is performed. Storage and billing services compose with tenant permissions and quota records instead of duplicating tenant policy.

## Verification

Run:

```bash
pnpm --filter @nextjs-saas/tenant test
pnpm --filter @nextjs-saas/tenant typecheck
pnpm --filter @nextjs-saas/db test
```

Tests cover organization isolation, memberships, invitations, roles, permissions, API keys, flags, usage limits, quotas, audit events, switching, and impersonation safeguards.
