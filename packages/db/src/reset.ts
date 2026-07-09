import { getDatabaseRuntime, type Queryable } from "./client";
import { resetContentDatabase } from "./content-repository";
import { runMigrations } from "./migrations";

const serviceFoundationTables = [
  "background_jobs",
  "cron_schedules",
  "outbox_events",
  "event_log",
  "idempotency_keys",
  "api_keys",
  "rate_limit_buckets",
] as const;

const authIdentityTables = [
  "auth_audit_events",
  "auth_oauth_states",
  "auth_login_attempts",
  "auth_invitations",
  "auth_recovery_codes",
  "auth_mfa_factors",
  "auth_passkeys",
  "auth_challenges",
  "auth_tokens",
  "auth_sessions",
  "auth_accounts",
  "auth_users",
] as const;

const tenantAdminTables = [
  "tenant_audit_events",
  "impersonation_sessions",
  "organization_feature_flags",
  "organization_usage_limits",
  "organization_quotas",
  "organization_invitations",
  "organization_memberships",
  "organizations",
] as const;

const billingRuntimeTables = [
  "billing_audit_events",
  "billing_webhook_events",
  "billing_usage_records",
  "billing_entitlements",
  "billing_refunds",
  "billing_discounts",
  "billing_invoice_items",
  "billing_invoices",
  "billing_payment_methods",
  "billing_subscriptions",
  "billing_checkout_sessions",
  "billing_customers",
  "billing_tax_settings",
  "billing_tenant_settings",
] as const;

const apiRuntimeTables = [
  "mobile_upload_intents",
  "mobile_deep_links",
  "mobile_push_subscriptions",
  "mobile_sessions",
  "mobile_devices",
  "api_webhook_deliveries",
  "api_webhook_endpoints",
  "api_usage_records",
  "api_audit_events",
] as const;

const storageRuntimeTables = [
  "storage_audit_events",
  "storage_usage_records",
  "storage_access_grants",
  "storage_upload_intents",
  "storage_file_variants",
  "storage_files",
  "storage_providers",
] as const;

async function lockServiceFoundationTables(client: Queryable) {
  await client.execute(`
    LOCK TABLE
      ${[
        ...storageRuntimeTables,
        ...apiRuntimeTables,
        ...billingRuntimeTables,
        ...serviceFoundationTables,
        ...tenantAdminTables,
        ...authIdentityTables,
      ].join(",\n      ")}
    IN EXCLUSIVE MODE
  `);
}

export async function resetDatabaseData() {
  const runtime = await getDatabaseRuntime();

  await runMigrations(runtime);
  await runtime.transaction(async (transaction) => {
    await lockServiceFoundationTables(transaction);

    for (const tableName of storageRuntimeTables) {
      await transaction.execute(`DELETE FROM ${tableName}`);
    }

    for (const tableName of apiRuntimeTables) {
      await transaction.execute(`DELETE FROM ${tableName}`);
    }

    for (const tableName of billingRuntimeTables) {
      await transaction.execute(`DELETE FROM ${tableName}`);
    }

    for (const tableName of serviceFoundationTables) {
      await transaction.execute(`DELETE FROM ${tableName}`);
    }

    for (const tableName of tenantAdminTables) {
      await transaction.execute(`DELETE FROM ${tableName}`);
    }

    for (const tableName of authIdentityTables) {
      await transaction.execute(`DELETE FROM ${tableName}`);
    }
  });

  await resetContentDatabase();
}
