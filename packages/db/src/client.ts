import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  PGlite,
  type PGliteInterface,
  type Transaction,
} from "@electric-sql/pglite";
import postgres from "postgres";

type QueryResult<T> = {
  rows: T[];
};

export type Queryable = {
  execute<T = Record<string, unknown>>(
    query: string,
    params?: unknown[],
  ): Promise<T[]>;
};

export type DatabaseRuntime = Queryable & {
  close(): Promise<void>;
  dialect: "pglite" | "postgres";
  transaction<T>(callback: (client: Queryable) => Promise<T>): Promise<T>;
};

let databaseRuntime: Promise<DatabaseRuntime> | undefined;

type PgliteExecutor = Pick<PGliteInterface, "exec" | "query"> | Transaction;

function normalizeParams(params: unknown[] = []) {
  return params.map((param) => (param === undefined ? null : param));
}

async function executePgliteQuery<T>(
  client: PgliteExecutor,
  query: string,
  params: unknown[] = [],
) {
  const normalizedParams = normalizeParams(params);

  if (normalizedParams.length === 0) {
    const results = (await client.exec(query)) as unknown as QueryResult<T>[];

    return results.at(-1)?.rows ?? [];
  }

  const result = (await client.query(
    query,
    normalizedParams,
  )) as QueryResult<T>;

  return result.rows;
}

function getPgliteDataDir() {
  const configured = process.env.PGLITE_DATA_DIR;

  if (configured) {
    return configured;
  }

  return path.join(process.cwd(), ".local", "pglite");
}

function createPostgresRuntime(databaseUrl: string): DatabaseRuntime {
  const sql = postgres(databaseUrl, {
    max: 5,
    prepare: false,
  });

  return {
    dialect: "postgres",
    async close() {
      await sql.end({ timeout: 5 });
    },
    async execute<T = Record<string, unknown>>(query: string, params = []) {
      return sql.unsafe(query, normalizeParams(params) as never[]) as Promise<
        T[]
      >;
    },
    async transaction<T>(callback: (client: Queryable) => Promise<T>) {
      const result = await sql.begin(async (transaction) =>
        callback({
          async execute<TData = Record<string, unknown>>(
            query: string,
            params = [],
          ) {
            return transaction.unsafe(
              query,
              normalizeParams(params) as never[],
            ) as Promise<TData[]>;
          },
        }),
      );

      return result as T;
    },
  };
}

async function createPgliteRuntime(): Promise<DatabaseRuntime> {
  const dataDir = getPgliteDataDir();

  if (!dataDir.includes("://")) {
    await mkdir(dataDir, { recursive: true });
  }

  const client = new PGlite(dataDir);

  return {
    dialect: "pglite",
    async close() {
      await client.close();
    },
    async execute<T = Record<string, unknown>>(query: string, params = []) {
      return executePgliteQuery<T>(client, query, params);
    },
    async transaction<T>(callback: (client: Queryable) => Promise<T>) {
      return client.transaction((transaction) =>
        callback({
          async execute<TData = Record<string, unknown>>(
            query: string,
            params = [],
          ) {
            return executePgliteQuery<TData>(transaction, query, params);
          },
        }),
      );
    },
  };
}

export async function getDatabaseRuntime(): Promise<DatabaseRuntime> {
  databaseRuntime ??= process.env.DATABASE_URL
    ? Promise.resolve(createPostgresRuntime(process.env.DATABASE_URL))
    : createPgliteRuntime();

  return databaseRuntime;
}

export function resetDatabaseRuntimeForTests() {
  databaseRuntime = undefined;
}
