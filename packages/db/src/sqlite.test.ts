import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  createSqliteDrizzleDatabase,
  createSqliteRuntime,
  resetSqliteFoundation,
  runSqliteMigrations,
} from "./sqlite";
import * as sqliteSchema from "./sqlite-schema";

describe("SQLite database foundation", () => {
  it("rewrites bind parameters without changing SQL literals or comments", async () => {
    const runtime = await createSqliteRuntime();

    try {
      await expect(
        runtime.execute<{
          bracket$3: string;
          double$2: string;
          tick$4: string;
          literal: string;
        }>(
          `
            SELECT
              '$1' AS literal,
              $1 AS "double$2",
              $2 AS [bracket$3],
              $3 AS \`tick$4\`
            /* $4 stays inside a block comment */
            -- $5 stays inside a line comment
          `,
          ["double", "bracket", "tick"],
        ),
      ).resolves.toEqual([
        {
          bracket$3: "bracket",
          double$2: "double",
          tick$4: "tick",
          literal: "$1",
        },
      ]);
    } finally {
      await runtime.close();
    }
  });

  it("migrates, persists, queries through Drizzle, transacts, and resets", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "nextjs-saas-sqlite-"),
    );
    const filename = path.join(directory, "foundation.sqlite");
    let runtime = await createSqliteRuntime(filename);

    try {
      await expect(runSqliteMigrations(runtime)).resolves.toEqual([
        "0001_service_foundation.sql",
      ]);
      await expect(runSqliteMigrations(runtime)).resolves.toEqual([]);

      const database = createSqliteDrizzleDatabase(runtime);
      const timestamp = "2026-08-03T12:00:00.000Z";

      await database.insert(sqliteSchema.backgroundJobs).values({
        availableAt: timestamp,
        createdAt: timestamp,
        id: "sqlite-job",
        payload: { invoiceId: "invoice_1" },
        status: "queued",
        tenantId: "tenant_1",
        type: "invoice.finalized",
        updatedAt: timestamp,
      });

      await expect(
        database
          .select()
          .from(sqliteSchema.backgroundJobs)
          .where(eq(sqliteSchema.backgroundJobs.id, "sqlite-job")),
      ).resolves.toEqual([
        expect.objectContaining({
          id: "sqlite-job",
          payload: { invoiceId: "invoice_1" },
          tenantId: "tenant_1",
        }),
      ]);

      await database.insert(sqliteSchema.eventLog).values({
        createdAt: timestamp,
        eventType: "invoice.finalized",
        id: "sqlite-event",
        occurredAt: timestamp,
        source: "vitest",
        tenantId: "tenant_1",
      });

      await expect(
        database
          .select({
            event: { id: sqliteSchema.eventLog.id },
            job: { id: sqliteSchema.backgroundJobs.id },
          })
          .from(sqliteSchema.backgroundJobs)
          .innerJoin(
            sqliteSchema.eventLog,
            eq(
              sqliteSchema.backgroundJobs.tenantId,
              sqliteSchema.eventLog.tenantId,
            ),
          ),
      ).resolves.toEqual([
        {
          event: { id: "sqlite-event" },
          job: { id: "sqlite-job" },
        },
      ]);

      await expect(
        runtime.transaction(async (transaction) => {
          await transaction.execute(
            `
              INSERT INTO event_log (
                id, tenant_id, event_type, source, payload,
                occurred_at, created_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $6)
            `,
            [
              "rolled-back-event",
              "tenant_1",
              "test.rollback",
              "vitest",
              JSON.stringify({ safe: true }),
              timestamp,
            ],
          );
          throw new Error("roll back SQLite transaction");
        }),
      ).rejects.toThrow("roll back SQLite transaction");
      await expect(
        runtime.execute("SELECT id FROM event_log WHERE id = $1", [
          "rolled-back-event",
        ]),
      ).resolves.toEqual([]);

      await runtime.close();
      runtime = await createSqliteRuntime(filename);

      await expect(
        runtime.execute("SELECT id FROM background_jobs WHERE id = $1", [
          "sqlite-job",
        ]),
      ).resolves.toEqual([{ id: "sqlite-job" }]);

      await resetSqliteFoundation(runtime);

      await expect(
        runtime.execute("SELECT id FROM background_jobs"),
      ).resolves.toEqual([]);
    } finally {
      await runtime.close();
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("serializes independent top-level transactions", async () => {
    const runtime = await createSqliteRuntime();
    const timestamp = "2026-08-03T12:00:00.000Z";
    let releaseFirstTransaction: () => void = () => undefined;
    let markFirstTransactionStarted: () => void = () => undefined;
    const firstTransactionStarted = new Promise<void>((resolve) => {
      markFirstTransactionStarted = resolve;
    });
    const firstTransactionCanFinish = new Promise<void>((resolve) => {
      releaseFirstTransaction = resolve;
    });

    try {
      await runSqliteMigrations(runtime);

      const firstResult = runtime
        .transaction(async (transaction) => {
          await transaction.execute(
            `
              INSERT INTO event_log (
                id, event_type, source, occurred_at, created_at
              )
              VALUES ('first-transaction', 'test.first', 'vitest', $1, $1)
            `,
            [timestamp],
          );
          markFirstTransactionStarted();
          await firstTransactionCanFinish;
          throw new Error("roll back first transaction");
        })
        .then(
          () => undefined,
          (error: unknown) => error,
        );

      await firstTransactionStarted;

      const secondResult = runtime.transaction(async (transaction) => {
        await transaction.execute(
          `
            INSERT INTO event_log (
              id, event_type, source, occurred_at, created_at
            )
            VALUES ('second-transaction', 'test.second', 'vitest', $1, $1)
          `,
          [timestamp],
        );
      });

      releaseFirstTransaction();

      await expect(firstResult).resolves.toEqual(expect.any(Error));
      await expect(secondResult).resolves.toBeUndefined();
      await expect(
        runtime.execute<{ id: string }>("SELECT id FROM event_log ORDER BY id"),
      ).resolves.toEqual([{ id: "second-transaction" }]);

      await runtime.transaction(async (transaction) => {
        await transaction.execute(
          `
            INSERT INTO event_log (
              id, event_type, source, occurred_at, created_at
            )
            VALUES ('outer-before', 'test.outer', 'vitest', $1, $1)
          `,
          [timestamp],
        );
        await expect(
          runtime.transaction(async (nestedTransaction) => {
            await nestedTransaction.execute(
              `
                INSERT INTO event_log (
                  id, event_type, source, occurred_at, created_at
                )
                VALUES ('nested-rollback', 'test.nested', 'vitest', $1, $1)
              `,
              [timestamp],
            );
            throw new Error("roll back nested transaction");
          }),
        ).rejects.toThrow("roll back nested transaction");
        await transaction.execute(
          `
            INSERT INTO event_log (
              id, event_type, source, occurred_at, created_at
            )
            VALUES ('outer-after', 'test.outer', 'vitest', $1, $1)
          `,
          [timestamp],
        );
      });

      await expect(
        runtime.execute<{ id: string }>("SELECT id FROM event_log ORDER BY id"),
      ).resolves.toEqual([
        { id: "outer-after" },
        { id: "outer-before" },
        { id: "second-transaction" },
      ]);
    } finally {
      releaseFirstTransaction();
      await runtime.close();
    }
  });
});
