import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const managedPages = pgTable(
  "managed_pages",
  {
    description: text("description").notNull(),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    locale: text("locale").notNull(),
    ogImage: text("og_image"),
    publishedAt: timestamp("published_at", {
      mode: "string",
      withTimezone: true,
    }),
    publishState: text("publish_state").notNull(),
    seoDescription: text("seo_description").notNull(),
    seoTitle: text("seo_title").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    version: text("version"),
  },
  (table) => [
    uniqueIndex("managed_pages_locale_kind_slug_unique").on(
      table.locale,
      table.kind,
      table.slug,
    ),
  ],
);

export const pageSections = pgTable(
  "page_sections",
  {
    body: text("body").notNull(),
    ctaHref: text("cta_href"),
    ctaLabel: text("cta_label"),
    eyebrow: text("eyebrow"),
    id: text("id").notNull(),
    items: jsonb("items").$type<string[] | null>(),
    pageId: text("page_id")
      .notNull()
      .references(() => managedPages.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    title: text("title").notNull(),
  },
  (table) => [primaryKey({ columns: [table.pageId, table.id] })],
);

export const managedPageVersions = pgTable("managed_page_versions", {
  createdAt: timestamp("created_at", {
    mode: "string",
    withTimezone: true,
  }).notNull(),
  id: text("id").primaryKey(),
  pageId: text("page_id")
    .notNull()
    .references(() => managedPages.id, { onDelete: "cascade" }),
  pageSnapshot: jsonb("page_snapshot").notNull(),
  version: text("version"),
});

export const contentAuditEvents = pgTable("content_audit_events", {
  action: text("action").notNull(),
  actorId: text("actor_id"),
  createdAt: timestamp("created_at", {
    mode: "string",
    withTimezone: true,
  }).notNull(),
  entityId: text("entity_id").notNull(),
  entityType: text("entity_type").notNull(),
  id: text("id").primaryKey(),
  snapshot: jsonb("snapshot").notNull(),
});

export const pricingPlans = pgTable(
  "pricing_plans",
  {
    ctaLabel: text("cta_label").notNull(),
    description: text("description").notNull(),
    features: jsonb("features").$type<string[]>().notNull(),
    highlighted: boolean("highlighted").notNull().default(false),
    id: text("id").notNull(),
    locale: text("locale").notNull(),
    name: text("name").notNull(),
    priceLabel: text("price_label").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [primaryKey({ columns: [table.locale, table.id] })],
);

export const contactFields = pgTable(
  "contact_fields",
  {
    id: text("id").notNull(),
    label: text("label").notNull(),
    locale: text("locale").notNull(),
    maxLength: integer("max_length"),
    minLength: integer("min_length"),
    required: boolean("required").notNull(),
    sortOrder: integer("sort_order").notNull(),
    type: text("type").notNull(),
  },
  (table) => [primaryKey({ columns: [table.locale, table.id] })],
);

export const contactRouting = pgTable("contact_routing", {
  locale: text("locale").primaryKey(),
  recipientEmail: text("recipient_email").notNull(),
  spamProtectionEnabled: boolean("spam_protection_enabled").notNull(),
  subjectPrefix: text("subject_prefix").notNull(),
  successMessage: text("success_message").notNull(),
});

export const contactSubmissions = pgTable("contact_submissions", {
  email: text("email").notNull(),
  id: text("id").primaryKey(),
  locale: text("locale").notNull(),
  message: text("message").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  submittedAt: timestamp("submitted_at", {
    mode: "string",
    withTimezone: true,
  }).notNull(),
  values: jsonb("values").$type<Record<string, string>>().notNull(),
});

export const eventLog = pgTable(
  "event_log",
  {
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    eventType: text("event_type").notNull(),
    id: text("id").primaryKey(),
    occurredAt: timestamp("occurred_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    source: text("source").notNull(),
    subjectId: text("subject_id"),
    subjectType: text("subject_type"),
    tenantId: text("tenant_id"),
  },
  (table) => [
    index("event_log_tenant_occurred_idx").on(table.tenantId, table.occurredAt),
    index("event_log_type_occurred_idx").on(table.eventType, table.occurredAt),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    dispatchedAt: timestamp("dispatched_at", {
      mode: "string",
      withTimezone: true,
    }),
    eventType: text("event_type").notNull(),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key"),
    lastError: text("last_error"),
    lockedAt: timestamp("locked_at", {
      mode: "string",
      withTimezone: true,
    }),
    lockedBy: text("locked_by"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull(),
    tenantId: text("tenant_id"),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("outbox_events_idempotency_unique").on(table.idempotencyKey),
    index("outbox_events_status_available_idx").on(
      table.status,
      table.availableAt,
    ),
  ],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    key: text("key").primaryKey(),
    lockedUntil: timestamp("locked_until", {
      mode: "string",
      withTimezone: true,
    }),
    requestHash: text("request_hash").notNull(),
    responseBody: jsonb("response_body").$type<Record<string, unknown>>(),
    responseStatus: integer("response_status"),
    scope: text("scope").notNull(),
    tenantId: text("tenant_id"),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    index("idempotency_keys_tenant_scope_idx").on(table.tenantId, table.scope),
    index("idempotency_keys_expires_idx").on(table.expiresAt),
  ],
);

export const apiKeys = pgTable(
  "api_keys",
  {
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    createdBy: text("created_by"),
    deletedAt: timestamp("deleted_at", {
      mode: "string",
      withTimezone: true,
    }),
    deletedBy: text("deleted_by"),
    expiresAt: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }),
    id: text("id").primaryKey(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    lastUsedAt: timestamp("last_used_at", {
      mode: "string",
      withTimezone: true,
    }),
    name: text("name").notNull(),
    revokedAt: timestamp("revoked_at", {
      mode: "string",
      withTimezone: true,
    }),
    scopes: jsonb("scopes").$type<string[]>().notNull(),
    tenantId: text("tenant_id"),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    updatedBy: text("updated_by"),
  },
  (table) => [
    uniqueIndex("api_keys_hash_unique").on(table.keyHash),
    index("api_keys_tenant_active_idx").on(table.tenantId, table.deletedAt),
  ],
);

export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    count: integer("count").notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    scope: text("scope").notNull(),
    tenantId: text("tenant_id"),
    windowSeconds: integer("window_seconds").notNull(),
    windowStart: timestamp("window_start", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("rate_limit_buckets_window_unique").on(
      table.tenantId,
      table.identifier,
      table.scope,
      table.windowStart,
    ),
    index("rate_limit_buckets_expires_idx").on(table.expiresAt),
  ],
);

export const backgroundJobs = pgTable(
  "background_jobs",
  {
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    completedAt: timestamp("completed_at", {
      mode: "string",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    id: text("id").primaryKey(),
    lastError: text("last_error"),
    lockedAt: timestamp("locked_at", {
      mode: "string",
      withTimezone: true,
    }),
    lockedBy: text("locked_by"),
    maxAttempts: integer("max_attempts").notNull().default(3),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    priority: integer("priority").notNull().default(0),
    queue: text("queue").notNull().default("default"),
    status: text("status").notNull(),
    tenantId: text("tenant_id"),
    type: text("type").notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    index("background_jobs_claim_idx").on(
      table.queue,
      table.status,
      table.availableAt,
      table.priority,
    ),
    index("background_jobs_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const cronSchedules = pgTable(
  "cron_schedules",
  {
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    deletedAt: timestamp("deleted_at", {
      mode: "string",
      withTimezone: true,
    }),
    enabled: boolean("enabled").notNull().default(true),
    id: text("id").primaryKey(),
    intervalSeconds: integer("interval_seconds").notNull(),
    jobType: text("job_type").notNull(),
    lastRunAt: timestamp("last_run_at", {
      mode: "string",
      withTimezone: true,
    }),
    name: text("name").notNull(),
    nextRunAt: timestamp("next_run_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    tenantId: text("tenant_id"),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    index("cron_schedules_due_idx").on(
      table.enabled,
      table.nextRunAt,
      table.deletedAt,
    ),
  ],
);

export const managedPagesRelations = relations(managedPages, ({ many }) => ({
  sections: many(pageSections),
  versions: many(managedPageVersions),
}));

export const pageSectionsRelations = relations(pageSections, ({ one }) => ({
  page: one(managedPages, {
    fields: [pageSections.pageId],
    references: [managedPages.id],
  }),
}));
