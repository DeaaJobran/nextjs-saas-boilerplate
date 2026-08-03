import {
  createMockPaymentProviderAdapter,
  isMockPaymentProviderAllowed,
} from "@nextjs-saas/billing";
import { NextResponse } from "next/server";

import { getBillingService } from "@/lib/billing";

function redirectUrl(request: Request, value: string | null) {
  const requestUrl = new URL(request.url);
  const target = new URL(value || "/", requestUrl);
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
    : requestUrl.origin;

  if (target.origin !== requestUrl.origin && target.origin !== appOrigin) {
    return new URL("/", requestUrl);
  }

  return target;
}

function subscriptionPeriodEnd(input: {
  interval: string | null;
  intervalCount: number;
  startsAt: Date;
}) {
  const periodEnd = new Date(input.startsAt);

  if (input.interval === "year") {
    periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + input.intervalCount);
  } else {
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + input.intervalCount);
  }

  return periodEnd.toISOString();
}

export async function GET(request: Request) {
  if (!isMockPaymentProviderAllowed()) {
    return NextResponse.json(
      { error: "mock_payments_disabled" },
      { status: 404 },
    );
  }

  const requestUrl = new URL(request.url);
  const sessionId = requestUrl.searchParams.get("session");

  if (!sessionId) {
    return NextResponse.json(
      { error: "invalid_mock_checkout" },
      { status: 400 },
    );
  }

  const adapter = createMockPaymentProviderAdapter();
  const billing = getBillingService();
  let cancelUrl = new URL("/", requestUrl);

  try {
    const checkout = await billing.getPendingCheckoutSession({
      provider: "mock",
      providerSessionId: sessionId,
    });
    const successUrl = redirectUrl(request, checkout.successUrl);
    cancelUrl = redirectUrl(request, checkout.cancelUrl);
    const timestamp = new Date().toISOString();
    const trialEnd =
      checkout.trialDays > 0
        ? new Date(
            Date.now() + checkout.trialDays * 24 * 60 * 60 * 1000,
          ).toISOString()
        : undefined;
    const checkoutEvent = adapter.signEvent({
      createdAt: timestamp,
      id: `mock_event_checkout_${sessionId}`,
      payload: {
        providerCustomerId: `mock_customer_${checkout.tenantId}`,
        providerSessionId: sessionId,
        providerSubscriptionId:
          checkout.mode === "subscription"
            ? `mock_subscription_${sessionId}`
            : undefined,
        tenantId: checkout.tenantId,
      },
      tenantId: checkout.tenantId,
      type: "checkout.session.completed",
    });

    await billing.handleWebhook({
      provider: "mock",
      rawBody: checkoutEvent.payload,
      signatureHeader: checkoutEvent.signatureHeader,
    });

    if (checkout.mode === "subscription" && checkout.providerPriceId) {
      const subscriptionEvent = adapter.signEvent({
        createdAt: timestamp,
        id: `mock_event_subscription_${sessionId}`,
        payload: {
          currentPeriodEnd:
            trialEnd ??
            subscriptionPeriodEnd({
              interval: checkout.interval,
              intervalCount: checkout.intervalCount,
              startsAt: new Date(timestamp),
            }),
          currentPeriodStart: timestamp,
          priceProviderId: checkout.providerPriceId,
          providerCustomerId: `mock_customer_${checkout.tenantId}`,
          providerSubscriptionItemId: `mock_subscription_item_${sessionId}`,
          providerSubscriptionId: `mock_subscription_${sessionId}`,
          quantity: checkout.quantity,
          status: trialEnd ? "trialing" : "active",
          tenantId: checkout.tenantId,
          trialEnd,
          trialStart: trialEnd ? timestamp : undefined,
        },
        tenantId: checkout.tenantId,
        type: "customer.subscription.updated",
      });

      await billing.handleWebhook({
        provider: "mock",
        rawBody: subscriptionEvent.payload,
        signatureHeader: subscriptionEvent.signatureHeader,
      });
    }

    if (checkout.mode === "payment" || !trialEnd) {
      const invoiceEvent = adapter.signEvent({
        createdAt: timestamp,
        id: `mock_event_invoice_${sessionId}`,
        payload: {
          amountDueMinor: checkout.amountMinor,
          amountPaidMinor: checkout.amountMinor,
          currency: checkout.currency,
          discountMinor: checkout.discountMinor,
          issuedAt: timestamp,
          items: [
            {
              description: checkout.priceId,
              discountMinor: checkout.discountMinor,
              priceProviderId: checkout.providerPriceId,
              quantity: checkout.quantity,
              subtotalMinor: checkout.subtotalMinor,
              taxMinor: 0,
              totalMinor: checkout.amountMinor,
              unitAmountMinor: Math.round(
                checkout.subtotalMinor / checkout.quantity,
              ),
            },
          ],
          paidAt: timestamp,
          providerCustomerId: `mock_customer_${checkout.tenantId}`,
          providerInvoiceId: `mock_invoice_${sessionId}`,
          providerPaymentId: `mock_payment_${sessionId}`,
          providerSubscriptionId:
            checkout.mode === "subscription"
              ? `mock_subscription_${sessionId}`
              : undefined,
          status: "paid",
          subtotalMinor: checkout.subtotalMinor,
          taxBehavior: "exclusive",
          taxMinor: 0,
          tenantId: checkout.tenantId,
          totalMinor: checkout.amountMinor,
        },
        tenantId: checkout.tenantId,
        type: "invoice.paid",
      });

      await billing.handleWebhook({
        provider: "mock",
        rawBody: invoiceEvent.payload,
        signatureHeader: invoiceEvent.signatureHeader,
      });
    }

    return NextResponse.redirect(successUrl);
  } catch {
    return NextResponse.redirect(cancelUrl);
  }
}
