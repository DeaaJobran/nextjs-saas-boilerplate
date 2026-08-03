import { appRoutes } from "@nextjs-saas/config/app";
import { ErrorState } from "@nextjs-saas/ui";
import { getLocale, getTranslations } from "next-intl/server";

import { getContentRepository } from "../../lib/content-store";
import { assertLocale } from "../../lib/locale";
import {
  createLocalizedPath,
  getPublicRecoveryRoute,
} from "../../lib/seo-routes";

export default async function NotFound() {
  const [localeValue, t, repository] = await Promise.all([
    getLocale(),
    getTranslations("Errors"),
    getContentRepository(),
  ]);
  const locale = assertLocale(localeValue);
  const recoveryLocale = repository.isLocaleEnabled(locale)
    ? locale
    : repository.getLocalizationSettings().defaultLocale;
  const recoveryRoute = getPublicRecoveryRoute(
    repository.listPages(recoveryLocale),
    recoveryLocale,
  );

  return (
    <main
      className="flex min-h-dvh items-center justify-center p-6"
      id="main-content"
      tabIndex={-1}
    >
      <ErrorState
        action={
          recoveryRoute
            ? {
                href: createLocalizedPath(recoveryLocale, recoveryRoute),
                label:
                  recoveryRoute === appRoutes.marketing
                    ? t("returnHome")
                    : t("continueBrowsing"),
              }
            : undefined
        }
        description={t("notFoundDescription")}
        title={t("notFoundTitle")}
      />
    </main>
  );
}
