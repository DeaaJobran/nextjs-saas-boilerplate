import { appRoutes } from "@nextjs-saas/config/app";
import type { Locale } from "@nextjs-saas/localization";

export type ManagedRoutesByLocale = Partial<Record<Locale, readonly string[]>>;

export function resolveLocaleSwitchTarget({
  availableLocales,
  currentLocale,
  managedRoutesByLocale,
  pathname,
}: {
  availableLocales: Locale[];
  currentLocale: Locale;
  managedRoutesByLocale?: ManagedRoutesByLocale;
  pathname: string;
}) {
  const isManagedPath = Object.values(managedRoutesByLocale ?? {}).some(
    (routes) => routes?.includes(pathname),
  );

  for (const locale of availableLocales) {
    if (locale === currentLocale) {
      continue;
    }

    if (!isManagedPath) {
      return { locale, pathname };
    }

    const localeRoutes = managedRoutesByLocale?.[locale] ?? [];

    if (localeRoutes.includes(pathname)) {
      return { locale, pathname };
    }

    if (localeRoutes.includes(appRoutes.marketing)) {
      return { locale, pathname: appRoutes.marketing };
    }
  }
}
