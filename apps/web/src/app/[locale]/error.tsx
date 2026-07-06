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
    <main className="flex min-h-dvh items-center justify-center p-6">
      <ErrorState
        action={{ label: t("tryAgain"), onClick: reset }}
        description={error.message}
        title={t("routeTitle")}
      />
    </main>
  );
}
