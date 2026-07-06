import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function createTotpSecret() {
  const bytes = randomBytes(20);
  let bits = "";
  let output = "";

  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, "0");
  }

  for (let index = 0; index + 5 <= bits.length; index += 5) {
    output += alphabet[Number.parseInt(bits.slice(index, index + 5), 2)];
  }

  return output;
}

function decodeBase32(value: string) {
  const normalized = value
    .replace(/=+$/u, "")
    .replace(/\s+/gu, "")
    .toUpperCase();
  let bits = "";

  for (const char of normalized) {
    const index = alphabet.indexOf(char);

    if (index === -1) {
      throw new Error("Invalid base32 value.");
    }

    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];

  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

export function createTotpCode(
  secret: string,
  options: { digits?: number; periodSeconds?: number; timestamp?: number } = {},
) {
  const digits = options.digits ?? 6;
  const periodSeconds = options.periodSeconds ?? 30;
  const counter = Math.floor(
    (options.timestamp ?? Date.now()) / 1000 / periodSeconds,
  );
  const counterBuffer = Buffer.alloc(8);

  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", decodeBase32(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  return (binary % 10 ** digits).toString().padStart(digits, "0");
}

export function verifyTotpCode(
  secret: string,
  code: string,
  options: {
    digits?: number;
    periodSeconds?: number;
    timestamp?: number;
    window?: number;
  } = {},
) {
  const digits = options.digits ?? 6;
  const normalizedCode = code.replace(/\s+/gu, "");

  if (!new RegExp(`^\\d{${digits}}$`, "u").test(normalizedCode)) {
    return false;
  }

  const periodSeconds = options.periodSeconds ?? 30;
  const timestamp = options.timestamp ?? Date.now();
  const window = options.window ?? 1;

  for (let offset = -window; offset <= window; offset += 1) {
    const expected = createTotpCode(secret, {
      digits,
      periodSeconds,
      timestamp: timestamp + offset * periodSeconds * 1000,
    });
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(normalizedCode);

    if (
      expectedBuffer.length === actualBuffer.length &&
      timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      return true;
    }
  }

  return false;
}

export function createTotpUri(input: {
  accountName: string;
  issuer: string;
  secret: string;
}) {
  const label = encodeURIComponent(`${input.issuer}:${input.accountName}`);
  const issuer = encodeURIComponent(input.issuer);

  return `otpauth://totp/${label}?secret=${input.secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}
