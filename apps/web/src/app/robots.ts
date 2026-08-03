import { env } from "@nextjs-saas/config/env";
import type { MetadataRoute } from "next";

import { getContentRepository } from "../lib/content-store";
import { createRobotsPolicy } from "../lib/seo-routes";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const repository = await getContentRepository();

  return createRobotsPolicy(
    env.NEXT_PUBLIC_APP_URL,
    repository.listEnabledLocales(),
  );
}
