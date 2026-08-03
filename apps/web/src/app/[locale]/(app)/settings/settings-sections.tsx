import type { AuthSession } from "@nextjs-saas/auth";
import { appRoutes } from "@nextjs-saas/config/app";
import type { Locale } from "@nextjs-saas/localization";
import type { LegalAcceptance, PrivacyRequest } from "@nextjs-saas/security";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  TextInput,
} from "@nextjs-saas/ui";
import { getTranslations } from "next-intl/server";

import {
  PasskeyRegistrationControl,
  PasskeyStepUpControl,
} from "@/components/passkey-controls";

import { formatLocaleDateTime } from "../../../../lib/locale-formatters";
import {
  deleteAccountAction,
  enableMfaAction,
  requestAccountPasswordResetAction,
  requestEmailChangeAction,
  revokeSessionAction,
  startMfaEnrollmentAction,
  verifyMfaSessionAction,
} from "./actions";

type MfaSetup = {
  factorId: string;
  secret: string;
};

type PasskeySummary = {
  deviceType: string;
  id: string;
  label: string;
};

export async function SettingsFeedback({
  error,
  status,
}: {
  error?: string;
  status?: string;
}) {
  const t = await getTranslations("SettingsPage");
  let errorMessage: string | undefined;
  let statusMessage: string | undefined;

  switch (error) {
    case "invalid_mfa_code":
      errorMessage = t("errors.invalidMfaCode");
      break;
    case "invalid_password":
      errorMessage = t("errors.invalidPassword");
      break;
    case "mfa_required":
      errorMessage = t("errors.mfaRequired");
      break;
    case "rate_limited":
      errorMessage = t("errors.rateLimited");
      break;
    case undefined:
      break;
    default:
      errorMessage = t("errors.generic");
  }

  switch (status) {
    case "email-change-sent":
      statusMessage = t("status.emailChangeSent");
      break;
    case "email-change-verified":
      statusMessage = t("status.emailChangeVerified");
      break;
    case "invalid-locale":
      statusMessage = t("status.invalidLocale");
      break;
    case "mfa-enabled":
      statusMessage = t("status.mfaEnabled");
      break;
    case "mfa-required":
      statusMessage = t("status.mfaRequired");
      break;
    case "mfa-verified":
      statusMessage = t("status.mfaVerified");
      break;
    case "notification-preferences-updated":
      statusMessage = t("status.notificationPreferencesUpdated");
      break;
    case "notification-read":
      statusMessage = t("status.notificationRead");
      break;
    case "password-reset-sent":
      statusMessage = t("status.passwordResetSent");
      break;
    case "profile-updated":
      statusMessage = t("status.profileUpdated");
      break;
    case "session-revoked":
      statusMessage = t("status.sessionRevoked");
      break;
    case undefined:
      break;
    default:
      statusMessage = t("status.generic");
  }

  return (
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
}

async function TotpEnrollment({
  bordered = false,
  locale,
  setup,
}: {
  bordered?: boolean;
  locale: Locale;
  setup?: MfaSetup;
}) {
  const t = await getTranslations("SettingsPage");

  if (!setup) {
    return (
      <form action={startMfaEnrollmentAction}>
        <input name="locale" type="hidden" value={locale} />
        <Button type="submit" variant="outline">
          {t("startMfaSetup")}
        </Button>
      </form>
    );
  }

  return (
    <form
      action={enableMfaAction}
      className={bordered ? "grid gap-3 rounded-md border p-3" : "grid gap-3"}
    >
      <input name="locale" type="hidden" value={locale} />
      <input name="factorId" type="hidden" value={setup.factorId} />
      <p className="text-muted-foreground text-sm">
        {t("mfaSetupDescription")}
      </p>
      <code className="bg-muted block overflow-x-auto rounded-md p-3 text-sm">
        {setup.secret}
      </code>
      <Field label={t("mfaCode")}>
        <TextInput inputMode="numeric" name="code" required />
      </Field>
      <Button type="submit">{t("enableMfa")}</Button>
    </form>
  );
}

export async function MfaStepUpSettings({
  error,
  hasEnabledMfa,
  hasPasskey,
  locale,
  setup,
  status,
}: {
  error?: string;
  hasEnabledMfa: boolean;
  hasPasskey: boolean;
  locale: Locale;
  setup?: MfaSetup;
  status?: string;
}) {
  const t = await getTranslations("SettingsPage");

  return (
    <div className="grid gap-6">
      <SettingsFeedback error={error} status={status} />
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
              <input name="locale" type="hidden" value={locale} />
              <Field label={t("mfaStepUpCode")}>
                <TextInput autoComplete="one-time-code" name="code" required />
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
                redirectTo={`/${locale}${appRoutes.settings}`}
              />
            </div>
          ) : null}
          {!hasEnabledMfa && !hasPasskey ? (
            <TotpEnrollment locale={locale} setup={setup} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export async function PrivacySettings({
  legalAcceptances,
  locale,
  privacyRequests,
}: {
  legalAcceptances: LegalAcceptance[];
  locale: Locale;
  privacyRequests: PrivacyRequest[];
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

  return (
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
                  legalDocumentLabels[item.documentSlug] ?? t("privacyUnknown"),
                header: t("privacyTable.document"),
                key: "document",
              },
              {
                cell: (item) => item.version,
                header: t("privacyTable.version"),
                key: "version",
              },
              {
                cell: (item) => formatLocaleDateTime(locale, item.acceptedAt),
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
                cell: (item) => formatLocaleDateTime(locale, item.createdAt),
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
  );
}

export async function AccountSettings({
  email,
  locale,
}: {
  email: string;
  locale: Locale;
}) {
  const t = await getTranslations("SettingsPage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("accountTitle")}</CardTitle>
        <p className="text-muted-foreground text-sm">
          {t("accountDescription")}
        </p>
      </CardHeader>
      <CardContent className="grid gap-5">
        <form action={requestEmailChangeAction} className="grid gap-4">
          <input name="locale" type="hidden" value={locale} />
          <Field label={t("email")}>
            <TextInput
              autoComplete="email"
              defaultValue={email}
              name="email"
              type="email"
            />
          </Field>
          <Button type="submit">{t("requestEmailChange")}</Button>
        </form>
        <form action={requestAccountPasswordResetAction}>
          <input name="locale" type="hidden" value={locale} />
          <Button type="submit" variant="outline">
            {t("sendPasswordReset")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

async function PasskeySettings({ passkeys }: { passkeys: PasskeySummary[] }) {
  const t = await getTranslations("SettingsPage");

  return (
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
  );
}

export async function SecuritySettings({
  hasEnabledMfa,
  locale,
  passkeys,
  setup,
}: {
  hasEnabledMfa: boolean;
  locale: Locale;
  passkeys: PasskeySummary[];
  setup?: MfaSetup;
}) {
  const t = await getTranslations("SettingsPage");

  return (
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
          <TotpEnrollment bordered locale={locale} setup={setup} />
        </div>
        <PasskeySettings passkeys={passkeys} />
      </CardContent>
    </Card>
  );
}

export async function SessionSettings({
  locale,
  sessions,
}: {
  locale: Locale;
  sessions: AuthSession[];
}) {
  const t = await getTranslations("SettingsPage");

  return (
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
              cell: (item) => formatLocaleDateTime(locale, item.lastSeenAt),
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
                  <input name="locale" type="hidden" value={locale} />
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
  );
}

export async function AccountDeletionSettings({ locale }: { locale: Locale }) {
  const t = await getTranslations("SettingsPage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("deleteTitle")}</CardTitle>
        <p className="text-muted-foreground text-sm">
          {t("deleteDescription")}
        </p>
      </CardHeader>
      <CardContent>
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="destructive">
              {t("deleteAccount")}
            </Button>
          </DialogTrigger>
          <DialogContent closeLabel={t("closeDialog")}>
            <DialogHeader>
              <DialogTitle>{t("confirmDelete")}</DialogTitle>
              <DialogDescription>
                {t("confirmDeleteDescription")}
              </DialogDescription>
            </DialogHeader>
            <form action={deleteAccountAction} className="grid gap-4">
              <input name="locale" type="hidden" value={locale} />
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
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    {t("cancel")}
                  </Button>
                </DialogClose>
                <Button type="submit" variant="destructive">
                  {t("confirmDelete")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
