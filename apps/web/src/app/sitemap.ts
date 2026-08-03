import { env } from "@nextjs-saas/config/env";
import type { MetadataRoute } from "next";

import { getContentRepository } from "../lib/content-store";
import { createPublicSitemap } from "../lib/seo-routes";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const repository = await getContentRepository();

  return createPublicSitemap({
    baseUrl: env.NEXT_PUBLIC_APP_URL,
    enabledLocales: repository.listEnabledLocales(),
    pages: repository.listAllPages(),
  });
}
