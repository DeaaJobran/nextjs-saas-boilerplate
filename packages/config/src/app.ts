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

export const privateAppRoutePrefixes = {
  admin: "/admin",
  auth: "/auth",
  dashboard: "/dashboard",
  organizations: "/organizations",
  settings: "/settings",
} as const;

export const publicAppRoutePrefixes = {
  legal: "/legal",
} as const;

export const appRoutes = {
  marketing: "/",
  pricing: "/pricing",
  contact: "/contact",
  apiDocs: "/api",
  legal: `${publicAppRoutePrefixes.legal}/privacy`,
  legalTerms: `${publicAppRoutePrefixes.legal}/terms`,
  signIn: `${privateAppRoutePrefixes.auth}/sign-in`,
  signUp: `${privateAppRoutePrefixes.auth}/sign-up`,
  forgotPassword: `${privateAppRoutePrefixes.auth}/forgot-password`,
  magicLink: `${privateAppRoutePrefixes.auth}/magic-link`,
  resetPassword: `${privateAppRoutePrefixes.auth}/reset-password`,
  acceptInvitation: `${privateAppRoutePrefixes.auth}/invitations/accept`,
  verifyEmail: `${privateAppRoutePrefixes.auth}/verify-email`,
  verifyEmailChange: `${privateAppRoutePrefixes.auth}/verify-email-change`,
  dashboard: privateAppRoutePrefixes.dashboard,
  settings: privateAppRoutePrefixes.settings,
  billingSettings: `${privateAppRoutePrefixes.settings}/billing`,
  organizationSettings: `${privateAppRoutePrefixes.settings}/organization`,
  organizationInvitation: `${privateAppRoutePrefixes.organizations}/invitations/accept`,
  admin: privateAppRoutePrefixes.admin,
  adminBilling: `${privateAppRoutePrefixes.admin}/billing`,
  adminObservability: `${privateAppRoutePrefixes.admin}/observability`,
  adminSuper: `${privateAppRoutePrefixes.admin}/super`,
  adminUsers: `${privateAppRoutePrefixes.admin}/users`,
} as const;

export type AppRouteKey = keyof typeof appRoutes;

export const authActionRoutes = {
  acceptInvitation: appRoutes.acceptInvitation,
  magicLink: appRoutes.magicLink,
  resetPassword: appRoutes.resetPassword,
  verifyEmail: appRoutes.verifyEmail,
  verifyEmailChange: appRoutes.verifyEmailChange,
} as const;

export const crawlerConfig = {
  disallowedLocalizedRoutePrefixes: Object.values(privateAppRoutePrefixes),
  disallowedRoutePrefixes: ["/api/", "/billing/", "/storage/"],
  managedPageRoutes: {
    contact: appRoutes.contact,
    landing: appRoutes.marketing,
    legal: publicAppRoutePrefixes.legal,
    pricing: appRoutes.pricing,
  },
  publicStaticRoutes: [appRoutes.apiDocs],
} as const;
