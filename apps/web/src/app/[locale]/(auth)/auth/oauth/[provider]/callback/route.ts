import { withDatabaseTransaction } from "@nextjs-saas/db";
import { defaultLocale, isLocale } from "@nextjs-saas/localization";
import { getClientAddress, SecurityError } from "@nextjs-saas/security";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAuthService, setAuthCookies } from "@/lib/auth";
import { getContentRepository } from "@/lib/content-store";
import { getOAuthCallbackUrl, getOAuthProvider } from "@/lib/oauth";
import {
  matchesOAuthStateFingerprint,
  oauthStateCookieName,
  oauthStateCookieOptions,
} from "@/lib/oauth-browser-state";
import {
  createOAuthLegalAcceptance,
  matchesOAuthLegalAcceptances,
} from "@/lib/oauth-legal-onboarding";
import { getPublicManagedPage } from "@/lib/public-content";
import { getSecurityService } from "@/lib/security";

function signInErrorUrl(request: Request, locale: string) {
  return new URL(`/${locale}/auth/sign-in?error=oauth_failed`, request.url);
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ locale: string; provider: string }>;
  },
) {
  const params = await context.params;
  const locale = isLocale(params.locale) ? params.locale : defaultLocale;
  const provider = getOAuthProvider(params.provider);
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");

  if (!provider) {
    return NextResponse.redirect(signInErrorUrl(request, locale));
  }

  const cookieStore = await cookies();
  if (!state) {
    return NextResponse.redirect(signInErrorUrl(request, locale));
  }

  const stateCookieName = oauthStateCookieName(provider.provider, state);
  const stateFingerprint = cookieStore.get(stateCookieName)?.value;

  cookieStore.set(stateCookieName, "", {
    ...oauthStateCookieOptions(locale, provider.provider),
    maxAge: 0,
  });

  if (
    requestUrl.searchParams.has("error") ||
    !code ||
    !matchesOAuthStateFingerprint(stateFingerprint, state)
  ) {
    return NextResponse.redirect(signInErrorUrl(request, locale));
  }

  try {
    const repository = await getContentRepository();
    const legalDocuments = ["terms", "privacy"]
      .map((slug) =>
        getPublicManagedPage(repository.listPages(locale), {
          kind: "legal",
          locale,
          slug,
        }),
      )
      .filter((document) => document !== undefined);
    const expectedLegalAcceptances = legalDocuments.map(
      createOAuthLegalAcceptance,
    );
    const authRequestContext = {
      deviceName:
        request.headers.get("sec-ch-ua-platform") ?? "Browser session",
      ipAddress: getClientAddress(
        request.headers,
        Number(process.env.TRUSTED_PROXY_COUNT ?? 0),
      ),
      userAgent: request.headers.get("user-agent") ?? undefined,
    };
    const redirectUri = getOAuthCallbackUrl(locale, provider.provider);
    const auth = getAuthService();
    const claim = await auth.claimOAuthCallback({
      adapter: provider.adapter,
      redirectUri,
      state,
    });
    const exchange = await auth.exchangeOAuthCallback({
      adapter: provider.adapter,
      code,
      codeVerifier: claim.codeVerifier,
      redirectUri,
    });
    const result = await withDatabaseTransaction(async (client) => {
      const callback = await getAuthService(client).finalizeOAuthCallback({
        adapter: provider.adapter,
        allowUserProvisioning: true,
        authorizationMetadata: claim.authorizationMetadata,
        context: authRequestContext,
        exchange,
        provisioningLocale: locale,
      });

      if (!callback.provisioned) {
        return callback;
      }

      if (
        !repository.isLocaleEnabled(locale) ||
        legalDocuments.length !== 2 ||
        !matchesOAuthLegalAcceptances(
          callback.authorizationMetadata,
          expectedLegalAcceptances,
        )
      ) {
        throw new SecurityError(
          "Legal onboarding is required before social account creation.",
          "legal_acceptance_required",
          400,
        );
      }

      const security = getSecurityService(client);

      await Promise.all(
        expectedLegalAcceptances.map((document) =>
          security.acceptLegalDocument({
            ...document,
            ipAddress: authRequestContext.ipAddress,
            metadata: { provider: provider.provider, source: "oauth" },
            userAgent: authRequestContext.userAgent,
            userId: callback.user.id,
          }),
        ),
      );

      return callback;
    });

    await setAuthCookies(result.session);

    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  } catch {
    return NextResponse.redirect(signInErrorUrl(request, locale));
  }
}
