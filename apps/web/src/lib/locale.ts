import { isLocale, type Locale } from "@nextjs-saas/localization";
import { notFound } from "next/navigation";

export function assertLocale(value: string): Locale {
  if (!isLocale(value)) {
    notFound();
  }

  return value;
}
