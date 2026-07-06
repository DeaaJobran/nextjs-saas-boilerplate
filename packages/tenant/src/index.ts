import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  createApiKeySecret,
  createTenantFilterFragment,
  getDatabaseRuntime,
  type Queryable,
  runMigrations,
} from "@nextjs-saas/db";
import { defaultLocale, isLocale } from "@nextjs-saas/localization";

export const tenantRoleConfig = {
  assignableRoles: ["owner", "admin", "member"],
  defaultInviteRole: "member",
  ownerRole: "owner",
  roles: ["owner", "admin", "member"],
} as const;

export type TenantRole = (typeof tenantRoleConfig.roles)[number];

export const tenantPermissionCatalog = [
  "organization.read",
  "organization.update",
  "members.read",
  "members.invite",
  "members.update",
  "members.remove",
  "invitations.accept",
  "invitations.reject",
  "settings.manage",
  "feature_flags.manage",
  "limits.manage",
  "billing.read",
  "billing.manage",
  "billing.usage.manage",
  "billing.refund",
  "api_keys.manage",
  "impersonation.start",
  "audit.read",
  "dashboard.read",
] as const;

export type TenantPermission = (typeof tenantPermissionCatalog)[number];

export const tenantApiKeyScopeCatalog = [
  "tenant:read",
  "tenant:write",
  "members:read",
  "members:write",
  "invitations:read",
  "invitations:write",
  "api_keys:read",
  "api_keys:write",
  "feature_flags:read",
  "feature_flags:write",
  "limits:read",
  "limits:write",
  "billing:read",
  "billing:write",
  "audit:read",
] as const;

export type TenantApiKeyScope = (typeof tenantApiKeyScopeCatalog)[number];

export const tenantRolePermissions: Record<TenantRole, TenantPermission[]> = {
  admin: [
    "organization.read",
    "organization.update",
    "members.read",
    "members.invite",
    "members.update",
    "members.remove",
    "invitations.reject",
    "settings.manage",
    "feature_flags.manage",
    "limits.manage",
    "billing.read",
    "billing.manage",
    "billing.usage.manage",
    "billing.refund",
    "api_keys.manage",
    "impersonation.start",
    "audit.read",
    "dashboard.read",
  ],
  member: [
    "organization.read",
    "members.read",
    "billing.read",
    "dashboard.read",
  ],
  owner: [...tenantPermissionCatalog],
};

export const tenantDefaults = {
  aiTokenLimit: 100_000,
  apiRequestLimit: 10_000,
  invitationTtlSeconds: 7 * 24 * 60 * 60,
  memberLimit: 25,
  storageBytesLimit: 10 * 1024 * 1024 * 1024,
} as const;

export type TenantGlobalRole = "admin" | "owner" | "support" | string;

export class TenantError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

type TenantServiceOptions = {
  appBaseUrl?: string;
  client?: Queryable;
  invitationPath?: string;
  now?: () => Date;
};

type TransactionalQueryable = Queryable & {
  transaction<T>(callback: (client: Queryable) => Promise<T>): Promise<T>;
};

type OrganizationRow = {
  created_at: Date | string;
  created_by: string | null;
  default_locale: string;
  deleted_at: Date | string | null;
  deleted_by: string | null;
  description: string | null;
  id: string;
  logo_url: string | null;
  name: string;
  slug: string;
  status: "active" | "suspended";
  updated_at: Date | string;
  updated_by: string | null;
  website_url: string | null;
};

type MembershipRow = {
  avatar_url?: string | null;
  created_at: Date | string;
  custom_permissions: string[] | string;
  display_name?: string;
  email?: string;
  invited_by: string | null;
  joined_at: Date | string;
  organization_id: string;
  removed_at: Date | string | null;
  removed_by: string | null;
  role: TenantRole;
  status: "active" | "removed";
  updated_at: Date | string;
  updated_by: string | null;
  user_id: string;
};

type InvitationRow = {
  accepted_at: Date | string | null;
  accepted_by: string | null;
  created_at: Date | string;
  created_by: string | null;
  custom_permissions: string[] | string;
  email: string;
  expires_at: Date | string;
  id: string;
  normalized_email: string;
  organization_id: string;
  rejected_at: Date | string | null;
  rejected_by: string | null;
  role: TenantRole;
  token_hash: string;
  updated_at: Date | string;
};

type FeatureFlagRow = {
  enabled: boolean;
  flag_key: string;
  organization_id: string;
  payload: Record<string, unknown> | string;
  updated_at: Date | string;
  updated_by: string | null;
};

type UsageLimitRow = {
  limit_key: string;
  limit_value: number | string;
  organization_id: string;
  reset_at: Date | string | null;
  updated_at: Date | string;
  updated_by: string | null;
  used_value: number | string;
  window_seconds: number | null;
};

type QuotaRow = {
  ai_token_limit: number | string;
  ai_token_used: number | string;
  organization_id: string;
  storage_bytes_limit: number | string;
  storage_bytes_used: number | string;
  updated_at: Date | string;
  updated_by: string | null;
};

type ApiKeyRow = {
  created_at: Date | string;
  created_by: string | null;
  expires_at: Date | string | null;
  id: string;
  key_prefix: string;
  last_used_at: Date | string | null;
  name: string;
  revoked_at: Date | string | null;
  scopes: string[] | string;
  tenant_id: string | null;
  updated_at: Date | string;
};

type AuditEventRow = {
  actor_id: string | null;
  created_at: Date | string;
  event_type: string;
  id: string;
  impersonation_session_id: string | null;
  organization_id: string;
  payload: Record<string, unknown> | string;
  subject_id: string | null;
  subject_type: string;
};

type ImpersonationRow = {
  actor_email?: string;
  actor_id: string;
  actor_name?: string;
  created_at: Date | string;
  ended_at: Date | string | null;
  ended_by: string | null;
  expires_at: Date | string;
  id: string;
  organization_id: string;
  reason: string;
  started_at: Date | string;
  subject_email?: string;
  subject_name?: string;
  subject_user_id: string;
};

export type Organization = {
  createdAt: string;
  createdBy?: string;
  defaultLocale: string;
  deletedAt?: string;
  deletedBy?: string;
  description?: string;
  id: string;
  logoUrl?: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  updatedAt: string;
  updatedBy?: string;
  websiteUrl?: string;
};

export type TenantMembership = {
  avatarUrl?: string;
  createdAt: string;
  customPermissions: TenantPermission[];
  displayName?: string;
  email?: string;
  invitedBy?: string;
  joinedAt: string;
  organizationId: string;
  permissions: TenantPermission[];
  removedAt?: string;
  removedBy?: string;
  role: TenantRole;
  status: "active" | "removed";
  updatedAt: string;
  updatedBy?: string;
  userId: string;
};

export type OrganizationInvitation = {
  acceptedAt?: string;
  acceptedBy?: string;
  createdAt: string;
  createdBy?: string;
  customPermissions: TenantPermission[];
  email: string;
  expiresAt: string;
  id: string;
  normalizedEmail: string;
  organizationId: string;
  rejectedAt?: string;
  rejectedBy?: string;
  role: TenantRole;
  updatedAt: string;
};

export type TenantApiKey = {
  createdAt: string;
  createdBy?: string;
  expiresAt?: string;
  id: string;
  keyPrefix: string;
  lastUsedAt?: string;
  name: string;
  revokedAt?: string;
  scopes: string[];
  tenantId: string;
  updatedAt: string;
};

