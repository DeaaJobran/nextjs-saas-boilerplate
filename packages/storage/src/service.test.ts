import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  getDatabaseRuntime,
  type Queryable,
  resetDatabaseRuntimeForTests,
  runMigrations,
} from "@nextjs-saas/db";
import { createTenantService } from "@nextjs-saas/tenant";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createLocalStorageAdapter } from "./adapters/local";
import {
  createCloudflareR2StorageAdapter,
  createMinioStorageAdapter,
  createS3CompatibleStorageAdapter,
  createWasabiStorageAdapter,
} from "./adapters/s3-compatible";
import { createStorageService } from "./service";

let dataDir: string;
let localRoot: string;
let databaseRuntimeOpened = false;
const fixedNow = new Date("2026-07-06T10:00:00.000Z");

async function createUser(
  client: Queryable,
  input: {
    displayName: string;
    email: string;
    id: string;
  },
) {
  const timestamp = fixedNow.toISOString();

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
      VALUES ($1, $2, $3, $4, false, 'user', $5, $5)
    `,
    [
      input.id,
      input.email,
      input.email.toLowerCase(),
      input.displayName,
      timestamp,
    ],
  );
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "nextjs-saas-storage-db-"));
  localRoot = await mkdtemp(path.join(os.tmpdir(), "nextjs-saas-storage-"));
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATA_DIR = dataDir;
  databaseRuntimeOpened = false;
  resetDatabaseRuntimeForTests();
});

afterEach(async () => {
  if (databaseRuntimeOpened) {
    await (await getDatabaseRuntime()).close();
  }

  resetDatabaseRuntimeForTests();
  delete process.env.PGLITE_DATA_DIR;
  await rm(dataDir, { force: true, recursive: true });
  await rm(localRoot, { force: true, recursive: true });
});

async function createStorageScenario() {
  databaseRuntimeOpened = true;

  const runtime = await getDatabaseRuntime();

  await runMigrations(runtime);
  await createUser(runtime, {
    displayName: "Storage Owner",
    email: "storage-owner@example.test",
    id: "storage_owner",
  });
  await createUser(runtime, {
    displayName: "Storage Member",
    email: "storage-member@example.test",
    id: "storage_member",
  });

  const tenant = createTenantService({ client: runtime, now: () => fixedNow });
  const organization = await tenant.createOrganization({
    actorId: "storage_owner",
    name: "Storage Labs",
  });
  const adapter = createLocalStorageAdapter({
    rootDir: localRoot,
    signingSecret: "test-local-storage-secret",
  });
  const storage = createStorageService({
    adapter,
    client: runtime,
    now: () => fixedNow,
    uploadTtlSeconds: 60,
  });

  return { adapter, organization, runtime, storage };
}

async function createPng() {
  return new Uint8Array(
    await sharp({
      create: {
        background: { alpha: 1, b: 30, g: 20, r: 10 },
        channels: 4,
        height: 3,
        width: 4,
      },
    })
      .png()
      .toBuffer(),
  );
}

describe("storage service", () => {
  it("uploads images with tenant paths, metadata, variants, quota usage, and tenant-isolated reads", async () => {
    const { adapter, organization, storage } = await createStorageScenario();
    const png = await createPng();
    const uploaded = await storage.uploadFile({
      contentType: "image/png",
      data: png,
      fileName: "avatar.png",
      ownerId: "storage_owner",
      tenantId: organization.id,
      visibility: "private",
    });

    expect(uploaded.file.objectKey).toContain(`tenants/${organization.id}`);
    expect(uploaded.file.objectKey).toContain("users/storage_owner");
    expect(uploaded.file.imageMetadata).toMatchObject({
      height: 3,
      width: 4,
    });
    expect(uploaded.variants.map((variant) => variant.kind).sort()).toEqual([
      "optimized",
      "thumbnail",
    ]);
    await expect(
      adapter.exists({ key: uploaded.file.objectKey }),
    ).resolves.toBe(true);

    const usage = await storage.getUsage({ tenantId: organization.id });

    expect(usage.fileCount).toBe(1);
    expect(usage.storageBytesUsed).toBeGreaterThan(png.byteLength);

    await expect(
      storage.getFile({
        fileId: uploaded.file.id,
        principal: {
          actorId: "storage_owner",
          permissions: ["read"],
          tenantId: "other_tenant",
        },
      }),
    ).rejects.toMatchObject({ code: "forbidden" });

    const read = await storage.getFile({
      fileId: uploaded.file.id,
      principal: {
        actorId: "storage_owner",
        tenantId: organization.id,
      },
    });

    expect(read.download.method).toBe("GET");

    await expect(
      storage.getFile({
        fileId: uploaded.file.id,
        principal: {
          actorId: "storage_member",
          tenantId: organization.id,
        },
      }),
    ).rejects.toMatchObject({ code: "forbidden" });

    await storage.grantFileAccess({
      fileId: uploaded.file.id,
      granteeId: "storage_member",
      granteeType: "user",
      permission: "read",
      principal: {
        actorId: "storage_owner",
        tenantId: organization.id,
      },
    });

    await expect(
      storage.getFile({
        fileId: uploaded.file.id,
        principal: {
          actorId: "storage_member",
          tenantId: organization.id,
        },
      }),
    ).resolves.toMatchObject({ file: { id: uploaded.file.id } });

    await storage.deleteFile({
      fileId: uploaded.file.id,
      principal: {
        actorId: "storage_owner",
        tenantId: organization.id,
      },
    });

    await expect(
      storage.getUsage({ tenantId: organization.id }),
    ).resolves.toMatchObject({ fileCount: 0, storageBytesUsed: 0 });
  }, 60_000);

  it("completes signed upload intents and generates document previews", async () => {
    const { adapter, organization, storage } = await createStorageScenario();
    const body = new TextEncoder().encode("alpha beta\ngamma delta\n");
    const intent = await storage.createUploadIntent({
      byteSize: body.byteLength,
      checksumSha256: undefined,
      contentType: "text/plain",
      fileName: "notes.txt",
      ownerId: "storage_owner",
      tenantId: organization.id,
    });

    expect(intent.signedUpload.method).toBe("PUT");
    await adapter.putObject({
      body,
      contentType: "text/plain",
      key: intent.file.objectKey,
    });

    const completed = await storage.completeUploadIntent({
      byteSize: body.byteLength,
      contentType: "text/plain",
      intentId: intent.file.id,
      token: intent.token,
    });

    expect(completed.file.status).toBe("available");
    expect(completed.file.documentMetadata).toMatchObject({
      kind: "text",
      lineCount: 3,
      wordCount: 4,
    });
    expect(completed.variants).toEqual([
      expect.objectContaining({ kind: "document-preview" }),
    ]);
  }, 60_000);

  it("enforces validation, malware scanning, quotas, and expired-intent cleanup", async () => {
    const { organization, runtime, storage } = await createStorageScenario();

    await expect(
      storage.uploadFile({
        contentType: "application/octet-stream",
        data: new TextEncoder().encode("bad"),
        fileName: "bad.exe",
        ownerId: "storage_owner",
        tenantId: organization.id,
      }),
    ).rejects.toMatchObject({ code: "extension_not_allowed" });

    const rejectingStorage = createStorageService({
      adapter: createLocalStorageAdapter({ rootDir: localRoot }),
      client: runtime,
      now: () => fixedNow,
      virusScanner: async () => ({
        clean: false,
        reason: "test scanner rejection",
      }),
    });

    await expect(
      rejectingStorage.uploadFile({
        contentType: "text/plain",
        data: new TextEncoder().encode("blocked"),
        fileName: "blocked.txt",
        ownerId: "storage_owner",
        tenantId: organization.id,
      }),
    ).rejects.toMatchObject({ code: "malware_detected" });

    await runtime.execute(
      `
        UPDATE organization_quotas
        SET storage_bytes_limit = 4,
            storage_bytes_used = 0
        WHERE organization_id = $1
      `,
      [organization.id],
    );

    await expect(
      storage.uploadFile({
        contentType: "text/plain",
        data: new TextEncoder().encode("too large"),
        fileName: "too-large.txt",
        ownerId: "storage_owner",
        tenantId: organization.id,
      }),
    ).rejects.toMatchObject({ code: "storage_quota_exceeded" });

    await runtime.execute(
      `
        UPDATE organization_quotas
        SET storage_bytes_limit = 1048576,
            storage_bytes_used = 0
        WHERE organization_id = $1
      `,
      [organization.id],
    );

    const expired = await storage.createUploadIntent({
      byteSize: 5,
      contentType: "text/plain",
      expiresAt: new Date(fixedNow.getTime() - 1000).toISOString(),
      fileName: "expired.txt",
      ownerId: "storage_owner",
      tenantId: organization.id,
    });

    expect(expired.status).toBe("pending");
    await expect(storage.cleanupExpiredUploadIntents()).resolves.toBe(1);
  }, 60_000);

  it("generates signed URLs for S3-compatible providers", async () => {
    const adapters = [
      createS3CompatibleStorageAdapter({
        accessKeyId: "access",
        bucket: "app-bucket",
        endpoint: "https://s3.example.test",
        region: "us-east-1",
        secretAccessKey: "secret",
      }),
      createWasabiStorageAdapter({
        accessKeyId: "access",
        bucket: "wasabi-bucket",
        region: "eu-central-1",
        secretAccessKey: "secret",
      }),
      createMinioStorageAdapter({
        accessKeyId: "access",
        bucket: "minio-bucket",
        endpoint: "https://minio.example.test",
        region: "local",
        secretAccessKey: "secret",
      }),
      createCloudflareR2StorageAdapter({
        accessKeyId: "access",
        accountId: "account",
        bucket: "r2-bucket",
        secretAccessKey: "secret",
      }),
    ];

    for (const adapter of adapters) {
      const signed = await adapter.signedUploadUrl({
        contentType: "text/plain",
        expiresAt: new Date(fixedNow.getTime() + 60_000),
        key: "tenants/test/users/user/file.txt",
      });
      const url = new URL(signed.url);

      expect(signed.method).toBe("PUT");
      expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
      expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
