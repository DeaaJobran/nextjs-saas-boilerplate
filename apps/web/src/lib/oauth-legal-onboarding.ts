import { fingerprintLegalDocument } from "@nextjs-saas/security";

type LegalDocument = Parameters<typeof fingerprintLegalDocument>[0] & {
  id: string;
  locale: string;
  slug: string;
  updatedAt: string;
  version?: string;
};

export type OAuthLegalAcceptance = {
  contentHash: string;
  documentId: string;
  documentSlug: string;
  locale: string;
  version: string;
};

export function createOAuthLegalAcceptance(
  document: LegalDocument,
): OAuthLegalAcceptance {
  return {
    contentHash: fingerprintLegalDocument(document),
    documentId: document.id,
    documentSlug: document.slug,
    locale: document.locale,
    version: document.version ?? document.updatedAt,
  };
}

export function matchesOAuthLegalAcceptances(
  metadata: Record<string, unknown>,
  expected: OAuthLegalAcceptance[],
) {
  const accepted = metadata.legalAcceptances;

  if (!Array.isArray(accepted) || accepted.length !== expected.length) {
    return false;
  }

  return expected.every((document) =>
    accepted.some(
      (value) =>
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.entries(document).every(
          ([key, expectedValue]) =>
            (value as Record<string, unknown>)[key] === expectedValue,
        ),
    ),
  );
}
