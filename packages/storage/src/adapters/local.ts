import { createHmac } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { StorageError } from "../errors";
import { assertSafeObjectKey } from "../path";
import type {
  StorageAdapter,
  StorageAdapterPutInput,
  StorageProviderKind,
} from "../types";

type LocalAdapterOptions = {
  id?: string;
  kind?: StorageProviderKind;
  publicBaseUrl?: string;
  rootDir: string;
  signingSecret?: string;
};

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createSignedLocalStorageUrl(input: {
  action: "download" | "upload";
  expiresAt: Date;
  key: string;
  providerId: string;
  publicBaseUrl?: string;
  secret: string;
}) {
  const expires = Math.floor(input.expiresAt.getTime() / 1000).toString();
  const payload = `${input.action}:${input.providerId}:${input.key}:${expires}`;
  const signature = sign(payload, input.secret);
  const encodedKey = input.key.split("/").map(encodeURIComponent).join("/");

  if (input.publicBaseUrl) {
    const url = new URL(
      `/storage/${input.action}/${encodedKey}`,
      input.publicBaseUrl,
    );

    url.searchParams.set("provider", input.providerId);
    url.searchParams.set("expires", expires);
    url.searchParams.set("signature", signature);

    return url.toString();
  }

  return `local-storage://${input.providerId}/${input.action}/${encodedKey}?expires=${expires}&signature=${signature}`;
}

export function verifyLocalStorageSignature(input: {
  action: "download" | "upload";
  expires: string | null;
  key: string;
  now?: Date;
  providerId: string;
  secret: string;
  signature: string | null;
}) {
  if (!input.expires || !input.signature) {
    return false;
  }

  const expiresAt = Number(input.expires);

  if (!Number.isFinite(expiresAt)) {
    return false;
  }

  if (expiresAt <= Math.floor((input.now ?? new Date()).getTime() / 1000)) {
    return false;
  }

  const payload = `${input.action}:${input.providerId}:${input.key}:${input.expires}`;

  return sign(payload, input.secret) === input.signature;
}

function resolveStoragePath(rootDir: string, key: string) {
  assertSafeObjectKey(key);

  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, key);

  if (resolved === root || !resolved.startsWith(`${root}${path.sep}`)) {
    throw new StorageError(
      "Storage object key escapes the local root.",
      "unsafe_key",
    );
  }

  return resolved;
}

export function createLocalStorageAdapter(
  options: LocalAdapterOptions,
): StorageAdapter {
  const providerId = options.id ?? "local";
  const signingSecret =
    options.signingSecret ?? "local-storage-development-secret";

  return {
    id: providerId,
    kind: options.kind ?? "local",
    async deleteObject(input) {
      await rm(resolveStoragePath(options.rootDir, input.key), {
        force: true,
      });
    },
    async exists(input) {
      try {
        await this.headObject(input);

        return true;
      } catch {
        return false;
      }
    },
    async getObject(input) {
      return readFile(resolveStoragePath(options.rootDir, input.key));
    },
    async headObject(input) {
      const stats = await stat(resolveStoragePath(options.rootDir, input.key));

      return { byteSize: stats.size };
    },
    async putObject(input: StorageAdapterPutInput) {
      const filePath = resolveStoragePath(options.rootDir, input.key);

      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, input.body);
    },
    async signedDownloadUrl(input) {
      return {
        expiresAt: input.expiresAt.toISOString(),
        headers: {},
        method: "GET",
        url: createSignedLocalStorageUrl({
          action: "download",
          expiresAt: input.expiresAt,
          key: input.key,
          providerId,
          publicBaseUrl: options.publicBaseUrl,
          secret: signingSecret,
        }),
      };
    },
    async signedUploadUrl(input) {
      return {
        expiresAt: input.expiresAt.toISOString(),
        headers: { "content-type": input.contentType },
        method: "PUT",
        url: createSignedLocalStorageUrl({
          action: "upload",
          expiresAt: input.expiresAt,
          key: input.key,
          providerId,
          publicBaseUrl: options.publicBaseUrl,
          secret: signingSecret,
        }),
      };
    },
  };
}
