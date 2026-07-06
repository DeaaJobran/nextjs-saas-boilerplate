import {
  createTenantService,
  type ImpersonationSession,
  type TenantPermission,
} from "@nextjs-saas/tenant";
import { cookies } from "next/headers";

import { requireAdminSession } from "./admin-auth";
import { getOptionalCurrentSession, requireCurrentSession } from "./auth";

const activeOrganizationCookieName = "nextjs_saas_active_org";
const impersonationCookieName = "nextjs_saas_impersonation";

export function getTenantService() {
  return createTenantService({
    appBaseUrl: process.env.NEXT_PUBLIC_APP_URL,
  });
}

export async function setActiveOrganizationCookie(organizationId: string) {
  const cookieStore = await cookies();

  cookieStore.set(activeOrganizationCookieName, organizationId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function setImpersonationCookie(sessionId: string) {
  const cookieStore = await cookies();

  cookieStore.set(impersonationCookieName, sessionId, {
    httpOnly: true,
    maxAge: 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearImpersonationCookie() {
  const cookieStore = await cookies();

  cookieStore.delete(impersonationCookieName);
}

async function readActiveImpersonation(
  actorId: string,
  sessionId: string,
): Promise<ImpersonationSession | undefined> {
  const impersonation =
    await getTenantService().getImpersonationSession(sessionId);

  if (!impersonation || impersonation.actorId !== actorId) {
    return undefined;
  }

  return impersonation;
}

export async function getActiveTenantContext(permission?: TenantPermission) {
  const cookieStore = await cookies();
  const impersonationSessionId = cookieStore.get(
    impersonationCookieName,
  )?.value;
  const optionalSession = await getOptionalCurrentSession();
  const session =
    optionalSession ??
    (impersonationSessionId ? await requireAdminSession() : undefined) ??
    (await requireCurrentSession());
  const tenant = getTenantService();
  const impersonation = impersonationSessionId
    ? await readActiveImpersonation(session.user.id, impersonationSessionId)
    : undefined;
  const effectiveUser = impersonation
    ? {
        displayName: impersonation.subjectName ?? session.user.displayName,
        email: impersonation.subjectEmail ?? session.user.email,
        id: impersonation.subjectUserId,
        role: session.user.role,
      }
    : session.user;
  const organizations = await tenant.listOrganizationsForUser(effectiveUser.id);
  const availableOrganizations =
    organizations.length > 0
      ? organizations
      : impersonation
        ? organizations
        : [
            await tenant.ensurePersonalOrganization({
              displayName: effectiveUser.displayName,
              userId: effectiveUser.id,
            }),
          ];
  const preferredOrganizationId = impersonation
    ? impersonation.organizationId
    : cookieStore.get(activeOrganizationCookieName)?.value;
  const activeOrganization =
    availableOrganizations.find(
      (organization) => organization.id === preferredOrganizationId,
    ) ?? availableOrganizations[0];

  if (!activeOrganization) {
    throw new Error("No active organization is available for this user.");
  }

  const access = await tenant.requireMembership({
    organizationId: activeOrganization.id,
    permission,
    userId: effectiveUser.id,
  });

  return {
    ...access,
    authUser: session.user,
    effectiveUser,
    impersonation,
    organizations: availableOrganizations,
    session: session.session,
  };
}
