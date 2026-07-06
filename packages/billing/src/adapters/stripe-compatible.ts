import {
  type BillingPrice,
  type BillingTaxBehavior,
  type BillingUsageType,
  type CheckoutSessionInput,
  type CouponInput,
  type CouponResult,
  type PaymentProviderAdapter,
  type ProviderInvoiceItem,
  type ProviderWebhookEvent,
  type ProviderWebhookInput,
  type RefundInput,
  type RefundResult,
} from "../types";
import { verifyWebhookSignature } from "./signatures";

export type StripeCompatibleAdapterOptions = {
  apiBaseUrl?: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
  secretKey: string;
  webhookSecret: string;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function unixToIso(value: unknown) {
  const timestamp = asNumber(value);

  return timestamp ? new Date(timestamp * 1000).toISOString() : undefined;
}

function isoToUnix(value: string | undefined) {
  return value ? Math.floor(new Date(value).getTime() / 1000) : undefined;
}

function currency(value: unknown) {
  return (asString(value) ?? "USD").toUpperCase();
}

function metadataTenantId(object: JsonRecord) {
  const metadata = asRecord(object.metadata);

  return asString(metadata.tenantId) ?? asString(metadata.tenant_id);
}

function firstSubscriptionItem(object: JsonRecord) {
  const items = asRecord(object.items);
  const data = asArray(items.data);

  return asRecord(data[0]);
}

function priceFromItem(item: JsonRecord): Partial<BillingPrice> {
  const price = asRecord(item.price);

  return {
    providerPriceId: asString(price.id),
    usageType: (asString(price.recurring) ? "licensed" : "one_time") as
      BillingUsageType | undefined,
  };
}

function mapInvoiceLines(object: JsonRecord): ProviderInvoiceItem[] {
  const lines = asRecord(object.lines);

  return asArray(lines.data).map((rawLine) => {
    const line = asRecord(rawLine);
    const price = asRecord(line.price);
    const amount = asNumber(line.amount) ?? 0;
    const taxAmounts = asArray(line.tax_amounts);
    const taxMinor = taxAmounts.reduce(
      (total, rawTax) => total + (asNumber(asRecord(rawTax).amount) ?? 0),
      0,
    );

    return {
      description: asString(line.description) ?? asString(price.nickname) ?? "",
      discountMinor: 0,
      priceProviderId: asString(price.id),
      quantity: asNumber(line.quantity) ?? 1,
      subtotalMinor: amount,
      taxBreakdown: taxAmounts.map((rawTax) => asRecord(rawTax)),
      taxMinor,
      totalMinor: amount + taxMinor,
      unitAmountMinor: asNumber(price.unit_amount) ?? amount,
    };
  });
}

function sumAmountArray(value: unknown) {
  return asArray(value).reduce(
    (total, rawAmount) => total + (asNumber(asRecord(rawAmount).amount) ?? 0),
    0,
  );
}

function encodeForm(input: Record<string, unknown>) {
  const form = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) {
      continue;
    }

    form.set(key, String(value));
  }

  return form;
}

