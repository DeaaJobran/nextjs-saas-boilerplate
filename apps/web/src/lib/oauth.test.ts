import { describe, expect, it } from "vitest";

import { getOAuthProviders } from "./oauth";

const providerConfig = JSON.stringify([
  {
    authorizationEndpoint: "https://identity.example/authorize",
    clientId: "client-id",
    clientSecret: "client-secret",
    displayName: "Example Identity",
    profileClaims: {
      avatarUrl: "images.avatar",
      displayName: "profile.name",
      email: "profile.email",
      emailVerified: "profile.email_verified",
      providerAccountId: "profile.id",
    },
    provider: "example",
    scopes: ["openid", "email", "profile"],
    tokenEndpoint: "https://identity.example/token",
    userInfoEndpoint: "https://identity.example/userinfo",
  },
]);

describe("getOAuthProviders", () => {
  it("builds a runtime adapter with configurable nested profile claims", () => {
    const [provider] = getOAuthProviders(providerConfig);

    expect(provider?.displayName).toBe("Example Identity");
    expect(
      provider?.adapter.mapProfile({
        images: { avatar: "https://cdn.example/avatar.png" },
        profile: {
          email: "USER@EXAMPLE.TEST",
          email_verified: true,
          id: "provider-user-1",
          name: "Example User",
        },
      }),
    ).toEqual({
      avatarUrl: "https://cdn.example/avatar.png",
      displayName: "Example User",
      email: "user@example.test",
      emailVerified: true,
      providerAccountId: "provider-user-1",
    });
  });

  it("rejects an incomplete provider profile", () => {
    const [provider] = getOAuthProviders(providerConfig);

    expect(() => provider?.adapter.mapProfile({ profile: {} })).toThrow(
      "incomplete profile",
    );
  });
});
