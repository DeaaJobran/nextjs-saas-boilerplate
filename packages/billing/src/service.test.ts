import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  getDatabaseRuntime,
  type Queryable,
  resetDatabaseRuntimeForTests,
  runMigrations,
} from "@nextjs-saas/db";
import { createTenantService } from "@nextjs-saas/tenant";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createMockPaymentProviderAdapter } from "./adapters/mock";
import { createBillingService } from "./service";
import type { ProviderWebhookEvent, SubscriptionUpdateInput } from "./types";

let dataDir: string;
let databaseRuntimeOpened = false;
const fixedNow = new Date("2026-07-06T09:00:00.000Z");
const periodEnd = new Date("2026-08-06T09:00:00.000Z").toISOString();

async function createUser(
  client: Queryable,
  input: {
    displayName: string;
    email: string;
    id: string;
    role?: string;
  },
) {
  const timestamp = fixedNow.toISOString();

  await client.execute(
    `
      INSERT INTO auth_users (
        id,
        email,
        normalized_email,
        display_name,
        mfa_required,
        role,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, false, $5, $6, $6)
    `,
    [
      input.id,
      input.email,
      input.email.toLowerCase(),
      input.displayName,
      input.role ?? "user",
      timestamp,
    ],
  );
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "nextjs-saas-billing-"));
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATA_DIR = dataDir;
  databaseRuntimeOpened = false;
  resetDatabaseRuntimeForTests();
});

afterEach(async () => {
  if (databaseRuntimeOpened) {
    await (await getDatabaseRuntime()).close();
  }

  resetDatabaseRuntimeForTests();
  delete process.env.PGLITE_DATA_DIR;
  await rm(dataDir, { force: true, recursive: true });
});

async function createOwnerOrganization() {
  databaseRuntimeOpened = true;

  const runtime = await getDatabaseRuntime();

  await runMigrations(runtime);
  await createUser(runtime, {
    displayName: "Billing Owner",
    email: "billing-owner@example.test",
    id: "billing_owner",
  });

  const tenant = createTenantService({ client: runtime });
  const organization = await tenant.createOrganization({
    actorId: "billing_owner",
    name: "Billing Labs",
  });

  return { organization, runtime };
}

function signedEvent(
  adapter: ReturnType<typeof createMockPaymentProviderAdapter>,
  event: ProviderWebhookEvent,
) {
  return adapter.signEvent(event);
}

