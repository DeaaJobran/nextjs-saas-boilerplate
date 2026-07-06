import { defaultLocale, locales } from "@nextjs-saas/localization";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  defaultLocale,
  localePrefix: "always",
  locales,
});