export function createStripeCompatiblePaymentProviderAdapter(
  options: StripeCompatibleAdapterOptions,
): PaymentProviderAdapter {
  const apiBaseUrl = options.apiBaseUrl ?? "https://api.stripe.com";
  const apiVersion = options.apiVersion ?? "2025-09-30.clover";
  const requestFetch = options.fetchImpl ?? fetch;

  async function request<T>(path: string, body: URLSearchParams): Promise<T> {
    const response = await requestFetch(new URL(path, apiBaseUrl), {
      body,
      headers: {
        Authorization: `Bearer ${options.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": apiVersion,
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Stripe-compatible request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  return {
    capabilities: {
      checkout: true,
      portal: true,
      refunds: true,
      subscriptions: true,
      supportedCurrencies: ["USD", "EUR", "SAR", "GBP"],
    },
    async createBillingPortalSession(input) {
      const session = await request<JsonRecord>(
        "/v1/billing_portal/sessions",
        encodeForm({
          customer: input.providerCustomerId,
          return_url: input.returnUrl,
        }),
      );

      return {
        id: asString(session.id) ?? "",
        url: asString(session.url) ?? input.returnUrl,
      };
    },
    async createCheckoutSession(input: CheckoutSessionInput) {
      const session = await request<JsonRecord>(
        "/v1/checkout/sessions",
        encodeForm({
          cancel_url: input.cancelUrl,
          client_reference_id: input.clientReferenceId,
          customer_email: input.customerEmail,
          "discounts[0][coupon]": input.discount?.providerCouponId,
          "line_items[0][price]": input.price.providerPriceId,
          "line_items[0][quantity]": input.quantity,
          "metadata[tenantId]": input.tenantId,
          mode: input.mode,
          "subscription_data[metadata][tenantId]": input.tenantId,
          "subscription_data[trial_period_days]":
            input.mode === "subscription" && input.trialDays
              ? input.trialDays
              : undefined,
          success_url: input.successUrl,
        }),
      );

      return {
        expiresAt: unixToIso(session.expires_at),
        id: asString(session.id) ?? "",
        status:
          asString(session.status) === "complete"
            ? "complete"
            : asString(session.status) === "expired"
              ? "expired"
              : "open",
        url: asString(session.url) ?? input.cancelUrl,
      };
    },
    async createCoupon(input: CouponInput): Promise<CouponResult> {
      const coupon = await request<JsonRecord>(
        "/v1/coupons",
        encodeForm({
          amount_off:
            input.discountType === "amount" ? input.amountOffMinor : undefined,
          currency:
            input.discountType === "amount" ? input.currency : undefined,
          duration: input.duration,
          duration_in_months:
            input.duration === "repeating" ? input.durationMonths : undefined,
          id: input.code,
          max_redemptions: input.maxRedemptions,
          name: input.name,
          percent_off:
            input.discountType === "percent" &&
            input.percentOffBasisPoints !== undefined
              ? input.percentOffBasisPoints / 100
              : undefined,
          redeem_by: isoToUnix(input.redeemBy),
        }),
      );

      return {
        amountOffMinor: asNumber(coupon.amount_off),
        currency: asString(coupon.currency ?? input.currency)?.toUpperCase(),
        id: asString(coupon.id) ?? input.code,
        percentOffBasisPoints:
          asNumber(coupon.percent_off) !== undefined
            ? Math.round((asNumber(coupon.percent_off) ?? 0) * 100)
            : undefined,
      };
    },
    async createRefund(input: RefundInput): Promise<RefundResult> {
      const refund = await request<JsonRecord>(
        "/v1/refunds",
        encodeForm({
          amount: input.amountMinor,
          "metadata[tenantId]": input.tenantId,
          payment_intent: input.providerPaymentId,
          reason: input.reason,
        }),
      );

      return {
        amountMinor: asNumber(refund.amount) ?? input.amountMinor ?? 0,
        currency: currency(refund.currency ?? input.currency),
        id: asString(refund.id) ?? "",
        providerPaymentId: asString(refund.payment_intent),
        status: asString(refund.status) ?? "pending",
      };
    },
    key: "stripe",
    async updateSubscription(input) {
      await request<JsonRecord>(
        `/v1/subscriptions/${encodeURIComponent(input.providerSubscriptionId)}`,
        encodeForm({
          cancel_at_period_end: input.cancelAtPeriodEnd,
          "discounts[0][coupon]": input.providerCouponId,
          "items[0][id]": input.providerSubscriptionItemId,
          "items[0][price]": input.priceProviderId,
          "items[0][quantity]": input.quantity,
        }),
      );
    },
    async verifyWebhook(
      input: ProviderWebhookInput,
    ): Promise<ProviderWebhookEvent> {
      verifyWebhookSignature({
        payload: input.rawBody,
        secret: options.webhookSecret,
        signatureHeader: input.signatureHeader,
      });

      const stripeEvent = JSON.parse(input.rawBody) as JsonRecord;
      const object = asRecord(asRecord(stripeEvent.data).object);
      const type = asString(stripeEvent.type) ?? "unknown";
      const tenantId = metadataTenantId(object);
      let payload: JsonRecord = object;

      if (type === "checkout.session.completed") {
        payload = {
          customerEmail: asString(object.customer_email),
          providerCustomerId: asString(object.customer),
          providerSessionId: asString(object.id),
          providerSubscriptionId: asString(object.subscription),
          tenantId,
        };
      } else if (type.startsWith("customer.subscription.")) {
        const item = firstSubscriptionItem(object);
        const price = priceFromItem(item);

        payload = {
          cancelAt: unixToIso(object.cancel_at),
          canceledAt: unixToIso(object.canceled_at),
          currentPeriodEnd: unixToIso(object.current_period_end),
          currentPeriodStart: unixToIso(object.current_period_start),
          priceProviderId: price.providerPriceId,
          providerCustomerId: asString(object.customer),
          providerSubscriptionItemId: asString(item.id),
          providerSubscriptionId: asString(object.id),
          quantity: asNumber(item.quantity) ?? 1,
          status: asString(object.status) ?? "incomplete",
          tenantId,
          trialEnd: unixToIso(object.trial_end),
          trialStart: unixToIso(object.trial_start),
        };
      } else if (type.startsWith("invoice.")) {
        payload = {
          amountDueMinor: asNumber(object.amount_due) ?? 0,
          amountPaidMinor: asNumber(object.amount_paid) ?? 0,
          currency: currency(object.currency),
          discountMinor: sumAmountArray(object.total_discount_amounts),
          dueAt: unixToIso(object.due_date),
          hostedInvoiceUrl: asString(object.hosted_invoice_url),
          issuedAt: unixToIso(object.created),
          items: mapInvoiceLines(object),
          paidAt: unixToIso(asRecord(object.status_transitions).paid_at),
          periodEnd: unixToIso(object.period_end),
          periodStart: unixToIso(object.period_start),
          providerCustomerId: asString(object.customer),
          providerInvoiceId: asString(object.id),
          providerSubscriptionId: asString(object.subscription),
          status: asString(object.status) ?? "open",
          subtotalMinor: asNumber(object.subtotal) ?? 0,
          taxBehavior: "exclusive" satisfies BillingTaxBehavior,
          taxMinor: asNumber(object.tax) ?? 0,
          tenantId:
            tenantId ?? metadataTenantId(asRecord(object.subscription_details)),
          totalMinor: asNumber(object.total) ?? 0,
        };
      } else if (type.startsWith("payment_method.")) {
        const card = asRecord(object.card);
        const billingDetails = asRecord(object.billing_details);

        payload = {
          billingEmail: asString(billingDetails.email),
          billingName: asString(billingDetails.name),
          brand: asString(card.brand),
          expMonth: asNumber(card.exp_month),
          expYear: asNumber(card.exp_year),
          last4: asString(card.last4),
          providerCustomerId: asString(object.customer),
          providerPaymentMethodId: asString(object.id),
          status: type.endsWith(".detached") ? "detached" : "active",
          tenantId,
          type: asString(object.type) ?? "unknown",
        };
      } else if (type === "refund.created" || type === "refund.updated") {
        payload = {
          amountMinor: asNumber(object.amount) ?? 0,
          currency: currency(object.currency),
          providerPaymentId: asString(object.payment_intent),
          providerRefundId: asString(object.id),
          reason: asString(object.reason),
          status: asString(object.status) ?? "pending",
          tenantId,
        };
      }

      return {
        createdAt: unixToIso(stripeEvent.created) ?? new Date().toISOString(),
        id: asString(stripeEvent.id) ?? "",
        payload,
        tenantId: asString(payload.tenantId),
        type,
      };
    },
  };
}
