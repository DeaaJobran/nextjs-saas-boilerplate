import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const jsonObject = sql`(json('{}'))`;
const jsonArray = sql`(json('[]'))`;

export const eventLog = sqliteTable(
  "event_log",
  {
    createdAt: text("created_at").notNull(),
    eventType: text("event_type").notNull(),
    id: text("id").primaryKey(),
    occurredAt: text("occurred_at").notNull(),
    payload: text("payload", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObject),
    source: text("source").notNull(),
    subjectId: text("subject_id"),
    subjectType: text("subject_type"),
    tenantId: text("tenant_id"),
  },
  (table) => [
    index("service_event_log_tenant_occurred_idx").on(
      table.tenantId,
      table.occurredAt,
    ),
    index("service_event_log_type_occurred_idx").on(
      table.eventType,
      table.occurredAt,
    ),
  ],
);

export const outboxEvents = sqliteTable(
  "outbox_events",
  {
    attempts: integer("attempts").notNull().default(0),
    availableAt: text("available_at").notNull(),
    createdAt: text("created_at").notNull(),
    dispatchedAt: text("dispatched_at"),
    eventType: text("event_type").notNull(),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key"),
    lastError: text("last_error"),
    lockedAt: text("locked_at"),
    lockedBy: text("locked_by"),
    payload: text("payload", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObject),
    status: text("status").notNull(),
    tenantId: text("tenant_id"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("service_outbox_events_idempotency_unique")
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
    index("service_outbox_events_status_available_idx").on(
      table.status,
      table.availableAt,
    ),
  ],
);

export const idempotencyKeys = sqliteTable(
  "idempotency_keys",
  {
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    key: text("key").primaryKey(),
    lockedUntil: text("locked_until"),
    requestHash: text("request_hash").notNull(),
    responseBody: text("response_body", { mode: "json" }).$type<unknown>(),
    responseStatus: integer("response_status"),
    scope: text("scope").notNull(),
    tenantId: text("tenant_id"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("service_idempotency_keys_tenant_scope_idx").on(
      table.tenantId,
      table.scope,
    ),
    index("service_idempotency_keys_expires_idx").on(table.expiresAt),
  ],
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    createdAt: text("created_at").notNull(),
    createdBy: text("created_by"),
    deletedAt: text("deleted_at"),
    deletedBy: text("deleted_by"),
    expiresAt: text("expires_at"),
    id: text("id").primaryKey(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    lastUsedAt: text("last_used_at"),
    name: text("name").notNull(),
    revokedAt: text("revoked_at"),
    scopes: text("scopes", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(jsonArray),
    tenantId: text("tenant_id"),
    updatedAt: text("updated_at").notNull(),
    updatedBy: text("updated_by"),
  },
  (table) => [
    uniqueIndex("service_api_keys_hash_unique").on(table.keyHash),
    index("service_api_keys_tenant_active_idx").on(
      table.tenantId,
      table.deletedAt,
    ),
  ],
);

export const rateLimitBuckets = sqliteTable(
  "rate_limit_buckets",
  {
    count: integer("count").notNull(),
    expiresAt: text("expires_at").notNull(),
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    scope: text("scope").notNull(),
    tenantId: text("tenant_id").notNull().default(""),
    windowSeconds: integer("window_seconds").notNull(),
    windowStart: text("window_start").notNull(),
  },
  (table) => [
    uniqueIndex("service_rate_limit_buckets_window_unique").on(
      table.tenantId,
      table.identifier,
      table.scope,
      table.windowStart,
    ),
    index("service_rate_limit_buckets_expires_idx").on(table.expiresAt),
  ],
);

export const backgroundJobs = sqliteTable(
  "background_jobs",
  {
    attempts: integer("attempts").notNull().default(0),
    availableAt: text("available_at").notNull(),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull(),
    id: text("id").primaryKey(),
    lastError: text("last_error"),
    lockedAt: text("locked_at"),
    lockedBy: text("locked_by"),
    maxAttempts: integer("max_attempts").notNull().default(3),
    payload: text("payload", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObject),
    priority: integer("priority").notNull().default(0),
    queue: text("queue").notNull().default("default"),
    status: text("status").notNull(),
    tenantId: text("tenant_id"),
    type: text("type").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("service_background_jobs_claim_idx").on(
      table.queue,
      table.status,
      table.availableAt,
      table.priority,
    ),
    index("service_background_jobs_tenant_status_idx").on(
      table.tenantId,
      table.status,
    ),
  ],
);

export const cronSchedules = sqliteTable(
  "cron_schedules",
  {
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    id: text("id").primaryKey(),
    intervalSeconds: integer("interval_seconds").notNull(),
    jobType: text("job_type").notNull(),
    lastRunAt: text("last_run_at"),
    name: text("name").notNull(),
    nextRunAt: text("next_run_at").notNull(),
    payload: text("payload", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(jsonObject),
    queue: text("queue").notNull().default("default"),
    tenantId: text("tenant_id"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("service_cron_schedules_due_idx").on(
      table.enabled,
      table.nextRunAt,
      table.deletedAt,
    ),
  ],
);
