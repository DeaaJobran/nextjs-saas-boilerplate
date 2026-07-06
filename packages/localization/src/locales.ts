export const locales = ["en", "ar"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export type TextDirection = "ltr" | "rtl";
export type DirectionalValue<T> = {
  ltr: T;
  rtl: T;
};

export const localeLabels = {
  en: "English",
  ar: "العربية",
} satisfies Record<Locale, string>;

export const localeLanguageNames = {
  en: "English",
  ar: "Arabic",
} satisfies Record<Locale, string>;

export const localeDirections = {
  en: "ltr",
  ar: "rtl",
} satisfies Record<Locale, TextDirection>;

export const localeTypographyClassNames = {
  en: "font-locale",
  ar: "font-locale",
} satisfies Record<Locale, string>;

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export function getTextDirection(locale: Locale): TextDirection {
  return localeDirections[locale];
}

export function isRtlLocale(locale: Locale) {
  return getTextDirection(locale) === "rtl";
}

export function getDirectionalValue<T>(
  locale: Locale,
  value: DirectionalValue<T>,
) {
  return isRtlLocale(locale) ? value.rtl : value.ltr;
}

export function getLocaleTypographyClassName(locale: Locale) {
  return localeTypographyClassNames[locale];
}

export function uniqueLocales(values: readonly Locale[]) {
  return locales.filter((locale) => values.includes(locale));
}
