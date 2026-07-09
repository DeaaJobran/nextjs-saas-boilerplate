import { createHash, createHmac } from "node:crypto";

import type {
  StorageAdapter,
  StorageAdapterPutInput,
  StorageProviderKind,
  StorageSignedUrl,
} from "../types";

type S3CompatibleAdapterOptions = {
  accessKeyId: string;
  bucket: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  id?: string;
  kind?: StorageProviderKind;
  publicBaseUrl?: string;
  region: string;
  secretAccessKey: string;
  sessionToken?: string;
};

function hmac(key: Uint8Array | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function base64FromHex(value: string) {
  return Buffer.from(value, "hex").toString("base64");
}

function hexFromBase64(value: string | null) {
  if (!value) {
    return undefined;
  }

  try {
    return Buffer.from(value, "base64").toString("hex") || undefined;
  } catch {
    return undefined;
  }
}

function encodePath(value: string) {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function amzTimestamp(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function amzDate(date: Date) {
  return amzTimestamp(date).slice(0, 8);
}

function signingKey(secret: string, date: string, region: string) {
  const dateKey = hmac(`AWS4${secret}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");

  return hmac(serviceKey, "aws4_request");
}

function canonicalQuery(params: URLSearchParams) {
  return [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

function objectUrl(options: S3CompatibleAdapterOptions, key: string) {
  const endpoint =
    options.endpoint ?? `https://s3.${options.region}.amazonaws.com`;
  const base = new URL(endpoint);
  const encodedKey = encodePath(key);

  if (options.forcePathStyle ?? false) {
    return new URL(`/${options.bucket}/${encodedKey}`, base);
  }

  base.hostname = `${options.bucket}.${base.hostname}`;
  base.pathname = `/${encodedKey}`;

  return base;
}

function presign(input: {
  expiresAt: Date;
  fileName?: string;
  headers?: Record<string, string>;
  key: string;
  method: "DELETE" | "GET" | "HEAD" | "PUT";
  now: Date;
  options: S3CompatibleAdapterOptions;
}) {
  const url = objectUrl(input.options, input.key);
  const canonicalHeaders = new Map<string, string>([["host", url.host]]);
  const date = amzDate(input.now);
  const timestamp = amzTimestamp(input.now);
  const expiresIn = Math.max(
    1,
    Math.floor((input.expiresAt.getTime() - input.now.getTime()) / 1000),
  );
  const credentialScope = `${date}/${input.options.region}/s3/aws4_request`;

  url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  url.searchParams.set(
    "X-Amz-Credential",
    `${input.options.accessKeyId}/${credentialScope}`,
  );
  url.searchParams.set("X-Amz-Date", timestamp);
  url.searchParams.set("X-Amz-Expires", expiresIn.toString());

  if (input.options.sessionToken) {
    url.searchParams.set("X-Amz-Security-Token", input.options.sessionToken);
  }

  for (const [key, value] of Object.entries(input.headers ?? {})) {
    canonicalHeaders.set(key.toLowerCase(), value.trim().replace(/\s+/g, " "));
  }

  const sortedHeaders = [...canonicalHeaders.entries()].sort(
    ([left], [right]) => left.localeCompare(right),
  );
  const signedHeaders = sortedHeaders.map(([key]) => key).join(";");
  const canonicalHeaderString = sortedHeaders
    .map(([key, value]) => `${key}:${value}\n`)
    .join("");

  url.searchParams.set("X-Amz-SignedHeaders", signedHeaders);

  if (input.fileName && input.method === "GET") {
    url.searchParams.set(
      "response-content-disposition",
      `attachment; filename="${input.fileName.replaceAll('"', "")}"`,
    );
  }

  const canonicalRequest = [
    input.method,
    url.pathname,
    canonicalQuery(url.searchParams),
    canonicalHeaderString,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const signature = createHmac(
    "sha256",
    signingKey(input.options.secretAccessKey, date, input.options.region),
  )
    .update(stringToSign)
    .digest("hex");

  url.searchParams.set("X-Amz-Signature", signature);

  return url;
}

export function createS3CompatibleStorageAdapter(
  options: S3CompatibleAdapterOptions,
): StorageAdapter {
  const providerId = options.id ?? options.kind ?? "s3";

  async function signedUrl(input: {
    expiresAt: Date;
    fileName?: string;
    headers?: Record<string, string>;
    key: string;
    method: "DELETE" | "GET" | "HEAD" | "PUT";
  }): Promise<StorageSignedUrl> {
    const url = presign({
      ...input,
      now: new Date(),
      options,
    });

    return {
      expiresAt: input.expiresAt.toISOString(),
      headers: input.headers ?? {},
      method: input.method,
      url: url.toString(),
    };
  }

  return {
    id: providerId,
    kind: options.kind ?? "s3",
    async deleteObject(input) {
      const signed = await signedUrl({
        expiresAt: new Date(Date.now() + 60_000),
        key: input.key,
        method: "DELETE",
      });

      const response = await fetch(signed.url, { method: "DELETE" });

      if (!response.ok && response.status !== 404) {
        throw new Error(`S3 delete failed with status ${response.status}.`);
      }
    },
    async exists(input) {
      const signed = await signedUrl({
        expiresAt: new Date(Date.now() + 60_000),
        key: input.key,
        method: "HEAD",
      });
      const response = await fetch(signed.url, { method: "HEAD" });

      return response.ok;
    },
    async getObject(input) {
      const signed = await signedUrl({
        expiresAt: new Date(Date.now() + 60_000),
        key: input.key,
        method: "GET",
      });
      const response = await fetch(signed.url);

      if (!response.ok) {
        throw new Error(`S3 read failed with status ${response.status}.`);
      }

      return new Uint8Array(await response.arrayBuffer());
    },
    async headObject(input) {
      const signed = await signedUrl({
        expiresAt: new Date(Date.now() + 60_000),
        key: input.key,
        method: "HEAD",
      });
      const response = await fetch(signed.url, { method: "HEAD" });

      if (!response.ok) {
        throw new Error(
          `S3 metadata read failed with status ${response.status}.`,
        );
      }

      const byteSize = Number(response.headers.get("content-length"));

      if (!Number.isFinite(byteSize)) {
        throw new Error("S3 metadata response did not include a valid size.");
      }

      return {
        byteSize,
        checksumSha256: hexFromBase64(
          response.headers.get("x-amz-checksum-sha256"),
        ),
        contentType: response.headers.get("content-type") ?? undefined,
      };
    },
    async putObject(input: StorageAdapterPutInput) {
      const signed = await this.signedUploadUrl({
        checksumSha256: input.checksumSha256,
        contentType: input.contentType,
        expiresAt: new Date(Date.now() + 60_000),
        key: input.key,
      });
      const response = await fetch(signed.url, {
        body: Buffer.from(input.body),
        headers: signed.headers,
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error(`S3 upload failed with status ${response.status}.`);
      }
    },
    async signedDownloadUrl(input) {
      return signedUrl({ ...input, method: "GET" });
    },
    async signedUploadUrl(input) {
      const headers = {
        "content-type": input.contentType,
        ...(input.checksumSha256
          ? { "x-amz-checksum-sha256": base64FromHex(input.checksumSha256) }
          : {}),
      };
      const signed = await signedUrl({ ...input, headers, method: "PUT" });

      return {
        ...signed,
        headers,
      };
    },
  };
}

export function createWasabiStorageAdapter(
  options: Omit<S3CompatibleAdapterOptions, "endpoint" | "kind"> & {
    endpoint?: string;
  },
) {
  return createS3CompatibleStorageAdapter({
    ...options,
    endpoint: options.endpoint ?? `https://s3.${options.region}.wasabisys.com`,
    forcePathStyle: options.forcePathStyle ?? false,
    kind: "wasabi",
  });
}

export function createMinioStorageAdapter(options: S3CompatibleAdapterOptions) {
  return createS3CompatibleStorageAdapter({
    ...options,
    forcePathStyle: options.forcePathStyle ?? true,
    kind: "minio",
  });
}

export function createCloudflareR2StorageAdapter(
  options: Omit<S3CompatibleAdapterOptions, "kind" | "region"> & {
    accountId?: string;
    region?: string;
  },
) {
  return createS3CompatibleStorageAdapter({
    ...options,
    endpoint:
      options.endpoint ??
      (options.accountId
        ? `https://${options.accountId}.r2.cloudflarestorage.com`
        : undefined),
    forcePathStyle: options.forcePathStyle ?? true,
    kind: "r2",
    region: options.region ?? "auto",
  });
}
