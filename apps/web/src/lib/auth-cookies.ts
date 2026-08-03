import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { AuthError, authSecurityPolicy } from "@nextjs-saas/auth";

const transientRefreshBackoffSeconds = 5;

export const sessionCookieName = "nextjs_saas_session";
export const refreshCookieName = "nextjs_saas_refresh";
export const refreshCoordinatorCookieName = "nextjs_saas_refresh_coordinator";
export const refreshSuppressionCookieName = "nextjs_saas_refresh_suppressed";
export const adminSessionCookieName = "nextjs_saas_admin_session";

function baseAuthCookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function sessionCookieOptions() {
  return {
    ...baseAuthCookieOptions(),
    maxAge: authSecurityPolicy.sessionTtlSeconds,
  };
}

export function refreshCookieOptions() {
  return {
    ...baseAuthCookieOptions(),
    maxAge: authSecurityPolicy.refreshTokenTtlSeconds,
  };
}

export function createRefreshCoordinator() {
  return randomBytes(32).toString("base64url");
}

export function isRefreshCoordinator(value?: string): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{43}$/u.test(value));
}

export function refreshCoordinatorCookieOptions() {
  return refreshCookieOptions();
}

export function refreshSuppressionFingerprint(refreshToken: string) {
  return createHash("sha256").update(refreshToken).digest("hex");
}

export function refreshSuppressionMatches(
  fingerprint: string | undefined,
  refreshToken: string,
) {
  if (!fingerprint || !/^[0-9a-f]{64}$/u.test(fingerprint)) {
    return false;
  }

  const expected = Buffer.from(fingerprint, "hex");
  const actual = Buffer.from(
    refreshSuppressionFingerprint(refreshToken),
    "hex",
  );

  return timingSafeEqual(expected, actual);
}

export function refreshSuppressionTtlSeconds(error: unknown) {
  return error instanceof AuthError && error.code === "invalid_refresh_token"
    ? authSecurityPolicy.refreshTokenTtlSeconds
    : transientRefreshBackoffSeconds;
}

export function refreshSuppressionCookieOptions(
  maxAge = authSecurityPolicy.refreshTokenTtlSeconds,
) {
  return {
    ...baseAuthCookieOptions(),
    maxAge,
  };
}
