import { appConfig } from "@nextjs-saas/config/app";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nextjs-saas/ui";
import { getTranslations } from "next-intl/server";

import { AuthShell } from "../../../../../../components/shells";
import { assertLocale } from "../../../../../../lib/locale";
import {
  acceptOrganizationInvitationAction,
  rejectOrganizationInvitationAction,
} from "../../../tenant-actions";

type OrganizationInvitationSearchParams = {
  error?: string;
  token?: string;
};

export default async function OrganizationInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<OrganizationInvitationSearchParams>;
}) {
  const fallbackSearchParams: Promise<OrganizationInvitationSearchParams> =
    Promise.resolve({});
  const [{ locale }, query, t] = await Promise.all([
    params,
    searchParams ?? fallbackSearchParams,
    getTranslations("OrganizationInvitationPage"),
  ]);
  const resolvedLocale = assertLocale(locale);

  return (
    <AuthShell locale={resolvedLocale}>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {t("title", {
              appName: appConfig.shortName,
            })}
          </CardTitle>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </CardHeader>
        <CardContent className="grid gap-4">
          {query.error ? (
            <p className="text-destructive text-sm" role="alert">
              {t("invalid")}
            </p>
          ) : null}
          <form
            action={acceptOrganizationInvitationAction}
            className="grid gap-3"
          >
            <input name="locale" type="hidden" value={resolvedLocale} />
            <input name="token" type="hidden" value={query.token ?? ""} />
            <Button disabled={!query.token} type="submit">
              {t("accept")}
            </Button>
          </form>
          <form action={rejectOrganizationInvitationAction}>
            <input name="locale" type="hidden" value={resolvedLocale} />
            <input name="token" type="hidden" value={query.token ?? ""} />
            <Button
              className="w-full"
              disabled={!query.token}
              type="submit"
              variant="outline"
            >
              {t("reject")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
