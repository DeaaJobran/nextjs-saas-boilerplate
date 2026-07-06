import { ErrorState } from "@nextjs-saas/ui";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("Errors");

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <ErrorState
        action={{ href: "/", label: t("returnHome") }}
        description={t("notFoundDescription")}
        title={t("notFoundTitle")}
      />
    </main>
  );
}
