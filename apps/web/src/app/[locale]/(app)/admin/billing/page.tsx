import type { BillingCoupon, BillingPlan } from "@nextjs-saas/billing";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Field,
  SelectInput,
  Textarea,
  TextInput,
} from "@nextjs-saas/ui";
import { CreditCardIcon, ReceiptTextIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { getBillingService } from "../../../../../lib/billing";
import { assertLocale } from "../../../../../lib/locale";
import {
  saveBillingCouponAction,
  saveBillingPlanAction,
  saveBillingPriceAction,
  saveBillingProviderAction,
  saveExchangeRateAction,
  saveTaxRateAction,
} from "./actions";

type AdminBillingSearchParams = {
  saved?: string;
};

type BillingService = ReturnType<typeof getBillingService>;
type PaymentProvider = Awaited<
  ReturnType<BillingService["listPaymentProviders"]>
>[number];
type Translations = Awaited<ReturnType<typeof getTranslations>>;

function featuresText(value: readonly string[]) {
  return value.join("\n");
}

function limitsText(plan: BillingPlan) {
  return Object.entries(plan.entitlements.limits ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function couponValue(coupon: BillingCoupon) {
  if (
    coupon.discountType === "percent" &&
    coupon.percentOffBasisPoints !== undefined
  ) {
    return `${coupon.percentOffBasisPoints / 100}%`;
  }

  if (coupon.discountType === "amount" && coupon.amountOffMinor !== undefined) {
    return `${coupon.amountOffMinor} ${coupon.currency ?? ""}`.trim();
  }

  return coupon.discountType;
}

function statusMessage(saved: string | undefined, t: Translations) {
  switch (saved) {
    case "exchange-rate":
      return t("status.exchangeRate");
    case "plan":
      return t("status.plan");
    case "price":
      return t("status.price");
    case "coupon":
      return t("status.coupon");
    case "provider":
      return t("status.provider");
    case "tax-rate":
      return t("status.taxRate");
    default:
      return undefined;
  }
}

function StatusNotice({ message }: { message?: string }) {
  return message ? (
    <p
      className="text-muted-foreground bg-background rounded-md border p-3 text-sm"
      role="status"
    >
      {message}
    </p>
  ) : null;
}

function ProviderCard({
  locale,
  provider,
  t,
}: {
  locale: string;
  provider: PaymentProvider;
  t: Translations;
}) {
  const capabilityFields = [
    ["enabled", t("providers.enabled")],
    ["checkout", t("providers.checkout")],
    ["portal", t("providers.portal")],
    ["refunds", t("providers.refunds")],
    ["subscriptions", t("providers.subscriptions")],
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{provider.displayName}</CardTitle>
          <Badge variant={provider.enabled ? "success" : "outline"}>
            {provider.enabled ? t("enabled") : t("disabled")}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          {t("providers.description")}
        </p>
      </CardHeader>
      <CardContent>
        <form action={saveBillingProviderAction} className="grid gap-4">
          <input name="locale" type="hidden" value={locale} />
          <input name="provider" type="hidden" value={provider.provider} />
          <Field label={t("providers.displayName")}>
            <TextInput
              defaultValue={provider.displayName}
              name="displayName"
              required
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("providers.mode")}>
              <SelectInput defaultValue={provider.mode} name="mode">
                <option value="test">{t("providers.test")}</option>
                <option value="live">{t("providers.live")}</option>
              </SelectInput>
            </Field>
            <Field label={t("providers.currencies")}>
              <TextInput
                defaultValue={provider.capabilities.supportedCurrencies.join(
                  ",",
                )}
                name="supportedCurrencies"
                required
              />
            </Field>
            <Field label={t("providers.secretRef")}>
              <TextInput defaultValue={provider.secretRef} name="secretRef" />
            </Field>
            <Field label={t("providers.webhookSecretRef")}>
              <TextInput
                defaultValue={provider.webhookSecretRef}
                name="webhookSecretRef"
              />
            </Field>
            <Field label={t("providers.apiBaseUrl")}>
              <TextInput
                defaultValue={
                  typeof provider.configuration.apiBaseUrl === "string"
                    ? provider.configuration.apiBaseUrl
                    : ""
                }
                name="apiBaseUrl"
              />
            </Field>
            <Field label={t("providers.apiVersion")}>
              <TextInput
                defaultValue={
                  typeof provider.configuration.apiVersion === "string"
                    ? provider.configuration.apiVersion
                    : ""
                }
                name="apiVersion"
              />
            </Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {capabilityFields.map(([name, label]) => (
              <label
                className="flex min-h-11 items-center gap-2 text-sm"
                key={name}
              >
                <input
                  defaultChecked={
                    name === "enabled"
                      ? provider.enabled
                      : provider.capabilities[
                          name as keyof typeof provider.capabilities
                        ] === true
                  }
                  name={name}
                  type="checkbox"
                />
                {label}
              </label>
            ))}
          </div>
          <Button type="submit">{t("providers.save")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProviderSection({
  locale,
  providers,
  t,
}: {
  locale: string;
  providers: PaymentProvider[];
  t: Translations;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      {providers.map((provider) => (
        <ProviderCard
          key={provider.provider}
          locale={locale}
          provider={provider}
          t={t}
        />
      ))}
    </section>
  );
}

function PlanCard({
  billing,
  locale,
  plan,
  t,
}: {
  billing: BillingService;
  locale: string;
  plan: BillingPlan;
  t: Translations;
}) {
  const visibilityFields = [
    ["publicVisible", t("plans.publicVisible"), plan.publicVisible],
    ["highlighted", t("plans.highlighted"), plan.highlighted],
    ["seatBased", t("plans.seatBased"), plan.seatBased],
    ["usageBased", t("plans.usageBased"), plan.usageBased],
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{plan.translation.name}</CardTitle>
          <Badge variant={plan.publicVisible ? "success" : "outline"}>
            {plan.publicVisible ? t("plans.public") : t("plans.private")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <form action={saveBillingPlanAction} className="grid gap-4">
          <input name="locale" type="hidden" value={locale} />
          <input name="planId" type="hidden" value={plan.id} />
          <input
            name="translationLocale"
            type="hidden"
            value={plan.translation.locale}
          />
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={t("plans.slug")}>
              <TextInput defaultValue={plan.slug} name="slug" required />
            </Field>
            <Field label={t("plans.name")}>
              <TextInput
                defaultValue={plan.translation.name}
                name="name"
                required
              />
            </Field>
            <Field label={t("plans.status")}>
              <SelectInput defaultValue={plan.status} name="status">
                <option value="active">{t("plans.active")}</option>
                <option value="draft">{t("plans.draft")}</option>
                <option value="archived">{t("plans.archived")}</option>
              </SelectInput>
            </Field>
            <Field label={t("plans.sortOrder")}>
              <TextInput
                defaultValue={String(plan.sortOrder)}
                name="sortOrder"
                type="number"
              />
            </Field>
            <Field label={t("plans.trialDays")}>
              <TextInput
                defaultValue={String(plan.trialDays)}
                name="trialDays"
                type="number"
              />
            </Field>
            <Field label={t("plans.ctaLabel")}>
              <TextInput
                defaultValue={plan.translation.ctaLabel}
                name="ctaLabel"
                required
              />
            </Field>
          </div>
          <Field label={t("plans.description")}>
            <Textarea
              defaultValue={plan.translation.description}
              name="description"
              required
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={t("plans.features")}>
              <Textarea
                defaultValue={featuresText(plan.translation.features)}
                name="features"
              />
            </Field>
            <Field label={t("plans.entitlementFeatures")}>
              <Textarea
                defaultValue={featuresText(plan.entitlements.features ?? [])}
                name="entitlementFeatures"
              />
            </Field>
            <Field label={t("plans.entitlementLimits")}>
              <Textarea
                defaultValue={limitsText(plan)}
                name="entitlementLimits"
              />
            </Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {visibilityFields.map(([name, label, checked]) => (
              <label
                className="flex min-h-11 items-center gap-2 text-sm"
                key={String(name)}
              >
                <input
                  defaultChecked={Boolean(checked)}
                  name={String(name)}
                  type="checkbox"
                />
                {label}
              </label>
            ))}
          </div>
          <Button type="submit">{t("plans.save")}</Button>
        </form>
        <DataTable
          columns={[
            {
              cell: (price) => price.provider,
              header: t("prices.provider"),
              key: "provider",
            },
            {
              cell: (price) =>
                billing.formatCurrency({
                  amountMinor: price.amountMinor,
                  currency: price.currency,
                  locale,
                }),
              header: t("prices.amount"),
              key: "amount",
            },
            {
              cell: (price) => t(`interval.${price.interval}`),
              header: t("prices.interval"),
              key: "interval",
            },
            {
              cell: (price) => price.usageType,
              header: t("prices.usage"),
              key: "usage",
            },
          ]}
          data={plan.prices}
          emptyLabel={t("prices.empty")}
        />
      </CardContent>
    </Card>
  );
}

function PlanSection({
  billing,
  locale,
  plans,
  t,
}: {
  billing: BillingService;
  locale: string;
  plans: BillingPlan[];
  t: Translations;
}) {
  return (
    <section className="grid gap-6">
      {plans.map((plan) => (
        <PlanCard
          billing={billing}
          key={plan.id}
          locale={locale}
          plan={plan}
          t={t}
        />
      ))}
    </section>
  );
}

function CouponsTableCard({
  coupons,
  t,
}: {
  coupons: BillingCoupon[];
  t: Translations;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("coupons.title")}</CardTitle>
        <p className="text-muted-foreground text-sm">
          {t("coupons.description")}
        </p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <DataTable
          columns={[
            {
              cell: (coupon) => coupon.code,
              header: t("coupons.code"),
              key: "code",
            },
            {
              cell: (coupon) => coupon.name,
              header: t("coupons.name"),
              key: "name",
            },
            {
              cell: (coupon) => coupon.provider ?? t("coupons.anyProvider"),
              header: t("coupons.provider"),
              key: "provider",
            },
            {
              cell: (coupon) => couponValue(coupon),
              header: t("coupons.value"),
              key: "value",
            },
            {
              cell: (coupon) => (
                <Badge variant={coupon.active ? "success" : "outline"}>
                  {coupon.active ? t("enabled") : t("disabled")}
                </Badge>
              ),
              header: t("coupons.status"),
              key: "status",
            },
          ]}
          data={coupons}
          emptyLabel={t("coupons.empty")}
        />
      </CardContent>
    </Card>
  );
}

function NewPlanCard({ locale, t }: { locale: string; t: Translations }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCardIcon aria-hidden="true" className="size-5" />
          {t("newPlan.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={saveBillingPlanAction} className="grid gap-4">
          <input name="locale" type="hidden" value={locale} />
          <input name="translationLocale" type="hidden" value={locale} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("plans.slug")}>
              <TextInput name="slug" required />
            </Field>
            <Field label={t("plans.name")}>
              <TextInput name="name" required />
            </Field>
            <Field label={t("plans.status")}>
              <SelectInput defaultValue="active" name="status">
                <option value="active">{t("plans.active")}</option>
                <option value="draft">{t("plans.draft")}</option>
                <option value="archived">{t("plans.archived")}</option>
              </SelectInput>
            </Field>
            <Field label={t("plans.ctaLabel")}>
              <TextInput name="ctaLabel" required />
            </Field>
          </div>
          <Field label={t("plans.description")}>
            <Textarea name="description" required />
          </Field>
          <Field label={t("plans.features")}>
            <Textarea name="features" />
          </Field>
          <input name="sortOrder" type="hidden" value="100" />
          <input name="trialDays" type="hidden" value="0" />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input defaultChecked name="publicVisible" type="checkbox" />
            {t("plans.publicVisible")}
          </label>
          <Button type="submit">{t("newPlan.create")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function NewPriceCard({
  locale,
  plans,
  providers,
  t,
}: {
  locale: string;
  plans: BillingPlan[];
  providers: PaymentProvider[];
  t: Translations;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("newPrice.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={saveBillingPriceAction} className="grid gap-4">
          <input name="locale" type="hidden" value={locale} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("prices.plan")}>
              <SelectInput name="planId" required>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.translation.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t("prices.provider")}>
              <SelectInput name="provider" required>
                {providers.map((provider) => (
                  <option key={provider.provider} value={provider.provider}>
                    {provider.displayName}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t("prices.providerPriceId")}>
              <TextInput name="providerPriceId" />
            </Field>
            <Field label={t("prices.currency")}>
              <TextInput defaultValue="USD" maxLength={3} name="currency" />
            </Field>
            <Field label={t("prices.amountMinor")}>
              <TextInput name="unitAmountMinor" required type="number" />
            </Field>
            <Field label={t("prices.interval")}>
              <SelectInput defaultValue="month" name="interval">
                <option value="month">{t("interval.month")}</option>
                <option value="year">{t("interval.year")}</option>
                <option value="one_time">{t("interval.one_time")}</option>
                <option value="usage">{t("interval.usage")}</option>
              </SelectInput>
            </Field>
            <Field label={t("prices.usage")}>
              <SelectInput defaultValue="licensed" name="usageType">
                <option value="licensed">{t("usage.licensed")}</option>
                <option value="metered">{t("usage.metered")}</option>
                <option value="one_time">{t("usage.one_time")}</option>
              </SelectInput>
            </Field>
            <Field label={t("prices.taxBehavior")}>
              <SelectInput defaultValue="exclusive" name="taxBehavior">
                <option value="exclusive">{t("taxBehavior.exclusive")}</option>
                <option value="inclusive">{t("taxBehavior.inclusive")}</option>
                <option value="unspecified">
                  {t("taxBehavior.unspecified")}
                </option>
              </SelectInput>
            </Field>
          </div>
          <input name="intervalCount" type="hidden" value="1" />
          <input name="billingScheme" type="hidden" value="per_unit" />
          <input name="sortOrder" type="hidden" value="100" />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input defaultChecked name="active" type="checkbox" />
            {t("prices.active")}
          </label>
          <Button type="submit">{t("newPrice.create")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function NewCouponCard({
  locale,
  providers,
  t,
}: {
  locale: string;
  providers: PaymentProvider[];
  t: Translations;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("newCoupon.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={saveBillingCouponAction} className="grid gap-4">
          <input name="locale" type="hidden" value={locale} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("coupons.code")}>
              <TextInput name="code" required />
            </Field>
            <Field label={t("coupons.name")}>
              <TextInput name="name" required />
            </Field>
            <Field label={t("coupons.provider")}>
              <SelectInput name="provider">
                {providers.map((provider) => (
                  <option key={provider.provider} value={provider.provider}>
                    {provider.displayName}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t("coupons.providerCouponId")}>
              <TextInput name="providerCouponId" />
            </Field>
            <Field label={t("coupons.discountType")}>
              <SelectInput defaultValue="percent" name="discountType">
                <option value="percent">{t("coupons.percent")}</option>
                <option value="amount">{t("coupons.amount")}</option>
              </SelectInput>
            </Field>
            <Field label={t("coupons.duration")}>
              <SelectInput defaultValue="once" name="duration">
                <option value="once">{t("coupons.once")}</option>
                <option value="forever">{t("coupons.forever")}</option>
                <option value="repeating">{t("coupons.repeating")}</option>
              </SelectInput>
            </Field>
            <Field label={t("coupons.durationMonths")}>
              <TextInput name="durationMonths" type="number" />
            </Field>
            <Field label={t("coupons.percentOff")}>
              <TextInput name="percentOffBasisPoints" type="number" />
            </Field>
            <Field label={t("coupons.amountOff")}>
              <TextInput name="amountOffMinor" type="number" />
            </Field>
            <Field label={t("coupons.currency")}>
              <TextInput defaultValue="USD" maxLength={3} name="currency" />
            </Field>
            <Field label={t("coupons.maxRedemptions")}>
              <TextInput name="maxRedemptions" type="number" />
            </Field>
            <Field label={t("coupons.redeemBy")}>
              <TextInput name="redeemBy" type="datetime-local" />
            </Field>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input defaultChecked name="active" type="checkbox" />
            {t("coupons.active")}
          </label>
          <Button type="submit">{t("newCoupon.create")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CreationSection({
  coupons,
  locale,
  plans,
  providers,
  t,
}: {
  coupons: BillingCoupon[];
  locale: string;
  plans: BillingPlan[];
  providers: PaymentProvider[];
  t: Translations;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <CouponsTableCard coupons={coupons} t={t} />
      <NewPlanCard locale={locale} t={t} />
      <NewPriceCard locale={locale} plans={plans} providers={providers} t={t} />
      <NewCouponCard locale={locale} providers={providers} t={t} />
    </section>
  );
}

function ExchangeRateCard({ locale, t }: { locale: string; t: Translations }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("exchange.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={saveExchangeRateAction} className="grid gap-4">
          <input name="locale" type="hidden" value={locale} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("exchange.base")}>
              <TextInput defaultValue="USD" maxLength={3} name="baseCurrency" />
            </Field>
            <Field label={t("exchange.quote")}>
              <TextInput
                defaultValue="SAR"
                maxLength={3}
                name="quoteCurrency"
              />
            </Field>
            <Field label={t("exchange.rate")}>
              <TextInput name="rateMicroUnits" required type="number" />
            </Field>
            <Field label={t("exchange.provider")}>
              <TextInput defaultValue="manual" name="provider" />
            </Field>
          </div>
          <Button type="submit">{t("exchange.save")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TaxRateCard({ locale, t }: { locale: string; t: Translations }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ReceiptTextIcon aria-hidden="true" className="size-5" />
          {t("taxRate.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={saveTaxRateAction} className="grid gap-4">
          <input name="locale" type="hidden" value={locale} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("taxRate.country")}>
              <TextInput maxLength={2} name="country" required />
            </Field>
            <Field label={t("taxRate.region")}>
              <TextInput name="region" />
            </Field>
            <Field label={t("taxRate.type")}>
              <TextInput defaultValue="VAT" name="taxType" required />
            </Field>
            <Field label={t("taxRate.rate")}>
              <TextInput name="percentageBasisPoints" required type="number" />
            </Field>
            <Field label={t("taxRate.provider")}>
              <TextInput defaultValue="manual" name="provider" />
            </Field>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input defaultChecked name="active" type="checkbox" />
            {t("taxRate.active")}
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input name="inclusive" type="checkbox" />
            {t("taxRate.inclusive")}
          </label>
          <Button type="submit">{t("taxRate.save")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RatesSection({ locale, t }: { locale: string; t: Translations }) {
  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <ExchangeRateCard locale={locale} t={t} />
      <TaxRateCard locale={locale} t={t} />
    </section>
  );
}

export default async function AdminBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<AdminBillingSearchParams>;
}) {
  const fallbackSearchParams: Promise<AdminBillingSearchParams> =
    Promise.resolve({});
  const [{ locale: localeValue }, query] = await Promise.all([
    params,
    searchParams ?? fallbackSearchParams,
  ]);
  const locale = assertLocale(localeValue);
  const t = await getTranslations({ locale, namespace: "AdminBilling" });
  const billing = getBillingService();
  const [providers, plans, coupons] = await Promise.all([
    billing.listPaymentProviders(),
    billing.listPublicPlans({
      includeInactive: true,
      includePrivate: true,
      locale,
    }),
    billing.listCoupons(),
  ]);

  return (
    <div className="grid gap-6">
      <StatusNotice message={statusMessage(query.saved, t)} />
      <ProviderSection locale={locale} providers={providers} t={t} />
      <PlanSection billing={billing} locale={locale} plans={plans} t={t} />
      <CreationSection
        coupons={coupons}
        locale={locale}
        plans={plans}
        providers={providers}
        t={t}
      />
      <RatesSection locale={locale} t={t} />
    </div>
  );
}
