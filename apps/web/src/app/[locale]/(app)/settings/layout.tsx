import { getTranslations } from "next-intl/server";

import { DashboardShell } from "../../../../components/shells";
import { assertLocale } from "../../../../lib/locale";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const resolvedLocale = assertLocale(locale);
  const t = await getTranslations({
    locale: resolvedLocale,
    namespace: "Navigation",
  });

  return (
    <DashboardShell locale={resolvedLocale} title={t("settings")}>
      {children}
    </DashboardShell>
  );
}
