export function mfaEnforcedRoles(
  source: Record<string, string | undefined> = process.env,
) {
  return (source.SECURITY_MFA_ENFORCED_ROLES ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

export function isMfaRequiredForRole(
  role: string,
  source: Record<string, string | undefined> = process.env,
) {
  const roles = mfaEnforcedRoles(source);
  return roles.includes("*") || roles.includes(role.toLowerCase());
}
