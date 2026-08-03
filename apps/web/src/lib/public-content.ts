import type { ManagedPage, PageKind } from "@nextjs-saas/config/content";

type PublicManagedPageSelector = {
  kind: PageKind;
  locale: ManagedPage["locale"];
  slug?: string;
};

export function isManagedPagePublic(
  page: ManagedPage | undefined,
  now: Date = new Date(),
): page is ManagedPage {
  if (!page || page.publishState !== "published") {
    return false;
  }

  return !page.publishedAt || new Date(page.publishedAt) <= now;
}

function getManagedPageIdentity(page: ManagedPage) {
  return page.kind === "legal"
    ? `${page.locale}:${page.kind}:${page.slug}`
    : `${page.locale}:${page.kind}`;
}

function isPreferredManagedPage(candidate: ManagedPage, current: ManagedPage) {
  const updatedAtComparison = candidate.updatedAt.localeCompare(
    current.updatedAt,
  );

  return (
    updatedAtComparison > 0 ||
    (updatedAtComparison === 0 && candidate.id.localeCompare(current.id) < 0)
  );
}

export function getPublicManagedPage(
  pages: ManagedPage[],
  selector: PublicManagedPageSelector,
  now: Date = new Date(),
) {
  let selected: ManagedPage | undefined;

  for (const page of pages) {
    const matchesSelector =
      page.kind === selector.kind &&
      page.locale === selector.locale &&
      (selector.kind !== "legal" ||
        selector.slug === undefined ||
        page.slug === selector.slug);

    if (
      matchesSelector &&
      isManagedPagePublic(page, now) &&
      (!selected || isPreferredManagedPage(page, selected))
    ) {
      selected = page;
    }
  }

  return selected;
}

export function listCanonicalPublicManagedPages(
  pages: ManagedPage[],
  now: Date = new Date(),
) {
  const selectedPages = new Map<string, ManagedPage>();

  for (const page of pages) {
    if (!isManagedPagePublic(page, now)) {
      continue;
    }

    const key = getManagedPageIdentity(page);
    const selected = selectedPages.get(key);

    if (!selected || isPreferredManagedPage(page, selected)) {
      selectedPages.set(key, page);
    }
  }

  return [...selectedPages.values()];
}
