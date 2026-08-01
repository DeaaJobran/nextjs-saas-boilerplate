"use server";

import { AuthError } from "@nextjs-saas/auth";
import { appRoutes } from "@nextjs-saas/config/app";
import { withDatabaseTransaction } from "@nextjs-saas/db";
import { isLocale } from "@nextjs-saas/localization";
import { SecurityError } from "@nextjs-saas/security";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  assertMfaEnrollmentAllowed,
  assertMfaPolicy,
  clearAuthCookies,
  getAuthService,
  requireCurrentSession,
} from "../../../../lib/auth";
import { getContentRepository } from "../../../../lib/content-store";
import { getMessagingService } from "../../../../lib/messaging";
import { getSecurityService } from "../../../../lib/security";
import { protectServerAction } from "../../../../lib/server-action-security";
import {
  getActiveTenantContext,
  getTenantService,
} from "../../../../lib/tenant";

const mfaSetupCookieName = "nextjs_saas_mfa_setup";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function localizedSettingsPath(formData: FormData) {
  const locale = formValue(formData, "locale");

  return locale ? `/${locale}${appRoutes.settings}` : appRoutes.settings;
}

function redirectWithLocalizedStatus(
  formData: FormData,
  key: string,
  value: string,
) {
  redirect(
    `${localizedSettingsPath(formData)}?${key}=${encodeURIComponent(value)}`,
  );
}

function actionErrorCode(error: unknown) {
  return error instanceof AuthError || error instanceof SecurityError
    ? error.code
    : "unknown";
}

async function requireSensitiveSettingsAccess(formData: FormData) {
  const session = await requireCurrentSession();

  try {
    assertMfaPolicy(session, session.user.role);
    const memberships = await getTenantService().listMembershipsForUser(
      session.user.id,
    );

    for (const membership of memberships) {
      assertMfaPolicy(session, membership.role);
    }
  } catch (error) {
    redirectWithLocalizedStatus(formData, "error", actionErrorCode(error));
  }

  return session;
}

export async function updateProfileAction(formData: FormData) {
  const session = await requireSensitiveSettingsAccess(formData);
  const preferredLocale = formValue(formData, "preferredLocale");
  const repository = await getContentRepository();

  if (
    preferredLocale &&
    (!isLocale(preferredLocale) || !repository.isLocaleEnabled(preferredLocale))
  ) {
    redirectWithLocalizedStatus(formData, "status", "invalid-locale");
  }

  await getAuthService().updateProfile({
    avatarUrl: formValue(formData, "avatarUrl") || undefined,
    displayName: formValue(formData, "displayName"),
    locale: preferredLocale || undefined,
    userId: session.user.id,
  });

  redirectWithLocalizedStatus(formData, "status", "profile-updated");
}

export async function requestEmailChangeAction(formData: FormData) {
  const session = await requireSensitiveSettingsAccess(formData);

  await getAuthService().requestEmailChange({
    email: formValue(formData, "email"),
    userId: session.user.id,
  });

  redirectWithLocalizedStatus(formData, "status", "email-change-sent");
}

export async function requestAccountPasswordResetAction(formData: FormData) {
  const session = await requireSensitiveSettingsAccess(formData);

  await getAuthService().createPasswordReset({ email: session.user.email });
  redirectWithLocalizedStatus(formData, "status", "password-reset-sent");
}

