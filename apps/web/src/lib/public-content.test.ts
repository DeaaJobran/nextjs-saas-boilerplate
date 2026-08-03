import { defaultContentSnapshot } from "@nextjs-saas/config/content";
import { describe, expect, it } from "vitest";

import {
  getPublicManagedPage,
  isManagedPagePublic,
  listCanonicalPublicManagedPages,
} from "./public-content";

describe("public managed content", () => {
  const page = defaultContentSnapshot.pages[0];

  it("accepts published pages whose publication date has passed", () => {
    expect(
      isManagedPagePublic(
        { ...page, publishState: "published" },
        new Date("2026-08-03T00:00:00.000Z"),
      ),
    ).toBe(true);
  });

  it("rejects drafts and future publication dates", () => {
    expect(isManagedPagePublic({ ...page, publishState: "draft" })).toBe(false);
    expect(
      isManagedPagePublic(
        {
          ...page,
          publishState: "published",
          publishedAt: "2026-08-04T00:00:00.000Z",
        },
        new Date("2026-08-03T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("selects the newest public page for each managed route", () => {
    const olderPublicPage = {
      ...page,
      id: "landing-en-older",
      updatedAt: "2026-08-01T00:00:00.000Z",
    };
    const newerPublicPage = {
      ...page,
      id: "landing-en-newer",
      slug: "new-landing-slug",
      updatedAt: "2026-08-02T00:00:00.000Z",
    };
    const newestDraftPage = {
      ...page,
      id: "landing-en-draft",
      publishState: "draft" as const,
      slug: "draft-landing-slug",
      updatedAt: "2026-08-03T00:00:00.000Z",
    };
    const pages = [newestDraftPage, olderPublicPage, newerPublicPage];

    expect(
      getPublicManagedPage(pages, { kind: "landing", locale: "en" })?.id,
    ).toBe(newerPublicPage.id);
    expect(listCanonicalPublicManagedPages(pages)).toEqual([newerPublicPage]);
  });
});
