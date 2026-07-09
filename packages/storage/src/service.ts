import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";

import {
  getDatabaseRuntime,
  type Queryable,
  runMigrations,
} from "@nextjs-saas/db";

import { createLocalStorageAdapter } from "./adapters/local";
import { assertStorageCondition, StorageError } from "./errors";
import {
  createDocumentPreview,
  createImageVariants,
  extractDocumentMetadata,
  extractImageMetadata,
} from "./media";
import { buildTenantObjectKey, variantObjectKey } from "./path";
import type {
  StorageAccessPolicy,
  StorageAdapter,
  StorageFile,
  StorageFileStatus,
  StorageFileVariant,
  StoragePermission,
  StoragePrincipal,
  StorageProviderConfiguration,
  StorageUploadResult,
  StorageValidationRules,
  StorageVisibility,
} from "./types";
import {
  defaultStorageValidationRules,
  sha256Hex,
  validateStorageObject,
} from "./validation";

type TransactionalQueryable = Queryable & {
  transaction<T>(callback: (client: Queryable) => Promise<T>): Promise<T>;
};

type StorageServiceOptions = {
  adapter?: StorageAdapter;
  client?: Queryable;
  now?: () => Date;
  provider?: Partial<StorageProviderConfiguration>;
  uploadTtlSeconds?: number;
  validation?: Partial<StorageValidationRules>;
  virusScanner?: (input: {
    byteSize: number;
    contentType: string;
    data: Uint8Array;
    fileName: string;
    tenantId: string;
  }) => Promise<{ clean: boolean; reason?: string }>;
};

type FileRow = {
  access_policy: Record<string, unknown> | string;
  byte_size: number | string;
  checksum_sha256: string | null;
  content_type: string;
  created_at: Date | string;
  deleted_at: Date | string | null;
  document_metadata: Record<string, unknown> | string | null;
  expires_at: Date | string | null;
  file_name: string;
  id: string;
  image_metadata: Record<string, unknown> | string | null;
  metadata: Record<string, unknown> | string;
  object_key: string;
  owner_id: string | null;
  provider_id: string;
  status: StorageFileStatus;
  tenant_id: string;
  updated_at: Date | string;
  uploaded_at: Date | string | null;
  visibility: StorageVisibility;
};

type VariantRow = {
  byte_size: number | string;
  content_type: string;
  created_at: Date | string;
  file_id: string;
  height: number | null;
  id: string;
  kind: string;
  metadata: Record<string, unknown> | string;
  object_key: string;
  width: number | null;
};

