import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  getDatabaseRuntime,
  type Queryable,
  resetDatabaseRuntimeForTests,
  runMigrations,
} from "@nextjs-saas/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createObservabilitySchedules,
  createObservabilityService,
  observeJobHandlers,
} from "./service";

const fixedNow = new Date("2026-08-01T12:00:00.000Z");
let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "nextjs-saas-observability-"));
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATA_DIR = dataDir;
  resetDatabaseRuntimeForTests();
  await runMigrations(await getDatabaseRuntime());
}, 60_000);

afterEach(async () => {
  const runtime = await getDatabaseRuntime();
  await runtime.close();
  resetDatabaseRuntimeForTests();
  delete process.env.PGLITE_DATA_DIR;
  await rm(dataDir, {
    force: true,
    maxRetries: 10,
    recursive: true,
    retryDelay: 100,
  });
}, 60_000);

describe("observability service", () => {
  it("uses the configured uptime interval for its worker schedule", () => {
    expect(createObservabilitySchedules(15)[0].intervalSeconds).toBe(15);
    expect(() => createObservabilitySchedules(0)).toThrow(
      "Uptime schedule interval must be a positive integer.",
    );
  });

  it("persists correlated logs, metrics, spans, and operational summaries", async () => {
    const service = createObservabilityService({
      console: false,
      now: () => fixedNow,
      serviceName: "test-service",
    });

    await service.logger.info("Request completed", {
      attributes: { authorization: "secret", statusCode: 200 },
      category: "api",
      requestId: "request-1",
    });
    await service.recordMetric({
      kind: "counter",
      name: "api.requests",
      value: 1,
    });
    await service.withSpan({
      attributes: { "request.id": "request-1" },
      name: "api request",
      task: async () => "ok",
    });

    const health = await service.runHealthChecks();
    const summary = await service.getOperationalSummary();

    expect(health.status).toBe("healthy");
    expect(summary.logCounts.info).toBe(1);
    expect(summary.recentLogs[0]).toMatchObject({
      attributes: { authorization: "[REDACTED]", statusCode: 200 },
      requestId: "request-1",
    });
    expect(summary.recentMetrics[0]).toMatchObject({
      name: "api.requests",
      value: 1,
    });
    expect(summary.recentSpans[0]).toMatchObject({
      name: "api request",
      status: "ok",
    });
  }, 60_000);

  it("initializes the database schema once per service instance", async () => {
    const runtime = await getDatabaseRuntime();
    let migrationTransactions = 0;
    const client = {
      execute: runtime.execute.bind(runtime),
      transaction: async <T>(task: (transaction: Queryable) => Promise<T>) => {
        migrationTransactions += 1;
        return runtime.transaction(task);
      },
    };
    const service = createObservabilityService({
      client,
      console: false,
      now: () => fixedNow,
    });

    await service.logger.info("first");
    await service.recordMetric({ name: "test.duration", value: 1 });
    await service.runHealthChecks();

    expect(migrationTransactions).toBe(1);
  }, 60_000);

  it("resolves a span tenant from the completed task result", async () => {
    const runtime = await getDatabaseRuntime();
    await runtime.execute(
      `
        INSERT INTO organizations (
          id, slug, name, status, default_locale, created_at, updated_at
        )
        VALUES ($1, $2, $3, 'active', 'en', $4, $4)
      `,
      ["tenant-span", "tenant-span", "Span tenant", fixedNow.toISOString()],
    );
    const service = createObservabilityService({
      console: false,
      now: () => fixedNow,
    });

    await service.withSpan({
      name: "tenant-aware operation",
      task: () => ({ tenantId: "tenant-span" }),
      tenantId: (result) => result?.tenantId,
    });

    const rows = await runtime.execute<{ tenant_id: string | null }>(
      "SELECT tenant_id FROM observability_spans WHERE name = $1",
      ["tenant-aware operation"],
    );
    expect(rows[0]?.tenant_id).toBe("tenant-span");
  }, 60_000);

  it("checks due uptime monitors and records up and down states", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    const service = createObservabilityService({
      console: false,
      fetch: request,
      now: () => fixedNow,
    });
    await service.upsertUptimeMonitor({
      name: "Health",
      url: "https://example.test/api/v1/health",
    });

    expect(await service.runDueUptimeChecks()).toBe(1);
    await service.upsertUptimeMonitor({
      name: "Health",
      url: "https://example.test/api/v1/health",
    });
    const runtime = await getDatabaseRuntime();
    await runtime.execute("UPDATE uptime_monitors SET next_check_at = $1", [
      fixedNow.toISOString(),
    ]);
    expect(await service.runDueUptimeChecks()).toBe(1);

    const results = await runtime.execute<{ status: string }>(
      "SELECT status FROM uptime_check_results ORDER BY checked_at, id",
    );
    expect(results.map((result) => result.status).sort()).toEqual([
      "down",
      "up",
    ]);
  }, 60_000);

  it("atomically claims monitors before running network checks", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const request = vi.fn<typeof fetch>(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    const service = createObservabilityService({
      console: false,
      fetch: request,
      now: () => fixedNow,
    });
    await service.upsertUptimeMonitor({
      intervalSeconds: 10,
      name: "Concurrent health",
      timeoutMs: 1_000,
      url: "https://example.test/api/v1/health",
    });

    const firstRun = service.runDueUptimeChecks();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    await expect(service.runDueUptimeChecks()).resolves.toBe(0);
    resolveResponse?.(new Response(null, { status: 200 }));
    await expect(firstRun).resolves.toBe(1);
  }, 60_000);

  it("bounds each concurrent uptime claim batch", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const service = createObservabilityService({
      console: false,
      fetch: request,
      now: () => fixedNow,
    });
    for (let index = 0; index < 6; index += 1) {
      await service.upsertUptimeMonitor({
        name: `Health ${index}`,
        url: `https://example.test/api/v1/health/${index}`,
      });
    }

    await expect(service.runDueUptimeChecks()).resolves.toBe(5);
    expect(request).toHaveBeenCalledTimes(5);
    await expect(service.runDueUptimeChecks()).resolves.toBe(1);
    expect(request).toHaveBeenCalledTimes(6);

    for (let index = 6; index < 12; index += 1) {
      await service.upsertUptimeMonitor({
        name: `Health ${index}`,
        url: `https://example.test/api/v1/health/${index}`,
      });
    }
    await expect(service.runAllDueUptimeChecks()).resolves.toBe(6);
    expect(request).toHaveBeenCalledTimes(12);
  }, 60_000);

  it("redacts persisted uptime failure details", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValue(
        new Error("Bearer uptime-token password=uptime-secret"),
      );
    const service = createObservabilityService({
      console: false,
      fetch: request,
      now: () => fixedNow,
    });
    await service.upsertUptimeMonitor({
      name: "Redacted health",
      url: "https://example.test/api/v1/health",
    });

    await service.runDueUptimeChecks();

    const runtime = await getDatabaseRuntime();
    const results = await runtime.execute<{
      error: string | null;
      last_error: string | null;
    }>(`
      SELECT result.error, monitor.last_error
      FROM uptime_check_results AS result
      JOIN uptime_monitors AS monitor ON monitor.id = result.monitor_id
    `);
    expect(JSON.stringify(results)).not.toMatch(/uptime-token|uptime-secret/);
    expect(results[0]).toMatchObject({
      error: "Bearer [REDACTED] password=[REDACTED]",
      last_error: "Bearer [REDACTED] password=[REDACTED]",
    });
  }, 60_000);

  it("observes job completion and failure without swallowing errors", async () => {
    const logger = { error: vi.fn(), info: vi.fn() };
    const service = {
      logger,
      withSpan: vi.fn(async ({ task }: { task: () => Promise<void> }) =>
        task(),
      ),
    };
    const handlers = observeJobHandlers(
      {
        fail: async () => {
          throw new Error("failed");
        },
        pass: async () => {},
      },
      service as never,
    );
    const job = {
      id: "job-1",
      payload: {},
      type: "pass",
    };

    await handlers.pass!(job);
    await expect(handlers.fail!({ ...job, type: "fail" })).rejects.toThrow(
      "failed",
    );
    expect(logger.info).toHaveBeenCalledWith(
      "Background job completed",
      expect.objectContaining({ jobId: "job-1" }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Background job failed",
      expect.objectContaining({ jobId: "job-1" }),
    );
  });
});
