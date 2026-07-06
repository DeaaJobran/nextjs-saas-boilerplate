import { type Locale, locales } from "@nextjs-saas/localization";

const decimalFormatters = {} as Record<Locale, Intl.NumberFormat>;
const gigabyteFormatters = {} as Record<Locale, Intl.NumberFormat>;
const mediumShortDateTimeFormatters = {} as Record<Locale, Intl.DateTimeFormat>;

for (const locale of locales) {
  decimalFormatters[locale] = new Intl.NumberFormat(locale);
  gigabyteFormatters[locale] = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    style: "unit",
    unit: "gigabyte",
  });
  mediumShortDateTimeFormatters[locale] = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatLocaleDateTime(
  locale: Locale,
  value: Date | string | null | undefined,
) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return mediumShortDateTimeFormatters[locale].format(date);
}

export function formatLocaleGigabytes(locale: Locale, value: number) {
  return gigabyteFormatters[locale].format(value / 1024 / 1024 / 1024);
}

export function formatLocaleNumber(locale: Locale, value: number) {
  return decimalFormatters[locale].format(value);
}
