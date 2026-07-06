import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nextjs-saas/ui";
import { getTranslations } from "next-intl/server";

import { verifyEmailChangeAction } from "../actions";

type VerifyEmailChangeSearchParams = {
  token?: string;
};

export default async function VerifyEmailChangePage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<VerifyEmailChangeSearchParams>;
}) {
  const t = await getTranslations("VerifyEmailChangePage");
  const { locale } = await routeParams;
  const params = (await searchParams) ?? {};

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </CardHeader>
      <CardContent>
        <form action={verifyEmailChangeAction} className="grid gap-4">
          <input name="locale" type="hidden" value={locale} />
          <input name="token" type="hidden" value={params.token ?? ""} />
          <Button disabled={!params.token} type="submit">
            {t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
