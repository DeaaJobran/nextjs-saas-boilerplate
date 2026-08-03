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

function asNumericValue(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return asNumber(value);
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
  const recurring = asRecord(price.recurring);
  const usageType = asString(recurring.usage_type);

  return {
    providerPriceId: asString(price.id),
    usageType: (usageType === "metered"
      ? "metered"
      : Object.keys(recurring).length > 0
        ? "licensed"
        : "one_time") as BillingUsageType,
  };
}

function mapInvoiceLines(object: JsonRecord): ProviderInvoiceItem[] {
  const lines = asRecord(object.lines);

  return asArray(lines.data).map((rawLine) => {
    const line = asRecord(rawLine);
    const price = asRecord(line.price);
    const pricing = asRecord(line.pricing);
    const priceDetails = asRecord(pricing.price_details);
    const amount = asNumber(line.amount) ?? 0;
    const quantity = asNumber(line.quantity) ?? 1;
    const taxAmounts = asArray(line.taxes).length
      ? asArray(line.taxes)
      : asArray(line.tax_amounts);
    const taxMinor = taxAmounts.reduce(
      (total, rawTax) => total + (asNumber(asRecord(rawTax).amount) ?? 0),
      0,
    );
    const taxIsInclusive = taxAmounts.some(
      (rawTax) => asString(asRecord(rawTax).tax_behavior) === "inclusive",
    );
    const discountMinor = sumAmountArray(line.discount_amounts);
    const netAmount = amount - discountMinor;

    return {
      description: asString(line.description) ?? asString(price.nickname) ?? "",
      discountMinor,
      priceProviderId: asString(price.id) ?? asString(priceDetails.price),
      quantity,
      subtotalMinor: amount,
      taxBreakdown: taxAmounts.map((rawTax) => asRecord(rawTax)),
      taxMinor,
      totalMinor: taxIsInclusive ? netAmount : netAmount + taxMinor,
      unitAmountMinor: Math.round(
        asNumber(price.unit_amount) ??
          asNumericValue(pricing.unit_amount_decimal) ??
          amount / quantity,
      ),
    };
  });
}

function sumAmountArray(value: unknown) {
  return asArray(value).reduce(
    (total, rawAmount) => total + (asNumber(asRecord(rawAmount).amount) ?? 0),
    0,
  );
}

function invoiceSubscriptionDetails(object: JsonRecord) {
  const parent = asRecord(object.parent);

  return Object.keys(asRecord(parent.subscription_details)).length > 0
    ? asRecord(parent.subscription_details)
    : asRecord(object.subscription_details);
}

function invoiceSubscriptionId(object: JsonRecord) {
  return (
    asString(object.subscription) ??
    asString(invoiceSubscriptionDetails(object).subscription)
  );
}

