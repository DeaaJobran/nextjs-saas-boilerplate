import { AuthError, authSecurityPolicy } from "@nextjs-saas/auth";
import { describe, expect, it } from "vitest";

import {
  createRefreshCoordinator,
  isRefreshCoordinator,
  refreshCoordinatorCookieOptions,
  refreshSuppressionCookieOptions,
  refreshSuppressionFingerprint,
  refreshSuppressionMatches,
  refreshSuppressionTtlSeconds,
} from "./auth-cookies";

describe("refresh retry suppression", () => {
  it("creates constrained browser refresh coordinators", () => {
    const coordinator = createRefreshCoordinator();

    expect(isRefreshCoordinator(coordinator)).toBe(true);
    expect(isRefreshCoordinator("attacker-controlled")).toBe(false);
    expect(refreshCoordinatorCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
    });
  });

  it("suppresses only the refresh token that already failed rotation", () => {
    const fingerprint = refreshSuppressionFingerprint("failed-refresh-token");

    expect(refreshSuppressionMatches(fingerprint, "failed-refresh-token")).toBe(
      true,
    );
    expect(
      refreshSuppressionMatches(fingerprint, "rotated-refresh-token"),
    ).toBe(false);
    expect(refreshSuppressionMatches("invalid", "failed-refresh-token")).toBe(
      false,
    );
  });
});

it("only suppresses invalid refresh tokens for the refresh-token lifetime", () => {
  const terminalError = new AuthError(
    "The refresh token is invalid.",
    "invalid_refresh_token",
  );
  const terminalTtl = refreshSuppressionTtlSeconds(terminalError);

  expect(terminalTtl).toBe(authSecurityPolicy.refreshTokenTtlSeconds);
  expect(refreshSuppressionCookieOptions(terminalTtl).maxAge).toBe(terminalTtl);
  expect(refreshSuppressionTtlSeconds(new Error("database unavailable"))).toBe(
    5,
  );
});
