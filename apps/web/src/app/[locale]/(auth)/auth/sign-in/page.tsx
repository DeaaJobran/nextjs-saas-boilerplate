import { appConfig, appRoutes } from "@nextjs-saas/config/app";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  TextInput,
} from "@nextjs-saas/ui";
import { getTranslations } from "next-intl/server";

import { PasskeyAuthenticationControl } from "@/components/passkey-controls";
import { Link } from "@/i18n/navigation";

import { requestMagicLinkAction, signInAction } from "../actions";

type SignInSearchParams = {
  email?: string;
  error?: string;
  mfa?: string;
  status?: string;
};

function selectMessage(
  params: SignInSearchParams,
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  if (params.error === "invalid_credentials") {
    return { tone: "error", value: t("errors.invalidCredentials") };
  }

  if (params.error === "login_locked") {
    return { tone: "error", value: t("errors.loginLocked") };
  }

  if (params.error) {
    return { tone: "error", value: t("errors.generic") };
  }

  if (params.status === "password-reset") {
    return { tone: "success", value: t("status.passwordReset") };
  }

  if (params.status === "magic-link-sent") {
    return { tone: "success", value: t("status.magicLinkSent") };
  }

  if (params.mfa === "required") {
    return { tone: "info", value: t("status.mfaRequired") };
  }

  return undefined;
}

export default async function SignInPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<SignInSearchParams>;
}) {
  const t = await getTranslations("SignInPage");
  const { locale } = await routeParams;
  const query = (await searchParams) ?? {};
  const message = selectMessage(query, t);

  return (
    <div className="grid w-full max-w-md gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("title", { appName: appConfig.shortName })}</CardTitle>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </CardHeader>
        <CardContent className="grid gap-5">
          {message ? (
            <p
              className={
                message.tone === "error"
                  ? "text-destructive rounded-md border p-3 text-sm"
                  : "text-muted-foreground rounded-md border p-3 text-sm"
              }
              role={message.tone === "error" ? "alert" : "status"}
            >
              {message.value}
            </p>
          ) : null}
          <form action={signInAction} className="grid gap-4">
            <input name="locale" type="hidden" value={locale} />
            <Field label={t("email")} required>
              <TextInput
                autoComplete="email"
                defaultValue={query.email}
                name="email"
                required
                type="email"
              />
            </Field>
            <Field label={t("password")} required>
              <TextInput
                autoComplete="current-password"
                name="password"
                required
                type="password"
              />
            </Field>
            {query.mfa === "required" ? (
              <Field label={t("mfaCode")} required>
                <TextInput
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  name="mfaCode"
                  required
                />
              </Field>
            ) : null}
            <Button type="submit">{t("submit")}</Button>
          </form>
          <form action={requestMagicLinkAction} className="grid gap-3">
            <input name="locale" type="hidden" value={locale} />
            <Field label={t("magicEmail")}>
              <TextInput
                autoComplete="email"
                defaultValue={query.email}
                name="email"
                type="email"
              />
            </Field>
            <Button type="submit" variant="outline">
              {t("sendMagicLink")}
            </Button>
          </form>
          <div className="grid gap-3 border-t pt-5">
            <PasskeyAuthenticationControl
              labels={{
                email: t("passkeyEmail"),
                error: t("passkeyError"),
                signIn: t("passkeySubmit"),
              }}
              redirectTo={appRoutes.dashboard}
            />
          </div>
          <div className="text-muted-foreground flex flex-wrap justify-between gap-3 text-sm">
            <Link href={appRoutes.forgotPassword}>{t("forgotPassword")}</Link>
            <Link href={appRoutes.signUp}>{t("createAccount")}</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
