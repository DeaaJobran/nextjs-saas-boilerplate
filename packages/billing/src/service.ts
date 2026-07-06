import { createHash, randomUUID } from "node:crypto";

import {
  getDatabaseRuntime,
  type Queryable,
  runMigrations,
} from "@nextjs-saas/db";
import {
  createTenantService,
  type TenantPermission,
} from "@nextjs-saas/tenant";

import { createMockPaymentProviderAdapter } from "./adapters/mock";
import { createStripeCompatiblePaymentProviderAdapter } from "./adapters/stripe-compatible";
import {
  convertCurrency,
  currencyDecimalPrecision,
  type ExchangeRate,
  formatCurrency,
  normalizeCurrency,
} from "./currency";
import { createManualTaxProvider, type TaxCustomer } from "./tax";
import {
  type BillingCoupon,
  type BillingCouponDiscountType,
  type BillingCouponDuration,
  type BillingDiscount,
  type BillingEntitlementConfig,
  type BillingInterval,
  type BillingPlan,
  type BillingPlanTranslation,
  type BillingPrice,
  type BillingProviderKey,
  type BillingTaxBehavior,
  type BillingUsageType,
  type CheckoutCompletedEvent,
  type InvoiceChangedEvent,
  type PaymentMethodChangedEvent,
  type PaymentProviderAdapter,
  type ProviderInvoiceItem,
  type ProviderWebhookEvent,
  type RefundChangedEvent,
  type SubscriptionChangedEvent,
} from "./types";

const defaultLocale = "en";

type BillingServiceOptions = {
  adapters?: PaymentProviderAdapter[];
  appBaseUrl?: string;
  client?: Queryable;
  now?: () => Date;
};

type TransactionalQueryable = Queryable & {
  transaction<T>(callback: (client: Queryable) => Promise<T>): Promise<T>;
};

type ProviderRow = {
  capabilities: Record<string, unknown> | string;
  configuration: Record<string, unknown> | string;
  display_name: string;
  enabled: boolean;
  mode: string;
  provider: string;
  secret_ref: string | null;
  updated_at: Date | string;
  webhook_secret_ref: string | null;
};

type PlanRow = {
  entitlements: Record<string, unknown> | string;
  highlighted: boolean;
  id: string;
  metadata: Record<string, unknown> | string;
  public_visible: boolean;
  seat_based: boolean;
  slug: string;
  sort_order: number;
  status: string;
  trial_days: number;
  usage_based: boolean;
};

type PlanTranslationRow = {
  cta_label: string;
  description: string;
  features: string[] | string;
  locale: string;
  name: string;
  plan_id: string;
};

type PriceRow = {
  active: boolean;
  billing_scheme: string;
  currency: string;
  id: string;
  interval: BillingInterval;
  interval_count: number;
  metadata: Record<string, unknown> | string;
  plan_id: string;
  provider: string;
  provider_price_id: string | null;
  sort_order: number;
  tax_behavior: BillingTaxBehavior;
  unit_amount_minor: number | string;
  usage_type: BillingUsageType;
};

type SubscriptionRow = {
  cancel_at: Date | string | null;
  canceled_at: Date | string | null;
  created_at: Date | string;
  current_period_end: Date | string | null;
  current_period_start: Date | string | null;
  grace_period_ends_at: Date | string | null;
  id: string;
  metadata: Record<string, unknown> | string;
  plan_id: string;
  price_id: string;
  provider: string;
  provider_customer_id: string | null;
  provider_subscription_id: string;
  provider_subscription_item_id: string | null;
  quantity: number;
  status: string;
  tenant_id: string;
  trial_end: Date | string | null;
  trial_start: Date | string | null;
  updated_at: Date | string;
};

type InvoiceRow = {
  amount_due_minor: number | string;
  amount_paid_minor: number | string;
  currency: string;
  discount_minor: number | string;
  due_at: Date | string | null;
  hosted_invoice_url: string | null;
  id: string;
  issued_at: Date | string | null;
  paid_at: Date | string | null;
  period_end: Date | string | null;
  period_start: Date | string | null;
  provider: string;
  provider_invoice_id: string;
  status: string;
  subscription_id: string | null;
  subtotal_minor: number | string;
  tax_behavior: BillingTaxBehavior;
  tax_minor: number | string;
  tenant_id: string;
  total_minor: number | string;
};

type PaymentMethodRow = {
  billing_email: string | null;
  billing_name: string | null;
  brand: string | null;
  exp_month: number | null;
  exp_year: number | null;
  id: string;
  last4: string | null;
  provider: string;
  provider_payment_method_id: string;
  status: string;
  tenant_id: string;
  type: string;
};

type EntitlementRow = {
  enabled: boolean;
  feature_key: string;
  limit_value: number | string | null;
  source: string;
  used_value: number | string;
};

type TenantSettingsRow = {
  default_currency: string;
  payment_provider: string;
  tax_behavior: BillingTaxBehavior;
  tenant_id: string;
};

type TaxRuleRow = {
  country: string;
  inclusive: boolean;
  percentage_basis_points: number;
  region: string | null;
  tax_type: string;
};

type TaxSettingsRow = {
  billing_country: string | null;
  billing_region: string | null;
  business_name: string | null;
  reverse_charge: boolean;
  tax_behavior: BillingTaxBehavior;
  tax_exempt: boolean;
  tax_id: string | null;
};

type ExchangeRateRow = {
  base_currency: string;
  quote_currency: string;
  rate_micro_units: number | string;
};

type CouponRow = {
  active: boolean;
  amount_off_minor: number | string | null;
  code: string;
  created_at: Date | string;
  currency: string | null;
  discount_type: BillingCouponDiscountType | string;
  duration: BillingCouponDuration | string;
  duration_months: number | null;
  id: string;
  max_redemptions: number | null;
  metadata: Record<string, unknown> | string;
  name: string;
  percent_off_basis_points: number | null;
  provider: string | null;
  provider_coupon_id: string | null;
  redeem_by: Date | string | null;
  updated_at: Date | string;
};

type DiscountRow = {
  code: string;
  coupon_id: string;
  ends_at: Date | string | null;
  id: string;
  name: string;
  provider: string | null;
  provider_discount_id: string | null;
  starts_at: Date | string;
  status: string;
  subscription_id: string | null;
  tenant_id: string;
};

export class BillingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

function parseJson<T>(value: T | string | null | undefined, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === "number" ? value : Number(value);
}

function optionalTimestamp(value?: string) {
  return value ? new Date(value).toISOString() : null;
}

function webhookBodyHash(rawBody: string) {
  return createHash("sha256").update(rawBody).digest("hex");
}

function defaultAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function defaultAdapters() {
  const adapters: PaymentProviderAdapter[] = [
    createMockPaymentProviderAdapter(),
  ];

  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) {
    adapters.push(
      createStripeCompatiblePaymentProviderAdapter({
        apiBaseUrl: process.env.STRIPE_API_BASE_URL,
        apiVersion: process.env.STRIPE_API_VERSION,
        secretKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      }),
    );
  }

  return adapters;
}

function toPrice(row: PriceRow): BillingPrice {
  return {
    active: row.active,
    amountMinor: toNumber(row.unit_amount_minor),
    billingScheme: row.billing_scheme,
    currency: row.currency,
    id: row.id,
    interval: row.interval,
    intervalCount: row.interval_count,
    metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
    planId: row.plan_id,
    provider: row.provider,
    providerPriceId: row.provider_price_id ?? undefined,
    sortOrder: row.sort_order,
    taxBehavior: row.tax_behavior,
    usageType: row.usage_type,
  };
}

function toPlan(
  row: PlanRow,
  translations: PlanTranslationRow[],
  prices: PriceRow[],
  locale: string,
): BillingPlan {
  const planTranslations = translations.filter(
    (candidate) => candidate.plan_id === row.id,
  );
  const translation =
    planTranslations.find((candidate) => candidate.locale === locale) ??
    planTranslations.find((candidate) => candidate.locale === defaultLocale) ??
    planTranslations[0];
  const planTranslation: BillingPlanTranslation = translation
    ? {
        ctaLabel: translation.cta_label,
        description: translation.description,
        features: parseJson<string[]>(translation.features, []),
        locale: translation.locale,
        name: translation.name,
      }
    : {
        ctaLabel: row.slug,
        description: row.slug,
        features: [],
        locale,
        name: row.slug,
      };

  return {
    entitlements: parseJson<BillingEntitlementConfig>(row.entitlements, {}),
    highlighted: row.highlighted,
    id: row.id,
    metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
    prices: prices
      .filter((price) => price.plan_id === row.id)
      .map(toPrice)
      .sort((left, right) => left.sortOrder - right.sortOrder),
    publicVisible: row.public_visible,
    seatBased: row.seat_based,
    slug: row.slug,
    sortOrder: row.sort_order,
    status: row.status,
    translation: planTranslation,
    trialDays: row.trial_days,
    usageBased: row.usage_based,
  };
}

function toCoupon(row: CouponRow): BillingCoupon {
  return {
    active: row.active,
    amountOffMinor:
      row.amount_off_minor === null
        ? undefined
        : toNumber(row.amount_off_minor),
    code: row.code,
    currency: row.currency ?? undefined,
    discountType: row.discount_type,
    duration: row.duration,
    durationMonths: row.duration_months ?? undefined,
    id: row.id,
    maxRedemptions: row.max_redemptions ?? undefined,
    metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
    name: row.name,
    percentOffBasisPoints: row.percent_off_basis_points ?? undefined,
    provider: row.provider ?? undefined,
    providerCouponId: row.provider_coupon_id ?? undefined,
    redeemBy: toIsoString(row.redeem_by),
  };
}

