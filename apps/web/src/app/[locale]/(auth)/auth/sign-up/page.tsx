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
  const { locale } = await routeParams;
  const params = (await searchParams) ?? {};

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("title", { appName: appConfig.shortName })}</CardTitle>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </CardHeader>
      <CardContent className="grid gap-5">
        {params.error ? (
          <p
            className="text-destructive rounded-md border p-3 text-sm"
            role="alert"
          >
            {params.error === "weak_password"
              ? t("errors.weakPassword")
              : params.error === "email_taken"
                ? t("errors.emailTaken")
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
          <Button type="submit">{t("submit")}</Button>
        </form>
        <p className="text-muted-foreground text-sm">
          {t("hasAccount")} <Link href={appRoutes.signIn}>{t("signIn")}</Link>
        </p>
      </CardContent>
    </Card>
  );
}
