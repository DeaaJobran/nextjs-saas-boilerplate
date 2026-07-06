import type { Locale } from "./locales";

export type PluralizedMessages = Partial<
  Record<Intl.LDMLPluralRule, string>
> & {
  other: string;
};

export function formatDate(
  locale: Locale,
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return "";
  }
}

export function formatNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatCurrency(
  locale: Locale,
  value: number,
  currency: string,
  options?: Omit<Intl.NumberFormatOptions, "currency" | "style">,
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    ...options,
  }).format(value);
}

export function selectPluralMessage(
  locale: Locale,
  value: number,
  messages: PluralizedMessages,
) {
  const category = new Intl.PluralRules(locale).select(value);

  return messages[category] ?? messages.other;
}

export function formatPlural(
  locale: Locale,
  value: number,
  messages: PluralizedMessages,
  options?: Intl.NumberFormatOptions,
) {
  const message = selectPluralMessage(locale, value, messages);
  const formattedValue = formatNumber(locale, value, options);

  return message.replaceAll("{count}", formattedValue);
}
