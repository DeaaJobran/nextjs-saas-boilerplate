import { describe, expect, it } from "vitest";

import {
  createContentRepository,
  defaultContentSnapshot,
  recordContactSubmission,
  updateContactConfiguration,
  updatePricingPlans,
  upsertManagedPage,
} from "./content";

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

  it("updates managed pages without mutating the default snapshot", () => {
    const repository = createContentRepository();
    const page = repository.getPage({ kind: "landing", locale: "en" });

    expect(page).toBeDefined();

    const nextSnapshot = upsertManagedPage(defaultContentSnapshot, {
      ...page!,
      sections: [
        {
          body: "Updated body",
          id: "hero",
          title: "Updated hero title",
        },
      ],
      title: "Updated page title",
      updatedAt: "2026-07-06T01:00:00.000Z",
    });
    const nextRepository = createContentRepository(nextSnapshot);

    expect(
      nextRepository.getPage({ kind: "landing", locale: "en" })?.title,
    ).toBe("Updated page title");
    expect(
      createContentRepository().getPage({ kind: "landing", locale: "en" })
        ?.title,
    ).not.toBe("Updated page title");
  });

  it("updates contact settings and records submissions", () => {
    const updatedSnapshot = updateContactConfiguration(
      defaultContentSnapshot,
      "en",
      [
        {
          id: "message",
          label: "Project details",
          minLength: 20,
          required: true,
          type: "textarea",
        },
      ],
      {
        recipientEmail: "admin@example.com",
        spamProtectionEnabled: true,
        subjectPrefix: "[Support]",
        successMessage: "Saved",
      },
    );
    const submittedSnapshot = recordContactSubmission(updatedSnapshot, {
      email: "person@example.com",
      id: "submission-1",
      locale: "en",
      message: "A production inquiry",
      name: "Person",
      status: "new",
      submittedAt: "2026-07-06T01:00:00.000Z",
      values: {
        email: "person@example.com",
        message: "A production inquiry",
        name: "Person",
      },
    });
    const repository = createContentRepository(submittedSnapshot);

    expect(repository.listContactFields("en")[0]?.label).toBe(
      "Project details",
    );
    expect(repository.getContactRouting("en").recipientEmail).toBe(
      "admin@example.com",
    );
    expect(repository.listContactSubmissions("en")).toHaveLength(1);
  });

  it("updates localized pricing plans", () => {
    const nextSnapshot = updatePricingPlans(defaultContentSnapshot, "en", [
      {
        ctaLabel: "Choose plan",
        description: "Managed pricing copy",
        features: ["Managed feature"],
        id: "managed",
        name: "Managed",
        priceLabel: "$10",
      },
    ]);
    const repository = createContentRepository(nextSnapshot);

    expect(repository.listPricingPlans("en")).toHaveLength(1);
    expect(repository.listPricingPlans("en")[0]?.name).toBe("Managed");
  });
});
