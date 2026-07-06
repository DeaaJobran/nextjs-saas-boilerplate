import { createMockPaymentProviderAdapter } from "@nextjs-saas/billing";
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

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const sessionId = requestUrl.searchParams.get("session");
  const tenantId = requestUrl.searchParams.get("tenant");
  const mode = requestUrl.searchParams.get("mode");
  const providerPriceId = requestUrl.searchParams.get("providerPrice");
  const quantity = Number(requestUrl.searchParams.get("quantity") ?? "1");
  const successUrl = redirectUrl(
    request,
    requestUrl.searchParams.get("success"),
  );
  const cancelUrl = redirectUrl(request, requestUrl.searchParams.get("cancel"));

  if (!sessionId || !tenantId || !Number.isInteger(quantity) || quantity < 1) {
    return NextResponse.json(
      { error: "invalid_mock_checkout" },
      { status: 400 },
    );
  }

  const adapter = createMockPaymentProviderAdapter();
  const billing = getBillingService();
  const timestamp = new Date().toISOString();
  const checkoutEvent = adapter.signEvent({
    createdAt: timestamp,
    id: `mock_event_checkout_${sessionId}`,
    payload: {
      providerCustomerId: `mock_customer_${tenantId}`,
      providerSessionId: sessionId,
      providerSubscriptionId:
        mode === "subscription" ? `mock_subscription_${sessionId}` : undefined,
      tenantId,
    },
    tenantId,
    type: "checkout.session.completed",
  });

  try {
    await billing.handleWebhook({
      provider: "mock",
      rawBody: checkoutEvent.payload,
      signatureHeader: checkoutEvent.signatureHeader,
    });

    if (mode === "subscription" && providerPriceId) {
      const subscriptionEvent = adapter.signEvent({
        createdAt: timestamp,
        id: `mock_event_subscription_${sessionId}`,
        payload: {
          currentPeriodEnd: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          currentPeriodStart: timestamp,
          priceProviderId: providerPriceId,
          providerCustomerId: `mock_customer_${tenantId}`,
          providerSubscriptionItemId: `mock_subscription_item_${sessionId}`,
          providerSubscriptionId: `mock_subscription_${sessionId}`,
          quantity,
          status: "active",
          tenantId,
        },
        tenantId,
        type: "customer.subscription.updated",
      });

      await billing.handleWebhook({
        provider: "mock",
        rawBody: subscriptionEvent.payload,
        signatureHeader: subscriptionEvent.signatureHeader,
      });
    }

    return NextResponse.redirect(successUrl);
  } catch {
    return NextResponse.redirect(cancelUrl);
  }
}
