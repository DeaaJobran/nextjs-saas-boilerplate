import { defaultContentSnapshot } from "@nextjs-saas/config/content";
import { describe, expect, it } from "vitest";

import {
  createPublicSitemap,
  createRobotsPolicy,
  getPublicRecoveryRoute,
} from "./seo-routes";

describe("public crawler routes", () => {
  it("publishes localized public pages and excludes private application routes", () => {
    const sitemap = createPublicSitemap({
      baseUrl: "https://saas.example/",
      enabledLocales: ["en", "ar"],
      pages: defaultContentSnapshot.pages,
    });
    const urls = sitemap.map((entry) => entry.url);

    expect(urls).toContain("https://saas.example/en");
    expect(urls).toContain("https://saas.example/ar/pricing");
    expect(urls).toContain("https://saas.example/en/api");
    expect(urls).toContain("https://saas.example/en/legal/privacy");
    expect(urls).toContain("https://saas.example/ar/legal/terms");
    expect(urls.some((url) => url.includes("/dashboard"))).toBe(false);
    expect(urls.some((url) => url.includes("/settings"))).toBe(false);
    expect(urls.some((url) => url.includes("/admin"))).toBe(false);
    expect(urls.some((url) => url.includes("/auth"))).toBe(false);
  });

  it("excludes draft pages and returns stable modification dates", () => {
    const draft = {
      ...defaultContentSnapshot.pages[0],
      id: "draft-landing",
      publishState: "draft" as const,
      updatedAt: "2026-08-03T12:00:00.000Z",
    };
    const sitemap = createPublicSitemap({
      baseUrl: "https://saas.example",
      enabledLocales: ["en"],
      pages: [draft],
    });

    expect(sitemap.map((entry) => entry.url)).toEqual([
      "https://saas.example/en/api",
    ]);
  });

  it("uses the canonical public page when fixed-route records overlap", () => {
    const landing = defaultContentSnapshot.pages.find(
      (page) => page.kind === "landing" && page.locale === "en",
    );

    if (!landing) {
      throw new Error("Expected the English landing page fixture.");
    }

    const olderPublicPage = {
      ...landing,
      id: "landing-en-older",
      updatedAt: "2026-08-01T00:00:00.000Z",
    };
    const newerPublicPage = {
      ...landing,
      id: "landing-en-newer",
      slug: "alternate-landing",
      updatedAt: "2026-08-02T00:00:00.000Z",
    };
    const sitemap = createPublicSitemap({
      baseUrl: "https://saas.example",
      enabledLocales: ["en"],
      pages: [olderPublicPage, newerPublicPage],
    });
    const landingEntry = sitemap.find(
      (entry) => entry.url === "https://saas.example/en",
    );

    expect(landingEntry?.lastModified).toEqual(
      new Date(newerPublicPage.updatedAt),
    );
  });

  it("falls back to another public route when the landing page is unavailable", () => {
    const pages = defaultContentSnapshot.pages.map((page) =>
      page.kind === "landing" && page.locale === "en"
        ? { ...page, publishState: "draft" as const }
        : page,
    );

    expect(getPublicRecoveryRoute(pages, "en")).toBe("/contact");
    expect(
      getPublicRecoveryRoute(
        pages.map((page) => ({ ...page, publishState: "draft" as const })),
        "en",
      ),
    ).toBe("/api");
  });

  it("disallows private, API, billing, and storage paths", () => {
    const robots = createRobotsPolicy("https://saas.example/", ["en", "ar"]);

    expect(robots).toMatchObject({
      rules: {
        allow: "/",
        disallow: expect.arrayContaining([
          "/api/",
          "/billing/",
          "/storage/",
          "/en/admin",
          "/en/auth",
          "/en/dashboard",
          "/en/settings",
          "/ar/admin",
          "/ar/auth",
          "/ar/dashboard",
          "/ar/settings",
        ]),
      },
      sitemap: "https://saas.example/sitemap.xml",
    });
    expect(robots.rules).not.toMatchObject({
      disallow: expect.arrayContaining(["/*/admin", "/*/settings"]),
    });
  });
});
