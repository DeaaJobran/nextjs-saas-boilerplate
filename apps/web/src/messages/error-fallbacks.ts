import type { Locale } from "@nextjs-saas/localization";

export const errorFallbackMessages = {
  ar: {
    globalTitle: "تعذر عرض هيكل التطبيق.",
    tryAgain: "حاول مرة أخرى",
  },
  en: {
    globalTitle: "The application shell failed to render.",
    tryAgain: "Try again",
  },
} satisfies Record<
  Locale,
  {
    globalTitle: string;
    tryAgain: string;
  }
>;
