import { appConfig } from "@nextjs-saas/config/app";
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

export default async function SignInPage() {
  const t = await getTranslations("SignInPage");

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("title", { appName: appConfig.shortName })}</CardTitle>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4">
          <Field label={t("email")} required>
            <TextInput
              autoComplete="email"
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
          <Button type="submit">{t("submit")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
