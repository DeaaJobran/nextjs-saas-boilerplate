import { createPageMetadata } from "@nextjs-saas/config/seo";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nextjs-saas/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Link } from "../../../../i18n/navigation";
import { getContentRepository } from "../../../../lib/content-store";
import { assertLocale } from "../../../../lib/locale";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: value } = await params;
  const locale = assertLocale(value);
  const repository = await getContentRepository();
  const page = repository.getPage({ kind: "pricing", locale });

  if (!page) {
    notFound();
  }

  return createPageMetadata(page.seo, { locale });
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: value } = await params;
  const locale = assertLocale(value);
  const t = await getTranslations({ locale, namespace: "PricingPage" });
  const repository = await getContentRepository();
  const page = repository.getPage({ kind: "pricing", locale });

  if (!page) {
    notFound();
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl space-y-3">
        <p className="text-primary text-sm font-medium">{t("eyebrow")}</p>
        <h1 className="text-4xl font-semibold tracking-tight">{page.title}</h1>
        <p className="text-muted-foreground text-lg">{page.description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {repository.listPricingPlans(locale).map((plan) => (
          <Card
            className={
              plan.highlighted ? "border-primary shadow-md" : undefined
            }
            key={plan.id}
          >
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{plan.name}</CardTitle>
                {plan.highlighted ? (
                  <Badge variant="success">{t("configured")}</Badge>
                ) : null}
              </div>
              <p className="text-3xl font-semibold">{plan.priceLabel}</p>
              <p className="text-muted-foreground text-sm">
                {plan.description}
              </p>
            </CardHeader>
            <CardContent className="grid gap-4">
              <ul className="text-muted-foreground grid gap-2 text-sm">
                {plan.features.map((feature) => (
                  <li className="bg-muted/50 rounded-md p-3" key={feature}>
                    {feature}
                  </li>
                ))}
              </ul>
              <Button asChild>
                <Link href="/contact">{plan.ctaLabel}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
