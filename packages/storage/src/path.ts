import path from "node:path";

import { StorageError } from "./errors";

function sanitizeSegment(segment: string) {
  return segment
    .trim()
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean)
    .join("-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
}

export function normalizeExtension(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  return extension.startsWith(".") ? extension.slice(1) : extension;
}

export function buildTenantObjectKey(input: {
  fileId: string;
  fileName: string;
  ownerId?: string;
  tenantId: string;
}) {
  const extension = normalizeExtension(input.fileName);
  const ownerSegment = input.ownerId
    ? `users/${sanitizeSegment(input.ownerId)}`
    : "system";
  const fileSegment = sanitizeSegment(input.fileName) || input.fileId;
  const suffix =
    extension && !fileSegment.endsWith(`.${extension}`) ? `.${extension}` : "";

  return [
    "tenants",
    sanitizeSegment(input.tenantId),
    ownerSegment,
    input.fileId,
    `${fileSegment}${suffix}`,
  ].join("/");
}

export function assertSafeObjectKey(key: string) {
  if (
    key.startsWith("/") ||
    key.includes("..") ||
    key.includes("\\") ||
    key.split("/").some((segment) => segment.length === 0 || segment === ".")
  ) {
    throw new StorageError("Storage object key is unsafe.", "unsafe_key");
  }
}

export function variantObjectKey(input: {
  extension: string;
  fileId: string;
  kind: string;
  originalKey: string;
}) {
  const base = input.originalKey.split("/").slice(0, -1).join("/");
  const cleanKind = sanitizeSegment(input.kind) || "variant";

  return `${base}/${input.fileId}-${cleanKind}.${input.extension}`;
}
