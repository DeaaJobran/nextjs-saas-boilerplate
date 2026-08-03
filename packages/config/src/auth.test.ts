import { describe, expect, it } from "vitest";

import {
  parseOAuthMobileRedirectUris,
  parseOAuthProviderConfigs,
} from "./auth";

describe("parseOAuthProviderConfigs", () => {
  it("returns no providers when social sign-in is not configured", () => {
    expect(parseOAuthProviderConfigs()).toEqual([]);
  });

  it("parses provider settings and applies standard profile claims", () => {
    expect(
      parseOAuthProviderConfigs(
        JSON.stringify([
          {
            authorizationEndpoint: "https://identity.example/authorize",
            clientId: "client-id",
            clientSecret: "client-secret",
            displayName: "Example Identity",
            provider: "example",
            scopes: ["openid", "email", "profile"],
            tokenEndpoint: "https://identity.example/token",
            userInfoEndpoint: "https://identity.example/userinfo",
          },
        ]),
      ),
    ).toEqual([
      expect.objectContaining({
        displayName: "Example Identity",
        profileClaims: {
          avatarUrl: "picture",
          displayName: "name",
          email: "email",
          emailVerified: "email_verified",
          providerAccountId: "sub",
        },
        provider: "example",
        tokenEndpointAuthMethod: "client_secret_basic",
      }),
    ]);
  });

  it("parses an explicit mobile OAuth redirect allowlist", () => {
    expect(
      parseOAuthMobileRedirectUris(
        JSON.stringify([
          "com.example.app://oauth/callback",
          "https://mobile.example.test/oauth/callback",
        ]),
      ),
    ).toEqual([
      "com.example.app://oauth/callback",
      "https://mobile.example.test/oauth/callback",
    ]);
    expect(() =>
      parseOAuthMobileRedirectUris(
        JSON.stringify([
          "com.example.app://oauth/callback",
          "com.example.app://oauth/callback",
        ]),
      ),
    ).toThrow("duplicate redirect URIs");
  });

  it("rejects duplicate and unsafe provider identifiers", () => {
    const provider = {
      authorizationEndpoint: "https://identity.example/authorize",
      clientId: "client-id",
      clientSecret: "client-secret",
      displayName: "Example Identity",
      provider: "example",
      scopes: ["openid"],
      tokenEndpoint: "https://identity.example/token",
      userInfoEndpoint: "https://identity.example/userinfo",
    };

    expect(() =>
      parseOAuthProviderConfigs(JSON.stringify([provider, provider])),
    ).toThrow("duplicate provider");
    expect(() =>
      parseOAuthProviderConfigs(
        JSON.stringify([{ ...provider, provider: "../example" }]),
      ),
    ).toThrow();
  });
});
