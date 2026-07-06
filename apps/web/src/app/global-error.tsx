"use client";

import {
  defaultLocale,
  getTextDirection,
  isLocale,
  type Locale,
} from "@nextjs-saas/localization";
import { ErrorState } from "@nextjs-saas/ui";

function getErrorLocale(): Locale {
  if (typeof window === "undefined") {
    return defaultLocale;
  }

  const locale = window.location.pathname.split("/")[1];

  return isLocale(locale) ? locale : defaultLocale;
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = getErrorLocale();
  const isArabic = locale === "ar";

  return (
    <html dir={getTextDirection(locale)} lang={locale}>
      <body>
        <main className="flex min-h-dvh items-center justify-center p-6">
          <ErrorState
            action={{
              label: isArabic ? "حاول مرة أخرى" : "Try again",
              onClick: reset,
            }}
            description={error.message}
            title={
              isArabic
                ? "تعذر عرض هيكل التطبيق."
                : "The application shell failed to render."
            }
          />
        </main>
      </body>
    </html>
  );
}