export async function startMfaEnrollmentAction(formData: FormData) {
  const session = await requireCurrentSession();

  try {
    await assertMfaEnrollmentAllowed(session);
  } catch (error) {
    redirectWithLocalizedStatus(formData, "error", actionErrorCode(error));
  }

  const enrollment = await getAuthService().createTotpEnrollment({
    userId: session.user.id,
  });
  const cookieStore = await cookies();

  cookieStore.set(mfaSetupCookieName, JSON.stringify(enrollment), {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirectWithLocalizedStatus(formData, "status", "mfa-setup-started");
}

export async function readMfaSetup() {
  await requireCurrentSession();

  const cookieStore = await cookies();
  const value = cookieStore.get(mfaSetupCookieName)?.value;

  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as {
      factorId: string;
      secret: string;
      uri: string;
    };
  } catch {
    return undefined;
  }
}

export async function enableMfaAction(formData: FormData) {
  const session = await requireCurrentSession();

  try {
    await assertMfaEnrollmentAllowed(session);
  } catch (error) {
    redirectWithLocalizedStatus(formData, "error", actionErrorCode(error));
  }

  await getAuthService().enableTotpFactor({
    code: formValue(formData, "code"),
    factorId: formValue(formData, "factorId"),
    sessionId: session.session.id,
    userId: session.user.id,
  });

  const cookieStore = await cookies();

  cookieStore.delete(mfaSetupCookieName);
  redirectWithLocalizedStatus(formData, "status", "mfa-enabled");
}

export async function verifyMfaSessionAction(formData: FormData) {
  const session = await requireCurrentSession();

  try {
    await protectServerAction({
      identifier: session.user.id,
      limit: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
      scope: "mfa-step-up",
      windowSeconds: Number(
        process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS ?? 15 * 60,
      ),
    });
    await getAuthService().verifySessionMfa({
      code: formValue(formData, "code"),
      sessionId: session.session.id,
      userId: session.user.id,
    });
  } catch (error) {
    redirectWithLocalizedStatus(formData, "error", actionErrorCode(error));
  }

  redirectWithLocalizedStatus(formData, "status", "mfa-verified");
}

export async function revokeSessionAction(formData: FormData) {
  await requireSensitiveSettingsAccess(formData);
  await getAuthService().revokeSession({
    sessionId: formValue(formData, "sessionId"),
  });

  redirectWithLocalizedStatus(formData, "status", "session-revoked");
}

export async function deleteAccountAction(formData: FormData) {
  const session = await requireSensitiveSettingsAccess(formData);
  try {
    await protectServerAction({
      identifier: session.user.id,
      limit: 3,
      scope: "account-deletion",
      windowSeconds: 60 * 60,
    });
    await withDatabaseTransaction(async (client) => {
      const auth = getAuthService(client);
      const security = getSecurityService(client);

      await auth.deleteAccount({
        password: formValue(formData, "password"),
        userId: session.user.id,
      });
      const privacyRequest = await security.requestPrivacyAction({
        reason: "User confirmed account deletion from settings.",
        type: "account_deletion",
        userId: session.user.id,
      });
      await security.updatePrivacyRequest({
        id: privacyRequest.id,
        result: { sessionsRevoked: true, softDeleted: true },
        status: "completed",
        userId: session.user.id,
      });
    });
  } catch (error) {
    redirectWithLocalizedStatus(formData, "error", actionErrorCode(error));
  }

  await clearAuthCookies();
  redirect(appRoutes.signIn);
}

export async function updateNotificationPreferencesAction(formData: FormData) {
  const [session, tenantContext] = await Promise.all([
    requireCurrentSession(),
    getActiveTenantContext("organization.read"),
  ]);

  await getMessagingService().setPreference({
    actorId: session.user.id,
    emailEnabled: formData.get("emailEnabled") === "on",
    eventType: "*",
    inAppEnabled: formData.get("inAppEnabled") === "on",
    locale: tenantContext.effectiveUser.locale,
    pushEnabled: formData.get("pushEnabled") === "on",
    smsEnabled: formData.get("smsEnabled") === "on",
    tenantId: tenantContext.organization.id,
    userId: tenantContext.effectiveUser.id,
  });

  redirectWithLocalizedStatus(
    formData,
    "status",
    "notification-preferences-updated",
  );
}

export async function markNotificationReadAction(formData: FormData) {
  const [, tenantContext] = await Promise.all([
    requireCurrentSession(),
    getActiveTenantContext("organization.read"),
  ]);

  await getMessagingService().updateInAppNotification({
    action: "read",
    notificationId: formValue(formData, "notificationId"),
    tenantId: tenantContext.organization.id,
    userId: tenantContext.effectiveUser.id,
  });

  redirectWithLocalizedStatus(formData, "status", "notification-read");
}
