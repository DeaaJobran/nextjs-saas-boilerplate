import { appRoutes } from "@nextjs-saas/config/app";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Field,
  TextInput,
} from "@nextjs-saas/ui";
import { getTranslations } from "next-intl/server";

import {
  PasskeyRegistrationControl,
  PasskeyStepUpControl,
} from "@/components/passkey-controls";

import {
  getAuthService,
  requireCurrentSession,
  satisfiesMfaPolicy,
} from "../../../../lib/auth";
import { getContentRepository } from "../../../../lib/content-store";
import { assertLocale } from "../../../../lib/locale";
import { formatLocaleDateTime } from "../../../../lib/locale-formatters";
import { getSecurityService } from "../../../../lib/security";
import {
  getActiveTenantContext,
  getTenantService,
} from "../../../../lib/tenant";
import {
  deleteAccountAction,
  enableMfaAction,
  readMfaSetup,
  requestAccountPasswordResetAction,
  requestEmailChangeAction,
  revokeSessionAction,
  startMfaEnrollmentAction,
  verifyMfaSessionAction,
} from "./actions";
import { NotificationSettings } from "./notification-settings";
import { ProfileSettings } from "./profile-settings";

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
  const t = await getTranslations("SettingsPage");
  const legalDocumentLabels: Record<string, string> = {
    privacy: t("legalDocuments.privacy"),
    terms: t("legalDocuments.terms"),
  };
  const privacyRequestLabels: Record<string, string> = {
    account_deletion: t("privacyRequestTypes.accountDeletion"),
    data_export: t("privacyRequestTypes.dataExport"),
  };
  const privacyStatusLabels: Record<string, string> = {
    completed: t("privacyStatuses.completed"),
    failed: t("privacyStatuses.failed"),
    processing: t("privacyStatuses.processing"),
    requested: t("privacyStatuses.requested"),
  };
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
  const errorMessage = params.error
    ? params.error === "rate_limited"
      ? t("errors.rateLimited")
      : params.error === "invalid_password"
        ? t("errors.invalidPassword")
        : params.error === "invalid_mfa_code"
          ? t("errors.invalidMfaCode")
          : params.error === "mfa_required"
            ? t("errors.mfaRequired")
            : t("errors.generic")
    : undefined;
  const statusMessage = params.status
    ? params.status === "profile-updated"
      ? t("status.profileUpdated")
      : params.status === "email-change-sent"
        ? t("status.emailChangeSent")
        : params.status === "email-change-verified"
          ? t("status.emailChangeVerified")
          : params.status === "password-reset-sent"
            ? t("status.passwordResetSent")
            : params.status === "mfa-enabled"
              ? t("status.mfaEnabled")
              : params.status === "mfa-verified"
                ? t("status.mfaVerified")
                : params.status === "mfa-required"
                  ? t("status.mfaRequired")
                  : params.status === "session-revoked"
                    ? t("status.sessionRevoked")
                    : params.status === "invalid-locale"
                      ? t("status.invalidLocale")
                      : params.status === "notification-preferences-updated"
                        ? t("status.notificationPreferencesUpdated")
                        : params.status === "notification-read"
                          ? t("status.notificationRead")
                          : t("status.generic")
    : undefined;
  const feedback = (
    <>
      {errorMessage ? (
        <p
          className="text-destructive rounded-md border p-3 text-sm"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
      {statusMessage ? (
        <p
          className="text-muted-foreground bg-background rounded-md border p-3 text-sm"
          role="status"
        >
          {statusMessage}
        </p>
      ) : null}
    </>
  );

  if (needsMfaStepUp) {
    return (
      <div className="grid gap-6">
        {feedback}
        <Card>
          <CardHeader>
            <CardTitle>{t("mfaTitle")}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {t("mfaStepUpDescription")}
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:max-w-md">
            {hasEnabledMfa ? (
              <form action={verifyMfaSessionAction} className="grid gap-3">
                <input name="locale" type="hidden" value={resolvedLocale} />
                <Field label={t("mfaStepUpCode")}>
                  <TextInput
                    autoComplete="one-time-code"
                    name="code"
                    required
                  />
                </Field>
                <Button type="submit">{t("verifyMfaSession")}</Button>
              </form>
            ) : null}
            {hasPasskey ? (
              <div className={hasEnabledMfa ? "border-t pt-4" : undefined}>
                <PasskeyStepUpControl
                  labels={{
                    error: t("passkeyStepUpError"),
                    verify: t("passkeyStepUp"),
                  }}
                  redirectTo={`/${resolvedLocale}${appRoutes.settings}`}
                />
              </div>
            ) : null}
            {!hasEnabledMfa && !hasPasskey ? (
              mfaSetup ? (
                <form action={enableMfaAction} className="grid gap-3">
                  <input name="locale" type="hidden" value={resolvedLocale} />
                  <input
                    name="factorId"
                    type="hidden"
                    value={mfaSetup.factorId}
                  />
                  <p className="text-muted-foreground text-sm">
                    {t("mfaSetupDescription")}
                  </p>
                  <code className="bg-muted block overflow-x-auto rounded-md p-3 text-sm">
                    {mfaSetup.secret}
                  </code>
                  <Field label={t("mfaCode")}>
                    <TextInput inputMode="numeric" name="code" required />
                  </Field>
                  <Button type="submit">{t("enableMfa")}</Button>
                </form>
              ) : (
                <form action={startMfaEnrollmentAction}>
                  <input name="locale" type="hidden" value={resolvedLocale} />
                  <Button type="submit" variant="outline">
                    {t("startMfaSetup")}
                  </Button>
                </form>
              )
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  const repository = await getContentRepository();
  const availableLocales = repository.listEnabledLocales();
  const security = getSecurityService();
  const [tenantContext, sessions, legalAcceptances, privacyRequests] =
    await Promise.all([
      getActiveTenantContext("organization.read", {
        allowMfaEnrollment: true,
      }),
      auth.listSessions(session.user.id),
      security.listLegalAcceptances(session.user.id),
      security.listPrivacyRequests(session.user.id),
    ]);

  return (
    <div className="grid gap-6">
      {feedback}
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
      <Card>
        <CardHeader>
          <CardTitle>{t("privacyTitle")}</CardTitle>
          <p className="text-muted-foreground text-sm">
            {t("privacyDescription")}
          </p>
        </CardHeader>
        <CardContent className="grid gap-6">
          <form action="/api/account/export" method="post">
            <Button type="submit" variant="outline">
              {t("downloadData")}
            </Button>
          </form>
          <div className="grid min-w-0 gap-3">
            <h3 className="font-medium">{t("legalAcceptances")}</h3>
            <DataTable
              columns={[
                {
                  cell: (item) =>
                    legalDocumentLabels[item.documentSlug] ??
                    t("privacyUnknown"),
                  header: t("privacyTable.document"),
                  key: "document",
                },
                {
                  cell: (item) => item.version,
                  header: t("privacyTable.version"),
                  key: "version",
                },
                {
                  cell: (item) =>
                    formatLocaleDateTime(resolvedLocale, item.acceptedAt),
                  header: t("privacyTable.date"),
                  key: "date",
                },
              ]}
              data={legalAcceptances}
              emptyLabel={t("emptyLegalAcceptances")}
            />
          </div>
          <div className="grid min-w-0 gap-3">
            <h3 className="font-medium">{t("privacyRequests")}</h3>
            <DataTable
              columns={[
                {
                  cell: (item) =>
                    privacyRequestLabels[item.type] ?? t("privacyUnknown"),
                  header: t("privacyTable.request"),
                  key: "request",
                },
                {
                  cell: (item) =>
                    privacyStatusLabels[item.status] ?? t("privacyUnknown"),
                  header: t("privacyTable.status"),
                  key: "status",
                },
                {
                  cell: (item) =>
                    formatLocaleDateTime(resolvedLocale, item.createdAt),
                  header: t("privacyTable.date"),
                  key: "date",
                },
              ]}
              data={privacyRequests}
              emptyLabel={t("emptyPrivacyRequests")}
            />
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("accountTitle")}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {t("accountDescription")}
            </p>
          </CardHeader>
          <CardContent className="grid gap-5">
            <form action={requestEmailChangeAction} className="grid gap-4">
              <input name="locale" type="hidden" value={resolvedLocale} />
              <Field label={t("email")}>
                <TextInput
                  autoComplete="email"
                  defaultValue={session.user.email}
                  name="email"
                  type="email"
                />
              </Field>
              <Button type="submit">{t("requestEmailChange")}</Button>
            </form>
            <form action={requestAccountPasswordResetAction}>
              <input name="locale" type="hidden" value={resolvedLocale} />
              <Button type="submit" variant="outline">
                {t("sendPasswordReset")}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("securityTitle")}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {t("securityDescription")}
            </p>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{t("mfaTitle")}</p>
                  <p className="text-muted-foreground text-sm">
                    {t("mfaDescription")}
                  </p>
                </div>
                <Badge variant={hasEnabledMfa ? "default" : "outline"}>
                  {hasEnabledMfa ? t("enabled") : t("notEnabled")}
                </Badge>
              </div>
              {mfaSetup ? (
                <form
                  action={enableMfaAction}
                  className="grid gap-3 rounded-md border p-3"
                >
                  <input name="locale" type="hidden" value={resolvedLocale} />
                  <input
                    name="factorId"
                    type="hidden"
                    value={mfaSetup.factorId}
                  />
                  <p className="text-muted-foreground text-sm">
                    {t("mfaSetupDescription")}
                  </p>
                  <code className="bg-muted block overflow-x-auto rounded-md p-3 text-sm">
                    {mfaSetup.secret}
                  </code>
                  <Field label={t("mfaCode")}>
                    <TextInput inputMode="numeric" name="code" required />
                  </Field>
                  <Button type="submit">{t("enableMfa")}</Button>
                </form>
              ) : (
                <form action={startMfaEnrollmentAction}>
                  <input name="locale" type="hidden" value={resolvedLocale} />
                  <Button type="submit" variant="outline">
                    {t("startMfaSetup")}
                  </Button>
                </form>
              )}
            </div>
            <div className="grid gap-3">
              <p className="font-medium">{t("passkeysTitle")}</p>
              <p className="text-muted-foreground text-sm">
                {t("passkeysDescription")}
              </p>
              <DataTable
                columns={[
                  {
                    cell: (passkey) => passkey.label,
                    header: t("table.label"),
                    key: "label",
                  },
                  {
                    cell: (passkey) => passkey.deviceType,
                    header: t("table.deviceType"),
                    key: "deviceType",
                  },
                ]}
                data={passkeys}
                emptyLabel={t("emptyPasskeys")}
              />
              <PasskeyRegistrationControl
                labels={{
                  error: t("passkeyRegisterError"),
                  label: t("passkeyLabel"),
                  register: t("registerPasskey"),
                  success: t("passkeyRegistered"),
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("sessionsTitle")}</CardTitle>
          <p className="text-muted-foreground text-sm">
            {t("sessionsDescription")}
          </p>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                cell: (item) => item.deviceName,
                header: t("table.device"),
                key: "device",
              },
              {
                cell: (item) =>
                  formatLocaleDateTime(resolvedLocale, item.lastSeenAt),
                header: t("table.lastSeen"),
                key: "lastSeen",
              },
              {
                cell: (item) => (item.revokedAt ? t("revoked") : t("active")),
                header: t("table.status"),
                key: "status",
              },
              {
                cell: (item) => (
                  <form action={revokeSessionAction}>
                    <input name="locale" type="hidden" value={resolvedLocale} />
                    <input name="sessionId" type="hidden" value={item.id} />
                    <Button
                      disabled={Boolean(item.revokedAt)}
                      size="sm"
                      type="submit"
                      variant="outline"
                    >
                      {t("revoke")}
                    </Button>
                  </form>
                ),
                header: t("table.action"),
                key: "action",
              },
            ]}
            data={sessions}
            emptyLabel={t("emptySessions")}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("deleteTitle")}</CardTitle>
          <p className="text-muted-foreground text-sm">
            {t("deleteDescription")}
          </p>
        </CardHeader>
        <CardContent>
          <form action={deleteAccountAction} className="grid gap-4 md:max-w-md">
            <input name="locale" type="hidden" value={resolvedLocale} />
            <Field
              description={t("confirmPasswordDescription")}
              label={t("confirmPassword")}
            >
              <TextInput
                autoComplete="current-password"
                name="password"
                type="password"
              />
            </Field>
            <Button type="submit" variant="destructive">
              {t("deleteAccount")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
