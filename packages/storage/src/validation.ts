import { createHash } from "node:crypto";

import { StorageError } from "./errors";
import { normalizeExtension } from "./path";
import type { StorageValidationRules } from "./types";

export const defaultStorageValidationRules: StorageValidationRules = {
  allowedExtensions: [
    "avif",
    "csv",
    "gif",
    "jpeg",
    "jpg",
    "json",
    "pdf",
    "png",
    "txt",
    "webp",
  ],
  allowedMimeTypes: [
    "application/json",
    "application/pdf",
    "image/avif",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/csv",
    "text/plain",
  ],
  maxBytes: 250 * 1024 * 1024,
};

export function sha256Hex(data: Uint8Array | string) {
  return createHash("sha256").update(data).digest("hex");
}

export function validateStorageObject(input: {
  byteSize: number;
  checksumSha256?: string;
  contentType: string;
  data?: Uint8Array;
  fileName: string;
  rules?: Partial<StorageValidationRules>;
}) {
  const rules = {
    ...defaultStorageValidationRules,
    ...input.rules,
  };
  const extension = normalizeExtension(input.fileName);
  const contentType = input.contentType.toLowerCase();

  if (!Number.isInteger(input.byteSize) || input.byteSize < 1) {
    throw new StorageError(
      "File size must be a positive integer.",
      "file_size",
    );
  }

  if (input.byteSize > rules.maxBytes) {
    throw new StorageError(
      "File exceeds the configured size limit.",
      "file_too_large",
    );
  }

  if (!rules.allowedExtensions.includes(extension)) {
    throw new StorageError(
      "File extension is not allowed.",
      "extension_not_allowed",
    );
  }

  if (!rules.allowedMimeTypes.includes(contentType)) {
    throw new StorageError("MIME type is not allowed.", "mime_not_allowed");
  }

  if (input.data && input.data.byteLength !== input.byteSize) {
    throw new StorageError(
      "Declared size does not match file bytes.",
      "size_mismatch",
    );
  }

  if (input.checksumSha256 && !/^[a-f0-9]{64}$/i.test(input.checksumSha256)) {
    throw new StorageError(
      "Checksum must be a SHA-256 hex digest.",
      "invalid_checksum",
    );
  }

  if (input.data && input.checksumSha256) {
    const actual = sha256Hex(input.data);

    if (actual.toLowerCase() !== input.checksumSha256.toLowerCase()) {
      throw new StorageError(
        "Checksum does not match file bytes.",
        "checksum_mismatch",
      );
    }
  }

  return {
    contentType,
    extension,
  };
}
