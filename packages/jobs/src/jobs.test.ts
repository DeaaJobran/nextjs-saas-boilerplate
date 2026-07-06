import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  getDatabaseRuntime,
  resetDatabaseRuntimeForTests,
} from "@nextjs-saas/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  claimNextJob,
  completeJob,
  enqueueJob,
  failJob,
  materializeDueCronJobs,
  registerCronSchedule,
  runWorkerOnce,
} from "./index";

let dataDir: string;
const databaseTestTimeoutMs = 20_000;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "nextjs-saas-jobs-"));
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATA_DIR = dataDir;
  resetDatabaseRuntimeForTests();
});

afterEach(async () => {
  const runtime = await getDatabaseRuntime();

  await runtime.close();
  resetDatabaseRuntimeForTests();
  delete process.env.PGLITE_DATA_DIR;
  await rm(dataDir, { force: true, recursive: true });
});

describe("jobs", () => {
  it(
    "enqueues, claims, and completes a background job",
    async () => {
      const jobId = await enqueueJob({
        payload: { name: "Ada" },
        priority: 10,
        tenantId: "tenant_1",
        type: "send-email",
      });

      const claimedJob = await claimNextJob({ workerId: "test-worker" });

      expect(claimedJob).toMatchObject({
        attempts: 1,
        id: jobId,
        lockedBy: "test-worker",
        payload: { name: "Ada" },
        status: "running",
        tenantId: "tenant_1",
        type: "send-email",
      });

      await completeJob(jobId);

      const runtime = await getDatabaseRuntime();
      const [row] = await runtime.execute<{
        completed_at: string | null;
        status: string;
      }>("SELECT status, completed_at FROM background_jobs WHERE id = $1", [
        jobId,
      ]);

      expect(row).toMatchObject({
        status: "completed",
      });
      expect(row?.completed_at).toBeTruthy();
    },
    databaseTestTimeoutMs,
  );

  it(
    "requeues failed jobs until attempts are exhausted",
    async () => {
      const jobId = await enqueueJob({
        maxAttempts: 1,
        type: "sync-report",
      });

      const claimedJob = await claimNextJob();

      expect(claimedJob?.id).toBe(jobId);

      await failJob(jobId, new Error("provider unavailable"));

      const runtime = await getDatabaseRuntime();
      const [row] = await runtime.execute<{
        last_error: string | null;
        status: string;
      }>("SELECT status, last_error FROM background_jobs WHERE id = $1", [
        jobId,
      ]);

      expect(row).toEqual({
        last_error: "provider unavailable",
        status: "failed",
      });
    },
    databaseTestTimeoutMs,
  );

  it(
    "materializes due cron schedules into jobs",
    async () => {
      const now = new Date("2026-07-06T10:00:00.000Z");

      await registerCronSchedule({
        intervalSeconds: 60,
        jobType: "rollup-metrics",
        name: "Tenant metrics",
        nextRunAt: now,
        payload: { tenantId: "tenant_1" },
        tenantId: "tenant_1",
      });

      const jobIds = await materializeDueCronJobs(now);

      expect(jobIds).toHaveLength(1);

      const claimedJob = await claimNextJob({
        now: new Date("2026-07-06T10:01:00.000Z"),
      });

      expect(claimedJob).toMatchObject({
        id: jobIds[0],
        payload: { tenantId: "tenant_1" },
        tenantId: "tenant_1",
        type: "rollup-metrics",
      });
    },
    databaseTestTimeoutMs,
  );

  it(
    "preserves an existing cron next run when re-registering without an explicit next run",
    async () => {
      const firstRunAt = new Date("2026-07-06T10:10:00.000Z");

      await registerCronSchedule({
        id: "metrics-rollup",
        intervalSeconds: 60,
        jobType: "rollup-metrics",
        name: "Tenant metrics",
        nextRunAt: firstRunAt,
        payload: { version: 1 },
      });

      await registerCronSchedule({
        id: "metrics-rollup",
        intervalSeconds: 120,
        jobType: "rollup-metrics",
        name: "Tenant metrics",
        payload: { version: 2 },
      });

      await expect(
        materializeDueCronJobs(new Date("2026-07-06T10:00:00.000Z")),
      ).resolves.toEqual([]);

      const jobIds = await materializeDueCronJobs(firstRunAt);

      expect(jobIds).toHaveLength(1);
    },
    databaseTestTimeoutMs,
  );

  it(
    "reclaims stale running jobs after a worker crash",
    async () => {
      const startedAt = new Date("2026-07-06T10:00:00.000Z");
      const reclaimAt = new Date("2026-07-06T10:02:00.000Z");
      const jobId = await enqueueJob({
        availableAt: startedAt,
        maxAttempts: 3,
        type: "sync-report",
      });

      await expect(
        claimNextJob({
          now: startedAt,
          workerId: "crashed-worker",
        }),
      ).resolves.toMatchObject({
        attempts: 1,
        id: jobId,
        lockedBy: "crashed-worker",
      });

      await expect(
        claimNextJob({
          now: reclaimAt,
          staleAfterSeconds: 60,
          workerId: "replacement-worker",
        }),
      ).resolves.toMatchObject({
        attempts: 2,
        id: jobId,
        lockedBy: "replacement-worker",
        status: "running",
      });
    },
    databaseTestTimeoutMs,
  );

  it(
    "fails stale running jobs when no retry attempts remain",
    async () => {
      const startedAt = new Date("2026-07-06T10:00:00.000Z");
      const reclaimAt = new Date("2026-07-06T10:02:00.000Z");
      const jobId = await enqueueJob({
        availableAt: startedAt,
        maxAttempts: 1,
        type: "sync-report",
      });

      await claimNextJob({
        now: startedAt,
        workerId: "crashed-worker",
      });

      await expect(
        claimNextJob({
          now: reclaimAt,
          staleAfterSeconds: 60,
          workerId: "replacement-worker",
        }),
      ).resolves.toBeUndefined();

      const runtime = await getDatabaseRuntime();
      const [row] = await runtime.execute<{
        locked_by: string | null;
        status: string;
      }>("SELECT status, locked_by FROM background_jobs WHERE id = $1", [
        jobId,
      ]);

      expect(row).toEqual({
        locked_by: null,
        status: "failed",
      });
    },
    databaseTestTimeoutMs,
  );

  it(
    "runs a registered handler once",
    async () => {
      const handled: string[] = [];

      const jobId = await enqueueJob({
        payload: { invoiceId: "invoice_1" },
        type: "invoice.finalized",
      });

      const job = await runWorkerOnce({
        handlers: {
          "invoice.finalized": (handledJob) => {
            handled.push(String(handledJob.payload.invoiceId));
          },
        },
        workerId: "test-worker",
      });

      expect(job?.id).toBe(jobId);
      expect(handled).toEqual(["invoice_1"]);
    },
    databaseTestTimeoutMs,
  );
});
