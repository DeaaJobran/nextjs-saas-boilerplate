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

async function handleSaveProfile() {
  "use server";
  // TODO: Persist profile updates once the identity and database modules exist.
}

export default async function SettingsPage() {
  const t = await getTranslations("SettingsPage");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("profileTitle")}</CardTitle>
          <p className="text-muted-foreground text-sm">
            {t("profileDescription")}
          </p>
        </CardHeader>
        <CardContent>
          <form action={handleSaveProfile} className="grid gap-4">
            <Field label={t("displayName")}>
              <TextInput defaultValue={t("defaultDisplayName")} name="name" />
            </Field>
            <Field label={t("email")}>
              <TextInput
                defaultValue={t("defaultEmail")}
                name="email"
                type="email"
              />
            </Field>
            <Button type="submit">{t("saveProfile")}</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("accountTitle")}</CardTitle>
          <p className="text-muted-foreground text-sm">
            {t("accountDescription")}
          </p>
        </CardHeader>
        <CardContent className="text-muted-foreground grid gap-3 text-sm">
          <p>{t("layoutNote")}</p>
          <p>{t("securityNote")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
