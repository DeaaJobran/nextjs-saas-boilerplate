import { authRoleConfig } from "@nextjs-saas/auth";
import { getTranslations } from "next-intl/server";

import { OrganizationSwitcher } from "../../../../components/organization-switcher";
import { DashboardShell } from "../../../../components/shells";
import {
  requireCurrentSession,
  satisfiesMfaPolicy,
} from "../../../../lib/auth";
import { assertLocale } from "../../../../lib/locale";
import {
  getActiveTenantContext,
  getTenantService,
} from "../../../../lib/tenant";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const resolvedLocale = assertLocale(locale);
  const [t, shellT, session] = await Promise.all([
    getTranslations({
      locale: resolvedLocale,
      namespace: "Navigation",
    }),
    getTranslations({
      locale: resolvedLocale,
      namespace: "Shell",
    }),
    requireCurrentSession(),
  ]);
  const memberships = await getTenantService().listMembershipsForUser(
    session.user.id,
  );
  const needsMfaStepUp =
    !satisfiesMfaPolicy(session, session.user.role) ||
    memberships.some(
      (membership) => !satisfiesMfaPolicy(session, membership.role),
    );
  const tenantContext = needsMfaStepUp
    ? undefined
    : await getActiveTenantContext("organization.read", {
        allowMfaEnrollment: true,
      });

  return (
    <DashboardShell
      impersonationNotice={
        tenantContext?.impersonation
          ? shellT("impersonationNotice", {
              actor: tenantContext.authUser.email,
              subject: tenantContext.effectiveUser.email,
            })
          : undefined
      }
      locale={resolvedLocale}
      showAdmin={authRoleConfig.privilegedRoles.some(
        (role) => role === session.user.role,
      )}
      tenantControls={
        tenantContext ? (
          <OrganizationSwitcher
            activeOrganization={tenantContext.organization}
            impersonationSessionId={tenantContext.impersonation?.id}
            locale={resolvedLocale}
            organizations={tenantContext.organizations}
          />
        ) : undefined
      }
      title={t("settings")}
    >
      {children}
    </DashboardShell>
  );
}
