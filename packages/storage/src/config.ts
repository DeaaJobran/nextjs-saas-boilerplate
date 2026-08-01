import { existsSync } from "node:fs";
import path from "node:path";

import { createLocalStorageAdapter } from "./adapters/local";
import {
  createCloudflareR2StorageAdapter,
  createMinioStorageAdapter,
  createS3CompatibleStorageAdapter,
  createWasabiStorageAdapter,
  type S3CompatibleAdapterOptions,
} from "./adapters/s3-compatible";
import { StorageError } from "./errors";
import type {
  StorageAdapter,
  StorageProviderConfiguration,
  StorageProviderKind,
} from "./types";
import { defaultStorageValidationRules } from "./validation";

export type StorageRuntimeConfiguration = {
  adapter: StorageAdapter;
  localSigningSecret?: string;
  provider: Partial<StorageProviderConfiguration>;
};

function optionalBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === "") {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new StorageError(
    `Expected a boolean environment value, received: ${value}`,
    "invalid_provider_configuration",
  );
}

function required(source: Record<string, string | undefined>, key: string) {
  const value = source[key]?.trim();

  if (!value) {
    throw new StorageError(
      `${key} is required for the selected storage provider.`,
      "invalid_provider_configuration",
    );
  }

  return value;
}

function providerKind(value: string | undefined): StorageProviderKind {
  const kind = value?.trim().toLowerCase() || "local";

  if (["local", "s3", "wasabi", "minio", "r2"].includes(kind)) {
    return kind as StorageProviderKind;
  }

  throw new StorageError(
    `Unsupported storage provider: ${kind}`,
    "invalid_provider_configuration",
  );
}

function findWorkspaceRoot(startDirectory: string) {
  let current = path.resolve(startDirectory);

  while (true) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

export function resolveStorageLocalRoot(
  source: Record<string, string | undefined>,
  startDirectory = process.cwd(),
) {
  const configuredRoot = source.STORAGE_LOCAL_ROOT?.trim() || ".local/storage";

  if (path.isAbsolute(configuredRoot)) {
    return path.normalize(configuredRoot);
  }

  const workspaceRoot = findWorkspaceRoot(startDirectory);

  if (!workspaceRoot) {
    throw new StorageError(
      "STORAGE_LOCAL_ROOT must be absolute when storage runs outside a pnpm workspace.",
      "invalid_provider_configuration",
    );
  }

  return path.resolve(workspaceRoot, configuredRoot);
}

function createS3Options(
  source: Record<string, string | undefined>,
  kind: Exclude<StorageProviderKind, "local">,
): S3CompatibleAdapterOptions {
  const configuredEndpoint = source.S3_ENDPOINT?.trim() || undefined;
  const r2AccountId = source.R2_ACCOUNT_ID?.trim() || undefined;

  if (kind === "minio" && !configuredEndpoint) {
    throw new StorageError(
      "S3_ENDPOINT is required for the MinIO storage provider.",
      "invalid_provider_configuration",
    );
  }

  if (kind === "r2" && !configuredEndpoint && !r2AccountId) {
    throw new StorageError(
      "S3_ENDPOINT or R2_ACCOUNT_ID is required for the R2 storage provider.",
      "invalid_provider_configuration",
    );
  }

  return {
    accessKeyId: required(source, "S3_ACCESS_KEY_ID"),
    bucket: required(source, "S3_BUCKET"),
    endpoint:
      configuredEndpoint ||
      (r2AccountId
        ? `https://${r2AccountId}.r2.cloudflarestorage.com`
        : undefined),
    forcePathStyle: optionalBoolean(
      source.S3_FORCE_PATH_STYLE,
      kind === "minio" || kind === "r2",
    ),
    id: source.STORAGE_PROVIDER_ID?.trim() || kind,
    kind,
    publicBaseUrl: source.STORAGE_PUBLIC_BASE_URL?.trim() || undefined,
    region: source.S3_REGION?.trim() || (kind === "r2" ? "auto" : "us-east-1"),
    secretAccessKey: required(source, "S3_SECRET_ACCESS_KEY"),
    sessionToken: source.S3_SESSION_TOKEN?.trim() || undefined,
  };
}

export function createStorageRuntimeConfiguration(
  source: Record<string, string | undefined> = process.env,
): StorageRuntimeConfiguration {
  const kind = providerKind(source.STORAGE_PROVIDER_KIND);
  const providerId = source.STORAGE_PROVIDER_ID?.trim() || kind;
  const publicBaseUrl =
    source.STORAGE_PUBLIC_BASE_URL?.trim() ||
    source.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";

  if (kind === "local") {
    const signingSecret =
      source.STORAGE_SIGNING_SECRET?.trim() || source.AUTH_SECRET?.trim();

    if (!signingSecret && source.NODE_ENV === "production") {
      throw new StorageError(
        "STORAGE_SIGNING_SECRET or AUTH_SECRET is required for local storage in production.",
        "invalid_provider_configuration",
      );
    }

    const localSigningSecret =
      signingSecret || "local-storage-development-secret";

    return {
      adapter: createLocalStorageAdapter({
        id: providerId,
        publicBaseUrl,
        rootDir: resolveStorageLocalRoot(source),
        signingSecret: localSigningSecret,
      }),
      localSigningSecret,
      provider: {
        bucket: providerId,
        displayName: source.STORAGE_PROVIDER_NAME?.trim() || "Local storage",
        id: providerId,
        kind,
        publicBaseUrl,
      },
    };
  }

  const options = createS3Options(source, kind);
  const adapter =
    kind === "wasabi"
      ? createWasabiStorageAdapter(options)
      : kind === "minio"
        ? createMinioStorageAdapter(options)
        : kind === "r2"
          ? createCloudflareR2StorageAdapter({
              ...options,
              accountId: source.R2_ACCOUNT_ID?.trim() || undefined,
            })
          : createS3CompatibleStorageAdapter(options);

  return {
    adapter,
    provider: {
      allowedExtensions: defaultStorageValidationRules.allowedExtensions,
      allowedMimeTypes: defaultStorageValidationRules.allowedMimeTypes,
      bucket: options.bucket,
      displayName:
        source.STORAGE_PROVIDER_NAME?.trim() || `${kind.toUpperCase()} storage`,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle ?? false,
      id: providerId,
      kind,
      publicBaseUrl: options.publicBaseUrl,
      region: options.region,
    },
  };
}
