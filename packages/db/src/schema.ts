import { relations, sql } from "drizzle-orm";
import {
  bigint,
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

export const localizationSettings = pgTable("localization_settings", {
  defaultLocale: text("default_locale").notNull(),
  enabledLocales: jsonb("enabled_locales").$type<string[]>().notNull(),
  id: text("id").primaryKey(),
  updatedAt: timestamp("updated_at", {
    mode: "string",
    withTimezone: true,
  }).notNull(),
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

export const authUsers = pgTable(
  "auth_users",
  {
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    deletedAt: timestamp("deleted_at", {
      mode: "string",
      withTimezone: true,
    }),
    deletionRequestedAt: timestamp("deletion_requested_at", {
      mode: "string",
      withTimezone: true,
    }),
    disabledAt: timestamp("disabled_at", {
      mode: "string",
      withTimezone: true,
    }),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", {
      mode: "string",
      withTimezone: true,
    }),
    id: text("id").primaryKey(),
    locale: text("locale"),
    mfaRequired: boolean("mfa_required").notNull().default(false),
    normalizedEmail: text("normalized_email").notNull(),
    passwordHash: text("password_hash"),
    passwordUpdatedAt: timestamp("password_updated_at", {
      mode: "string",
      withTimezone: true,
    }),
    role: text("role").notNull().default("user"),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("auth_users_normalized_email_active_unique")
      .on(table.normalizedEmail)
      .where(sql`deleted_at IS NULL`),
  ],
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    accessTokenHash: text("access_token_hash"),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }),
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    providerEmail: text("provider_email"),
    refreshTokenHash: text("refresh_token_hash"),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("auth_accounts_provider_account_unique").on(
      table.provider,
      table.providerAccountId,
    ),
    index("auth_accounts_user_provider_idx").on(table.userId, table.provider),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    deviceName: text("device_name").notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    id: text("id").primaryKey(),
    ipAddress: text("ip_address"),
    lastSeenAt: timestamp("last_seen_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    refreshExpiresAt: timestamp("refresh_expires_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    revokedAt: timestamp("revoked_at", {
      mode: "string",
      withTimezone: true,
    }),
    tokenHash: text("token_hash").notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_hash_unique").on(table.tokenHash),
    uniqueIndex("auth_sessions_refresh_token_hash_unique").on(
      table.refreshTokenHash,
    ),
    index("auth_sessions_user_active_idx").on(
      table.userId,
      table.revokedAt,
      table.expiresAt,
    ),
  ],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    consumedAt: timestamp("consumed_at", {
      mode: "string",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    email: text("email"),
    expiresAt: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    target: text("target"),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id").references(() => authUsers.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [
    uniqueIndex("auth_tokens_token_hash_unique").on(table.tokenHash),
    index("auth_tokens_user_kind_idx").on(
      table.userId,
      table.kind,
      table.consumedAt,
    ),
    index("auth_tokens_email_kind_idx").on(
      table.email,
      table.kind,
      table.consumedAt,
    ),
  ],
);

