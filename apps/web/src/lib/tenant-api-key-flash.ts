export const tenantApiKeySecretCookieName = "nextjs_saas_tenant_key_secret";

export type TenantApiKeySecretFlash = {
  keyPrefix: string;
  organizationId: string;
  secret: string;
};

export function parseTenantApiKeySecretFlash(
  rawValue: string | undefined,
): TenantApiKeySecretFlash | undefined {
  if (!rawValue) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<TenantApiKeySecretFlash>;

    if (
      typeof parsed.keyPrefix === "string" &&
      typeof parsed.organizationId === "string" &&
      typeof parsed.secret === "string"
    ) {
      return {
        keyPrefix: parsed.keyPrefix,
        organizationId: parsed.organizationId,
        secret: parsed.secret,
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}
