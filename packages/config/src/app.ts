import { defaultLocale, locales } from "@nextjs-saas/localization";

export const appConfig = {
  name: "Next.js SaaS Boilerplate",
  shortName: "SaaS Boilerplate",
  description:
    "Open-source Next.js SaaS boilerplate for launching production-minded products faster.",
  repositoryUrl: "https://github.com/DeaaJobran/nextjs-saas-boilerplate",
  defaultLocale,
  locales,
  supportEmail: "support@example.com",
  social: {
    github: "https://github.com/DeaaJobran/nextjs-saas-boilerplate",
  },
} as const;

export type AppConfig = typeof appConfig;

export const appRoutes = {
  marketing: "/",
  pricing: "/pricing",
  contact: "/contact",
  legal: "/legal/privacy",
  signIn: "/auth/sign-in",
  dashboard: "/dashboard",
  settings: "/settings",
  admin: "/admin",
} as const;

export type AppRouteKey = keyof typeof appRoutes;
