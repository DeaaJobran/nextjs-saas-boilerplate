import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  AuthError,
  type AuthSession,
  createAuthService,
} from "@nextjs-saas/auth";
import {
  createApiKeySecret,
  getDatabaseRuntime,
  hashApiKey,
  type Queryable,
  runMigrations,
  verifyApiKeySecret,
} from "@nextjs-saas/db";
import {
  createTenantService,
  TenantError,
  type TenantPermission,
} from "@nextjs-saas/tenant";
import { z } from "zod";

import {
  apiResponseEnvelopeSchema,
  type ApiScope,
  apiScopeCatalog,
} from "./contracts";

const defaultIdempotencyTtlSeconds = 24 * 60 * 60;
const defaultMobileUploadTtlSeconds = 15 * 60;

type TransactionalQueryable = Queryable & {
  transaction<T>(callback: (client: Queryable) => Promise<T>): Promise<T>;
};

export type OAuthProviderAdapter = {
  authorizationEndpoint: string;
  clientId: string;
  clientSecret: string;
  mapProfile: (profile: Record<string, unknown>) => {
    avatarUrl?: string;
    displayName: string;
    email: string;
    emailVerified?: boolean;
    providerAccountId: string;
  };
  provider: string;
  scopes: string[];
  tokenEndpoint: string;
  userInfoEndpoint: string;
};

export type ApiServiceOptions = {
  appBaseUrl?: string;
  authSecret?: string;
  client?: Queryable;
  corsOrigins?: string[];
  deepLinkSecret?: string;
  idempotencyTtlSeconds?: number;
  lookupHashSecret?: string;
  mobileUploadTtlSeconds?: number;
  now?: () => Date;
  oauthAdapters?: OAuthProviderAdapter[];
};

export type ApiPrincipal =
  | {
      actorId: string;
      apiKeyId: string;
      keyPrefix: string;
      scopes: string[];
      tenantId?: undefined;
      type: "personal_access_token";
    }
  | {
      actorId?: string;
      apiKeyId: string;
      keyPrefix: string;
      scopes: string[];
      tenantId: string;
      type: "tenant_api_key";
    }
  | {
      actorId: string;
      mobileDeviceId: string;
      mobileSessionId: string;
      scopes: string[];
      session: AuthSession;
      tenantId?: undefined;
      type: "mobile_session";
    };

