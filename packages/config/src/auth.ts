import { z } from "zod";

const profileClaimsSchema = z
  .object({
    avatarUrl: z.string().trim().min(1).default("picture"),
    displayName: z.string().trim().min(1).default("name"),
    email: z.string().trim().min(1).default("email"),
    emailVerified: z.string().trim().min(1).default("email_verified"),
    providerAccountId: z.string().trim().min(1).default("sub"),
  })
  .default({
    avatarUrl: "picture",
    displayName: "name",
    email: "email",
    emailVerified: "email_verified",
    providerAccountId: "sub",
  });

const oauthProviderSchema = z.object({
  authorizationEndpoint: z.url(),
  clientId: z.string().trim().min(1),
  clientSecret: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  profileClaims: profileClaimsSchema,
  provider: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  scopes: z.array(z.string().trim().min(1)).min(1),
  tokenEndpointAuthMethod: z
    .enum(["client_secret_basic", "client_secret_post"])
    .default("client_secret_basic"),
  tokenEndpoint: z.url(),
  userInfoEndpoint: z.url(),
});

const oauthProvidersSchema = z.array(oauthProviderSchema);

export type OAuthProviderConfig = z.infer<typeof oauthProviderSchema>;

const oauthMobileRedirectUrisSchema = z.array(z.url()).max(100);

export function parseOAuthMobileRedirectUris(source?: string) {
  if (!source?.trim()) {
    return [];
  }

  let input: unknown;

  try {
    input = JSON.parse(source);
  } catch {
    throw new Error("AUTH_OAUTH_MOBILE_REDIRECT_URIS must be valid JSON.");
  }

  const redirectUris = oauthMobileRedirectUrisSchema.parse(input);

  if (new Set(redirectUris).size !== redirectUris.length) {
    throw new Error(
      "AUTH_OAUTH_MOBILE_REDIRECT_URIS contains duplicate redirect URIs.",
    );
  }

  return redirectUris;
}

export function parseOAuthProviderConfigs(source?: string) {
  if (!source?.trim()) {
    return [];
  }

  let input: unknown;

  try {
    input = JSON.parse(source);
  } catch {
    throw new Error("AUTH_OAUTH_PROVIDERS must be valid JSON.");
  }

  const providers = oauthProvidersSchema.parse(input);
  const providerIds = new Set<string>();

  for (const provider of providers) {
    if (providerIds.has(provider.provider)) {
      throw new Error(
        `AUTH_OAUTH_PROVIDERS contains duplicate provider \"${provider.provider}\".`,
      );
    }

    providerIds.add(provider.provider);
  }

  return providers;
}