function toDiscount(row: DiscountRow): BillingDiscount {
  return {
    code: row.code,
    couponId: row.coupon_id,
    endsAt: toIsoString(row.ends_at),
    id: row.id,
    name: row.name,
    provider: row.provider ?? undefined,
    providerDiscountId: row.provider_discount_id ?? undefined,
    startsAt: toIsoString(row.starts_at)!,
    status: row.status,
    subscriptionId: row.subscription_id ?? undefined,
    tenantId: row.tenant_id,
  };
}

function providerCapabilities(row: ProviderRow) {
  const capabilities = parseJson<Record<string, unknown>>(row.capabilities, {});
  const supportedCurrencies = Array.isArray(capabilities.supportedCurrencies)
    ? capabilities.supportedCurrencies
        .filter((currency): currency is string => typeof currency === "string")
        .map(normalizeCurrency)
    : [];

  return {
    checkout: capabilities.checkout === true,
    portal: capabilities.portal === true,
    refunds: capabilities.refunds === true,
    subscriptions: capabilities.subscriptions === true,
    supportedCurrencies,
  };
}

function assertSupportedCurrency(input: {
  currency: string;
  provider: ProviderRow;
}) {
  const supportedCurrencies = providerCapabilities(
    input.provider,
  ).supportedCurrencies;

  if (
    supportedCurrencies.length > 0 &&
    !supportedCurrencies.includes(normalizeCurrency(input.currency))
  ) {
    throw new BillingError(
      "Payment provider does not support the selected currency.",
      "unsupported_currency",
    );
  }
}

function activeSubscriptionStatus(status: string) {
  return ["active", "trialing", "past_due"].includes(status);
}

function checkoutModeForPrice(price: BillingPrice) {
  return price.interval === "one_time" || price.usageType === "one_time"
    ? "payment"
    : "subscription";
}

