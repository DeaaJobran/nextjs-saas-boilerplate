"use client";

import { type Locale, localeLabels, locales } from "@nextjs-saas/localization";
import { Button } from "@nextjs-saas/ui";
import { LanguagesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "../i18n/navigation";

export function LocaleSwitcher() {
  const currentLocale = useLocale() as Locale;
  const t = useTranslations("LocaleSwitcher");
  const pathname = usePathname();
  const nextLocale =
    locales.find((locale) => locale !== currentLocale) ?? currentLocale;

  return (
    <Button
      aria-label={t("switch", { locale: localeLabels[nextLocale] })}
      asChild
      variant="outline"
    >
      <Link href={pathname} locale={nextLocale}>
        <LanguagesIcon aria-hidden="true" className="size-4" />
        {localeLabels[nextLocale]}
      </Link>
    </Button>
  );
}
