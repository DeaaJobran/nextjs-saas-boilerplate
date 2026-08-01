import {
  createStorageRuntimeConfiguration,
  createStorageService,
  verifyLocalStorageSignature,
} from "@nextjs-saas/storage";

export function createWebStorageAdapter() {
  return createStorageRuntimeConfiguration().adapter;
}

export function getStorageService() {
  const runtime = createStorageRuntimeConfiguration();

  return createStorageService({
    adapter: runtime.adapter,
    provider: runtime.provider,
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
  const runtime = createStorageRuntimeConfiguration();
  const url = new URL(input.request.url);
  const providerId = url.searchParams.get("provider") ?? runtime.adapter.id;

  if (
    runtime.adapter.kind !== "local" ||
    !runtime.localSigningSecret ||
    providerId !== runtime.adapter.id
  ) {
    return false;
  }

  return verifyLocalStorageSignature({
    action: input.action,
    expires: url.searchParams.get("expires"),
    key: input.key,
    providerId,
    secret: runtime.localSigningSecret,
    signature: url.searchParams.get("signature"),
  });
}
