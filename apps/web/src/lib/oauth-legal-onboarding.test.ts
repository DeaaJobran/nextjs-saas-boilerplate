import { describe, expect, it } from "vitest";

import { matchesOAuthLegalAcceptances } from "./oauth-legal-onboarding";

const expected = [
  {
    contentHash: "terms-hash",
    documentId: "terms-id",
    documentSlug: "terms",
    locale: "en",
    version: "1",
  },
  {
    contentHash: "privacy-hash",
    documentId: "privacy-id",
    documentSlug: "privacy",
    locale: "en",
    version: "1",
  },
];

describe("OAuth legal onboarding", () => {
  it("requires the exact legal documents accepted before authorization", () => {
    expect(
      matchesOAuthLegalAcceptances({ legalAcceptances: expected }, expected),
    ).toBe(true);
    expect(
      matchesOAuthLegalAcceptances(
        {
          legalAcceptances: [
            expected[0],
            { ...expected[1], contentHash: "changed" },
          ],
        },
        expected,
      ),
    ).toBe(false);
    expect(matchesOAuthLegalAcceptances({}, expected)).toBe(false);
  });
});
