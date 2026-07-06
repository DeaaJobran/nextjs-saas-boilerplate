import { getTranslations } from "next-intl/server";

import { OrganizationSwitcher } from "../../../../components/organization-switcher";
import { DashboardShell } from "../../../../components/shells";
import { assertLocale } from "../../../../lib/locale";
import { getActiveTenantContext } from "../../../../lib/tenant";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const resolvedLocale = assertLocale(locale);
  const [t, shellT, tenantContext] = await Promise.all([
    getTranslations({
      locale: resolvedLocale,
      namespace: "Navigation",
    }),
    getTranslations({
      locale: resolvedLocale,
      namespace: "Shell",
    }),
    getActiveTenantContext("organization.read"),
  ]);

  return (
    <DashboardShell
      impersonationNotice={
        tenantContext.impersonation
          ? shellT("impersonationNotice", {
              actor: tenantContext.authUser.email,
              subject: tenantContext.effectiveUser.email,
            })
          : undefined
      }
      locale={resolvedLocale}
      tenantControls={
        <OrganizationSwitcher
          activeOrganization={tenantContext.organization}
          impersonationSessionId={tenantContext.impersonation?.id}
          locale={resolvedLocale}
          organizations={tenantContext.organizations}
        />
      }
      title={t("settings")}
    >
      {children}
    </DashboardShell>
  );
}
