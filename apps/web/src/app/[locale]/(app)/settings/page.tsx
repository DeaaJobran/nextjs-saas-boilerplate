import { isLocale, localeLabels } from "@nextjs-saas/localization";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Field,
  SelectInput,
  TextInput,
} from "@nextjs-saas/ui";
import { getTranslations } from "next-intl/server";

import { PasskeyRegistrationControl } from "@/components/passkey-controls";

import { getAuthService, requireCurrentSession } from "../../../../lib/auth";
import { getContentRepository } from "../../../../lib/content-store";
import { assertLocale } from "../../../../lib/locale";
import { formatLocaleDateTime } from "../../../../lib/locale-formatters";
import {
  deleteAccountAction,
  enableMfaAction,
  readMfaSetup,
  requestAccountPasswordResetAction,
  requestEmailChangeAction,
  revokeSessionAction,
  startMfaEnrollmentAction,
  updateProfileAction,
} from "./actions";

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
  const { locale } = await routeParams;
  const resolvedLocale = assertLocale(locale);
  const params = (await searchParams) ?? {};
  const session = await requireCurrentSession();
  const repository = await getContentRepository();
  const availableLocales = repository.listEnabledLocales();
  const preferredLocale =
    isLocale(session.user.locale) &&
    availableLocales.includes(session.user.locale)
      ? session.user.locale
      : resolvedLocale;
  const auth = getAuthService();
  const [sessions, mfaFactors, passkeys, mfaSetup] = await Promise.all([
    auth.listSessions(session.user.id),
    auth.listMfaFactors(session.user.id),
    auth.listPasskeys(session.user.id),
    readMfaSetup(),
  ]);

  return (
    <div className="grid gap-6">
      {params.status ? (
        <p
          className="text-muted-foreground bg-background rounded-md border p-3 text-sm"
          role="status"
        >
          {params.status === "profile-updated"
            ? t("status.profileUpdated")
            : params.status === "email-change-sent"
              ? t("status.emailChangeSent")
              : params.status === "email-change-verified"
                ? t("status.emailChangeVerified")
                : params.status === "password-reset-sent"
                  ? t("status.passwordResetSent")
                  : params.status === "mfa-enabled"
                    ? t("status.mfaEnabled")
                    : params.status === "session-revoked"
                      ? t("status.sessionRevoked")
                      : params.status === "invalid-locale"
                        ? t("status.invalidLocale")
                        : t("status.generic")}
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{t("profileTitle")}</CardTitle>
          <p className="text-muted-foreground text-sm">
            {t("profileDescription")}
          </p>
        </CardHeader>
        <CardContent>
          <form
            action={updateProfileAction}
            className="grid gap-4 md:grid-cols-2"
          >
            <input name="locale" type="hidden" value={resolvedLocale} />
            <Field label={t("displayName")}>
              <TextInput
                autoComplete="name"
                defaultValue={session.user.displayName}
                name="displayName"
              />
            </Field>
            <Field label={t("avatarUrl")}>
              <TextInput
                defaultValue={session.user.avatarUrl}
                name="avatarUrl"
                type="url"
              />
            </Field>
            <Field
              description={t("preferredLocaleDescription")}
              label={t("preferredLocale")}
            >
              <SelectInput
                defaultValue={preferredLocale}
                name="preferredLocale"
              >
                {availableLocales.map((availableLocale) => (
                  <option key={availableLocale} value={availableLocale}>
                    {localeLabels[availableLocale]}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <div className="md:col-span-2">
              <Button type="submit">{t("saveProfile")}</Button>
            </div>
          </form>
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
                <Badge
                  variant={
                    mfaFactors.some((factor) => factor.enabledAt)
                      ? "default"
                      : "outline"
                  }
                >
                  {mfaFactors.some((factor) => factor.enabledAt)
                    ? t("enabled")
                    : t("notEnabled")}
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
