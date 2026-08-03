import {
  authRoleConfig,
  type AuthSession,
  requirePageAccess,
} from "@nextjs-saas/auth";
import { appRoutes } from "@nextjs-saas/config/app";
import {
  getClientAddress,
  isMfaRequiredForRole,
  SecurityError,
} from "@nextjs-saas/security";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  adminSessionCookieName,
  createRefreshCoordinator,
  isRefreshCoordinator,
  refreshCookieName,
  refreshCookieOptions,
  refreshCoordinatorCookieName,
  refreshCoordinatorCookieOptions,
  refreshSuppressionCookieName,
  refreshSuppressionCookieOptions,
  refreshSuppressionFingerprint,
  refreshSuppressionMatches,
  refreshSuppressionTtlSeconds,
  sessionCookieName,
  sessionCookieOptions,
} from "./auth-cookies";
import { getAuthService } from "./auth-service";
import { coordinateRefreshRotation } from "./refresh-rotation";

export { getAuthService } from "./auth-service";

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

export async function setAuthCookies(
  input: {
    refreshToken: string;
    sessionToken: string;
  },
  coordinator?: string,
) {
  const cookieStore = await cookies();
  const refreshCoordinator = isRefreshCoordinator(coordinator)
    ? coordinator
    : isRefreshCoordinator(cookieStore.get(refreshCoordinatorCookieName)?.value)
      ? cookieStore.get(refreshCoordinatorCookieName)!.value
      : createRefreshCoordinator();

  cookieStore.set(
    sessionCookieName,
    input.sessionToken,
    sessionCookieOptions(),
  );
  cookieStore.set(
    refreshCookieName,
    input.refreshToken,
    refreshCookieOptions(),
  );
  cookieStore.set(
    refreshCoordinatorCookieName,
    refreshCoordinator,
    refreshCoordinatorCookieOptions(),
  );
  cookieStore.delete(refreshSuppressionCookieName);
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();

  cookieStore.delete(sessionCookieName);
  cookieStore.delete(refreshCookieName);
  cookieStore.delete(refreshCoordinatorCookieName);
  cookieStore.delete(refreshSuppressionCookieName);
  cookieStore.delete(adminSessionCookieName);
}

async function getCurrentSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(sessionCookieName)?.value;

  if (!sessionToken) {
    return undefined;
  }

  return getAuthService().getSession(sessionToken);
}

async function refreshApiSession() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(refreshCookieName)?.value;
  const suppression = cookieStore.get(refreshSuppressionCookieName)?.value;
  const coordinatorCookie = cookieStore.get(
    refreshCoordinatorCookieName,
  )?.value;
  const coordinator = isRefreshCoordinator(coordinatorCookie)
    ? coordinatorCookie
    : createRefreshCoordinator();

  if (!refreshToken || refreshSuppressionMatches(suppression, refreshToken)) {
    return undefined;
  }

  try {
    const headerStore = await headers();
    const rotated = await coordinateRefreshRotation(refreshToken, () =>
      getAuthService().rotateRefreshToken(
        refreshToken,
        {
          deviceName:
            headerStore.get("sec-ch-ua-platform") ?? "Browser API session",
          ipAddress: getClientAddress(
            headerStore,
            Number(process.env.TRUSTED_PROXY_COUNT ?? 0),
          ),
          userAgent: headerStore.get("user-agent") ?? undefined,
        },
        { coordinator },
      ),
    );

    await setAuthCookies(rotated, coordinator);

    return getAuthService().getSession(rotated.sessionToken);
  } catch (error) {
    cookieStore.set(
      refreshSuppressionCookieName,
      refreshSuppressionFingerprint(refreshToken),
      refreshSuppressionCookieOptions(refreshSuppressionTtlSeconds(error)),
    );

    return undefined;
  }
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

export async function requireApiSession() {
  const session = (await getCurrentSession()) ?? (await refreshApiSession());

  if (!session) {
    throw new SecurityError("Authentication is required.", "unauthorized", 401);
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
