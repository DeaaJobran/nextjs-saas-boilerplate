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
