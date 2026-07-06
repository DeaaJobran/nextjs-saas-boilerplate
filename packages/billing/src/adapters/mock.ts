import { randomUUID } from "node:crypto";

import {
  type CheckoutSessionInput,
  type CheckoutSessionResult,
  type CouponInput,
  type CouponResult,
  type PaymentProviderAdapter,
  type ProviderWebhookEvent,
  type ProviderWebhookInput,
  type RefundInput,
  type RefundResult,
} from "../types";
import { signWebhookPayload, verifyWebhookSignature } from "./signatures";

export type MockPaymentAdapterOptions = {
  baseUrl?: string;
  webhookSecret?: string;
};

const defaultWebhookSecret =
  process.env.BILLING_MOCK_WEBHOOK_SECRET ??
  "local-mock-webhook-secret-change-me";

export function createMockPaymentProviderAdapter(
  options: MockPaymentAdapterOptions = {},
): PaymentProviderAdapter & {
  signEvent(event: ProviderWebhookEvent): {
    payload: string;
    signatureHeader: string;
  };
} {
  const baseUrl = options.baseUrl ?? "http://localhost:3000";
  const webhookSecret = options.webhookSecret ?? defaultWebhookSecret;

  return {
    capabilities: {
      checkout: true,
      portal: true,
      refunds: true,
      subscriptions: true,
      supportedCurrencies: ["USD", "EUR", "SAR"],
    },
    async createBillingPortalSession(input) {
      const id = `mock_portal_${randomUUID()}`;
      const url = new URL("/billing/mock/portal", baseUrl);

      url.searchParams.set("session", id);
      url.searchParams.set("tenant", input.tenantId);
      url.searchParams.set("return", input.returnUrl);

      return { id, url: url.toString() };
    },
    async createCheckoutSession(
      input: CheckoutSessionInput,
    ): Promise<CheckoutSessionResult> {
      const id = `mock_checkout_${randomUUID()}`;
      const url = new URL("/billing/mock/checkout", baseUrl);

      url.searchParams.set("session", id);
      url.searchParams.set("tenant", input.tenantId);
      url.searchParams.set("price", input.price.id);
      url.searchParams.set("mode", input.mode);
      if (input.discount) {
        url.searchParams.set("coupon", input.discount.code);
      }

      return {
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        id,
        status: "open",
        url: url.toString(),
      };
    },
    async createCoupon(input: CouponInput): Promise<CouponResult> {
      return {
        amountOffMinor: input.amountOffMinor,
        currency: input.currency,
        id: `mock_coupon_${input.code.toLowerCase()}`,
        percentOffBasisPoints: input.percentOffBasisPoints,
      };
    },
    async createRefund(input: RefundInput): Promise<RefundResult> {
      return {
        amountMinor: input.amountMinor ?? 0,
        currency: input.currency,
        id: `mock_refund_${randomUUID()}`,
        providerPaymentId: input.providerPaymentId,
        status: "succeeded",
      };
    },
    key: "mock",
    signEvent(event) {
      const payload = JSON.stringify(event);

      return {
        payload,
        signatureHeader: signWebhookPayload({
          payload,
          secret: webhookSecret,
        }),
      };
    },
    async updateSubscription() {
      return;
    },
    async verifyWebhook(
      input: ProviderWebhookInput,
    ): Promise<ProviderWebhookEvent> {
      verifyWebhookSignature({
        payload: input.rawBody,
        secret: webhookSecret,
        signatureHeader: input.signatureHeader,
      });

      const event = JSON.parse(input.rawBody) as ProviderWebhookEvent;

      if (!event.id || !event.type || !event.createdAt || !event.payload) {
        throw new Error("Mock webhook payload is invalid.");
      }

      return event;
    },
  };
}

export function createMockCheckoutCompletedEvent(input: {
  customerEmail?: string;
  providerCustomerId?: string;
  providerSessionId: string;
  providerSubscriptionId?: string;
  tenantId: string;
}): ProviderWebhookEvent {
  return {
    createdAt: new Date().toISOString(),
    id: `mock_event_${randomUUID()}`,
    payload: input,
    tenantId: input.tenantId,
    type: "checkout.session.completed",
  };
}
