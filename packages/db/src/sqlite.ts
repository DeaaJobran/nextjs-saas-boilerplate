import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { drizzle } from "drizzle-orm/sqlite-proxy";

import type { DatabaseRuntime, Queryable } from "./client";
import * as schema from "./sqlite-schema";

type SqliteMethod = "all" | "get" | "run" | "values";

type SqliteInputValue = bigint | null | number | string | Uint8Array;

type SqliteStatement = {
  all(...params: SqliteInputValue[]): unknown[];
  setReturnArrays(enabled: boolean): void;
};

type SqliteDatabase = {
  close(): void;
  exec(sql: string): void;
  prepare(query: string): SqliteStatement;
};

type SqliteModule = {
  DatabaseSync: new (filename: string) => SqliteDatabase;
};

export type SqliteDatabaseRuntime = DatabaseRuntime & {
  dialect: "sqlite";
  executeScript(sql: string): Promise<void>;
  executeValues(query: string, params?: unknown[]): Promise<unknown[][]>;
};

type SqliteTransactionContext = {
  nestedQueue: Promise<void>;
  nextSavepointId: number;
};

export const sqliteMigrationManifest = [
  {
    id: "0001_service_foundation.sql",
    sql: `
      CREATE TABLE IF NOT EXISTS event_log (
        id text PRIMARY KEY,
        tenant_id text,
        event_type text NOT NULL,
        source text NOT NULL,
        subject_type text,
        subject_id text,
        payload text NOT NULL DEFAULT '{}',
        occurred_at text NOT NULL,
        created_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS outbox_events (
        id text PRIMARY KEY,
        tenant_id text,
        event_type text NOT NULL,
        payload text NOT NULL DEFAULT '{}',
        status text NOT NULL,
        attempts integer NOT NULL DEFAULT 0,
        available_at text NOT NULL,
        locked_at text,
        locked_by text,
        last_error text,
        idempotency_key text,
        dispatched_at text,
        created_at text NOT NULL,
        updated_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key text PRIMARY KEY,
        tenant_id text,
        scope text NOT NULL,
        request_hash text NOT NULL,
        response_status integer,
        response_body text,
        locked_until text,
        expires_at text NOT NULL,
        created_at text NOT NULL,
        updated_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id text PRIMARY KEY,
        tenant_id text,
        name text NOT NULL,
        key_prefix text NOT NULL,
        key_hash text NOT NULL,
        scopes text NOT NULL DEFAULT '[]',
        last_used_at text,
        expires_at text,
        revoked_at text,
        created_at text NOT NULL,
        created_by text,
        updated_at text NOT NULL,
        updated_by text,
        deleted_at text,
        deleted_by text
      );

      CREATE TABLE IF NOT EXISTS rate_limit_buckets (
        id text PRIMARY KEY,
        tenant_id text NOT NULL DEFAULT '',
        identifier text NOT NULL,
        scope text NOT NULL,
        window_start text NOT NULL,
        window_seconds integer NOT NULL,
        count integer NOT NULL,
        expires_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS background_jobs (
        id text PRIMARY KEY,
        tenant_id text,
        queue text NOT NULL DEFAULT 'default',
        type text NOT NULL,
        payload text NOT NULL DEFAULT '{}',
        status text NOT NULL,
        priority integer NOT NULL DEFAULT 0,
        attempts integer NOT NULL DEFAULT 0,
        max_attempts integer NOT NULL DEFAULT 3,
        available_at text NOT NULL,
        locked_at text,
        locked_by text,
        last_error text,
        completed_at text,
        created_at text NOT NULL,
        updated_at text NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cron_schedules (
        id text PRIMARY KEY,
        tenant_id text,
        name text NOT NULL,
        job_type text NOT NULL,
        queue text NOT NULL DEFAULT 'default',
        payload text NOT NULL DEFAULT '{}',
        interval_seconds integer NOT NULL,
        enabled integer NOT NULL DEFAULT 1,
        next_run_at text NOT NULL,
        last_run_at text,
        created_at text NOT NULL,
        updated_at text NOT NULL,
        deleted_at text
      );

      CREATE INDEX IF NOT EXISTS service_event_log_tenant_occurred_idx
        ON event_log (tenant_id, occurred_at);
      CREATE INDEX IF NOT EXISTS service_event_log_type_occurred_idx
        ON event_log (event_type, occurred_at);
      CREATE UNIQUE INDEX IF NOT EXISTS service_outbox_events_idempotency_unique
        ON outbox_events (idempotency_key) WHERE idempotency_key IS NOT NULL;
      CREATE INDEX IF NOT EXISTS service_outbox_events_status_available_idx
        ON outbox_events (status, available_at);
      CREATE INDEX IF NOT EXISTS service_idempotency_keys_tenant_scope_idx
        ON idempotency_keys (tenant_id, scope);
      CREATE INDEX IF NOT EXISTS service_idempotency_keys_expires_idx
        ON idempotency_keys (expires_at);
      CREATE UNIQUE INDEX IF NOT EXISTS service_api_keys_hash_unique
        ON api_keys (key_hash);
      CREATE INDEX IF NOT EXISTS service_api_keys_tenant_active_idx
        ON api_keys (tenant_id, deleted_at);
      CREATE UNIQUE INDEX IF NOT EXISTS service_rate_limit_buckets_window_unique
        ON rate_limit_buckets (tenant_id, identifier, scope, window_start);
      CREATE INDEX IF NOT EXISTS service_rate_limit_buckets_expires_idx
        ON rate_limit_buckets (expires_at);
      CREATE INDEX IF NOT EXISTS service_background_jobs_claim_idx
        ON background_jobs (queue, status, available_at, priority);
      CREATE INDEX IF NOT EXISTS service_background_jobs_tenant_status_idx
        ON background_jobs (tenant_id, status);
      CREATE INDEX IF NOT EXISTS service_cron_schedules_due_idx
        ON cron_schedules (enabled, next_run_at, deleted_at);
    `,
  },
] as const;

