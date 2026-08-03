import {
  getAuthService,
  requireCurrentSession,
  satisfiesMfaPolicy,
} from "../../../../lib/auth";
import { getContentRepository } from "../../../../lib/content-store";
import { assertLocale } from "../../../../lib/locale";
import { getSecurityService } from "../../../../lib/security";
import {
  getActiveTenantContext,
  getTenantService,
} from "../../../../lib/tenant";
import { readMfaSetup } from "./actions";
import { NotificationSettings } from "./notification-settings";
import { ProfileSettings } from "./profile-settings";
import {
  AccountDeletionSettings,
  AccountSettings,
  MfaStepUpSettings,
  PrivacySettings,
  SecurityActivitySettings,
  SecuritySettings,
  SessionSettings,
  SettingsFeedback,
} from "./settings-sections";

type SettingsSearchParams = {
  error?: string;
  status?: string;
};

export default async function SettingsPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<SettingsSearchParams>;
}) {
  const { locale } = await routeParams;
  const resolvedLocale = assertLocale(locale);
  const params = (await searchParams) ?? {};
  const session = await requireCurrentSession();
  const auth = getAuthService();
  const [memberships, mfaFactors, passkeys, mfaSetup] = await Promise.all([
    getTenantService().listMembershipsForUser(session.user.id),
    auth.listMfaFactors(session.user.id),
    auth.listPasskeys(session.user.id),
    readMfaSetup(),
  ]);
  const needsMfaStepUp =
    !satisfiesMfaPolicy(session, session.user.role) ||
    memberships.some(
      (membership) => !satisfiesMfaPolicy(session, membership.role),
    );
  const hasEnabledMfa = mfaFactors.some((factor) => factor.enabledAt);
  const hasPasskey = passkeys.some((passkey) => passkey.userVerified);

  if (needsMfaStepUp) {
    return (
      <MfaStepUpSettings
        error={params.error}
        hasEnabledMfa={hasEnabledMfa}
        hasPasskey={hasPasskey}
        locale={resolvedLocale}
        setup={mfaSetup}
        status={params.status}
      />
    );
  }

  const repository = await getContentRepository();
  const availableLocales = repository.listEnabledLocales();
  const security = getSecurityService();
  const [
    tenantContext,
    sessions,
    auditEvents,
    legalAcceptances,
    privacyRequests,
  ] = await Promise.all([
    getActiveTenantContext("organization.read", {
      allowMfaEnrollment: true,
    }),
    auth.listSessions(session.user.id),
    auth.listAuditEvents(session.user.id),
    security.listLegalAcceptances(session.user.id),
    security.listPrivacyRequests(session.user.id),
  ]);

  return (
    <div className="grid gap-6">
      <SettingsFeedback error={params.error} status={params.status} />
      <ProfileSettings
        availableLocales={availableLocales}
        avatarUrl={session.user.avatarUrl}
        displayName={session.user.displayName}
        locale={resolvedLocale}
        userLocale={session.user.locale}
      />
      <NotificationSettings
        locale={resolvedLocale}
        tenantId={tenantContext.organization.id}
        userId={tenantContext.effectiveUser.id}
      />
      <PrivacySettings
        legalAcceptances={legalAcceptances}
        locale={resolvedLocale}
        privacyRequests={privacyRequests}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <AccountSettings email={session.user.email} locale={resolvedLocale} />
        <SecuritySettings
          hasEnabledMfa={hasEnabledMfa}
          locale={resolvedLocale}
          passkeys={passkeys}
          setup={mfaSetup}
        />
      </div>
      <SessionSettings locale={resolvedLocale} sessions={sessions} />
      <SecurityActivitySettings events={auditEvents} locale={resolvedLocale} />
      <AccountDeletionSettings locale={resolvedLocale} />
    </div>
  );
}
