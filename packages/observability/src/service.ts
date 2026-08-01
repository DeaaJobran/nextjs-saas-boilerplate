import { randomBytes, randomUUID } from "node:crypto";

import {
  getDatabaseRuntime,
  type Queryable,
  runMigrations,
} from "@nextjs-saas/db";
import { type Attributes, context, trace } from "@opentelemetry/api";

import {
  createConsoleLogTransport,
  createLogger,
  redactLogError,
  redactLogValue,
} from "./logger";
import { getMeter, withOpenTelemetrySpan } from "./telemetry";
import type {
  HealthCheckResult,
  HealthReport,
  LogError,
  LogLevel,
  LogTransport,
  OperationalSummary,
  StructuredLogRecord,
  UptimeMonitor,
} from "./types";

type ObservabilityServiceOptions = {
  client?: Queryable;
  console?: boolean;
  fetch?: typeof fetch;
  now?: () => Date;
  serviceName?: string;
  transports?: LogTransport[];
};

type LogRow = {
  actor_id: string | null;
  attributes: Record<string, unknown> | string;
  category: StructuredLogRecord["category"];
  error: LogError | string | null;
  job_id: string | null;
  level: LogLevel;
  message: string;
  request_id: string | null;
  service: string;
  span_id: string | null;
  tenant_id: string | null;
  timestamp: Date | string;
  trace_id: string | null;
};

type UptimeRow = {
  active: boolean;
  created_at: Date | string;
  expected_status: number;
  id: string;
  interval_seconds: number;
  last_checked_at: Date | string | null;
  last_duration_ms: number | string | null;
  last_error: string | null;
  last_status: "down" | "up" | null;
  method: "GET" | "HEAD";
  name: string;
  next_check_at: Date | string;
  timeout_ms: number;
  updated_at: Date | string;
  url: string;
};

