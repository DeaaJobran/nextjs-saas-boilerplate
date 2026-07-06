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

import { acceptInvitationAction } from "../../actions";

type AcceptInvitationSearchParams = {
  error?: string;
  token?: string;
};

export default async function AcceptInvitationPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<AcceptInvitationSearchParams>;
}) {
  const t = await getTranslations("AcceptInvitationPage");
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
              : params.error === "email_taken"
                ? t("errors.emailTaken")
                : t("errors.generic")}
          </p>
        ) : null}
        <form action={acceptInvitationAction} className="grid gap-4">
          <input name="locale" type="hidden" value={locale} />
          <input name="token" type="hidden" value={params.token ?? ""} />
          <Field label={t("displayName")} required>
            <TextInput autoComplete="name" name="displayName" required />
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
          <Button disabled={!params.token} type="submit">
            {t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
