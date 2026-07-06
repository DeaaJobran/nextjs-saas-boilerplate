import { describe, expect, it } from "vitest";

import {
  createApiKeySecret,
  hashApiKey,
  verifyApiKeySecret,
} from "./conventions";
import {
  combineWhereFragments,
  createEqualityFilterFragment,
  createPagination,
  createSearchFragment,
  createSortFragment,
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
