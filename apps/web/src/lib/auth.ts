import {
  authRoleConfig,
  authSecurityPolicy,
  type AuthSession,
  createAuthService,
  requirePageAccess,
} from "@nextjs-saas/auth";
import {
  appConfig,
  appRoutes,
  authActionRoutes,
} from "@nextjs-saas/config/app";
import type { Queryable } from "@nextjs-saas/db";
import { isMfaRequiredForRole, SecurityError } from "@nextjs-saas/security";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const sessionCookieName = "nextjs_saas_session";
const refreshCookieName = "nextjs_saas_refresh";
const adminSessionCookieName = "nextjs_saas_admin_session";

type SessionContext = {
  session: Pick<AuthSession, "mfaVerifiedAt">;
  user: {
    id: string;
    mfaRequired: boolean;
    role: string;
  };
};

export function hasMfaAssurance(session: SessionContext) {
  return Boolean(session.session.mfaVerifiedAt);
}

export function satisfiesMfaPolicy(session: SessionContext, role: string) {
  const requiresMfa = session.user.mfaRequired || isMfaRequiredForRole(role);

  return !requiresMfa || hasMfaAssurance(session);
}

export function assertMfaAssurance(session: SessionContext) {
  if (!hasMfaAssurance(session)) {
    throw new SecurityError(
      "Multi-factor authentication is required.",
      "mfa_required",
      403,
    );
  }
}

export function assertMfaPolicy(session: SessionContext, role: string) {
  if (!satisfiesMfaPolicy(session, role)) {
    throw new SecurityError(
      "Multi-factor authentication is required.",
      "mfa_required",
      403,
    );
  }
}

export async function assertMfaEnrollmentAllowed(session: SessionContext) {
  if (hasMfaAssurance(session)) {
    return;
  }

  const hasRegisteredMfaPasskey = (
    await getAuthService().listPasskeys(session.user.id)
  ).some((passkey) => passkey.userVerified);

  if (session.user.mfaRequired || hasRegisteredMfaPasskey) {
    throw new SecurityError(
      "Current MFA assurance is required to add authentication factors.",
      "mfa_required",
      403,
    );
  }
}

export function getAuthService(client?: Queryable) {
  return createAuthService({
    actionRoutes: authActionRoutes,
    appBaseUrl: process.env.NEXT_PUBLIC_APP_URL,
    authSecret: process.env.AUTH_SECRET,
    client,
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
    maxAge: authSecurityPolicy.sessionTtlSeconds,
    path: "/",
    sameSite: "lax",
    secure,
  });
  cookieStore.set(refreshCookieName, input.refreshToken, {
    httpOnly: true,
    maxAge: authSecurityPolicy.refreshTokenTtlSeconds,
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

export async function getOptionalCurrentSession() {
  return getCurrentSession();
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
          mfaVerifiedAt: new Date().toISOString(),
        },
        user: {
          displayName: "Development Admin",
          email: "admin@example.test",
          id: "development-admin",
          mfaRequired: true,
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

  if (!satisfiesMfaPolicy(session, session.user.role)) {
    redirect(`${appRoutes.settings}?status=mfa-required`);
  }

  return session;
}
