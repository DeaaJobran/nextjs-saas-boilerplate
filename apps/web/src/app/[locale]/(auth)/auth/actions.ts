"use server";

import { AuthError } from "@nextjs-saas/auth";
import { appRoutes } from "@nextjs-saas/config/app";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  clearAuthCookies,
  getAuthService,
  requireCurrentSession,
  setAuthCookies,
} from "../../../../lib/auth";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function authContext() {
  return headers().then((headerStore) => ({
    deviceName: headerStore.get("sec-ch-ua-platform") ?? "Browser session",
    ipAddress:
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headerStore.get("x-real-ip") ??
      undefined,
    userAgent: headerStore.get("user-agent") ?? undefined,
  }));
}

function redirectWithStatus(path: string, key: string, value: string) {
  redirect(`${path}?${key}=${encodeURIComponent(value)}`);
}

function localizedPath(formData: FormData, path: string) {
  const locale = formValue(formData, "locale");

  return locale ? `/${locale}${path}` : path;
}

function errorCode(error: unknown) {
  return error instanceof AuthError ? error.code : "unknown";
}

export async function signInAction(formData: FormData) {
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");
  const mfaCode = formValue(formData, "mfaCode") || undefined;
  const auth = getAuthService();
  let redirectTo = localizedPath(formData, appRoutes.dashboard);

  try {
    const result = await auth.signInWithPassword({
      context: await authContext(),
      email,
      mfaCode,
      password,
    });

    if (result.status === "mfa_required") {
      redirectTo = `${localizedPath(formData, appRoutes.signIn)}?mfa=required&email=${encodeURIComponent(email)}`;
    } else {
      await setAuthCookies(result.session);
    }
  } catch (error) {
    redirectWithStatus(
      localizedPath(formData, appRoutes.signIn),
      "error",
      errorCode(error),
    );
  }

  redirect(redirectTo);
}

export async function signUpAction(formData: FormData) {
  const auth = getAuthService();
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");

  try {
    await auth.createUserWithPassword({
      displayName: formValue(formData, "displayName"),
      email,
      password,
    });

    const [result] = await Promise.all([
      auth.signInWithPassword({
        context: await authContext(),
        email,
        password,
      }),
      auth.createEmailVerification({ email }),
    ]);

    if (result.status === "signed_in") {
      await setAuthCookies(result.session);
    }
  } catch (error) {
    redirectWithStatus(
      localizedPath(formData, appRoutes.signUp),
      "error",
      errorCode(error),
    );
  }

  redirect(
    `${localizedPath(formData, appRoutes.dashboard)}?notice=email-verification-sent`,
  );
}

export async function requestPasswordResetAction(formData: FormData) {
  const auth = getAuthService();

  await auth.createPasswordReset({ email: formValue(formData, "email") });
  redirectWithStatus(
    localizedPath(formData, appRoutes.forgotPassword),
    "status",
    "sent",
  );
}

export async function resetPasswordAction(formData: FormData) {
  const auth = getAuthService();
  const token = formValue(formData, "token");

  try {
    await auth.resetPassword({
      password: formValue(formData, "password"),
      token,
    });
  } catch (error) {
    redirectWithStatus(
      `${localizedPath(formData, appRoutes.resetPassword)}?token=${encodeURIComponent(token)}`,
      "error",
      errorCode(error),
    );
  }

  redirectWithStatus(
    localizedPath(formData, appRoutes.signIn),
    "status",
    "password-reset",
  );
}

export async function requestMagicLinkAction(formData: FormData) {
  const auth = getAuthService();

  await auth.createMagicLink({ email: formValue(formData, "email") });
  redirectWithStatus(
    localizedPath(formData, appRoutes.signIn),
    "status",
    "magic-link-sent",
  );
}

export async function signInWithMagicLinkAction(formData: FormData) {
  const auth = getAuthService();

  try {
    const result = await auth.signInWithMagicLink({
      context: await authContext(),
      token: formValue(formData, "token"),
    });

    await setAuthCookies(result.session);
  } catch (error) {
    redirectWithStatus(
      localizedPath(formData, appRoutes.signIn),
      "error",
      errorCode(error),
    );
  }

  redirect(localizedPath(formData, appRoutes.dashboard));
}

export async function verifyEmailAction(formData: FormData) {
  const auth = getAuthService();

  try {
    await auth.verifyEmail(formValue(formData, "token"));
  } catch (error) {
    redirectWithStatus(
      localizedPath(formData, appRoutes.settings),
      "error",
      errorCode(error),
    );
  }

  redirectWithStatus(
    localizedPath(formData, appRoutes.settings),
    "status",
    "email-verified",
  );
}

export async function logoutAction() {
  const session = await requireCurrentSession();

  await getAuthService().revokeSession({ sessionId: session.session.id });
  await clearAuthCookies();
  redirect(appRoutes.signIn);
}
