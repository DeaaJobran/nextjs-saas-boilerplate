import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  createStorageRuntimeConfiguration,
  resolveStorageLocalRoot,
} from "./config";
import { StorageError } from "./errors";

describe("storage runtime configuration", () => {
  it("configures local storage with signed application routes", () => {
    const runtime = createStorageRuntimeConfiguration({
      AUTH_SECRET: "a-secure-development-secret-with-enough-entropy",
      NEXT_PUBLIC_APP_URL: "https://app.example.test",
      STORAGE_LOCAL_ROOT: "C:/storage-test",
      STORAGE_PROVIDER_KIND: "local",
    });

    expect(runtime.adapter.kind).toBe("local");
    expect(runtime.provider).toMatchObject({
      id: "local",
      kind: "local",
      publicBaseUrl: "https://app.example.test",
    });
    expect(runtime.localSigningSecret).toBe(
      "a-secure-development-secret-with-enough-entropy",
    );
  });

  it.each(["s3", "wasabi", "minio", "r2"] as const)(
    "configures the %s provider adapter",
    (kind) => {
      const runtime = createStorageRuntimeConfiguration({
        R2_ACCOUNT_ID: kind === "r2" ? "account-id" : undefined,
        S3_ACCESS_KEY_ID: "access-key",
        S3_BUCKET: "tenant-files",
        S3_ENDPOINT:
          kind === "minio" ? "https://minio.example.test" : undefined,
        S3_REGION: "eu-west-1",
        S3_SECRET_ACCESS_KEY: "secret-key",
        STORAGE_PROVIDER_KIND: kind,
      });

      expect(runtime.adapter.kind).toBe(kind);
      expect(runtime.provider).toMatchObject({
        bucket: "tenant-files",
        id: kind,
        kind,
      });
    },
  );

  it("rejects incomplete remote-provider configuration", () => {
    expect(() =>
      createStorageRuntimeConfiguration({
        STORAGE_PROVIDER_KIND: "s3",
      }),
    ).toThrowError(StorageError);
  });

  it("requires a signing secret for local production storage", () => {
    expect(() =>
      createStorageRuntimeConfiguration({
        NODE_ENV: "production",
        STORAGE_PROVIDER_KIND: "local",
      }),
    ).toThrowError(/STORAGE_SIGNING_SECRET/);
  });

  it("resolves relative local roots from the shared workspace root", () => {
    const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));
    const expected = path.join(workspaceRoot, ".local", "storage");

    expect(
      resolveStorageLocalRoot({}, path.join(workspaceRoot, "apps", "web")),
    ).toBe(expected);
    expect(
      resolveStorageLocalRoot(
        { STORAGE_LOCAL_ROOT: ".local/storage" },
        path.join(workspaceRoot, "packages", "jobs"),
      ),
    ).toBe(expected);
  });

  it("requires an absolute local root outside a pnpm workspace", () => {
    expect(() =>
      resolveStorageLocalRoot(
        { STORAGE_LOCAL_ROOT: ".local/storage" },
        path.join(os.tmpdir(), "standalone-storage-service"),
      ),
    ).toThrowError(/must be absolute/);
  });

  it.each([
    ["minio", {}],
    ["r2", {}],
  ] as const)(
    "rejects %s without a provider endpoint",
    (kind, providerEnvironment) => {
      expect(() =>
        createStorageRuntimeConfiguration({
          S3_ACCESS_KEY_ID: "access-key",
          S3_BUCKET: "tenant-files",
          S3_SECRET_ACCESS_KEY: "secret-key",
          STORAGE_PROVIDER_KIND: kind,
          ...providerEnvironment,
        }),
      ).toThrowError(/S3_ENDPOINT|R2_ACCOUNT_ID/);
    },
  );
});
