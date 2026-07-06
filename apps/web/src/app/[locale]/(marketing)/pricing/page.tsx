import { appRoutes } from "@nextjs-saas/config/app";
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
import { getBillingService } from "../../../../lib/billing";
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
  const [repository, billing] = await Promise.all([
    getContentRepository(),
    Promise.resolve(getBillingService()),
  ]);
  const page = repository.getPage({ kind: "pricing", locale });

  if (!page) {
    notFound();
  }

  const providers = await billing.listPaymentProviders();
  const provider = providers.find((candidate) => candidate.enabled)?.provider;
  const plans = await billing.listPublicPlans({ locale, provider });

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl space-y-3">
        <p className="text-primary text-sm font-medium">{t("eyebrow")}</p>
        <h1 className="text-4xl font-semibold tracking-tight">{page.title}</h1>
        <p className="text-muted-foreground text-lg">{page.description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => {
          const price =
            plan.prices.find(
              (candidate) =>
                candidate.interval === "month" &&
                candidate.usageType === "licensed",
            ) ??
            plan.prices.find(
              (candidate) =>
                candidate.interval === "year" &&
                candidate.usageType === "licensed",
            ) ??
            plan.prices.find((candidate) => candidate.usageType !== "metered");

          return (
            <Card
              className={
                plan.highlighted ? "border-primary shadow-md" : undefined
              }
              key={plan.id}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{plan.translation.name}</CardTitle>
                  {plan.highlighted ? (
                    <Badge variant="success">{t("configured")}</Badge>
                  ) : null}
                </div>
                <p className="text-3xl font-semibold">
                  {price
                    ? billing.formatCurrency({
                        amountMinor: price.amountMinor,
                        currency: price.currency,
                        locale,
                      })
                    : t("priceUnavailable")}
                </p>
                {price ? (
                  <p className="text-muted-foreground text-sm">
                    {t(`interval.${price.interval}`)}
                  </p>
                ) : null}
                <p className="text-muted-foreground text-sm">
                  {plan.translation.description}
                </p>
              </CardHeader>
              <CardContent className="grid gap-4">
                <ul className="text-muted-foreground grid gap-2 text-sm">
                  {plan.translation.features.map((feature) => (
                    <li className="bg-muted/50 rounded-md p-3" key={feature}>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button asChild>
                  <Link href={appRoutes.signUp}>
                    {plan.translation.ctaLabel}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
