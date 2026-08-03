import type { Locale } from "@nextjs-saas/localization";

export const errorFallbackMessages = {
  ar: {
    globalDescription:
      "حدث خطأ غير متوقع. حاول مرة أخرى، واستخدم مرجع الخطأ عند التواصل مع الدعم إن ظهر.",
    globalTitle: "تعذر عرض هيكل التطبيق.",
    referenceLabel: "مرجع الخطأ",
    tryAgain: "حاول مرة أخرى",
  },
  en: {
    globalDescription:
      "An unexpected error occurred. Try again and include the error reference when contacting support if one is shown.",
    globalTitle: "The application shell failed to render.",
    referenceLabel: "Error reference",
    tryAgain: "Try again",
  },
} satisfies Record<
  Locale,
  {
    globalDescription: string;
    globalTitle: string;
    referenceLabel: string;
    tryAgain: string;
  }
>;