export function createBillingService(options: BillingServiceOptions = {}) {
  const now = options.now ?? (() => new Date());
  const appBaseUrl = options.appBaseUrl ?? defaultAppBaseUrl();
  const adapters = new Map(
    (options.adapters ?? defaultAdapters()).map((adapter) => [
      adapter.key,
      adapter,
    ]),
  );

  async function getClient() {
    if (options.client) {
      await runMigrations(options.client);

      return options.client;
    }

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);

    return runtime;
  }

  async function withTransaction<T>(
    client: Queryable,
    callback: (transaction: Queryable) => Promise<T>,
  ) {
    if (
      "transaction" in client &&
      typeof (client as Partial<TransactionalQueryable>).transaction ===
        "function"
    ) {
      return (client as TransactionalQueryable).transaction(callback);
    }

    return callback(client);
  }

  async function requireTenantPermission(input: {
    actorId: string;
    client: Queryable;
    organizationId: string;
    permission: TenantPermission;
  }) {
    const tenant = createTenantService({ client: input.client });

    return tenant.requireMembership({
      organizationId: input.organizationId,
      permission: input.permission,
      userId: input.actorId,
    });
  }

  async function audit(
    client: Queryable,
    input: {
      actorId?: string;
      eventType: string;
      payload?: Record<string, unknown>;
      subjectId?: string;
      subjectType?: string;
      tenantId?: string;
    },
  ) {
    await client.execute(
      `
        INSERT INTO billing_audit_events (
          id,
          tenant_id,
          actor_id,
          event_type,
          subject_type,
          subject_id,
          payload,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      `,
      [
        randomUUID(),
        input.tenantId,
        input.actorId,
        input.eventType,
        input.subjectType,
        input.subjectId,
        JSON.stringify(input.payload ?? {}),
        now().toISOString(),
      ],
    );
  }

  async function getProviderRow(client: Queryable, provider: string) {
    const rows = await client.execute<ProviderRow>(
      "SELECT * FROM billing_payment_providers WHERE provider = $1",
      [provider],
    );

    if (!rows[0]) {
      throw new BillingError(
        "Billing provider is not configured.",
        "provider_not_found",
      );
    }

    return rows[0];
  }

  function getAdapter(provider: BillingProviderKey) {
    const adapter = adapters.get(provider);

    if (!adapter) {
      throw new BillingError(
        "Billing provider adapter is not available.",
        "adapter_not_found",
      );
    }

    return adapter;
  }

  async function getTenantSettingsRow(
    client: Queryable,
    organizationId: string,
  ): Promise<TenantSettingsRow> {
    const existingRows = await client.execute<TenantSettingsRow>(
      "SELECT * FROM billing_tenant_settings WHERE tenant_id = $1",
      [organizationId],
    );

    if (existingRows[0]) {
      return existingRows[0];
    }

    const timestamp = now().toISOString();
    const insertedRows = await client.execute<TenantSettingsRow>(
      `
        INSERT INTO billing_tenant_settings (
          tenant_id,
          default_currency,
          payment_provider,
          tax_behavior,
          created_at,
          updated_at
        )
        VALUES ($1, 'USD', 'mock', 'exclusive', $2, $2)
        RETURNING *
      `,
      [organizationId, timestamp],
    );

    return insertedRows[0]!;
  }

  async function findPriceById(client: Queryable, priceId: string) {
    const rows = await client.execute<PriceRow>(
      "SELECT * FROM billing_prices WHERE id = $1 AND active = true",
      [priceId],
    );

    return rows[0] ? toPrice(rows[0]) : undefined;
  }

  async function findPriceByProviderId(
    client: Queryable,
    provider: string,
    providerPriceId?: string,
  ) {
    if (!providerPriceId) {
      return undefined;
    }

    const rows = await client.execute<PriceRow>(
      "SELECT * FROM billing_prices WHERE provider = $1 AND provider_price_id = $2",
      [provider, providerPriceId],
    );

    return rows[0] ? toPrice(rows[0]) : undefined;
  }

  async function findPlanRow(client: Queryable, planId: string) {
    const rows = await client.execute<PlanRow>(
      "SELECT * FROM billing_plans WHERE id = $1",
      [planId],
    );

    return rows[0];
  }

  async function findRedeemableCoupon(input: {
    client: Queryable;
    code: string;
    currency: string;
    provider: string;
  }) {
    const code = input.code.trim().toUpperCase();

    if (!code) {
      return undefined;
    }

    const rows = await input.client.execute<CouponRow>(
      `
        SELECT *
        FROM billing_coupons
        WHERE upper(code) = $1
          AND active = true
          AND (redeem_by IS NULL OR redeem_by >= $2)
      `,
      [code, now().toISOString()],
    );
    const coupon = rows[0];

    if (!coupon) {
      throw new BillingError("Coupon is not active.", "coupon_not_found");
    }

    if (coupon.provider && coupon.provider !== input.provider) {
      throw new BillingError(
        "Coupon is not available for this payment provider.",
        "coupon_provider_mismatch",
      );
    }

    if (!coupon.provider_coupon_id) {
      throw new BillingError(
        "Coupon is missing its provider coupon id.",
        "coupon_provider_id_required",
      );
    }

    if (
      coupon.discount_type === "amount" &&
      coupon.currency &&
      normalizeCurrency(coupon.currency) !== normalizeCurrency(input.currency)
    ) {
      throw new BillingError(
        "Coupon currency does not match the selected price.",
        "coupon_currency_mismatch",
      );
    }

    if (coupon.max_redemptions !== null) {
      const redemptionRows = await input.client.execute<{ count: string }>(
        `
          SELECT count(*)::text AS count
          FROM billing_discounts
          WHERE coupon_id = $1
            AND status IN ('active', 'pending_checkout')
        `,
        [coupon.id],
      );

      if (Number(redemptionRows[0]?.count ?? 0) >= coupon.max_redemptions) {
        throw new BillingError(
          "Coupon redemption limit has been reached.",
          "coupon_redemption_limit_reached",
        );
      }
    }

    return toCoupon(coupon);
  }

  async function upsertCustomer(
    client: Queryable,
    input: {
      email?: string;
      name?: string;
      provider: string;
      providerCustomerId: string;
      tenantId: string;
    },
  ) {
    const timestamp = now().toISOString();

    await client.execute(
      `
        INSERT INTO billing_customers (
          id,
          tenant_id,
          provider,
          provider_customer_id,
          email,
          name,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        ON CONFLICT (provider, provider_customer_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          email = COALESCE(EXCLUDED.email, billing_customers.email),
          name = COALESCE(EXCLUDED.name, billing_customers.name),
          updated_at = EXCLUDED.updated_at
      `,
      [
        randomUUID(),
        input.tenantId,
        input.provider,
        input.providerCustomerId,
        input.email,
        input.name,
        timestamp,
      ],
    );
  }

  async function upsertSubscriptionFromEvent(
    client: Queryable,
    provider: string,
    payload: SubscriptionChangedEvent,
  ) {
    const price = await findPriceByProviderId(
      client,
      provider,
      payload.priceProviderId,
    );

    if (!price) {
      throw new BillingError(
        "Subscription event references an unknown provider price.",
        "unknown_provider_price",
      );
    }

    const timestamp = now().toISOString();
    const rows = await client.execute<{ id: string }>(
      `
        INSERT INTO billing_subscriptions (
          id,
          tenant_id,
          provider,
          provider_subscription_id,
          provider_subscription_item_id,
          provider_customer_id,
          plan_id,
          price_id,
          status,
          quantity,
          trial_start,
          trial_end,
          current_period_start,
          current_period_end,
          cancel_at,
          canceled_at,
          grace_period_ends_at,
          metadata,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, '{}'::jsonb, $18, $18
        )
        ON CONFLICT (provider, provider_subscription_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          provider_subscription_item_id = EXCLUDED.provider_subscription_item_id,
          provider_customer_id = EXCLUDED.provider_customer_id,
          plan_id = EXCLUDED.plan_id,
          price_id = EXCLUDED.price_id,
          status = EXCLUDED.status,
          quantity = EXCLUDED.quantity,
          trial_start = EXCLUDED.trial_start,
          trial_end = EXCLUDED.trial_end,
          current_period_start = EXCLUDED.current_period_start,
          current_period_end = EXCLUDED.current_period_end,
          cancel_at = EXCLUDED.cancel_at,
          canceled_at = EXCLUDED.canceled_at,
          grace_period_ends_at = EXCLUDED.grace_period_ends_at,
          updated_at = EXCLUDED.updated_at
        RETURNING id
      `,
      [
        randomUUID(),
        payload.tenantId,
        provider,
        payload.providerSubscriptionId,
        payload.providerSubscriptionItemId,
        payload.providerCustomerId,
        price.planId,
        price.id,
        payload.status,
        Math.max(1, payload.quantity),
        optionalTimestamp(payload.trialStart),
        optionalTimestamp(payload.trialEnd),
        optionalTimestamp(payload.currentPeriodStart),
        optionalTimestamp(payload.currentPeriodEnd),
        optionalTimestamp(payload.cancelAt),
        optionalTimestamp(payload.canceledAt),
        optionalTimestamp(payload.gracePeriodEndsAt),
        timestamp,
      ],
    );

    await recomputeEntitlements(client, payload.tenantId);

    return rows[0]!.id;
  }

  async function subscriptionIdForProviderId(
    client: Queryable,
    provider: string,
    providerSubscriptionId?: string,
  ) {
    if (!providerSubscriptionId) {
      return undefined;
    }

    const rows = await client.execute<{ id: string; tenant_id: string }>(
      "SELECT id, tenant_id FROM billing_subscriptions WHERE provider = $1 AND provider_subscription_id = $2",
      [provider, providerSubscriptionId],
    );

    return rows[0];
  }

  async function upsertInvoiceFromEvent(
    client: Queryable,
    provider: string,
    payload: InvoiceChangedEvent,
  ) {
    const subscription = await subscriptionIdForProviderId(
      client,
      provider,
      payload.providerSubscriptionId,
    );
    const tenantId = payload.tenantId || subscription?.tenant_id;

    if (!tenantId) {
      throw new BillingError(
        "Invoice event is missing tenant scope.",
        "tenant_required",
      );
    }

    const timestamp = now().toISOString();
    const rows = await client.execute<{ id: string }>(
      `
        INSERT INTO billing_invoices (
          id,
          tenant_id,
          provider,
          provider_invoice_id,
          provider_customer_id,
          subscription_id,
          status,
          currency,
          subtotal_minor,
          discount_minor,
          tax_minor,
          total_minor,
          amount_due_minor,
          amount_paid_minor,
          tax_behavior,
          hosted_invoice_url,
          due_at,
          issued_at,
          paid_at,
          period_start,
          period_end,
          metadata,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20, $21, '{}'::jsonb, $22, $22
        )
        ON CONFLICT (provider, provider_invoice_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          provider_customer_id = EXCLUDED.provider_customer_id,
          subscription_id = EXCLUDED.subscription_id,
          status = EXCLUDED.status,
          currency = EXCLUDED.currency,
          subtotal_minor = EXCLUDED.subtotal_minor,
          discount_minor = EXCLUDED.discount_minor,
          tax_minor = EXCLUDED.tax_minor,
          total_minor = EXCLUDED.total_minor,
          amount_due_minor = EXCLUDED.amount_due_minor,
          amount_paid_minor = EXCLUDED.amount_paid_minor,
          tax_behavior = EXCLUDED.tax_behavior,
          hosted_invoice_url = EXCLUDED.hosted_invoice_url,
          due_at = EXCLUDED.due_at,
          issued_at = EXCLUDED.issued_at,
          paid_at = EXCLUDED.paid_at,
          period_start = EXCLUDED.period_start,
          period_end = EXCLUDED.period_end,
          updated_at = EXCLUDED.updated_at
        RETURNING id
      `,
      [
        randomUUID(),
        tenantId,
        provider,
        payload.providerInvoiceId,
        payload.providerCustomerId,
        subscription?.id,
        payload.status,
        normalizeCurrency(payload.currency),
        payload.subtotalMinor,
        payload.discountMinor,
        payload.taxMinor,
        payload.totalMinor,
        payload.amountDueMinor,
        payload.amountPaidMinor,
        payload.taxBehavior,
        payload.hostedInvoiceUrl,
        optionalTimestamp(payload.dueAt),
        optionalTimestamp(payload.issuedAt),
        optionalTimestamp(payload.paidAt),
        optionalTimestamp(payload.periodStart),
        optionalTimestamp(payload.periodEnd),
        timestamp,
      ],
    );
    const invoiceId = rows[0]!.id;

    await client.execute(
      "DELETE FROM billing_invoice_items WHERE invoice_id = $1",
      [invoiceId],
    );

    for (const item of payload.items) {
      await insertInvoiceItem(client, provider, invoiceId, item);
    }

    return invoiceId;
  }

  async function insertInvoiceItem(
    client: Queryable,
    provider: string,
    invoiceId: string,
    item: ProviderInvoiceItem,
  ) {
    const price = await findPriceByProviderId(
      client,
      provider,
      item.priceProviderId,
    );

    await client.execute(
      `
        INSERT INTO billing_invoice_items (
          id,
          invoice_id,
          plan_id,
          price_id,
          description,
          quantity,
          unit_amount_minor,
          subtotal_minor,
          discount_minor,
          tax_minor,
          total_minor,
          tax_breakdown,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, '{}'::jsonb)
      `,
      [
        randomUUID(),
        invoiceId,
        price?.planId,
        price?.id,
        item.description,
        item.quantity,
        item.unitAmountMinor,
        item.subtotalMinor,
        item.discountMinor ?? 0,
        item.taxMinor,
        item.totalMinor,
        JSON.stringify(item.taxBreakdown ?? []),
      ],
    );
  }

  async function upsertPaymentMethodFromEvent(
    client: Queryable,
    provider: string,
    payload: PaymentMethodChangedEvent,
  ) {
    const timestamp = now().toISOString();
    const customerRows = payload.providerCustomerId
      ? await client.execute<{ tenant_id: string }>(
          `
            SELECT tenant_id
            FROM billing_customers
            WHERE provider = $1
              AND provider_customer_id = $2
            ORDER BY updated_at DESC
            LIMIT 1
          `,
          [provider, payload.providerCustomerId],
        )
      : [];
    const tenantId = payload.tenantId ?? customerRows[0]?.tenant_id;

    if (!tenantId) {
      throw new BillingError(
        "Payment method event is missing tenant scope.",
        "tenant_required",
      );
    }

    await client.execute(
      `
        INSERT INTO billing_payment_methods (
          id,
          tenant_id,
          provider,
          provider_payment_method_id,
          provider_customer_id,
          type,
          brand,
          last4,
          exp_month,
          exp_year,
          billing_name,
          billing_email,
          status,
          metadata,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          '{}'::jsonb, $14, $14
        )
        ON CONFLICT (provider, provider_payment_method_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          provider_customer_id = EXCLUDED.provider_customer_id,
          type = EXCLUDED.type,
          brand = EXCLUDED.brand,
          last4 = EXCLUDED.last4,
          exp_month = EXCLUDED.exp_month,
          exp_year = EXCLUDED.exp_year,
          billing_name = EXCLUDED.billing_name,
          billing_email = EXCLUDED.billing_email,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at
      `,
      [
        randomUUID(),
        tenantId,
        provider,
        payload.providerPaymentMethodId,
        payload.providerCustomerId,
        payload.type,
        payload.brand,
        payload.last4,
        payload.expMonth,
        payload.expYear,
        payload.billingName,
        payload.billingEmail,
        payload.status,
        timestamp,
      ],
    );
  }

  async function upsertRefundFromEvent(
    client: Queryable,
    provider: string,
    payload: RefundChangedEvent,
  ) {
    const invoiceRows = payload.invoiceProviderId
      ? await client.execute<{ id: string; tenant_id: string }>(
          "SELECT id, tenant_id FROM billing_invoices WHERE provider = $1 AND provider_invoice_id = $2",
          [provider, payload.invoiceProviderId],
        )
      : [];
    const tenantId = payload.tenantId || invoiceRows[0]?.tenant_id;

    if (!tenantId) {
      throw new BillingError(
        "Refund event is missing tenant scope.",
        "tenant_required",
      );
    }

    const timestamp = now().toISOString();

    await client.execute(
      `
        INSERT INTO billing_refunds (
          id,
          tenant_id,
          invoice_id,
          provider,
          provider_refund_id,
          provider_payment_id,
          amount_minor,
          currency,
          reason,
          status,
          metadata,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '{}'::jsonb, $11, $11)
        ON CONFLICT (provider, provider_refund_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          invoice_id = EXCLUDED.invoice_id,
          provider_payment_id = EXCLUDED.provider_payment_id,
          amount_minor = EXCLUDED.amount_minor,
          currency = EXCLUDED.currency,
          reason = EXCLUDED.reason,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at
      `,
      [
        randomUUID(),
        tenantId,
        invoiceRows[0]?.id,
        provider,
        payload.providerRefundId,
        payload.providerPaymentId,
        payload.amountMinor,
        normalizeCurrency(payload.currency),
        payload.reason,
        payload.status,
        timestamp,
      ],
    );
  }

  async function markCheckoutCompleted(
    client: Queryable,
    provider: string,
    payload: CheckoutCompletedEvent,
  ) {
    const timestamp = now().toISOString();

    await client.execute(
      `
        UPDATE billing_checkout_sessions
        SET status = 'complete',
            updated_at = $1
        WHERE provider = $2
          AND provider_session_id = $3
          AND tenant_id = $4
      `,
      [timestamp, provider, payload.providerSessionId, payload.tenantId],
    );

    if (payload.providerCustomerId) {
      await upsertCustomer(client, {
        email: payload.customerEmail,
        provider,
        providerCustomerId: payload.providerCustomerId,
        tenantId: payload.tenantId,
      });
    }
  }

  async function recomputeEntitlements(client: Queryable, tenantId: string) {
    const subscriptions = await client.execute<SubscriptionRow>(
      `
        SELECT *
        FROM billing_subscriptions
        WHERE tenant_id = $1
          AND (
            status IN ('active', 'trialing', 'past_due')
            OR grace_period_ends_at > $2
          )
        ORDER BY updated_at DESC
      `,
      [tenantId, now().toISOString()],
    );
    const nextEntitlements = new Map<
      string,
      {
        featureKey: string;
        limitValue?: number;
        planId?: string;
        source: string;
        subscriptionId?: string;
      }
    >();

    for (const subscription of subscriptions) {
      const gracePeriodActive =
        subscription.grace_period_ends_at !== null &&
        new Date(subscription.grace_period_ends_at).getTime() > now().getTime();

      if (
        !activeSubscriptionStatus(subscription.status) &&
        !gracePeriodActive
      ) {
        continue;
      }

      const plan = await findPlanRow(client, subscription.plan_id);
      const entitlements = parseJson<BillingEntitlementConfig>(
        plan?.entitlements,
        {},
      );

      for (const feature of entitlements.features ?? []) {
        nextEntitlements.set(feature, {
          featureKey: feature,
          planId: subscription.plan_id,
          source: "subscription",
          subscriptionId: subscription.id,
        });
      }

      for (const [featureKey, limitValue] of Object.entries(
        entitlements.limits ?? {},
      )) {
        const existing = nextEntitlements.get(featureKey);

        nextEntitlements.set(featureKey, {
          featureKey,
          limitValue: Math.max(existing?.limitValue ?? 0, limitValue),
          planId: subscription.plan_id,
          source: "subscription",
          subscriptionId: subscription.id,
        });
      }
    }

    await client.execute(
      "UPDATE billing_entitlements SET enabled = false, updated_at = $1 WHERE tenant_id = $2",
      [now().toISOString(), tenantId],
    );

    for (const entitlement of nextEntitlements.values()) {
      await client.execute(
        `
          INSERT INTO billing_entitlements (
            tenant_id,
            feature_key,
            enabled,
            source,
            plan_id,
            subscription_id,
            limit_value,
            used_value,
            updated_at
          )
          VALUES ($1, $2, true, $3, $4, $5, $6, 0, $7)
          ON CONFLICT (tenant_id, feature_key) DO UPDATE SET
            enabled = true,
            source = EXCLUDED.source,
            plan_id = EXCLUDED.plan_id,
            subscription_id = EXCLUDED.subscription_id,
            limit_value = EXCLUDED.limit_value,
            updated_at = EXCLUDED.updated_at
        `,
        [
          tenantId,
          entitlement.featureKey,
          entitlement.source,
          entitlement.planId,
          entitlement.subscriptionId,
          entitlement.limitValue,
          now().toISOString(),
        ],
      );
    }
  }

  async function processWebhookEvent(
    client: Queryable,
    provider: string,
    event: ProviderWebhookEvent,
  ) {
    if (event.type === "checkout.session.completed") {
      await markCheckoutCompleted(
        client,
        provider,
        event.payload as CheckoutCompletedEvent,
      );
      return;
    }

    if (event.type.startsWith("customer.subscription.")) {
      await upsertSubscriptionFromEvent(
        client,
        provider,
        event.payload as SubscriptionChangedEvent,
      );
      return;
    }

    if (event.type.startsWith("invoice.")) {
      await upsertInvoiceFromEvent(
        client,
        provider,
        event.payload as InvoiceChangedEvent,
      );
      return;
    }

    if (event.type.startsWith("payment_method.")) {
      await upsertPaymentMethodFromEvent(
        client,
        provider,
        event.payload as PaymentMethodChangedEvent,
      );
      return;
    }

    if (event.type === "refund.created" || event.type === "refund.updated") {
      await upsertRefundFromEvent(
        client,
        provider,
        event.payload as RefundChangedEvent,
      );
    }
  }

  const service = {
    async calculateTax(input: {
      customer: TaxCustomer;
      line: {
        amountMinor: number;
        currency: string;
        description: string;
        quantity?: number;
        taxBehavior?: BillingTaxBehavior;
      };
    }) {
      const client = await getClient();
      const rules = await client.execute<TaxRuleRow>(
        "SELECT * FROM billing_tax_rates WHERE active = true ORDER BY country, region",
      );
      const provider = createManualTaxProvider();

      return provider.calculateTax({
        customer: input.customer,
        lines: [
          {
            amountMinor: input.line.amountMinor,
            currency: input.line.currency,
            description: input.line.description,
            quantity: input.line.quantity ?? 1,
            taxBehavior: input.line.taxBehavior ?? "exclusive",
          },
        ],
        rules: rules.map((rule) => ({
          country: rule.country,
          inclusive: rule.inclusive,
          percentageBasisPoints: rule.percentage_basis_points,
          region: rule.region ?? undefined,
          taxType: rule.tax_type,
        })),
      });
    },

    async cancelSubscription(input: {
      actorId: string;
      organizationId: string;
      subscriptionId: string;
    }) {
      const client = await getClient();

      await requireTenantPermission({
        actorId: input.actorId,
        client,
        organizationId: input.organizationId,
        permission: "billing.manage",
      });

      const rows = await client.execute<SubscriptionRow>(
        "SELECT * FROM billing_subscriptions WHERE id = $1 AND tenant_id = $2",
        [input.subscriptionId, input.organizationId],
      );
      const subscription = rows[0];

      if (!subscription) {
        throw new BillingError(
          "Subscription not found.",
          "subscription_not_found",
        );
      }

      await getAdapter(subscription.provider).updateSubscription({
        cancelAtPeriodEnd: true,
        providerSubscriptionId: subscription.provider_subscription_id,
      });
      await audit(client, {
        actorId: input.actorId,
        eventType: "billing.subscription.cancel_requested",
        subjectId: subscription.id,
        subjectType: "subscription",
        tenantId: input.organizationId,
      });
    },

    async applyDiscountToSubscription(input: {
      actorId: string;
      couponCode: string;
      organizationId: string;
      subscriptionId: string;
    }) {
      const client = await getClient();

      await requireTenantPermission({
        actorId: input.actorId,
        client,
        organizationId: input.organizationId,
        permission: "billing.manage",
      });

      const subscriptionRows = await client.execute<SubscriptionRow>(
        "SELECT * FROM billing_subscriptions WHERE id = $1 AND tenant_id = $2",
        [input.subscriptionId, input.organizationId],
      );
      const subscription = subscriptionRows[0];

      if (!subscription) {
        throw new BillingError(
          "Subscription not found.",
          "subscription_not_found",
        );
      }

      const price = await findPriceById(client, subscription.price_id);

      if (!price) {
        throw new BillingError(
          "Subscription price was not found.",
          "price_not_found",
        );
      }

      const coupon = await findRedeemableCoupon({
        client,
        code: input.couponCode,
        currency: price.currency,
        provider: subscription.provider,
      });

      if (!coupon) {
        throw new BillingError("Coupon is required.", "coupon_required");
      }

      await getAdapter(subscription.provider).updateSubscription({
        providerCouponId: coupon.providerCouponId,
        providerSubscriptionId: subscription.provider_subscription_id,
      });

      const timestamp = now().toISOString();
      const discountId = randomUUID();

      await client.execute(
        `
          INSERT INTO billing_discounts (
            id,
            tenant_id,
            coupon_id,
            subscription_id,
            provider,
            provider_discount_id,
            status,
            starts_at,
            ends_at,
            metadata,
            created_at,
            updated_at,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, NULL, 'active', $6, NULL, '{}'::jsonb, $6, $6, $7)
        `,
        [
          discountId,
          input.organizationId,
          coupon.id,
          subscription.id,
          subscription.provider,
          timestamp,
          input.actorId,
        ],
      );
      await audit(client, {
        actorId: input.actorId,
        eventType: "billing.discount.applied",
        payload: {
          couponId: coupon.id,
          providerCouponId: coupon.providerCouponId,
        },
        subjectId: discountId,
        subjectType: "discount",
        tenantId: input.organizationId,
      });

      return { discountId, status: "active" as const };
    },

    async changeSubscriptionPlan(input: {
      actorId: string;
      organizationId: string;
      priceId: string;
      quantity?: number;
      subscriptionId: string;
    }) {
      const client = await getClient();

      await requireTenantPermission({
        actorId: input.actorId,
        client,
        organizationId: input.organizationId,
        permission: "billing.manage",
      });

      const subscriptionRows = await client.execute<SubscriptionRow>(
        "SELECT * FROM billing_subscriptions WHERE id = $1 AND tenant_id = $2",
        [input.subscriptionId, input.organizationId],
      );
      const subscription = subscriptionRows[0];

      if (!subscription) {
        throw new BillingError(
          "Subscription not found.",
          "subscription_not_found",
        );
      }

      const price = await findPriceById(client, input.priceId);

      if (!price || price.provider !== subscription.provider) {
        throw new BillingError(
          "Price is not available for this subscription.",
          "price_not_found",
        );
      }

      if (!price.providerPriceId) {
        throw new BillingError(
          "Provider price id is required for plan changes.",
          "provider_price_required",
        );
      }

      if (!subscription.provider_subscription_item_id) {
        throw new BillingError(
          "Provider subscription item id is required for plan changes.",
          "provider_subscription_item_required",
        );
      }

      const quantity = input.quantity ?? subscription.quantity;

      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new BillingError(
          "Subscription quantity must be a positive integer.",
          "invalid_quantity",
        );
      }

      await getAdapter(subscription.provider).updateSubscription({
        priceProviderId: price.providerPriceId,
        providerSubscriptionId: subscription.provider_subscription_id,
        providerSubscriptionItemId: subscription.provider_subscription_item_id,
        quantity,
      });
      await audit(client, {
        actorId: input.actorId,
        eventType: "billing.subscription.plan_change_requested",
        payload: {
          nextPriceId: price.id,
          previousPriceId: subscription.price_id,
          quantity,
        },
        subjectId: subscription.id,
        subjectType: "subscription",
        tenantId: input.organizationId,
      });
    },

    async convertCurrency(input: {
      amountMinor: number;
      baseCurrency: string;
      quoteCurrency: string;
    }) {
      const client = await getClient();
      const rows = await client.execute<ExchangeRateRow>(
        "SELECT * FROM billing_exchange_rates WHERE base_currency = $1 AND quote_currency = $2",
        [
          normalizeCurrency(input.baseCurrency),
          normalizeCurrency(input.quoteCurrency),
        ],
      );

      if (!rows[0]) {
        throw new BillingError(
          "Exchange rate not configured.",
          "exchange_rate_not_found",
        );
      }

      return convertCurrency({
        amountMinor: input.amountMinor,
        baseCurrency: input.baseCurrency,
        quoteCurrency: input.quoteCurrency,
        rate: {
          baseCurrency: rows[0].base_currency,
          quoteCurrency: rows[0].quote_currency,
          rateMicroUnits: toNumber(rows[0].rate_micro_units),
        } satisfies ExchangeRate,
      });
    },

    async createBillingPortalSession(input: {
      actorId: string;
      organizationId: string;
      returnUrl: string;
    }) {
      const client = await getClient();

      await requireTenantPermission({
        actorId: input.actorId,
        client,
        organizationId: input.organizationId,
        permission: "billing.manage",
      });

      const settings = await getTenantSettingsRow(client, input.organizationId);
      const customerRows = await client.execute<{
        provider_customer_id: string;
      }>(
        `
          SELECT provider_customer_id
          FROM billing_customers
          WHERE tenant_id = $1
            AND provider = $2
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        [input.organizationId, settings.payment_provider],
      );

      if (!customerRows[0]) {
        throw new BillingError(
          "No billing customer exists yet.",
          "customer_not_found",
        );
      }

      return getAdapter(settings.payment_provider).createBillingPortalSession({
        appBaseUrl,
        providerCustomerId: customerRows[0].provider_customer_id,
        returnUrl: input.returnUrl,
        tenantId: input.organizationId,
      });
    },

    async createCheckoutSession(input: {
      actorId: string;
      cancelUrl: string;
      couponCode?: string;
      customerEmail?: string;
      organizationId: string;
      priceId: string;
      quantity?: number;
      successUrl: string;
    }) {
      const client = await getClient();

      await requireTenantPermission({
        actorId: input.actorId,
        client,
        organizationId: input.organizationId,
        permission: "billing.manage",
      });

      const settings = await getTenantSettingsRow(client, input.organizationId);
      const provider = await getProviderRow(client, settings.payment_provider);

      if (!provider.enabled) {
        throw new BillingError(
          "Billing provider is disabled.",
          "provider_disabled",
        );
      }

      const price = await findPriceById(client, input.priceId);

      if (!price || price.provider !== settings.payment_provider) {
        throw new BillingError(
          "Price is not available for checkout.",
          "price_not_found",
        );
      }

      assertSupportedCurrency({ currency: price.currency, provider });

      const coupon = input.couponCode
        ? await findRedeemableCoupon({
            client,
            code: input.couponCode,
            currency: price.currency,
            provider: settings.payment_provider,
          })
        : undefined;

      const planRows = await client.execute<PlanRow>(
        "SELECT * FROM billing_plans WHERE id = $1 AND status = 'active'",
        [price.planId],
      );
      const plan = planRows[0];

      if (!plan) {
        throw new BillingError("Plan is not active.", "plan_not_found");
      }

      const requestedQuantity = input.quantity ?? 1;

      if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
        throw new BillingError(
          "Checkout quantity must be a positive integer.",
          "invalid_quantity",
        );
      }

      const quantity = price.usageType === "licensed" ? requestedQuantity : 1;
      const mode = checkoutModeForPrice(price);
      const clientReferenceId = `${input.organizationId}:${randomUUID()}`;
      const checkout = await getAdapter(
        settings.payment_provider,
      ).createCheckoutSession({
        appBaseUrl,
        cancelUrl: input.cancelUrl,
        clientReferenceId,
        currency: price.currency,
        customerEmail: input.customerEmail,
        discount: coupon
          ? {
              code: coupon.code,
              couponId: coupon.id,
              providerCouponId: coupon.providerCouponId,
            }
          : undefined,
        metadata: {
          planId: plan.id,
          priceId: price.id,
          tenantId: input.organizationId,
        },
        mode,
        price,
        quantity,
        successUrl: input.successUrl,
        tenantId: input.organizationId,
        trialDays: plan.trial_days,
      });
      const timestamp = now().toISOString();

      await client.execute(
        `
          INSERT INTO billing_checkout_sessions (
            id,
            tenant_id,
            provider,
            provider_session_id,
            plan_id,
            price_id,
            mode,
            status,
            quantity,
            currency,
            amount_minor,
            client_reference_id,
            url,
            success_url,
            cancel_url,
            expires_at,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17)
        `,
        [
          randomUUID(),
          input.organizationId,
          settings.payment_provider,
          checkout.id,
          plan.id,
          price.id,
          mode,
          checkout.status,
          quantity,
          price.currency,
          price.amountMinor * quantity,
          clientReferenceId,
          checkout.url,
          input.successUrl,
          input.cancelUrl,
          optionalTimestamp(checkout.expiresAt),
          timestamp,
        ],
      );
      if (coupon) {
        await client.execute(
          `
            INSERT INTO billing_discounts (
              id,
              tenant_id,
              coupon_id,
              subscription_id,
              provider,
              provider_discount_id,
              status,
              starts_at,
              ends_at,
              metadata,
              created_at,
              updated_at,
              updated_by
            )
            VALUES ($1, $2, $3, NULL, $4, NULL, 'pending_checkout', $5, NULL, $6::jsonb, $5, $5, $7)
          `,
          [
            randomUUID(),
            input.organizationId,
            coupon.id,
            settings.payment_provider,
            timestamp,
            JSON.stringify({
              checkoutSessionId: checkout.id,
              priceId: price.id,
            }),
            input.actorId,
          ],
        );
      }
      await audit(client, {
        actorId: input.actorId,
        eventType: "billing.checkout.created",
        payload: {
          checkoutSessionId: checkout.id,
          couponId: coupon?.id,
          priceId: price.id,
        },
        subjectId: checkout.id,
        subjectType: "checkout_session",
        tenantId: input.organizationId,
      });

      return checkout;
    },

    formatCurrency,

    async getTenantSettings(input: {
      actorId: string;
      organizationId: string;
    }) {
      const client = await getClient();

      await requireTenantPermission({
        actorId: input.actorId,
        client,
        organizationId: input.organizationId,
        permission: "billing.read",
      });

      return getTenantSettingsRow(client, input.organizationId);
    },

    async handleWebhook(input: {
      provider: string;
      rawBody: string;
      signatureHeader?: string;
    }) {
      const client = await getClient();
      const adapter = getAdapter(input.provider);
      const event = await adapter.verifyWebhook({
        rawBody: input.rawBody,
        signatureHeader: input.signatureHeader,
      });
      const timestamp = now().toISOString();
      const payload = JSON.stringify(event.payload ?? {});
      const insertedRows = await client.execute<{ id: string }>(
        `
          INSERT INTO billing_webhook_events (
            id,
            provider,
            provider_event_id,
            event_type,
            status,
            tenant_id,
            signature_header,
            payload,
            raw_body_sha256,
            received_at
          )
          VALUES ($1, $2, $3, $4, 'processing', $5, $6, $7::jsonb, $8, $9)
          ON CONFLICT (provider, provider_event_id) DO UPDATE SET
            status = 'processing',
            tenant_id = COALESCE(EXCLUDED.tenant_id, billing_webhook_events.tenant_id),
            signature_header = EXCLUDED.signature_header,
            payload = EXCLUDED.payload,
            raw_body_sha256 = EXCLUDED.raw_body_sha256,
            processing_error = NULL,
            received_at = EXCLUDED.received_at,
            processed_at = NULL
          WHERE billing_webhook_events.status = 'failed'
          RETURNING id
        `,
        [
          randomUUID(),
          input.provider,
          event.id,
          event.type,
          event.tenantId,
          input.signatureHeader,
          payload,
          webhookBodyHash(input.rawBody),
          timestamp,
        ],
      );

      if (!insertedRows[0]) {
        return { eventId: event.id, status: "duplicate" as const };
      }

      try {
        await withTransaction(client, async (transaction) => {
          await processWebhookEvent(transaction, input.provider, event);
          await transaction.execute(
            `
              UPDATE billing_webhook_events
              SET status = 'processed',
                  processed_at = $1,
                  tenant_id = COALESCE(tenant_id, $2)
              WHERE id = $3
            `,
            [now().toISOString(), event.tenantId, insertedRows[0]!.id],
          );
        });
      } catch (error) {
        await client.execute(
          `
            UPDATE billing_webhook_events
            SET status = 'failed',
                processing_error = $1,
                processed_at = $2
            WHERE id = $3
          `,
          [
            error instanceof Error ? error.message : "Unknown webhook error.",
            now().toISOString(),
            insertedRows[0].id,
          ],
        );

        throw error;
      }

      return { eventId: event.id, status: "processed" as const };
    },

    async hasEntitlement(input: {
      actorId: string;
      featureKey: string;
      organizationId: string;
    }) {
      const client = await getClient();

      await requireTenantPermission({
        actorId: input.actorId,
        client,
        organizationId: input.organizationId,
        permission: "billing.read",
      });

      const rows = await client.execute<EntitlementRow>(
        `
          SELECT *
          FROM billing_entitlements
          WHERE tenant_id = $1
            AND feature_key = $2
            AND enabled = true
        `,
        [input.organizationId, input.featureKey],
      );

      return Boolean(rows[0]);
    },

    async listBillingSummary(input: {
      actorId: string;
      locale?: string;
      organizationId: string;
    }) {
      const client = await getClient();

      await requireTenantPermission({
        actorId: input.actorId,
        client,
        organizationId: input.organizationId,
        permission: "billing.read",
      });

      const [
        settings,
        subscriptions,
        invoices,
        paymentMethods,
        entitlements,
        taxSettings,
        discounts,
      ] = await Promise.all([
        getTenantSettingsRow(client, input.organizationId),
        client.execute<SubscriptionRow>(
          "SELECT * FROM billing_subscriptions WHERE tenant_id = $1 ORDER BY updated_at DESC",
          [input.organizationId],
        ),
        client.execute<InvoiceRow>(
          "SELECT * FROM billing_invoices WHERE tenant_id = $1 ORDER BY issued_at DESC NULLS LAST, updated_at DESC",
          [input.organizationId],
        ),
        client.execute<PaymentMethodRow>(
          "SELECT * FROM billing_payment_methods WHERE tenant_id = $1 ORDER BY updated_at DESC",
          [input.organizationId],
        ),
        client.execute<EntitlementRow>(
          "SELECT * FROM billing_entitlements WHERE tenant_id = $1 ORDER BY feature_key",
          [input.organizationId],
        ),
        client.execute<TaxSettingsRow>(
          "SELECT * FROM billing_tax_settings WHERE tenant_id = $1",
          [input.organizationId],
        ),
        client.execute<DiscountRow>(
          `
            SELECT
              billing_discounts.*,
              billing_coupons.code,
              billing_coupons.name
            FROM billing_discounts
            INNER JOIN billing_coupons
              ON billing_coupons.id = billing_discounts.coupon_id
            WHERE billing_discounts.tenant_id = $1
            ORDER BY billing_discounts.starts_at DESC
          `,
          [input.organizationId],
        ),
      ]);

      return {
        discounts: discounts.map(toDiscount),
        entitlements: entitlements.map((entitlement) => ({
          enabled: entitlement.enabled,
          featureKey: entitlement.feature_key,
          limitValue:
            entitlement.limit_value === null
              ? undefined
              : toNumber(entitlement.limit_value),
          source: entitlement.source,
          usedValue: toNumber(entitlement.used_value),
        })),
        invoices: invoices.map((invoice) => ({
          amountDueMinor: toNumber(invoice.amount_due_minor),
          amountPaidMinor: toNumber(invoice.amount_paid_minor),
          currency: invoice.currency,
          dueAt: toIsoString(invoice.due_at),
          hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
          id: invoice.id,
          issuedAt: toIsoString(invoice.issued_at),
          paidAt: toIsoString(invoice.paid_at),
          provider: invoice.provider,
          providerInvoiceId: invoice.provider_invoice_id,
          status: invoice.status,
          totalMinor: toNumber(invoice.total_minor),
        })),
        paymentMethods: paymentMethods.map((method) => ({
          billingEmail: method.billing_email ?? undefined,
          billingName: method.billing_name ?? undefined,
          brand: method.brand ?? undefined,
          expMonth: method.exp_month ?? undefined,
          expYear: method.exp_year ?? undefined,
          id: method.id,
          last4: method.last4 ?? undefined,
          provider: method.provider,
          status: method.status,
          type: method.type,
        })),
        settings,
        subscriptions: subscriptions.map((subscription) => ({
          cancelAt: toIsoString(subscription.cancel_at),
          canceledAt: toIsoString(subscription.canceled_at),
          currentPeriodEnd: toIsoString(subscription.current_period_end),
          currentPeriodStart: toIsoString(subscription.current_period_start),
          id: subscription.id,
          planId: subscription.plan_id,
          priceId: subscription.price_id,
          provider: subscription.provider,
          quantity: subscription.quantity,
          status: subscription.status,
          trialEnd: toIsoString(subscription.trial_end),
          trialStart: toIsoString(subscription.trial_start),
        })),
        taxSettings: taxSettings[0]
          ? {
              billingCountry: taxSettings[0].billing_country ?? undefined,
              billingRegion: taxSettings[0].billing_region ?? undefined,
              businessName: taxSettings[0].business_name ?? undefined,
              reverseCharge: taxSettings[0].reverse_charge,
              taxBehavior: taxSettings[0].tax_behavior,
              taxExempt: taxSettings[0].tax_exempt,
              taxId: taxSettings[0].tax_id ?? undefined,
            }
          : undefined,
      };
    },

    async listPaymentProviders() {
      const client = await getClient();
      const rows = await client.execute<ProviderRow>(
        "SELECT * FROM billing_payment_providers ORDER BY provider",
      );

      return rows.map((row) => ({
        capabilities: providerCapabilities(row),
        configuration: parseJson<Record<string, unknown>>(
          row.configuration,
          {},
        ),
        displayName: row.display_name,
        enabled: row.enabled,
        mode: row.mode,
        provider: row.provider,
        secretRef: row.secret_ref ?? undefined,
        updatedAt: toIsoString(row.updated_at)!,
        webhookSecretRef: row.webhook_secret_ref ?? undefined,
      }));
    },

    async listCoupons(
      input: {
        activeOnly?: boolean;
        provider?: string;
      } = {},
    ) {
      const client = await getClient();
      const filters: string[] = [];
      const params: unknown[] = [];

      if (input.activeOnly) {
        filters.push("active = true");
        params.push(now().toISOString());
        filters.push(`(redeem_by IS NULL OR redeem_by >= $${params.length})`);
      }

      if (input.provider) {
        params.push(input.provider);
        filters.push(`(provider IS NULL OR provider = $${params.length})`);
      }

      const rows = await client.execute<CouponRow>(
        `
          SELECT *
          FROM billing_coupons
          ${filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : ""}
          ORDER BY active DESC, code ASC
        `,
        params,
      );

      return rows.map(toCoupon);
    },

    async listPublicPlans(
      input: {
        currency?: string;
        includeInactive?: boolean;
        includePrivate?: boolean;
        locale?: string;
        provider?: string;
      } = {},
    ) {
      const client = await getClient();
      const locale = input.locale ?? defaultLocale;
      const planFilters: string[] = [];

      if (!input.includePrivate) {
        planFilters.push("public_visible = true");
      }

      if (!input.includeInactive) {
        planFilters.push("status = 'active'");
      }

      const planRows = await client.execute<PlanRow>(
        `
          SELECT *
          FROM billing_plans
          ${planFilters.length > 0 ? `WHERE ${planFilters.join(" AND ")}` : ""}
          ORDER BY sort_order ASC
        `,
      );
      const translations = await client.execute<PlanTranslationRow>(
        "SELECT * FROM billing_plan_translations",
      );
      const params: unknown[] = [];
      const priceFilters = ["active = true"];

      if (input.provider) {
        params.push(input.provider);
        priceFilters.push(`provider = $${params.length}`);
      }

      if (input.currency) {
        params.push(normalizeCurrency(input.currency));
        priceFilters.push(`currency = $${params.length}`);
      }

      const priceRows = await client.execute<PriceRow>(
        `
          SELECT *
          FROM billing_prices
          WHERE ${priceFilters.join(" AND ")}
          ORDER BY sort_order ASC
        `,
        params,
      );

      return planRows.map((plan) =>
        toPlan(plan, translations, priceRows, locale),
      );
    },

    async recordUsage(input: {
      actorId: string;
      idempotencyKey: string;
      meterKey: string;
      metadata?: Record<string, unknown>;
      occurredAt?: string;
      organizationId: string;
      quantity: number;
    }) {
      if (!Number.isInteger(input.quantity) || input.quantity < 1) {
        throw new BillingError(
          "Usage quantity must be positive.",
          "invalid_usage_quantity",
        );
      }

      const client = await getClient();

      await requireTenantPermission({
        actorId: input.actorId,
        client,
        organizationId: input.organizationId,
        permission: "billing.usage.manage",
      });

      const meterRows = await client.execute<{ id: string }>(
        "SELECT id FROM billing_usage_meters WHERE key = $1 AND active = true",
        [input.meterKey],
      );

      if (!meterRows[0]) {
        throw new BillingError(
          "Usage meter not found.",
          "usage_meter_not_found",
        );
      }

      const insertedRows = await client.execute<{ id: string }>(
        `
          INSERT INTO billing_usage_records (
            id,
            tenant_id,
            meter_id,
            quantity,
            idempotency_key,
            occurred_at,
            metadata,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
          ON CONFLICT (tenant_id, meter_id, idempotency_key) DO NOTHING
          RETURNING id
        `,
        [
          randomUUID(),
          input.organizationId,
          meterRows[0].id,
          input.quantity,
          input.idempotencyKey,
          optionalTimestamp(input.occurredAt) ?? now().toISOString(),
          JSON.stringify(input.metadata ?? {}),
          now().toISOString(),
        ],
      );
      if (!insertedRows[0]) {
        return { status: "duplicate" as const };
      }

      await client.execute(
        `
          UPDATE billing_entitlements
          SET used_value = used_value + $1,
              updated_at = $2
          WHERE tenant_id = $3
            AND feature_key = $4
        `,
        [
          input.quantity,
          now().toISOString(),
          input.organizationId,
          input.meterKey,
        ],
      );

      return { status: "recorded" as const };
    },

    async requestRefund(input: {
      actorId: string;
      amountMinor?: number;
      invoiceId: string;
      providerPaymentId: string;
      reason?: string;
    }) {
      const client = await getClient();
      const invoiceRows = await client.execute<InvoiceRow>(
        "SELECT * FROM billing_invoices WHERE id = $1",
        [input.invoiceId],
      );
      const invoice = invoiceRows[0];

      if (!invoice) {
        throw new BillingError("Invoice not found.", "invoice_not_found");
      }

      if (
        input.amountMinor !== undefined &&
        (!Number.isInteger(input.amountMinor) || input.amountMinor < 1)
      ) {
        throw new BillingError(
          "Refund amount must be a positive integer.",
          "invalid_refund_amount",
        );
      }

      await requireTenantPermission({
        actorId: input.actorId,
        client,
        organizationId: invoice.tenant_id,
        permission: "billing.refund",
      });

      const refund = await getAdapter(invoice.provider).createRefund({
        amountMinor: input.amountMinor,
        currency: invoice.currency,
        invoiceId: invoice.id,
        providerPaymentId: input.providerPaymentId,
        reason: input.reason,
        tenantId: invoice.tenant_id,
      });
      const timestamp = now().toISOString();

      await client.execute(
        `
          INSERT INTO billing_refunds (
            id,
            tenant_id,
            invoice_id,
            provider,
            provider_refund_id,
            provider_payment_id,
            amount_minor,
            currency,
            reason,
            status,
            metadata,
            created_at,
            updated_at,
            created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '{}'::jsonb, $11, $11, $12)
          ON CONFLICT (provider, provider_refund_id) DO UPDATE SET
            status = EXCLUDED.status,
            updated_at = EXCLUDED.updated_at
        `,
        [
          refund.id,
          invoice.tenant_id,
          invoice.id,
          invoice.provider,
          refund.id,
          refund.providerPaymentId ?? input.providerPaymentId,
          refund.amountMinor,
          refund.currency,
          input.reason,
          refund.status,
          timestamp,
          input.actorId,
        ],
      );
      await audit(client, {
        actorId: input.actorId,
        eventType: "billing.refund.requested",
        payload: { amountMinor: refund.amountMinor, invoiceId: invoice.id },
        subjectId: refund.id,
        subjectType: "refund",
        tenantId: invoice.tenant_id,
      });

      return refund;
    },

    async requireEntitlement(input: {
      actorId: string;
      featureKey: string;
      organizationId: string;
    }) {
      const allowed = await service.hasEntitlement(input);

      if (!allowed) {
        throw new BillingError(
          "Entitlement is required.",
          "entitlement_required",
        );
      }
    },

    async updatePaymentProvider(input: {
      actorId: string;
      capabilities?: Record<string, unknown>;
      configuration?: Record<string, unknown>;
      displayName: string;
      enabled: boolean;
      mode: string;
      provider: string;
      secretRef?: string;
      webhookSecretRef?: string;
    }) {
      const client = await getClient();
      const timestamp = now().toISOString();

      await client.execute(
        `
          INSERT INTO billing_payment_providers (
            id,
            provider,
            display_name,
            mode,
            enabled,
            secret_ref,
            webhook_secret_ref,
            capabilities,
            configuration,
            created_at,
            updated_at,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $10, $11)
          ON CONFLICT (provider) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            mode = EXCLUDED.mode,
            enabled = EXCLUDED.enabled,
            secret_ref = EXCLUDED.secret_ref,
            webhook_secret_ref = EXCLUDED.webhook_secret_ref,
            capabilities = EXCLUDED.capabilities,
            configuration = EXCLUDED.configuration,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by
        `,
        [
          `provider_${input.provider}`,
          input.provider,
          input.displayName,
          input.mode,
          input.enabled,
          input.secretRef,
          input.webhookSecretRef,
          JSON.stringify(input.capabilities ?? {}),
          JSON.stringify(input.configuration ?? {}),
          timestamp,
          input.actorId,
        ],
      );
    },

    async upsertPlan(input: {
      actorId: string;
      ctaLabel: string;
      description: string;
      entitlements?: BillingEntitlementConfig;
      features: string[];
      highlighted?: boolean;
      locale: string;
      name: string;
      planId?: string;
      publicVisible?: boolean;
      seatBased?: boolean;
      slug: string;
      sortOrder?: number;
      status: string;
      trialDays?: number;
      usageBased?: boolean;
    }) {
      const client = await getClient();
      const planId = input.planId || `plan_${input.slug.trim()}`;
      const timestamp = now().toISOString();

      await client.execute(
        `
          INSERT INTO billing_plans (
            id,
            slug,
            status,
            public_visible,
            highlighted,
            trial_days,
            seat_based,
            usage_based,
            sort_order,
            entitlements,
            metadata,
            created_at,
            updated_at,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, '{}'::jsonb, $11, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            slug = EXCLUDED.slug,
            status = EXCLUDED.status,
            public_visible = EXCLUDED.public_visible,
            highlighted = EXCLUDED.highlighted,
            trial_days = EXCLUDED.trial_days,
            seat_based = EXCLUDED.seat_based,
            usage_based = EXCLUDED.usage_based,
            sort_order = EXCLUDED.sort_order,
            entitlements = EXCLUDED.entitlements,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by
        `,
        [
          planId,
          input.slug.trim(),
          input.status,
          input.publicVisible ?? true,
          input.highlighted ?? false,
          Math.max(0, input.trialDays ?? 0),
          input.seatBased ?? false,
          input.usageBased ?? false,
          input.sortOrder ?? 0,
          JSON.stringify(input.entitlements ?? {}),
          timestamp,
          input.actorId,
        ],
      );
      await client.execute(
        `
          INSERT INTO billing_plan_translations (
            plan_id,
            locale,
            name,
            description,
            features,
            cta_label
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, $6)
          ON CONFLICT (plan_id, locale) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            features = EXCLUDED.features,
            cta_label = EXCLUDED.cta_label
        `,
        [
          planId,
          input.locale,
          input.name,
          input.description,
          JSON.stringify(input.features),
          input.ctaLabel,
        ],
      );

      return planId;
    },

    async upsertCoupon(input: {
      active?: boolean;
      actorId: string;
      amountOffMinor?: number;
      code: string;
      currency?: string;
      discountType: BillingCouponDiscountType;
      duration: BillingCouponDuration;
      durationMonths?: number;
      maxRedemptions?: number;
      name: string;
      percentOffBasisPoints?: number;
      provider?: string;
      providerCouponId?: string;
      redeemBy?: string;
    }) {
      const code = input.code.trim().toUpperCase();

      if (!/^[A-Z0-9][A-Z0-9_-]{1,63}$/.test(code)) {
        throw new BillingError(
          "Coupon code must use 2-64 letters, numbers, underscores, or dashes.",
          "invalid_coupon_code",
        );
      }

      if (
        input.discountType === "amount" &&
        (!Number.isInteger(input.amountOffMinor) ||
          (input.amountOffMinor ?? 0) < 1 ||
          !input.currency)
      ) {
        throw new BillingError(
          "Amount coupons require a positive amount and currency.",
          "invalid_coupon_amount",
        );
      }

      if (
        input.discountType === "percent" &&
        (!Number.isInteger(input.percentOffBasisPoints) ||
          (input.percentOffBasisPoints ?? 0) < 1 ||
          (input.percentOffBasisPoints ?? 0) > 10_000)
      ) {
        throw new BillingError(
          "Percent coupons require 1-10000 basis points.",
          "invalid_coupon_percent",
        );
      }

      if (
        input.duration === "repeating" &&
        (!Number.isInteger(input.durationMonths) ||
          (input.durationMonths ?? 0) < 1)
      ) {
        throw new BillingError(
          "Repeating coupons require a positive duration in months.",
          "invalid_coupon_duration",
        );
      }

      const client = await getClient();
      let providerCouponId = input.providerCouponId;

      if (input.provider) {
        const provider = await getProviderRow(client, input.provider);

        if (!provider.enabled && !providerCouponId) {
          throw new BillingError(
            "Provider must be enabled before creating a provider coupon.",
            "provider_disabled",
          );
        }

        if (!providerCouponId) {
          const result = await getAdapter(input.provider).createCoupon({
            amountOffMinor: input.amountOffMinor,
            code,
            currency: input.currency
              ? normalizeCurrency(input.currency)
              : undefined,
            discountType: input.discountType,
            duration: input.duration,
            durationMonths: input.durationMonths,
            maxRedemptions: input.maxRedemptions,
            name: input.name,
            percentOffBasisPoints: input.percentOffBasisPoints,
            redeemBy: input.redeemBy,
          });

          providerCouponId = result.id;
        }
      }

      const couponId = `coupon_${code.toLowerCase()}`;
      const timestamp = now().toISOString();

      await client.execute(
        `
          INSERT INTO billing_coupons (
            id,
            code,
            name,
            provider,
            provider_coupon_id,
            discount_type,
            percent_off_basis_points,
            amount_off_minor,
            currency,
            duration,
            duration_months,
            max_redemptions,
            redeem_by,
            active,
            metadata,
            created_at,
            updated_at,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, '{}'::jsonb, $15, $15, $16)
          ON CONFLICT (id) DO UPDATE SET
            code = EXCLUDED.code,
            name = EXCLUDED.name,
            provider = EXCLUDED.provider,
            provider_coupon_id = EXCLUDED.provider_coupon_id,
            discount_type = EXCLUDED.discount_type,
            percent_off_basis_points = EXCLUDED.percent_off_basis_points,
            amount_off_minor = EXCLUDED.amount_off_minor,
            currency = EXCLUDED.currency,
            duration = EXCLUDED.duration,
            duration_months = EXCLUDED.duration_months,
            max_redemptions = EXCLUDED.max_redemptions,
            redeem_by = EXCLUDED.redeem_by,
            active = EXCLUDED.active,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by
        `,
        [
          couponId,
          code,
          input.name,
          input.provider || null,
          providerCouponId,
          input.discountType,
          input.discountType === "percent" ? input.percentOffBasisPoints : null,
          input.discountType === "amount" ? input.amountOffMinor : null,
          input.discountType === "amount" && input.currency
            ? normalizeCurrency(input.currency)
            : null,
          input.duration,
          input.duration === "repeating" ? input.durationMonths : null,
          input.maxRedemptions ?? null,
          optionalTimestamp(input.redeemBy),
          input.active ?? true,
          timestamp,
          input.actorId,
        ],
      );
      await audit(client, {
        actorId: input.actorId,
        eventType: "billing.coupon.saved",
        payload: {
          code,
          provider: input.provider,
          providerCouponId,
        },
        subjectId: couponId,
        subjectType: "coupon",
      });

      return couponId;
    },

    async upsertPrice(input: {
      active?: boolean;
      actorId: string;
      billingScheme?: string;
      currency: string;
      interval: BillingInterval;
      intervalCount?: number;
      planId: string;
      priceId?: string;
      provider: string;
      providerPriceId?: string;
      sortOrder?: number;
      taxBehavior: BillingTaxBehavior;
      unitAmountMinor: number;
      usageType: BillingUsageType;
    }) {
      if (
        !Number.isInteger(input.unitAmountMinor) ||
        input.unitAmountMinor < 0
      ) {
        throw new BillingError(
          "Price amount must be a non-negative integer.",
          "invalid_price",
        );
      }

      const client = await getClient();
      const priceId =
        input.priceId ||
        `price_${input.provider}_${input.planId}_${input.currency}_${input.interval}`;
      const timestamp = now().toISOString();

      await getProviderRow(client, input.provider);
      await findPlanRow(client, input.planId);
      await client.execute(
        `
          INSERT INTO billing_prices (
            id,
            plan_id,
            provider,
            provider_price_id,
            currency,
            unit_amount_minor,
            interval,
            interval_count,
            usage_type,
            billing_scheme,
            tax_behavior,
            active,
            sort_order,
            metadata,
            created_at,
            updated_at,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, '{}'::jsonb, $14, $14, $15)
          ON CONFLICT (id) DO UPDATE SET
            plan_id = EXCLUDED.plan_id,
            provider = EXCLUDED.provider,
            provider_price_id = EXCLUDED.provider_price_id,
            currency = EXCLUDED.currency,
            unit_amount_minor = EXCLUDED.unit_amount_minor,
            interval = EXCLUDED.interval,
            interval_count = EXCLUDED.interval_count,
            usage_type = EXCLUDED.usage_type,
            billing_scheme = EXCLUDED.billing_scheme,
            tax_behavior = EXCLUDED.tax_behavior,
            active = EXCLUDED.active,
            sort_order = EXCLUDED.sort_order,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by
        `,
        [
          priceId,
          input.planId,
          input.provider,
          input.providerPriceId,
          normalizeCurrency(input.currency),
          input.unitAmountMinor,
          input.interval,
          input.intervalCount ?? 1,
          input.usageType,
          input.billingScheme ?? "per_unit",
          input.taxBehavior,
          input.active ?? true,
          input.sortOrder ?? 0,
          timestamp,
          input.actorId,
        ],
      );

      return priceId;
    },

    async upsertTaxRate(input: {
      active?: boolean;
      actorId: string;
      country: string;
      inclusive?: boolean;
      percentageBasisPoints: number;
      provider?: string;
      region?: string;
      taxRateId?: string;
      taxType: string;
    }) {
      if (
        !Number.isInteger(input.percentageBasisPoints) ||
        input.percentageBasisPoints < 0
      ) {
        throw new BillingError(
          "Tax rate must be non-negative.",
          "invalid_tax_rate",
        );
      }

      const client = await getClient();
      const timestamp = now().toISOString();
      const id =
        input.taxRateId ||
        `tax_${input.country.trim().toLowerCase()}_${input.taxType
          .trim()
          .toLowerCase()}`;

      await client.execute(
        `
          INSERT INTO billing_tax_rates (
            id,
            country,
            region,
            tax_type,
            percentage_basis_points,
            inclusive,
            active,
            provider,
            metadata,
            created_at,
            updated_at,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb, $9, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            country = EXCLUDED.country,
            region = EXCLUDED.region,
            tax_type = EXCLUDED.tax_type,
            percentage_basis_points = EXCLUDED.percentage_basis_points,
            inclusive = EXCLUDED.inclusive,
            active = EXCLUDED.active,
            provider = EXCLUDED.provider,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by
        `,
        [
          id,
          input.country.trim().toUpperCase(),
          input.region?.trim().toUpperCase() || null,
          input.taxType.trim(),
          input.percentageBasisPoints,
          input.inclusive ?? false,
          input.active ?? true,
          input.provider,
          timestamp,
          input.actorId,
        ],
      );

      return id;
    },

    async updateTaxSettings(input: {
      actorId: string;
      billingCountry?: string;
      billingRegion?: string;
      businessName?: string;
      organizationId: string;
      reverseCharge?: boolean;
      taxBehavior: BillingTaxBehavior;
      taxExempt?: boolean;
      taxId?: string;
    }) {
      const client = await getClient();

      await requireTenantPermission({
        actorId: input.actorId,
        client,
        organizationId: input.organizationId,
        permission: "billing.manage",
      });

      await client.execute(
        `
          INSERT INTO billing_tax_settings (
            tenant_id,
            business_name,
            billing_country,
            billing_region,
            tax_id,
            tax_exempt,
            reverse_charge,
            tax_behavior,
            metadata,
            updated_at,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb, $9, $10)
          ON CONFLICT (tenant_id) DO UPDATE SET
            business_name = EXCLUDED.business_name,
            billing_country = EXCLUDED.billing_country,
            billing_region = EXCLUDED.billing_region,
            tax_id = EXCLUDED.tax_id,
            tax_exempt = EXCLUDED.tax_exempt,
            reverse_charge = EXCLUDED.reverse_charge,
            tax_behavior = EXCLUDED.tax_behavior,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by
        `,
        [
          input.organizationId,
          input.businessName,
          input.billingCountry,
          input.billingRegion,
          input.taxId,
          input.taxExempt ?? false,
          input.reverseCharge ?? false,
          input.taxBehavior,
          now().toISOString(),
          input.actorId,
        ],
      );
    },

    async updateTenantBillingSettings(input: {
      actorId: string;
      defaultCurrency: string;
      organizationId: string;
      paymentProvider: string;
      taxBehavior: BillingTaxBehavior;
    }) {
      const client = await getClient();

      await requireTenantPermission({
        actorId: input.actorId,
        client,
        organizationId: input.organizationId,
        permission: "billing.manage",
      });

      const currency = normalizeCurrency(input.defaultCurrency);
      await getProviderRow(client, input.paymentProvider);
      await client.execute(
        `
          INSERT INTO billing_tenant_settings (
            tenant_id,
            default_currency,
            payment_provider,
            tax_behavior,
            created_at,
            updated_at,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $5, $6)
          ON CONFLICT (tenant_id) DO UPDATE SET
            default_currency = EXCLUDED.default_currency,
            payment_provider = EXCLUDED.payment_provider,
            tax_behavior = EXCLUDED.tax_behavior,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by
        `,
        [
          input.organizationId,
          currency,
          input.paymentProvider,
          input.taxBehavior,
          now().toISOString(),
          input.actorId,
        ],
      );
    },

    async upsertExchangeRate(input: {
      actorId: string;
      baseCurrency: string;
      manual?: boolean;
      provider: string;
      quoteCurrency: string;
      rateMicroUnits: number;
      validAt?: string;
    }) {
      if (!Number.isInteger(input.rateMicroUnits) || input.rateMicroUnits < 1) {
        throw new BillingError(
          "Exchange rate must be positive.",
          "invalid_exchange_rate",
        );
      }

      const client = await getClient();

      await client.execute(
        `
          INSERT INTO billing_exchange_rates (
            base_currency,
            quote_currency,
            rate_micro_units,
            provider,
            manual,
            valid_at,
            updated_at,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (base_currency, quote_currency) DO UPDATE SET
            rate_micro_units = EXCLUDED.rate_micro_units,
            provider = EXCLUDED.provider,
            manual = EXCLUDED.manual,
            valid_at = EXCLUDED.valid_at,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by
        `,
        [
          normalizeCurrency(input.baseCurrency),
          normalizeCurrency(input.quoteCurrency),
          input.rateMicroUnits,
          input.provider,
          input.manual ?? true,
          optionalTimestamp(input.validAt) ?? now().toISOString(),
          now().toISOString(),
          input.actorId,
        ],
      );
    },

    currencyDecimalPrecision,
  };

  return service;
}
