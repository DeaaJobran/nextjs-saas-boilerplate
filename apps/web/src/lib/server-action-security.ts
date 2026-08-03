import { AuthError } from "@nextjs-saas/auth";
import {
  assertTrustedOrigin,
  getAllowedOrigins,
  getClientAddress,
  SecurityError,
} from "@nextjs-saas/security";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { headers } from "next/headers";

import { getSecurityService } from "./security";

function getAppProtocol(appBaseUrl: string) {
  try {
    return new URL(appBaseUrl).protocol.replace(/:$/u, "");
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be a valid absolute URL.");
  }
}

export async function protectServerAction(input: {
  identifier: string;
  limit: number;
  scope: string;
  windowSeconds: number;
}) {
  const headerStore = await headers();
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const appProtocol = getAppProtocol(appBaseUrl);
  assertTrustedOrigin({
    allowedOrigins: getAllowedOrigins({
      appBaseUrl,
      configuredOrigins: process.env.SERVER_ACTION_ALLOWED_ORIGINS,
    }),
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    origin: headerStore.get("origin"),
    protocol: headerStore.get("x-forwarded-proto") ?? appProtocol,
    requireOrigin: process.env.NODE_ENV === "production",
  });
  const ipAddress = getClientAddress(
    headerStore,
    Number(process.env.TRUSTED_PROXY_COUNT ?? 0),
  );
  const security = getSecurityService();
  const normalizedIdentifier = input.identifier.trim().toLowerCase();
  const identityResult = await security.consumeRateLimit({
    identifier: normalizedIdentifier || `anonymous:${input.scope}`,
    limit: input.limit,
    scope: `server-action:${input.scope}:identity`,
    windowSeconds: input.windowSeconds,
  });
  const ipResult = ipAddress
    ? await security.consumeRateLimit({
        identifier: ipAddress,
        limit: input.limit,
        scope: `server-action:${input.scope}:ip`,
        windowSeconds: input.windowSeconds,
      })
    : undefined;

  if (!identityResult.allowed || ipResult?.allowed === false) {
    throw new SecurityError("Rate limit exceeded.", "rate_limited", 429);
  }

  const userAgent = headerStore.get("user-agent") ?? undefined;

  return { ipAddress, userAgent };
}

type JsonParser<T> = (input: unknown) => T;

function invalidRequest(message: string): never {
  throw new SecurityError(message, "invalid_request", 400);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function base64UrlField(value: unknown, field: string) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    invalidRequest(`${field} must be a non-empty base64url string.`);
  }

  return value;
}

function optionalPasskeyLabel(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    invalidRequest("Passkey label must be a string.");
  }

  const label = value.trim();

  if (!label || label.length > 160) {
    invalidRequest("Passkey label must contain between 1 and 160 characters.");
  }

  return label;
}

function optionalEmail(value: unknown) {
  if (value === undefined || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    invalidRequest("Email must be a string.");
  }

  const email = value.trim().toLowerCase();

  if (
    !email ||
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
  ) {
    invalidRequest("Email must be a valid email address.");
  }

  return email;
}

function passkeyCredential(
  input: unknown,
): Record<string, unknown> & { response: Record<string, unknown> } {
  if (!isRecord(input)) {
    invalidRequest("Passkey response must be a JSON object.");
  }

  base64UrlField(input.id, "Passkey id");
  base64UrlField(input.rawId, "Passkey rawId");

  if (input.type !== "public-key") {
    invalidRequest('Passkey type must be "public-key".');
  }

  if (!isRecord(input.clientExtensionResults)) {
    invalidRequest("Passkey clientExtensionResults must be a JSON object.");
  }

  if (!isRecord(input.response)) {
    invalidRequest("Passkey authenticator response must be a JSON object.");
  }

  if (
    input.authenticatorAttachment !== undefined &&
    input.authenticatorAttachment !== "platform" &&
    input.authenticatorAttachment !== "cross-platform"
  ) {
    invalidRequest("Passkey authenticatorAttachment is invalid.");
  }

  return input as Record<string, unknown> & {
    response: Record<string, unknown>;
  };
}

export function parsePasskeyRegistrationOptionsRequest(input: unknown) {
  if (!isRecord(input)) {
    invalidRequest("Request body must be a JSON object.");
  }

  return { label: optionalPasskeyLabel(input.label) };
}

export function parsePasskeyAuthenticationOptionsRequest(input: unknown): {
  email?: string;
} {
  if (!isRecord(input)) {
    invalidRequest("Request body must be a JSON object.");
  }

  return { email: optionalEmail(input.email) };
}

export function parsePasskeyRegistrationVerificationRequest(input: unknown): {
  label?: string;
  response: RegistrationResponseJSON;
} {
  if (!isRecord(input)) {
    invalidRequest("Request body must be a JSON object.");
  }

  const credential = passkeyCredential(input.response);

  base64UrlField(
    credential.response.attestationObject,
    "Passkey attestationObject",
  );
  base64UrlField(credential.response.clientDataJSON, "Passkey clientDataJSON");

  for (const field of ["authenticatorData", "publicKey"] as const) {
    if (credential.response[field] !== undefined) {
      base64UrlField(credential.response[field], `Passkey ${field}`);
    }
  }

  if (
    credential.response.publicKeyAlgorithm !== undefined &&
    !Number.isInteger(credential.response.publicKeyAlgorithm)
  ) {
    invalidRequest("Passkey publicKeyAlgorithm must be an integer.");
  }

  if (
    credential.response.transports !== undefined &&
    (!Array.isArray(credential.response.transports) ||
      credential.response.transports.some(
        (transport) =>
          typeof transport !== "string" ||
          ![
            "ble",
            "cable",
            "hybrid",
            "internal",
            "nfc",
            "smart-card",
            "usb",
          ].includes(transport),
      ))
  ) {
    invalidRequest("Passkey transports are invalid.");
  }

  return {
    label: optionalPasskeyLabel(input.label),
    response: credential as unknown as RegistrationResponseJSON,
  };
}

export function parsePasskeyAuthenticationVerificationRequest(input: unknown): {
  response: AuthenticationResponseJSON;
} {
  if (!isRecord(input)) {
    invalidRequest("Request body must be a JSON object.");
  }

  const credential = passkeyCredential(input.response);

  base64UrlField(
    credential.response.authenticatorData,
    "Passkey authenticatorData",
  );
  base64UrlField(credential.response.clientDataJSON, "Passkey clientDataJSON");
  base64UrlField(credential.response.signature, "Passkey signature");

  if (credential.response.userHandle !== undefined) {
    base64UrlField(credential.response.userHandle, "Passkey userHandle");
  }

  return {
    response: credential as unknown as AuthenticationResponseJSON,
  };
}

export async function parseJsonRequest<T>(
  request: Request,
  parser: JsonParser<T>,
): Promise<T> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new SecurityError(
      "Request body must contain valid JSON.",
      "invalid_request",
      400,
    );
  }

  return parser(body);
}

export function securityErrorResponse(error: unknown) {
  if (!(error instanceof SecurityError) && !(error instanceof AuthError)) {
    return undefined;
  }

  return Response.json(
    { error: { code: error.code, message: error.message } },
    {
      headers: { "cache-control": "no-store" },
      status: error instanceof SecurityError ? error.status : 400,
    },
  );
}
