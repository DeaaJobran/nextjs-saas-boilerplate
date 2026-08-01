import { createHash, createHmac, randomUUID } from "node:crypto";

import {
  getDatabaseRuntime,
  type Queryable,
  runMigrations,
} from "@nextjs-saas/db";

import type {
  LegalAcceptance,
  PrivacyExport,
  PrivacyRequest,
  PrivacyRequestStatus,
  PrivacyRequestType,
  RateLimitResult,
  SecuritySeverity,
} from "./types";

type SecurityServiceOptions = {
  client?: Queryable;
  now?: () => Date;
  secret?: string;
};

type LegalAcceptanceRow = {
  accepted_at: Date | string;
  content_hash: string;
  document_id: string | null;
  document_slug: string;
  id: string;
  locale: string;
  metadata: Record<string, unknown> | string;
  tenant_id: string | null;
  user_id: string;
  version: string;
};

type PrivacyRequestRow = {
  completed_at: Date | string | null;
  created_at: Date | string;
  id: string;
  metadata: Record<string, unknown> | string;
  reason: string | null;
  request_type: PrivacyRequestType;
  result: Record<string, unknown> | string;
  status: PrivacyRequestStatus;
  tenant_id: string | null;
  updated_at: Date | string;
  user_id: string;
};

function toIso(value: Date | string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function parseJson<T>(value: T | string, fallback: T): T {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toLegalAcceptance(row: LegalAcceptanceRow): LegalAcceptance {
  return {
    acceptedAt: toIso(row.accepted_at)!,
    contentHash: row.content_hash,
    documentId: row.document_id ?? undefined,
    documentSlug: row.document_slug,
    id: row.id,
    locale: row.locale,
    metadata: parseJson(row.metadata, {}),
    tenantId: row.tenant_id ?? undefined,
    userId: row.user_id,
    version: row.version,
  };
}

function toPrivacyRequest(row: PrivacyRequestRow): PrivacyRequest {
  return {
    completedAt: toIso(row.completed_at),
    createdAt: toIso(row.created_at)!,
    id: row.id,
    metadata: parseJson(row.metadata, {}),
    reason: row.reason ?? undefined,
    result: parseJson(row.result, {}),
    status: row.status,
    tenantId: row.tenant_id ?? undefined,
    type: row.request_type,
    updatedAt: toIso(row.updated_at)!,
    userId: row.user_id,
  };
}

function positiveInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

export function fingerprintLegalDocument(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("base64url");
}

export function createSecurityService(options: SecurityServiceOptions = {}) {
  const now = options.now ?? (() => new Date());
  const configuredSecret =
    options.secret ??
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : "development-security-secret-change-before-production");

  if (!configuredSecret) {
    throw new Error(
      "AUTH_SECRET is required for security identifiers in production.",
    );
  }
  const secret: string = configuredSecret;

  async function getClient() {
    if (options.client) {
      await runMigrations(options.client);
      return options.client;
    }

    const runtime = await getDatabaseRuntime();
    await runMigrations(runtime);
    return runtime;
  }

  function hashSensitive(value: string) {
    return createHmac("sha256", secret).update(value).digest("base64url");
  }

  async function audit(input: {
    actorId?: string;
    eventType: string;
    ipAddress?: string;
    payload?: Record<string, unknown>;
    requestId?: string;
    severity?: SecuritySeverity;
    tenantId?: string;
    userAgent?: string;
    userId?: string;
  }) {
    const client = await getClient();
    await client.execute(
      `
        INSERT INTO security_audit_events (
          id, tenant_id, user_id, actor_id, event_type, severity,
          request_id, ip_address_hash, user_agent_hash, payload, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
      `,
      [
        randomUUID(),
        input.tenantId ?? null,
        input.userId ?? null,
        input.actorId ?? null,
        input.eventType,
        input.severity ?? "info",
        input.requestId ?? null,
        input.ipAddress ? hashSensitive(input.ipAddress) : null,
        input.userAgent ? hashSensitive(input.userAgent) : null,
        JSON.stringify(input.payload ?? {}),
        now().toISOString(),
      ],
    );
  }

  async function consumeRateLimit(input: {
    identifier: string;
    limit: number;
    scope: string;
    tenantId?: string;
    windowSeconds: number;
  }): Promise<RateLimitResult> {
    positiveInteger(input.limit, "Rate limit");
    positiveInteger(input.windowSeconds, "Rate limit window");
    const runtime = options.client ?? (await getDatabaseRuntime());
    await runMigrations(runtime);
    const current = now();
    const windowMs = input.windowSeconds * 1000;
    const windowStart = new Date(
      Math.floor(current.getTime() / windowMs) * windowMs,
    );
    const expiresAt = new Date(windowStart.getTime() + windowMs);
    const identifier = hashSensitive(input.identifier.trim() || "anonymous");
    await runtime.execute(
      "DELETE FROM rate_limit_buckets WHERE expires_at <= $1",
      [current.toISOString()],
    );
    const rows = await runtime.execute<{ count: number }>(
      `
        INSERT INTO rate_limit_buckets (
          id, tenant_id, identifier, scope, window_start,
          window_seconds, count, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 1, $7)
        ON CONFLICT (
          (COALESCE(tenant_id, '')), identifier, scope, window_start
        )
        DO UPDATE SET
          count = rate_limit_buckets.count + 1,
          window_seconds = EXCLUDED.window_seconds,
          expires_at = EXCLUDED.expires_at
        RETURNING count
      `,
      [
        randomUUID(),
        input.tenantId ?? null,
        identifier,
        input.scope,
        windowStart.toISOString(),
        input.windowSeconds,
        expiresAt.toISOString(),
      ],
    );
    const count = Number(rows[0]!.count);

    const allowed = count <= input.limit;
    if (count === input.limit + 1) {
      await audit({
        eventType: "security.rate_limit.exceeded",
        payload: { scope: input.scope },
        severity: "medium",
        tenantId: input.tenantId,
      });
    }

    return {
      allowed,
      limit: input.limit,
      remaining: Math.max(0, input.limit - count),
      resetAt: expiresAt.toISOString(),
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((expiresAt.getTime() - current.getTime()) / 1000),
      ),
    };
  }

  async function acceptLegalDocument(input: {
    contentHash: string;
    documentId?: string;
    documentSlug: string;
    ipAddress?: string;
    locale: string;
    metadata?: Record<string, unknown>;
    tenantId?: string;
    userAgent?: string;
    userId: string;
    version: string;
  }) {
    const client = await getClient();
    const timestamp = now().toISOString();
    const rows = await client.execute<LegalAcceptanceRow>(
      `
        INSERT INTO legal_acceptances (
          id, user_id, tenant_id, document_id, document_slug, locale,
          version, content_hash, ip_address_hash, user_agent_hash,
          metadata, accepted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
        ON CONFLICT (user_id, document_slug, locale, version) DO UPDATE SET
          content_hash = EXCLUDED.content_hash,
          tenant_id = EXCLUDED.tenant_id,
          metadata = EXCLUDED.metadata,
          accepted_at = EXCLUDED.accepted_at
        RETURNING *
      `,
      [
        randomUUID(),
        input.userId,
        input.tenantId ?? null,
        input.documentId ?? null,
        input.documentSlug,
        input.locale,
        input.version,
        input.contentHash,
        input.ipAddress ? hashSensitive(input.ipAddress) : null,
        input.userAgent ? hashSensitive(input.userAgent) : null,
        JSON.stringify(input.metadata ?? {}),
        timestamp,
      ],
    );
    await audit({
      eventType: "privacy.legal_document.accepted",
      ipAddress: input.ipAddress,
      payload: {
        documentSlug: input.documentSlug,
        locale: input.locale,
        version: input.version,
      },
      tenantId: input.tenantId,
      userAgent: input.userAgent,
      userId: input.userId,
    });

    return toLegalAcceptance(rows[0]!);
  }

  async function listLegalAcceptances(userId: string) {
    const client = await getClient();
    const rows = await client.execute<LegalAcceptanceRow>(
      "SELECT * FROM legal_acceptances WHERE user_id = $1 ORDER BY accepted_at DESC",
      [userId],
    );

    return rows.map(toLegalAcceptance);
  }

  async function requestPrivacyAction(input: {
    metadata?: Record<string, unknown>;
    reason?: string;
    tenantId?: string;
    type: PrivacyRequestType;
    userId: string;
  }) {
    const client = await getClient();
    const timestamp = now().toISOString();
    const rows = await client.execute<PrivacyRequestRow>(
      `
        INSERT INTO privacy_requests (
          id, user_id, tenant_id, request_type, status, reason,
          metadata, result, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, 'requested', $5, $6::jsonb, '{}'::jsonb, $7, $7)
        RETURNING *
      `,
      [
        randomUUID(),
        input.userId,
        input.tenantId ?? null,
        input.type,
        input.reason?.trim() || null,
        JSON.stringify(input.metadata ?? {}),
        timestamp,
      ],
    );
    await audit({
      eventType: `privacy.${input.type}.requested`,
      tenantId: input.tenantId,
      userId: input.userId,
    });

    return toPrivacyRequest(rows[0]!);
  }

  async function updatePrivacyRequest(input: {
    id: string;
    result?: Record<string, unknown>;
    status: Exclude<PrivacyRequestStatus, "requested">;
    userId: string;
  }) {
    const client = await getClient();
    const timestamp = now().toISOString();
    const rows = await client.execute<PrivacyRequestRow>(
      `
        UPDATE privacy_requests
        SET status = $1,
            result = $2::jsonb,
            completed_at = CASE
              WHEN $1 IN ('completed', 'failed') THEN $3::timestamptz
              ELSE NULL
            END,
            updated_at = $3
        WHERE id = $4 AND user_id = $5
        RETURNING *
      `,
      [
        input.status,
        JSON.stringify(input.result ?? {}),
        timestamp,
        input.id,
        input.userId,
      ],
    );

    if (!rows[0]) {
      throw new Error("Privacy request not found.");
    }

    await audit({
      eventType: `privacy.request.${input.status}`,
      payload: { requestId: input.id },
      userId: input.userId,
    });
    return toPrivacyRequest(rows[0]);
  }

  async function listPrivacyRequests(userId: string) {
    const client = await getClient();
    const rows = await client.execute<PrivacyRequestRow>(
      "SELECT * FROM privacy_requests WHERE user_id = $1 ORDER BY created_at DESC",
      [userId],
    );

    return rows.map(toPrivacyRequest);
  }

  async function createPrivacyExport(input: {
    requestId: string;
    userId: string;
  }): Promise<PrivacyExport> {
    const client = await getClient();
    const sections = Object.fromEntries(
      await Promise.all(
        [
          [
            "identity",
            `SELECT id, email, display_name, locale, role, email_verified_at,
                    password_updated_at, created_at, updated_at, deletion_requested_at,
                    deleted_at
             FROM auth_users WHERE id = $1`,
          ],
          [
            "accounts",
            `SELECT provider, provider_account_id, provider_email, created_at, updated_at
             FROM auth_accounts WHERE user_id = $1`,
          ],
          [
            "sessions",
            `SELECT id, device_name, last_seen_at, created_at, expires_at, revoked_at
             FROM auth_sessions WHERE user_id = $1`,
          ],
          [
            "authAudit",
            `SELECT event_type, payload, created_at
             FROM auth_audit_events WHERE user_id = $1 OR actor_id = $1`,
          ],
          [
            "memberships",
            `SELECT organization_id, role, status, custom_permissions, joined_at, removed_at
             FROM organization_memberships WHERE user_id = $1`,
          ],
          [
            "notifications",
            `SELECT tenant_id, event_type, title, body, action_url, metadata,
                    read_at, dismissed_at, created_at
             FROM in_app_notifications WHERE user_id = $1`,
          ],
          [
            "notificationPreferences",
            `SELECT tenant_id, event_type, email_enabled, in_app_enabled,
                    push_enabled, sms_enabled, locale, quiet_hours, created_at, updated_at
             FROM notification_preferences WHERE user_id = $1`,
          ],
          [
            "files",
            `SELECT id, tenant_id, visibility, file_name, content_type, byte_size,
                    status, metadata, created_at, uploaded_at, deleted_at
             FROM storage_files WHERE owner_id = $1`,
          ],
          [
            "legalAcceptances",
            `SELECT document_slug, locale, version, content_hash, metadata, accepted_at
             FROM legal_acceptances WHERE user_id = $1`,
          ],
          [
            "privacyRequests",
            `SELECT id, tenant_id, request_type, status, reason, metadata,
                    result, created_at, completed_at, updated_at
             FROM privacy_requests WHERE user_id = $1`,
          ],
        ].map(async ([name, query]) => [
          name,
          await client.execute(query!, [input.userId]),
        ]),
      ),
    );
    const exported: PrivacyExport = {
      generatedAt: now().toISOString(),
      requestId: input.requestId,
      schemaVersion: "1",
      sections,
      userId: input.userId,
    };

    await updatePrivacyRequest({
      id: input.requestId,
      result: { generatedAt: exported.generatedAt, schemaVersion: "1" },
      status: "completed",
      userId: input.userId,
    });
    return exported;
  }

  return {
    acceptLegalDocument,
    audit,
    consumeRateLimit,
    createPrivacyExport,
    hashSensitive,
    listLegalAcceptances,
    listPrivacyRequests,
    requestPrivacyAction,
    updatePrivacyRequest,
  };
}
