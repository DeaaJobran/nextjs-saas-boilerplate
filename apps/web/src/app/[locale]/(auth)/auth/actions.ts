"use server";

import { AuthError } from "@nextjs-saas/auth";
import { appRoutes } from "@nextjs-saas/config/app";
import { withDatabaseTransaction } from "@nextjs-saas/db";
import { defaultLocale, isLocale } from "@nextjs-saas/localization";
import {
  fingerprintLegalDocument,
  getClientAddress,
  SecurityError,
} from "@nextjs-saas/security";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  clearAuthCookies,
  getAuthService,
  getOptionalCurrentSession,
  setAuthCookies,
} from "../../../../lib/auth";
import { getContentRepository } from "../../../../lib/content-store";
import { getOAuthCallbackUrl, getOAuthProvider } from "../../../../lib/oauth";
import {
  createOAuthBrowserId,
  isOAuthBrowserId,
  oauthBrowserCookieName,
  oauthBrowserCookieOptions,
  oauthStateCookieName,
  oauthStateCookieOptions,
  oauthStateFingerprint,
} from "../../../../lib/oauth-browser-state";
import {
  createOAuthLegalAcceptance,
  type OAuthLegalAcceptance,
} from "../../../../lib/oauth-legal-onboarding";
import { getPublicManagedPage } from "../../../../lib/public-content";
import { getSecurityService } from "../../../../lib/security";
import { protectServerAction } from "../../../../lib/server-action-security";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function authContext() {
  return headers().then((headerStore) => ({
    deviceName: headerStore.get("sec-ch-ua-platform") ?? "Browser session",
    ipAddress: getClientAddress(
      headerStore,
      Number(process.env.TRUSTED_PROXY_COUNT ?? 0),
    ),
    userAgent: headerStore.get("user-agent") ?? undefined,
  }));
}

function redirectWithStatus(path: string, key: string, value: string) {
  const [pathname, queryString = ""] = path.split("?");
  const params = new URLSearchParams(queryString);

  params.set(key, value);
  redirect(`${pathname}?${params.toString()}`);
}

function localizedPath(formData: FormData, path: string) {
  const localeValue = formValue(formData, "locale");
  const locale = isLocale(localeValue) ? localeValue : defaultLocale;

  return `/${locale}${path}`;
}

function errorCode(error: unknown) {
  return error instanceof AuthError || error instanceof SecurityError
    ? error.code
    : "unknown";
}

function protectAuthAction(identifier: string, scope = "auth") {
  return protectServerAction({
    identifier: identifier || "missing-auth-identifier",
    limit: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
    scope,
    windowSeconds: Number(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS ?? 900),
  });
}

async function protectOAuthStartGlobally(provider: string) {
  const clientLimit = Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10);
  const result = await getSecurityService().consumeRateLimit({
    identifier: provider,
    limit: Number(
      process.env.AUTH_OAUTH_GLOBAL_RATE_LIMIT_MAX ?? clientLimit * 50,
    ),
    scope: "server-action:oauth-start:global",
    windowSeconds: Number(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS ?? 900),
  });

  if (!result.allowed) {
    throw new SecurityError("Rate limit exceeded.", "rate_limited", 429);
  }
}

