import { createAuthService } from "@nextjs-saas/auth";
import { appConfig, authActionRoutes } from "@nextjs-saas/config/app";
import type { Queryable } from "@nextjs-saas/db";

export function getAuthService(client?: Queryable) {
  return createAuthService({
    actionRoutes: authActionRoutes,
    appBaseUrl: process.env.NEXT_PUBLIC_APP_URL,
    authSecret: process.env.AUTH_SECRET,
    client,
    issuer: appConfig.shortName,
  });
}
