import { appRoutes } from "@nextjs-saas/config/app";
import { env } from "@nextjs-saas/config/env";
import { locales } from "@nextjs-saas/localization";
import type { MetadataRoute } from "next";

import { getContentRepository } from "../lib/content-store";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repository = await getContentRepository();
  const staticRoutes = [
    appRoutes.marketing,
    appRoutes.pricing,
    appRoutes.contact,
    appRoutes.dashboard,
    appRoutes.settings,
    appRoutes.admin,
    appRoutes.signIn,
  ];

  const legalRoutes: string[] = [];

  for (const locale of locales) {
    for (const page of repository.listPages(locale)) {
      if (page.kind === "legal" && page.publishState === "published") {
        legalRoutes.push(`/${locale}/legal/${page.slug}`);
      }
    }
  }

  return [
    ...locales.flatMap((locale) =>
      staticRoutes.map((route) => ({
        url: `${env.NEXT_PUBLIC_APP_URL}/${locale}${route === "/" ? "" : route}`,
        lastModified: new Date(),
      })),
    ),
    ...legalRoutes.map((route) => ({
      url: `${env.NEXT_PUBLIC_APP_URL}${route}`,
      lastModified: new Date(),
    })),
  ];
}
