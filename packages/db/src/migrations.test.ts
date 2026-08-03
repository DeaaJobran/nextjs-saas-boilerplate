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
  }, 60_000);

  it("merges legacy global rate-limit buckets before replacing their index", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();
    const targetMigrationIndex = migrationManifest.findIndex(
      (migration) => migration.id === "0012_security_privacy_hardening.sql",
    );

    expect(targetMigrationIndex).toBeGreaterThanOrEqual(0);

    for (const migration of migrationManifest.slice(0, targetMigrationIndex)) {
      await runtime.execute(migration.sql);
      await runtime.execute(
        "INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING",
        [migration.id],
      );
    }

    const bucketTimestamp = "2026-08-01T00:00:00.000Z";

    for (const [id, count] of [
      ["legacy_bucket_1", 2],
      ["legacy_bucket_2", 3],
    ] as const) {
      await runtime.execute(
        `
          INSERT INTO rate_limit_buckets (
            id, tenant_id, identifier, scope, window_start,
            window_seconds, count, expires_at
          )
          VALUES ($1, NULL, 'hashed-identifier', 'auth', $2, 60, $3, $4)
        `,
        [id, bucketTimestamp, count, "2026-08-01T00:01:00.000Z"],
      );
    }

    await expect(runMigrations(runtime)).resolves.toEqual(
      migrationManifest
        .slice(targetMigrationIndex)
        .map((migration) => migration.id),
    );

    const buckets = await runtime.execute<{ count: number }>(
      "SELECT count FROM rate_limit_buckets WHERE tenant_id IS NULL AND identifier = 'hashed-identifier' AND scope = 'auth'",
    );

    expect(buckets).toHaveLength(1);
    expect(Number(buckets[0]?.count)).toBe(5);
  }, 60_000);

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
  }, 60_000);

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
  }, 60_000);

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
  }, 60_000);

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
  }, 60_000);

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
    const integrityColumns = await runtime.execute<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'billing_tenant_settings' AND column_name = 'grace_period_days')
          OR (table_name = 'billing_invoices' AND column_name = 'provider_payment_id')
        )
      ORDER BY column_name
    `);
    const capableProviderRows = await runtime.execute<{ count: string }>(`
      SELECT count(*)::text AS count
      FROM billing_payment_providers
      WHERE provider IN ('mock', 'stripe')
        AND capabilities @> '{"coupons":true,"paymentMethods":true,"usageReporting":true,"webhooks":true}'::jsonb
    `);
    const orderedProviderRows = await runtime.execute<{
      display_name: string;
      provider: string;
      sort_order: number;
    }>(`
      SELECT provider, display_name, sort_order
      FROM billing_payment_providers
      ORDER BY sort_order ASC, provider ASC
    `);
    const tenantGuardRows = await runtime.execute<{ trigger_name: string }>(`
      SELECT DISTINCT trigger_name
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND trigger_name IN (
          'billing_customers_tenant_immutable',
          'billing_discounts_tenant_reference',
          'billing_entitlements_tenant_reference',
          'billing_invoices_tenant_immutable',
          'billing_invoices_tenant_reference',
          'billing_payment_methods_tenant_immutable',
          'billing_refunds_tenant_immutable',
          'billing_refunds_tenant_reference',
          'billing_subscriptions_tenant_immutable'
        )
      ORDER BY trigger_name
    `);

    expect(Number(providerRows[0]?.count)).toBe(2);
    expect(Number(priceRows[0]?.count)).toBeGreaterThan(0);
    expect(integrityColumns.map((row) => row.column_name)).toEqual([
      "grace_period_days",
      "provider_payment_id",
    ]);
    expect(Number(capableProviderRows[0]?.count)).toBe(2);
    expect(orderedProviderRows[0]).toEqual({
      display_name: "Stripe",
      provider: "stripe",
      sort_order: 10,
    });
    expect(tenantGuardRows).toHaveLength(9);
  }, 60_000);

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
  }, 60_000);

  it("creates storage and file-management tables", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);

    const rows = await runtime.execute<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'storage_access_grants',
          'storage_audit_events',
          'storage_file_variants',
          'storage_files',
          'storage_providers',
          'storage_upload_intents',
          'storage_usage_records'
        )
      ORDER BY table_name
    `);

    expect(rows.map((row) => row.table_name)).toEqual([
      "storage_access_grants",
      "storage_audit_events",
      "storage_file_variants",
      "storage_files",
      "storage_providers",
      "storage_upload_intents",
      "storage_usage_records",
    ]);
  }, 60_000);

  it("creates email, notification, preference, and delivery-log tables", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);

    const rows = await runtime.execute<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'in_app_notifications',
          'message_deliveries',
          'messaging_audit_events',
          'notification_preferences'
        )
      ORDER BY table_name
    `);

    expect(rows.map((row) => row.table_name)).toEqual([
      "in_app_notifications",
      "message_deliveries",
      "messaging_audit_events",
      "notification_preferences",
    ]);
  }, 60_000);

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
  }, 60_000);

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
  }, 60_000);

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
  }, 60_000);

  it("creates observability and uptime-monitoring tables", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);

    const rows = await runtime.execute<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'observability_logs',
          'observability_metric_points',
          'observability_spans',
          'uptime_check_results',
          'uptime_monitors'
        )
      ORDER BY table_name
    `);

    expect(rows.map((row) => row.table_name)).toEqual([
      "observability_logs",
      "observability_metric_points",
      "observability_spans",
      "uptime_check_results",
      "uptime_monitors",
    ]);
  }, 60_000);

  it("creates security, privacy, and legal-acceptance tables", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);

    const rows = await runtime.execute<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'legal_acceptances',
          'privacy_requests',
          'security_audit_events'
        )
      ORDER BY table_name
    `);

    expect(rows.map((row) => row.table_name)).toEqual([
      "legal_acceptances",
      "privacy_requests",
      "security_audit_events",
    ]);

    const passkeyColumns = await runtime.execute<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'auth_passkeys'
        AND column_name = 'user_verified'
    `);

    expect(passkeyColumns).toEqual([{ column_name: "user_verified" }]);

    await resetContentDatabase();

    const legalPages = await runtime.execute<{
      locale: string;
      slug: string;
    }>(`
      SELECT locale, slug
      FROM managed_pages
      WHERE kind = 'legal'
        AND slug IN ('privacy', 'terms')
      ORDER BY locale, slug
    `);

    expect(legalPages).toEqual([
      { locale: "ar", slug: "privacy" },
      { locale: "ar", slug: "terms" },
      { locale: "en", slug: "privacy" },
      { locale: "en", slug: "terms" },
    ]);
  }, 60_000);
});