function toIso(value: Date | string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function parseJson<T>(value: T | string | null, fallback: T): T {
  if (value === null) {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toLog(row: LogRow): StructuredLogRecord {
  return {
    actorId: row.actor_id ?? undefined,
    attributes: parseJson(row.attributes, {}),
    category: row.category,
    error: parseJson(row.error, undefined),
    jobId: row.job_id ?? undefined,
    level: row.level,
    message: row.message,
    requestId: row.request_id ?? undefined,
    service: row.service,
    spanId: row.span_id ?? undefined,
    tenantId: row.tenant_id ?? undefined,
    timestamp: toIso(row.timestamp)!,
    traceId: row.trace_id ?? undefined,
  };
}

function toUptimeMonitor(row: UptimeRow): UptimeMonitor {
  return {
    active: row.active,
    createdAt: toIso(row.created_at)!,
    expectedStatus: row.expected_status,
    id: row.id,
    intervalSeconds: row.interval_seconds,
    lastCheckedAt: toIso(row.last_checked_at),
    lastDurationMs:
      row.last_duration_ms === null ? undefined : Number(row.last_duration_ms),
    lastError: row.last_error ?? undefined,
    lastStatus: row.last_status ?? undefined,
    method: row.method,
    name: row.name,
    nextCheckAt: toIso(row.next_check_at)!,
    timeoutMs: row.timeout_ms,
    updatedAt: toIso(row.updated_at)!,
    url: row.url,
  };
}

function randomHex(bytes: number) {
  return randomBytes(bytes).toString("hex");
}

function assertPositiveInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

export const observabilityJobTypes = {
  retention: "observability.retention.cleanup",
  uptime: "observability.uptime.run",
} as const;

const uptimeClaimBatchSize = 5;

export function createObservabilitySchedules(uptimeIntervalSeconds = 60) {
  assertPositiveInteger(uptimeIntervalSeconds, "Uptime schedule interval");

  return [
    {
      id: "observability-uptime-checks",
      intervalSeconds: uptimeIntervalSeconds,
      jobType: observabilityJobTypes.uptime,
      name: "Run due uptime checks",
    },
    {
      id: "observability-retention-cleanup",
      intervalSeconds: 24 * 60 * 60,
      jobType: observabilityJobTypes.retention,
      name: "Clean expired operational telemetry",
      payload: { retentionDays: 30 },
    },
  ] as const;
}

export const observabilitySchedules = createObservabilitySchedules();

export function createObservabilityService(
  options: ObservabilityServiceOptions = {},
) {
  const now = options.now ?? (() => new Date());
  const request = options.fetch ?? fetch;
  const serviceName = options.serviceName ?? "nextjs-saas";
  const meter = getMeter(serviceName);
  const counters = new Map<string, ReturnType<typeof meter.createCounter>>();
  const histograms = new Map<
    string,
    ReturnType<typeof meter.createHistogram>
  >();
  let clientPromise: Promise<Queryable> | undefined;

  function getClient() {
    clientPromise ??= (async () => {
      const client = options.client ?? (await getDatabaseRuntime());
      await runMigrations(client);
      return client;
    })().catch((error: unknown) => {
      clientPromise = undefined;
      throw error;
    });

    return clientPromise;
  }

  async function persistLog(record: StructuredLogRecord) {
    const client = await getClient();
    await client.execute(
      `
        INSERT INTO observability_logs (
          id, tenant_id, actor_id, timestamp, level, category, service,
          message, request_id, job_id, trace_id, span_id, attributes, error
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          $13::jsonb, $14::jsonb
        )
      `,
      [
        randomUUID(),
        record.tenantId ?? null,
        record.actorId ?? null,
        record.timestamp,
        record.level,
        record.category,
        record.service,
        record.message,
        record.requestId ?? null,
        record.jobId ?? null,
        record.traceId ?? null,
        record.spanId ?? null,
        JSON.stringify(record.attributes),
        record.error ? JSON.stringify(record.error) : null,
      ],
    );
  }

  const databaseTransport: LogTransport = {
    id: "database",
    write: persistLog,
  };
  const transports = [
    ...((options.console ?? process.env.NODE_ENV !== "test")
      ? [createConsoleLogTransport()]
      : []),
    databaseTransport,
    ...(options.transports ?? []),
  ];
  const logger = createLogger({ now, service: serviceName, transports });

  async function recordMetric(input: {
    attributes?: Record<string, unknown>;
    kind?: "counter" | "histogram";
    name: string;
    tenantId?: string;
    unit?: string;
    value: number;
  }) {
    if (!Number.isFinite(input.value)) {
      throw new Error("Metric value must be finite.");
    }

    const kind = input.kind ?? "histogram";
    if (kind !== "counter" && kind !== "histogram") {
      throw new Error(`Unsupported metric kind: ${String(kind)}.`);
    }
    const attributes = redactLogValue(input.attributes ?? {}) as Record<
      string,
      unknown
    >;
    const otelAttributes = Object.fromEntries(
      Object.entries(attributes).filter(
        (entry): entry is [string, string | number | boolean] =>
          ["string", "number", "boolean"].includes(typeof entry[1]),
      ),
    );

    if (kind === "counter") {
      const counter =
        counters.get(input.name) ??
        meter.createCounter(input.name, { unit: input.unit });
      counters.set(input.name, counter);
      counter.add(input.value, otelAttributes);
    } else {
      const histogram =
        histograms.get(input.name) ??
        meter.createHistogram(input.name, { unit: input.unit });
      histograms.set(input.name, histogram);
      histogram.record(input.value, otelAttributes);
    }

    const client = await getClient();
    await client.execute(
      `
        INSERT INTO observability_metric_points (
          id, tenant_id, service, name, kind, value,
          unit, attributes, recorded_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      `,
      [
        randomUUID(),
        input.tenantId ?? null,
        serviceName,
        input.name,
        kind,
        input.value,
        input.unit ?? null,
        JSON.stringify(attributes),
        now().toISOString(),
      ],
    );
  }

  async function withSpan<T>(input: {
    attributes?: Attributes;
    name: string;
    task: () => Promise<T> | T;
    tenantId?: string | ((result: T | undefined) => string | undefined);
  }) {
    const parent = trace.getSpan(context.active())?.spanContext();
    const startedAt = now();
    let traceId = parent?.traceId ?? randomHex(16);
    let spanId = randomHex(8);
    let result: T | undefined;
    let failure: unknown;

    try {
      result = await withOpenTelemetrySpan({
        attributes: input.attributes,
        name: input.name,
        service: serviceName,
        task: async () => {
          const active = trace.getSpan(context.active())?.spanContext();
          traceId = active?.traceId ?? traceId;
          spanId = active?.spanId ?? spanId;
          return input.task();
        },
      });
      return result;
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      const endedAt = now();
      try {
        const tenantId =
          typeof input.tenantId === "function"
            ? input.tenantId(result)
            : input.tenantId;
        const client = await getClient();
        await client.execute(
          `
          INSERT INTO observability_spans (
            id, tenant_id, service, trace_id, span_id, parent_span_id,
            name, status, started_at, ended_at, duration_ms, attributes, error
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            $12::jsonb, $13::jsonb
          )
          ON CONFLICT (span_id) DO NOTHING
        `,
          [
            randomUUID(),
            tenantId ?? null,
            serviceName,
            traceId,
            spanId,
            parent?.spanId ?? null,
            input.name,
            failure ? "error" : "ok",
            startedAt.toISOString(),
            endedAt.toISOString(),
            Math.max(0, endedAt.getTime() - startedAt.getTime()),
            JSON.stringify(redactLogValue(input.attributes ?? {})),
            failure ? JSON.stringify(redactLogError(failure)) : null,
          ],
        );
      } catch {
        // Telemetry persistence must never change the observed operation's result.
      }
    }
  }

  async function runHealthChecks(
    checks: Array<{
      critical?: boolean;
      name: string;
      run: () => Promise<void> | void;
    }> = [],
  ): Promise<HealthReport> {
    const allChecks = [
      {
        critical: true,
        name: "database",
        run: async () => {
          const client = await getClient();
          await client.execute("SELECT 1 AS healthy");
        },
      },
      ...checks,
    ];
    const results: HealthCheckResult[] = [];

    for (const check of allChecks) {
      const startedAt = performance.now();
      try {
        await check.run();
        results.push({
          durationMs: performance.now() - startedAt,
          name: check.name,
          status: "healthy",
        });
      } catch (error) {
        results.push({
          durationMs: performance.now() - startedAt,
          message: error instanceof Error ? error.message : "Check failed",
          name: check.name,
          status: check.critical === false ? "degraded" : "unhealthy",
        });
      }
    }

    const status = results.some((result) => result.status === "unhealthy")
      ? "unhealthy"
      : results.some((result) => result.status === "degraded")
        ? "degraded"
        : "healthy";

    return {
      checks: results,
      service: serviceName,
      status,
      timestamp: now().toISOString(),
    };
  }

  function liveness(): HealthReport {
    return {
      checks: [],
      service: serviceName,
      status: "healthy",
      timestamp: now().toISOString(),
    };
  }

  async function upsertUptimeMonitor(input: {
    active?: boolean;
    expectedStatus?: number;
    id?: string;
    intervalSeconds?: number;
    method?: "GET" | "HEAD";
    name: string;
    timeoutMs?: number;
    url: string;
  }) {
    const url = new URL(input.url);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Uptime monitor URL must use HTTP or HTTPS.");
    }

    const intervalSeconds = input.intervalSeconds ?? 60;
    const timeoutMs = input.timeoutMs ?? 10_000;
    assertPositiveInteger(intervalSeconds, "Monitor interval");
    assertPositiveInteger(timeoutMs, "Monitor timeout");
    const timestamp = now().toISOString();
    const client = await getClient();
    const rows = await client.execute<UptimeRow>(
      `
        INSERT INTO uptime_monitors (
          id, name, url, method, expected_status, timeout_ms,
          interval_seconds, active, next_check_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $9)
        ON CONFLICT (url, method) DO UPDATE SET
          name = EXCLUDED.name,
          expected_status = EXCLUDED.expected_status,
          timeout_ms = EXCLUDED.timeout_ms,
          interval_seconds = EXCLUDED.interval_seconds,
          active = EXCLUDED.active,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `,
      [
        input.id ?? randomUUID(),
        input.name,
        url.toString(),
        input.method ?? "GET",
        input.expectedStatus ?? 200,
        timeoutMs,
        intervalSeconds,
        input.active ?? true,
        timestamp,
      ],
    );

    return toUptimeMonitor(rows[0]!);
  }

  async function runDueUptimeChecks(dueBefore = now()) {
    const client = await getClient();
    const claimedAt = now().toISOString();
    const monitors = await client.execute<UptimeRow>(
      `
        WITH due AS (
          SELECT id
          FROM uptime_monitors
          WHERE active = true AND next_check_at <= $3
          ORDER BY next_check_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $2
        )
        UPDATE uptime_monitors AS monitor
        SET
          next_check_at = $1::timestamptz + (
            GREATEST(
              monitor.interval_seconds,
              ((monitor.timeout_ms + 999) / 1000) + 5
            ) * INTERVAL '1 second'
          ),
          updated_at = $1
        FROM due
        WHERE monitor.id = due.id
        RETURNING monitor.*
      `,
      [claimedAt, uptimeClaimBatchSize, dueBefore.toISOString()],
    );

    await Promise.all(
      monitors.map(async (monitor) => {
        const startedAt = performance.now();
        let error: string | undefined;
        let statusCode: number | undefined;

        try {
          const response = await request(monitor.url, {
            method: monitor.method,
            redirect: "manual",
            signal: AbortSignal.timeout(monitor.timeout_ms),
          });
          statusCode = response.status;
          if (response.status !== monitor.expected_status) {
            error = `Expected status ${monitor.expected_status}, received ${response.status}.`;
          }
        } catch (caught) {
          error =
            redactLogError(caught)?.message ?? "Unknown uptime check error.";
        }

        const checkedAt = now();
        const checkedAtIso = checkedAt.toISOString();
        const durationMs = performance.now() - startedAt;
        const status = error ? "down" : "up";
        const nextCheckAt = new Date(
          checkedAt.getTime() + monitor.interval_seconds * 1000,
        ).toISOString();
        const completionRows = await client.execute<{ id: string }>(
          `
            WITH completed AS (
              UPDATE uptime_monitors
              SET last_checked_at = $1, last_status = $2,
                  last_duration_ms = $3, last_error = $4,
                  next_check_at = $5, updated_at = $1
              WHERE id = $6 AND next_check_at = $7
              RETURNING id
            )
            INSERT INTO uptime_check_results (
              id, monitor_id, status, status_code,
              duration_ms, error, checked_at
            )
            SELECT $8, id, $2, $9, $3, $4, $1
            FROM completed
            RETURNING id
          `,
          [
            checkedAtIso,
            status,
            durationMs,
            error ?? null,
            nextCheckAt,
            monitor.id,
            toIso(monitor.next_check_at),
            randomUUID(),
            statusCode ?? null,
          ],
        );

        if (!completionRows.length) {
          return;
        }

        await recordMetric({
          attributes: { monitor: monitor.name, status },
          kind: "histogram",
          name: "uptime.check.duration",
          unit: "ms",
          value: durationMs,
        });
        await logger[error ? "warn" : "info"]("Uptime check completed", {
          attributes: {
            durationMs,
            monitorId: monitor.id,
            status,
            statusCode,
          },
          category: "request",
        });
      }),
    );

    return monitors.length;
  }

  async function runAllDueUptimeChecks() {
    const dueBefore = now();
    let total = 0;
    let batchSize: number;

    do {
      batchSize = await runDueUptimeChecks(dueBefore);
      total += batchSize;
    } while (batchSize === uptimeClaimBatchSize);

    return total;
  }

  async function cleanupTelemetry(retentionDays = 30) {
    assertPositiveInteger(retentionDays, "Telemetry retention days");
    const cutoff = new Date(
      now().getTime() - retentionDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const client = await getClient();

    for (const [table, column] of [
      ["observability_logs", "timestamp"],
      ["observability_metric_points", "recorded_at"],
      ["observability_spans", "ended_at"],
      ["uptime_check_results", "checked_at"],
    ] as const) {
      await client.execute(`DELETE FROM ${table} WHERE ${column} < $1`, [
        cutoff,
      ]);
    }
  }

  async function getOperationalSummary(): Promise<OperationalSummary> {
    const client = await getClient();
    const [logCountRows, logRows, metricRows, spanRows, uptimeRows, auditRows] =
      await Promise.all([
        client.execute<{ count: number | string; level: LogLevel }>(
          "SELECT level, count(*) AS count FROM observability_logs GROUP BY level",
        ),
        client.execute<LogRow>(
          "SELECT * FROM observability_logs ORDER BY timestamp DESC LIMIT 50",
        ),
        client.execute<{
          attributes: Record<string, unknown> | string;
          name: string;
          recorded_at: Date | string;
          unit: string | null;
          value: number | string;
        }>(
          "SELECT name, value, unit, attributes, recorded_at FROM observability_metric_points ORDER BY recorded_at DESC LIMIT 50",
        ),
        client.execute<{
          duration_ms: number | string;
          name: string;
          service: string;
          status: string;
          trace_id: string;
        }>(
          "SELECT trace_id, name, service, status, duration_ms FROM observability_spans ORDER BY started_at DESC LIMIT 50",
        ),
        client.execute<UptimeRow>(
          "SELECT * FROM uptime_monitors ORDER BY name",
        ),
        client.execute<{ count: number | string; source: string }>(`
          SELECT 'auth' AS source, count(*) AS count FROM auth_audit_events
          UNION ALL SELECT 'tenant', count(*) FROM tenant_audit_events
          UNION ALL SELECT 'billing', count(*) FROM billing_audit_events
          UNION ALL SELECT 'api', count(*) FROM api_audit_events
          UNION ALL SELECT 'storage', count(*) FROM storage_audit_events
          UNION ALL SELECT 'messaging', count(*) FROM messaging_audit_events
        `),
      ]);
    const logCounts = {
      debug: 0,
      error: 0,
      fatal: 0,
      info: 0,
      warn: 0,
    } satisfies Record<LogLevel, number>;

    for (const row of logCountRows) {
      logCounts[row.level] = Number(row.count);
    }

    return {
      auditCounts: Object.fromEntries(
        auditRows.map((row) => [row.source, Number(row.count)]),
      ),
      logCounts,
      recentLogs: logRows.map(toLog),
      recentMetrics: metricRows.map((row) => ({
        attributes: parseJson(row.attributes, {}),
        name: row.name,
        recordedAt: toIso(row.recorded_at)!,
        unit: row.unit ?? undefined,
        value: Number(row.value),
      })),
      recentSpans: spanRows.map((row) => ({
        durationMs: Number(row.duration_ms),
        name: row.name,
        service: row.service,
        status: row.status,
        traceId: row.trace_id,
      })),
      uptimeMonitors: uptimeRows.map(toUptimeMonitor),
    };
  }

  return {
    cleanupTelemetry,
    getOperationalSummary,
    liveness,
    logger,
    recordMetric,
    runAllDueUptimeChecks,
    runDueUptimeChecks,
    runHealthChecks,
    upsertUptimeMonitor,
    withSpan,
  };
}

export function createObservabilityJobHandlers(
  service: ReturnType<typeof createObservabilityService>,
) {
  return {
    [observabilityJobTypes.retention]: async (job: {
      payload: Record<string, unknown>;
    }) => {
      const retentionDays = Number(job.payload.retentionDays ?? 30);
      await service.cleanupTelemetry(
        Number.isInteger(retentionDays) && retentionDays > 0
          ? retentionDays
          : 30,
      );
    },
    [observabilityJobTypes.uptime]: async () => {
      await service.runAllDueUptimeChecks();
    },
  };
}

export function observeJobHandlers(
  handlers: Record<
    string,
    (job: {
      id: string;
      payload: Record<string, unknown>;
      tenantId?: string;
      type: string;
    }) => Promise<void> | void
  >,
  service: ReturnType<typeof createObservabilityService>,
) {
  return Object.fromEntries(
    Object.entries(handlers).map(([type, handler]) => [
      type,
      async (job: Parameters<typeof handler>[0]) => {
        const startedAt = performance.now();
        await service.logger.info("Background job started", {
          attributes: { jobType: job.type },
          category: "job",
          jobId: job.id,
          tenantId: job.tenantId,
        });

        try {
          await service.withSpan({
            attributes: { "job.id": job.id, "job.type": job.type },
            name: `job ${job.type}`,
            task: () => handler(job),
            tenantId: job.tenantId,
          });
          await service.logger.info("Background job completed", {
            attributes: {
              durationMs: performance.now() - startedAt,
              jobType: job.type,
            },
            category: "job",
            jobId: job.id,
            tenantId: job.tenantId,
          });
        } catch (error) {
          await service.logger.error("Background job failed", {
            attributes: {
              durationMs: performance.now() - startedAt,
              jobType: job.type,
            },
            category: "job",
            error,
            jobId: job.id,
            tenantId: job.tenantId,
          });
          throw error;
        }
      },
    ]),
  );
}
