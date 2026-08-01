import {
  assertTrustedOrigin,
  getAllowedOrigins,
  getClientAddress,
  SecurityError,
} from "@nextjs-saas/security";
import { headers } from "next/headers";

import { getSecurityService } from "./security";

export async function protectServerAction(input: {
  identifier: string;
  limit: number;
  scope: string;
  windowSeconds: number;
}) {
  const headerStore = await headers();
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  assertTrustedOrigin({
    allowedOrigins: getAllowedOrigins({
      appBaseUrl,
      configuredOrigins: process.env.SERVER_ACTION_ALLOWED_ORIGINS,
    }),
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    origin: headerStore.get("origin"),
    protocol:
      headerStore.get("x-forwarded-proto") ??
      new URL(appBaseUrl).protocol.replace(/:$/u, ""),
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

export function securityErrorResponse(error: unknown) {
  if (!(error instanceof SecurityError)) {
    return undefined;
  }

  return Response.json(
    { error: { code: error.code, message: error.message } },
    {
      headers: { "cache-control": "no-store" },
      status: error.status,
    },
  );
}
