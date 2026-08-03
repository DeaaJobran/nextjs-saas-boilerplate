import { crawlerConfig } from "@nextjs-saas/config/app";
import type { ManagedPage } from "@nextjs-saas/config/content";
import type { Locale } from "@nextjs-saas/localization";
import type { MetadataRoute } from "next";

import {
  getPublicManagedPage,
  listCanonicalPublicManagedPages,
} from "./public-content";

export function getManagedPageRoute(page: ManagedPage) {
  switch (page.kind) {
    case "landing":
      return crawlerConfig.managedPageRoutes.landing;
    case "pricing":
      return crawlerConfig.managedPageRoutes.pricing;
    case "contact":
      return crawlerConfig.managedPageRoutes.contact;
    case "legal":
      return `${crawlerConfig.managedPageRoutes.legal}/${page.slug}`;
  }
}

export function createLocalizedPath(locale: Locale, route: string) {
  return `/${locale}${route === "/" ? "" : route}`;
}

function createLocalizedUrl(baseUrl: string, locale: Locale, route: string) {
  return `${baseUrl.replace(/\/$/, "")}${createLocalizedPath(locale, route)}`;
}

export function getPublicRecoveryRoute(pages: ManagedPage[], locale: Locale) {
  const landingPage = getPublicManagedPage(pages, {
    kind: "landing",
    locale,
  });

  if (landingPage) {
    return getManagedPageRoute(landingPage);
  }

  const alternativePage = listCanonicalPublicManagedPages(pages)
    .filter((page) => page.locale === locale)
    .sort((left, right) =>
      getManagedPageRoute(left).localeCompare(getManagedPageRoute(right)),
    )[0];

  return alternativePage
    ? getManagedPageRoute(alternativePage)
    : crawlerConfig.publicStaticRoutes[0];
}

export function createPublicSitemap({
  baseUrl,
  enabledLocales,
  pages,
}: {
  baseUrl: string;
  enabledLocales: Locale[];
  pages: ManagedPage[];
}): MetadataRoute.Sitemap {
  const enabledLocaleSet = new Set<Locale>(enabledLocales);
  const publicPages = listCanonicalPublicManagedPages(
    pages.filter((page) => enabledLocaleSet.has(page.locale)),
  );
  const managedEntries = publicPages.map((page) => {
    const route = getManagedPageRoute(page);
    const alternates = publicPages.filter(
      (candidate) => getManagedPageRoute(candidate) === route,
    );

    return {
      alternates: {
        languages: Object.fromEntries(
          alternates.map((candidate) => [
            candidate.locale,
            createLocalizedUrl(baseUrl, candidate.locale, route),
          ]),
        ),
      },
      lastModified: new Date(page.updatedAt),
      url: createLocalizedUrl(baseUrl, page.locale, route),
    };
  });
  const staticEntries = crawlerConfig.publicStaticRoutes.flatMap((route) =>
    enabledLocales.map((locale) => ({
      alternates: {
        languages: Object.fromEntries(
          enabledLocales.map((alternateLocale) => [
            alternateLocale,
            createLocalizedUrl(baseUrl, alternateLocale, route),
          ]),
        ),
      },
      url: createLocalizedUrl(baseUrl, locale, route),
    })),
  );

  return [...managedEntries, ...staticEntries].sort((left, right) =>
    left.url.localeCompare(right.url),
  );
}

export function createRobotsPolicy(
  baseUrl: string,
  enabledLocales: Locale[],
): MetadataRoute.Robots {
  return {
    rules: {
      allow: "/",
      disallow: [
        ...crawlerConfig.disallowedRoutePrefixes,
        ...enabledLocales.flatMap((locale) =>
          crawlerConfig.disallowedLocalizedRoutePrefixes.map((route) =>
            createLocalizedPath(locale, route),
          ),
        ),
      ],
      userAgent: "*",
    },
    sitemap: `${baseUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
