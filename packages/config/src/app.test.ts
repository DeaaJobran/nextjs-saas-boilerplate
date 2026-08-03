import { describe, expect, it } from "vitest";

import {
  appConfig,
  appRoutes,
  authActionRoutes,
  crawlerConfig,
  privateAppRoutePrefixes,
  publicAppRoutePrefixes,
} from "./app";

describe("application configuration", () => {
  it("keeps product identity and routes behind reusable configuration", () => {
    expect(appConfig.name).toBeTruthy();
    expect(appConfig.locales).toContain(appConfig.defaultLocale);
    expect(appRoutes.marketing).toBe("/");
    expect(new Set(Object.values(appRoutes)).size).toBe(
      Object.values(appRoutes).length,
    );
  });

  it("separates public crawler routes from private application routes", () => {
    expect(crawlerConfig.publicStaticRoutes).toContain(appRoutes.apiDocs);
    expect(crawlerConfig.disallowedLocalizedRoutePrefixes).toEqual(
      Object.values(privateAppRoutePrefixes),
    );
    expect(appRoutes.adminUsers).toBe(`${privateAppRoutePrefixes.admin}/users`);
    expect(appRoutes.signUp).toBe(`${privateAppRoutePrefixes.auth}/sign-up`);
    expect(appRoutes.legalTerms).toBe(`${publicAppRoutePrefixes.legal}/terms`);
    expect(appRoutes.organizationSettings).toBe(
      `${privateAppRoutePrefixes.settings}/organization`,
    );
    expect(authActionRoutes).toEqual({
      acceptInvitation: appRoutes.acceptInvitation,
      magicLink: appRoutes.magicLink,
      resetPassword: appRoutes.resetPassword,
      verifyEmail: appRoutes.verifyEmail,
      verifyEmailChange: appRoutes.verifyEmailChange,
    });
    expect(crawlerConfig.managedPageRoutes.legal).toBe(
      publicAppRoutePrefixes.legal,
    );
  });
});
