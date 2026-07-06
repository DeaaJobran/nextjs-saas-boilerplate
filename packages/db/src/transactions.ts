import { getDatabaseRuntime, type Queryable } from "./client";

export async function withDatabaseTransaction<T>(
  callback: (client: Queryable) => Promise<T>,
) {
  const runtime = await getDatabaseRuntime();

  return runtime.transaction(callback);
}
