import { protectServerAction } from "./server-action-security";

export async function requirePublicFormAuth(identifier: string) {
  return protectServerAction({
    identifier: identifier || "missing-contact-identifier",
    limit: Number(process.env.SECURITY_CONTACT_RATE_LIMIT_MAX ?? 5),
    scope: "contact",
    windowSeconds: 60 * 60,
  });
}