describe("billing service", () => {
  it("runs checkout, signed webhooks, entitlements, usage, invoices, and refunds end to end", async () => {
    const { organization, runtime } = await createOwnerOrganization();
    const adapter = createMockPaymentProviderAdapter({
      baseUrl: "https://app.example.test",
      webhookSecret: "test-webhook-secret",
    });
    const subscriptionUpdates: SubscriptionUpdateInput[] = [];
    const updateSubscription = adapter.updateSubscription.bind(adapter);

    adapter.updateSubscription = async (input) => {
      subscriptionUpdates.push(input);
      await updateSubscription(input);
    };
    const billing = createBillingService({
      adapters: [adapter],
      appBaseUrl: "https://app.example.test",
      client: runtime,
      now: () => fixedNow,
    });
    const plans = await billing.listPublicPlans({
      currency: "USD",
      locale: "en",
      provider: "mock",
    });
    const teamPlan = plans.find((plan) => plan.slug === "team");
    const teamPrice = teamPlan?.prices.find(
      (price) => price.interval === "month",
    );
    const teamYearlyPrice = teamPlan?.prices.find(
      (price) => price.interval === "year",
    );

    expect(teamPlan?.translation.name).toBe("Team");
    expect(teamPrice?.amountMinor).toBe(2900);

    await billing.upsertCoupon({
      actorId: "billing_owner",
      code: "TEAM20",
      discountType: "percent",
      duration: "once",
      name: "Team 20 percent",
      percentOffBasisPoints: 2000,
      provider: "mock",
    });

    const checkout = await billing.createCheckoutSession({
      actorId: "billing_owner",
      cancelUrl: "https://app.example.test/cancel",
      couponCode: "TEAM20",
      customerEmail: "billing-owner@example.test",
      organizationId: organization.id,
      priceId: teamPrice!.id,
      quantity: 3,
      successUrl: "https://app.example.test/success",
    });

    expect(checkout.url).toContain("mock");
    expect(checkout.url).toContain("coupon=TEAM20");

    const checkoutEvent = signedEvent(adapter, {
      createdAt: fixedNow.toISOString(),
      id: "evt_checkout_completed",
      payload: {
        customerEmail: "billing-owner@example.test",
        providerCustomerId: "cus_mock_1",
        providerSessionId: checkout.id,
        providerSubscriptionId: "sub_mock_1",
        tenantId: organization.id,
      },
      tenantId: organization.id,
      type: "checkout.session.completed",
    });

    await expect(
      billing.handleWebhook({
        provider: "mock",
        rawBody: checkoutEvent.payload,
        signatureHeader: checkoutEvent.signatureHeader,
      }),
    ).resolves.toEqual({
      eventId: "evt_checkout_completed",
      status: "processed",
    });
    await expect(
      billing.handleWebhook({
        provider: "mock",
        rawBody: checkoutEvent.payload,
        signatureHeader: checkoutEvent.signatureHeader,
      }),
    ).resolves.toEqual({
      eventId: "evt_checkout_completed",
      status: "duplicate",
    });

    const subscriptionEvent = signedEvent(adapter, {
      createdAt: fixedNow.toISOString(),
      id: "evt_subscription_updated",
      payload: {
        currentPeriodEnd: periodEnd,
        currentPeriodStart: fixedNow.toISOString(),
        priceProviderId: "mock_price_team_usd_month",
        providerCustomerId: "cus_mock_1",
        providerSubscriptionItemId: "si_mock_1",
        providerSubscriptionId: "sub_mock_1",
        quantity: 3,
        status: "active",
        tenantId: organization.id,
        trialEnd: periodEnd,
        trialStart: fixedNow.toISOString(),
      },
      tenantId: organization.id,
      type: "customer.subscription.updated",
    });

    await billing.handleWebhook({
      provider: "mock",
      rawBody: subscriptionEvent.payload,
      signatureHeader: subscriptionEvent.signatureHeader,
    });

    await expect(
      billing.hasEntitlement({
        actorId: "billing_owner",
        featureKey: "team_management",
        organizationId: organization.id,
      }),
    ).resolves.toBe(true);

    await expect(
      billing.recordUsage({
        actorId: "billing_owner",
        idempotencyKey: "usage-1",
        meterKey: "ai_tokens",
        organizationId: organization.id,
        quantity: 250,
      }),
    ).resolves.toEqual({ status: "recorded" });
    await expect(
      billing.recordUsage({
        actorId: "billing_owner",
        idempotencyKey: "usage-1",
        meterKey: "ai_tokens",
        organizationId: organization.id,
        quantity: 250,
      }),
    ).resolves.toEqual({ status: "duplicate" });

    const invoiceEvent = signedEvent(adapter, {
      createdAt: fixedNow.toISOString(),
      id: "evt_invoice_paid",
      payload: {
        amountDueMinor: 8700,
        amountPaidMinor: 8700,
        currency: "USD",
        discountMinor: 0,
        issuedAt: fixedNow.toISOString(),
        items: [
          {
            description: "Team monthly seats",
            priceProviderId: "mock_price_team_usd_month",
            quantity: 3,
            subtotalMinor: 8700,
            taxMinor: 0,
            totalMinor: 8700,
            unitAmountMinor: 2900,
          },
        ],
        paidAt: fixedNow.toISOString(),
        periodEnd,
        periodStart: fixedNow.toISOString(),
        providerCustomerId: "cus_mock_1",
        providerInvoiceId: "in_mock_1",
        providerSubscriptionId: "sub_mock_1",
        status: "paid",
        subtotalMinor: 8700,
        taxBehavior: "exclusive",
        taxMinor: 0,
        tenantId: organization.id,
        totalMinor: 8700,
      },
      tenantId: organization.id,
      type: "invoice.paid",
    });

    await billing.handleWebhook({
      provider: "mock",
      rawBody: invoiceEvent.payload,
      signatureHeader: invoiceEvent.signatureHeader,
    });

    const paymentMethodEvent = signedEvent(adapter, {
      createdAt: fixedNow.toISOString(),
      id: "evt_payment_method_attached",
      payload: {
        billingEmail: "billing-owner@example.test",
        billingName: "Billing Owner",
        brand: "visa",
        expMonth: 12,
        expYear: 2030,
        last4: "4242",
        providerCustomerId: "cus_mock_1",
        providerPaymentMethodId: "pm_mock_1",
        status: "active",
        type: "card",
      },
      tenantId: organization.id,
      type: "payment_method.attached",
    });

    await billing.handleWebhook({
      provider: "mock",
      rawBody: paymentMethodEvent.payload,
      signatureHeader: paymentMethodEvent.signatureHeader,
    });

    const summary = await billing.listBillingSummary({
      actorId: "billing_owner",
      organizationId: organization.id,
    });

    expect(summary.subscriptions[0]?.status).toBe("active");
    expect(summary.invoices[0]?.totalMinor).toBe(8700);
    expect(summary.paymentMethods[0]?.last4).toBe("4242");
    expect(
      summary.entitlements.find(
        (entitlement) => entitlement.featureKey === "ai_tokens",
      )?.usedValue,
    ).toBe(250);

    await billing.changeSubscriptionPlan({
      actorId: "billing_owner",
      organizationId: organization.id,
      priceId: teamYearlyPrice!.id,
      quantity: 4,
      subscriptionId: summary.subscriptions[0]!.id,
    });
    expect(subscriptionUpdates.at(-1)).toMatchObject({
      priceProviderId: "mock_price_team_usd_year",
      providerSubscriptionId: "sub_mock_1",
      providerSubscriptionItemId: "si_mock_1",
      quantity: 4,
    });

    await billing.applyDiscountToSubscription({
      actorId: "billing_owner",
      couponCode: "TEAM20",
      organizationId: organization.id,
      subscriptionId: summary.subscriptions[0]!.id,
    });
    expect(subscriptionUpdates.at(-1)).toMatchObject({
      providerCouponId: "mock_coupon_team20",
      providerSubscriptionId: "sub_mock_1",
    });
    await expect(
      billing.listBillingSummary({
        actorId: "billing_owner",
        organizationId: organization.id,
      }),
    ).resolves.toMatchObject({
      discounts: expect.arrayContaining([
        expect.objectContaining({
          code: "TEAM20",
          status: "active",
        }),
      ]),
    });

    const refund = await billing.requestRefund({
      actorId: "billing_owner",
      amountMinor: 1000,
      invoiceId: summary.invoices[0]!.id,
      providerPaymentId: "pi_mock_1",
      reason: "requested_by_customer",
    });

    expect(refund.status).toBe("succeeded");
  }, 30_000);

  it("supports tenant billing settings, currency conversion, and manual tax calculation", async () => {
    const { organization, runtime } = await createOwnerOrganization();
    const billing = createBillingService({
      client: runtime,
      now: () => fixedNow,
    });

    await billing.updateTenantBillingSettings({
      actorId: "billing_owner",
      defaultCurrency: "sar",
      organizationId: organization.id,
      paymentProvider: "mock",
      taxBehavior: "exclusive",
    });

    const settings = await billing.getTenantSettings({
      actorId: "billing_owner",
      organizationId: organization.id,
    });

    expect(settings.default_currency).toBe("SAR");

    await billing.upsertExchangeRate({
      actorId: "billing_owner",
      baseCurrency: "USD",
      provider: "manual",
      quoteCurrency: "SAR",
      rateMicroUnits: 3_750_000,
    });

    await expect(
      billing.convertCurrency({
        amountMinor: 1000,
        baseCurrency: "USD",
        quoteCurrency: "SAR",
      }),
    ).resolves.toBe(3750);

    await runtime.execute(
      `
        INSERT INTO billing_tax_rates (
          id,
          country,
          tax_type,
          percentage_basis_points,
          inclusive,
          active,
          provider,
          metadata,
          created_at,
          updated_at
        )
        VALUES (
          'tax_sa_vat',
          'SA',
          'VAT',
          1500,
          false,
          true,
          'manual',
          '{}'::jsonb,
          $1,
          $1
        )
      `,
      [fixedNow.toISOString()],
    );

    const tax = await billing.calculateTax({
      customer: {
        billingCountry: "SA",
      },
      line: {
        amountMinor: 10000,
        currency: "SAR",
        description: "Team plan",
        taxBehavior: "exclusive",
      },
    });

    expect(tax.taxMinor).toBe(1500);
    expect(tax.totalMinor).toBe(11500);
  }, 30_000);

  it("keeps entitlements active during a configured subscription grace period", async () => {
    const { organization, runtime } = await createOwnerOrganization();
    const adapter = createMockPaymentProviderAdapter({
      baseUrl: "https://app.example.test",
      webhookSecret: "test-webhook-secret",
    });
    const billing = createBillingService({
      adapters: [adapter],
      appBaseUrl: "https://app.example.test",
      client: runtime,
      now: () => fixedNow,
    });
    const subscriptionEvent = signedEvent(adapter, {
      createdAt: fixedNow.toISOString(),
      id: "evt_subscription_grace",
      payload: {
        currentPeriodEnd: periodEnd,
        currentPeriodStart: fixedNow.toISOString(),
        gracePeriodEndsAt: periodEnd,
        priceProviderId: "mock_price_team_usd_month",
        providerCustomerId: "cus_mock_grace",
        providerSubscriptionItemId: "si_mock_grace",
        providerSubscriptionId: "sub_mock_grace",
        quantity: 1,
        status: "canceled",
        tenantId: organization.id,
      },
      tenantId: organization.id,
      type: "customer.subscription.updated",
    });

    await billing.handleWebhook({
      provider: "mock",
      rawBody: subscriptionEvent.payload,
      signatureHeader: subscriptionEvent.signatureHeader,
    });

    await expect(
      billing.hasEntitlement({
        actorId: "billing_owner",
        featureKey: "team_management",
        organizationId: organization.id,
      }),
    ).resolves.toBe(true);
  }, 30_000);

  it("retries failed webhook events after dependencies become available", async () => {
    const { organization, runtime } = await createOwnerOrganization();
    const adapter = createMockPaymentProviderAdapter({
      baseUrl: "https://app.example.test",
      webhookSecret: "test-webhook-secret",
    });
    const billing = createBillingService({
      adapters: [adapter],
      appBaseUrl: "https://app.example.test",
      client: runtime,
      now: () => fixedNow,
    });
    const invoiceEvent = signedEvent(adapter, {
      createdAt: fixedNow.toISOString(),
      id: "evt_invoice_retry",
      payload: {
        amountDueMinor: 2900,
        amountPaidMinor: 2900,
        currency: "USD",
        discountMinor: 0,
        issuedAt: fixedNow.toISOString(),
        items: [],
        paidAt: fixedNow.toISOString(),
        periodEnd,
        periodStart: fixedNow.toISOString(),
        providerCustomerId: "cus_retry",
        providerInvoiceId: "in_retry",
        providerSubscriptionId: "sub_retry",
        status: "paid",
        subtotalMinor: 2900,
        taxBehavior: "exclusive",
        taxMinor: 0,
        tenantId: "",
        totalMinor: 2900,
      },
      type: "invoice.paid",
    });

    await expect(
      billing.handleWebhook({
        provider: "mock",
        rawBody: invoiceEvent.payload,
        signatureHeader: invoiceEvent.signatureHeader,
      }),
    ).rejects.toMatchObject({ code: "tenant_required" });

    const subscriptionEvent = signedEvent(adapter, {
      createdAt: fixedNow.toISOString(),
      id: "evt_subscription_retry",
      payload: {
        currentPeriodEnd: periodEnd,
        currentPeriodStart: fixedNow.toISOString(),
        priceProviderId: "mock_price_team_usd_month",
        providerCustomerId: "cus_retry",
        providerSubscriptionItemId: "si_retry",
        providerSubscriptionId: "sub_retry",
        quantity: 1,
        status: "active",
        tenantId: organization.id,
      },
      tenantId: organization.id,
      type: "customer.subscription.updated",
    });

    await billing.handleWebhook({
      provider: "mock",
      rawBody: subscriptionEvent.payload,
      signatureHeader: subscriptionEvent.signatureHeader,
    });
    await expect(
      billing.handleWebhook({
        provider: "mock",
        rawBody: invoiceEvent.payload,
        signatureHeader: invoiceEvent.signatureHeader,
      }),
    ).resolves.toEqual({
      eventId: "evt_invoice_retry",
      status: "processed",
    });
    await expect(
      billing.listBillingSummary({
        actorId: "billing_owner",
        organizationId: organization.id,
      }),
    ).resolves.toMatchObject({
      invoices: expect.arrayContaining([
        expect.objectContaining({ totalMinor: 2900 }),
      ]),
    });
  }, 30_000);
});
