import { describe, expect, it } from "vitest";

import {
  createPageMetadata,
  createSoftwareApplicationJsonLd,
  serializeJsonForHtml,
} from "./seo";

describe("SEO helpers", () => {
  it("creates localized metadata and Open Graph output", () => {
    const metadata = createPageMetadata(
      {
        description: "A localized SaaS starter.",
        ogImage: "/images/open-graph.png",
        title: "Starter",
      },
      { locale: "ar" },
    );

    expect(metadata).toMatchObject({
      description: "A localized SaaS starter.",
      openGraph: {
        description: "A localized SaaS starter.",
        images: ["/images/open-graph.png"],
        locale: "ar",
        type: "website",
      },
      title: {
        absolute: "Starter | Next.js SaaS Boilerplate",
      },
    });
  });

  it("returns software application JSON-LD without executable HTML", () => {
    const jsonLd = createSoftwareApplicationJsonLd();
    const serialized = serializeJsonForHtml({
      ...jsonLd,
      description: "</script><script>alert('xss')</script>",
    });

    expect(jsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      applicationCategory: "DeveloperApplication",
    });
    expect(serialized).not.toContain("<script>");
    expect(serialized).toContain("\\u003c/script\\u003e");
  });
});
