import { describe, expect, it } from "vitest";

import {
  createApiKeySecret,
  hashApiKey,
  verifyApiKeySecret,
} from "./conventions";
import {
  assertTenantScopeMatches,
  combineWhereFragments,
  createEqualityFilterFragment,
  createPagination,
  createSearchFragment,
  createSortFragment,
  createTenantFilterFragment,
  createTenantScope,
} from "./query-helpers";

describe("database helper conventions", () => {
  it("creates bounded pagination", () => {
    expect(createPagination({ page: 3, pageSize: 50, maxLimit: 40 })).toEqual({
      limit: 40,
      offset: 80,
    });
  });

  it("builds safe sort fragments from allow-listed columns", () => {
    expect(
      createSortFragment({
        allowedColumns: {
          created: "created_at",
          name: "name",
        },
        defaultColumn: "created",
        direction: "desc",
        sortBy: "unknown",
      }),
    ).toEqual({
      params: [],
      sql: "ORDER BY created_at DESC",
    });
  });

  it("combines parameterized filter and search fragments", () => {
    const filters = createEqualityFilterFragment(
      { ignored: "x", status: "ready", tenant: "tenant_1" },
      { status: "status", tenant: "tenant_id" },
    );
    const search = createSearchFragment({
      columns: ["name", "email"],
      query: "Ada",
    });

    expect(combineWhereFragments(filters, search)).toEqual({
      params: ["ready", "tenant_1", "%Ada%"],
      sql: "WHERE status = $1 AND tenant_id = $2 AND (name ILIKE $3 OR email ILIKE $3)",
    });
  });

  it("creates explicit tenant scopes and tenant filters", () => {
    expect(
      createTenantScope({ actorId: "user_1", tenantId: "tenant_1" }),
    ).toEqual({
      actorId: "user_1",
      tenantId: "tenant_1",
    });
    expect(() => createTenantScope({ tenantId: " " })).toThrow(
      "Tenant scope requires a tenant id.",
    );
    expect(
      createTenantFilterFragment({
        column: "organization_id",
        tenantId: "tenant_1",
      }),
    ).toEqual({
      params: ["tenant_1"],
      sql: "WHERE organization_id = $1",
    });
  });

  it("rejects records outside the requested tenant scope", () => {
    const scope = createTenantScope({ tenantId: "tenant_1" });

    expect(() =>
      assertTenantScopeMatches({ tenantId: "tenant_1" }, scope),
    ).not.toThrow();
    expect(() =>
      assertTenantScopeMatches({ tenantId: "tenant_2" }, scope),
    ).toThrow("Record does not belong to the requested tenant scope.");
  });

  it("hashes API keys with a salted verifier without storing the secret", () => {
    const { hash, secret } = createApiKeySecret("test");
    const secondHash = hashApiKey(secret);

    expect(secret).toMatch(/^test_/);
    expect(hash).toMatch(/^scrypt\$N=16384,r=8,p=1\$/);
    expect(hash).not.toContain(secret);
    expect(secondHash).not.toBe(hash);
    expect(verifyApiKeySecret(secret, hash)).toBe(true);
    expect(verifyApiKeySecret(`${secret}-wrong`, hash)).toBe(false);
    expect(verifyApiKeySecret(secret, "sha256$bad")).toBe(false);
  });
});
