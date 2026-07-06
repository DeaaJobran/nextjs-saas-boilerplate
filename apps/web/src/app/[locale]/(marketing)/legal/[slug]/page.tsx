import { createContentRepository } from "@nextjs-saas/config/content";
import { createPageMetadata } from "@nextjs-saas/config/seo";
import { Badge } from "@nextjs-saas/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ManagedPageSections } from "../../../../../components/managed-page";
import { assertLocale } from "../../../../../lib/locale";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: value, slug } = await params;
  const locale = assertLocale(value);
  const page = createContentRepository().getPage({
    kind: "legal",
    locale,
    slug,
  });

  if (!page) {
    notFound();
  }

  return createPageMetadata(page.seo);
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: value, slug } = await params;
  const locale = assertLocale(value);
  const page = createContentRepository().getPage({
    kind: "legal",
    locale,
    slug,
  });

  if (!page) {
    notFound();
  }

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-3">
        <Badge variant="outline">{page.publishState}</Badge>
        <h1 className="text-4xl font-semibold tracking-tight">{page.title}</h1>
        <p className="text-muted-foreground text-lg">{page.description}</p>
      </div>
      <ManagedPageSections page={page} />
    </main>
  );
}
