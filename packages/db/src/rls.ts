import {
  type DatabaseRuntime,
  getDatabaseRuntime,
  type Queryable,
} from "./client";
import { runMigrations } from "./migrations";
import { createTenantScope } from "./query-helpers";

export const tenantRlsPolicyName = "tenant_isolation";
export const tenantRlsContextSetting = "app.current_tenant_id";

export type TenantRlsTable = {
  schema: string;
  table: string;
};

function quoteIdentifier(identifier: string) {
  if (!/^[a-z_][a-z0-9_]*$/u.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

function assertPostgresRuntime(runtime: DatabaseRuntime) {
  if (runtime.dialect === "sqlite") {
    throw new Error("PostgreSQL row-level security is unavailable on SQLite.");
  }
}

export async function listTenantRlsTables(
  client: Queryable,
): Promise<TenantRlsTable[]> {
  const rows = await client.execute<{
    schemaname: string;
    tablename: string;
  }>(
    `
      SELECT DISTINCT schemaname, tablename
      FROM pg_policies
      WHERE policyname = $1
      ORDER BY schemaname, tablename
    `,
    [tenantRlsPolicyName],
  );

  return rows.map((row) => ({
    schema: row.schemaname,
    table: row.tablename,
  }));
}

export async function configureTenantRowLevelSecurity(
  options: {
    enabled: boolean;
    forceForTableOwner?: boolean;
  },
  runtime?: DatabaseRuntime,
) {
  const database = runtime ?? (await getDatabaseRuntime());

  assertPostgresRuntime(database);
  await runMigrations(database);

  const tables = await listTenantRlsTables(database);

  await database.transaction(async (transaction) => {
    for (const table of tables) {
      const qualifiedTable = `${quoteIdentifier(table.schema)}.${quoteIdentifier(table.table)}`;

      if (options.enabled) {
        await transaction.execute(
          `ALTER TABLE ${qualifiedTable} ENABLE ROW LEVEL SECURITY`,
        );
        await transaction.execute(
          `ALTER TABLE ${qualifiedTable} ${
            options.forceForTableOwner ? "FORCE" : "NO FORCE"
          } ROW LEVEL SECURITY`,
        );
      } else {
        await transaction.execute(
          `ALTER TABLE ${qualifiedTable} NO FORCE ROW LEVEL SECURITY`,
        );
        await transaction.execute(
          `ALTER TABLE ${qualifiedTable} DISABLE ROW LEVEL SECURITY`,
        );
      }
    }
  });

  return tables;
}

export async function setTenantRlsContext(client: Queryable, tenantId: string) {
  const scope = createTenantScope({ tenantId });

  await client.execute("SELECT set_config($1, $2, true)", [
    tenantRlsContextSetting,
    scope.tenantId,
  ]);

  return scope;
}

export async function withTenantRlsTransaction<T>(
  tenantId: string,
  callback: (client: Queryable) => Promise<T>,
  runtime?: DatabaseRuntime,
) {
  const database = runtime ?? (await getDatabaseRuntime());

  assertPostgresRuntime(database);

  return database.transaction(async (transaction) => {
    await setTenantRlsContext(transaction, tenantId);
    return callback(transaction);
  });
}
