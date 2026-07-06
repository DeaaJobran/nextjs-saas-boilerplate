import { defaultLocale, type Locale } from "./locales";

export type TemplateValue = Date | boolean | null | number | string | undefined;
export type TemplateValues = Record<string, TemplateValue>;
export type LocalizedText = Partial<Record<Locale, string>>;

export type LocalizedEmailTemplate = {
  html?: LocalizedText;
  subject: LocalizedText;
  text: LocalizedText;
};

export type RenderedLocalizedEmail = {
  html?: string;
  locale: Locale;
  subject: string;
  text: string;
};

export type LocalizedInvoiceTemplate = {
  billToLabel: LocalizedText;
  dueDateLabel: LocalizedText;
  footer?: LocalizedText;
  invoiceNumberLabel: LocalizedText;
  issueDateLabel: LocalizedText;
  lineItemAmountLabel: LocalizedText;
  lineItemDescriptionLabel: LocalizedText;
  lineItemQuantityLabel: LocalizedText;
  subtotalLabel: LocalizedText;
  taxLabel: LocalizedText;
  title: LocalizedText;
  totalLabel: LocalizedText;
};

export type RenderedLocalizedInvoiceTemplate = {
  billToLabel: string;
  dueDateLabel: string;
  footer?: string;
  invoiceNumberLabel: string;
  issueDateLabel: string;
  lineItemAmountLabel: string;
  lineItemDescriptionLabel: string;
  lineItemQuantityLabel: string;
  locale: Locale;
  subtotalLabel: string;
  taxLabel: string;
  title: string;
  totalLabel: string;
};

function stringifyTemplateValue(value: TemplateValue) {
  if (value === null || value === undefined) {
    return "";
  }

  return value instanceof Date ? value.toISOString() : String(value);
}

export function renderLocalizedText(
  locale: Locale,
  text: LocalizedText,
  values: TemplateValues = {},
  fallbackLocale: Locale = defaultLocale,
) {
  const template = text[locale] ?? text[fallbackLocale];

  if (typeof template !== "string") {
    return "";
  }

  return template.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (_, key: string) =>
    stringifyTemplateValue(values[key]),
  );
}

export function renderLocalizedEmailTemplate(
  locale: Locale,
  template: LocalizedEmailTemplate,
  values: TemplateValues = {},
): RenderedLocalizedEmail {
  return {
    html: template.html
      ? renderLocalizedText(locale, template.html, values)
      : undefined,
    locale,
    subject: renderLocalizedText(locale, template.subject, values),
    text: renderLocalizedText(locale, template.text, values),
  };
}

export function renderLocalizedInvoiceTemplate(
  locale: Locale,
  template: LocalizedInvoiceTemplate,
  values: TemplateValues = {},
): RenderedLocalizedInvoiceTemplate {
  return {
    billToLabel: renderLocalizedText(locale, template.billToLabel, values),
    dueDateLabel: renderLocalizedText(locale, template.dueDateLabel, values),
    footer: template.footer
      ? renderLocalizedText(locale, template.footer, values)
      : undefined,
    invoiceNumberLabel: renderLocalizedText(
      locale,
      template.invoiceNumberLabel,
      values,
    ),
    issueDateLabel: renderLocalizedText(
      locale,
      template.issueDateLabel,
      values,
    ),
    lineItemAmountLabel: renderLocalizedText(
      locale,
      template.lineItemAmountLabel,
      values,
    ),
    lineItemDescriptionLabel: renderLocalizedText(
      locale,
      template.lineItemDescriptionLabel,
      values,
    ),
    lineItemQuantityLabel: renderLocalizedText(
      locale,
      template.lineItemQuantityLabel,
      values,
    ),
    locale,
    subtotalLabel: renderLocalizedText(locale, template.subtotalLabel, values),
    taxLabel: renderLocalizedText(locale, template.taxLabel, values),
    title: renderLocalizedText(locale, template.title, values),
    totalLabel: renderLocalizedText(locale, template.totalLabel, values),
  };
}