function invoicePaymentIntentId(object: JsonRecord) {
  const paymentsObject = asRecord(object.payments);

  if (Object.keys(paymentsObject).length === 0) {
    return asString(object.payment_intent);
  }

  const refundablePayments = asArray(paymentsObject.data).filter(
    (rawPayment) => {
      const invoicePayment = asRecord(rawPayment);
      const payment = asRecord(invoicePayment.payment);

      return (
        asString(invoicePayment.status) === "paid" &&
        asString(payment.type) === "payment_intent" &&
        Boolean(asString(payment.payment_intent)) &&
        (asNumber(invoicePayment.amount_paid) ?? 0) > 0
      );
    },
  );

  if (refundablePayments.length !== 1) {
    return undefined;
  }

  const invoicePayment = asRecord(refundablePayments[0]);

  if (
    asNumber(invoicePayment.amount_paid) !== (asNumber(object.amount_paid) ?? 0)
  ) {
    return undefined;
  }

  return asString(asRecord(invoicePayment.payment).payment_intent);
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

  function requestUrl(path: string) {
    const normalizedBase = apiBaseUrl.endsWith("/")
      ? apiBaseUrl
      : `${apiBaseUrl}/`;
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

    return new URL(normalizedPath, normalizedBase);
  }

  async function request<T>(
    path: string,
    body: URLSearchParams,
    requestOptions: { idempotencyKey?: string } = {},
  ): Promise<T> {
    const response = await requestFetch(requestUrl(path), {
      body,
      headers: {
        Authorization: `Bearer ${options.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(requestOptions.idempotencyKey
          ? { "Idempotency-Key": requestOptions.idempotencyKey }
          : {}),
        "Stripe-Version": apiVersion,
      },
      method: "POST",
    });

    if (!response.ok) {
      let details = "";

      try {
        const responseBody = await response.text();
        const parsed = JSON.parse(responseBody) as {
          error?: { message?: string };
        };

        details = parsed.error?.message
          ? ` - ${parsed.error.message}`
          : responseBody
            ? ` - ${responseBody}`
            : "";
      } catch {
        details = "";
      }

      throw new Error(
        `Stripe-compatible request failed: ${response.status}${details}`,
      );
    }

    return (await response.json()) as T;
  }

  return {
    capabilities: {
      checkout: true,
      coupons: true,
      paymentMethods: true,
      portal: true,
      refunds: true,
      subscriptions: true,
      supportedCurrencies: ["USD", "EUR", "SAR", "GBP"],
      usageReporting: true,
      webhooks: true,
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
      const params: Record<string, unknown> = {
        cancel_url: input.cancelUrl,
        client_reference_id: input.clientReferenceId,
        customer_email: input.customerEmail,
        "discounts[0][coupon]": input.discount?.providerCouponId,
        "line_items[0][price]": input.price.providerPriceId,
        "line_items[0][quantity]":
          input.price.usageType === "metered" ? undefined : input.quantity,
        "metadata[tenantId]": input.tenantId,
        mode: input.mode,
        success_url: input.successUrl,
      };

      if (input.mode === "subscription") {
        params["subscription_data[metadata][tenantId]"] = input.tenantId;
        params["subscription_data[trial_period_days]"] =
          input.trialDays && input.trialDays > 0 ? input.trialDays : undefined;
      } else {
        params["invoice_creation[enabled]"] = true;
        params["invoice_creation[invoice_data][metadata][tenantId]"] =
          input.tenantId;
        params["payment_intent_data[metadata][tenantId]"] = input.tenantId;
      }

      const session = await request<JsonRecord>(
        "/v1/checkout/sessions",
        encodeForm(params),
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
      const metadata = Object.fromEntries(
        Object.entries(input.metadata ?? {}).map(([key, value]) => [
          `metadata[${key}]`,
          value,
        ]),
      );
      const refund = await request<JsonRecord>(
        "/v1/refunds",
        encodeForm({
          ...metadata,
          amount: input.amountMinor,
          "metadata[tenantId]": input.tenantId,
          payment_intent: input.providerPaymentId,
          reason: input.reason,
        }),
        { idempotencyKey: input.idempotencyKey },
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
    async reportUsage(input) {
      const event = await request<JsonRecord>(
        "/v1/billing/meter_events",
        encodeForm({
          event_name: input.meterKey,
          identifier: input.idempotencyKey,
          "payload[stripe_customer_id]": input.providerCustomerId,
          "payload[value]": input.quantity,
          timestamp: isoToUnix(input.occurredAt),
        }),
        { idempotencyKey: input.idempotencyKey },
      );

      return {
        id: asString(event.identifier) ?? input.idempotencyKey,
        status: "accepted",
      };
    },
    async updateSubscription(input) {
      const params: Record<string, unknown> = {
        cancel_at_period_end: input.cancelAtPeriodEnd,
        "discounts[0][coupon]": input.providerCouponId,
      };

      if (
        input.providerSubscriptionItemId &&
        (input.priceProviderId !== undefined || input.quantity !== undefined)
      ) {
        params["items[0][id]"] = input.providerSubscriptionItemId;
        params["items[0][price]"] = input.priceProviderId;
        params["items[0][quantity]"] = input.quantity;
      }

      await request<JsonRecord>(
        `/v1/subscriptions/${encodeURIComponent(input.providerSubscriptionId)}`,
        encodeForm(params),
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
      const eventId = asString(stripeEvent.id);
      const type = asString(stripeEvent.type);

      if (!eventId || !type || Object.keys(object).length === 0) {
        throw new Error("Stripe-compatible webhook payload is invalid.");
      }

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
          currentPeriodEnd: unixToIso(
            object.current_period_end ?? item.current_period_end,
          ),
          currentPeriodStart: unixToIso(
            object.current_period_start ?? item.current_period_start,
          ),
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
        const totalTaxes = asArray(object.total_taxes);
        const taxMinor = totalTaxes.length
          ? sumAmountArray(totalTaxes)
          : (asNumber(object.tax) ?? 0);
        const subscriptionDetails = invoiceSubscriptionDetails(object);

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
          providerPaymentId: invoicePaymentIntentId(object),
          providerSubscriptionId: invoiceSubscriptionId(object),
          status: asString(object.status) ?? "open",
          subtotalMinor: asNumber(object.subtotal) ?? 0,
          taxBehavior:
            (asString(asRecord(totalTaxes[0]).tax_behavior) as
              BillingTaxBehavior | undefined) ??
            ("exclusive" satisfies BillingTaxBehavior),
          taxMinor,
          tenantId: tenantId ?? metadataTenantId(subscriptionDetails),
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
        const metadata = asRecord(object.metadata);

        payload = {
          amountMinor: asNumber(object.amount) ?? 0,
          currency: currency(object.currency),
          idempotencyKey: asString(metadata.idempotencyKey),
          providerPaymentId: asString(object.payment_intent),
          providerRefundId: asString(object.id),
          reason: asString(object.reason),
          status: asString(object.status) ?? "pending",
          tenantId,
        };
      }

      return {
        createdAt: unixToIso(stripeEvent.created) ?? new Date().toISOString(),
        id: eventId,
        payload,
        tenantId: asString(payload.tenantId) ?? metadataTenantId(object),
        type,
      };
    },
  };
}