function normalizeSqliteParams(params: unknown[]): SqliteInputValue[] {
  return params.map((param) => {
    if (param === undefined || param === null) {
      return null;
    }

    if (param instanceof Date) {
      return param.toISOString();
    }

    if (typeof param === "boolean") {
      return param ? 1 : 0;
    }

    if (
      typeof param === "string" ||
      typeof param === "number" ||
      typeof param === "bigint" ||
      Buffer.isBuffer(param)
    ) {
      return param;
    }

    return JSON.stringify(param);
  });
}

function convertPostgresPlaceholders(query: string) {
  let converted = "";
  let index = 0;
  let state:
    | "block-comment"
    | "bracket-identifier"
    | "double-quote"
    | "line-comment"
    | "single-quote"
    | "sql"
    | "tick-identifier" = "sql";
  let blockCommentDepth = 0;

  while (index < query.length) {
    const character = query[index]!;
    const nextCharacter = query[index + 1];

    if (state === "line-comment") {
      converted += character;
      index += 1;

      if (character === "\n" || character === "\r") {
        state = "sql";
      }

      continue;
    }

    if (state === "block-comment") {
      if (character === "/" && nextCharacter === "*") {
        converted += "/*";
        blockCommentDepth += 1;
        index += 2;
        continue;
      }

      if (character === "*" && nextCharacter === "/") {
        converted += "*/";
        blockCommentDepth -= 1;
        index += 2;

        if (blockCommentDepth === 0) {
          state = "sql";
        }

        continue;
      }

      converted += character;
      index += 1;
      continue;
    }

    if (state !== "sql") {
      converted += character;
      index += 1;

      const closingCharacter =
        state === "single-quote"
          ? "'"
          : state === "double-quote"
            ? '"'
            : state === "tick-identifier"
              ? "`"
              : "]";

      if (character === closingCharacter) {
        if (nextCharacter === closingCharacter) {
          converted += nextCharacter;
          index += 1;
        } else {
          state = "sql";
        }
      }

      continue;
    }

    if (character === "-" && nextCharacter === "-") {
      converted += "--";
      state = "line-comment";
      index += 2;
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      converted += "/*";
      blockCommentDepth = 1;
      state = "block-comment";
      index += 2;
      continue;
    }

    const quotedState =
      character === "'"
        ? "single-quote"
        : character === '"'
          ? "double-quote"
          : character === "`"
            ? "tick-identifier"
            : character === "["
              ? "bracket-identifier"
              : undefined;

    if (quotedState) {
      converted += character;
      state = quotedState;
      index += 1;
      continue;
    }

    if (character === "$" && /\d/.test(nextCharacter ?? "")) {
      let parameterEnd = index + 2;

      while (/\d/.test(query[parameterEnd] ?? "")) {
        parameterEnd += 1;
      }

      converted += `?${query.slice(index + 1, parameterEnd)}`;
      index = parameterEnd;
      continue;
    }

    converted += character;
    index += 1;
  }

  return converted;
}

function prepareStatement(database: SqliteDatabase, query: string) {
  return database.prepare(convertPostgresPlaceholders(query));
}

function executeStatement<T>(
  statement: SqliteStatement,
  params: SqliteInputValue[],
): T[] {
  return statement.all(...params) as T[];
}

function executeValuesStatement(
  statement: SqliteStatement,
  params: SqliteInputValue[],
) {
  assertSqliteArrayResultsSupported();

  statement.setReturnArrays(true);
  return statement.all(...params) as unknown as unknown[][];
}

function assertSqliteArrayResultsSupported() {
  const nodeMajorVersion = Number(process.versions.node.split(".")[0]);

  if (nodeMajorVersion < 24) {
    throw new Error(
      "The SQLite Drizzle adapter requires Node.js 24 or newer for lossless array-shaped query results.",
    );
  }
}

async function ensureSqliteParentDirectory(filename: string) {
  if (filename === ":memory:" || filename.startsWith("file:")) {
    return;
  }

  await mkdir(path.dirname(path.resolve(filename)), { recursive: true });
}

async function loadSqliteModule() {
  const sqliteModuleSpecifier = "node:" + "sqlite";

  return (await import(sqliteModuleSpecifier)) as SqliteModule;
}

