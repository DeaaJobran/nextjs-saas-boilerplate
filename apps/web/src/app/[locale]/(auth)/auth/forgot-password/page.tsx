import { appRoutes } from "@nextjs-saas/config/app";
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

import { requestPasswordResetAction } from "../actions";

type ForgotPasswordSearchParams = {
  status?: string;
};

export default async function ForgotPasswordPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<ForgotPasswordSearchParams>;
}) {
  const t = await getTranslations("ForgotPasswordPage");
  const { locale } = await routeParams;
  const params = (await searchParams) ?? {};

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </CardHeader>
      <CardContent className="grid gap-5">
        {params.status === "sent" ? (
          <p
            className="text-muted-foreground rounded-md border p-3 text-sm"
            role="status"
          >
            {t("sent")}
          </p>
        ) : null}
        <form action={requestPasswordResetAction} className="grid gap-4">
          <input name="locale" type="hidden" value={locale} />
          <Field label={t("email")} required>
            <TextInput
              autoComplete="email"
              name="email"
              required
              type="email"
            />
          </Field>
          <Button type="submit">{t("submit")}</Button>
        </form>
        <Link className="text-muted-foreground text-sm" href={appRoutes.signIn}>
          {t("backToSignIn")}
        </Link>
      </CardContent>
    </Card>
  );
}
