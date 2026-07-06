export const locales = ["en", "ar"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export type TextDirection = "ltr" | "rtl";

export const localeLabels = {
  en: "English",
  ar: "العربية",
} satisfies Record<Locale, string>;

export const localeDirections = {
  en: "ltr",
  ar: "rtl",
} satisfies Record<Locale, TextDirection>;

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export function getTextDirection(locale: Locale): TextDirection {
  return localeDirections[locale];
}
