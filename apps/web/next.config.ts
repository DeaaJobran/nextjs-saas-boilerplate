import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { createSecurityHeaders } from "../../packages/security/src/headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const serverActionAllowedOrigins = (
  process.env.SERVER_ACTION_ALLOWED_ORIGINS ?? ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map((origin) => {
    try {
      return new URL(origin).host;
    } catch {
      return origin;
    }
  });

const nextConfig: NextConfig = {
  async headers() {
    return [{ headers: createSecurityHeaders(), source: "/:path*" }];
  },
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  experimental: {
    serverActions: {
      allowedOrigins: serverActionAllowedOrigins,
      bodySizeLimit: "1mb",
    },
  },
  transpilePackages: [
    "@nextjs-saas/config",
    "@nextjs-saas/db",
    "@nextjs-saas/localization",
    "@nextjs-saas/security",
    "@nextjs-saas/ui",
  ],
};

export default withNextIntl(nextConfig);
