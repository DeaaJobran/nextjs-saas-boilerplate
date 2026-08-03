"use client";

import { type Locale, localeLabels } from "@nextjs-saas/localization";
import { Button } from "@nextjs-saas/ui";
import { LanguagesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "../i18n/navigation";
import {
  type ManagedRoutesByLocale,
  resolveLocaleSwitchTarget,
} from "../lib/locale-switch-target";

export function LocaleSwitcher({
  availableLocales,
  managedRoutesByLocale,
}: {
  availableLocales: Locale[];
  managedRoutesByLocale?: ManagedRoutesByLocale;
}) {
  const currentLocale = useLocale() as Locale;
  const t = useTranslations("LocaleSwitcher");
  const pathname = usePathname();
  const target = resolveLocaleSwitchTarget({
    availableLocales,
    currentLocale,
    managedRoutesByLocale,
    pathname,
  });

  if (!target) {
    return null;
  }

  return (
    <Button
      aria-label={t("switch", { locale: localeLabels[target.locale] })}
      asChild
      className="px-3 sm:px-4"
      variant="outline"
    >
      <Link href={target.pathname} locale={target.locale}>
        <LanguagesIcon aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">{localeLabels[target.locale]}</span>
      </Link>
    </Button>
  );
}
