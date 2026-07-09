import sharp from "sharp";

import { variantObjectKey } from "./path";
import type { StorageAdapter, StorageFileVariant } from "./types";
import { sha256Hex } from "./validation";

export type ImageMetadata = {
  format?: string;
  height?: number;
  sizeBytes: number;
  width?: number;
};

export type DocumentMetadata = {
  byteSize: number;
  kind: "csv" | "json" | "pdf" | "text" | "unknown";
  lineCount?: number;
  pageCount?: number;
  title?: string;
  wordCount?: number;
};

export async function extractImageMetadata(data: Uint8Array) {
  const metadata = await sharp(data).metadata();

  return {
    format: metadata.format,
    height: metadata.height,
    sizeBytes: data.byteLength,
    width: metadata.width,
  } satisfies ImageMetadata;
}

export function extractDocumentMetadata(input: {
  contentType: string;
  data: Uint8Array;
  fileName: string;
}) {
  const text = new TextDecoder().decode(input.data.slice(0, 1024 * 1024));
  const contentType = input.contentType.toLowerCase();
  const fileName = input.fileName.toLowerCase();
  const metadata: DocumentMetadata = {
    byteSize: input.data.byteLength,
    kind: "unknown",
  };

  if (contentType === "application/pdf" || fileName.endsWith(".pdf")) {
    metadata.kind = "pdf";
    metadata.pageCount = Math.max(
      1,
      text.match(/\/Type\s*\/Page\b/g)?.length ?? 1,
    );
    metadata.title = text.match(/\/Title\s*\(([^)]{1,200})\)/)?.[1];

    return metadata;
  }

  if (contentType === "application/json" || fileName.endsWith(".json")) {
    metadata.kind = "json";
  } else if (contentType === "text/csv" || fileName.endsWith(".csv")) {
    metadata.kind = "csv";
  } else if (contentType.startsWith("text/")) {
    metadata.kind = "text";
  }

  if (metadata.kind !== "unknown") {
    metadata.lineCount = text.length === 0 ? 0 : text.split(/\r?\n/).length;
    metadata.wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  }

  return metadata;
}

export async function createImageVariants(input: {
  adapter: StorageAdapter;
  contentType: string;
  createdAt: string;
  data: Uint8Array;
  fileId: string;
  originalKey: string;
}) {
  const variants: StorageFileVariant[] = [];
  const optimized = await sharp(input.data)
    .rotate()
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const thumbnail = await sharp(input.data)
    .rotate()
    .resize(320, 320, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 76 })
    .toBuffer({ resolveWithObject: true });

  try {
    for (const variant of [
      { buffer: optimized.data, info: optimized.info, kind: "optimized" },
      { buffer: thumbnail.data, info: thumbnail.info, kind: "thumbnail" },
    ]) {
      const key = variantObjectKey({
        extension: "webp",
        fileId: input.fileId,
        kind: variant.kind,
        originalKey: input.originalKey,
      });

      await input.adapter.putObject({
        body: variant.buffer,
        checksumSha256: sha256Hex(variant.buffer),
        contentType: "image/webp",
        key,
        metadata: {
          source: input.fileId,
          variant: variant.kind,
        },
      });

      variants.push({
        byteSize: variant.buffer.byteLength,
        contentType: "image/webp",
        createdAt: input.createdAt,
        fileId: input.fileId,
        height: variant.info.height,
        id: `${input.fileId}_${variant.kind}`,
        kind: variant.kind,
        metadata: { checksumSha256: sha256Hex(variant.buffer) },
        objectKey: key,
        width: variant.info.width,
      });
    }
  } catch (error) {
    await Promise.all(
      variants.map((variant) =>
        input.adapter.deleteObject({ key: variant.objectKey }),
      ),
    );

    throw error;
  }

  return variants;
}

export function createDocumentPreview(input: {
  contentType: string;
  data: Uint8Array;
  fileName: string;
  fileId: string;
}) {
  const metadata = extractDocumentMetadata(input);
  const preview = [
    `file: ${input.fileName}`,
    `kind: ${metadata.kind}`,
    `bytes: ${metadata.byteSize}`,
    metadata.pageCount ? `pages: ${metadata.pageCount}` : undefined,
    metadata.lineCount ? `lines: ${metadata.lineCount}` : undefined,
    metadata.wordCount ? `words: ${metadata.wordCount}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    body: new TextEncoder().encode(preview),
    contentType: "text/plain",
    metadata,
  };
}
