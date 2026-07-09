import path from "node:path";

import {
  createLocalStorageAdapter,
  createStorageService,
  verifyLocalStorageSignature,
} from "@nextjs-saas/storage";

function getStorageProviderId() {
  return process.env.STORAGE_PROVIDER_ID ?? "local";
}

function getStorageBaseUrl() {
  return (
    process.env.STORAGE_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
}

function getStorageRoot() {
  return (
    process.env.STORAGE_LOCAL_ROOT ??
    path.join(process.cwd(), ".local", "storage")
  );
}

function getStorageSigningSecret() {
  const secret = process.env.STORAGE_SIGNING_SECRET ?? process.env.AUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "STORAGE_SIGNING_SECRET or AUTH_SECRET must be configured.",
    );
  }

  return "local-storage-development-secret";
}

export function createWebStorageAdapter() {
  return createLocalStorageAdapter({
    id: getStorageProviderId(),
    publicBaseUrl: getStorageBaseUrl(),
    rootDir: getStorageRoot(),
    signingSecret: getStorageSigningSecret(),
  });
}

export function getStorageService() {
  return createStorageService({
    adapter: createWebStorageAdapter(),
    provider: {
      publicBaseUrl: getStorageBaseUrl(),
    },
  });
}

export function getStorageRouteKey(parts: string[]) {
  return parts.join("/");
}

export function isSignedStorageRequest(input: {
  action: "download" | "upload";
  key: string;
  request: Request;
}) {
  const url = new URL(input.request.url);
  const providerId = url.searchParams.get("provider") ?? getStorageProviderId();

  if (providerId !== getStorageProviderId()) {
    return false;
  }

  return verifyLocalStorageSignature({
    action: input.action,
    expires: url.searchParams.get("expires"),
    key: input.key,
    providerId,
    secret: getStorageSigningSecret(),
    signature: url.searchParams.get("signature"),
  });
}
