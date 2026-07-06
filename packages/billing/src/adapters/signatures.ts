import { createHmac, timingSafeEqual } from "node:crypto";

function parseSignatureHeader(signatureHeader: string) {
  const pairs = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = pairs
    .find((part) => part.startsWith("t="))
    ?.slice(2)
    .trim();
  const signatures = pairs
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3).trim())
    .filter(Boolean);

  return { signatures, timestamp };
}

export function signWebhookPayload(input: {
  payload: string;
  secret: string;
  timestamp?: number;
}) {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", input.secret)
    .update(`${timestamp}.${input.payload}`)
    .digest("hex");

  return `t=${timestamp},v1=${digest}`;
}

export function verifyWebhookSignature(input: {
  payload: string;
  secret: string;
  signatureHeader?: string;
  toleranceSeconds?: number;
}) {
  if (!input.signatureHeader) {
    throw new Error("Webhook signature header is required.");
  }

  const { signatures, timestamp } = parseSignatureHeader(input.signatureHeader);

  if (!timestamp || signatures.length === 0) {
    throw new Error("Webhook signature header is malformed.");
  }

  const timestampSeconds = Number(timestamp);

  if (!Number.isFinite(timestampSeconds)) {
    throw new Error("Webhook signature timestamp is invalid.");
  }

  const toleranceSeconds = input.toleranceSeconds ?? 5 * 60;
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) {
    throw new Error("Webhook signature timestamp is outside tolerance.");
  }

  const expected = createHmac("sha256", input.secret)
    .update(`${timestamp}.${input.payload}`)
    .digest();

  for (const signature of signatures) {
    const actual = Buffer.from(signature, "hex");

    if (
      actual.length === expected.length &&
      timingSafeEqual(actual, expected)
    ) {
      return;
    }
  }

  throw new Error("Webhook signature verification failed.");
}