export async function createSqliteRuntime(
  filename = ":memory:",
): Promise<SqliteDatabaseRuntime> {
  await ensureSqliteParentDirectory(filename);

  const { DatabaseSync } = await loadSqliteModule();
  const database = new DatabaseSync(filename);
  let closed = false;
  let operationQueue = Promise.resolve();
  const transactionStorage = new AsyncLocalStorage<SqliteTransactionContext>();

  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");

  if (filename !== ":memory:") {
    database.exec("PRAGMA journal_mode = WAL");
  }

  function queueOperation<T>(operation: () => Promise<T> | T) {
    const result = operationQueue.then(operation);

    operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  function runOperation<T>(operation: () => Promise<T> | T) {
    return transactionStorage.getStore()
      ? Promise.resolve().then(operation)
      : queueOperation(operation);
  }

  function queueNestedTransaction<T>(
    parentContext: SqliteTransactionContext,
    callback: (client: Queryable) => Promise<T>,
  ) {
    const savepoint = `nextjs_saas_${parentContext.nextSavepointId++}`;
    const result = parentContext.nestedQueue.then(async () => {
      const context: SqliteTransactionContext = {
        nestedQueue: Promise.resolve(),
        nextSavepointId: 0,
      };

      database.exec(`SAVEPOINT ${savepoint}`);

      try {
        const value = await transactionStorage.run(context, () =>
          callback(runtime),
        );

        await context.nestedQueue;
        database.exec(`RELEASE SAVEPOINT ${savepoint}`);
        return value;
      } catch (error) {
        await context.nestedQueue;
        database.exec(
          `ROLLBACK TO SAVEPOINT ${savepoint}; RELEASE SAVEPOINT ${savepoint}`,
        );
        throw error;
      }
    });

    parentContext.nestedQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  const runtime: SqliteDatabaseRuntime = {
    dialect: "sqlite",
    async close() {
      if (transactionStorage.getStore()) {
        throw new Error("Cannot close SQLite from inside a transaction.");
      }

      await queueOperation(() => {
        if (!closed) {
          database.close();
          closed = true;
        }
      });
    },
    async execute<T = Record<string, unknown>>(query: string, params = []) {
      return runOperation(() =>
        executeStatement<T>(
          prepareStatement(database, query),
          normalizeSqliteParams(params),
        ),
      );
    },
    async executeScript(sql: string) {
      await runOperation(() => database.exec(sql));
    },
    async executeValues(query: string, params = []) {
      return runOperation(() =>
        executeValuesStatement(
          prepareStatement(database, query),
          normalizeSqliteParams(params),
        ),
      );
    },
    async transaction<T>(callback: (client: Queryable) => Promise<T>) {
      const parentContext = transactionStorage.getStore();

      if (parentContext) {
        return queueNestedTransaction(parentContext, callback);
      }

      return queueOperation(async () => {
        const context: SqliteTransactionContext = {
          nestedQueue: Promise.resolve(),
          nextSavepointId: 0,
        };

        database.exec("BEGIN IMMEDIATE");

        try {
          const result = await transactionStorage.run(context, () =>
            callback(runtime),
          );

          await context.nestedQueue;
          database.exec("COMMIT");
          return result;
        } catch (error) {
          await context.nestedQueue;
          database.exec("ROLLBACK");
          throw error;
        }
      });
    },
  };

  return runtime;
}

export function createSqliteDrizzleDatabase(runtime: SqliteDatabaseRuntime) {
  assertSqliteArrayResultsSupported();

  return drizzle(
    async (query, params, method: SqliteMethod) => {
      const valueRows = await runtime.executeValues(query, params);

      if (method === "get") {
        return { rows: valueRows[0] };
      }

      return { rows: method === "run" ? [] : valueRows };
    },
    { schema },
  );
}

export async function runSqliteMigrations(runtime: SqliteDatabaseRuntime) {
  return runtime.transaction(async (transaction) => {
    await transaction.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        applied_at text NOT NULL
      )
    `);

    const appliedRows = await transaction.execute<{ id: string }>(
      "SELECT id FROM schema_migrations ORDER BY id",
    );
    const applied = new Set(appliedRows.map((row) => row.id));
    const pending = sqliteMigrationManifest.filter(
      (migration) => !applied.has(migration.id),
    );

    for (const migration of pending) {
      await runtime.executeScript(migration.sql);
      await transaction.execute(
        "INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)",
        [migration.id, new Date().toISOString()],
      );
    }

    return pending.map((migration) => migration.id);
  });
}

const sqliteFoundationTables = [
  "background_jobs",
  "cron_schedules",
  "outbox_events",
  "event_log",
  "idempotency_keys",
  "api_keys",
  "rate_limit_buckets",
] as const;

export async function resetSqliteFoundation(runtime: SqliteDatabaseRuntime) {
  await runSqliteMigrations(runtime);

  await runtime.transaction(async (transaction) => {
    for (const table of sqliteFoundationTables) {
      await transaction.execute(`DELETE FROM ${table}`);
    }
  });
}
