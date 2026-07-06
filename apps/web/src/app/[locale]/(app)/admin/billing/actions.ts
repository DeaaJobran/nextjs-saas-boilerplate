"use server";

import type {
  BillingCouponDiscountType,
  BillingCouponDuration,
  BillingInterval,
  BillingTaxBehavior,
  BillingUsageType,
} from "@nextjs-saas/billing";
import { appRoutes } from "@nextjs-saas/config/app";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminAuth } from "../../../../../lib/admin-auth";
import { getBillingService } from "../../../../../lib/billing";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function integerValue(
  formData: FormData,
  key: string,
  options: { fallback?: string; max?: number; min?: number } = {},
) {
  const rawValue = formValue(formData, key) || options.fallback;
  const value = Number(rawValue);
  const min = options.min ?? 0;

  if (
    !Number.isInteger(value) ||
    value < min ||
    (options.max !== undefined && value > options.max)
  ) {
    throw new Error(`${key} must be a valid integer.`);
  }

  return value;
}

function optionalIntegerValue(
  formData: FormData,
  key: string,
  options: { max?: number; min?: number } = {},
) {
  if (!formValue(formData, key)) {
    return undefined;
  }

  return integerValue(formData, key, options);
}

function lines(value: string) {
  return value.split(/\r?\n|,/).flatMap((line) => {
    const trimmed = line.trim();

    return trimmed ? [trimmed] : [];
  });
}

function limits(value: string) {
  return Object.fromEntries(
    lines(value).map((line) => {
      const [key = "", rawValue = "0"] = line.split("=");

      return [key.trim(), Math.max(0, Number(rawValue.trim()) || 0)];
    }),
  );
}

function adminBillingPath(formData: FormData) {
  return `/${formValue(formData, "locale")}${appRoutes.adminBilling}`;
}

function revalidateBillingAdmin(formData: FormData) {
  const locale = formValue(formData, "locale");

  revalidatePath(adminBillingPath(formData));
  revalidatePath(`/${locale}${appRoutes.pricing}`);
}

function redirectSaved(formData: FormData, saved: string) {
  redirect(`${adminBillingPath(formData)}?saved=${saved}`);
}

export async function saveBillingProviderAction(formData: FormData) {
  const actorId = await requireAdminAuth();

  await getBillingService().updatePaymentProvider({
    actorId,
    capabilities: {
      checkout: formData.get("checkout") === "on",
      portal: formData.get("portal") === "on",
      refunds: formData.get("refunds") === "on",
      subscriptions: formData.get("subscriptions") === "on",
      supportedCurrencies: lines(formValue(formData, "supportedCurrencies")),
    },
    configuration: {
      apiBaseUrl: formValue(formData, "apiBaseUrl") || undefined,
      apiVersion: formValue(formData, "apiVersion") || undefined,
    },
    displayName: formValue(formData, "displayName"),
    enabled: formData.get("enabled") === "on",
    mode: formValue(formData, "mode"),
    provider: formValue(formData, "provider"),
    secretRef: formValue(formData, "secretRef") || undefined,
    webhookSecretRef: formValue(formData, "webhookSecretRef") || undefined,
  });
  revalidateBillingAdmin(formData);
  redirectSaved(formData, "provider");
}

export async function saveBillingPlanAction(formData: FormData) {
  const actorId = await requireAdminAuth();

  await getBillingService().upsertPlan({
    actorId,
    ctaLabel: formValue(formData, "ctaLabel"),
    description: formValue(formData, "description"),
    entitlements: {
      features: lines(formValue(formData, "entitlementFeatures")),
      limits: limits(formValue(formData, "entitlementLimits")),
    },
    features: lines(formValue(formData, "features")),
    highlighted: formData.get("highlighted") === "on",
    locale: formValue(formData, "translationLocale"),
    name: formValue(formData, "name"),
    planId: formValue(formData, "planId") || undefined,
    publicVisible: formData.get("publicVisible") === "on",
    seatBased: formData.get("seatBased") === "on",
    slug: formValue(formData, "slug"),
    sortOrder: integerValue(formData, "sortOrder", { fallback: "0" }),
    status: formValue(formData, "status"),
    trialDays: integerValue(formData, "trialDays", { fallback: "0" }),
    usageBased: formData.get("usageBased") === "on",
  });
  revalidateBillingAdmin(formData);
  redirectSaved(formData, "plan");
}

