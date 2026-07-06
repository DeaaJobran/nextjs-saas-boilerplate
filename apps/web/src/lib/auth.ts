import {
  authRoleConfig,
  createAuthService,
  requirePageAccess,
} from "@nextjs-saas/auth";
import { appConfig, appRoutes } from "@nextjs-saas/config/app";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const sessionCookieName = "nextjs_saas_session";
export const refreshCookieName = "nextjs_saas_refresh";
const adminSessionCookieName = "nextjs_saas_admin_session";

export function getAuthService() {
  return createAuthService({
    appBaseUrl: process.env.NEXT_PUBLIC_APP_URL,
    authSecret: process.env.AUTH_SECRET,
    issuer: appConfig.shortName,
  });
}

export async function setAuthCookies(input: {
  refreshToken: string;
  sessionToken: string;
}) {
  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";

  cookieStore.set(sessionCookieName, input.sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
  });
  cookieStore.set(refreshCookieName, input.refreshToken, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
  });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();

  cookieStore.delete(sessionCookieName);
  cookieStore.delete(refreshCookieName);
}

async function getCurrentSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(sessionCookieName)?.value;

  if (!sessionToken) {
    return undefined;
  }

  return getAuthService().getSession(sessionToken);
}

export async function requireCurrentSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect(appRoutes.signIn);
  }

  return session;
}

export async function requireCurrentRole(allowedRoles: string[]) {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.AUTH_ALLOW_ADMIN_BYPASS === "true"
  ) {
    const expectedToken = process.env.ADMIN_SESSION_TOKEN;
    const cookieStore = await cookies();
    const token = cookieStore.get(adminSessionCookieName)?.value;

    if (
      expectedToken &&
      token === expectedToken &&
      allowedRoles.some((role) =>
        (authRoleConfig.privilegedRoles as readonly string[]).includes(role),
      )
    ) {
      return {
        session: {
          id: "development-admin-session",
        },
        user: {
          displayName: "Development Admin",
          email: "admin@example.test",
          id: "development-admin",
          role: authRoleConfig.adminBypassRole,
        },
      };
    }
  }

  const session = await getCurrentSession();

  if (!session) {
    redirect(appRoutes.signIn);
  }

  requirePageAccess(session, allowedRoles);

  return session;
}
