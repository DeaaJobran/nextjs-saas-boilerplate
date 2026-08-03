import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDatabaseRuntime, resetDatabaseRuntimeForTests } from "./client";
import { runMigrations } from "./migrations";
import {
  configureTenantRowLevelSecurity,
  listTenantRlsTables,
  tenantRlsContextSetting,
  withTenantRlsTransaction,
} from "./rls";

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "nextjs-saas-rls-"));
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATA_DIR = dataDir;
  resetDatabaseRuntimeForTests();
});

afterEach(async () => {
  const runtime = await getDatabaseRuntime();

  await runtime.close();
  resetDatabaseRuntimeForTests();
  delete process.env.PGLITE_DATA_DIR;
  await rm(dataDir, { force: true, recursive: true });
});

describe("optional tenant row-level security", () => {
  it("installs disabled policies and supports explicit opt-in and tenant context", async () => {
    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);

    const policyTables = await listTenantRlsTables(runtime);

    expect(policyTables).toEqual(
      expect.arrayContaining([
        { schema: "public", table: "billing_subscriptions" },
        { schema: "public", table: "organization_feature_flags" },
      ]),
    );
    expect(policyTables).not.toEqual(
      expect.arrayContaining([
        { schema: "public", table: "api_keys" },
        { schema: "public", table: "background_jobs" },
        { schema: "public", table: "organization_invitations" },
        { schema: "public", table: "organization_memberships" },
        { schema: "public", table: "organizations" },
      ]),
    );

    const [initialState] = await runtime.execute<{
      relforcerowsecurity: boolean;
      relrowsecurity: boolean;
    }>(
      `
        SELECT relforcerowsecurity, relrowsecurity
        FROM pg_class
        WHERE oid = 'public.billing_subscriptions'::regclass
      `,
    );

    expect(initialState).toEqual({
      relforcerowsecurity: false,
      relrowsecurity: false,
    });

    await configureTenantRowLevelSecurity(
      { enabled: true, forceForTableOwner: true },
      runtime,
    );

    const [enabledState] = await runtime.execute<{
      relforcerowsecurity: boolean;
      relrowsecurity: boolean;
    }>(
      `
        SELECT relforcerowsecurity, relrowsecurity
        FROM pg_class
        WHERE oid = 'public.billing_subscriptions'::regclass
      `,
    );

    expect(enabledState).toEqual({
      relforcerowsecurity: true,
      relrowsecurity: true,
    });

    await expect(
      withTenantRlsTransaction(
        "tenant_1",
        async (transaction) => {
          const [context] = await transaction.execute<{ tenant_id: string }>(
            "SELECT current_setting($1, true) AS tenant_id",
            [tenantRlsContextSetting],
          );

          return context?.tenant_id;
        },
        runtime,
      ),
    ).resolves.toBe("tenant_1");

    await configureTenantRowLevelSecurity({ enabled: false }, runtime);
  }, 60_000);
});
