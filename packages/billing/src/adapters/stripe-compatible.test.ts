import { describe, expect, it } from "vitest";

import type { BillingPrice } from "../types";
import { signWebhookPayload } from "./signatures";
import { createStripeCompatiblePaymentProviderAdapter } from "./stripe-compatible";

const secret = "stripe-test-webhook-secret";

function price(input: Partial<BillingPrice> = {}): BillingPrice {
  return {
    active: true,
    amountMinor: 2,
    billingScheme: "per_unit",
    currency: "USD",
    id: "price_usage",
    interval: "usage",
    intervalCount: 1,
    metadata: { meterKey: "ai_tokens" },
    planId: "plan_team",
    provider: "stripe",
    providerPriceId: "price_stripe_usage",
    sortOrder: 1,
    taxBehavior: "exclusive",
    usageType: "metered",
    ...input,
  };
}

function signedPayload(event: Record<string, unknown>) {
  const rawBody = JSON.stringify(event);

  return {
    rawBody,
    signatureHeader: signWebhookPayload({ payload: rawBody, secret }),
  };
}

describe("Stripe-compatible payment adapter", () => {
  it("omits metered checkout quantity and reports idempotent provider usage and refunds", async () => {
    const requests: Array<{
      body: URLSearchParams;
      headers: Headers;
      pathname: string;
    }> = [];
    const fetchImpl: typeof fetch = async (request, init) => {
      const url = new URL(
        typeof request === "string" ? request : request.toString(),
      );
      const body = new URLSearchParams(String(init?.body));
      const headers = new Headers(init?.headers);

      requests.push({ body, headers, pathname: url.pathname });

      if (url.pathname === "/v1/checkout/sessions") {
        return Response.json({
          expires_at: 1_800_000_000,
          id: "cs_test_usage",
          status: "open",
          url: "https://checkout.example.test/cs_test_usage",
        });
      }

      if (url.pathname === "/v1/billing/meter_events") {
        return Response.json({ identifier: body.get("identifier") });
      }

      return Response.json({
        amount: 500,
        currency: "usd",
        id: "re_test_1",
        payment_intent: "pi_test_1",
        status: "succeeded",
      });
    };
    const adapter = createStripeCompatiblePaymentProviderAdapter({
      fetchImpl,
      secretKey: "sk_test_example",
      webhookSecret: secret,
    });

    await adapter.createCheckoutSession({
      appBaseUrl: "https://app.example.test",
      cancelUrl: "https://app.example.test/cancel",
      clientReferenceId: "tenant_1:checkout_1",
      currency: "USD",
      metadata: { tenantId: "tenant_1" },
      mode: "subscription",
      price: price(),
      quantity: 1,
      successUrl: "https://app.example.test/success",
      tenantId: "tenant_1",
    });
    await adapter.createCheckoutSession({
      appBaseUrl: "https://app.example.test",
      cancelUrl: "https://app.example.test/cancel",
      clientReferenceId: "tenant_1:checkout_2",
      currency: "USD",
      metadata: { tenantId: "tenant_1" },
      mode: "payment",
      price: price({
        amountMinor: 500,
        id: "price_one_time",
        interval: "one_time",
        providerPriceId: "price_stripe_one_time",
        usageType: "one_time",
      }),
      quantity: 1,
      successUrl: "https://app.example.test/success",
      tenantId: "tenant_1",
    });
    await adapter.reportUsage({
      idempotencyKey: "usage-event-1",
      meterKey: "ai_tokens",
      occurredAt: "2026-07-06T09:00:00.000Z",
      providerCustomerId: "cus_test_1",
      quantity: 250,
      tenantId: "tenant_1",
    });
    await adapter.createRefund({
      amountMinor: 500,
      currency: "USD",
      idempotencyKey: "refund-event-1",
      invoiceId: "invoice_1",
      metadata: { idempotencyKey: "customer-refund-1" },
      providerPaymentId: "pi_test_1",
      tenantId: "tenant_1",
    });

    const checkoutRequests = requests.filter(
      (request) => request.pathname === "/v1/checkout/sessions",
    );
    const meterRequest = requests.find(
      (request) => request.pathname === "/v1/billing/meter_events",
    )!;
    const refundRequest = requests.find(
      (request) => request.pathname === "/v1/refunds",
    )!;

    expect(checkoutRequests[0]?.body.has("line_items[0][quantity]")).toBe(
      false,
    );
    expect(checkoutRequests[1]?.body.get("invoice_creation[enabled]")).toBe(
      "true",
    );
    expect(Object.fromEntries(meterRequest.body)).toMatchObject({
      event_name: "ai_tokens",
      identifier: "usage-event-1",
      "payload[stripe_customer_id]": "cus_test_1",
      "payload[value]": "250",
    });
    expect(meterRequest.headers.get("idempotency-key")).toBe("usage-event-1");
    expect(refundRequest.headers.get("idempotency-key")).toBe("refund-event-1");
    expect(refundRequest.body.get("metadata[idempotencyKey]")).toBe(
      "customer-refund-1",
    );
  });

  it("maps current Stripe subscription and invoice webhook shapes", async () => {
    const adapter = createStripeCompatiblePaymentProviderAdapter({
      secretKey: "sk_test_example",
      webhookSecret: secret,
    });
    const subscription = signedPayload({
      created: 1_783_328_400,
      data: {
        object: {
          customer: "cus_test_1",
          id: "sub_test_1",
          items: {
            data: [
              {
                current_period_end: 1_785_920_400,
                current_period_start: 1_783_328_400,
                id: "si_test_1",
                price: {
                  id: "price_stripe_usage",
                  recurring: { usage_type: "metered" },
                },
                quantity: 1,
              },
            ],
          },
          metadata: { tenantId: "tenant_1" },
          status: "active",
        },
      },
      id: "evt_subscription_1",
      type: "customer.subscription.updated",
    });
    const subscriptionEvent = await adapter.verifyWebhook(subscription);

    expect(subscriptionEvent.payload).toMatchObject({
      currentPeriodEnd: "2026-08-05T09:00:00.000Z",
      currentPeriodStart: "2026-07-06T09:00:00.000Z",
      priceProviderId: "price_stripe_usage",
      providerSubscriptionItemId: "si_test_1",
      tenantId: "tenant_1",
    });

    const invoice = signedPayload({
      created: 1_783_328_400,
      data: {
        object: {
          amount_due: 1150,
          amount_paid: 1150,
          currency: "usd",
          id: "in_test_1",
          lines: {
            data: [
              {
                amount: 1150,
                description: "Metered usage",
                discount_amounts: [],
                pricing: {
                  price_details: { price: "price_stripe_usage" },
                  type: "price_details",
                  unit_amount_decimal: "1150",
                },
                quantity: 1,
                taxes: [
                  {
                    amount: 150,
                    tax_behavior: "inclusive",
                    type: "tax_rate_details",
                  },
                ],
              },
            ],
          },
          parent: {
            subscription_details: {
              metadata: { tenantId: "tenant_1" },
              subscription: "sub_test_1",
            },
            type: "subscription_details",
          },
          payments: {
            data: [
              {
                amount_paid: 1150,
                payment: {
                  payment_intent: "pi_test_1",
                  type: "payment_intent",
                },
                status: "paid",
              },
            ],
          },
          status: "paid",
          status_transitions: { paid_at: 1_783_328_400 },
          subtotal: 1000,
          total: 1150,
          total_discount_amounts: [],
          total_taxes: [{ amount: 150, tax_behavior: "inclusive" }],
        },
      },
      id: "evt_invoice_1",
      type: "invoice.paid",
    });
    const invoiceEvent = await adapter.verifyWebhook(invoice);

    expect(invoiceEvent.payload).toMatchObject({
      items: [
        expect.objectContaining({
          priceProviderId: "price_stripe_usage",
          taxMinor: 150,
          totalMinor: 1150,
          unitAmountMinor: 1150,
        }),
      ],
      providerPaymentId: "pi_test_1",
      providerSubscriptionId: "sub_test_1",
      taxBehavior: "inclusive",
      taxMinor: 150,
      tenantId: "tenant_1",
    });

    const itemizedInvoice = signedPayload({
      created: 1_783_328_400,
      data: {
        object: {
          amount_due: 1000,
          amount_paid: 1000,
          currency: "usd",
          id: "in_test_itemized",
          lines: {
            data: [
              {
                amount: 1000,
                description: "Itemized proration",
                discount_amounts: [{ amount: 300 }],
                pricing: {
                  price_details: { price: "price_stripe_usage" },
                  type: "price_details",
                  unit_amount_decimal: "1000",
                },
                quantity: 1,
                taxes: [{ amount: 70, tax_behavior: "exclusive" }],
              },
            ],
          },
          metadata: { tenantId: "tenant_1" },
          payments: {
            data: [
              {
                amount_paid: 500,
                payment: {
                  payment_intent: "pi_test_partial_1",
                  type: "payment_intent",
                },
                status: "paid",
              },
              {
                amount_paid: 500,
                payment: {
                  payment_intent: "pi_test_partial_2",
                  type: "payment_intent",
                },
                status: "paid",
              },
            ],
          },
          status: "paid",
          subtotal: 700,
          total: 770,
          total_discount_amounts: [{ amount: 300 }],
          total_taxes: [{ amount: 70, tax_behavior: "exclusive" }],
        },
      },
      id: "evt_invoice_itemized",
      type: "invoice.paid",
    });
    const itemizedInvoiceEvent = await adapter.verifyWebhook(itemizedInvoice);

    expect(itemizedInvoiceEvent.payload).toMatchObject({
      items: [
        expect.objectContaining({
          discountMinor: 300,
          subtotalMinor: 1000,
          taxMinor: 70,
          totalMinor: 770,
        }),
      ],
    });
    expect(itemizedInvoiceEvent.payload.providerPaymentId).toBeUndefined();
  });
});
