import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: [
    "@nextjs-saas/config",
    "@nextjs-saas/localization",
    "@nextjs-saas/ui",
  ],
};

export default withNextIntl(nextConfig);