type IntentRow = {
  byte_size: number | string;
  checksum_sha256: string | null;
  completed_at: Date | string | null;
  content_type: string;
  created_at: Date | string;
  expires_at: Date | string;
  file_id: string;
  id: string;
  object_key: string;
  owner_id: string | null;
  status: "pending" | "processing" | "completed" | "expired";
  tenant_id: string;
  token_hash: string;
};

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function parseJson<T>(value: T | string | null | undefined, fallback: T): T {
  if (!value) {
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

function defaultAdapter() {
  return createLocalStorageAdapter({
    rootDir:
      process.env.STORAGE_LOCAL_ROOT ??
      path.join(process.cwd(), ".local", "storage"),
    signingSecret: process.env.STORAGE_SIGNING_SECRET,
  });
}

function defaultProviderConfiguration(
  adapter: StorageAdapter,
  validation: StorageValidationRules,
  input?: Partial<StorageProviderConfiguration>,
): StorageProviderConfiguration {
  return {
    active: input?.active ?? true,
    allowedExtensions: input?.allowedExtensions ?? validation.allowedExtensions,
    allowedMimeTypes: input?.allowedMimeTypes ?? validation.allowedMimeTypes,
    bucket: input?.bucket ?? adapter.id,
    displayName: input?.displayName ?? `${adapter.kind} storage`,
    endpoint: input?.endpoint,
    forcePathStyle: input?.forcePathStyle ?? adapter.kind === "local",
    id: input?.id ?? adapter.id,
    kind: input?.kind ?? adapter.kind,
    maxUploadBytes: input?.maxUploadBytes ?? validation.maxBytes,
    publicBaseUrl: input?.publicBaseUrl,
    region: input?.region,
  };
}

function toFile(row: FileRow): StorageFile {
  return {
    accessPolicy: parseJson<StorageAccessPolicy>(row.access_policy, {}),
    byteSize: toNumber(row.byte_size),
    checksumSha256: row.checksum_sha256 ?? undefined,
    contentType: row.content_type,
    createdAt: toIsoString(row.created_at)!,
    deletedAt: toIsoString(row.deleted_at),
    documentMetadata: parseJson<Record<string, unknown> | undefined>(
      row.document_metadata,
      undefined,
    ),
    expiresAt: toIsoString(row.expires_at),
    fileName: row.file_name,
    id: row.id,
    imageMetadata: parseJson<Record<string, unknown> | undefined>(
      row.image_metadata,
      undefined,
    ),
    metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
    objectKey: row.object_key,
    ownerId: row.owner_id ?? undefined,
    providerId: row.provider_id,
    status: row.status,
    tenantId: row.tenant_id,
    updatedAt: toIsoString(row.updated_at)!,
    uploadedAt: toIsoString(row.uploaded_at),
    visibility: row.visibility,
  };
}

function toVariant(row: VariantRow): StorageFileVariant {
  return {
    byteSize: toNumber(row.byte_size),
    contentType: row.content_type,
    createdAt: toIsoString(row.created_at)!,
    fileId: row.file_id,
    height: row.height ?? undefined,
    id: row.id,
    kind: row.kind,
    metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
    objectKey: row.object_key,
    width: row.width ?? undefined,
  };
}

function hasPermission(
  principal: StoragePrincipal,
  permission: StoragePermission,
) {
  return (
    principal.permissions?.includes("owner") ||
    principal.permissions?.includes(permission)
  );
}

function canReadFile(file: StorageFile, principal: StoragePrincipal) {
  if (principal.tenantId !== file.tenantId) {
    return false;
  }

  if (file.status !== "available") {
    return false;
  }

  if (file.visibility === "public" || file.accessPolicy.publicRead) {
    return true;
  }

  if (file.ownerId && file.ownerId === principal.actorId) {
    return true;
  }

  if (
    principal.actorId &&
    file.accessPolicy.allowedUserIds?.includes(principal.actorId)
  ) {
    return true;
  }

  return hasPermission(principal, "read");
}

function canWriteFile(file: StorageFile, principal: StoragePrincipal) {
  if (principal.tenantId !== file.tenantId) {
    return false;
  }

  return (
    (file.ownerId && file.ownerId === principal.actorId) ||
    hasPermission(principal, "write")
  );
}

function isImage(contentType: string) {
  return contentType.startsWith("image/");
}

function isDocument(contentType: string) {
  return (
    contentType === "application/pdf" ||
    contentType === "application/json" ||
    contentType === "text/plain" ||
    contentType === "text/csv"
  );
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

export function createStorageService(options: StorageServiceOptions = {}) {
  const adapter = options.adapter ?? defaultAdapter();
  const now = options.now ?? (() => new Date());
  const validation = {
    ...defaultStorageValidationRules,
    ...options.validation,
  };
  const provider = defaultProviderConfiguration(
    adapter,
    validation,
    options.provider,
  );
  const uploadTtlSeconds = options.uploadTtlSeconds ?? 15 * 60;

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

  async function ensureProvider(client: Queryable) {
    const timestamp = now().toISOString();

    await client.execute(
      `
        INSERT INTO storage_providers (
          id,
          provider,
          display_name,
          kind,
          bucket,
          region,
          endpoint,
          public_base_url,
          force_path_style,
          active,
          max_upload_bytes,
          allowed_mime_types,
          allowed_extensions,
          virus_scanning_enabled,
          image_processing_enabled,
          created_at,
          updated_at
        )
        VALUES (
          $1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11::jsonb, $12::jsonb, $13, $14, $15, $15
        )
        ON CONFLICT (id) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            kind = EXCLUDED.kind,
            bucket = EXCLUDED.bucket,
            region = EXCLUDED.region,
            endpoint = EXCLUDED.endpoint,
            public_base_url = EXCLUDED.public_base_url,
            force_path_style = EXCLUDED.force_path_style,
            active = EXCLUDED.active,
            max_upload_bytes = EXCLUDED.max_upload_bytes,
            allowed_mime_types = EXCLUDED.allowed_mime_types,
            allowed_extensions = EXCLUDED.allowed_extensions,
            virus_scanning_enabled = EXCLUDED.virus_scanning_enabled,
            image_processing_enabled = EXCLUDED.image_processing_enabled,
            updated_at = EXCLUDED.updated_at
      `,
      [
        provider.id,
        provider.displayName,
        provider.kind,
        provider.bucket,
        provider.region ?? null,
        provider.endpoint ?? null,
        provider.publicBaseUrl ?? null,
        provider.forcePathStyle,
        provider.active,
        provider.maxUploadBytes,
        JSON.stringify(provider.allowedMimeTypes),
        JSON.stringify(provider.allowedExtensions),
        Boolean(options.virusScanner),
        true,
        timestamp,
      ],
    );
  }

  async function audit(
    client: Queryable,
    input: {
      actorId?: string;
      eventType: string;
      fileId?: string;
      payload?: Record<string, unknown>;
      tenantId: string;
    },
  ) {
    await client.execute(
      `
        INSERT INTO storage_audit_events (
          id,
          tenant_id,
          file_id,
          actor_id,
          event_type,
          payload,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      `,
      [
        randomUUID(),
        input.tenantId,
        input.fileId ?? null,
        input.actorId ?? null,
        input.eventType,
        JSON.stringify(input.payload ?? {}),
        now().toISOString(),
      ],
    );
  }

  async function reserveQuota(
    client: Queryable,
    input: { byteDelta: number; tenantId: string },
  ) {
    if (input.byteDelta === 0) {
      return;
    }

    if (input.byteDelta > 0) {
      const rows = await client.execute<{
        storage_bytes_used: number | string;
      }>(
        `
          UPDATE organization_quotas
          SET storage_bytes_used = storage_bytes_used + $2,
              updated_at = $3
          WHERE organization_id = $1
            AND storage_bytes_used + $2 <= storage_bytes_limit
          RETURNING storage_bytes_used
        `,
        [input.tenantId, input.byteDelta, now().toISOString()],
      );

      if (!rows[0]) {
        throw new StorageError(
          "Storage quota would be exceeded.",
          "storage_quota_exceeded",
        );
      }

      return;
    }

    await client.execute(
      `
        UPDATE organization_quotas
        SET storage_bytes_used = GREATEST(0, storage_bytes_used - $2),
            updated_at = $3
        WHERE organization_id = $1
      `,
      [input.tenantId, Math.abs(input.byteDelta), now().toISOString()],
    );
  }

  async function loadFile(client: Queryable, fileId: string) {
    const rows = await client.execute<FileRow>(
      "SELECT * FROM storage_files WHERE id = $1",
      [fileId],
    );

    return rows[0] ? toFile(rows[0]) : undefined;
  }

  async function loadVariants(client: Queryable, fileId: string) {
    const rows = await client.execute<VariantRow>(
      `
        SELECT *
        FROM storage_file_variants
        WHERE file_id = $1
        ORDER BY kind ASC
      `,
      [fileId],
    );

    return rows.map(toVariant);
  }

  async function hasActiveGrant(
    client: Queryable,
    input: {
      file: StorageFile;
      permission: StoragePermission;
      principal: StoragePrincipal;
    },
  ) {
    const timestampIso = now().toISOString();

    if (input.principal.actorId) {
      const rows = await client.execute<{ id: string }>(
        `
          SELECT id
          FROM storage_access_grants
          WHERE file_id = $1
            AND tenant_id = $2
            AND grantee_type = 'user'
            AND grantee_id = $3
            AND (permission = $4 OR permission = 'owner')
            AND (expires_at IS NULL OR expires_at > $5)
          LIMIT 1
        `,
        [
          input.file.id,
          input.file.tenantId,
          input.principal.actorId,
          input.permission,
          timestampIso,
        ],
      );

      if (rows[0]) {
        return true;
      }
    }

    for (const role of input.principal.roles ?? []) {
      const rows = await client.execute<{ id: string }>(
        `
          SELECT id
          FROM storage_access_grants
          WHERE file_id = $1
            AND tenant_id = $2
            AND grantee_type = 'role'
            AND grantee_id = $3
            AND (permission = $4 OR permission = 'owner')
            AND (expires_at IS NULL OR expires_at > $5)
          LIMIT 1
        `,
        [
          input.file.id,
          input.file.tenantId,
          role,
          input.permission,
          timestampIso,
        ],
      );

      if (rows[0]) {
        return true;
      }
    }

    return false;
  }

  async function scanFile(input: {
    byteSize: number;
    contentType: string;
    data: Uint8Array;
    fileName: string;
    tenantId: string;
  }) {
    if (!options.virusScanner) {
      return;
    }

    const result = await options.virusScanner(input);

    if (!result.clean) {
      throw new StorageError(
        result.reason ?? "File failed malware scanning.",
        "malware_detected",
      );
    }
  }

  async function buildMetadata(input: {
    contentType: string;
    data: Uint8Array;
    fileName: string;
  }) {
    const imageMetadata = isImage(input.contentType)
      ? await extractImageMetadata(input.data)
      : undefined;
    const documentMetadata = isDocument(input.contentType)
      ? extractDocumentMetadata(input)
      : undefined;

    return { documentMetadata, imageMetadata };
  }

  async function persistVariants(
    client: Queryable,
    variants: StorageFileVariant[],
  ) {
    for (const variant of variants) {
      await client.execute(
        `
          INSERT INTO storage_file_variants (
            id,
            file_id,
            kind,
            object_key,
            content_type,
            byte_size,
            width,
            height,
            metadata,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
          ON CONFLICT (file_id, kind) DO UPDATE
          SET object_key = EXCLUDED.object_key,
              content_type = EXCLUDED.content_type,
              byte_size = EXCLUDED.byte_size,
              width = EXCLUDED.width,
              height = EXCLUDED.height,
              metadata = EXCLUDED.metadata
        `,
        [
          variant.id,
          variant.fileId,
          variant.kind,
          variant.objectKey,
          variant.contentType,
          variant.byteSize,
          variant.width ?? null,
          variant.height ?? null,
          JSON.stringify(variant.metadata),
          variant.createdAt,
        ],
      );
    }
  }

  async function createPreviewVariant(input: {
    contentType: string;
    createdAt: string;
    data: Uint8Array;
    fileId: string;
    fileName: string;
    originalKey: string;
  }) {
    if (!isDocument(input.contentType)) {
      return undefined;
    }

    const preview = createDocumentPreview(input);
    const key = variantObjectKey({
      extension: "txt",
      fileId: input.fileId,
      kind: "document-preview",
      originalKey: input.originalKey,
    });

    await adapter.putObject({
      body: preview.body,
      checksumSha256: sha256Hex(preview.body),
      contentType: preview.contentType,
      key,
      metadata: {
        source: input.fileId,
        variant: "document-preview",
      },
    });

    return {
      byteSize: preview.body.byteLength,
      contentType: preview.contentType,
      createdAt: input.createdAt,
      fileId: input.fileId,
      id: `${input.fileId}_document_preview`,
      kind: "document-preview",
      metadata: { checksumSha256: sha256Hex(preview.body) },
      objectKey: key,
    } satisfies StorageFileVariant;
  }

  async function createManagedVariants(input: {
    contentType: string;
    createdAt: string;
    data: Uint8Array;
    fileId: string;
    fileName: string;
    objectKey: string;
  }) {
    const variants: StorageFileVariant[] = [];

    try {
      if (isImage(input.contentType)) {
        variants.push(
          ...(await createImageVariants({
            adapter,
            contentType: input.contentType,
            createdAt: input.createdAt,
            data: input.data,
            fileId: input.fileId,
            originalKey: input.objectKey,
          })),
        );
      }

      const preview = await createPreviewVariant({
        contentType: input.contentType,
        createdAt: input.createdAt,
        data: input.data,
        fileId: input.fileId,
        fileName: input.fileName,
        originalKey: input.objectKey,
      });

      if (preview) {
        variants.push(preview);
      }

      return variants;
    } catch (error) {
      await Promise.all(
        variants.map((variant) =>
          adapter.deleteObject({ key: variant.objectKey }),
        ),
      );

      throw error;
    }
  }

  async function createUploadIntent(input: {
    accessPolicy?: StorageAccessPolicy;
    byteSize: number;
    checksumSha256?: string;
    contentType: string;
    expiresAt?: string;
    fileId?: string;
    fileName: string;
    metadata?: Record<string, unknown>;
    ownerId?: string;
    tenantId: string;
    token?: string;
    visibility?: StorageVisibility;
  }) {
    const normalized = validateStorageObject({
      byteSize: input.byteSize,
      checksumSha256: input.checksumSha256,
      contentType: input.contentType,
      fileName: input.fileName,
      rules: validation,
    });
    const client = await getClient();
    const timestamp = now();
    const timestampIso = timestamp.toISOString();
    const expiresAt = input.expiresAt
      ? new Date(input.expiresAt)
      : addSeconds(timestamp, uploadTtlSeconds);
    const fileId = input.fileId ?? randomUUID();
    const token =
      input.token ?? `nsstorage_${randomBytes(32).toString("base64url")}`;
    const objectKey = buildTenantObjectKey({
      fileId,
      fileName: input.fileName,
      ownerId: input.ownerId,
      tenantId: input.tenantId,
    });
    const signedUpload = await adapter.signedUploadUrl({
      checksumSha256: input.checksumSha256,
      contentType: normalized.contentType,
      expiresAt,
      key: objectKey,
    });
    const accessPolicy = input.accessPolicy ?? {
      publicRead: input.visibility === "public",
      requireTenantMember: true,
    };
    const visibility = input.visibility ?? "private";

    await ensureProvider(client);
    await withTransaction(client, async (transaction) => {
      await reserveQuota(transaction, {
        byteDelta: input.byteSize,
        tenantId: input.tenantId,
      });
      await transaction.execute(
        `
          INSERT INTO storage_files (
            id,
            tenant_id,
            owner_id,
            provider_id,
            bucket,
            object_key,
            visibility,
            file_name,
            content_type,
            byte_size,
            checksum_sha256,
            status,
            access_policy,
            metadata,
            created_at,
            updated_at,
            expires_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            'pending', $12::jsonb, $13::jsonb, $14, $14, $15
          )
        `,
        [
          fileId,
          input.tenantId,
          input.ownerId ?? null,
          provider.id,
          provider.bucket,
          objectKey,
          visibility,
          input.fileName,
          normalized.contentType,
          input.byteSize,
          input.checksumSha256 ?? null,
          JSON.stringify(accessPolicy),
          JSON.stringify(input.metadata ?? {}),
          timestampIso,
          input.expiresAt ?? null,
        ],
      );
      await transaction.execute(
        `
          INSERT INTO storage_upload_intents (
            id,
            file_id,
            tenant_id,
            owner_id,
            provider_id,
            object_key,
            token_hash,
            status,
            upload_url,
            expires_at,
            byte_size,
            content_type,
            checksum_sha256,
            metadata,
            created_at,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9,
            $10, $11, $12, $13::jsonb, $14, $14
          )
        `,
        [
          randomUUID(),
          fileId,
          input.tenantId,
          input.ownerId ?? null,
          provider.id,
          objectKey,
          sha256Hex(token),
          signedUpload.url,
          expiresAt.toISOString(),
          input.byteSize,
          normalized.contentType,
          input.checksumSha256 ?? null,
          JSON.stringify(input.metadata ?? {}),
          timestampIso,
        ],
      );
      await transaction.execute(
        `
          INSERT INTO storage_usage_records (
            id,
            tenant_id,
            file_id,
            byte_delta,
            reason,
            metadata,
            created_at
          )
          VALUES ($1, $2, $3, $4, 'upload_intent_reserved', $5::jsonb, $6)
        `,
        [
          randomUUID(),
          input.tenantId,
          fileId,
          input.byteSize,
          JSON.stringify({ contentType: normalized.contentType }),
          timestampIso,
        ],
      );
      await audit(transaction, {
        actorId: input.ownerId,
        eventType: "storage.upload_intent.created",
        fileId,
        payload: {
          byteSize: input.byteSize,
          contentType: normalized.contentType,
        },
        tenantId: input.tenantId,
      });
    });

    const file = (await loadFile(client, fileId))!;

    return {
      byteSize: input.byteSize,
      checksumSha256: input.checksumSha256,
      completedAt: undefined,
      contentType: normalized.contentType,
      createdAt: timestampIso,
      expiresAt: expiresAt.toISOString(),
      file,
      id: fileId,
      signedUpload,
      status: "pending" as const,
      token,
    };
  }

  async function uploadFile(input: {
    accessPolicy?: StorageAccessPolicy;
    checksumSha256?: string;
    contentType: string;
    data: Uint8Array;
    expiresAt?: string;
    fileName: string;
    metadata?: Record<string, unknown>;
    ownerId?: string;
    tenantId: string;
    visibility?: StorageVisibility;
  }): Promise<StorageUploadResult> {
    const checksumSha256 = input.checksumSha256 ?? sha256Hex(input.data);
    const normalized = validateStorageObject({
      byteSize: input.data.byteLength,
      checksumSha256,
      contentType: input.contentType,
      data: input.data,
      fileName: input.fileName,
      rules: validation,
    });

    await scanFile({
      byteSize: input.data.byteLength,
      contentType: normalized.contentType,
      data: input.data,
      fileName: input.fileName,
      tenantId: input.tenantId,
    });

    const client = await getClient();
    const timestampIso = now().toISOString();
    const fileId = randomUUID();
    const objectKey = buildTenantObjectKey({
      fileId,
      fileName: input.fileName,
      ownerId: input.ownerId,
      tenantId: input.tenantId,
    });
    const accessPolicy = input.accessPolicy ?? {
      publicRead: input.visibility === "public",
      requireTenantMember: true,
    };

    const variants: StorageFileVariant[] = [];
    let originalObjectWritten = false;

    try {
      const metadata = await buildMetadata({
        contentType: normalized.contentType,
        data: input.data,
        fileName: input.fileName,
      });
      variants.push(
        ...(await createManagedVariants({
          contentType: normalized.contentType,
          createdAt: timestampIso,
          data: input.data,
          fileId,
          fileName: input.fileName,
          objectKey,
        })),
      );
      const byteDelta =
        input.data.byteLength +
        variants.reduce((total, variant) => total + variant.byteSize, 0);

      await adapter.putObject({
        body: input.data,
        checksumSha256,
        contentType: normalized.contentType,
        key: objectKey,
        metadata: {
          fileId,
          tenantId: input.tenantId,
        },
      });
      originalObjectWritten = true;

      await ensureProvider(client);
      await withTransaction(client, async (transaction) => {
        await reserveQuota(transaction, {
          byteDelta,
          tenantId: input.tenantId,
        });
        await transaction.execute(
          `
            INSERT INTO storage_files (
              id,
              tenant_id,
              owner_id,
              provider_id,
              bucket,
              object_key,
              visibility,
              file_name,
              content_type,
              byte_size,
              checksum_sha256,
              status,
              access_policy,
              metadata,
              image_metadata,
              document_metadata,
              created_at,
              updated_at,
              uploaded_at,
              expires_at
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
              'available', $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb,
              $16, $16, $16, $17
            )
          `,
          [
            fileId,
            input.tenantId,
            input.ownerId ?? null,
            provider.id,
            provider.bucket,
            objectKey,
            input.visibility ?? "private",
            input.fileName,
            normalized.contentType,
            input.data.byteLength,
            checksumSha256,
            JSON.stringify(accessPolicy),
            JSON.stringify(input.metadata ?? {}),
            metadata.imageMetadata
              ? JSON.stringify(metadata.imageMetadata)
              : null,
            metadata.documentMetadata
              ? JSON.stringify(metadata.documentMetadata)
              : null,
            timestampIso,
            input.expiresAt ?? null,
          ],
        );
        await persistVariants(transaction, variants);
        await transaction.execute(
          `
            INSERT INTO storage_usage_records (
              id,
              tenant_id,
              file_id,
              byte_delta,
              reason,
              metadata,
              created_at
            )
            VALUES ($1, $2, $3, $4, 'upload', $5::jsonb, $6)
          `,
          [
            randomUUID(),
            input.tenantId,
            fileId,
            byteDelta,
            JSON.stringify({ variantCount: variants.length }),
            timestampIso,
          ],
        );
        await audit(transaction, {
          actorId: input.ownerId,
          eventType: "storage.file.uploaded",
          fileId,
          payload: { byteDelta, variantCount: variants.length },
          tenantId: input.tenantId,
        });
      });
    } catch (error) {
      if (originalObjectWritten) {
        await adapter.deleteObject({ key: objectKey });
      }

      await Promise.all(
        variants.map((variant) =>
          adapter.deleteObject({ key: variant.objectKey }),
        ),
      );

      throw error;
    }

    const file = (await loadFile(client, fileId))!;

    return {
      download:
        file.visibility === "public"
          ? await adapter.signedDownloadUrl({
              expiresAt: addSeconds(now(), 60 * 60),
              fileName: file.fileName,
              key: file.objectKey,
            })
          : undefined,
      file,
      variants,
    };
  }

  async function completeUploadIntent(input: {
    byteSize: number;
    checksumSha256?: string;
    contentType: string;
    data?: Uint8Array;
    intentId: string;
    token: string;
  }): Promise<StorageUploadResult> {
    const client = await getClient();
    const timestampIso = now().toISOString();
    const rows = await client.execute<IntentRow>(
      `
        UPDATE storage_upload_intents
        SET status = 'processing',
            updated_at = $4
        WHERE file_id = $1
          AND token_hash = $2
          AND status = 'pending'
          AND expires_at > $3
          AND EXISTS (
            SELECT 1
            FROM storage_files
            WHERE storage_files.id = storage_upload_intents.file_id
              AND storage_files.status = 'pending'
          )
        RETURNING *
      `,
      [input.intentId, sha256Hex(input.token), timestampIso, timestampIso],
    );
    const intent = rows[0];

    if (!intent) {
      throw new StorageError(
        "Upload intent is invalid or expired.",
        "invalid_upload_intent",
      );
    }

    const variants: StorageFileVariant[] = [];
    let uploadedObjectWritten = false;

    try {
      const file = await loadFile(client, intent.file_id);

      assertStorageCondition(file, "File was not found.", "file_not_found");
      assertStorageCondition(
        file.status === "pending",
        "Upload intent has already been completed.",
        "upload_already_completed",
      );
      assertStorageCondition(
        input.contentType.toLowerCase() === intent.content_type,
        "Uploaded object content type does not match the intent.",
        "content_type_mismatch",
      );
      assertStorageCondition(
        input.byteSize === toNumber(intent.byte_size),
        "Uploaded object size does not match the intent.",
        "size_mismatch",
      );

      const expectedChecksum =
        input.checksumSha256 ?? intent.checksum_sha256 ?? undefined;

      if (input.checksumSha256 && intent.checksum_sha256) {
        assertStorageCondition(
          input.checksumSha256.toLowerCase() ===
            intent.checksum_sha256.toLowerCase(),
          "Uploaded object checksum does not match the intent.",
          "checksum_mismatch",
        );
      }

      const normalized = validateStorageObject({
        byteSize: input.byteSize,
        checksumSha256: expectedChecksum,
        contentType: input.contentType,
        data: input.data,
        fileName: file.fileName,
        rules: validation,
      });

      if (!input.data) {
        const objectMetadata = await adapter.headObject({
          key: intent.object_key,
        });

        assertStorageCondition(
          objectMetadata.byteSize === input.byteSize,
          "Uploaded object size does not match the intent.",
          "size_mismatch",
        );

        if (objectMetadata.checksumSha256 && expectedChecksum) {
          assertStorageCondition(
            objectMetadata.checksumSha256.toLowerCase() ===
              expectedChecksum.toLowerCase(),
            "Uploaded object checksum does not match the intent.",
            "checksum_mismatch",
          );
        }
      }

      const data =
        input.data ?? (await adapter.getObject({ key: intent.object_key }));
      const checksumSha256 = sha256Hex(data);

      assertStorageCondition(
        data.byteLength === input.byteSize,
        "Uploaded object size does not match the intent.",
        "size_mismatch",
      );

      if (expectedChecksum) {
        assertStorageCondition(
          checksumSha256.toLowerCase() === expectedChecksum.toLowerCase(),
          "Uploaded object checksum does not match the intent.",
          "checksum_mismatch",
        );
      }

      await scanFile({
        byteSize: data.byteLength,
        contentType: normalized.contentType,
        data,
        fileName: file.fileName,
        tenantId: intent.tenant_id,
      });

      const metadata = await buildMetadata({
        contentType: normalized.contentType,
        data,
        fileName: file.fileName,
      });
      variants.push(
        ...(await createManagedVariants({
          contentType: normalized.contentType,
          createdAt: timestampIso,
          data,
          fileId: intent.file_id,
          fileName: file.fileName,
          objectKey: intent.object_key,
        })),
      );
      const byteDelta =
        data.byteLength +
        variants.reduce((total, variant) => total + variant.byteSize, 0) -
        toNumber(intent.byte_size);

      if (input.data) {
        await adapter.putObject({
          body: input.data,
          checksumSha256,
          contentType: normalized.contentType,
          key: intent.object_key,
          metadata: {
            fileId: intent.file_id,
            tenantId: intent.tenant_id,
          },
        });
        uploadedObjectWritten = true;
      }

      await withTransaction(client, async (transaction) => {
        const fileRows = await transaction.execute<{ id: string }>(
          `
            UPDATE storage_files
            SET status = 'available',
                byte_size = $2,
                checksum_sha256 = $3,
                content_type = $4,
                image_metadata = $5::jsonb,
                document_metadata = $6::jsonb,
                uploaded_at = $7,
                updated_at = $7
            WHERE id = $1
              AND status = 'pending'
            RETURNING id
          `,
          [
            intent.file_id,
            data.byteLength,
            checksumSha256,
            normalized.contentType,
            metadata.imageMetadata
              ? JSON.stringify(metadata.imageMetadata)
              : null,
            metadata.documentMetadata
              ? JSON.stringify(metadata.documentMetadata)
              : null,
            timestampIso,
          ],
        );

        if (!fileRows[0]) {
          throw new StorageError(
            "Upload intent has already been completed.",
            "upload_already_completed",
          );
        }

        await reserveQuota(transaction, {
          byteDelta,
          tenantId: intent.tenant_id,
        });
        await transaction.execute(
          `
            UPDATE storage_upload_intents
            SET status = 'completed',
                completed_at = $2,
                updated_at = $2
            WHERE file_id = $1
              AND status = 'processing'
          `,
          [intent.file_id, timestampIso],
        );
        await persistVariants(transaction, variants);
        await transaction.execute(
          `
            INSERT INTO storage_usage_records (
              id,
              tenant_id,
              file_id,
              byte_delta,
              reason,
              metadata,
              created_at
            )
            VALUES ($1, $2, $3, $4, 'upload_intent_completed', $5::jsonb, $6)
          `,
          [
            randomUUID(),
            intent.tenant_id,
            intent.file_id,
            byteDelta,
            JSON.stringify({
              reservedBytes: toNumber(intent.byte_size),
              variantCount: variants.length,
            }),
            timestampIso,
          ],
        );
        await audit(transaction, {
          actorId: intent.owner_id ?? undefined,
          eventType: "storage.upload_intent.completed",
          fileId: intent.file_id,
          payload: { byteDelta, variantCount: variants.length },
          tenantId: intent.tenant_id,
        });
      });
    } catch (error) {
      const permanentFailure =
        error instanceof StorageError &&
        [
          "checksum_mismatch",
          "content_type_mismatch",
          "file_too_large",
          "malware_detected",
          "mime_not_allowed",
          "size_mismatch",
        ].includes(error.code);

      await Promise.allSettled([
        ...(uploadedObjectWritten || (permanentFailure && !input.data)
          ? [adapter.deleteObject({ key: intent.object_key })]
          : []),
        ...variants.map((variant) =>
          adapter.deleteObject({ key: variant.objectKey }),
        ),
      ]);

      if (permanentFailure) {
        await withTransaction(client, async (transaction) => {
          const fileRows = await transaction.execute<{ id: string }>(
            `
              UPDATE storage_files
              SET status = 'abandoned',
                  updated_at = $2
              WHERE id = $1
                AND status = 'pending'
              RETURNING id
            `,
            [intent.file_id, timestampIso],
          );

          if (fileRows[0]) {
            await reserveQuota(transaction, {
              byteDelta: -toNumber(intent.byte_size),
              tenantId: intent.tenant_id,
            });
            await transaction.execute(
              `
                INSERT INTO storage_usage_records (
                  id,
                  tenant_id,
                  file_id,
                  byte_delta,
                  reason,
                  metadata,
                  created_at
                )
                VALUES ($1, $2, $3, $4, 'upload_intent_released', $5::jsonb, $6)
              `,
              [
                randomUUID(),
                intent.tenant_id,
                intent.file_id,
                -toNumber(intent.byte_size),
                JSON.stringify({ reason: error.code }),
                timestampIso,
              ],
            );
          }

          await transaction.execute(
            `
              UPDATE storage_upload_intents
              SET status = 'expired',
                  updated_at = $2
              WHERE file_id = $1
                AND status = 'processing'
            `,
            [intent.file_id, timestampIso],
          );
        });
      } else {
        await client.execute(
          `
            UPDATE storage_upload_intents
            SET status = 'pending',
                updated_at = $2
            WHERE file_id = $1
              AND status = 'processing'
              AND expires_at > $2
          `,
          [intent.file_id, now().toISOString()],
        );
      }

      throw error;
    }

    return {
      file: (await loadFile(client, intent.file_id))!,
      variants,
    };
  }

  async function getFile(input: {
    fileId: string;
    principal: StoragePrincipal;
    signedUrlTtlSeconds?: number;
  }) {
    const client = await getClient();
    const file = await loadFile(client, input.fileId);

    assertStorageCondition(file, "File was not found.", "file_not_found");
    assertStorageCondition(
      canReadFile(file, input.principal) ||
        (await hasActiveGrant(client, {
          file,
          permission: "read",
          principal: input.principal,
        })),
      "File access is not allowed.",
      "forbidden",
    );

    await audit(client, {
      actorId: input.principal.actorId,
      eventType: "storage.file.read",
      fileId: file.id,
      tenantId: file.tenantId,
    });

    return {
      download: await adapter.signedDownloadUrl({
        expiresAt: addSeconds(now(), input.signedUrlTtlSeconds ?? 15 * 60),
        fileName: file.fileName,
        key: file.objectKey,
      }),
      file,
      variants: await loadVariants(client, file.id),
    };
  }

  async function listFiles(input: {
    limit?: number;
    ownerId?: string;
    principal: StoragePrincipal;
    status?: StorageFileStatus;
  }) {
    const client = await getClient();
    const actorId = input.principal.actorId ?? null;
    const roles = JSON.stringify(input.principal.roles ?? []);
    const status = input.status ?? "available";
    const timestampIso = now().toISOString();
    const rows = await client.execute<FileRow>(
      `
        SELECT *
        FROM storage_files
        WHERE tenant_id = $1
          AND ($2::text IS NULL OR owner_id = $2)
          AND status = $3
          AND $3 = 'available'
          AND (
            $4::boolean
            OR visibility = 'public'
            OR COALESCE((access_policy->>'publicRead')::boolean, false)
            OR ($5::text IS NOT NULL AND owner_id = $5)
            OR (
              $5::text IS NOT NULL
              AND COALESCE(access_policy->'allowedUserIds', '[]'::jsonb) ? $5
            )
            OR EXISTS (
              SELECT 1
              FROM storage_access_grants
              WHERE storage_access_grants.file_id = storage_files.id
                AND storage_access_grants.tenant_id = storage_files.tenant_id
                AND (storage_access_grants.permission = 'read' OR storage_access_grants.permission = 'owner')
                AND (
                  storage_access_grants.expires_at IS NULL
                  OR storage_access_grants.expires_at > $6
                )
                AND (
                  (
                    $5::text IS NOT NULL
                    AND storage_access_grants.grantee_type = 'user'
                    AND storage_access_grants.grantee_id = $5
                  )
                  OR (
                    storage_access_grants.grantee_type = 'role'
                    AND storage_access_grants.grantee_id IN (
                      SELECT jsonb_array_elements_text($7::jsonb)
                    )
                  )
                )
            )
          )
        ORDER BY created_at DESC
        LIMIT $8
      `,
      [
        input.principal.tenantId,
        input.ownerId ?? null,
        status,
        hasPermission(input.principal, "read"),
        actorId,
        timestampIso,
        roles,
        Math.min(Math.max(input.limit ?? 50, 1), 100),
      ],
    );

    return rows.map(toFile);
  }

  async function grantFileAccess(input: {
    createdBy?: string;
    expiresAt?: string;
    fileId: string;
    granteeId: string;
    granteeType: "role" | "user";
    permission: StoragePermission;
    principal: StoragePrincipal;
  }) {
    const client = await getClient();
    const file = await loadFile(client, input.fileId);

    assertStorageCondition(file, "File was not found.", "file_not_found");
    assertStorageCondition(
      canWriteFile(file, input.principal) ||
        (await hasActiveGrant(client, {
          file,
          permission: "write",
          principal: input.principal,
        })),
      "File access cannot be changed by this principal.",
      "forbidden",
    );

    await client.execute(
      `
        INSERT INTO storage_access_grants (
          id,
          file_id,
          tenant_id,
          grantee_type,
          grantee_id,
          permission,
          expires_at,
          created_at,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        randomUUID(),
        file.id,
        file.tenantId,
        input.granteeType,
        input.granteeId,
        input.permission,
        input.expiresAt ?? null,
        now().toISOString(),
        input.createdBy ?? input.principal.actorId ?? null,
      ],
    );
    await audit(client, {
      actorId: input.principal.actorId,
      eventType: "storage.file.grant.created",
      fileId: file.id,
      payload: {
        granteeId: input.granteeId,
        granteeType: input.granteeType,
        permission: input.permission,
      },
      tenantId: file.tenantId,
    });
  }

  async function deleteFile(input: {
    fileId: string;
    principal: StoragePrincipal;
  }) {
    const client = await getClient();
    const file = await loadFile(client, input.fileId);

    assertStorageCondition(file, "File was not found.", "file_not_found");
    assertStorageCondition(
      canWriteFile(file, input.principal) ||
        (await hasActiveGrant(client, {
          file,
          permission: "write",
          principal: input.principal,
        })),
      "File deletion is not allowed.",
      "forbidden",
    );
    assertStorageCondition(
      file.status === "available",
      "Only available files can be deleted.",
      "file_not_available",
    );

    const variants = await loadVariants(client, file.id);
    const byteDelta = -(
      file.byteSize +
      variants.reduce((total, variant) => total + variant.byteSize, 0)
    );
    const timestamp = now().toISOString();

    await withTransaction(client, async (transaction) => {
      const rows = await transaction.execute<{ id: string }>(
        `
          UPDATE storage_files
          SET status = 'deleted',
              deleted_at = $2,
              updated_at = $2
          WHERE id = $1
            AND status = 'available'
          RETURNING id
        `,
        [file.id, timestamp],
      );

      if (!rows[0]) {
        throw new StorageError(
          "Only available files can be deleted.",
          "file_not_available",
        );
      }

      await reserveQuota(transaction, { byteDelta, tenantId: file.tenantId });
      await transaction.execute(
        `
          INSERT INTO storage_usage_records (
            id,
            tenant_id,
            file_id,
            byte_delta,
            reason,
            metadata,
            created_at
          )
          VALUES ($1, $2, $3, $4, 'delete', '{}'::jsonb, $5)
        `,
        [randomUUID(), file.tenantId, file.id, byteDelta, timestamp],
      );
      await audit(transaction, {
        actorId: input.principal.actorId,
        eventType: "storage.file.deleted",
        fileId: file.id,
        payload: { byteDelta },
        tenantId: file.tenantId,
      });
    });

    await Promise.allSettled([
      adapter.deleteObject({ key: file.objectKey }),
      ...variants.map((variant) =>
        adapter.deleteObject({ key: variant.objectKey }),
      ),
    ]);
  }

  async function cleanupExpiredUploadIntents() {
    const client = await getClient();
    const timestamp = now().toISOString();
    const rows = await client.execute<{
      byte_size: number | string;
      file_id: string;
      object_key: string;
      tenant_id: string;
    }>(
      `
        SELECT byte_size, file_id, object_key, tenant_id
        FROM storage_upload_intents
        WHERE status IN ('pending', 'processing')
          AND expires_at <= $1
      `,
      [timestamp],
    );
    let cleaned = 0;

    for (const row of rows) {
      const deleteResults = await Promise.allSettled([
        adapter.deleteObject({ key: row.object_key }),
      ]);

      if (deleteResults.some((result) => result.status === "rejected")) {
        continue;
      }

      await withTransaction(client, async (transaction) => {
        await transaction.execute(
          `
            UPDATE storage_upload_intents
            SET status = 'expired',
                updated_at = $2
            WHERE file_id = $1
              AND status IN ('pending', 'processing')
          `,
          [row.file_id, timestamp],
        );
        const fileRows = await transaction.execute<{ id: string }>(
          `
            UPDATE storage_files
            SET status = 'abandoned',
                updated_at = $2
            WHERE id = $1
              AND status = 'pending'
            RETURNING id
          `,
          [row.file_id, timestamp],
        );

        if (fileRows[0]) {
          const byteDelta = -toNumber(row.byte_size);

          await reserveQuota(transaction, {
            byteDelta,
            tenantId: row.tenant_id,
          });
          await transaction.execute(
            `
              INSERT INTO storage_usage_records (
                id,
                tenant_id,
                file_id,
                byte_delta,
                reason,
                metadata,
                created_at
              )
              VALUES ($1, $2, $3, $4, 'upload_intent_expired', '{}'::jsonb, $5)
            `,
            [randomUUID(), row.tenant_id, row.file_id, byteDelta, timestamp],
          );
        }
      });
      cleaned += 1;
    }

    return cleaned;
  }

  async function cleanupOrphanedFiles(input: { olderThan: string }) {
    const client = await getClient();
    const timestamp = now().toISOString();
    const rows = await client.execute<{
      byte_size: number | string;
      id: string;
      object_key: string;
      tenant_id: string;
    }>(
      `
        SELECT byte_size, id, object_key, tenant_id
        FROM storage_files
        WHERE status = 'pending'
          AND created_at < $1
          AND NOT EXISTS (
            SELECT 1
            FROM storage_upload_intents
            WHERE storage_upload_intents.file_id = storage_files.id
              AND storage_upload_intents.status IN ('pending', 'processing')
          )
      `,
      [input.olderThan],
    );
    let cleaned = 0;

    for (const row of rows) {
      const deleteResults = await Promise.allSettled([
        adapter.deleteObject({ key: row.object_key }),
      ]);

      if (deleteResults.some((result) => result.status === "rejected")) {
        continue;
      }

      await withTransaction(client, async (transaction) => {
        const fileRows = await transaction.execute<{ id: string }>(
          `
            UPDATE storage_files
            SET status = 'abandoned',
                updated_at = $2
            WHERE id = $1
              AND status = 'pending'
            RETURNING id
          `,
          [row.id, timestamp],
        );

        if (fileRows[0]) {
          const byteDelta = -toNumber(row.byte_size);

          await reserveQuota(transaction, {
            byteDelta,
            tenantId: row.tenant_id,
          });
          await transaction.execute(
            `
              INSERT INTO storage_usage_records (
                id,
                tenant_id,
                file_id,
                byte_delta,
                reason,
                metadata,
                created_at
              )
              VALUES ($1, $2, $3, $4, 'orphaned_file_released', '{}'::jsonb, $5)
            `,
            [randomUUID(), row.tenant_id, row.id, byteDelta, timestamp],
          );
        }
      });
      cleaned += 1;
    }

    return cleaned;
  }

  async function cleanupDeletedFiles(input: { olderThan: string }) {
    const client = await getClient();
    const rows = await client.execute<{ id: string; object_key: string }>(
      `
        SELECT id, object_key
        FROM storage_files
        WHERE status = 'deleted'
          AND deleted_at < $1
      `,
      [input.olderThan],
    );
    let cleaned = 0;

    for (const row of rows) {
      const variants = await loadVariants(client, row.id);
      const deleteResults = await Promise.allSettled([
        adapter.deleteObject({ key: row.object_key }),
        ...variants.map((variant) =>
          adapter.deleteObject({ key: variant.objectKey }),
        ),
      ]);

      if (deleteResults.some((result) => result.status === "rejected")) {
        continue;
      }

      await client.execute(
        `
          DELETE FROM storage_files
          WHERE id = $1
            AND status = 'deleted'
        `,
        [row.id],
      );
      cleaned += 1;
    }

    return cleaned;
  }

  async function getUsage(input: { tenantId: string }) {
    const client = await getClient();
    const quotaRows = await client.execute<{
      storage_bytes_limit: number | string;
      storage_bytes_used: number | string;
    }>(
      `
        SELECT storage_bytes_limit, storage_bytes_used
        FROM organization_quotas
        WHERE organization_id = $1
      `,
      [input.tenantId],
    );
    const fileRows = await client.execute<{ count: number | string }>(
      `
        SELECT count(*)::text AS count
        FROM storage_files
        WHERE tenant_id = $1
          AND status = 'available'
      `,
      [input.tenantId],
    );
    const quota = quotaRows[0];

    return {
      fileCount: toNumber(fileRows[0]?.count),
      storageBytesLimit: toNumber(quota?.storage_bytes_limit),
      storageBytesUsed: toNumber(quota?.storage_bytes_used),
    };
  }

  return {
    cleanupDeletedFiles,
    cleanupExpiredUploadIntents,
    cleanupOrphanedFiles,
    completeUploadIntent,
    createUploadIntent,
    deleteFile,
    getFile,
    getUsage,
    grantFileAccess,
    listFiles,
    uploadFile,
  };
}