export async function saveBillingPriceAction(formData: FormData) {
  const actorId = await requireAdminAuth();

  await getBillingService().upsertPrice({
    active: formData.get("active") === "on",
    actorId,
    billingScheme: formValue(formData, "billingScheme"),
    currency: formValue(formData, "currency"),
    interval: formValue(formData, "interval") as BillingInterval,
    intervalCount: integerValue(formData, "intervalCount", {
      fallback: "1",
      min: 1,
    }),
    planId: formValue(formData, "planId"),
    priceId: formValue(formData, "priceId") || undefined,
    provider: formValue(formData, "provider"),
    providerPriceId: formValue(formData, "providerPriceId") || undefined,
    sortOrder: integerValue(formData, "sortOrder", { fallback: "0" }),
    taxBehavior: formValue(formData, "taxBehavior") as BillingTaxBehavior,
    unitAmountMinor: integerValue(formData, "unitAmountMinor", {
      fallback: "0",
    }),
    usageType: formValue(formData, "usageType") as BillingUsageType,
  });
  revalidateBillingAdmin(formData);
  redirectSaved(formData, "price");
}

export async function saveBillingCouponAction(formData: FormData) {
  const actorId = await requireAdminAuth();

  await getBillingService().upsertCoupon({
    active: formData.get("active") === "on",
    actorId,
    amountOffMinor: optionalIntegerValue(formData, "amountOffMinor", {
      min: 1,
    }),
    code: formValue(formData, "code"),
    currency: formValue(formData, "currency") || undefined,
    discountType: formValue(
      formData,
      "discountType",
    ) as BillingCouponDiscountType,
    duration: formValue(formData, "duration") as BillingCouponDuration,
    durationMonths: optionalIntegerValue(formData, "durationMonths", {
      min: 1,
    }),
    maxRedemptions: optionalIntegerValue(formData, "maxRedemptions", {
      min: 1,
    }),
    name: formValue(formData, "name"),
    percentOffBasisPoints: optionalIntegerValue(
      formData,
      "percentOffBasisPoints",
      {
        max: 10_000,
        min: 1,
      },
    ),
    provider: formValue(formData, "provider") || undefined,
    providerCouponId: formValue(formData, "providerCouponId") || undefined,
    redeemBy: formValue(formData, "redeemBy") || undefined,
  });
  revalidateBillingAdmin(formData);
  redirectSaved(formData, "coupon");
}

export async function saveExchangeRateAction(formData: FormData) {
  const actorId = await requireAdminAuth();

  await getBillingService().upsertExchangeRate({
    actorId,
    baseCurrency: formValue(formData, "baseCurrency"),
    manual: true,
    provider: formValue(formData, "provider"),
    quoteCurrency: formValue(formData, "quoteCurrency"),
    rateMicroUnits: integerValue(formData, "rateMicroUnits", { min: 1 }),
  });
  revalidateBillingAdmin(formData);
  redirectSaved(formData, "exchange-rate");
}

export async function saveTaxRateAction(formData: FormData) {
  const actorId = await requireAdminAuth();

  await getBillingService().upsertTaxRate({
    active: formData.get("active") === "on",
    actorId,
    country: formValue(formData, "country"),
    inclusive: formData.get("inclusive") === "on",
    percentageBasisPoints: integerValue(formData, "percentageBasisPoints"),
    provider: formValue(formData, "provider") || undefined,
    region: formValue(formData, "region") || undefined,
    taxRateId: formValue(formData, "taxRateId") || undefined,
    taxType: formValue(formData, "taxType"),
  });
  revalidateBillingAdmin(formData);
  redirectSaved(formData, "tax-rate");
}
