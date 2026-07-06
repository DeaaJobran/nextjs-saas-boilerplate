import { isLocale, type Locale } from "@nextjs-saas/localization";
import { notFound } from "next/navigation";

import { getContentRepository } from "./content-store";

export function assertLocale(value: string): Locale {
  if (!isLocale(value)) {
    notFound();
  }

  return value;
}

export async function assertActiveLocale(value: string): Promise<Locale> {
  const locale = assertLocale(value);
  const repository = await getContentRepository();

  if (!repository.isLocaleEnabled(locale)) {
    notFound();
  }

  return locale;
}
