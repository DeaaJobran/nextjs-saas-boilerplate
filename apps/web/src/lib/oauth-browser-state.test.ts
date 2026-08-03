import { describe, expect, it } from "vitest";

import {
  createOAuthBrowserId,
  isOAuthBrowserId,
  matchesOAuthStateFingerprint,
  oauthStateCookieName,
  oauthStateCookieOptions,
  oauthStateFingerprint,
} from "./oauth-browser-state";

describe("OAuth browser state", () => {
  it("matches only the initiating state fingerprint", () => {
    const secret = "oauth-browser-test-secret-with-32-characters";
    const fingerprint = oauthStateFingerprint("oauth-state", secret);

    expect(
      matchesOAuthStateFingerprint(fingerprint, "oauth-state", secret),
    ).toBe(true);
    expect(
      matchesOAuthStateFingerprint(fingerprint, "oauth-state", `${secret}!`),
    ).toBe(false);
    expect(
      matchesOAuthStateFingerprint(fingerprint, "other-state", secret),
    ).toBe(false);
    expect(matchesOAuthStateFingerprint("invalid", "oauth-state", secret)).toBe(
      false,
    );
  });

  it("uses constrained browser identifiers and callback-only cookies", () => {
    const browserId = createOAuthBrowserId();
    const secret = "oauth-browser-test-secret-with-32-characters";

    expect(isOAuthBrowserId(browserId)).toBe(true);
    expect(isOAuthBrowserId("attacker-controlled")).toBe(false);
    expect(oauthStateCookieName("example", "first-state", secret)).toMatch(
      /^nextjs_saas_oauth_state_example_[0-9a-f]{20}$/u,
    );
    expect(oauthStateCookieName("example", "first-state", secret)).not.toBe(
      oauthStateCookieName("example", "second-state", secret),
    );
    expect(() =>
      oauthStateCookieName("invalid/provider", "first-state", secret),
    ).toThrow("provider identifier is invalid");
    expect(oauthStateCookieOptions("ar", "example")).toMatchObject({
      httpOnly: true,
      path: "/ar/auth/oauth/example/callback",
      sameSite: "lax",
    });
  });
});
