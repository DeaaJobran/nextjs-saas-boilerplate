"use client";

import { LoadingState } from "@nextjs-saas/ui";
import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations("Errors");

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <LoadingState
        description={t("loadingDescription")}
        title={t("loadingTitle")}
      />
    </main>
  );
}
