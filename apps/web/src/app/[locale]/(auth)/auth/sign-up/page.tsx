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

import { Link } from "@/i18n/navigation";
import { getContentRepository } from "@/lib/content-store";
import { assertLocale } from "@/lib/locale";
import { getPublicManagedPage } from "@/lib/public-content";

import { signUpAction } from "../actions";

type SignUpSearchParams = {
  error?: string;
};

export default async function SignUpPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<SignUpSearchParams>;
}) {
  const t = await getTranslations("SignUpPage");
  const { locale: localeValue } = await routeParams;
  const locale = assertLocale(localeValue);
  const params = (await searchParams) ?? {};
  const repository = await getContentRepository();
  const pages = repository.listPages(locale);
  const legalDocumentsAvailable = ["terms", "privacy"].every((slug) =>
    getPublicManagedPage(pages, { kind: "legal", locale, slug }),
  );

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("title", { appName: appConfig.shortName })}</CardTitle>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </CardHeader>
      <CardContent className="grid gap-5">
        {legalDocumentsAvailable ? (
          <>
            {params.error ? (
              <p
                className="text-destructive rounded-md border p-3 text-sm"
                role="alert"
              >
                {params.error === "weak_password"
                  ? t("errors.weakPassword")
                  : params.error === "email_taken"
                    ? t("errors.emailTaken")
                    : params.error === "legal_acceptance_required"
                      ? t("legalAcceptanceError")
                      : t("errors.generic")}
              </p>
            ) : null}
            <form action={signUpAction} className="grid gap-4">
              <input name="locale" type="hidden" value={locale} />
              <Field label={t("displayName")} required>
                <TextInput autoComplete="name" name="displayName" required />
              </Field>
              <Field label={t("email")} required>
                <TextInput
                  autoComplete="email"
                  name="email"
                  required
                  type="email"
                />
              </Field>
              <Field
                description={t("passwordDescription")}
                label={t("password")}
                required
              >
                <TextInput
                  autoComplete="new-password"
                  name="password"
                  required
                  type="password"
                />
              </Field>
              <label className="flex items-start gap-3 text-sm">
                <input
                  className="mt-1 size-4 shrink-0 accent-current"
                  name="legalAcceptance"
                  required
                  type="checkbox"
                />
                <span>
                  {t("legalAgreement")}{" "}
                  <Link className="underline" href={appRoutes.legalTerms}>
                    {t("terms")}
                  </Link>{" "}
                  {t("and")}{" "}
                  <Link className="underline" href={appRoutes.legal}>
                    {t("privacy")}
                  </Link>
                </span>
              </label>
              <Button type="submit">{t("submit")}</Button>
            </form>
          </>
        ) : (
          <div className="bg-muted rounded-md border p-4 text-sm">
            <p className="font-medium">{t("legalUnavailableTitle")}</p>
            <p className="text-muted-foreground mt-1">
              {t("legalUnavailableDescription")}
            </p>
          </div>
        )}
        <p className="text-muted-foreground text-sm">
          {t("hasAccount")} <Link href={appRoutes.signIn}>{t("signIn")}</Link>
        </p>
      </CardContent>
    </Card>
  );
}
