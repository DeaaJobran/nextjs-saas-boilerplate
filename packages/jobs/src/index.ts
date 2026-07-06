import { randomUUID } from "node:crypto";

import {
  getDatabaseRuntime,
  type Queryable,
  runMigrations,
} from "@nextjs-saas/db";

export type JobStatus = "completed" | "failed" | "queued" | "running";

export type BackgroundJob = {
  attempts: number;
  availableAt: string;
  completedAt?: string;
  createdAt: string;
  id: string;
  lastError?: string;
  lockedAt?: string;
  lockedBy?: string;
  maxAttempts: number;
  payload: Record<string, unknown>;
  priority: number;
  queue: string;
  status: JobStatus;
  tenantId?: string;
  type: string;
  updatedAt: string;
};

export type CronSchedule = {
  createdAt: string;
  enabled: boolean;
  id: string;
  intervalSeconds: number;
  jobType: string;
  lastRunAt?: string;
  name: string;
  nextRunAt: string;
  payload: Record<string, unknown>;
  tenantId?: string;
  updatedAt: string;
};

export type JobHandler = (job: BackgroundJob) => Promise<void> | void;

export type WorkerOptions = {
  handlers: Record<string, JobHandler>;
  intervalMs?: number;
  queue?: string;
  signal?: AbortSignal;
  workerId?: string;
};

type BackgroundJobRow = {
  attempts: number;
  available_at: string | Date;
  completed_at: string | Date | null;
  created_at: string | Date;
  id: string;
  last_error: string | null;
  locked_at: string | Date | null;
  locked_by: string | null;
  max_attempts: number;
  payload: Record<string, unknown> | string;
  priority: number;
  queue: string;
  status: JobStatus;
  tenant_id: string | null;
  type: string;
  updated_at: string | Date;
};

