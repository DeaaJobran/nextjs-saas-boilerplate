import {
  type DatabaseRuntime,
  getDatabaseRuntime,
  type Queryable,
} from "./client";
import { migrationManifest } from "./migration-manifest";

let migrationQueue = Promise.resolve();

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

async function applyPendingMigrations(client: Queryable) {
  const appliedMigrations = await readAppliedMigrations(client);
  const pendingMigrations = migrationManifest.filter(
    (migration) => !appliedMigrations.has(migration.id),
  );

  for (const migration of pendingMigrations) {
    await client.execute(migration.sql);
    await client.execute(
      "INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING",
      [migration.id],
    );
  }

  return pendingMigrations.map((migration) => migration.id);
}

export async function runMigrations(client?: Queryable) {
  const runtime = client ?? (await getDatabaseRuntime());
  const run = migrationQueue.then(async () => {
    if (!hasTransaction(runtime)) {
      return applyPendingMigrations(runtime);
    }

    return runtime.transaction(async (transaction) => {
      await ensureMigrationTable(transaction);
      await transaction.execute(
        "LOCK TABLE schema_migrations IN EXCLUSIVE MODE",
      );

      return applyPendingMigrations(transaction);
    });
  });

  migrationQueue = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}
