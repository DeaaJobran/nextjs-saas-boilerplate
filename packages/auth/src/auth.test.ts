import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  getDatabaseRuntime,
  resetDatabaseRuntimeForTests,
} from "@nextjs-saas/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthError,
  canAccessPage,
  createAuthService,
  requireApiAccess,
  validatePasswordPolicy,
} from ".";

let dataDir: string;
let openedRuntime = false;
const fixedNow = new Date("2026-07-06T08:00:00.000Z");

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "nextjs-saas-auth-"));
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.AUTH_SECRET = "test-auth-secret-with-at-least-32-characters";
  openedRuntime = false;
  resetDatabaseRuntimeForTests();
});

afterEach(async () => {
  vi.unstubAllGlobals();

  if (openedRuntime) {
    await (await getDatabaseRuntime()).close();
  }

  resetDatabaseRuntimeForTests();
  delete process.env.PGLITE_DATA_DIR;
  delete process.env.AUTH_SECRET;
  await rm(dataDir, { force: true, recursive: true });
});

async function createService() {
  openedRuntime = true;

  return createAuthService({
    appBaseUrl: "https://app.example.test",
    authSecret: process.env.AUTH_SECRET,
    issuer: "Example SaaS",
    now: () => fixedNow,
  });
}

describe("auth identity service", () => {
  it("enforces the password policy", async () => {
    await expect(validatePasswordPolicy("weak")).resolves.toEqual({
      issues: [
        "Use at least 12 characters.",
        "Add at least one uppercase letter.",
        "Add at least one number.",
      ],
      valid: false,
    });

    await expect(validatePasswordPolicy("StrongPass123")).resolves.toEqual({
      issues: [],
      valid: true,
    });
  });

  it("creates users, signs in, rotates refresh tokens, and revokes sessions", async () => {
    const auth = await createService();
    const user = await auth.createUserWithPassword({
      displayName: "Ada Lovelace",
      email: "Ada@Example.test",
      password: "StrongPass123",
    });

    expect(user.normalizedEmail).toBe("ada@example.test");

    const result = await auth.signInWithPassword({
      context: {
        deviceName: "Test browser",
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      email: "ada@example.test",
      password: "StrongPass123",
    });

    expect(result.status).toBe("signed_in");

    if (result.status !== "signed_in") {
      throw new Error("Expected sign-in to succeed.");
    }

    const sessionLookup = await auth.getSession(result.session.sessionToken);

    expect(sessionLookup?.user.email).toBe("Ada@Example.test");

    const rotated = await auth.rotateRefreshToken(result.session.refreshToken, {
      deviceName: "Rotated browser",
    });

    expect(rotated.sessionToken).not.toBe(result.session.sessionToken);

    await auth.revokeSession({ sessionId: rotated.session.id });

    await expect(
      auth.getSession(rotated.sessionToken),
    ).resolves.toBeUndefined();
  }, 30_000);

  it("handles email verification, password reset, and magic-link sign-in", async () => {
    const auth = await createService();
    const user = await auth.createUserWithPassword({
      displayName: "Grace Hopper",
      email: "grace@example.test",
      password: "StrongPass123",
    });
    const verification = await auth.createEmailVerification({
      email: "grace@example.test",
    });

    expect(verification.link).toContain("/auth/verify-email");

    const verifiedUser = await auth.verifyEmail(verification.token);

    expect(verifiedUser.emailVerifiedAt).toBe(fixedNow.toISOString());

    const reset = await auth.createPasswordReset({
      email: "grace@example.test",
    });

    await auth.resetPassword({
      password: "NewStrongPass123",
      token: reset!.token,
    });
    await expect(
      auth.signInWithPassword({
        email: "grace@example.test",
        password: "StrongPass123",
      }),
    ).rejects.toBeInstanceOf(AuthError);

    const magicLink = await auth.createMagicLink({ email: user.email });
    const magicResult = await auth.signInWithMagicLink({
      token: magicLink!.token,
    });

    expect(magicResult.user.id).toBe(user.id);
  }, 45_000);

  it("locks repeated failed password attempts", async () => {
    const auth = await createService();

    await auth.createUserWithPassword({
      displayName: "Failed Login",
      email: "lock@example.test",
      password: "StrongPass123",
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        auth.signInWithPassword({
          email: "lock@example.test",
          password: "WrongPass123",
        }),
      ).rejects.toMatchObject({ code: "invalid_credentials" });
    }

    await expect(
      auth.signInWithPassword({
        email: "lock@example.test",
        password: "StrongPass123",
      }),
    ).rejects.toMatchObject({ code: "login_locked" });
  }, 45_000);

  it("enables TOTP MFA and accepts valid authenticator codes", async () => {
    const auth = await createService();
    const user = await auth.createUserWithPassword({
      displayName: "MFA User",
      email: "mfa@example.test",
      password: "StrongPass123",
    });
    const enrollment = await auth.createTotpEnrollment({ userId: user.id });
    const code = auth.createTotpCode(enrollment.secret, {
      timestamp: fixedNow.getTime(),
    });
    const enabled = await auth.enableTotpFactor({
      code,
      factorId: enrollment.factorId,
      userId: user.id,
    });

    expect(enabled.recoveryCodes).toHaveLength(10);

    const firstAttempt = await auth.signInWithPassword({
      email: "mfa@example.test",
      password: "StrongPass123",
    });

    expect(firstAttempt.status).toBe("mfa_required");

    const secondAttempt = await auth.signInWithPassword({
      email: "mfa@example.test",
      mfaCode: code,
      password: "StrongPass123",
    });

    expect(secondAttempt.status).toBe("signed_in");
  }, 45_000);

  it("supports invitations and admin-created users through reset tokens", async () => {
    const auth = await createService();
    const admin = await auth.createUserWithPassword({
      displayName: "Admin User",
      email: "admin@example.test",
      password: "StrongPass123",
      role: "admin",
    });
    const invitation = await auth.createInvitation({
      actorId: admin.id,
      email: "member@example.test",
      role: "member",
    });
    const member = await auth.acceptInvitation({
      displayName: "Member User",
      password: "MemberPass123",
      token: invitation.token,
    });

    expect(member.role).toBe("member");
    expect(member.email).toBe("member@example.test");
  }, 30_000);

  it("creates passkey registration and authentication challenges", async () => {
    const auth = await createService();
    const user = await auth.createUserWithPassword({
      displayName: "Passkey User",
      email: "passkey@example.test",
      password: "StrongPass123",
    });
    const registrationOptions = await auth.beginPasskeyRegistration({
      label: "Laptop",
      userId: user.id,
    });
    const authenticationOptions = await auth.beginPasskeyAuthentication({
      email: "passkey@example.test",
    });

    expect(registrationOptions.challenge).toBeTruthy();
    expect(registrationOptions.rp.id).toBe("app.example.test");
    expect(authenticationOptions.challenge).toBeTruthy();
  }, 30_000);

  it("supports OAuth provider adapter state and callback handling", async () => {
    const auth = await createService();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "provider-access-token",
            expires_in: 3600,
            refresh_token: "provider-refresh-token",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            avatar_url: "https://example.test/avatar.png",
            email: "oauth@example.test",
            id: "provider-user-1",
            name: "OAuth User",
          }),
          { status: 200 },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const adapter = {
      authorizationEndpoint: "https://provider.example.test/oauth/authorize",
      clientId: "client-id",
      clientSecret: "client-secret",
      mapProfile(profile: Record<string, unknown>) {
        return {
          avatarUrl: String(profile.avatar_url),
          displayName: String(profile.name),
          email: String(profile.email),
          emailVerified: true,
          providerAccountId: String(profile.id),
        };
      },
      provider: "example",
      scopes: ["openid", "email", "profile"],
      tokenEndpoint: "https://provider.example.test/oauth/token",
      userInfoEndpoint: "https://provider.example.test/userinfo",
    };
    const authorization = await auth.createOAuthAuthorizationUrl({
      adapter,
      redirectUri: "https://app.example.test/auth/social/example/callback",
    });
    const callback = await auth.completeOAuthCallback({
      adapter,
      code: "authorization-code",
      redirectUri: "https://app.example.test/auth/social/example/callback",
      state: authorization.state,
    });

    expect(
      new URL(authorization.url).searchParams.get("code_challenge"),
    ).toBeTruthy();
    expect(callback.user.email).toBe("oauth@example.test");
    expect(callback.session.sessionToken).toMatch(/^nss_/);
  }, 30_000);

  it("exposes page and API authorization helpers", () => {
    expect(canAccessPage({ user: { role: "admin" } }, ["admin"])).toBe(true);
    expect(canAccessPage({ user: { role: "member" } }, ["admin"])).toBe(false);
    expect(requireApiAccess({ user: { role: "member" } }, ["admin"])).toEqual({
      body: {
        code: "forbidden",
        message: "You are not authorized to access this resource.",
      },
      status: 403,
    });
  });
});