function toIsoString(value: string | Date | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function parsePayload(value: Record<string, unknown> | string) {
  return typeof value === "string"
    ? (JSON.parse(value) as Record<string, unknown>)
    : value;
}

function mapJob(row: BackgroundJobRow): BackgroundJob {
  return {
    attempts: row.attempts,
    availableAt: toIsoString(row.available_at)!,
    completedAt: toIsoString(row.completed_at),
    createdAt: toIsoString(row.created_at)!,
    id: row.id,
    lastError: row.last_error ?? undefined,
    lockedAt: toIsoString(row.locked_at),
    lockedBy: row.locked_by ?? undefined,
    maxAttempts: row.max_attempts,
    payload: parsePayload(row.payload),
    priority: row.priority,
    queue: row.queue,
    status: row.status,
    tenantId: row.tenant_id ?? undefined,
    type: row.type,
    updatedAt: toIsoString(row.updated_at)!,
  };
}

async function ensureJobDatabase(client?: Queryable) {
  await runMigrations(client);
}

async function lockJobTables(client: Queryable) {
  await client.execute(`
    LOCK TABLE
      background_jobs,
      cron_schedules
    IN EXCLUSIVE MODE
  `);
}

export async function enqueueJob(input: {
  availableAt?: Date;
  id?: string;
  maxAttempts?: number;
  payload?: Record<string, unknown>;
  priority?: number;
  queue?: string;
  tenantId?: string;
  type: string;
}) {
  const runtime = await getDatabaseRuntime();

  await ensureJobDatabase(runtime);

  const now = new Date().toISOString();
  const id = input.id ?? randomUUID();

  await runtime.execute(
    `
      INSERT INTO background_jobs (
        id,
        tenant_id,
        queue,
        type,
        payload,
        status,
        priority,
        attempts,
        max_attempts,
        available_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, 'queued', $6, 0, $7, $8, $9, $9)
    `,
    [
      id,
      input.tenantId,
      input.queue ?? "default",
      input.type,
      JSON.stringify(input.payload ?? {}),
      input.priority ?? 0,
      input.maxAttempts ?? 3,
      input.availableAt?.toISOString() ?? now,
      now,
    ],
  );

  return id;
}

export async function registerCronSchedule(input: {
  enabled?: boolean;
  id?: string;
  intervalSeconds: number;
  jobType: string;
  name: string;
  nextRunAt?: Date;
  payload?: Record<string, unknown>;
  tenantId?: string;
}) {
  if (!Number.isInteger(input.intervalSeconds) || input.intervalSeconds < 1) {
    throw new Error("Cron schedule interval must be a positive integer.");
  }

  const runtime = await getDatabaseRuntime();

  await ensureJobDatabase(runtime);

  const now = new Date().toISOString();
  const id = input.id ?? randomUUID();

  await runtime.execute(
    `
      INSERT INTO cron_schedules (
        id,
        tenant_id,
        name,
        job_type,
        payload,
        interval_seconds,
        enabled,
        next_run_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $9)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        name = EXCLUDED.name,
        job_type = EXCLUDED.job_type,
        payload = EXCLUDED.payload,
        interval_seconds = EXCLUDED.interval_seconds,
        enabled = EXCLUDED.enabled,
        next_run_at = EXCLUDED.next_run_at,
        updated_at = EXCLUDED.updated_at
    `,
    [
      id,
      input.tenantId,
      input.name,
      input.jobType,
      JSON.stringify(input.payload ?? {}),
      input.intervalSeconds,
      input.enabled ?? true,
      input.nextRunAt?.toISOString() ?? now,
      now,
    ],
  );

  return id;
}

export async function materializeDueCronJobs(now = new Date()) {
  const runtime = await getDatabaseRuntime();

  await ensureJobDatabase(runtime);

  return runtime.transaction(async (transaction) => {
    await lockJobTables(transaction);

    const nowIso = now.toISOString();
    const schedules = await transaction.execute<{
      id: string;
      interval_seconds: number;
      job_type: string;
      payload: Record<string, unknown> | string;
      tenant_id: string | null;
    }>(
      `
        SELECT id, tenant_id, job_type, payload, interval_seconds
        FROM cron_schedules
        WHERE enabled = true
          AND deleted_at IS NULL
          AND next_run_at <= $1
        ORDER BY next_run_at ASC
      `,
      [nowIso],
    );
    const jobIds: string[] = [];

    for (const schedule of schedules) {
      const jobId = randomUUID();
      const nextRunAt = new Date(
        now.getTime() + schedule.interval_seconds * 1000,
      ).toISOString();

      await transaction.execute(
        `
          INSERT INTO background_jobs (
            id,
            tenant_id,
            queue,
            type,
            payload,
            status,
            priority,
            attempts,
            max_attempts,
            available_at,
            created_at,
            updated_at
          )
          VALUES ($1, $2, 'default', $3, $4::jsonb, 'queued', 0, 0, 3, $5, $5, $5)
        `,
        [
          jobId,
          schedule.tenant_id,
          schedule.job_type,
          JSON.stringify(parsePayload(schedule.payload)),
          nowIso,
        ],
      );
      await transaction.execute(
        `
          UPDATE cron_schedules
          SET last_run_at = $1,
              next_run_at = $2,
              updated_at = $1
          WHERE id = $3
        `,
        [nowIso, nextRunAt, schedule.id],
      );

      jobIds.push(jobId);
    }

    return jobIds;
  });
}

export async function claimNextJob({
  queue = "default",
  workerId = `worker-${process.pid}`,
  now = new Date(),
}: {
  now?: Date;
  queue?: string;
  workerId?: string;
} = {}) {
  const runtime = await getDatabaseRuntime();

  await ensureJobDatabase(runtime);

  return runtime.transaction(async (transaction) => {
    await lockJobTables(transaction);

    const [job] = await transaction.execute<BackgroundJobRow>(
      `
        SELECT *
        FROM background_jobs
        WHERE queue = $1
          AND status = 'queued'
          AND available_at <= $2
        ORDER BY priority DESC, available_at ASC, created_at ASC
        LIMIT 1
      `,
      [queue, now.toISOString()],
    );

    if (!job) {
      return undefined;
    }

    const updatedAt = now.toISOString();

    await transaction.execute(
      `
        UPDATE background_jobs
        SET status = 'running',
            attempts = attempts + 1,
            locked_at = $1,
            locked_by = $2,
            updated_at = $1
        WHERE id = $3
      `,
      [updatedAt, workerId, job.id],
    );

    return {
      ...mapJob(job),
      attempts: job.attempts + 1,
      lockedAt: updatedAt,
      lockedBy: workerId,
      status: "running" as const,
      updatedAt,
    };
  });
}

export async function completeJob(id: string, now = new Date()) {
  const timestamp = now.toISOString();
  const runtime = await getDatabaseRuntime();

  await ensureJobDatabase(runtime);
  await runtime.execute(
    `
      UPDATE background_jobs
      SET status = 'completed',
          completed_at = $1,
          locked_at = NULL,
          locked_by = NULL,
          updated_at = $1
      WHERE id = $2
    `,
    [timestamp, id],
  );
}

export async function failJob(
  id: string,
  error: unknown,
  {
    now = new Date(),
    retryDelaySeconds = 60,
  }: {
    now?: Date;
    retryDelaySeconds?: number;
  } = {},
) {
  const runtime = await getDatabaseRuntime();

  await ensureJobDatabase(runtime);

  await runtime.transaction(async (transaction) => {
    await lockJobTables(transaction);

    const [job] = await transaction.execute<BackgroundJobRow>(
      "SELECT * FROM background_jobs WHERE id = $1",
      [id],
    );

    if (!job) {
      return;
    }

    const shouldRetry = job.attempts < job.max_attempts;
    const timestamp = now.toISOString();
    const availableAt = new Date(
      now.getTime() + retryDelaySeconds * 1000,
    ).toISOString();

    await transaction.execute(
      `
        UPDATE background_jobs
        SET status = $1,
            available_at = $2,
            locked_at = NULL,
            locked_by = NULL,
            last_error = $3,
            updated_at = $4
        WHERE id = $5
      `,
      [
        shouldRetry ? "queued" : "failed",
        shouldRetry ? availableAt : timestamp,
        error instanceof Error ? error.message : String(error),
        timestamp,
        id,
      ],
    );
  });
}

export async function runWorkerOnce({
  handlers,
  queue,
  workerId,
}: Omit<WorkerOptions, "intervalMs" | "signal">) {
  await materializeDueCronJobs();

  const job = await claimNextJob({ queue, workerId });

  if (!job) {
    return undefined;
  }

  const handler = handlers[job.type];

  if (!handler) {
    await failJob(
      job.id,
      new Error(`No handler registered for job type: ${job.type}`),
    );

    return job;
  }

  try {
    await handler(job);
    await completeJob(job.id);
  } catch (error) {
    await failJob(job.id, error);
  }

  return job;
}

export async function runWorker({
  handlers,
  intervalMs = 1000,
  queue,
  signal,
  workerId,
}: WorkerOptions) {
  while (!signal?.aborted) {
    await runWorkerOnce({ handlers, queue, workerId });
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
