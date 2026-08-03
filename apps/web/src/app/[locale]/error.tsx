"use client";

import { ErrorState } from "@nextjs-saas/ui";
import { useTranslations } from "next-intl";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Errors");

  return (
    <main
      className="flex min-h-dvh items-center justify-center p-6"
      id="main-content"
      tabIndex={-1}
    >
      <ErrorState
        action={{ label: t("tryAgain"), onClick: reset }}
        description={
          error.digest
            ? t("routeDescriptionWithReference", { reference: error.digest })
            : t("routeDescription")
        }
        title={t("routeTitle")}
      />
    </main>
  );
}
