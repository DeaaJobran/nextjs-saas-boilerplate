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

async function lockServiceFoundationTables(client: Queryable) {
  await client.execute(`
    LOCK TABLE
      ${serviceFoundationTables.join(",\n      ")}
    IN EXCLUSIVE MODE
  `);
}

export async function resetDatabaseData() {
  const runtime = await getDatabaseRuntime();

  await runMigrations(runtime);
  await runtime.transaction(async (transaction) => {
    await lockServiceFoundationTables(transaction);

    for (const tableName of serviceFoundationTables) {
      await transaction.execute(`DELETE FROM ${tableName}`);
    }
  });

  await resetContentDatabase();
}