export type ApiRequestContext = {
  idempotencyKey?: string;
  ipAddress?: string;
  requestId?: string;
  userAgent?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

type ApiKeyRow = {
  created_by: string | null;
  expires_at: Date | string | null;
  id: string;
  key_hash: string;
  key_prefix: string;
  revoked_at: Date | string | null;
  scopes: string[] | string;
  tenant_id: string | null;
};

type MobileSessionRow = {
  auth_session_id: string;
  device_id: string;
  id: string;
  revoked_at: Date | string | null;
  user_id: string;
};

type OrganizationRow = {
  created_at: Date | string;
  created_by: string | null;
  default_locale: string;
  deleted_at: Date | string | null;
  description: string | null;
  id: string;
  logo_url: string | null;
  name: string;
  slug: string;
  status: string;
  updated_at: Date | string;
  updated_by: string | null;
  website_url: string | null;
};

type MemberRow = {
  avatar_url: string | null;
  custom_permissions: string[] | string;
  display_name: string;
  email: string;
  joined_at: Date | string;
  role: string;
  status: string;
  user_id: string;
};

type EventRow = {
  created_at: Date | string;
  event_type: string;
  id: string;
  occurred_at: Date | string;
  payload: Record<string, unknown> | string;
  source: string;
  subject_id: string | null;
  subject_type: string | null;
  tenant_id: string | null;
};

type WebhookEndpointRow = {
  active: boolean;
  created_at: Date | string;
  created_by: string | null;
  description: string | null;
  event_types: string[] | string;
  id: string;
  secret_prefix: string;
  tenant_id: string;
  updated_at: Date | string;
  updated_by: string | null;
  url: string;
};

type MobileDeviceRow = {
  app_version: string | null;
  created_at: Date | string;
  device_fingerprint_hash: string | null;
  device_name: string;
  id: string;
  last_seen_at: Date | string;
  platform: string;
  revoked_at: Date | string | null;
  updated_at: Date | string;
  user_id: string;
};

type MobileUploadIntentRow = {
  byte_size: number | string;
  checksum_sha256: string | null;
  content_type: string;
  created_at: Date | string;
  expires_at: Date | string;
  file_name: string;
  id: string;
  metadata: Record<string, unknown> | string;
  status: string;
  tenant_id: string;
  uploaded_at: Date | string | null;
  user_id: string;
};

function defaultAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function getDefaultCorsOrigins(appBaseUrl: string) {
  const configured = process.env.API_CORS_ORIGINS;

  if (configured) {
    return configured
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return [appBaseUrl];
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

function hashApiLookupValue(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function hashMobileSessionFamily(sessionId: string) {
  return hashApiKey(`mobile-session:${sessionId}`);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function parseJson<T>(value: T | string | null | undefined, fallback: T): T {
  if (value === null || value === undefined) {
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

function requestHash(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("base64url");
}

function normalizeBearerToken(authorizationHeader?: string | null) {
  const [scheme, token, extra] = (authorizationHeader ?? "").split(/\s+/u);

  if (scheme?.toLowerCase() !== "bearer" || !token || extra) {
    throw new ApiError(
      "Bearer authentication is required.",
      "unauthorized",
      401,
    );
  }

  return token;
}

function normalizeScopes(scopes: unknown) {
  const list = Array.isArray(scopes) ? scopes : [];

  return [
    ...new Set(
      list
        .filter((scope): scope is string => typeof scope === "string")
        .map((scope) => scope.trim())
        .filter(Boolean),
    ),
  ];
}

function assertValidApiScopes(scopes: readonly string[]) {
  const normalized = normalizeScopes(scopes);
  const invalid = normalized.filter(
    (scope) => !(apiScopeCatalog as readonly string[]).includes(scope),
  );

  if (invalid.length > 0) {
    throw new ApiError("Invalid API scope.", "invalid_scope", 400, {
      scopes: invalid,
    });
  }

  return normalized as ApiScope[];
}

function scopeImplies(heldScope: string, requiredScope: string) {
  if (heldScope === "*" || heldScope === requiredScope) {
    return true;
  }

  if (heldScope.endsWith(":*")) {
    return requiredScope.startsWith(heldScope.slice(0, -1));
  }

  const impliedScopes: Record<string, string[]> = {
    "api:write": ["api:read"],
    "api_keys:read": ["webhooks:read"],
    "api_keys:write": ["api_keys:read", "webhooks:read", "webhooks:write"],
    "audit:read": ["events:read"],
    "tenant:read": ["api:read"],
    "tenant:write": ["tenant:read", "api:write", "events:write"],
  };

  return impliedScopes[heldScope]?.includes(requiredScope) ?? false;
}

function assertScopes(
  principal: Pick<ApiPrincipal, "scopes">,
  requiredScopes: readonly string[],
) {
  const missingScopes = requiredScopes.filter(
    (requiredScope) =>
      !principal.scopes.some((heldScope) =>
        scopeImplies(heldScope, requiredScope),
      ),
  );

  if (missingScopes.length > 0) {
    throw new ApiError("API token scope is insufficient.", "forbidden", 403, {
      missingScopes,
    });
  }
}

function permissionForScopes(scopes: readonly string[]): TenantPermission {
  if (scopes.some((scope) => scope.endsWith(":write"))) {
    if (scopes.some((scope) => scope.startsWith("members:"))) {
      return "members.update";
    }

    if (scopes.some((scope) => scope.startsWith("billing:"))) {
      return "billing.manage";
    }

    if (scopes.some((scope) => scope.startsWith("webhooks:"))) {
      return "api_keys.manage";
    }

    return "organization.update";
  }

  if (scopes.some((scope) => scope.startsWith("members:"))) {
    return "members.read";
  }

  if (scopes.some((scope) => scope.startsWith("billing:"))) {
    return "billing.read";
  }

  if (
    scopes.some(
      (scope) => scope.startsWith("events:") || scope.startsWith("audit:"),
    )
  ) {
    return "audit.read";
  }

  if (scopes.some((scope) => scope.startsWith("webhooks:"))) {
    return "api_keys.manage";
  }

  return "organization.read";
}

function toOrganization(row: OrganizationRow) {
  return {
    createdAt: toIsoString(row.created_at)!,
    createdBy: row.created_by ?? undefined,
    defaultLocale: row.default_locale,
    description: row.description ?? undefined,
    id: row.id,
    logoUrl: row.logo_url ?? undefined,
    name: row.name,
    slug: row.slug,
    status: row.status,
    updatedAt: toIsoString(row.updated_at)!,
    updatedBy: row.updated_by ?? undefined,
    websiteUrl: row.website_url ?? undefined,
  };
}

function toMember(row: MemberRow) {
  return {
    avatarUrl: row.avatar_url ?? undefined,
    customPermissions: normalizeScopes(
      parseJson<string[] | string>(row.custom_permissions, []),
    ),
    displayName: row.display_name,
    email: row.email,
    joinedAt: toIsoString(row.joined_at)!,
    role: row.role,
    status: row.status,
    userId: row.user_id,
  };
}

function toEvent(row: EventRow) {
  return {
    createdAt: toIsoString(row.created_at)!,
    eventType: row.event_type,
    id: row.id,
    occurredAt: toIsoString(row.occurred_at)!,
    payload: parseJson<Record<string, unknown>>(row.payload, {}),
    source: row.source,
    subjectId: row.subject_id ?? undefined,
    subjectType: row.subject_type ?? undefined,
    tenantId: row.tenant_id ?? undefined,
  };
}

function toWebhookEndpoint(row: WebhookEndpointRow) {
  return {
    active: row.active,
    createdAt: toIsoString(row.created_at)!,
    createdBy: row.created_by ?? undefined,
    description: row.description ?? undefined,
    eventTypes: normalizeScopes(parseJson<string[]>(row.event_types, [])),
    id: row.id,
    secretPrefix: row.secret_prefix,
    tenantId: row.tenant_id,
    updatedAt: toIsoString(row.updated_at)!,
    updatedBy: row.updated_by ?? undefined,
    url: row.url,
  };
}

function getPrincipalApiKeyId(principal?: ApiPrincipal) {
  return principal && "apiKeyId" in principal ? principal.apiKeyId : null;
}

function toMobileDevice(row: MobileDeviceRow) {
  return {
    appVersion: row.app_version ?? undefined,
    createdAt: toIsoString(row.created_at)!,
    deviceName: row.device_name,
    id: row.id,
    lastSeenAt: toIsoString(row.last_seen_at)!,
    platform: row.platform,
    revokedAt: toIsoString(row.revoked_at),
    updatedAt: toIsoString(row.updated_at)!,
    userId: row.user_id,
  };
}

function toMobileUploadIntent(row: MobileUploadIntentRow) {
  return {
    byteSize: toNumber(row.byte_size),
    checksumSha256: row.checksum_sha256 ?? undefined,
    contentType: row.content_type,
    createdAt: toIsoString(row.created_at)!,
    expiresAt: toIsoString(row.expires_at)!,
    fileName: row.file_name,
    id: row.id,
    metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
    status: row.status,
    tenantId: row.tenant_id,
    uploadedAt: toIsoString(row.uploaded_at),
    userId: row.user_id,
  };
}

function toApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof TenantError) {
    return new ApiError(
      error.message,
      error.code,
      error.code === "forbidden" ? 403 : 400,
    );
  }

  if (error instanceof AuthError) {
    const status = ["invalid_credentials", "invalid_refresh_token"].includes(
      error.code,
    )
      ? 401
      : 400;

    return new ApiError(error.message, error.code, status);
  }

  if (error instanceof z.ZodError) {
    return new ApiError(
      "Request validation failed.",
      "validation_failed",
      400,
      {
        issues: error.issues,
      },
    );
  }

  return new ApiError("Unexpected API error.", "internal_error", 500);
}

function signingHeader(input: {
  payload: string;
  secret: string;
  timestamp: number;
}) {
  const signature = createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.payload}`)
    .digest("hex");

  return `t=${input.timestamp},v1=${signature}`;
}

function signatureMatches(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function apiSuccess<T>(data: T, meta?: Record<string, unknown>) {
  return apiResponseEnvelopeSchema.parse(meta ? { data, meta } : { data }) as {
    data: T;
    meta?: Record<string, unknown>;
  };
}

export function apiFailure(error: unknown, requestId: string = randomUUID()) {
  const apiError = toApiError(error);

  return {
    body: {
      code: apiError.code,
      details: apiError.details,
      message: apiError.message,
      requestId,
    },
    status: apiError.status,
  };
}

export function createApiService(options: ApiServiceOptions = {}) {
  const now = options.now ?? (() => new Date());
  const appBaseUrl = options.appBaseUrl ?? defaultAppBaseUrl();
  const corsOrigins = options.corsOrigins ?? getDefaultCorsOrigins(appBaseUrl);
  const idempotencyTtlSeconds =
    options.idempotencyTtlSeconds ?? defaultIdempotencyTtlSeconds;
  const mobileUploadTtlSeconds =
    options.mobileUploadTtlSeconds ?? defaultMobileUploadTtlSeconds;
  const oauthAdapters = new Map(
    (options.oauthAdapters ?? []).map((adapter) => [adapter.provider, adapter]),
  );

  async function getClient() {
    if (options.client) {
      await runMigrations(options.client);

      return options.client;
    }

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);

    return runtime;
  }

  async function withTransaction<T>(
    client: Queryable,
    callback: (transaction: Queryable) => Promise<T>,
  ) {
    if (
      "transaction" in client &&
      typeof (client as Partial<TransactionalQueryable>).transaction ===
        "function"
    ) {
      return (client as TransactionalQueryable).transaction(callback);
    }

    return callback(client);
  }

  function getAuth() {
    return createAuthService({
      appBaseUrl,
      authSecret: options.authSecret ?? process.env.AUTH_SECRET,
      client: options.client,
      now,
    });
  }

  function getTenant(client: Queryable) {
    return createTenantService({
      appBaseUrl,
      client,
      now,
    });
  }

  function getDeepLinkSecret() {
    const secret =
      options.deepLinkSecret ??
      process.env.MOBILE_DEEP_LINK_SECRET ??
      process.env.AUTH_SECRET;

    if (secret) {
      return secret;
    }

    if (process.env.NODE_ENV === "production") {
      throw new ApiError(
        "MOBILE_DEEP_LINK_SECRET or AUTH_SECRET is required in production.",
        "signing_secret_missing",
        500,
      );
    }

    return "development-mobile-deep-link-secret-change-before-production";
  }

  function getLookupHashSecret() {
    const secret =
      options.lookupHashSecret ??
      process.env.API_LOOKUP_HASH_SECRET ??
      options.authSecret ??
      process.env.AUTH_SECRET;

    if (secret) {
      return secret;
    }

    if (process.env.NODE_ENV === "production") {
      throw new ApiError(
        "API_LOOKUP_HASH_SECRET or AUTH_SECRET is required in production.",
        "lookup_hash_secret_missing",
        500,
      );
    }

    return "development-api-lookup-hash-secret-change-before-production";
  }

  function hashLookupToken(value: string) {
    return hashApiLookupValue(value, getLookupHashSecret());
  }

  async function getActiveOrganization(
    client: Queryable,
    organizationId: string,
  ) {
    const rows = await client.execute<OrganizationRow>(
      `
        SELECT *
        FROM organizations
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [organizationId],
    );
    const organization = rows[0];

    if (!organization || organization.status !== "active") {
      throw new ApiError(
        "Organization not found.",
        "organization_not_found",
        404,
      );
    }

    return organization;
  }

  async function authenticateApiKey(
    client: Queryable,
    secret: string,
  ): Promise<ApiPrincipal | undefined> {
    const keyPrefix = secret.slice(0, 12);
    const rows = await client.execute<ApiKeyRow>(
      `
        SELECT id, tenant_id, created_by, key_prefix, key_hash, scopes, expires_at, revoked_at
        FROM api_keys
        WHERE key_prefix = $1
          AND deleted_at IS NULL
          AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at > $2)
        ORDER BY created_at DESC
      `,
      [keyPrefix, now().toISOString()],
    );
    const matchingKey = rows.find((row) =>
      verifyApiKeySecret(secret, row.key_hash),
    );

    if (!matchingKey) {
      return undefined;
    }

    await client.execute(
      "UPDATE api_keys SET last_used_at = $1 WHERE id = $2",
      [now().toISOString(), matchingKey.id],
    );

    const scopes = normalizeScopes(parseJson<unknown>(matchingKey.scopes, []));

    if (matchingKey.tenant_id) {
      await getActiveOrganization(client, matchingKey.tenant_id);

      return {
        actorId: matchingKey.created_by ?? undefined,
        apiKeyId: matchingKey.id,
        keyPrefix: matchingKey.key_prefix,
        scopes,
        tenantId: matchingKey.tenant_id,
        type: "tenant_api_key",
      };
    }

    if (!matchingKey.created_by) {
      throw new ApiError(
        "Personal access token is missing an owner.",
        "invalid_token",
        401,
      );
    }

    const userRows = await client.execute<{ id: string }>(
      `
        SELECT id
        FROM auth_users
        WHERE id = $1
          AND deleted_at IS NULL
          AND disabled_at IS NULL
        LIMIT 1
      `,
      [matchingKey.created_by],
    );

    if (!userRows[0]) {
      throw new ApiError(
        "Personal access token owner is inactive.",
        "invalid_token",
        401,
      );
    }

    return {
      actorId: matchingKey.created_by,
      apiKeyId: matchingKey.id,
      keyPrefix: matchingKey.key_prefix,
      scopes,
      type: "personal_access_token",
    };
  }

  async function authenticateMobileSession(
    client: Queryable,
    sessionToken: string,
  ): Promise<ApiPrincipal | undefined> {
    const sessionLookup = await getAuth().getSession(sessionToken);

    if (!sessionLookup) {
      return undefined;
    }

    const rows = await client.execute<MobileSessionRow>(
      `
        SELECT id, device_id, auth_session_id, user_id, revoked_at
        FROM mobile_sessions
        WHERE auth_session_id = $1
          AND revoked_at IS NULL
        LIMIT 1
      `,
      [sessionLookup.session.id],
    );
    const mobileSession = rows[0];

    if (!mobileSession) {
      return undefined;
    }

    return {
      actorId: sessionLookup.user.id,
      mobileDeviceId: mobileSession.device_id,
      mobileSessionId: mobileSession.id,
      scopes: [
        "api:read",
        "mobile:sessions",
        "mobile:devices",
        "mobile:push",
        "mobile:uploads",
      ],
      session: sessionLookup.session,
      type: "mobile_session",
    };
  }

  async function authenticateBearerToken(input: {
    authorizationHeader?: string | null;
  }) {
    const token = normalizeBearerToken(input.authorizationHeader);
    const client = await getClient();
    const apiKeyPrincipal = await authenticateApiKey(client, token);

    if (apiKeyPrincipal) {
      return apiKeyPrincipal;
    }

    const mobilePrincipal = await authenticateMobileSession(client, token);

    if (mobilePrincipal) {
      return mobilePrincipal;
    }

    throw new ApiError("API token is invalid.", "unauthorized", 401);
  }

  async function authorizeTenantAccess(input: {
    organizationId: string;
    principal: ApiPrincipal;
    requiredScopes: readonly string[];
  }) {
    assertScopes(input.principal, input.requiredScopes);

    const client = await getClient();
    await getActiveOrganization(client, input.organizationId);

    if (input.principal.type === "tenant_api_key") {
      if (input.principal.tenantId !== input.organizationId) {
        throw new ApiError(
          "API key cannot access this tenant.",
          "forbidden",
          403,
        );
      }

      return;
    }

    await getTenant(client).requireMembership({
      organizationId: input.organizationId,
      permission: permissionForScopes(input.requiredScopes),
      userId: input.principal.actorId,
    });
  }

  async function recordApiRequest(input: {
    context?: ApiRequestContext;
    durationMs?: number;
    errorCode?: string;
    method: string;
    path: string;
    principal?: ApiPrincipal;
    routeId: string;
    statusCode: number;
    tenantId?: string;
  }) {
    const client = await getClient();
    const timestamp = now().toISOString();
    const tenantId = input.tenantId ?? input.principal?.tenantId ?? null;
    const actorId = input.principal?.actorId ?? null;
    const apiKeyId = getPrincipalApiKeyId(input.principal) ?? null;

    await client.execute(
      `
        INSERT INTO api_audit_events (
          id,
          tenant_id,
          actor_id,
          api_key_id,
          request_id,
          method,
          path,
          status_code,
          error_code,
          ip_address,
          user_agent,
          idempotency_key,
          duration_ms,
          metadata,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
      `,
      [
        randomUUID(),
        tenantId,
        actorId,
        apiKeyId,
        input.context?.requestId ?? randomUUID(),
        input.method,
        input.path,
        input.statusCode,
        input.errorCode ?? null,
        input.context?.ipAddress ?? null,
        input.context?.userAgent ?? null,
        input.context?.idempotencyKey ?? null,
        Math.max(0, Math.round(input.durationMs ?? 0)),
        JSON.stringify({
          principalType: input.principal?.type,
          routeId: input.routeId,
        }),
        timestamp,
      ],
    );

    await client.execute(
      `
        INSERT INTO api_usage_records (
          id,
          tenant_id,
          actor_id,
          api_key_id,
          route_id,
          method,
          path,
          status_code,
          request_units,
          occurred_at,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10::jsonb)
      `,
      [
        randomUUID(),
        tenantId,
        actorId,
        apiKeyId,
        input.routeId,
        input.method,
        input.path,
        input.statusCode,
        timestamp,
        JSON.stringify({ principalType: input.principal?.type }),
      ],
    );
  }

  async function withIdempotency<T extends Record<string, unknown>>(input: {
    handler: () => Promise<{ body: T; status: number }>;
    key?: string;
    requestBody: unknown;
    scope: string;
    tenantId?: string;
  }) {
    if (!input.key) {
      return { cached: false, ...(await input.handler()) };
    }

    if (input.key.length < 8 || input.key.length > 160) {
      throw new ApiError(
        "Idempotency key must be 8-160 characters.",
        "invalid_idempotency_key",
      );
    }

    const client = await getClient();
    const timestamp = now();
    const storedKey = `${input.tenantId ?? "global"}:${input.scope}:${input.key}`;
    const bodyHash = requestHash(input.requestBody);
    const insertedRows = await client.execute<{ key: string }>(
      `
        INSERT INTO idempotency_keys (
          key,
          tenant_id,
          scope,
          request_hash,
          locked_until,
          expires_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        ON CONFLICT (key) DO NOTHING
        RETURNING key
      `,
      [
        storedKey,
        input.tenantId ?? null,
        input.scope,
        bodyHash,
        addSeconds(timestamp, 60).toISOString(),
        addSeconds(timestamp, idempotencyTtlSeconds).toISOString(),
        timestamp.toISOString(),
      ],
    );

    if (!insertedRows[0]) {
      const rows = await client.execute<{
        request_hash: string;
        response_body: Record<string, unknown> | string | null;
        response_status: number | null;
      }>(
        "SELECT request_hash, response_body, response_status FROM idempotency_keys WHERE key = $1",
        [storedKey],
      );
      const existing = rows[0];

      if (!existing || existing.request_hash !== bodyHash) {
        throw new ApiError(
          "Idempotency key was reused with a different request body.",
          "idempotency_conflict",
          409,
        );
      }

      if (
        existing.response_body !== null &&
        existing.response_status !== null
      ) {
        return {
          body: parseJson<Record<string, unknown>>(
            existing.response_body,
            {},
          ) as T,
          cached: true,
          status: existing.response_status,
        };
      }

      throw new ApiError(
        "A request with this idempotency key is already in progress.",
        "idempotency_in_progress",
        409,
      );
    }

    const response = await input.handler();

    await client.execute(
      `
        UPDATE idempotency_keys
        SET response_status = $1,
            response_body = $2::jsonb,
            locked_until = NULL,
            updated_at = $3
        WHERE key = $4
      `,
      [
        response.status,
        JSON.stringify(response.body),
        now().toISOString(),
        storedKey,
      ],
    );

    return { cached: false, ...response };
  }

  async function createPersonalAccessToken(input: {
    actorId: string;
    expiresAt?: string;
    name: string;
    scopes: readonly string[];
  }) {
    const scopes = assertValidApiScopes(input.scopes);
    const client = await getClient();
    const timestamp = now().toISOString();
    const { hash, secret } = createApiKeySecret("nsp");
    const keyPrefix = secret.slice(0, 12);
    const rows = await client.execute<{
      created_at: Date | string;
      expires_at: Date | string | null;
      id: string;
      key_prefix: string;
      name: string;
      scopes: string[] | string;
    }>(
      `
        INSERT INTO api_keys (
          id,
          tenant_id,
          name,
          key_prefix,
          key_hash,
          scopes,
          expires_at,
          created_at,
          created_by,
          updated_at,
          updated_by
        )
        VALUES ($1, NULL, $2, $3, $4, $5::jsonb, $6, $7, $8, $7, $8)
        RETURNING id, name, key_prefix, scopes, expires_at, created_at
      `,
      [
        randomUUID(),
        input.name.trim(),
        keyPrefix,
        hash,
        JSON.stringify(scopes),
        input.expiresAt ?? null,
        timestamp,
        input.actorId,
      ],
    );
    const row = rows[0]!;

    return {
      token: {
        createdAt: toIsoString(row.created_at)!,
        expiresAt: toIsoString(row.expires_at),
        id: row.id,
        keyPrefix: row.key_prefix,
        name: row.name,
        scopes: normalizeScopes(parseJson<unknown>(row.scopes, [])),
      },
      secret,
    };
  }

  async function getOrganization(input: {
    organizationId: string;
    principal: ApiPrincipal;
  }) {
    await authorizeTenantAccess({
      organizationId: input.organizationId,
      principal: input.principal,
      requiredScopes: ["tenant:read"],
    });

    return toOrganization(
      await getActiveOrganization(await getClient(), input.organizationId),
    );
  }

  async function listOrganizationMembers(input: {
    organizationId: string;
    principal: ApiPrincipal;
  }) {
    await authorizeTenantAccess({
      organizationId: input.organizationId,
      principal: input.principal,
      requiredScopes: ["members:read"],
    });

    const client = await getClient();
    const rows = await client.execute<MemberRow>(
      `
        SELECT
          m.user_id,
          m.role,
          m.status,
          m.custom_permissions,
          m.joined_at,
          u.display_name,
          u.email,
          u.avatar_url
        FROM organization_memberships m
        INNER JOIN auth_users u ON u.id = m.user_id
        WHERE m.organization_id = $1
          AND m.status = 'active'
          AND m.removed_at IS NULL
          AND u.deleted_at IS NULL
        ORDER BY
          CASE m.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
          u.display_name ASC
      `,
      [input.organizationId],
    );

    return rows.map(toMember);
  }

  async function listEvents(input: {
    cursor?: string;
    eventType?: string;
    limit: number;
    organizationId: string;
    principal: ApiPrincipal;
    sort: "asc" | "desc";
  }) {
    await authorizeTenantAccess({
      organizationId: input.organizationId,
      principal: input.principal,
      requiredScopes: ["events:read"],
    });

    const client = await getClient();
    const params: unknown[] = [input.organizationId];
    const filters = ["tenant_id = $1"];

    if (input.eventType) {
      params.push(input.eventType);
      filters.push(`event_type = $${params.length}`);
    }

    if (input.cursor) {
      params.push(input.cursor);
      filters.push(
        input.sort === "asc"
          ? `occurred_at > $${params.length}`
          : `occurred_at < $${params.length}`,
      );
    }

    params.push(input.limit + 1);

    const rows = await client.execute<EventRow>(
      `
        SELECT *
        FROM event_log
        WHERE ${filters.join(" AND ")}
        ORDER BY occurred_at ${input.sort === "asc" ? "ASC" : "DESC"}
        LIMIT $${params.length}
      `,
      params,
    );
    const items = rows.slice(0, input.limit).map(toEvent);
    const nextCursor =
      rows.length > input.limit ? items.at(-1)?.occurredAt : undefined;

    return { items, nextCursor };
  }

  async function createEvent(input: {
    eventType: string;
    organizationId: string;
    payload?: Record<string, unknown>;
    principal: ApiPrincipal;
    subjectId?: string;
    subjectType?: string;
  }) {
    await authorizeTenantAccess({
      organizationId: input.organizationId,
      principal: input.principal,
      requiredScopes: ["events:write"],
    });

    const client = await getClient();
    const timestamp = now().toISOString();
    const eventId = randomUUID();

    await client.execute(
      `
        INSERT INTO event_log (
          id,
          tenant_id,
          source,
          event_type,
          subject_type,
          subject_id,
          payload,
          occurred_at,
          created_at
        )
        VALUES ($1, $2, 'public_api', $3, $4, $5, $6::jsonb, $7, $7)
      `,
      [
        eventId,
        input.organizationId,
        input.eventType,
        input.subjectType ?? null,
        input.subjectId ?? null,
        JSON.stringify(input.payload ?? {}),
        timestamp,
      ],
    );
    await client.execute(
      `
        INSERT INTO outbox_events (
          id,
          tenant_id,
          event_type,
          payload,
          status,
          attempts,
          available_at,
          idempotency_key,
          created_at,
          updated_at
        )
        SELECT $1, $2, 'api.webhook.fanout', $3::jsonb, 'queued', 0, $4, $5, $4, $4
        WHERE NOT EXISTS (
          SELECT 1
          FROM outbox_events
          WHERE idempotency_key = $5
        )
      `,
      [
        randomUUID(),
        input.organizationId,
        JSON.stringify({
          eventId,
          eventType: input.eventType,
          payload: input.payload ?? {},
        }),
        timestamp,
        `api.webhook.fanout:${eventId}`,
      ],
    );

    const rows = await client.execute<EventRow>(
      "SELECT * FROM event_log WHERE id = $1",
      [eventId],
    );

    return toEvent(rows[0]!);
  }

  async function createWebhookEndpoint(input: {
    actorId?: string;
    description?: string;
    eventTypes: string[];
    organizationId: string;
    principal: ApiPrincipal;
    url: string;
  }) {
    await authorizeTenantAccess({
      organizationId: input.organizationId,
      principal: input.principal,
      requiredScopes: ["webhooks:write"],
    });

    const client = await getClient();
    const timestamp = now().toISOString();
    const { hash, secret } = createApiKeySecret("nsw");
    const rows = await client.execute<WebhookEndpointRow>(
      `
        INSERT INTO api_webhook_endpoints (
          id,
          tenant_id,
          url,
          description,
          event_types,
          signing_secret_hash,
          secret_prefix,
          active,
          created_at,
          created_by,
          updated_at,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, true, $8, $9, $8, $9)
        RETURNING id, tenant_id, url, description, event_types, secret_prefix, active, created_at, created_by, updated_at, updated_by
      `,
      [
        randomUUID(),
        input.organizationId,
        input.url,
        input.description ?? null,
        JSON.stringify([...new Set(input.eventTypes)]),
        hash,
        secret.slice(0, 12),
        timestamp,
        input.actorId ?? input.principal.actorId ?? null,
      ],
    );

    return { endpoint: toWebhookEndpoint(rows[0]!), secret };
  }

  async function listWebhookEndpoints(input: {
    organizationId: string;
    principal: ApiPrincipal;
  }) {
    await authorizeTenantAccess({
      organizationId: input.organizationId,
      principal: input.principal,
      requiredScopes: ["webhooks:read"],
    });

    const client = await getClient();
    const rows = await client.execute<WebhookEndpointRow>(
      `
        SELECT id, tenant_id, url, description, event_types, secret_prefix, active, created_at, created_by, updated_at, updated_by
        FROM api_webhook_endpoints
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `,
      [input.organizationId],
    );

    return rows.map(toWebhookEndpoint);
  }

  async function recordWebhookDelivery(input: {
    endpointId: string;
    eventId?: string;
    eventType: string;
    payload?: Record<string, unknown>;
    status?: string;
    tenantId: string;
  }) {
    const client = await getClient();
    const timestamp = now().toISOString();
    const deliveryId = randomUUID();

    await client.execute(
      `
        INSERT INTO api_webhook_deliveries (
          id,
          tenant_id,
          endpoint_id,
          event_id,
          event_type,
          status,
          attempts,
          payload,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 0, $7::jsonb, $8, $8)
      `,
      [
        deliveryId,
        input.tenantId,
        input.endpointId,
        input.eventId ?? null,
        input.eventType,
        input.status ?? "queued",
        JSON.stringify(input.payload ?? {}),
        timestamp,
      ],
    );

    return deliveryId;
  }

  async function testWebhookEndpoint(input: {
    endpointId: string;
    eventType: string;
    organizationId: string;
    payload: Record<string, unknown>;
    principal: ApiPrincipal;
  }) {
    await authorizeTenantAccess({
      organizationId: input.organizationId,
      principal: input.principal,
      requiredScopes: ["webhooks:write"],
    });

    const client = await getClient();
    const rows = await client.execute<
      WebhookEndpointRow & { signing_secret_hash: string }
    >(
      `
        SELECT *
        FROM api_webhook_endpoints
        WHERE id = $1
          AND tenant_id = $2
          AND active = true
        LIMIT 1
      `,
      [input.endpointId, input.organizationId],
    );
    const endpoint = rows[0];

    if (!endpoint) {
      throw new ApiError(
        "Webhook endpoint not found.",
        "webhook_not_found",
        404,
      );
    }

    const deliveryId = await recordWebhookDelivery({
      endpointId: endpoint.id,
      eventType: input.eventType,
      payload: input.payload,
      tenantId: input.organizationId,
    });

    return {
      deliveryId,
      endpoint: toWebhookEndpoint(endpoint),
      payload: input.payload,
    };
  }

  async function getOrCreateMobileDevice(input: {
    appVersion?: string;
    deviceFingerprint?: string;
    deviceName: string;
    platform: string;
    userId: string;
  }) {
    const client = await getClient();
    const timestamp = now().toISOString();
    const fingerprintHash = input.deviceFingerprint
      ? hashLookupToken(input.deviceFingerprint)
      : undefined;

    if (fingerprintHash) {
      const existingRows = await client.execute<MobileDeviceRow>(
        `
          UPDATE mobile_devices
          SET device_name = $1,
              platform = $2,
              app_version = $3,
              last_seen_at = $4,
              updated_at = $4
          WHERE user_id = $5
            AND device_fingerprint_hash = $6
            AND revoked_at IS NULL
          RETURNING *
        `,
        [
          input.deviceName,
          input.platform,
          input.appVersion ?? null,
          timestamp,
          input.userId,
          fingerprintHash,
        ],
      );

      if (existingRows[0]) {
        return toMobileDevice(existingRows[0]);
      }
    }

    const rows = await client.execute<MobileDeviceRow>(
      `
        INSERT INTO mobile_devices (
          id,
          user_id,
          platform,
          device_name,
          device_fingerprint_hash,
          app_version,
          last_seen_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $7)
        RETURNING *
      `,
      [
        randomUUID(),
        input.userId,
        input.platform,
        input.deviceName,
        fingerprintHash ?? null,
        input.appVersion ?? null,
        timestamp,
      ],
    );

    return toMobileDevice(rows[0]!);
  }

  async function createMobileSession(input: {
    appVersion?: string;
    deviceFingerprint?: string;
    deviceName: string;
    email: string;
    ipAddress?: string;
    mfaCode?: string;
    password: string;
    platform: string;
    userAgent?: string;
  }) {
    const authResult = await getAuth().signInWithPassword({
      context: {
        deviceName: input.deviceName,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
      email: input.email,
      mfaCode: input.mfaCode,
      password: input.password,
    });

    if (authResult.status !== "signed_in") {
      throw new ApiError(
        "Multi-factor authentication is required.",
        "mfa_required",
        401,
      );
    }

    const device = await getOrCreateMobileDevice({
      appVersion: input.appVersion,
      deviceFingerprint: input.deviceFingerprint,
      deviceName: input.deviceName,
      platform: input.platform,
      userId: authResult.user.id,
    });
    const client = await getClient();
    const timestamp = now().toISOString();

    await client.execute(
      `
        INSERT INTO mobile_sessions (
          id,
          device_id,
          auth_session_id,
          user_id,
          refresh_token_family,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $6)
        ON CONFLICT (auth_session_id) DO UPDATE SET
          device_id = EXCLUDED.device_id,
          revoked_at = NULL,
          rotated_at = NULL,
          updated_at = EXCLUDED.updated_at
      `,
      [
        randomUUID(),
        device.id,
        authResult.session.session.id,
        authResult.user.id,
        hashMobileSessionFamily(authResult.session.session.id),
        timestamp,
      ],
    );

    return {
      device,
      refreshToken: authResult.session.refreshToken,
      session: authResult.session.session,
      sessionToken: authResult.session.sessionToken,
      user: authResult.user,
    };
  }

  async function refreshMobileSession(input: {
    appVersion?: string;
    deviceName?: string;
    ipAddress?: string;
    refreshToken: string;
    userAgent?: string;
  }) {
    const rotated = await getAuth().rotateRefreshToken(input.refreshToken, {
      deviceName: input.deviceName,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    const client = await getClient();
    const timestamp = now().toISOString();
    const rows = await client.execute<MobileSessionRow>(
      `
        UPDATE mobile_sessions
        SET rotated_at = $1,
            updated_at = $1
        WHERE auth_session_id = $2
          AND revoked_at IS NULL
        RETURNING id, device_id, auth_session_id, user_id, revoked_at
      `,
      [timestamp, rotated.session.id],
    );
    const mobileSession = rows[0];

    if (!mobileSession) {
      await getAuth().revokeSession({ sessionId: rotated.session.id });
      throw new ApiError(
        "Mobile session not found.",
        "mobile_session_not_found",
        401,
      );
    }

    await client.execute(
      `
        UPDATE mobile_devices
        SET last_seen_at = $1,
            app_version = COALESCE($2, app_version),
            updated_at = $1
        WHERE id = $3
      `,
      [timestamp, input.appVersion ?? null, mobileSession.device_id],
    );

    return rotated;
  }

  async function listMobileDevices(input: { principal: ApiPrincipal }) {
    assertScopes(input.principal, ["mobile:devices"]);

    if (input.principal.type !== "mobile_session") {
      throw new ApiError(
        "Mobile session authentication is required.",
        "mobile_session_required",
        401,
      );
    }

    const client = await getClient();
    const rows = await client.execute<MobileDeviceRow>(
      `
        SELECT *
        FROM mobile_devices
        WHERE user_id = $1
        ORDER BY last_seen_at DESC
      `,
      [input.principal.actorId],
    );

    return rows.map(toMobileDevice);
  }

  async function revokeMobileDevice(input: {
    deviceId: string;
    principal: ApiPrincipal;
  }) {
    assertScopes(input.principal, ["mobile:devices"]);

    if (input.principal.type !== "mobile_session") {
      throw new ApiError(
        "Mobile session authentication is required.",
        "mobile_session_required",
        401,
      );
    }

    const client = await getClient();
    const timestamp = now().toISOString();
    const sessionRows = await client.execute<{ auth_session_id: string }>(
      `
        SELECT auth_session_id
        FROM mobile_sessions
        WHERE device_id = $1
          AND user_id = $2
          AND revoked_at IS NULL
      `,
      [input.deviceId, input.principal.actorId],
    );

    await withTransaction(client, async (transaction) => {
      await transaction.execute(
        `
          UPDATE mobile_devices
          SET revoked_at = COALESCE(revoked_at, $1),
              updated_at = $1
          WHERE id = $2
            AND user_id = $3
        `,
        [timestamp, input.deviceId, input.principal.actorId],
      );
      await transaction.execute(
        `
          UPDATE mobile_sessions
          SET revoked_at = COALESCE(revoked_at, $1),
              updated_at = $1
          WHERE device_id = $2
            AND user_id = $3
            AND revoked_at IS NULL
        `,
        [timestamp, input.deviceId, input.principal.actorId],
      );
    });

    for (const session of sessionRows) {
      await getAuth().revokeSession({
        actorId: input.principal.actorId,
        sessionId: session.auth_session_id,
      });
    }
  }

  async function upsertPushSubscription(input: {
    deviceId: string;
    principal: ApiPrincipal;
    provider: string;
    token: string;
    topics?: string[];
  }) {
    assertScopes(input.principal, ["mobile:push"]);

    if (input.principal.type !== "mobile_session") {
      throw new ApiError(
        "Mobile session authentication is required.",
        "mobile_session_required",
        401,
      );
    }

    const client = await getClient();
    const timestamp = now().toISOString();
    const tokenHash = hashLookupToken(input.token);

    await client.execute(
      `
        INSERT INTO mobile_push_subscriptions (
          id,
          device_id,
          user_id,
          provider,
          token_hash,
          topics,
          enabled,
          created_at,
          updated_at
        )
        SELECT $1, id, user_id, $2, $3, $4::jsonb, true, $5, $5
        FROM mobile_devices
        WHERE id = $6
          AND user_id = $7
          AND revoked_at IS NULL
        ON CONFLICT (provider, token_hash) DO UPDATE SET
          device_id = EXCLUDED.device_id,
          user_id = EXCLUDED.user_id,
          topics = EXCLUDED.topics,
          enabled = true,
          updated_at = EXCLUDED.updated_at
      `,
      [
        randomUUID(),
        input.provider,
        tokenHash,
        JSON.stringify(input.topics ?? []),
        timestamp,
        input.deviceId,
        input.principal.actorId,
      ],
    );
  }

  async function createDeepLink(input: {
    expiresAt?: string;
    params?: Record<string, unknown>;
    principal: ApiPrincipal;
    route: string;
    tenantId?: string;
  }) {
    assertScopes(input.principal, ["mobile:devices"]);

    if (input.tenantId) {
      await authorizeTenantAccess({
        organizationId: input.tenantId,
        principal: input.principal,
        requiredScopes: [],
      });
    }

    const client = await getClient();
    const id = randomUUID();
    const unsignedPayload = `${id}.${input.route}.${stableJson(input.params ?? {})}`;
    const signature = createHmac("sha256", getDeepLinkSecret())
      .update(unsignedPayload)
      .digest("base64url");
    const url = new URL(
      `/mobile/deep-links/${encodeURIComponent(id)}`,
      appBaseUrl,
    );

    url.searchParams.set("signature", signature);

    const timestamp = now().toISOString();

    await client.execute(
      `
        INSERT INTO mobile_deep_links (
          id,
          tenant_id,
          user_id,
          route,
          params,
          url,
          expires_at,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
      `,
      [
        id,
        input.tenantId ?? null,
        input.principal.actorId ?? null,
        input.route,
        JSON.stringify(input.params ?? {}),
        url.toString(),
        input.expiresAt ?? null,
        timestamp,
      ],
    );

    return {
      expiresAt: input.expiresAt,
      id,
      route: input.route,
      url: url.toString(),
    };
  }

  async function createMobileUploadIntent(input: {
    byteSize: number;
    checksumSha256?: string;
    contentType: string;
    fileName: string;
    metadata?: Record<string, unknown>;
    principal: ApiPrincipal;
    tenantId: string;
  }) {
    assertScopes(input.principal, ["mobile:uploads"]);

    if (input.principal.type !== "mobile_session") {
      throw new ApiError(
        "Mobile session authentication is required.",
        "mobile_session_required",
        401,
      );
    }

    await authorizeTenantAccess({
      organizationId: input.tenantId,
      principal: input.principal,
      requiredScopes: [],
    });

    const client = await getClient();
    const timestamp = now();
    const token = `nsupload_${randomBytes(32).toString("base64url")}`;
    const id = randomUUID();
    const uploadUrl = new URL(
      `/api/v1/mobile/uploads/${encodeURIComponent(id)}`,
      appBaseUrl,
    );

    uploadUrl.searchParams.set("token", token);

    await client.execute(
      `
        INSERT INTO mobile_upload_intents (
          id,
          tenant_id,
          user_id,
          file_name,
          content_type,
          byte_size,
          checksum_sha256,
          status,
          token_hash,
          expires_at,
          metadata,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10::jsonb, $11, $11)
      `,
      [
        id,
        input.tenantId,
        input.principal.actorId,
        input.fileName,
        input.contentType,
        input.byteSize,
        input.checksumSha256 ?? null,
        hashLookupToken(token),
        addSeconds(timestamp, mobileUploadTtlSeconds).toISOString(),
        JSON.stringify(input.metadata ?? {}),
        timestamp.toISOString(),
      ],
    );

    return {
      expiresAt: addSeconds(timestamp, mobileUploadTtlSeconds).toISOString(),
      id,
      token,
      uploadUrl: uploadUrl.toString(),
    };
  }

  async function completeMobileUploadIntent(input: {
    byteSize: number;
    checksumSha256?: string;
    contentType: string;
    intentId: string;
    token: string;
  }) {
    const client = await getClient();
    const timestamp = now().toISOString();
    const rows = await client.execute<MobileUploadIntentRow>(
      `
        UPDATE mobile_upload_intents
        SET status = 'uploaded',
            uploaded_at = $1,
            updated_at = $1
        WHERE id = $2
          AND token_hash = $3
          AND status = 'pending'
          AND expires_at > $1
          AND content_type = $4
          AND byte_size = $5
          AND (
            (checksum_sha256 IS NULL AND $6::text IS NULL)
            OR checksum_sha256 = $6::text
          )
        RETURNING *
      `,
      [
        timestamp,
        input.intentId,
        hashLookupToken(input.token),
        input.contentType,
        input.byteSize,
        input.checksumSha256 ?? null,
      ],
    );
    const intent = rows[0];

    if (!intent) {
      throw new ApiError(
        "Upload intent is invalid or expired.",
        "invalid_upload_intent",
        400,
      );
    }

    // TODO(Build Area 10): hand the validated upload stream to the storage adapter once the storage module lands; Build Area 9 owns the token-bound mobile upload control flow and metadata contract.
    return toMobileUploadIntent(intent);
  }

  function createCorsHeaders(origin?: string | null) {
    const normalizedOrigin = origin ?? "";
    const allowAny = corsOrigins.includes("*");
    const allowedOrigin =
      allowAny || corsOrigins.includes(normalizedOrigin)
        ? normalizedOrigin || "*"
        : corsOrigins[0];

    return {
      "access-control-allow-headers":
        "authorization,content-type,idempotency-key,x-request-id",
      "access-control-allow-methods": "DELETE,GET,OPTIONS,POST,PUT",
      "access-control-allow-origin": allowedOrigin,
      "access-control-max-age": "86400",
      vary: "Origin",
    };
  }

  function signWebhookPayload(input: {
    payload: Record<string, unknown> | string;
    secret: string;
    timestamp?: number;
  }) {
    const payload =
      typeof input.payload === "string"
        ? input.payload
        : JSON.stringify(input.payload);
    const timestamp = input.timestamp ?? Math.floor(now().getTime() / 1000);

    return signingHeader({ payload, secret: input.secret, timestamp });
  }

  function verifyWebhookSignature(input: {
    header: string;
    payload: Record<string, unknown> | string;
    secret: string;
    toleranceSeconds?: number;
  }) {
    const parts = Object.fromEntries(
      input.header.split(",").map((part) => {
        const [key, value] = part.split("=");

        return [key, value];
      }),
    );
    const timestamp = Number(parts.t);
    const signature = parts.v1;

    if (!Number.isFinite(timestamp) || !signature) {
      return false;
    }

    const toleranceSeconds = input.toleranceSeconds ?? 5 * 60;
    const currentTimestamp = Math.floor(now().getTime() / 1000);

    if (Math.abs(currentTimestamp - timestamp) > toleranceSeconds) {
      return false;
    }

    const expected = signWebhookPayload({
      payload: input.payload,
      secret: input.secret,
      timestamp,
    }).split("v1=")[1]!;

    return signatureMatches(signature, expected);
  }

  function listOAuthProviders() {
    return [...oauthAdapters.values()].map((adapter) => ({
      authorizationEndpoint: adapter.authorizationEndpoint,
      provider: adapter.provider,
      scopes: adapter.scopes,
    }));
  }

  async function createOAuthAuthorizationUrl(input: {
    metadata?: Record<string, unknown>;
    provider: string;
    redirectUri: string;
  }) {
    const adapter = oauthAdapters.get(input.provider);

    if (!adapter) {
      throw new ApiError(
        "OAuth provider is not configured.",
        "oauth_provider_not_found",
        404,
      );
    }

    return getAuth().createOAuthAuthorizationUrl({
      adapter,
      metadata: input.metadata,
      redirectUri: input.redirectUri,
    });
  }

  async function completeOAuthCallback(input: {
    code: string;
    device?: {
      appVersion?: string;
      deviceFingerprint?: string;
      deviceName: string;
      platform: string;
    };
    provider: string;
    redirectUri: string;
    state: string;
  }) {
    const adapter = oauthAdapters.get(input.provider);

    if (!adapter) {
      throw new ApiError(
        "OAuth provider is not configured.",
        "oauth_provider_not_found",
        404,
      );
    }

    const result = await getAuth().completeOAuthCallback({
      adapter,
      code: input.code,
      context: {
        deviceName: input.device?.deviceName,
      },
      redirectUri: input.redirectUri,
      state: input.state,
    });
    const device = await getOrCreateMobileDevice({
      appVersion: input.device?.appVersion,
      deviceFingerprint: input.device?.deviceFingerprint,
      deviceName: input.device?.deviceName ?? "OAuth mobile device",
      platform: input.device?.platform ?? "mobile",
      userId: result.user.id,
    });
    const client = await getClient();
    const timestamp = now().toISOString();

    await client.execute(
      `
        INSERT INTO mobile_sessions (
          id,
          device_id,
          auth_session_id,
          user_id,
          refresh_token_family,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $6)
        ON CONFLICT (auth_session_id) DO UPDATE SET
          device_id = EXCLUDED.device_id,
          revoked_at = NULL,
          updated_at = EXCLUDED.updated_at
      `,
      [
        randomUUID(),
        device.id,
        result.session.session.id,
        result.user.id,
        hashMobileSessionFamily(result.session.session.id),
        timestamp,
      ],
    );

    return {
      device,
      refreshToken: result.session.refreshToken,
      session: result.session.session,
      sessionToken: result.session.sessionToken,
      user: result.user,
    };
  }

  return {
    authenticateBearerToken,
    authorizeTenantAccess,
    completeMobileUploadIntent,
    completeOAuthCallback,
    createCorsHeaders,
    createDeepLink,
    createEvent,
    createMobileSession,
    createMobileUploadIntent,
    createOAuthAuthorizationUrl,
    createPersonalAccessToken,
    createWebhookEndpoint,
    getOrganization,
    listEvents,
    listMobileDevices,
    listOAuthProviders,
    listOrganizationMembers,
    listWebhookEndpoints,
    recordApiRequest,
    recordWebhookDelivery,
    requireScopes: assertScopes,
    refreshMobileSession,
    revokeMobileDevice,
    signWebhookPayload,
    testWebhookEndpoint,
    upsertPushSubscription,
    verifyWebhookSignature,
    withIdempotency,
  };
}