export const authChallenges = pgTable(
  "auth_challenges",
  {
    challenge: text("challenge").notNull(),
    consumedAt: timestamp("consumed_at", {
      mode: "string",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    userId: text("user_id").references(() => authUsers.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [
    index("auth_challenges_user_kind_idx").on(
      table.userId,
      table.kind,
      table.consumedAt,
    ),
  ],
);

export const authPasskeys = pgTable(
  "auth_passkeys",
  {
    backedUp: boolean("backed_up").notNull().default(false),
    counter: integer("counter").notNull().default(0),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    credentialId: text("credential_id").notNull(),
    deviceType: text("device_type").notNull(),
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    lastUsedAt: timestamp("last_used_at", {
      mode: "string",
      withTimezone: true,
    }),
    publicKey: text("public_key").notNull(),
    transports: jsonb("transports").$type<string[]>().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("auth_passkeys_credential_id_unique").on(table.credentialId),
    index("auth_passkeys_user_idx").on(table.userId),
  ],
);

export const authMfaFactors = pgTable(
  "auth_mfa_factors",
  {
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    enabledAt: timestamp("enabled_at", {
      mode: "string",
      withTimezone: true,
    }),
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    secretCiphertext: text("secret_ciphertext").notNull(),
    type: text("type").notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("auth_mfa_factors_user_type_idx").on(
      table.userId,
      table.type,
      table.enabledAt,
    ),
  ],
);

export const authRecoveryCodes = pgTable(
  "auth_recovery_codes",
  {
    codeHash: text("code_hash").notNull(),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    id: text("id").primaryKey(),
    usedAt: timestamp("used_at", {
      mode: "string",
      withTimezone: true,
    }),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("auth_recovery_codes_code_hash_unique").on(table.codeHash),
    index("auth_recovery_codes_user_idx").on(table.userId, table.usedAt),
  ],
);

export const authInvitations = pgTable(
  "auth_invitations",
  {
    acceptedAt: timestamp("accepted_at", {
      mode: "string",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    createdBy: text("created_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    id: text("id").primaryKey(),
    normalizedEmail: text("normalized_email").notNull(),
    role: text("role").notNull(),
    tokenHash: text("token_hash").notNull(),
  },
  (table) => [
    uniqueIndex("auth_invitations_token_hash_unique").on(table.tokenHash),
    index("auth_invitations_email_active_idx").on(
      table.normalizedEmail,
      table.acceptedAt,
      table.expiresAt,
    ),
  ],
);

export const authLoginAttempts = pgTable(
  "auth_login_attempts",
  {
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    ipAddress: text("ip_address"),
    reason: text("reason").notNull(),
    success: boolean("success").notNull(),
  },
  (table) => [
    index("auth_login_attempts_identifier_created_idx").on(
      table.identifier,
      table.createdAt,
    ),
    index("auth_login_attempts_ip_created_idx").on(
      table.ipAddress,
      table.createdAt,
    ),
  ],
);

export const authOauthStates = pgTable(
  "auth_oauth_states",
  {
    codeVerifier: text("code_verifier").notNull(),
    consumedAt: timestamp("consumed_at", {
      mode: "string",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    provider: text("provider").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    stateHash: text("state_hash").notNull(),
  },
  (table) => [
    uniqueIndex("auth_oauth_states_state_hash_unique").on(table.stateHash),
  ],
);

export const authAuditEvents = pgTable(
  "auth_audit_events",
  {
    actorId: text("actor_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    eventType: text("event_type").notNull(),
    id: text("id").primaryKey(),
    ipAddress: text("ip_address"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    userAgent: text("user_agent"),
    userId: text("user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("auth_audit_events_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("auth_audit_events_type_created_idx").on(
      table.eventType,
      table.createdAt,
    ),
  ],
);

export const organizations = pgTable(
  "organizations",
  {
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    createdBy: text("created_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    defaultLocale: text("default_locale").notNull().default("en"),
    deletedAt: timestamp("deleted_at", {
      mode: "string",
      withTimezone: true,
    }),
    deletedBy: text("deleted_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    id: text("id").primaryKey(),
    logoUrl: text("logo_url"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status").notNull().default("active"),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    updatedBy: text("updated_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    websiteUrl: text("website_url"),
  },
  (table) => [
    uniqueIndex("organizations_slug_active_unique")
      .on(table.slug)
      .where(sql`deleted_at IS NULL`),
  ],
);

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    customPermissions: jsonb("custom_permissions").$type<string[]>().notNull(),
    invitedBy: text("invited_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    joinedAt: timestamp("joined_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    removedAt: timestamp("removed_at", {
      mode: "string",
      withTimezone: true,
    }),
    removedBy: text("removed_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    updatedBy: text("updated_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    index("organization_memberships_user_active_idx").on(
      table.userId,
      table.status,
      table.removedAt,
    ),
    index("organization_memberships_org_role_idx").on(
      table.organizationId,
      table.role,
      table.status,
    ),
  ],
);

export const organizationInvitations = pgTable(
  "organization_invitations",
  {
    acceptedAt: timestamp("accepted_at", {
      mode: "string",
      withTimezone: true,
    }),
    acceptedBy: text("accepted_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    createdBy: text("created_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    customPermissions: jsonb("custom_permissions").$type<string[]>().notNull(),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    id: text("id").primaryKey(),
    normalizedEmail: text("normalized_email").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    rejectedAt: timestamp("rejected_at", {
      mode: "string",
      withTimezone: true,
    }),
    rejectedBy: text("rejected_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    role: text("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("organization_invitations_token_hash_unique").on(
      table.tokenHash,
    ),
    index("organization_invitations_email_active_idx").on(
      table.normalizedEmail,
      table.acceptedAt,
      table.rejectedAt,
      table.expiresAt,
    ),
    index("organization_invitations_org_active_idx").on(
      table.organizationId,
      table.acceptedAt,
      table.rejectedAt,
      table.expiresAt,
    ),
  ],
);

export const organizationFeatureFlags = pgTable(
  "organization_feature_flags",
  {
    enabled: boolean("enabled").notNull().default(false),
    key: text("flag_key").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    updatedBy: text("updated_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.key] })],
);

export const organizationUsageLimits = pgTable(
  "organization_usage_limits",
  {
    key: text("limit_key").notNull(),
    limitValue: bigint("limit_value", { mode: "number" }).notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    resetAt: timestamp("reset_at", {
      mode: "string",
      withTimezone: true,
    }),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    updatedBy: text("updated_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    usedValue: bigint("used_value", { mode: "number" }).notNull().default(0),
    windowSeconds: integer("window_seconds"),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.key] })],
);

export const organizationQuotas = pgTable("organization_quotas", {
  aiTokenLimit: bigint("ai_token_limit", { mode: "number" }).notNull(),
  aiTokenUsed: bigint("ai_token_used", { mode: "number" }).notNull().default(0),
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  storageBytesLimit: bigint("storage_bytes_limit", {
    mode: "number",
  }).notNull(),
  storageBytesUsed: bigint("storage_bytes_used", {
    mode: "number",
  })
    .notNull()
    .default(0),
  updatedAt: timestamp("updated_at", {
    mode: "string",
    withTimezone: true,
  }).notNull(),
  updatedBy: text("updated_by").references(() => authUsers.id, {
    onDelete: "set null",
  }),
});

export const impersonationSessions = pgTable(
  "impersonation_sessions",
  {
    actorId: text("actor_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    endedAt: timestamp("ended_at", {
      mode: "string",
      withTimezone: true,
    }),
    endedBy: text("ended_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    startedAt: timestamp("started_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    subjectUserId: text("subject_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("impersonation_sessions_actor_active_idx").on(
      table.actorId,
      table.endedAt,
      table.expiresAt,
    ),
    index("impersonation_sessions_subject_active_idx").on(
      table.subjectUserId,
      table.endedAt,
      table.expiresAt,
    ),
  ],
);

export const tenantAuditEvents = pgTable(
  "tenant_audit_events",
  {
    actorId: text("actor_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    eventType: text("event_type").notNull(),
    id: text("id").primaryKey(),
    impersonationSessionId: text("impersonation_session_id").references(
      () => impersonationSessions.id,
      { onDelete: "set null" },
    ),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    subjectId: text("subject_id"),
    subjectType: text("subject_type").notNull(),
  },
  (table) => [
    index("tenant_audit_events_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("tenant_audit_events_actor_created_idx").on(
      table.actorId,
      table.createdAt,
    ),
  ],
);

export const apiAuditEvents = pgTable(
  "api_audit_events",
  {
    actorId: text("actor_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    apiKeyId: text("api_key_id").references(() => apiKeys.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    durationMs: integer("duration_ms").notNull().default(0),
    errorCode: text("error_code"),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key"),
    ipAddress: text("ip_address"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    requestId: text("request_id").notNull(),
    statusCode: integer("status_code").notNull(),
    tenantId: text("tenant_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    userAgent: text("user_agent"),
  },
  (table) => [
    index("api_audit_events_tenant_created_idx").on(
      table.tenantId,
      table.createdAt,
    ),
    index("api_audit_events_request_idx").on(table.requestId),
  ],
);

export const apiUsageRecords = pgTable(
  "api_usage_records",
  {
    actorId: text("actor_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    apiKeyId: text("api_key_id").references(() => apiKeys.id, {
      onDelete: "set null",
    }),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    method: text("method").notNull(),
    occurredAt: timestamp("occurred_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    path: text("path").notNull(),
    requestUnits: integer("request_units").notNull().default(1),
    routeId: text("route_id").notNull(),
    statusCode: integer("status_code").notNull(),
    tenantId: text("tenant_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [
    index("api_usage_records_tenant_occurred_idx").on(
      table.tenantId,
      table.occurredAt,
    ),
  ],
);

export const apiWebhookEndpoints = pgTable(
  "api_webhook_endpoints",
  {
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    createdBy: text("created_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    eventTypes: jsonb("event_types").$type<string[]>().notNull(),
    id: text("id").primaryKey(),
    secretPrefix: text("secret_prefix").notNull(),
    signingSecretHash: text("signing_secret_hash").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    updatedBy: text("updated_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    url: text("url").notNull(),
  },
  (table) => [
    index("api_webhook_endpoints_tenant_active_idx").on(
      table.tenantId,
      table.active,
    ),
  ],
);

export const apiWebhookDeliveries = pgTable(
  "api_webhook_deliveries",
  {
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    endpointId: text("endpoint_id")
      .notNull()
      .references(() => apiWebhookEndpoints.id, { onDelete: "cascade" }),
    eventId: text("event_id"),
    eventType: text("event_type").notNull(),
    id: text("id").primaryKey(),
    lastAttemptAt: timestamp("last_attempt_at", {
      mode: "string",
      withTimezone: true,
    }),
    lastError: text("last_error"),
    lastStatusCode: integer("last_status_code"),
    nextAttemptAt: timestamp("next_attempt_at", {
      mode: "string",
      withTimezone: true,
    }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    index("api_webhook_deliveries_endpoint_status_idx").on(
      table.endpointId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const mobileDevices = pgTable(
  "mobile_devices",
  {
    appVersion: text("app_version"),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    deviceFingerprintHash: text("device_fingerprint_hash"),
    deviceName: text("device_name").notNull(),
    id: text("id").primaryKey(),
    lastSeenAt: timestamp("last_seen_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    platform: text("platform").notNull(),
    pushTokenHash: text("push_token_hash"),
    revokedAt: timestamp("revoked_at", {
      mode: "string",
      withTimezone: true,
    }),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("mobile_devices_user_seen_idx").on(table.userId, table.lastSeenAt),
  ],
);

export const mobileSessions = pgTable(
  "mobile_sessions",
  {
    authSessionId: text("auth_session_id")
      .notNull()
      .references(() => authSessions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    deviceId: text("device_id")
      .notNull()
      .references(() => mobileDevices.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    refreshTokenFamily: text("refresh_token_family").notNull(),
    revokedAt: timestamp("revoked_at", {
      mode: "string",
      withTimezone: true,
    }),
    rotatedAt: timestamp("rotated_at", {
      mode: "string",
      withTimezone: true,
    }),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("mobile_sessions_auth_session_unique").on(table.authSessionId),
    index("mobile_sessions_device_active_idx").on(
      table.deviceId,
      table.revokedAt,
    ),
  ],
);

export const mobilePushSubscriptions = pgTable(
  "mobile_push_subscriptions",
  {
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    deviceId: text("device_id")
      .notNull()
      .references(() => mobileDevices.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    tokenHash: text("token_hash").notNull(),
    topics: jsonb("topics").$type<string[]>().notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("mobile_push_subscriptions_token_unique").on(
      table.provider,
      table.tokenHash,
    ),
  ],
);

export const mobileDeepLinks = pgTable(
  "mobile_deep_links",
  {
    consumedAt: timestamp("consumed_at", {
      mode: "string",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }),
    id: text("id").primaryKey(),
    params: jsonb("params").$type<Record<string, unknown>>().notNull(),
    route: text("route").notNull(),
    tenantId: text("tenant_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    url: text("url").notNull(),
    userId: text("user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("mobile_deep_links_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const mobileUploadIntents = pgTable(
  "mobile_upload_intents",
  {
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    checksumSha256: text("checksum_sha256"),
    contentType: text("content_type").notNull(),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    fileName: text("file_name").notNull(),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    uploadedAt: timestamp("uploaded_at", {
      mode: "string",
      withTimezone: true,
    }),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("mobile_upload_intents_token_unique").on(table.tokenHash),
    index("mobile_upload_intents_tenant_status_idx").on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const billingPaymentProviders = pgTable(
  "billing_payment_providers",
  {
    capabilities: jsonb("capabilities")
      .$type<Record<string, unknown>>()
      .notNull(),
    configuration: jsonb("configuration")
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    displayName: text("display_name").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    id: text("id").primaryKey(),
    mode: text("mode").notNull(),
    provider: text("provider").notNull(),
    secretRef: text("secret_ref"),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    updatedBy: text("updated_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    webhookSecretRef: text("webhook_secret_ref"),
  },
  (table) => [
    uniqueIndex("billing_payment_providers_provider_unique").on(table.provider),
  ],
);

export const billingTenantSettings = pgTable("billing_tenant_settings", {
  createdAt: timestamp("created_at", {
    mode: "string",
    withTimezone: true,
  }).notNull(),
  defaultCurrency: text("default_currency").notNull(),
  paymentProvider: text("payment_provider").notNull(),
  taxBehavior: text("tax_behavior").notNull(),
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updated_at", {
    mode: "string",
    withTimezone: true,
  }).notNull(),
  updatedBy: text("updated_by").references(() => authUsers.id, {
    onDelete: "set null",
  }),
});

export const billingPlans = pgTable(
  "billing_plans",
  {
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    entitlements: jsonb("entitlements")
      .$type<Record<string, unknown>>()
      .notNull(),
    highlighted: boolean("highlighted").notNull().default(false),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    publicVisible: boolean("public_visible").notNull().default(true),
    seatBased: boolean("seat_based").notNull().default(false),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    status: text("status").notNull(),
    trialDays: integer("trial_days").notNull().default(0),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    updatedBy: text("updated_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    usageBased: boolean("usage_based").notNull().default(false),
  },
  (table) => [
    uniqueIndex("billing_plans_slug_unique").on(table.slug),
    index("billing_plans_public_status_idx").on(
      table.publicVisible,
      table.status,
      table.sortOrder,
    ),
  ],
);

export const billingPlanTranslations = pgTable(
  "billing_plan_translations",
  {
    ctaLabel: text("cta_label").notNull(),
    description: text("description").notNull(),
    features: jsonb("features").$type<string[]>().notNull(),
    locale: text("locale").notNull(),
    name: text("name").notNull(),
    planId: text("plan_id")
      .notNull()
      .references(() => billingPlans.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.planId, table.locale] })],
);

export const billingPrices = pgTable(
  "billing_prices",
  {
    active: boolean("active").notNull().default(true),
    billingScheme: text("billing_scheme").notNull(),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    currency: text("currency").notNull(),
    id: text("id").primaryKey(),
    interval: text("interval").notNull(),
    intervalCount: integer("interval_count").notNull().default(1),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    planId: text("plan_id")
      .notNull()
      .references(() => billingPlans.id, { onDelete: "cascade" }),
    provider: text("provider")
      .notNull()
      .references(() => billingPaymentProviders.provider, {
        onDelete: "restrict",
      }),
    providerPriceId: text("provider_price_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    taxBehavior: text("tax_behavior").notNull(),
    unitAmountMinor: bigint("unit_amount_minor", {
      mode: "number",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    updatedBy: text("updated_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    usageType: text("usage_type").notNull(),
  },
  (table) => [
    index("billing_prices_plan_active_idx").on(
      table.planId,
      table.active,
      table.sortOrder,
    ),
    uniqueIndex("billing_prices_provider_price_unique").on(
      table.provider,
      table.providerPriceId,
    ),
  ],
);

export const billingCustomers = pgTable(
  "billing_customers",
  {
    billingCountry: text("billing_country"),
    billingRegion: text("billing_region"),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    email: text("email"),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    name: text("name"),
    preferredCurrency: text("preferred_currency"),
    provider: text("provider")
      .notNull()
      .references(() => billingPaymentProviders.provider, {
        onDelete: "restrict",
      }),
    providerCustomerId: text("provider_customer_id").notNull(),
    reverseCharge: boolean("reverse_charge").notNull().default(false),
    taxId: text("tax_id"),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("billing_customers_provider_customer_unique").on(
      table.provider,
      table.providerCustomerId,
    ),
    index("billing_customers_tenant_provider_idx").on(
      table.tenantId,
      table.provider,
    ),
  ],
);

export const billingCheckoutSessions = pgTable(
  "billing_checkout_sessions",
  {
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    cancelUrl: text("cancel_url").notNull(),
    clientReferenceId: text("client_reference_id").notNull(),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    currency: text("currency").notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }),
    id: text("id").primaryKey(),
    mode: text("mode").notNull(),
    planId: text("plan_id")
      .notNull()
      .references(() => billingPlans.id, { onDelete: "restrict" }),
    priceId: text("price_id")
      .notNull()
      .references(() => billingPrices.id, { onDelete: "restrict" }),
    provider: text("provider")
      .notNull()
      .references(() => billingPaymentProviders.provider, {
        onDelete: "restrict",
      }),
    providerSessionId: text("provider_session_id").notNull(),
    quantity: integer("quantity").notNull().default(1),
    status: text("status").notNull(),
    successUrl: text("success_url").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    url: text("url").notNull(),
  },
  (table) => [
    uniqueIndex("billing_checkout_sessions_provider_session_unique").on(
      table.provider,
      table.providerSessionId,
    ),
    index("billing_checkout_sessions_tenant_status_idx").on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const billingSubscriptions = pgTable(
  "billing_subscriptions",
  {
    cancelAt: timestamp("cancel_at", { mode: "string", withTimezone: true }),
    canceledAt: timestamp("canceled_at", {
      mode: "string",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", {
      mode: "string",
      withTimezone: true,
    }),
    currentPeriodStart: timestamp("current_period_start", {
      mode: "string",
      withTimezone: true,
    }),
    gracePeriodEndsAt: timestamp("grace_period_ends_at", {
      mode: "string",
      withTimezone: true,
    }),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    planId: text("plan_id")
      .notNull()
      .references(() => billingPlans.id, { onDelete: "restrict" }),
    priceId: text("price_id")
      .notNull()
      .references(() => billingPrices.id, { onDelete: "restrict" }),
    provider: text("provider")
      .notNull()
      .references(() => billingPaymentProviders.provider, {
        onDelete: "restrict",
      }),
    providerCustomerId: text("provider_customer_id"),
    providerSubscriptionId: text("provider_subscription_id").notNull(),
    providerSubscriptionItemId: text("provider_subscription_item_id"),
    quantity: integer("quantity").notNull().default(1),
    status: text("status").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    trialEnd: timestamp("trial_end", { mode: "string", withTimezone: true }),
    trialStart: timestamp("trial_start", {
      mode: "string",
      withTimezone: true,
    }),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("billing_subscriptions_provider_subscription_unique").on(
      table.provider,
      table.providerSubscriptionId,
    ),
    index("billing_subscriptions_tenant_status_idx").on(
      table.tenantId,
      table.status,
      table.currentPeriodEnd,
    ),
  ],
);

export const billingInvoices = pgTable(
  "billing_invoices",
  {
    amountDueMinor: bigint("amount_due_minor", {
      mode: "number",
    }).notNull(),
    amountPaidMinor: bigint("amount_paid_minor", {
      mode: "number",
    }).notNull(),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    currency: text("currency").notNull(),
    discountMinor: bigint("discount_minor", { mode: "number" }).notNull(),
    dueAt: timestamp("due_at", { mode: "string", withTimezone: true }),
    hostedInvoiceUrl: text("hosted_invoice_url"),
    id: text("id").primaryKey(),
    issuedAt: timestamp("issued_at", { mode: "string", withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    paidAt: timestamp("paid_at", { mode: "string", withTimezone: true }),
    periodEnd: timestamp("period_end", {
      mode: "string",
      withTimezone: true,
    }),
    periodStart: timestamp("period_start", {
      mode: "string",
      withTimezone: true,
    }),
    provider: text("provider")
      .notNull()
      .references(() => billingPaymentProviders.provider, {
        onDelete: "restrict",
      }),
    providerCustomerId: text("provider_customer_id"),
    providerInvoiceId: text("provider_invoice_id").notNull(),
    status: text("status").notNull(),
    subscriptionId: text("subscription_id").references(
      () => billingSubscriptions.id,
      { onDelete: "set null" },
    ),
    subtotalMinor: bigint("subtotal_minor", { mode: "number" }).notNull(),
    taxBehavior: text("tax_behavior").notNull(),
    taxMinor: bigint("tax_minor", { mode: "number" }).notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("billing_invoices_provider_invoice_unique").on(
      table.provider,
      table.providerInvoiceId,
    ),
    index("billing_invoices_tenant_status_idx").on(
      table.tenantId,
      table.status,
      table.issuedAt,
    ),
  ],
);

export const billingInvoiceItems = pgTable(
  "billing_invoice_items",
  {
    description: text("description").notNull(),
    discountMinor: bigint("discount_minor", { mode: "number" }).notNull(),
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => billingInvoices.id, { onDelete: "cascade" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    planId: text("plan_id").references(() => billingPlans.id, {
      onDelete: "set null",
    }),
    priceId: text("price_id").references(() => billingPrices.id, {
      onDelete: "set null",
    }),
    quantity: integer("quantity").notNull().default(1),
    subtotalMinor: bigint("subtotal_minor", { mode: "number" }).notNull(),
    taxBreakdown: jsonb("tax_breakdown")
      .$type<Record<string, unknown>[]>()
      .notNull(),
    taxMinor: bigint("tax_minor", { mode: "number" }).notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    unitAmountMinor: bigint("unit_amount_minor", {
      mode: "number",
    }).notNull(),
  },
  (table) => [index("billing_invoice_items_invoice_idx").on(table.invoiceId)],
);

export const billingPaymentMethods = pgTable(
  "billing_payment_methods",
  {
    billingEmail: text("billing_email"),
    billingName: text("billing_name"),
    brand: text("brand"),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    expMonth: integer("exp_month"),
    expYear: integer("exp_year"),
    id: text("id").primaryKey(),
    last4: text("last4"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    provider: text("provider")
      .notNull()
      .references(() => billingPaymentProviders.provider, {
        onDelete: "restrict",
      }),
    providerCustomerId: text("provider_customer_id"),
    providerPaymentMethodId: text("provider_payment_method_id").notNull(),
    status: text("status").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("billing_payment_methods_provider_method_unique").on(
      table.provider,
      table.providerPaymentMethodId,
    ),
    index("billing_payment_methods_tenant_status_idx").on(
      table.tenantId,
      table.status,
    ),
  ],
);

export const billingCoupons = pgTable(
  "billing_coupons",
  {
    active: boolean("active").notNull().default(true),
    amountOffMinor: bigint("amount_off_minor", { mode: "number" }),
    code: text("code").notNull(),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    currency: text("currency"),
    discountType: text("discount_type").notNull(),
    duration: text("duration").notNull(),
    durationMonths: integer("duration_months"),
    id: text("id").primaryKey(),
    maxRedemptions: integer("max_redemptions"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    name: text("name").notNull(),
    percentOffBasisPoints: integer("percent_off_basis_points"),
    provider: text("provider").references(
      () => billingPaymentProviders.provider,
      {
        onDelete: "set null",
      },
    ),
    providerCouponId: text("provider_coupon_id"),
    redeemBy: timestamp("redeem_by", {
      mode: "string",
      withTimezone: true,
    }),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    updatedBy: text("updated_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("billing_coupons_code_unique").on(table.code),
    uniqueIndex("billing_coupons_provider_coupon_unique").on(
      table.provider,
      table.providerCouponId,
    ),
  ],
);

export const billingDiscounts = pgTable(
  "billing_discounts",
  {
    couponId: text("coupon_id")
      .notNull()
      .references(() => billingCoupons.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    endsAt: timestamp("ends_at", { mode: "string", withTimezone: true }),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    provider: text("provider").references(
      () => billingPaymentProviders.provider,
      {
        onDelete: "set null",
      },
    ),
    providerDiscountId: text("provider_discount_id"),
    startsAt: timestamp("starts_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    status: text("status").notNull(),
    subscriptionId: text("subscription_id").references(
      () => billingSubscriptions.id,
      { onDelete: "cascade" },
    ),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    updatedBy: text("updated_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("billing_discounts_tenant_status_idx").on(
      table.tenantId,
      table.status,
      table.startsAt,
    ),
  ],
);

export const billingRefunds = pgTable(
  "billing_refunds",
  {
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    createdBy: text("created_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    currency: text("currency").notNull(),
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id").references(() => billingInvoices.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    provider: text("provider")
      .notNull()
      .references(() => billingPaymentProviders.provider, {
        onDelete: "restrict",
      }),
    providerPaymentId: text("provider_payment_id"),
    providerRefundId: text("provider_refund_id").notNull(),
    reason: text("reason"),
    status: text("status").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("billing_refunds_provider_refund_unique").on(
      table.provider,
      table.providerRefundId,
    ),
    index("billing_refunds_tenant_status_idx").on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const billingUsageMeters = pgTable(
  "billing_usage_meters",
  {
    active: boolean("active").notNull().default(true),
    aggregation: text("aggregation").notNull(),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    name: text("name").notNull(),
    resetInterval: text("reset_interval").notNull(),
    unit: text("unit").notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    updatedBy: text("updated_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
  },
  (table) => [uniqueIndex("billing_usage_meters_key_unique").on(table.key)],
);

export const billingUsageRecords = pgTable(
  "billing_usage_records",
  {
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    meterId: text("meter_id")
      .notNull()
      .references(() => billingUsageMeters.id, { onDelete: "restrict" }),
    occurredAt: timestamp("occurred_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    provider: text("provider").references(
      () => billingPaymentProviders.provider,
      {
        onDelete: "set null",
      },
    ),
    providerRecordId: text("provider_record_id"),
    quantity: bigint("quantity", { mode: "number" }).notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("billing_usage_records_meter_idempotency_unique").on(
      table.tenantId,
      table.meterId,
      table.idempotencyKey,
    ),
    index("billing_usage_records_tenant_occurred_idx").on(
      table.tenantId,
      table.occurredAt,
    ),
  ],
);

export const billingEntitlements = pgTable(
  "billing_entitlements",
  {
    enabled: boolean("enabled").notNull().default(false),
    featureKey: text("feature_key").notNull(),
    limitValue: bigint("limit_value", { mode: "number" }),
    planId: text("plan_id").references(() => billingPlans.id, {
      onDelete: "set null",
    }),
    resetAt: timestamp("reset_at", { mode: "string", withTimezone: true }),
    source: text("source").notNull(),
    subscriptionId: text("subscription_id").references(
      () => billingSubscriptions.id,
      { onDelete: "set null" },
    ),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    usedValue: bigint("used_value", { mode: "number" }).notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.featureKey] }),
    index("billing_entitlements_tenant_enabled_idx").on(
      table.tenantId,
      table.enabled,
    ),
  ],
);

export const billingExchangeRates = pgTable(
  "billing_exchange_rates",
  {
    baseCurrency: text("base_currency").notNull(),
    manual: boolean("manual").notNull().default(false),
    provider: text("provider").notNull(),
    quoteCurrency: text("quote_currency").notNull(),
    rateMicroUnits: bigint("rate_micro_units", { mode: "number" }).notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    updatedBy: text("updated_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    validAt: timestamp("valid_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.baseCurrency, table.quoteCurrency] }),
  ],
);

export const billingTaxSettings = pgTable("billing_tax_settings", {
  billingCountry: text("billing_country"),
  billingRegion: text("billing_region"),
  businessName: text("business_name"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
  provider: text("provider"),
  reverseCharge: boolean("reverse_charge").notNull().default(false),
  taxBehavior: text("tax_behavior").notNull(),
  taxExempt: boolean("tax_exempt").notNull().default(false),
  taxId: text("tax_id"),
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updated_at", {
    mode: "string",
    withTimezone: true,
  }).notNull(),
  updatedBy: text("updated_by").references(() => authUsers.id, {
    onDelete: "set null",
  }),
});

export const billingTaxRates = pgTable(
  "billing_tax_rates",
  {
    active: boolean("active").notNull().default(true),
    country: text("country").notNull(),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    id: text("id").primaryKey(),
    inclusive: boolean("inclusive").notNull().default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    percentageBasisPoints: integer("percentage_basis_points").notNull(),
    provider: text("provider"),
    region: text("region"),
    taxType: text("tax_type").notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    updatedBy: text("updated_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("billing_tax_rates_country_active_idx").on(
      table.country,
      table.region,
      table.active,
    ),
  ],
);

export const billingWebhookEvents = pgTable(
  "billing_webhook_events",
  {
    eventType: text("event_type").notNull(),
    id: text("id").primaryKey(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp("processed_at", {
      mode: "string",
      withTimezone: true,
    }),
    processingError: text("processing_error"),
    provider: text("provider")
      .notNull()
      .references(() => billingPaymentProviders.provider, {
        onDelete: "restrict",
      }),
    providerEventId: text("provider_event_id").notNull(),
    rawBodySha256: text("raw_body_sha256").notNull(),
    receivedAt: timestamp("received_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    signatureHeader: text("signature_header"),
    status: text("status").notNull(),
    tenantId: text("tenant_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("billing_webhook_events_provider_event_unique").on(
      table.provider,
      table.providerEventId,
    ),
    index("billing_webhook_events_status_received_idx").on(
      table.status,
      table.receivedAt,
    ),
  ],
);

export const billingAuditEvents = pgTable(
  "billing_audit_events",
  {
    actorId: text("actor_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    eventType: text("event_type").notNull(),
    id: text("id").primaryKey(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    subjectId: text("subject_id"),
    subjectType: text("subject_type"),
    tenantId: text("tenant_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [
    index("billing_audit_events_tenant_created_idx").on(
      table.tenantId,
      table.createdAt,
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
