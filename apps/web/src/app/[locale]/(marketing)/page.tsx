import {
  createPageMetadata,
  createSoftwareApplicationJsonLd,
  serializeJsonForHtml,
} from "@nextjs-saas/config/seo";
import { Button } from "@nextjs-saas/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ManagedPageSections } from "../../../components/managed-page";
import { Link } from "../../../i18n/navigation";
import { getContentRepository } from "../../../lib/content-store";
import { assertLocale } from "../../../lib/locale";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: value } = await params;
  const locale = assertLocale(value);
  const repository = await getContentRepository();
  const page = repository.getPage({ kind: "landing", locale });

  if (!page) {
    notFound();
  }

  return createPageMetadata(page.seo);
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params;
  const locale = assertLocale(value);
  const repository = await getContentRepository();
  const page = repository.getPage({ kind: "landing", locale });

  if (!page) {
    notFound();
  }

  return (
    <main>
      <section className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)] lg:px-8">
        <div className="max-w-3xl space-y-6">
          <p className="text-primary text-sm font-medium">
            {page.sections[0]?.eyebrow}
          </p>
          <h1 className="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
            {page.sections[0]?.title}
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg leading-8">
            {page.sections[0]?.body}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/dashboard">{page.sections[0]?.cta?.label}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">Review pricing</Link>
            </Button>
          </div>
        </div>
        <div className="bg-card grid gap-3 rounded-lg border p-4 shadow-sm">
          {page.sections[1]?.items?.map((item) => (
            <div className="bg-muted/40 rounded-md border p-4" key={item}>
              <p className="text-sm font-medium">{item}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <ManagedPageSections page={page} />
      </section>
      <script type="application/ld+json">
        {serializeJsonForHtml(createSoftwareApplicationJsonLd())}
      </script>
    </main>
  );
}
