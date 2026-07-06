import { createPageMetadata } from "@nextjs-saas/config/seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ContactForm } from "../../../../components/contact-form";
import { getContentRepository } from "../../../../lib/content-store";
import { assertLocale } from "../../../../lib/locale";
import { submitContactMessageAction } from "./actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: value } = await params;
  const locale = assertLocale(value);
  const repository = await getContentRepository();
  const page = repository.getPage({ kind: "contact", locale });

  if (!page) {
    notFound();
  }

  return createPageMetadata(page.seo);
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params;
  const locale = assertLocale(value);
  const t = await getTranslations({ locale, namespace: "ContactPage" });
  const repository = await getContentRepository();
  const page = repository.getPage({ kind: "contact", locale });

  if (!page) {
    notFound();
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
      <section className="space-y-4">
        <p className="text-primary text-sm font-medium">{t("eyebrow")}</p>
        <h1 className="text-4xl font-semibold tracking-tight">{page.title}</h1>
        <p className="text-muted-foreground text-lg">{page.description}</p>
      </section>
      <ContactForm
        action={submitContactMessageAction}
        fields={repository.listContactFields(locale)}
        locale={locale}
        routing={repository.getContactRouting(locale)}
      />
    </main>
  );
}
