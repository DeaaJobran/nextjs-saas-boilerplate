import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const passwordParams = {
  N: 32_768,
  keyLength: 64,
  maxmem: 128 * 1024 * 1024,
  p: 1,
  r: 8,
} as const;

export function randomToken(prefix = "nst") {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = scryptSync(password, salt, passwordParams.keyLength, {
    N: passwordParams.N,
    maxmem: passwordParams.maxmem,
    p: passwordParams.p,
    r: passwordParams.r,
  }).toString("base64url");

  return `scrypt$N=${passwordParams.N},r=${passwordParams.r},p=${passwordParams.p}$${salt}$${derivedKey}`;
}

export function verifyPassword(password: string, hash: string | null) {
  if (!hash) {
    return false;
  }

  const [algorithm, params, salt, encodedKey] = hash.split("$");

  if (
    algorithm !== "scrypt" ||
    params !==
      `N=${passwordParams.N},r=${passwordParams.r},p=${passwordParams.p}` ||
    !salt ||
    !encodedKey
  ) {
    return false;
  }

  try {
    const expectedKey = Buffer.from(encodedKey, "base64url");
    const actualKey = scryptSync(password, salt, expectedKey.length, {
      N: passwordParams.N,
      maxmem: passwordParams.maxmem,
      p: passwordParams.p,
      r: passwordParams.r,
    });

    return (
      actualKey.length === expectedKey.length &&
      timingSafeEqual(actualKey, expectedKey)
    );
  } catch {
    return false;
  }
}

function createEncryptionKey(secret: string) {
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createEncryptionKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "aes-256-gcm",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join("$");
}

export function decryptSecret(value: string, secret: string) {
  const [algorithm, encodedIv, encodedTag, encodedCiphertext] =
    value.split("$");

  if (
    algorithm !== "aes-256-gcm" ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext
  ) {
    throw new Error("Invalid encrypted secret format.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    createEncryptionKey(secret),
    Buffer.from(encodedIv, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function bytesToBase64Url(value: Uint8Array) {
  return Buffer.from(value).toString("base64url");
}

export function base64UrlToBytes(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

export function sha256Base64Url(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}
