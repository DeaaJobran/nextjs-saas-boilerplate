import { isLocale, type Locale,localeLabels } from "@nextjs-saas/localization";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  SelectInput,
  TextInput,
} from "@nextjs-saas/ui";
import { getTranslations } from "next-intl/server";

import { updateProfileAction } from "./actions";

type ProfileSettingsProps = {
  availableLocales: Locale[];
  avatarUrl?: string;
  displayName: string;
  locale: Locale;
  userLocale?: string;
};

export async function ProfileSettings({
  availableLocales,
  avatarUrl,
  displayName,
  locale,
  userLocale,
}: ProfileSettingsProps) {
  const t = await getTranslations("SettingsPage");
  const preferredLocale =
    isLocale(userLocale) && availableLocales.includes(userLocale)
      ? userLocale
      : locale;

  return (
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
          <input name="locale" type="hidden" value={locale} />
          <Field label={t("displayName")}>
            <TextInput
              autoComplete="name"
              defaultValue={displayName}
              name="displayName"
            />
          </Field>
          <Field label={t("avatarUrl")}>
            <TextInput defaultValue={avatarUrl} name="avatarUrl" type="url" />
          </Field>
          <Field
            description={t("preferredLocaleDescription")}
            label={t("preferredLocale")}
          >
            <SelectInput defaultValue={preferredLocale} name="preferredLocale">
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
  );
}
