"use server";

import type { BillingTaxBehavior } from "@nextjs-saas/billing";
import { appRoutes } from "@nextjs-saas/config/app";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentSession } from "../../../../../lib/auth";
import { getBillingService } from "../../../../../lib/billing";
import { getActiveTenantContext } from "../../../../../lib/tenant";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function positiveInteger(formData: FormData, key: string, fallback: string) {
  const value = Number(formValue(formData, key) || fallback);

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${key} must be a positive integer.`);
  }

  return value;
}

function optionalPositiveInteger(formData: FormData, key: string) {
  const rawValue = formValue(formData, key);

  if (!rawValue) {
    return undefined;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${key} must be a positive integer.`);
  }

  return value;
}

function localizedBillingPath(formData: FormData) {
  const locale = formValue(formData, "locale");

  return `/${locale}${appRoutes.billingSettings}`;
}

function redirectWithStatus(formData: FormData, status: string) {
  redirect(`${localizedBillingPath(formData)}?status=${status}`);
}

export async function cancelSubscriptionAction(formData: FormData) {
  await requireCurrentSession();

  const context = await getActiveTenantContext("billing.manage");

  await getBillingService().cancelSubscription({
    actorId: context.effectiveUser.id,
    organizationId: context.organization.id,
    subscriptionId: formValue(formData, "subscriptionId"),
  });
  revalidatePath(localizedBillingPath(formData));
  redirectWithStatus(formData, "subscription-cancel-requested");
}

export async function applySubscriptionDiscountAction(formData: FormData) {
  await requireCurrentSession();

  const context = await getActiveTenantContext("billing.manage");

  await getBillingService().applyDiscountToSubscription({
    actorId: context.effectiveUser.id,
    couponCode: formValue(formData, "couponCode"),
    organizationId: context.organization.id,
    subscriptionId: formValue(formData, "subscriptionId"),
  });
  revalidatePath(localizedBillingPath(formData));
  redirectWithStatus(formData, "discount-applied");
}

export async function createCheckoutSessionAction(formData: FormData) {
  const session = await requireCurrentSession();
  const context = await getActiveTenantContext("billing.manage");
  const basePath = localizedBillingPath(formData);
  const quantity = positiveInteger(formData, "quantity", "1");
  const checkout = await getBillingService().createCheckoutSession({
    actorId: context.effectiveUser.id,
    cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${basePath}?status=checkout-cancelled`,
    couponCode: formValue(formData, "couponCode") || undefined,
    customerEmail: session.user.email,
    organizationId: context.organization.id,
    priceId: formValue(formData, "priceId"),
    quantity,
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${basePath}?status=checkout-started`,
  });

  redirect(checkout.url);
}

export async function changeSubscriptionPlanAction(formData: FormData) {
  await requireCurrentSession();

  const context = await getActiveTenantContext("billing.manage");
  const quantity = positiveInteger(formData, "quantity", "1");

  await getBillingService().changeSubscriptionPlan({
    actorId: context.effectiveUser.id,
    organizationId: context.organization.id,
    priceId: formValue(formData, "priceId"),
    quantity,
    subscriptionId: formValue(formData, "subscriptionId"),
  });
  revalidatePath(localizedBillingPath(formData));
  redirectWithStatus(formData, "plan-change-requested");
}

export async function openBillingPortalAction(formData: FormData) {
  await requireCurrentSession();

  const context = await getActiveTenantContext("billing.manage");
  const portal = await getBillingService().createBillingPortalSession({
    actorId: context.effectiveUser.id,
    organizationId: context.organization.id,
    returnUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${localizedBillingPath(formData)}`,
  });

  redirect(portal.url);
}

export async function requestRefundAction(formData: FormData) {
  await requireCurrentSession();

  const context = await getActiveTenantContext("billing.refund");
  const amountMinor = optionalPositiveInteger(formData, "amountMinor");

  await getBillingService().requestRefund({
    actorId: context.effectiveUser.id,
    amountMinor,
    invoiceId: formValue(formData, "invoiceId"),
    providerPaymentId: formValue(formData, "providerPaymentId"),
    reason: formValue(formData, "reason") || undefined,
  });
  revalidatePath(localizedBillingPath(formData));
  redirectWithStatus(formData, "refund-requested");
}

export async function updateTenantBillingSettingsAction(formData: FormData) {
  await requireCurrentSession();

  const context = await getActiveTenantContext("billing.manage");

  await getBillingService().updateTenantBillingSettings({
    actorId: context.effectiveUser.id,
    defaultCurrency: formValue(formData, "defaultCurrency"),
    organizationId: context.organization.id,
    paymentProvider: formValue(formData, "paymentProvider"),
    taxBehavior: formValue(formData, "taxBehavior") as BillingTaxBehavior,
  });
  revalidatePath(localizedBillingPath(formData));
  redirectWithStatus(formData, "settings-updated");
}

export async function updateTaxSettingsAction(formData: FormData) {
  await requireCurrentSession();

  const context = await getActiveTenantContext("billing.manage");

  await getBillingService().updateTaxSettings({
    actorId: context.effectiveUser.id,
    billingCountry: formValue(formData, "billingCountry") || undefined,
    billingRegion: formValue(formData, "billingRegion") || undefined,
    businessName: formValue(formData, "businessName") || undefined,
    organizationId: context.organization.id,
    reverseCharge: formData.get("reverseCharge") === "on",
    taxBehavior: formValue(formData, "taxBehavior") as BillingTaxBehavior,
    taxExempt: formData.get("taxExempt") === "on",
    taxId: formValue(formData, "taxId") || undefined,
  });
  revalidatePath(localizedBillingPath(formData));
  redirectWithStatus(formData, "tax-settings-updated");
}
