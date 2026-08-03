import { getClientAddress } from "@nextjs-saas/security";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import {
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
} from "./lib/auth-cookies";
import { getAuthService } from "./lib/auth-service";
import { coordinateRefreshRotation } from "./lib/refresh-rotation";

const localizationMiddleware = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const response = localizationMiddleware(request);
  const sessionToken = request.cookies.get(sessionCookieName)?.value;
  const refreshToken = request.cookies.get(refreshCookieName)?.value;
  const coordinatorCookie = request.cookies.get(
    refreshCoordinatorCookieName,
  )?.value;
  const coordinator = isRefreshCoordinator(coordinatorCookie)
    ? coordinatorCookie
    : createRefreshCoordinator();
  const refreshSuppression = request.cookies.get(
    refreshSuppressionCookieName,
  )?.value;

  if (
    sessionToken ||
    !refreshToken ||
    refreshSuppressionMatches(refreshSuppression, refreshToken)
  ) {
    return response;
  }

  try {
    const rotated = await coordinateRefreshRotation(refreshToken, () =>
      getAuthService().rotateRefreshToken(
        refreshToken,
        {
          deviceName:
            request.headers.get("sec-ch-ua-platform") ?? "Browser session",
          ipAddress: getClientAddress(
            request.headers,
            Number(process.env.TRUSTED_PROXY_COUNT ?? 0),
          ),
          userAgent: request.headers.get("user-agent") ?? undefined,
        },
        { coordinator },
      ),
    );
    const rotatedResponse = response.headers.get("location")
      ? response
      : NextResponse.redirect(request.nextUrl);

    rotatedResponse.cookies.set(
      sessionCookieName,
      rotated.sessionToken,
      sessionCookieOptions(),
    );
    rotatedResponse.cookies.set(
      refreshCoordinatorCookieName,
      coordinator,
      refreshCoordinatorCookieOptions(),
    );
    rotatedResponse.cookies.set(
      refreshCookieName,
      rotated.refreshToken,
      refreshCookieOptions(),
    );
    rotatedResponse.cookies.set(refreshSuppressionCookieName, "", {
      ...refreshSuppressionCookieOptions(),
      maxAge: 0,
    });

    return rotatedResponse;
  } catch (error) {
    // Suppress repeated attempts for this exact stale token without deleting a
    // newer refresh cookie that a concurrent response may already have set.
    response.cookies.set(
      refreshSuppressionCookieName,
      refreshSuppressionFingerprint(refreshToken),
      refreshSuppressionCookieOptions(refreshSuppressionTtlSeconds(error)),
    );

    return response;
  }
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
