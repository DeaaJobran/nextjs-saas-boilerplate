import { describe, expect, it } from "vitest";

import {
  formatCurrency,
  formatPlural,
  getDirectionalValue,
  getLocaleTypographyClassName,
  getTextDirection,
  isLocale,
  renderLocalizedEmailTemplate,
  renderLocalizedInvoiceTemplate,
} from ".";

describe("localization primitives", () => {
  it("validates supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ar")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });

  it("returns direction per locale", () => {
    expect(getTextDirection("en")).toBe("ltr");
    expect(getTextDirection("ar")).toBe("rtl");
  });

  it("formats values with locale-aware APIs", () => {
    expect(formatCurrency("en", 12, "USD")).toContain("$");
  });

  it("selects directional and typography helpers per locale", () => {
    expect(getDirectionalValue("en", { ltr: "start", rtl: "end" })).toBe(
      "start",
    );
    expect(getDirectionalValue("ar", { ltr: "start", rtl: "end" })).toBe("end");
    expect(getLocaleTypographyClassName("ar")).toBe("font-locale");
  });

  it("formats pluralized messages with locale-aware numbers", () => {
    expect(
      formatPlural("en", 1, {
        one: "{count} file",
        other: "{count} files",
      }),
    ).toBe("1 file");
    expect(
      formatPlural("en", 2, {
        one: "{count} file",
        other: "{count} files",
      }),
    ).toBe("2 files");
  });

  it("renders localized email templates", () => {
    const email = renderLocalizedEmailTemplate(
      "ar",
      {
        subject: {
          ar: "مرحبا {name}",
          en: "Hello {name}",
        },
        text: {
          ar: "تم حفظ طلبك رقم {ticket}.",
          en: "Your request {ticket} was saved.",
        },
      },
      {
        name: "Deaa",
        ticket: 42,
      },
    );

    expect(email.subject).toBe("مرحبا Deaa");
    expect(email.text).toContain("42");
  });

  it("renders an empty string when localized template text is missing", () => {
    const email = renderLocalizedEmailTemplate("ar", {
      subject: {},
      text: { en: "Fallback message" },
    });

    expect(email.subject).toBe("");
    expect(email.text).toBe("Fallback message");
  });

  it("renders localized invoice/PDF template labels", () => {
    const invoice = renderLocalizedInvoiceTemplate("en", {
      billToLabel: { ar: "إلى", en: "Bill to" },
      dueDateLabel: { ar: "تاريخ الاستحقاق", en: "Due date" },
      invoiceNumberLabel: { ar: "رقم الفاتورة", en: "Invoice number" },
      issueDateLabel: { ar: "تاريخ الإصدار", en: "Issue date" },
      lineItemAmountLabel: { ar: "المبلغ", en: "Amount" },
      lineItemDescriptionLabel: { ar: "الوصف", en: "Description" },
      lineItemQuantityLabel: { ar: "الكمية", en: "Quantity" },
      subtotalLabel: { ar: "المجموع الفرعي", en: "Subtotal" },
      taxLabel: { ar: "الضريبة", en: "Tax" },
      title: { ar: "فاتورة", en: "Invoice" },
      totalLabel: { ar: "الإجمالي", en: "Total" },
    });

    expect(invoice.title).toBe("Invoice");
    expect(invoice.lineItemDescriptionLabel).toBe("Description");
  });
});
