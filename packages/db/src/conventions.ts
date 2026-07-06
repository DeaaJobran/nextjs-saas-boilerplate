import { createHash, randomBytes } from "node:crypto";

export const tenantColumnName = "tenant_id";

export const auditColumnNames = {
  createdAt: "created_at",
  createdBy: "created_by",
  updatedAt: "updated_at",
  updatedBy: "updated_by",
} as const;

export const softDeleteColumnNames = {
  deletedAt: "deleted_at",
  deletedBy: "deleted_by",
} as const;

export const tenantDataModelDecision = {
  defaultColumn: tenantColumnName,
  enforcement:
    "All tenant-scoped tables include tenant_id now; service/repository APIs must require an explicit tenant boundary before exposing tenant-owned data.",
  rowLevelSecurity:
    "Deferred until tenant membership and permission tables exist, then re-evaluate PostgreSQL RLS for production defense-in-depth.",
} as const;

export const embeddedDatabaseDecision = {
  localDevelopment: "pglite",
  sqlite:
    "Not included because the boilerplate is PostgreSQL-first and uses PGlite for local embedded development without changing SQL dialects.",
} as const;

export type TenantScopedRecord = {
  tenantId: string;
};

export type AuditMetadata = {
  createdAt: string;
  createdBy?: string;
  updatedAt: string;
  updatedBy?: string;
};

export type SoftDeleteMetadata = {
  deletedAt?: string;
  deletedBy?: string;
};

export function createAuditMetadata(
  actorId?: string,
  now = new Date(),
): AuditMetadata {
  const timestamp = now.toISOString();

  return {
    createdAt: timestamp,
    createdBy: actorId,
    updatedAt: timestamp,
    updatedBy: actorId,
  };
}

export function touchAuditMetadata(
  metadata: Pick<AuditMetadata, "createdAt" | "createdBy">,
  actorId?: string,
  now = new Date(),
): AuditMetadata {
  return {
    ...metadata,
    updatedAt: now.toISOString(),
    updatedBy: actorId,
  };
}

export function markSoftDeleted(
  actorId?: string,
  now = new Date(),
): Required<SoftDeleteMetadata> {
  return {
    deletedAt: now.toISOString(),
    deletedBy: actorId ?? "system",
  };
}

export function createApiKeySecret(prefix = "nsk") {
  const secret = `${prefix}_${randomBytes(32).toString("base64url")}`;

  return {
    hash: hashApiKey(secret),
    secret,
  };
}

export function hashApiKey(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}