export type TenantAuditEvent = {
  actorId?: string;
  createdAt: string;
  eventType: string;
  id: string;
  impersonationSessionId?: string;
  organizationId: string;
  payload: Record<string, unknown>;
  subjectId?: string;
  subjectType: string;
};

export type TenantFeatureFlag = {
  enabled: boolean;
  key: string;
  organizationId: string;
  payload: Record<string, unknown>;
  updatedAt: string;
  updatedBy?: string;
};

export type TenantUsageLimit = {
  key: string;
  limitValue: number;
  organizationId: string;
  resetAt?: string;
  updatedAt: string;
  updatedBy?: string;
  usedValue: number;
  windowSeconds?: number;
};

export type TenantQuota = {
  aiTokenLimit: number;
  aiTokenUsed: number;
  organizationId: string;
  storageBytesLimit: number;
  storageBytesUsed: number;
  updatedAt: string;
  updatedBy?: string;
};

export type ImpersonationSession = {
  actorEmail?: string;
  actorId: string;
  actorName?: string;
  createdAt: string;
  endedAt?: string;
  endedBy?: string;
  expiresAt: string;
  id: string;
  organizationId: string;
  reason: string;
  startedAt: string;
  subjectEmail?: string;
  subjectName?: string;
  subjectUserId: string;
};

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

