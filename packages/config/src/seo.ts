import type { Locale } from "@nextjs-saas/localization";
import type { Metadata } from "next";

import { appConfig } from "./app";
import type { PageSeo } from "./content";
import { env } from "./env";

const openGraphLocales = {
  ar: "ar",
  en: "en_US",
} satisfies Record<Locale, string>;

export function createPageMetadata(
  seo: PageSeo,
  options: {
    locale?: Locale;
  } = {},
): Metadata {
  const title = seo.title.includes(appConfig.name)
    ? seo.title
    : `${seo.title} | ${appConfig.name}`;

  return {
    metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
    title: {
      absolute: title,
    },
    description: seo.description,
    openGraph: {
      title,
      description: seo.description,
      locale: options.locale ? openGraphLocales[options.locale] : undefined,
      siteName: appConfig.name,
      images: seo.ogImage ? [seo.ogImage] : undefined,
      type: "website",
    },
  };
}

export function createSoftwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: appConfig.name,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    description: appConfig.description,
    url: env.NEXT_PUBLIC_APP_URL,
    codeRepository: appConfig.repositoryUrl,
    license: "https://opensource.org/license/mit",
  } as const;
}

export function serializeJsonForHtml(value: unknown) {
  return JSON.stringify(value).replace(/[<>&]/g, (character) => {
    switch (character) {
      case "<":
        return "\\u003c";
      case ">":
        return "\\u003e";
      case "&":
        return "\\u0026";
      default:
        return character;
    }
  });
}
