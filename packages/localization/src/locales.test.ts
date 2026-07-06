import { describe, expect, it } from "vitest";

import { formatCurrency, getTextDirection, isLocale } from ".";

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
});
