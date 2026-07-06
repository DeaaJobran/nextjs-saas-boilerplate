import type { BillingPrice } from "@nextjs-saas/billing";
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
  TextInput,
} from "@nextjs-saas/ui";
import { CreditCardIcon, ReceiptTextIcon, ShieldCheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { getBillingService } from "../../../../../lib/billing";
import { assertLocale } from "../../../../../lib/locale";
import { formatLocaleDateTime } from "../../../../../lib/locale-formatters";
import { getActiveTenantContext } from "../../../../../lib/tenant";
import {
  applySubscriptionDiscountAction,
  cancelSubscriptionAction,
  changeSubscriptionPlanAction,
  createCheckoutSessionAction,
  openBillingPortalAction,
  requestRefundAction,
  updateTaxSettingsAction,
  updateTenantBillingSettingsAction,
} from "./actions";

type BillingSearchParams = {
  status?: string;
};

function hasPermission(permissions: readonly string[], permission: string) {
  return permissions.includes(permission);
}

function statusMessage(
  status: string | undefined,
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  switch (status) {
    case "checkout-cancelled":
      return t("status.checkoutCancelled");
    case "checkout-started":
      return t("status.checkoutStarted");
    case "discount-applied":
      return t("status.discountApplied");
    case "refund-requested":
      return t("status.refundRequested");
    case "settings-updated":
      return t("status.settingsUpdated");
    case "subscription-cancel-requested":
      return t("status.subscriptionCancelRequested");
    case "tax-settings-updated":
      return t("status.taxSettingsUpdated");
    default:
      return undefined;
  }
}

function recurringPrice(prices: BillingPrice[]) {
  return (
    prices.find(
      (price) => price.interval === "month" && price.usageType === "licensed",
    ) ??
    prices.find(
      (price) => price.interval === "year" && price.usageType === "licensed",
    ) ??
    prices.find((price) => price.usageType !== "metered")
  );
}

export default async function BillingSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<BillingSearchParams>;
}) {
  const fallbackSearchParams: Promise<BillingSearchParams> = Promise.resolve(
    {},
  );
  const [{ locale: localeValue }, query] = await Promise.all([
    params,
    searchParams ?? fallbackSearchParams,
  ]);
  const locale = assertLocale(localeValue);
  const [t, context] = await Promise.all([
    getTranslations({ locale, namespace: "BillingSettings" }),
    getActiveTenantContext("billing.read"),
  ]);
  const billing = getBillingService();
  const [providers, settings, summary] = await Promise.all([
    billing.listPaymentProviders(),
    billing.getTenantSettings({
      actorId: context.effectiveUser.id,
      organizationId: context.organization.id,
    }),
    billing.listBillingSummary({
      actorId: context.effectiveUser.id,
      organizationId: context.organization.id,
    }),
  ]);
  const plans = await billing.listPublicPlans({
    locale,
    provider: settings.payment_provider,
  });
  const coupons = await billing.listCoupons({
    activeOnly: true,
    provider: settings.payment_provider,
  });
  const changePrices = plans.flatMap((plan) =>
    plan.prices
      .filter((price) => price.usageType === "licensed")
      .map((price) => ({
        label: `${plan.translation.name} - ${billing.formatCurrency({
          amountMinor: price.amountMinor,
          currency: price.currency,
          locale,
        })} ${t(`interval.${price.interval}`)}`,
        price,
      })),
  );
  const canManage = hasPermission(
    context.membership.permissions,
    "billing.manage",
  );
  const canRefund = hasPermission(
    context.membership.permissions,
    "billing.refund",
  );
  const message = statusMessage(query.status, t);

  return (
    <div className="grid gap-6">
      {message ? (
        <p
          className="text-muted-foreground bg-background rounded-md border p-3 text-sm"
          role="status"
        >
          {message}
        </p>
      ) : null}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.title")}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {t("settings.description")}
            </p>
          </CardHeader>
          <CardContent>
            <form
              action={updateTenantBillingSettingsAction}
              className="grid gap-4"
            >
              <input name="locale" type="hidden" value={locale} />
              <Field label={t("settings.provider")}>
                <SelectInput
                  defaultValue={settings.payment_provider}
                  disabled={!canManage}
                  name="paymentProvider"
                >
                  {providers.map((provider) => (
                    <option key={provider.provider} value={provider.provider}>
                      {provider.displayName}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("settings.currency")}>
                  <TextInput
                    defaultValue={settings.default_currency}
                    disabled={!canManage}
                    maxLength={3}
                    name="defaultCurrency"
                    required
                  />
                </Field>
                <Field label={t("settings.taxBehavior")}>
                  <SelectInput
                    defaultValue={settings.tax_behavior}
                    disabled={!canManage}
                    name="taxBehavior"
                  >
                    <option value="exclusive">
                      {t("taxBehavior.exclusive")}
                    </option>
                    <option value="inclusive">
                      {t("taxBehavior.inclusive")}
                    </option>
                    <option value="unspecified">
                      {t("taxBehavior.unspecified")}
                    </option>
                  </SelectInput>
                </Field>
              </div>
              <Button disabled={!canManage} type="submit">
                {t("settings.save")}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("tax.title")}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {t("tax.description")}
            </p>
          </CardHeader>
          <CardContent>
            <form action={updateTaxSettingsAction} className="grid gap-4">
              <input name="locale" type="hidden" value={locale} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("tax.businessName")}>
                  <TextInput
                    defaultValue={summary.taxSettings?.businessName}
                    disabled={!canManage}
                    name="businessName"
                  />
                </Field>
                <Field label={t("tax.taxId")}>
                  <TextInput
                    defaultValue={summary.taxSettings?.taxId}
                    disabled={!canManage}
                    name="taxId"
                  />
                </Field>
                <Field label={t("tax.country")}>
                  <TextInput
                    defaultValue={summary.taxSettings?.billingCountry}
                    disabled={!canManage}
                    maxLength={2}
                    name="billingCountry"
                  />
                </Field>
                <Field label={t("tax.region")}>
                  <TextInput
                    defaultValue={summary.taxSettings?.billingRegion}
                    disabled={!canManage}
                    name="billingRegion"
                  />
                </Field>
                <Field label={t("settings.taxBehavior")}>
                  <SelectInput
                    defaultValue={settings.tax_behavior}
                    disabled={!canManage}
                    name="taxBehavior"
                  >
                    <option value="exclusive">
                      {t("taxBehavior.exclusive")}
                    </option>
                    <option value="inclusive">
                      {t("taxBehavior.inclusive")}
                    </option>
                    <option value="unspecified">
                      {t("taxBehavior.unspecified")}
                    </option>
                  </SelectInput>
                </Field>
              </div>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  defaultChecked={summary.taxSettings?.taxExempt}
                  disabled={!canManage}
                  name="taxExempt"
                  type="checkbox"
                />
                {t("tax.taxExempt")}
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  defaultChecked={summary.taxSettings?.reverseCharge}
                  disabled={!canManage}
                  name="reverseCharge"
                  type="checkbox"
                />
                {t("tax.reverseCharge")}
              </label>
              <Button disabled={!canManage} type="submit">
                {t("tax.save")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => {
          const price = recurringPrice(plan.prices);

          return (
            <Card
              className={plan.highlighted ? "border-primary shadow-md" : ""}
              key={plan.id}
            >
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>{plan.translation.name}</CardTitle>
                  <Badge variant={plan.highlighted ? "success" : "outline"}>
                    {plan.trialDays > 0
                      ? t("plans.trial", { days: plan.trialDays })
                      : t("plans.available")}
                  </Badge>
                </div>
                <p className="text-3xl font-semibold">
                  {price
                    ? billing.formatCurrency({
                        amountMinor: price.amountMinor,
                        currency: price.currency,
                        locale,
                      })
                    : t("plans.noPrice")}
                </p>
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
                {price ? (
                  <form
                    action={createCheckoutSessionAction}
                    className="grid gap-3"
                  >
                    <input name="locale" type="hidden" value={locale} />
                    <input name="priceId" type="hidden" value={price.id} />
                    {plan.seatBased ? (
                      <Field label={t("plans.quantity")}>
                        <TextInput
                          defaultValue="1"
                          min={1}
                          name="quantity"
                          type="number"
                        />
                      </Field>
                    ) : (
                      <input name="quantity" type="hidden" value="1" />
                    )}
                    <Field label={t("coupons.code")}>
                      <TextInput
                        name="couponCode"
                        placeholder={t("coupons.optional")}
                      />
                    </Field>
                    <Button disabled={!canManage} type="submit">
                      <CreditCardIcon aria-hidden="true" className="size-4" />
                      {plan.translation.ctaLabel}
                    </Button>
                  </form>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </section>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t("subscriptions.title")}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {t("subscriptions.description")}
            </p>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form action={openBillingPortalAction}>
              <input name="locale" type="hidden" value={locale} />
              <Button disabled={!canManage} type="submit" variant="outline">
                <CreditCardIcon aria-hidden="true" className="size-4" />
                {t("subscriptions.portal")}
              </Button>
            </form>
            <DataTable
              columns={[
                {
                  cell: (subscription) => subscription.status,
                  header: t("subscriptions.status"),
                  key: "status",
                },
                {
                  cell: (subscription) => subscription.quantity,
                  header: t("subscriptions.quantity"),
                  key: "quantity",
                },
                {
                  cell: (subscription) =>
                    formatLocaleDateTime(locale, subscription.currentPeriodEnd),
                  header: t("subscriptions.renews"),
                  key: "renews",
                },
                {
                  cell: (subscription) => (
                    <div className="grid min-w-56 gap-2">
                      <form
                        action={changeSubscriptionPlanAction}
                        className="grid gap-2"
                      >
                        <input name="locale" type="hidden" value={locale} />
                        <input
                          name="subscriptionId"
                          type="hidden"
                          value={subscription.id}
                        />
                        <SelectInput name="priceId">
                          {changePrices.map(({ label, price }) => (
                            <option key={price.id} value={price.id}>
                              {label}
                            </option>
                          ))}
                        </SelectInput>
                        <TextInput
                          aria-label={t("subscriptions.quantity")}
                          defaultValue={String(subscription.quantity)}
                          min={1}
                          name="quantity"
                          type="number"
                        />
                        <Button
                          disabled={!canManage || changePrices.length === 0}
                          size="sm"
                          type="submit"
                          variant="outline"
                        >
                          {t("subscriptions.changePlan")}
                        </Button>
                      </form>
                      <form
                        action={applySubscriptionDiscountAction}
                        className="grid gap-2"
                      >
                        <input name="locale" type="hidden" value={locale} />
                        <input
                          name="subscriptionId"
                          type="hidden"
                          value={subscription.id}
                        />
                        <SelectInput name="couponCode">
                          {coupons.map((coupon) => (
                            <option key={coupon.id} value={coupon.code}>
                              {coupon.code} - {coupon.name}
                            </option>
                          ))}
                        </SelectInput>
                        <Button
                          disabled={!canManage || coupons.length === 0}
                          size="sm"
                          type="submit"
                          variant="outline"
                        >
                          {t("subscriptions.applyDiscount")}
                        </Button>
                      </form>
                      <form action={cancelSubscriptionAction}>
                        <input name="locale" type="hidden" value={locale} />
                        <input
                          name="subscriptionId"
                          type="hidden"
                          value={subscription.id}
                        />
                        <Button
                          disabled={!canManage}
                          size="sm"
                          type="submit"
                          variant="outline"
                        >
                          {t("subscriptions.cancel")}
                        </Button>
                      </form>
                    </div>
                  ),
                  header: t("subscriptions.action"),
                  key: "action",
                },
              ]}
              data={summary.subscriptions}
              emptyLabel={t("subscriptions.empty")}
            />
            <DataTable
              columns={[
                {
                  cell: (discount) => discount.code,
                  header: t("discounts.code"),
                  key: "code",
                },
                {
                  cell: (discount) => discount.status,
                  header: t("discounts.status"),
                  key: "status",
                },
                {
                  cell: (discount) =>
                    formatLocaleDateTime(locale, discount.startsAt),
                  header: t("discounts.starts"),
                  key: "starts",
                },
              ]}
              data={summary.discounts}
              emptyLabel={t("discounts.empty")}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("entitlements.title")}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {t("entitlements.description")}
            </p>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                {
                  cell: (entitlement) => entitlement.featureKey,
                  header: t("entitlements.feature"),
                  key: "feature",
                },
                {
                  cell: (entitlement) =>
                    entitlement.enabled ? (
                      <Badge variant="success">{t("enabled")}</Badge>
                    ) : (
                      <Badge variant="outline">{t("disabled")}</Badge>
                    ),
                  header: t("entitlements.status"),
                  key: "status",
                },
                {
                  cell: (entitlement) =>
                    entitlement.limitValue ?? t("unlimited"),
                  header: t("entitlements.limit"),
                  key: "limit",
                },
                {
                  cell: (entitlement) => entitlement.usedValue,
                  header: t("entitlements.used"),
                  key: "used",
                },
              ]}
              data={summary.entitlements}
              emptyLabel={t("entitlements.empty")}
            />
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptTextIcon aria-hidden="true" className="size-5" />
              {t("invoices.title")}
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              {t("invoices.description")}
            </p>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                {
                  cell: (invoice) => invoice.status,
                  header: t("invoices.status"),
                  key: "status",
                },
                {
                  cell: (invoice) =>
                    billing.formatCurrency({
                      amountMinor: invoice.totalMinor,
                      currency: invoice.currency,
                      locale,
                    }),
                  header: t("invoices.total"),
                  key: "total",
                },
                {
                  cell: (invoice) =>
                    formatLocaleDateTime(locale, invoice.issuedAt),
                  header: t("invoices.issued"),
                  key: "issued",
                },
                {
                  cell: (invoice) => (
                    <form action={requestRefundAction} className="grid gap-2">
                      <input name="locale" type="hidden" value={locale} />
                      <input
                        name="invoiceId"
                        type="hidden"
                        value={invoice.id}
                      />
                      <TextInput
                        aria-label={t("invoices.paymentId")}
                        name="providerPaymentId"
                        placeholder={t("invoices.paymentId")}
                        required
                      />
                      <TextInput
                        aria-label={t("invoices.refundAmount")}
                        name="amountMinor"
                        placeholder={t("invoices.refundAmount")}
                        type="number"
                      />
                      <Button
                        disabled={!canRefund}
                        size="sm"
                        type="submit"
                        variant="outline"
                      >
                        {t("invoices.refund")}
                      </Button>
                    </form>
                  ),
                  header: t("invoices.action"),
                  key: "action",
                },
              ]}
              data={summary.invoices}
              emptyLabel={t("invoices.empty")}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon aria-hidden="true" className="size-5" />
              {t("paymentMethods.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                {
                  cell: (method) => method.type,
                  header: t("paymentMethods.type"),
                  key: "type",
                },
                {
                  cell: (method) =>
                    [method.brand, method.last4].filter(Boolean).join(" "),
                  header: t("paymentMethods.details"),
                  key: "details",
                },
                {
                  cell: (method) => method.status,
                  header: t("paymentMethods.status"),
                  key: "status",
                },
              ]}
              data={summary.paymentMethods}
              emptyLabel={t("paymentMethods.empty")}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
