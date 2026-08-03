import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { authSecurityPolicy } from "@nextjs-saas/auth";

export const oauthBrowserCookieName = "nextjs_saas_oauth_browser";

function secureCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function oauthBrowserCookieOptions() {
  return {
    ...secureCookieOptions(),
    maxAge: 365 * 24 * 60 * 60,
    path: "/",
  };
}

export function createOAuthBrowserId() {
  return randomUUID();
}

export function isOAuthBrowserId(value?: string) {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    ),
  );
}

function oauthStateSigningSecret(secret = process.env.AUTH_SECRET) {
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 characters.");
  }

  return secret;
}

export function oauthStateFingerprint(state: string, secret?: string) {
  return createHmac("sha256", oauthStateSigningSecret(secret))
    .update("oauth-browser-state\0")
    .update(state)
    .digest("hex");
}

export function oauthStateCookieName(
  provider: string,
  state: string,
  secret?: string,
) {
  const providerKey = createHash("sha256")
    .update(provider)
    .digest("hex")
    .slice(0, 12);
  const attemptKey = oauthStateFingerprint(state, secret).slice(0, 20);

  return `nextjs_saas_oauth_state_${providerKey}_${attemptKey}`;
}

export function oauthStateCookieOptions(locale: string, provider: string) {
  return {
    ...secureCookieOptions(),
    maxAge: authSecurityPolicy.tokenTtlSeconds.socialCallback,
    path: `/${locale}/auth/oauth/${provider}/callback`,
  };
}

export function matchesOAuthStateFingerprint(
  fingerprint: string | undefined,
  state: string,
  secret?: string,
) {
  if (!fingerprint || !/^[0-9a-f]{64}$/iu.test(fingerprint)) {
    return false;
  }

  const expected = Buffer.from(fingerprint, "hex");
  const actual = Buffer.from(oauthStateFingerprint(state, secret), "hex");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