export async function signInAction(formData: FormData) {
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");
  const mfaCode = formValue(formData, "mfaCode") || undefined;
  const auth = getAuthService();
  let redirectTo = localizedPath(formData, appRoutes.dashboard);

  try {
    await protectAuthAction(email);
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

export async function startOAuthSignInAction(formData: FormData) {
  const providerId = formValue(formData, "provider");
  const localeValue = formValue(formData, "locale");
  const locale = isLocale(localeValue) ? localeValue : defaultLocale;
  let authorizationUrl = localizedPath(formData, appRoutes.signIn);

  try {
    const cookieStore = await cookies();
    const browserIdCookie = cookieStore.get(oauthBrowserCookieName)?.value;
    const browserId =
      browserIdCookie && isOAuthBrowserId(browserIdCookie)
        ? browserIdCookie
        : createOAuthBrowserId();
    const requestContext = await authContext();

    if (browserId !== browserIdCookie) {
      cookieStore.set(
        oauthBrowserCookieName,
        browserId,
        oauthBrowserCookieOptions(),
      );
    }

    await protectAuthAction(
      `oauth:${requestContext.ipAddress ?? browserId}`,
      "oauth-start",
    );
    const provider = getOAuthProvider(providerId);

    if (!provider) {
      throw new AuthError(
        "Social sign-in provider is not configured.",
        "oauth_provider_not_found",
      );
    }

    await protectOAuthStartGlobally(provider.provider);

    const legalAcceptances: OAuthLegalAcceptance[] = [];

    if (formData.get("legalAcceptance") === "on") {
      const repository = await getContentRepository();

      if (!repository.isLocaleEnabled(locale)) {
        throw new SecurityError(
          "Account creation is unavailable for this locale.",
          "locale_unavailable",
          400,
        );
      }

      const pages = repository.listPages(locale);
      const legalDocuments = ["terms", "privacy"].map((slug) =>
        getPublicManagedPage(pages, { kind: "legal", locale, slug }),
      );

      if (legalDocuments.some((document) => !document)) {
        throw new SecurityError(
          "Published legal documents are unavailable.",
          "legal_document_unavailable",
          500,
        );
      }

      legalAcceptances.push(
        ...legalDocuments.map((document) =>
          createOAuthLegalAcceptance(document!),
        ),
      );
    }

    const authorization = await getAuthService().createOAuthAuthorizationUrl({
      adapter: provider.adapter,
      metadata: { legalAcceptances, locale },
      redirectUri: getOAuthCallbackUrl(locale, provider.provider),
    });

    authorizationUrl = authorization.url;
    cookieStore.set(
      oauthStateCookieName(provider.provider, authorization.state),
      oauthStateFingerprint(authorization.state),
      oauthStateCookieOptions(locale, provider.provider),
    );
  } catch {
    redirectWithStatus(
      localizedPath(formData, appRoutes.signIn),
      "error",
      "oauth_failed",
    );
  }

  redirect(authorizationUrl);
}

export async function signUpAction(formData: FormData) {
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");
  const localeValue = formValue(formData, "locale");
  const locale = isLocale(localeValue) ? localeValue : defaultLocale;

  try {
    const requestContext = await protectAuthAction(email);

    if (formData.get("legalAcceptance") !== "on") {
      throw new SecurityError(
        "Terms and privacy acceptance is required.",
        "legal_acceptance_required",
        400,
      );
    }
    const repository = await getContentRepository();

    if (!repository.isLocaleEnabled(locale)) {
      throw new SecurityError(
        "Account creation is unavailable for this locale.",
        "locale_unavailable",
        400,
      );
    }

    const pages = repository.listPages(locale);
    const termsDocument = getPublicManagedPage(pages, {
      kind: "legal",
      locale,
      slug: "terms",
    });
    const privacyDocument = getPublicManagedPage(pages, {
      kind: "legal",
      locale,
      slug: "privacy",
    });

    if (!termsDocument || !privacyDocument) {
      throw new SecurityError(
        "Published legal documents are unavailable.",
        "legal_document_unavailable",
        500,
      );
    }
    const legalDocuments = [termsDocument, privacyDocument];
    const context = await authContext();
    const result = await withDatabaseTransaction(async (client) => {
      const auth = getAuthService(client);
      const security = getSecurityService(client);
      const user = await auth.createUserWithPassword({
        displayName: formValue(formData, "displayName"),
        email,
        locale,
        password,
      });

      await Promise.all(
        legalDocuments.map((document) =>
          security.acceptLegalDocument({
            contentHash: fingerprintLegalDocument(document),
            documentId: document.id,
            documentSlug: document.slug,
            ipAddress: requestContext.ipAddress,
            locale,
            userAgent: requestContext.userAgent,
            userId: user.id,
            version: document.version ?? document.updatedAt,
          }),
        ),
      );

      const signInResult = await auth.signInWithPassword({
        context,
        email,
        password,
      });
      await auth.createEmailVerification({ email });

      return signInResult;
    });

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
  const email = formValue(formData, "email");

  try {
    await protectAuthAction(email);
    await auth.createPasswordReset({ email });
  } catch (error) {
    redirectWithStatus(
      localizedPath(formData, appRoutes.forgotPassword),
      "error",
      errorCode(error),
    );
  }

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
    await protectAuthAction(token);
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

export async function acceptInvitationAction(formData: FormData) {
  const auth = getAuthService();
  const password = formValue(formData, "password");
  const token = formValue(formData, "token");

  try {
    await protectAuthAction(token);
    const user = await auth.acceptInvitation({
      displayName: formValue(formData, "displayName"),
      password,
      token,
    });
    const result = await auth.signInWithPassword({
      context: await authContext(),
      email: user.email,
      password,
    });

    if (result.status === "signed_in") {
      await setAuthCookies(result.session);
    }
  } catch (error) {
    redirectWithStatus(
      `${localizedPath(formData, appRoutes.acceptInvitation)}?token=${encodeURIComponent(token)}`,
      "error",
      errorCode(error),
    );
  }

  redirect(
    `${localizedPath(formData, appRoutes.dashboard)}?notice=invitation-accepted`,
  );
}

export async function requestMagicLinkAction(formData: FormData) {
  const auth = getAuthService();
  const email = formValue(formData, "email");

  try {
    await protectAuthAction(email);
    await auth.createMagicLink({ email });
  } catch (error) {
    redirectWithStatus(
      localizedPath(formData, appRoutes.signIn),
      "error",
      errorCode(error),
    );
  }

  redirectWithStatus(
    localizedPath(formData, appRoutes.signIn),
    "status",
    "magic-link-sent",
  );
}

export async function signInWithMagicLinkAction(formData: FormData) {
  const auth = getAuthService();
  const token = formValue(formData, "token");

  try {
    await protectAuthAction(token);
    const result = await auth.signInWithMagicLink({
      context: await authContext(),
      token,
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
  const token = formValue(formData, "token");

  try {
    await protectAuthAction(token);
    await auth.verifyEmail(token);
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

export async function verifyEmailChangeAction(formData: FormData) {
  const auth = getAuthService();
  const token = formValue(formData, "token");

  try {
    await protectAuthAction(token);
    await auth.verifyEmailChange(token);
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
    "email-change-verified",
  );
}

export async function logoutAction(formData: FormData) {
  const session = await getOptionalCurrentSession();

  if (session) {
    await getAuthService().revokeSession({ sessionId: session.session.id });
  }
  await clearAuthCookies();
  redirect(localizedPath(formData, appRoutes.signIn));
}
