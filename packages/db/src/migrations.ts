import {
  type DatabaseRuntime,
  getDatabaseRuntime,
  type Queryable,
} from "./client";
import { migrationManifest } from "./migration-manifest";

export async function listMigrationFiles() {
  return migrationManifest.map((migration) => migration.id);
}

async function ensureMigrationTable(client: Queryable) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function readAppliedMigrations(client: Queryable) {
  await ensureMigrationTable(client);

  const rows = await client.execute<{ id: string }>(
    "SELECT id FROM schema_migrations ORDER BY id",
  );

  return new Set(rows.map((row) => row.id));
}

function hasTransaction(client: Queryable): client is DatabaseRuntime {
  return (
    "transaction" in client &&
    typeof (client as Partial<DatabaseRuntime>).transaction === "function"
  );
}

export async function runMigrations(client?: Queryable) {
  const runtime = client ?? (await getDatabaseRuntime());
  const appliedMigrations = await readAppliedMigrations(runtime);
  const pendingMigrations = migrationManifest.filter(
    (migration) => !appliedMigrations.has(migration.id),
  );

  if (!hasTransaction(runtime)) {
    for (const migration of pendingMigrations) {
      await runtime.execute(migration.sql);
      await runtime.execute("INSERT INTO schema_migrations (id) VALUES ($1)", [
        migration.id,
      ]);
    }

    return pendingMigrations.map((migration) => migration.id);
  }

  await runtime.transaction(async (transaction) => {
    for (const migration of pendingMigrations) {
      await transaction.execute(migration.sql);
      await transaction.execute(
        "INSERT INTO schema_migrations (id) VALUES ($1)",
        [migration.id],
      );
    }
  });

  return pendingMigrations.map((migration) => migration.id);
}