function parseJsonValue<T>(value: T | string | null | undefined, fallback: T) {
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

export function normalizeTenantEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isTenantRole(role: string): role is TenantRole {
  return (tenantRoleConfig.roles as readonly string[]).includes(role);
}

export function isTenantPermission(
  permission: string,
): permission is TenantPermission {
  return (tenantPermissionCatalog as readonly string[]).includes(permission);
}

export function isTenantApiKeyScope(scope: string): scope is TenantApiKeyScope {
  return (tenantApiKeyScopeCatalog as readonly string[]).includes(scope);
}

export function assertTenantRole(role: string): asserts role is TenantRole {
  if (!isTenantRole(role)) {
    throw new TenantError("Invalid organization role.", "invalid_role");
  }
}

function normalizePermissions(permissions: unknown = []) {
  const list = Array.isArray(permissions) ? permissions : [];

  return [
    ...new Set(
      list
        .filter(
          (permission): permission is string => typeof permission === "string",
        )
        .map((permission) => permission.trim()),
    ),
  ].filter(
    (permission): permission is TenantPermission =>
      permission.length > 0 && isTenantPermission(permission),
  );
}

function normalizeOptionalLocale(locale: string | undefined) {
  if (!locale) {
    return defaultLocale;
  }

  if (!isLocale(locale)) {
    throw new TenantError("Unsupported locale.", "unsupported_locale");
  }

  return locale;
}

function normalizeApiKeyScopes(scopes: unknown = []) {
  const list = Array.isArray(scopes) ? scopes : [];

  return [
    ...new Set(
      list
        .filter((scope): scope is string => typeof scope === "string")
        .map((scope) => scope.trim())
        .filter(Boolean),
    ),
  ].filter((scope): scope is TenantApiKeyScope => isTenantApiKeyScope(scope));
}

function validateApiKeyScopes(scopes: readonly string[]) {
  const normalizedScopes = [
    ...new Set(scopes.map((scope) => scope.trim()).filter(Boolean)),
  ];
  const invalidScopes = normalizedScopes.filter(
    (scope) => !isTenantApiKeyScope(scope),
  );

  if (invalidScopes.length > 0) {
    throw new TenantError(
      "Invalid tenant API key scope.",
      "invalid_api_key_scope",
    );
  }

  return normalizedScopes as TenantApiKeyScope[];
}

export function permissionsForRole(
  role: TenantRole,
  customPermissions: readonly string[] = [],
) {
  return [
    ...new Set([
      ...tenantRolePermissions[role],
      ...normalizePermissions(customPermissions),
    ]),
  ];
}

export function hasTenantPermission(
  membership: Pick<TenantMembership, "customPermissions" | "role">,
  permission: TenantPermission,
) {
  return permissionsForRole(
    membership.role,
    membership.customPermissions,
  ).includes(permission);
}

function assertTenantPermission(
  membership: Pick<TenantMembership, "customPermissions" | "role">,
  permission: TenantPermission,
) {
  if (!hasTenantPermission(membership, permission)) {
    throw new TenantError(
      "The current member cannot perform this organization action.",
      "forbidden",
    );
  }
}

function isGlobalTenantOperator(role?: TenantGlobalRole) {
  return role === "admin" || role === "owner" || role === "support";
}

function hashTenantToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function createTenantToken(prefix: string) {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

function slugify(value: string) {
  const slug: string[] = [];
  let pendingSeparator = false;

  for (const character of value.trim().toLowerCase()) {
    const code = character.charCodeAt(0);
    const isAsciiLetter = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;

    if (!isAsciiLetter && !isDigit) {
      pendingSeparator = slug.length > 0;
      continue;
    }

    if (pendingSeparator) {
      if (slug.length >= 47) {
        break;
      }

      slug.push("-");
      pendingSeparator = false;
    }

    if (slug.length >= 48) {
      break;
    }

    slug.push(character);
  }

  return slug.join("");
}

function stableTenantSuffix(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

function getDefaultOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function invitationLink(appBaseUrl: string, path: string, token: string) {
  const url = new URL(path, appBaseUrl);

  url.searchParams.set("token", token);

  return url.toString();
}

function toOrganization(row: OrganizationRow): Organization {
  return {
    createdAt: toIsoString(row.created_at)!,
    createdBy: row.created_by ?? undefined,
    defaultLocale: row.default_locale,
    deletedAt: toIsoString(row.deleted_at),
    deletedBy: row.deleted_by ?? undefined,
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

function toMembership(row: MembershipRow): TenantMembership {
  const customPermissions = normalizePermissions(
    parseJsonValue<string[]>(row.custom_permissions, []),
  );

  return {
    avatarUrl: row.avatar_url ?? undefined,
    createdAt: toIsoString(row.created_at)!,
    customPermissions,
    displayName: row.display_name,
    email: row.email,
    invitedBy: row.invited_by ?? undefined,
    joinedAt: toIsoString(row.joined_at)!,
    organizationId: row.organization_id,
    permissions: permissionsForRole(row.role, customPermissions),
    removedAt: toIsoString(row.removed_at),
    removedBy: row.removed_by ?? undefined,
    role: row.role,
    status: row.status,
    updatedAt: toIsoString(row.updated_at)!,
    updatedBy: row.updated_by ?? undefined,
    userId: row.user_id,
  };
}

function toInvitation(row: InvitationRow): OrganizationInvitation {
  return {
    acceptedAt: toIsoString(row.accepted_at),
    acceptedBy: row.accepted_by ?? undefined,
    createdAt: toIsoString(row.created_at)!,
    createdBy: row.created_by ?? undefined,
    customPermissions: normalizePermissions(
      parseJsonValue<string[]>(row.custom_permissions, []),
    ),
    email: row.email,
    expiresAt: toIsoString(row.expires_at)!,
    id: row.id,
    normalizedEmail: row.normalized_email,
    organizationId: row.organization_id,
    rejectedAt: toIsoString(row.rejected_at),
    rejectedBy: row.rejected_by ?? undefined,
    role: row.role,
    updatedAt: toIsoString(row.updated_at)!,
  };
}

function toFeatureFlag(row: FeatureFlagRow): TenantFeatureFlag {
  return {
    enabled: row.enabled,
    key: row.flag_key,
    organizationId: row.organization_id,
    payload: parseJsonValue<Record<string, unknown>>(row.payload, {}),
    updatedAt: toIsoString(row.updated_at)!,
    updatedBy: row.updated_by ?? undefined,
  };
}

function toUsageLimit(row: UsageLimitRow): TenantUsageLimit {
  return {
    key: row.limit_key,
    limitValue: toNumber(row.limit_value),
    organizationId: row.organization_id,
    resetAt: toIsoString(row.reset_at),
    updatedAt: toIsoString(row.updated_at)!,
    updatedBy: row.updated_by ?? undefined,
    usedValue: toNumber(row.used_value),
    windowSeconds: row.window_seconds ?? undefined,
  };
}

function toQuota(row: QuotaRow): TenantQuota {
  return {
    aiTokenLimit: toNumber(row.ai_token_limit),
    aiTokenUsed: toNumber(row.ai_token_used),
    organizationId: row.organization_id,
    storageBytesLimit: toNumber(row.storage_bytes_limit),
    storageBytesUsed: toNumber(row.storage_bytes_used),
    updatedAt: toIsoString(row.updated_at)!,
    updatedBy: row.updated_by ?? undefined,
  };
}

function toApiKey(row: ApiKeyRow): TenantApiKey {
  return {
    createdAt: toIsoString(row.created_at)!,
    createdBy: row.created_by ?? undefined,
    expiresAt: toIsoString(row.expires_at),
    id: row.id,
    keyPrefix: row.key_prefix,
    lastUsedAt: toIsoString(row.last_used_at),
    name: row.name,
    revokedAt: toIsoString(row.revoked_at),
    scopes: normalizeApiKeyScopes(parseJsonValue<unknown>(row.scopes, [])),
    tenantId: row.tenant_id!,
    updatedAt: toIsoString(row.updated_at)!,
  };
}

function toAuditEvent(row: AuditEventRow): TenantAuditEvent {
  return {
    actorId: row.actor_id ?? undefined,
    createdAt: toIsoString(row.created_at)!,
    eventType: row.event_type,
    id: row.id,
    impersonationSessionId: row.impersonation_session_id ?? undefined,
    organizationId: row.organization_id,
    payload: parseJsonValue<Record<string, unknown>>(row.payload, {}),
    subjectId: row.subject_id ?? undefined,
    subjectType: row.subject_type,
  };
}

function toImpersonationSession(row: ImpersonationRow): ImpersonationSession {
  return {
    actorEmail: row.actor_email,
    actorId: row.actor_id,
    actorName: row.actor_name,
    createdAt: toIsoString(row.created_at)!,
    endedAt: toIsoString(row.ended_at),
    endedBy: row.ended_by ?? undefined,
    expiresAt: toIsoString(row.expires_at)!,
    id: row.id,
    organizationId: row.organization_id,
    reason: row.reason,
    startedAt: toIsoString(row.started_at)!,
    subjectEmail: row.subject_email,
    subjectName: row.subject_name,
    subjectUserId: row.subject_user_id,
  };
}

export function createTenantService(options: TenantServiceOptions = {}) {
  const appBaseUrl = options.appBaseUrl ?? getDefaultOrigin();
  const invitationPath =
    options.invitationPath ?? "/organizations/invitations/accept";
  const now = options.now ?? (() => new Date());

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

  async function audit(
    client: Queryable,
    input: {
      actorId?: string;
      eventType: string;
      impersonationSessionId?: string;
      organizationId: string;
      payload?: Record<string, unknown>;
      subjectId?: string;
      subjectType: string;
    },
  ) {
    await client.execute(
      `
        INSERT INTO tenant_audit_events (
          id,
          organization_id,
          actor_id,
          subject_type,
          subject_id,
          event_type,
          impersonation_session_id,
          payload,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      `,
      [
        randomUUID(),
        input.organizationId,
        input.actorId,
        input.subjectType,
        input.subjectId,
        input.eventType,
        input.impersonationSessionId,
        JSON.stringify(input.payload ?? {}),
        now().toISOString(),
      ],
    );
  }

  async function getOrganizationRow(client: Queryable, organizationId: string) {
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

    return rows[0];
  }

  async function getMembershipRow(
    client: Queryable,
    organizationId: string,
    userId: string,
  ) {
    const rows = await client.execute<MembershipRow>(
      `
        SELECT
          m.*,
          u.display_name,
          u.email,
          u.avatar_url
        FROM organization_memberships m
        INNER JOIN auth_users u ON u.id = m.user_id
        WHERE m.organization_id = $1
          AND m.user_id = $2
          AND m.status = 'active'
          AND m.removed_at IS NULL
          AND u.deleted_at IS NULL
        LIMIT 1
      `,
      [organizationId, userId],
    );

    return rows[0];
  }

  async function requireMembership(
    client: Queryable,
    input: {
      organizationId: string;
      permission?: TenantPermission;
      userId: string;
    },
  ) {
    const organization = await getOrganizationRow(client, input.organizationId);

    if (!organization || organization.status !== "active") {
      throw new TenantError(
        "Organization not found.",
        "organization_not_found",
      );
    }

    const row = await getMembershipRow(
      client,
      input.organizationId,
      input.userId,
    );

    if (!row) {
      throw new TenantError("User is not a member.", "membership_required");
    }

    const membership = toMembership(row);

    if (input.permission) {
      assertTenantPermission(membership, input.permission);
    }

    return { membership, organization: toOrganization(organization) };
  }

  async function requireGlobalOperator(input: {
    actorGlobalRole?: TenantGlobalRole;
  }) {
    if (!isGlobalTenantOperator(input.actorGlobalRole)) {
      throw new TenantError(
        "Global tenant administration requires an operator role.",
        "forbidden",
      );
    }
  }

  async function ensureGlobalOperatorIdentity(
    client: Queryable,
    input: {
      actorDisplayName?: string;
      actorEmail?: string;
      actorGlobalRole?: TenantGlobalRole;
      actorId: string;
    },
  ) {
    const existingRows = await client.execute<{
      deleted_at: Date | string | null;
      id: string;
    }>("SELECT id, deleted_at FROM auth_users WHERE id = $1 LIMIT 1", [
      input.actorId,
    ]);
    const existing = existingRows[0];

    if (existing?.deleted_at) {
      throw new TenantError(
        "Global operator identity is inactive.",
        "operator_identity_inactive",
      );
    }

    if (existing) {
      return;
    }

    const email = input.actorEmail?.trim();

    if (!email) {
      throw new TenantError(
        "Global operator identity requires an email address.",
        "operator_identity_required",
      );
    }

    const timestamp = now().toISOString();

    await client.execute(
      `
        INSERT INTO auth_users (
          id,
          email,
          normalized_email,
          display_name,
          mfa_required,
          role,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, false, $5, $6, $6)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        input.actorId,
        email,
        normalizeTenantEmail(email),
        input.actorDisplayName?.trim() || email,
        input.actorGlobalRole ?? "support",
        timestamp,
      ],
    );
  }

  async function assertOwnerWillRemain(
    client: Queryable,
    organizationId: string,
    excludedUserId?: string,
  ) {
    const rows = await client.execute<{ count: string }>(
      `
        SELECT count(*)::text AS count
        FROM organization_memberships
        WHERE organization_id = $1
          AND role = 'owner'
          AND status = 'active'
          AND removed_at IS NULL
          AND ($2::text IS NULL OR user_id <> $2)
      `,
      [organizationId, excludedUserId ?? null],
    );

    if (Number(rows[0]?.count ?? 0) < 1) {
      throw new TenantError(
        "An organization must keep at least one owner.",
        "last_owner",
      );
    }
  }

  async function seedOrganizationDefaults(
    client: Queryable,
    input: { actorId?: string; organizationId: string },
  ) {
    const timestamp = now().toISOString();

    await client.execute(
      `
        INSERT INTO organization_quotas (
          organization_id,
          storage_bytes_limit,
          storage_bytes_used,
          ai_token_limit,
          ai_token_used,
          updated_at,
          updated_by
        )
        VALUES ($1, $2, 0, $3, 0, $4, $5)
        ON CONFLICT (organization_id) DO NOTHING
      `,
      [
        input.organizationId,
        tenantDefaults.storageBytesLimit,
        tenantDefaults.aiTokenLimit,
        timestamp,
        input.actorId,
      ],
    );
    await client.execute(
      `
        INSERT INTO organization_usage_limits (
          organization_id,
          limit_key,
          limit_value,
          used_value,
          window_seconds,
          reset_at,
          updated_at,
          updated_by
        )
        VALUES
          ($1, 'members', $2, 0, NULL, NULL, $4, $5),
          ($1, 'api_requests', $3, 0, 2592000, NULL, $4, $5)
        ON CONFLICT (organization_id, limit_key) DO NOTHING
      `,
      [
        input.organizationId,
        tenantDefaults.memberLimit,
        tenantDefaults.apiRequestLimit,
        timestamp,
        input.actorId,
      ],
    );
    await client.execute(
      `
        INSERT INTO organization_feature_flags (
          organization_id,
          flag_key,
          enabled,
          payload,
          updated_at,
          updated_by
        )
        VALUES
          ($1, 'billing', false, '{}'::jsonb, $2, $3),
          ($1, 'ai', false, '{}'::jsonb, $2, $3),
          ($1, 'storage', true, '{}'::jsonb, $2, $3)
        ON CONFLICT (organization_id, flag_key) DO NOTHING
      `,
      [input.organizationId, timestamp, input.actorId],
    );
  }

  const service = {
    async acceptInvitation(input: {
      token: string;
      userEmail: string;
      userId: string;
    }) {
      const client = await getClient();
      const timestamp = now().toISOString();
      const rows = await client.execute<InvitationRow>(
        `
          UPDATE organization_invitations
          SET accepted_at = $1,
              accepted_by = $2,
              updated_at = $1
          WHERE token_hash = $3
            AND normalized_email = $4
            AND accepted_at IS NULL
            AND rejected_at IS NULL
            AND expires_at > $1
          RETURNING *
        `,
        [
          timestamp,
          input.userId,
          hashTenantToken(input.token),
          normalizeTenantEmail(input.userEmail),
        ],
      );
      const invitation = rows[0];

      if (!invitation) {
        throw new TenantError("Invitation is invalid.", "invalid_invitation");
      }

      await client.execute(
        `
          INSERT INTO organization_memberships (
            organization_id,
            user_id,
            role,
            custom_permissions,
            status,
            invited_by,
            joined_at,
            created_at,
            updated_at,
            updated_by
          )
          VALUES ($1, $2, $3, $4::jsonb, 'active', $5, $6, $6, $6, $2)
          ON CONFLICT (organization_id, user_id) DO UPDATE
          SET role = EXCLUDED.role,
              custom_permissions = EXCLUDED.custom_permissions,
              status = 'active',
              removed_at = NULL,
              removed_by = NULL,
              updated_at = EXCLUDED.updated_at,
              updated_by = EXCLUDED.updated_by
        `,
        [
          invitation.organization_id,
          input.userId,
          invitation.role,
          JSON.stringify(
            normalizePermissions(
              parseJsonValue<string[]>(invitation.custom_permissions, []),
            ),
          ),
          invitation.created_by,
          timestamp,
        ],
      );
      await audit(client, {
        actorId: input.userId,
        eventType: "tenant.invitation.accepted",
        organizationId: invitation.organization_id,
        payload: { invitationId: invitation.id, role: invitation.role },
        subjectId: input.userId,
        subjectType: "membership",
      });

      return service.requireMembership({
        organizationId: invitation.organization_id,
        permission: "dashboard.read",
        userId: input.userId,
      });
    },

    async cancelInvitation(input: {
      actorId: string;
      invitationId: string;
      organizationId: string;
    }) {
      const client = await getClient();

      await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "invitations.reject",
        userId: input.actorId,
      });

      const timestamp = now().toISOString();
      const rows = await client.execute<InvitationRow>(
        `
          UPDATE organization_invitations
          SET rejected_at = $1,
              rejected_by = $2,
              updated_at = $1
          WHERE id = $3
            AND organization_id = $4
            AND accepted_at IS NULL
            AND rejected_at IS NULL
          RETURNING *
        `,
        [timestamp, input.actorId, input.invitationId, input.organizationId],
      );

      if (!rows[0]) {
        throw new TenantError("Invitation not found.", "invitation_not_found");
      }

      await audit(client, {
        actorId: input.actorId,
        eventType: "tenant.invitation.rejected",
        organizationId: input.organizationId,
        payload: { invitationId: input.invitationId },
        subjectId: input.invitationId,
        subjectType: "invitation",
      });

      return toInvitation(rows[0]);
    },

    async createInvitation(input: {
      actorId: string;
      customPermissions?: readonly string[];
      email: string;
      organizationId: string;
      role: TenantRole;
    }) {
      assertTenantRole(input.role);

      const client = await getClient();

      await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "members.invite",
        userId: input.actorId,
      });

      const token = createTenantToken("nsti");
      const timestamp = now();
      const permissions = normalizePermissions(input.customPermissions);
      const rows = await client.execute<InvitationRow>(
        `
          INSERT INTO organization_invitations (
            id,
            organization_id,
            email,
            normalized_email,
            role,
            custom_permissions,
            token_hash,
            expires_at,
            created_by,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $10)
          RETURNING *
        `,
        [
          randomUUID(),
          input.organizationId,
          input.email.trim(),
          normalizeTenantEmail(input.email),
          input.role,
          JSON.stringify(permissions),
          hashTenantToken(token),
          addSeconds(
            timestamp,
            tenantDefaults.invitationTtlSeconds,
          ).toISOString(),
          input.actorId,
          timestamp.toISOString(),
        ],
      );
      const invitation = rows[0]!;
      const link = invitationLink(appBaseUrl, invitationPath, token);

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
            created_at,
            updated_at
          )
          VALUES ($1, $2, 'tenant.invitation.notification', $3::jsonb, 'queued', 0, $4, $4, $4)
        `,
        [
          randomUUID(),
          input.organizationId,
          JSON.stringify({
            email: invitation.email,
            invitationId: invitation.id,
            link,
            organizationId: input.organizationId,
            role: input.role,
          }),
          timestamp.toISOString(),
        ],
      );
      await audit(client, {
        actorId: input.actorId,
        eventType: "tenant.invitation.created",
        organizationId: input.organizationId,
        payload: {
          email: invitation.normalized_email,
          invitationId: invitation.id,
          role: input.role,
        },
        subjectId: invitation.id,
        subjectType: "invitation",
      });

      return { invitation: toInvitation(invitation), link, token };
    },

    async createOrganization(input: {
      actorId: string;
      defaultLocale?: string;
      description?: string;
      logoUrl?: string;
      name: string;
      slug?: string;
      websiteUrl?: string;
    }) {
      const client = await getClient();
      const timestamp = now().toISOString();
      const baseSlug = slugify(input.slug ?? input.name) || "organization";
      const slug = `${baseSlug}-${randomBytes(3).toString("hex")}`;
      const organizationId = randomUUID();
      const organizationLocale = normalizeOptionalLocale(input.defaultLocale);

      return withTransaction(client, async (transaction) => {
        const rows = await transaction.execute<OrganizationRow>(
          `
            INSERT INTO organizations (
              id,
              slug,
              name,
              description,
              website_url,
              logo_url,
              default_locale,
              status,
              created_by,
              updated_by,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $8, $9, $9)
            RETURNING *
          `,
          [
            organizationId,
            slug,
            input.name.trim(),
            input.description?.trim() || null,
            input.websiteUrl?.trim() || null,
            input.logoUrl?.trim() || null,
            organizationLocale,
            input.actorId,
            timestamp,
          ],
        );

        await transaction.execute(
          `
            INSERT INTO organization_memberships (
              organization_id,
              user_id,
              role,
              custom_permissions,
              status,
              joined_at,
              created_at,
              updated_at,
              updated_by
            )
            VALUES ($1, $2, 'owner', '[]'::jsonb, 'active', $3, $3, $3, $2)
          `,
          [organizationId, input.actorId, timestamp],
        );
        await seedOrganizationDefaults(transaction, {
          actorId: input.actorId,
          organizationId,
        });
        await audit(transaction, {
          actorId: input.actorId,
          eventType: "tenant.organization.created",
          organizationId,
          subjectId: organizationId,
          subjectType: "organization",
        });

        return toOrganization(rows[0]!);
      });
    },

    async createTenantApiKey(input: {
      actorId: string;
      expiresAt?: string;
      name: string;
      organizationId: string;
      scopes: readonly string[];
    }) {
      const client = await getClient();

      await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "api_keys.manage",
        userId: input.actorId,
      });

      const timestamp = now().toISOString();
      const { hash, secret } = createApiKeySecret("nst");
      const keyPrefix = secret.slice(0, 12);
      const scopes = validateApiKeyScopes(input.scopes);
      const rows = await client.execute<ApiKeyRow>(
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
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $8, $9)
          RETURNING id, tenant_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at, created_by, updated_at
        `,
        [
          randomUUID(),
          input.organizationId,
          input.name.trim(),
          keyPrefix,
          hash,
          JSON.stringify(scopes),
          input.expiresAt,
          timestamp,
          input.actorId,
        ],
      );

      await audit(client, {
        actorId: input.actorId,
        eventType: "tenant.api_key.created",
        organizationId: input.organizationId,
        payload: { apiKeyId: rows[0]!.id, scopes },
        subjectId: rows[0]!.id,
        subjectType: "api_key",
      });

      return { apiKey: toApiKey(rows[0]!), secret };
    },

    async endImpersonation(input: { actorId: string; sessionId: string }) {
      const client = await getClient();
      const timestamp = now().toISOString();
      const rows = await client.execute<ImpersonationRow>(
        `
          UPDATE impersonation_sessions
          SET ended_at = $1,
              ended_by = $2
          WHERE id = $3
            AND actor_id = $2
            AND ended_at IS NULL
          RETURNING *
        `,
        [timestamp, input.actorId, input.sessionId],
      );
      const session = rows[0];

      if (!session) {
        throw new TenantError(
          "Impersonation session not found.",
          "impersonation_not_found",
        );
      }

      await audit(client, {
        actorId: input.actorId,
        eventType: "tenant.impersonation.ended",
        impersonationSessionId: session.id,
        organizationId: session.organization_id,
        subjectId: session.subject_user_id,
        subjectType: "user",
      });

      return toImpersonationSession(session);
    },

    async ensurePersonalOrganization(input: {
      displayName: string;
      userId: string;
    }) {
      const organizations = await service.listOrganizationsForUser(
        input.userId,
      );

      if (organizations.length > 0) {
        return organizations[0]!;
      }

      const client = await getClient();
      const timestamp = now().toISOString();
      const suffix = stableTenantSuffix(input.userId);
      const organizationId = `org_personal_${suffix}`;
      const name = `${input.displayName.trim() || "User"} Workspace`;
      const insertedRows = await client.execute<OrganizationRow>(
        `
          INSERT INTO organizations (
            id,
            slug,
            name,
            default_locale,
            status,
            created_by,
            updated_by,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, 'en', 'active', $4, $4, $5, $5)
          ON CONFLICT (id) DO NOTHING
          RETURNING *
        `,
        [organizationId, `personal-${suffix}`, name, input.userId, timestamp],
      );
      const organizationRow =
        insertedRows[0] ?? (await getOrganizationRow(client, organizationId));

      if (!organizationRow) {
        throw new TenantError(
          "Personal organization could not be created.",
          "organization_not_found",
        );
      }

      await client.execute(
        `
          INSERT INTO organization_memberships (
            organization_id,
            user_id,
            role,
            custom_permissions,
            status,
            joined_at,
            created_at,
            updated_at,
            updated_by
          )
          VALUES ($1, $2, 'owner', '[]'::jsonb, 'active', $3, $3, $3, $2)
          ON CONFLICT (organization_id, user_id) DO UPDATE
          SET role = 'owner',
              status = 'active',
              removed_at = NULL,
              removed_by = NULL,
              updated_at = EXCLUDED.updated_at,
              updated_by = EXCLUDED.updated_by
        `,
        [organizationId, input.userId, timestamp],
      );
      await seedOrganizationDefaults(client, {
        actorId: input.userId,
        organizationId,
      });

      if (insertedRows[0]) {
        await audit(client, {
          actorId: input.userId,
          eventType: "tenant.organization.created",
          organizationId,
          subjectId: organizationId,
          subjectType: "organization",
        });
      }

      return toOrganization(organizationRow);
    },

    async getDashboardSummary(input: {
      organizationId: string;
      userId: string;
    }) {
      const client = await getClient();
      const { membership, organization } = await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "dashboard.read",
        userId: input.userId,
      });
      const [
        memberRows,
        invitationRows,
        apiKeyRows,
        flagRows,
        limitRows,
        quotaRows,
        auditRows,
      ] = await Promise.all([
        client.execute<{ count: string }>(
          "SELECT count(*)::text AS count FROM organization_memberships WHERE organization_id = $1 AND status = 'active' AND removed_at IS NULL",
          [input.organizationId],
        ),
        client.execute<{ count: string }>(
          "SELECT count(*)::text AS count FROM organization_invitations WHERE organization_id = $1 AND accepted_at IS NULL AND rejected_at IS NULL AND expires_at > $2",
          [input.organizationId, now().toISOString()],
        ),
        client.execute<{ count: string }>(
          "SELECT count(*)::text AS count FROM api_keys WHERE tenant_id = $1 AND deleted_at IS NULL AND revoked_at IS NULL",
          [input.organizationId],
        ),
        client.execute<FeatureFlagRow>(
          "SELECT * FROM organization_feature_flags WHERE organization_id = $1 ORDER BY flag_key",
          [input.organizationId],
        ),
        client.execute<UsageLimitRow>(
          "SELECT * FROM organization_usage_limits WHERE organization_id = $1 ORDER BY limit_key",
          [input.organizationId],
        ),
        client.execute<QuotaRow>(
          "SELECT * FROM organization_quotas WHERE organization_id = $1 LIMIT 1",
          [input.organizationId],
        ),
        client.execute<AuditEventRow>(
          "SELECT * FROM tenant_audit_events WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 8",
          [input.organizationId],
        ),
      ]);

      return {
        activeApiKeyCount: Number(apiKeyRows[0]?.count ?? 0),
        auditEvents: auditRows.map(toAuditEvent),
        featureFlags: flagRows.map(toFeatureFlag),
        invitationCount: Number(invitationRows[0]?.count ?? 0),
        membership,
        memberCount: Number(memberRows[0]?.count ?? 0),
        organization,
        quota: quotaRows[0] ? toQuota(quotaRows[0]) : undefined,
        usageLimits: limitRows.map(toUsageLimit),
      };
    },

    async getImpersonationSession(sessionId: string) {
      const client = await getClient();
      const rows = await client.execute<ImpersonationRow>(
        `
          SELECT
            s.*,
            actor.display_name AS actor_name,
            actor.email AS actor_email,
            subject.display_name AS subject_name,
            subject.email AS subject_email
          FROM impersonation_sessions s
          INNER JOIN auth_users actor ON actor.id = s.actor_id
          INNER JOIN auth_users subject ON subject.id = s.subject_user_id
          WHERE s.id = $1
            AND s.ended_at IS NULL
            AND s.expires_at > $2
          LIMIT 1
        `,
        [sessionId, now().toISOString()],
      );

      return rows[0] ? toImpersonationSession(rows[0]) : undefined;
    },

    async getOrganization(input: { organizationId: string; userId: string }) {
      const client = await getClient();
      const { organization } = await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "organization.read",
        userId: input.userId,
      });

      return organization;
    },

    async listAllOrganizations(input: {
      actorGlobalRole?: TenantGlobalRole;
      actorId: string;
    }) {
      await requireGlobalOperator(input);

      const client = await getClient();
      const rows = await client.execute<
        OrganizationRow & { member_count: string }
      >(
        `
          SELECT
            o.*,
            count(m.user_id)::text AS member_count
          FROM organizations o
          LEFT JOIN organization_memberships m
            ON m.organization_id = o.id
           AND m.status = 'active'
           AND m.removed_at IS NULL
          WHERE o.deleted_at IS NULL
          GROUP BY o.id
          ORDER BY o.created_at DESC
        `,
      );

      return rows.map((row) => ({
        ...toOrganization(row),
        memberCount: Number(row.member_count),
      }));
    },

    async getSuperAdminSummary(input: {
      actorGlobalRole?: TenantGlobalRole;
      actorId: string;
    }) {
      await requireGlobalOperator(input);

      const client = await getClient();
      const [organizations, memberRows, auditRows, impersonationRows] =
        await Promise.all([
          service.listAllOrganizations(input),
          client.execute<MembershipRow & { organization_name: string }>(
            `
              SELECT
                m.*,
                u.display_name,
                u.email,
                u.avatar_url,
                o.name AS organization_name
              FROM organization_memberships m
              INNER JOIN auth_users u ON u.id = m.user_id
              INNER JOIN organizations o ON o.id = m.organization_id
              WHERE m.status = 'active'
                AND m.removed_at IS NULL
                AND o.deleted_at IS NULL
              ORDER BY o.created_at DESC, u.display_name
              LIMIT 100
            `,
          ),
          client.execute<AuditEventRow>(
            `
              SELECT *
              FROM tenant_audit_events
              ORDER BY created_at DESC
              LIMIT 25
            `,
          ),
          client.execute<ImpersonationRow>(
            `
              SELECT
                s.*,
                actor.display_name AS actor_name,
                actor.email AS actor_email,
                subject.display_name AS subject_name,
                subject.email AS subject_email
              FROM impersonation_sessions s
              INNER JOIN auth_users actor ON actor.id = s.actor_id
              INNER JOIN auth_users subject ON subject.id = s.subject_user_id
              WHERE s.ended_at IS NULL
                AND s.expires_at > $1
              ORDER BY s.started_at DESC
            `,
            [now().toISOString()],
          ),
        ]);

      return {
        activeImpersonations: impersonationRows.map(toImpersonationSession),
        auditEvents: auditRows.map(toAuditEvent),
        members: memberRows.map((row) => ({
          ...toMembership(row),
          organizationName: row.organization_name,
        })),
        organizations,
      };
    },

    async listAuditEvents(input: { actorId: string; organizationId: string }) {
      const client = await getClient();

      await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "audit.read",
        userId: input.actorId,
      });

      const rows = await client.execute<AuditEventRow>(
        "SELECT * FROM tenant_audit_events WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 50",
        [input.organizationId],
      );

      return rows.map(toAuditEvent);
    },

    async listFeatureFlags(input: { actorId: string; organizationId: string }) {
      const client = await getClient();

      await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "organization.read",
        userId: input.actorId,
      });

      const rows = await client.execute<FeatureFlagRow>(
        "SELECT * FROM organization_feature_flags WHERE organization_id = $1 ORDER BY flag_key",
        [input.organizationId],
      );

      return rows.map(toFeatureFlag);
    },

    async getQuota(input: { actorId: string; organizationId: string }) {
      const client = await getClient();

      await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "organization.read",
        userId: input.actorId,
      });

      const rows = await client.execute<QuotaRow>(
        "SELECT * FROM organization_quotas WHERE organization_id = $1 LIMIT 1",
        [input.organizationId],
      );

      return rows[0] ? toQuota(rows[0]) : undefined;
    },

    async listInvitations(input: { actorId: string; organizationId: string }) {
      const client = await getClient();

      await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "members.read",
        userId: input.actorId,
      });

      const rows = await client.execute<InvitationRow>(
        "SELECT * FROM organization_invitations WHERE organization_id = $1 ORDER BY created_at DESC",
        [input.organizationId],
      );

      return rows.map(toInvitation);
    },

    async listMembers(input: { actorId: string; organizationId: string }) {
      const client = await getClient();

      await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "members.read",
        userId: input.actorId,
      });

      const rows = await client.execute<MembershipRow>(
        `
          SELECT
            m.*,
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
            u.display_name
        `,
        [input.organizationId],
      );

      return rows.map(toMembership);
    },

    async listOrganizationsForUser(userId: string) {
      const client = await getClient();
      const rows = await client.execute<OrganizationRow>(
        `
          SELECT o.*
          FROM organizations o
          INNER JOIN organization_memberships m ON m.organization_id = o.id
          WHERE m.user_id = $1
            AND m.status = 'active'
            AND m.removed_at IS NULL
            AND o.deleted_at IS NULL
          ORDER BY o.created_at ASC
        `,
        [userId],
      );

      return rows.map(toOrganization);
    },

    async listUsageLimits(input: { actorId: string; organizationId: string }) {
      const client = await getClient();

      await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "organization.read",
        userId: input.actorId,
      });

      const rows = await client.execute<UsageLimitRow>(
        "SELECT * FROM organization_usage_limits WHERE organization_id = $1 ORDER BY limit_key",
        [input.organizationId],
      );

      return rows.map(toUsageLimit);
    },

    async listPendingInvitationsForEmail(email: string) {
      const client = await getClient();
      const rows = await client.execute<
        InvitationRow & { organization_name: string }
      >(
        `
          SELECT i.*, o.name AS organization_name
          FROM organization_invitations i
          INNER JOIN organizations o ON o.id = i.organization_id
          WHERE i.normalized_email = $1
            AND i.accepted_at IS NULL
            AND i.rejected_at IS NULL
            AND i.expires_at > $2
            AND o.deleted_at IS NULL
          ORDER BY i.created_at DESC
        `,
        [normalizeTenantEmail(email), now().toISOString()],
      );

      return rows.map((row) => ({
        ...toInvitation(row),
        organizationName: row.organization_name,
      }));
    },

    async listTenantApiKeys(input: {
      actorId: string;
      organizationId: string;
    }) {
      const client = await getClient();

      await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "api_keys.manage",
        userId: input.actorId,
      });

      const filter = createTenantFilterFragment({
        tenantId: input.organizationId,
      });
      const rows = await client.execute<ApiKeyRow>(
        `
          SELECT id, tenant_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at, created_by, updated_at
          FROM api_keys
          ${filter.sql}
            AND deleted_at IS NULL
          ORDER BY created_at DESC
        `,
        filter.params,
      );

      return rows.map(toApiKey);
    },

    async rejectInvitation(input: {
      token: string;
      userEmail: string;
      userId: string;
    }) {
      const client = await getClient();
      const timestamp = now().toISOString();
      const rows = await client.execute<InvitationRow>(
        `
          UPDATE organization_invitations
          SET rejected_at = $1,
              rejected_by = $2,
              updated_at = $1
          WHERE token_hash = $3
            AND normalized_email = $4
            AND accepted_at IS NULL
            AND rejected_at IS NULL
            AND expires_at > $1
          RETURNING *
        `,
        [
          timestamp,
          input.userId,
          hashTenantToken(input.token),
          normalizeTenantEmail(input.userEmail),
        ],
      );

      if (!rows[0]) {
        throw new TenantError("Invitation is invalid.", "invalid_invitation");
      }

      await audit(client, {
        actorId: input.userId,
        eventType: "tenant.invitation.rejected",
        organizationId: rows[0].organization_id,
        payload: { invitationId: rows[0].id },
        subjectId: rows[0].id,
        subjectType: "invitation",
      });

      return toInvitation(rows[0]);
    },

    async removeMember(input: {
      actorId: string;
      organizationId: string;
      userId: string;
    }) {
      const client = await getClient();

      await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "members.remove",
        userId: input.actorId,
      });
      await assertOwnerWillRemain(client, input.organizationId, input.userId);

      const timestamp = now().toISOString();
      const rows = await client.execute<MembershipRow>(
        `
          UPDATE organization_memberships
          SET status = 'removed',
              removed_at = $1,
              removed_by = $2,
              updated_at = $1,
              updated_by = $2
          WHERE organization_id = $3
            AND user_id = $4
            AND status = 'active'
            AND removed_at IS NULL
          RETURNING *
        `,
        [timestamp, input.actorId, input.organizationId, input.userId],
      );

      if (!rows[0]) {
        throw new TenantError("Member not found.", "member_not_found");
      }

      await audit(client, {
        actorId: input.actorId,
        eventType: "tenant.member.removed",
        organizationId: input.organizationId,
        subjectId: input.userId,
        subjectType: "membership",
      });

      return toMembership(rows[0]);
    },

    async requireMembership(input: {
      organizationId: string;
      permission?: TenantPermission;
      userId: string;
    }) {
      const client = await getClient();

      return requireMembership(client, input);
    },

    async revokeTenantApiKey(input: {
      actorId: string;
      apiKeyId: string;
      organizationId: string;
    }) {
      const client = await getClient();

      await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "api_keys.manage",
        userId: input.actorId,
      });

      const timestamp = now().toISOString();
      const rows = await client.execute<ApiKeyRow>(
        `
          UPDATE api_keys
          SET revoked_at = $1,
              updated_at = $1,
              updated_by = $2
          WHERE id = $3
            AND tenant_id = $4
            AND deleted_at IS NULL
            AND revoked_at IS NULL
          RETURNING id, tenant_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at, created_by, updated_at
        `,
        [timestamp, input.actorId, input.apiKeyId, input.organizationId],
      );

      if (!rows[0]) {
        throw new TenantError("API key not found.", "api_key_not_found");
      }

      await audit(client, {
        actorId: input.actorId,
        eventType: "tenant.api_key.revoked",
        organizationId: input.organizationId,
        subjectId: input.apiKeyId,
        subjectType: "api_key",
      });

      return toApiKey(rows[0]);
    },

    async startImpersonation(input: {
      actorDisplayName?: string;
      actorEmail?: string;
      actorGlobalRole?: TenantGlobalRole;
      actorId: string;
      organizationId: string;
      reason: string;
      subjectUserId: string;
    }) {
      const client = await getClient();
      const reason = input.reason.trim();

      if (!reason) {
        throw new TenantError(
          "Impersonation reason is required.",
          "reason_required",
        );
      }

      const actorMembership = await getMembershipRow(
        client,
        input.organizationId,
        input.actorId,
      );
      const isGlobalOperator = isGlobalTenantOperator(input.actorGlobalRole);

      if (isGlobalOperator) {
        await ensureGlobalOperatorIdentity(client, input);
      } else if (actorMembership) {
        assertTenantPermission(
          toMembership(actorMembership),
          "impersonation.start",
        );
      } else {
        throw new TenantError(
          "Global tenant administration requires an operator role.",
          "forbidden",
        );
      }

      if (input.actorId === input.subjectUserId) {
        throw new TenantError(
          "Actors cannot impersonate themselves.",
          "invalid_impersonation_target",
        );
      }

      const subjectMembership = await getMembershipRow(
        client,
        input.organizationId,
        input.subjectUserId,
      );

      if (!subjectMembership) {
        throw new TenantError(
          "Target user is not an active organization member.",
          "target_membership_required",
        );
      }

      const timestamp = now();
      const rows = await client.execute<ImpersonationRow>(
        `
          INSERT INTO impersonation_sessions (
            id,
            organization_id,
            actor_id,
            subject_user_id,
            reason,
            started_at,
            expires_at,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $6)
          RETURNING *
        `,
        [
          randomUUID(),
          input.organizationId,
          input.actorId,
          input.subjectUserId,
          reason,
          timestamp.toISOString(),
          addSeconds(timestamp, 60 * 60).toISOString(),
        ],
      );

      await audit(client, {
        actorId: input.actorId,
        eventType: "tenant.impersonation.started",
        impersonationSessionId: rows[0]!.id,
        organizationId: input.organizationId,
        payload: { reason },
        subjectId: input.subjectUserId,
        subjectType: "user",
      });

      return toImpersonationSession(rows[0]!);
    },

    async updateFeatureFlag(input: {
      actorId: string;
      enabled: boolean;
      key: string;
      organizationId: string;
      payload?: Record<string, unknown>;
    }) {
      const client = await getClient();

      await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "feature_flags.manage",
        userId: input.actorId,
      });

      const timestamp = now().toISOString();
      const rows = await client.execute<FeatureFlagRow>(
        `
          INSERT INTO organization_feature_flags (
            organization_id,
            flag_key,
            enabled,
            payload,
            updated_at,
            updated_by
          )
          VALUES ($1, $2, $3, $4::jsonb, $5, $6)
          ON CONFLICT (organization_id, flag_key) DO UPDATE
          SET enabled = EXCLUDED.enabled,
              payload = EXCLUDED.payload,
              updated_at = EXCLUDED.updated_at,
              updated_by = EXCLUDED.updated_by
          RETURNING *
        `,
        [
          input.organizationId,
          input.key.trim(),
          input.enabled,
          JSON.stringify(input.payload ?? {}),
          timestamp,
          input.actorId,
        ],
      );

      await audit(client, {
        actorId: input.actorId,
        eventType: "tenant.feature_flag.updated",
        organizationId: input.organizationId,
        payload: { enabled: input.enabled, key: input.key.trim() },
        subjectId: input.key.trim(),
        subjectType: "feature_flag",
      });

      return toFeatureFlag(rows[0]!);
    },

    async updateMember(input: {
      actorId: string;
      customPermissions?: readonly string[];
      organizationId: string;
      role: TenantRole;
      userId: string;
    }) {
      assertTenantRole(input.role);

      const client = await getClient();

      await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "members.update",
        userId: input.actorId,
      });

      if (input.role !== "owner") {
        await assertOwnerWillRemain(client, input.organizationId, input.userId);
      }

      const timestamp = now().toISOString();
      const rows = await client.execute<MembershipRow>(
        `
          UPDATE organization_memberships
          SET role = $1,
              custom_permissions = $2::jsonb,
              updated_at = $3,
              updated_by = $4
          WHERE organization_id = $5
            AND user_id = $6
            AND status = 'active'
            AND removed_at IS NULL
          RETURNING *
        `,
        [
          input.role,
          JSON.stringify(normalizePermissions(input.customPermissions)),
          timestamp,
          input.actorId,
          input.organizationId,
          input.userId,
        ],
      );

      if (!rows[0]) {
        throw new TenantError("Member not found.", "member_not_found");
      }

      await audit(client, {
        actorId: input.actorId,
        eventType: "tenant.member.updated",
        organizationId: input.organizationId,
        payload: { role: input.role },
        subjectId: input.userId,
        subjectType: "membership",
      });

      return toMembership(rows[0]);
    },

    async updateOrganization(input: {
      actorId: string;
      defaultLocale?: string;
      description?: string;
      logoUrl?: string;
      name: string;
      organizationId: string;
      websiteUrl?: string;
    }) {
      const client = await getClient();

      await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "organization.update",
        userId: input.actorId,
      });

      const timestamp = now().toISOString();
      const organizationLocale = normalizeOptionalLocale(input.defaultLocale);
      const rows = await client.execute<OrganizationRow>(
        `
          UPDATE organizations
          SET name = $1,
              description = $2,
              website_url = $3,
              logo_url = $4,
              default_locale = $5,
              updated_at = $6,
              updated_by = $7
          WHERE id = $8
            AND deleted_at IS NULL
          RETURNING *
        `,
        [
          input.name.trim(),
          input.description?.trim() || null,
          input.websiteUrl?.trim() || null,
          input.logoUrl?.trim() || null,
          organizationLocale,
          timestamp,
          input.actorId,
          input.organizationId,
        ],
      );

      if (!rows[0]) {
        throw new TenantError(
          "Organization not found.",
          "organization_not_found",
        );
      }

      await audit(client, {
        actorId: input.actorId,
        eventType: "tenant.organization.updated",
        organizationId: input.organizationId,
        subjectId: input.organizationId,
        subjectType: "organization",
      });

      return toOrganization(rows[0]);
    },

    async updateQuota(input: {
      actorId: string;
      aiTokenLimit: number;
      organizationId: string;
      storageBytesLimit: number;
    }) {
      const client = await getClient();

      await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "limits.manage",
        userId: input.actorId,
      });

      const timestamp = now().toISOString();
      const rows = await client.execute<QuotaRow>(
        `
          INSERT INTO organization_quotas (
            organization_id,
            storage_bytes_limit,
            storage_bytes_used,
            ai_token_limit,
            ai_token_used,
            updated_at,
            updated_by
          )
          VALUES ($1, $2, 0, $3, 0, $4, $5)
          ON CONFLICT (organization_id) DO UPDATE
          SET storage_bytes_limit = EXCLUDED.storage_bytes_limit,
              ai_token_limit = EXCLUDED.ai_token_limit,
              updated_at = EXCLUDED.updated_at,
              updated_by = EXCLUDED.updated_by
          RETURNING *
        `,
        [
          input.organizationId,
          Math.max(0, input.storageBytesLimit),
          Math.max(0, input.aiTokenLimit),
          timestamp,
          input.actorId,
        ],
      );

      await audit(client, {
        actorId: input.actorId,
        eventType: "tenant.quota.updated",
        organizationId: input.organizationId,
        payload: {
          aiTokenLimit: input.aiTokenLimit,
          storageBytesLimit: input.storageBytesLimit,
        },
        subjectId: input.organizationId,
        subjectType: "quota",
      });

      return toQuota(rows[0]!);
    },

    async updateUsageLimit(input: {
      actorId: string;
      key: string;
      limitValue: number;
      organizationId: string;
      windowSeconds?: number;
    }) {
      const client = await getClient();

      await requireMembership(client, {
        organizationId: input.organizationId,
        permission: "limits.manage",
        userId: input.actorId,
      });

      const timestamp = now().toISOString();
      const rows = await client.execute<UsageLimitRow>(
        `
          INSERT INTO organization_usage_limits (
            organization_id,
            limit_key,
            limit_value,
            used_value,
            window_seconds,
            reset_at,
            updated_at,
            updated_by
          )
          VALUES ($1, $2, $3, 0, $4, NULL, $5, $6)
          ON CONFLICT (organization_id, limit_key) DO UPDATE
          SET limit_value = EXCLUDED.limit_value,
              window_seconds = EXCLUDED.window_seconds,
              updated_at = EXCLUDED.updated_at,
              updated_by = EXCLUDED.updated_by
          RETURNING *
        `,
        [
          input.organizationId,
          input.key.trim(),
          Math.max(0, input.limitValue),
          input.windowSeconds,
          timestamp,
          input.actorId,
        ],
      );

      await audit(client, {
        actorId: input.actorId,
        eventType: "tenant.usage_limit.updated",
        organizationId: input.organizationId,
        payload: {
          key: input.key.trim(),
          limitValue: input.limitValue,
          windowSeconds: input.windowSeconds,
        },
        subjectId: input.key.trim(),
        subjectType: "usage_limit",
      });

      return toUsageLimit(rows[0]!);
    },
  };

  return service;
}
