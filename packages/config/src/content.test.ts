import { describe, expect, it } from "vitest";

import { createContentRepository } from "./content";

describe("content repository", () => {
  it("returns localized landing content", () => {
    const repository = createContentRepository();

    expect(
      repository.getPage({ kind: "landing", locale: "en" })?.sections[0]?.title,
    ).toContain("foundation");
    expect(
      repository.getPage({ kind: "landing", locale: "ar" })?.sections[0]?.title,
    ).toContain("أساس");
  });

  it("keeps pricing plans data-driven by locale", () => {
    const repository = createContentRepository();

    expect(repository.listPricingPlans("en")).toHaveLength(2);
    expect(repository.listPricingPlans("ar")[0]?.ctaLabel).toBe("ابدأ البناء");
  });
});
