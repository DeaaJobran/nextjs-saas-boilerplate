"use server";

import { appRoutes } from "@nextjs-saas/config/app";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  clearAuthCookies,
  getAuthService,
  requireCurrentSession,
} from "../../../../lib/auth";

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

export async function updateProfileAction(formData: FormData) {
  const session = await requireCurrentSession();

  await getAuthService().updateProfile({
    avatarUrl: formValue(formData, "avatarUrl") || undefined,
    displayName: formValue(formData, "displayName"),
    userId: session.user.id,
  });

  redirectWithLocalizedStatus(formData, "status", "profile-updated");
}

export async function requestEmailChangeAction(formData: FormData) {
  const session = await requireCurrentSession();

  await getAuthService().requestEmailChange({
    email: formValue(formData, "email"),
    userId: session.user.id,
  });

  redirectWithLocalizedStatus(formData, "status", "email-change-sent");
}

export async function requestAccountPasswordResetAction(formData: FormData) {
  const session = await requireCurrentSession();

  await getAuthService().createPasswordReset({ email: session.user.email });
  redirectWithLocalizedStatus(formData, "status", "password-reset-sent");
}

export async function startMfaEnrollmentAction(formData: FormData) {
  const session = await requireCurrentSession();
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

  await getAuthService().enableTotpFactor({
    code: formValue(formData, "code"),
    factorId: formValue(formData, "factorId"),
    userId: session.user.id,
  });

  const cookieStore = await cookies();

  cookieStore.delete(mfaSetupCookieName);
  redirectWithLocalizedStatus(formData, "status", "mfa-enabled");
}

export async function revokeSessionAction(formData: FormData) {
  await requireCurrentSession();
  await getAuthService().revokeSession({
    sessionId: formValue(formData, "sessionId"),
  });

  redirectWithLocalizedStatus(formData, "status", "session-revoked");
}

export async function deleteAccountAction(formData: FormData) {
  const session = await requireCurrentSession();

  await getAuthService().deleteAccount({
    password: formValue(formData, "password"),
    userId: session.user.id,
  });
  await clearAuthCookies();
  redirect(appRoutes.signIn);
}
