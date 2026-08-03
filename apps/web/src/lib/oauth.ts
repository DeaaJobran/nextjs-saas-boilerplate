import { AuthError, type OAuthProviderAdapter } from "@nextjs-saas/auth";
import {
  type OAuthProviderConfig,
  parseOAuthProviderConfigs,
} from "@nextjs-saas/config/auth";
import { env } from "@nextjs-saas/config/env";

function readClaim(profile: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }

    return (value as Record<string, unknown>)[segment];
  }, profile);
}

function requiredStringClaim(profile: Record<string, unknown>, path: string) {
  const value = readClaim(profile, path);

  if (typeof value !== "string" || !value.trim()) {
    throw new AuthError(
      "Social provider returned an incomplete profile.",
      "oauth_profile_invalid",
    );
  }

  return value.trim();
}

function optionalHttpUrl(profile: Record<string, unknown>, path: string) {
  const value = readClaim(profile, path);

  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function createOAuthAdapter(config: OAuthProviderConfig): OAuthProviderAdapter {
  return {
    authorizationEndpoint: config.authorizationEndpoint,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    mapProfile(profile) {
      const email = requiredStringClaim(
        profile,
        config.profileClaims.email,
      ).toLowerCase();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
        throw new AuthError(
          "Social provider returned an invalid email address.",
          "oauth_profile_invalid",
        );
      }

      const displayNameValue = readClaim(
        profile,
        config.profileClaims.displayName,
      );

      return {
        avatarUrl: optionalHttpUrl(profile, config.profileClaims.avatarUrl),
        displayName:
          typeof displayNameValue === "string" && displayNameValue.trim()
            ? displayNameValue.trim()
            : email,
        email,
        emailVerified:
          readClaim(profile, config.profileClaims.emailVerified) === true,
        providerAccountId: requiredStringClaim(
          profile,
          config.profileClaims.providerAccountId,
        ),
      };
    },
    provider: config.provider,
    scopes: config.scopes,
    tokenEndpointAuthMethod: config.tokenEndpointAuthMethod,
    tokenEndpoint: config.tokenEndpoint,
    userInfoEndpoint: config.userInfoEndpoint,
  };
}

export function getOAuthProviders(source = process.env.AUTH_OAUTH_PROVIDERS) {
  return parseOAuthProviderConfigs(source).map((config) => ({
    adapter: createOAuthAdapter(config),
    displayName: config.displayName,
    provider: config.provider,
  }));
}

export function getOAuthProvider(provider: string) {
  return getOAuthProviders().find(
    (candidate) => candidate.provider === provider,
  );
}

export function getOAuthCallbackUrl(locale: string, provider: string) {
  return new URL(
    `/${locale}/auth/oauth/${provider}/callback`,
    env.NEXT_PUBLIC_APP_URL,
  ).toString();
}
