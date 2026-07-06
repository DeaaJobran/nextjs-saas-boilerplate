"use client";

import { type Locale, localeLabels, locales } from "@nextjs-saas/localization";
import { Button } from "@nextjs-saas/ui";
import { LanguagesIcon } from "lucide-react";
import { useLocale } from "next-intl";

import { useRouter } from "../i18n/navigation";

export function LocaleSwitcher() {
  const currentLocale = useLocale() as Locale;
  const router = useRouter();
  const nextLocale =
    locales.find((locale) => locale !== currentLocale) ?? currentLocale;

  return (
    <Button
      aria-label={`Switch language to ${localeLabels[nextLocale]}`}
      onClick={() => {
        const pathname =
          window.location.pathname.replace(/^\/(en|ar)(?=\/|$)/, "") || "/";

        router.replace(pathname, { locale: nextLocale });
      }}
      type="button"
      variant="outline"
    >
      <LanguagesIcon aria-hidden="true" className="size-4" />
      {localeLabels[nextLocale]}
    </Button>
  );
}
