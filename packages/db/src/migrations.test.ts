import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  updateLocalizationSettings,
  upsertManagedPage,
} from "@nextjs-saas/config/content";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDatabaseRuntime, resetDatabaseRuntimeForTests } from "./client";
import {
  readContentSnapshot,
  resetContentDatabase,
  updateContentSnapshot,
} from "./content-repository";
import { migrationManifest } from "./migration-manifest";
import { listMigrationFiles, runMigrations } from "./migrations";
import { resetDatabaseData } from "./reset";

let dataDir: string;
let databaseRuntimeOpened = false;

function getMigrationFilePath(fileName: string) {
  const candidates = [
    path.join(process.cwd(), "migrations", fileName),
    path.join(process.cwd(), "packages", "db", "migrations", fileName),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "nextjs-saas-db-"));
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATA_DIR = dataDir;
  databaseRuntimeOpened = false;
  resetDatabaseRuntimeForTests();
});

afterEach(async () => {
  if (databaseRuntimeOpened) {
    await (await getDatabaseRuntime()).close();
  }

  resetDatabaseRuntimeForTests();
  delete process.env.PGLITE_DATA_DIR;
  await rm(dataDir, { force: true, recursive: true });
});

describe("database migrations", () => {
  it("keeps the runtime manifest aligned with SQL migration files", async () => {
    for (const migration of migrationManifest) {
      const sql = await readFile(getMigrationFilePath(migration.id), "utf8");

      expect(migration.sql.trim()).toBe(sql.trim());
    }
  });

  it("applies migrations idempotently", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();
    const migrations = await listMigrationFiles();

    await expect(runMigrations(runtime)).resolves.toEqual(migrations);
    await expect(runMigrations(runtime)).resolves.toEqual([]);
  }, 15_000);

  it("creates service foundation tables", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);

    const rows = await runtime.execute<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'event_log',
          'outbox_events',
          'idempotency_keys',
          'api_keys',
          'rate_limit_buckets',
          'background_jobs',
          'cron_schedules'
        )
      ORDER BY table_name
    `);

    expect(rows.map((row) => row.table_name)).toEqual([
      "api_keys",
      "background_jobs",
      "cron_schedules",
      "event_log",
      "idempotency_keys",
      "outbox_events",
      "rate_limit_buckets",
    ]);
  }, 15_000);

  it("creates auth identity tables", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);

    const rows = await runtime.execute<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'auth_accounts',
          'auth_audit_events',
          'auth_challenges',
          'auth_invitations',
          'auth_login_attempts',
          'auth_mfa_factors',
          'auth_oauth_states',
          'auth_passkeys',
          'auth_recovery_codes',
          'auth_sessions',
          'auth_tokens',
          'auth_users'
        )
      ORDER BY table_name
    `);

    expect(rows.map((row) => row.table_name)).toEqual([
      "auth_accounts",
      "auth_audit_events",
      "auth_challenges",
      "auth_invitations",
      "auth_login_attempts",
      "auth_mfa_factors",
      "auth_oauth_states",
      "auth_passkeys",
      "auth_recovery_codes",
      "auth_sessions",
      "auth_tokens",
      "auth_users",
    ]);
  }, 15_000);

  it("creates tenant administration tables", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);

    const rows = await runtime.execute<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'impersonation_sessions',
          'organization_feature_flags',
          'organization_invitations',
          'organization_memberships',
          'organization_quotas',
          'organization_usage_limits',
          'organizations',
          'tenant_audit_events'
        )
      ORDER BY table_name
    `);

    expect(rows.map((row) => row.table_name)).toEqual([
      "impersonation_sessions",
      "organization_feature_flags",
      "organization_invitations",
      "organization_memberships",
      "organization_quotas",
      "organization_usage_limits",
      "organizations",
      "tenant_audit_events",
    ]);
  }, 15_000);

  it("creates localization settings table", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);

    const rows = await runtime.execute<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'localization_settings'
    `);

    expect(rows.map((row) => row.table_name)).toEqual([
      "localization_settings",
    ]);
  }, 15_000);

  it("creates billing, payment, currency, and tax tables", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);

    const rows = await runtime.execute<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'billing_audit_events',
          'billing_checkout_sessions',
          'billing_coupons',
          'billing_customers',
          'billing_discounts',
          'billing_entitlements',
          'billing_exchange_rates',
          'billing_invoice_items',
          'billing_invoices',
          'billing_payment_methods',
          'billing_payment_providers',
          'billing_plan_translations',
          'billing_plans',
          'billing_prices',
          'billing_refunds',
          'billing_subscriptions',
          'billing_tax_rates',
          'billing_tax_settings',
          'billing_tenant_settings',
          'billing_usage_meters',
          'billing_usage_records',
          'billing_webhook_events'
        )
      ORDER BY table_name
    `);

    expect(rows.map((row) => row.table_name)).toEqual([
      "billing_audit_events",
      "billing_checkout_sessions",
      "billing_coupons",
      "billing_customers",
      "billing_discounts",
      "billing_entitlements",
      "billing_exchange_rates",
      "billing_invoice_items",
      "billing_invoices",
      "billing_payment_methods",
      "billing_payment_providers",
      "billing_plan_translations",
      "billing_plans",
      "billing_prices",
      "billing_refunds",
      "billing_subscriptions",
      "billing_tax_rates",
      "billing_tax_settings",
      "billing_tenant_settings",
      "billing_usage_meters",
      "billing_usage_records",
      "billing_webhook_events",
    ]);

    const providerRows = await runtime.execute<{ count: string }>(
      "SELECT count(*)::text AS count FROM billing_payment_providers WHERE provider IN ('mock', 'stripe')",
    );
    const priceRows = await runtime.execute<{ count: string }>(
      "SELECT count(*)::text AS count FROM billing_prices WHERE provider = 'mock'",
    );

    expect(Number(providerRows[0]?.count)).toBe(2);
    expect(Number(priceRows[0]?.count)).toBeGreaterThan(0);
  }, 15_000);

  it("creates public API, webhook, realtime, and mobile support tables", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);

    const rows = await runtime.execute<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'api_audit_events',
          'api_usage_records',
          'api_webhook_deliveries',
          'api_webhook_endpoints',
          'mobile_deep_links',
          'mobile_devices',
          'mobile_push_subscriptions',
          'mobile_sessions',
          'mobile_upload_intents'
        )
      ORDER BY table_name
    `);

    expect(rows.map((row) => row.table_name)).toEqual([
      "api_audit_events",
      "api_usage_records",
      "api_webhook_deliveries",
      "api_webhook_endpoints",
      "mobile_deep_links",
      "mobile_devices",
      "mobile_push_subscriptions",
      "mobile_sessions",
      "mobile_upload_intents",
    ]);
  }, 15_000);

  it("seeds content and records versions and audit events for admin changes", async () => {
    databaseRuntimeOpened = true;

    await resetContentDatabase();

    const seededSnapshot = await readContentSnapshot();
    const landingPage = seededSnapshot.pages.find(
      (page) => page.id === "landing-en",
    );

    expect(landingPage?.title).toBe("Next.js SaaS Boilerplate");

    await updateContentSnapshot(
      (currentSnapshot) =>
        upsertManagedPage(currentSnapshot, {
          ...landingPage!,
          title: "Updated from migration test",
          updatedAt: new Date().toISOString(),
        }),
      { actorId: "vitest-admin" },
    );

    const runtime = await getDatabaseRuntime();
    const versionRows = await runtime.execute<{ count: string }>(
      "SELECT count(*)::text AS count FROM managed_page_versions WHERE page_id = $1",
      ["landing-en"],
    );
    const auditRows = await runtime.execute<{ count: string }>(
      "SELECT count(*)::text AS count FROM content_audit_events WHERE entity_id = $1 AND actor_id = $2",
      ["landing-en", "vitest-admin"],
    );

    expect(Number(versionRows[0]?.count)).toBeGreaterThan(0);
    expect(Number(auditRows[0]?.count)).toBeGreaterThan(0);
  }, 15_000);

  it("persists and audits localization settings", async () => {
    databaseRuntimeOpened = true;

    await resetContentDatabase();

    await updateContentSnapshot(
      (currentSnapshot) =>
        updateLocalizationSettings(currentSnapshot, {
          defaultLocale: "ar",
          enabledLocales: ["en", "ar"],
        }),
      { actorId: "vitest-admin" },
    );

    const snapshot = await readContentSnapshot();
    const runtime = await getDatabaseRuntime();
    const auditRows = await runtime.execute<{ count: string }>(
      "SELECT count(*)::text AS count FROM content_audit_events WHERE entity_id = $1 AND actor_id = $2",
      ["default", "vitest-admin"],
    );

    expect(snapshot.localization).toEqual({
      defaultLocale: "ar",
      enabledLocales: ["en", "ar"],
    });
    expect(Number(auditRows[0]?.count)).toBeGreaterThan(0);
  }, 15_000);

  it("resets service data and restores seed content", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);
    await runtime.execute(
      `
        INSERT INTO background_jobs (
          id,
          queue,
          type,
          payload,
          status,
          priority,
          attempts,
          max_attempts,
          available_at,
          created_at,
          updated_at
        )
        VALUES (
          'job_reset_test',
          'default',
          'test.job',
          '{}'::jsonb,
          'queued',
          0,
          0,
          3,
          now(),
          now(),
          now()
        )
      `,
    );

    await resetDatabaseData();

    const jobRows = await runtime.execute<{ count: string }>(
      "SELECT count(*)::text AS count FROM background_jobs",
    );
    const contentSnapshot = await readContentSnapshot();

    expect(Number(jobRows[0]?.count)).toBe(0);
    expect(contentSnapshot.pages.some((page) => page.id === "landing-en")).toBe(
      true,
    );
  }, 20_000);
});
