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

import { resetPasswordAction } from "../actions";

type ResetPasswordSearchParams = {
  error?: string;
  token?: string;
};

export default async function ResetPasswordPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<ResetPasswordSearchParams>;
}) {
  const t = await getTranslations("ResetPasswordPage");
  const { locale } = await routeParams;
  const params = (await searchParams) ?? {};

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
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
              : t("errors.generic")}
          </p>
        ) : null}
        <form action={resetPasswordAction} className="grid gap-4">
          <input name="locale" type="hidden" value={locale} />
          <input name="token" type="hidden" value={params.token ?? ""} />
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
      </CardContent>
    </Card>
  );
}
