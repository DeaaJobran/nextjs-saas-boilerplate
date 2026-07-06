export const billingProviders = ["mock", "stripe"] as const;
export const billingIntervals = ["month", "year", "one_time", "usage"] as const;
export const billingSubscriptionStatuses = [
  "active",
  "canceled",
  "incomplete",
  "past_due",
  "paused",
  "trialing",
  "unpaid",
] as const;
export const billingTaxBehaviors = [
  "exclusive",
  "inclusive",
  "unspecified",
] as const;
export const billingUsageTypes = ["licensed", "metered", "one_time"] as const;
export const billingCouponDiscountTypes = ["amount", "percent"] as const;
export const billingCouponDurations = ["forever", "once", "repeating"] as const;

export type BillingProviderKey = (typeof billingProviders)[number] | string;
export type BillingInterval = (typeof billingIntervals)[number];
export type BillingSubscriptionStatus =
  (typeof billingSubscriptionStatuses)[number];
export type BillingTaxBehavior = (typeof billingTaxBehaviors)[number];
export type BillingUsageType = (typeof billingUsageTypes)[number];
export type BillingCouponDiscountType =
  (typeof billingCouponDiscountTypes)[number];
export type BillingCouponDuration = (typeof billingCouponDurations)[number];

export type BillingMoney = {
  amountMinor: number;
  currency: string;
};

export type BillingPlanTranslation = {
  ctaLabel: string;
  description: string;
  features: string[];
  locale: string;
  name: string;
};

export type BillingPrice = BillingMoney & {
  active: boolean;
  billingScheme: "per_unit" | "tiered" | string;
  id: string;
  interval: BillingInterval;
  intervalCount: number;
  metadata: Record<string, unknown>;
  planId: string;
  provider: BillingProviderKey;
  providerPriceId?: string;
  sortOrder: number;
  taxBehavior: BillingTaxBehavior;
  usageType: BillingUsageType;
};

export type BillingCoupon = {
  active: boolean;
  amountOffMinor?: number;
  code: string;
  currency?: string;
  discountType: BillingCouponDiscountType | string;
  duration: BillingCouponDuration | string;
  durationMonths?: number;
  id: string;
  maxRedemptions?: number;
  metadata: Record<string, unknown>;
  name: string;
  percentOffBasisPoints?: number;
  provider?: BillingProviderKey;
  providerCouponId?: string;
  redeemBy?: string;
};

export type BillingDiscount = {
  code: string;
  couponId: string;
  endsAt?: string;
  id: string;
  name: string;
  provider?: BillingProviderKey;
  providerDiscountId?: string;
  startsAt: string;
  status: string;
  subscriptionId?: string;
  tenantId: string;
};

export type BillingPlan = {
  entitlements: BillingEntitlementConfig;
  highlighted: boolean;
  id: string;
  metadata: Record<string, unknown>;
  prices: BillingPrice[];
  publicVisible: boolean;
  seatBased: boolean;
  slug: string;
  sortOrder: number;
  status: "active" | "archived" | "draft" | string;
  translation: BillingPlanTranslation;
  trialDays: number;
  usageBased: boolean;
};

export type BillingEntitlementConfig = {
  features?: string[];
  limits?: Record<string, number>;
};

export type PaymentProviderCapabilities = {
  checkout: boolean;
  portal: boolean;
  refunds: boolean;
  subscriptions: boolean;
  supportedCurrencies: string[];
};

export type CheckoutSessionInput = {
  appBaseUrl: string;
  cancelUrl: string;
  clientReferenceId: string;
  currency: string;
  customerEmail?: string;
  discount?: {
    code: string;
    couponId: string;
    providerCouponId?: string;
  };
  metadata: Record<string, string>;
  mode: "payment" | "subscription";
  price: BillingPrice;
  quantity: number;
  successUrl: string;
  tenantId: string;
  trialDays?: number;
};

export type CheckoutSessionResult = {
  expiresAt?: string;
  id: string;
  status: "open" | "complete" | "expired";
  url: string;
};

export type BillingPortalInput = {
  appBaseUrl: string;
  providerCustomerId: string;
  returnUrl: string;
  tenantId: string;
};

export type BillingPortalResult = {
  id: string;
  url: string;
};

export type SubscriptionUpdateInput = {
  cancelAtPeriodEnd?: boolean;
  priceProviderId?: string;
  providerCouponId?: string;
  providerSubscriptionItemId?: string;
  providerSubscriptionId: string;
  quantity?: number;
};

export type CouponInput = {
  amountOffMinor?: number;
  code: string;
  currency?: string;
  discountType: BillingCouponDiscountType | string;
  duration: BillingCouponDuration | string;
  durationMonths?: number;
  maxRedemptions?: number;
  name: string;
  percentOffBasisPoints?: number;
  redeemBy?: string;
};

export type CouponResult = {
  amountOffMinor?: number;
  currency?: string;
  id: string;
  percentOffBasisPoints?: number;
};

export type RefundInput = {
  amountMinor?: number;
  currency: string;
  invoiceId?: string;
  metadata?: Record<string, string>;
  providerPaymentId: string;
  reason?: string;
  tenantId: string;
};

export type RefundResult = {
  amountMinor: number;
  currency: string;
  id: string;
  providerPaymentId?: string;
  status: string;
};

export type ProviderWebhookInput = {
  rawBody: string;
  signatureHeader?: string;
};

export type ProviderWebhookEvent = {
  createdAt: string;
  id: string;
  payload: Record<string, unknown>;
  tenantId?: string;
  type: string;
};

export type PaymentProviderAdapter = {
  capabilities: PaymentProviderCapabilities;
  createBillingPortalSession(
    input: BillingPortalInput,
  ): Promise<BillingPortalResult>;
  createCheckoutSession(
    input: CheckoutSessionInput,
  ): Promise<CheckoutSessionResult>;
  createCoupon(input: CouponInput): Promise<CouponResult>;
  createRefund(input: RefundInput): Promise<RefundResult>;
  key: BillingProviderKey;
  updateSubscription(input: SubscriptionUpdateInput): Promise<void>;
  verifyWebhook(input: ProviderWebhookInput): Promise<ProviderWebhookEvent>;
};

export type CheckoutCompletedEvent = {
  customerEmail?: string;
  providerCustomerId?: string;
  providerSessionId: string;
  providerSubscriptionId?: string;
  tenantId: string;
};

export type SubscriptionChangedEvent = {
  cancelAt?: string;
  canceledAt?: string;
  currentPeriodEnd?: string;
  currentPeriodStart?: string;
  gracePeriodEndsAt?: string;
  priceProviderId?: string;
  providerCustomerId?: string;
  providerSubscriptionItemId?: string;
  providerSubscriptionId: string;
  quantity: number;
  status: BillingSubscriptionStatus | string;
  tenantId: string;
  trialEnd?: string;
  trialStart?: string;
};

export type InvoiceChangedEvent = {
  amountDueMinor: number;
  amountPaidMinor: number;
  currency: string;
  discountMinor: number;
  dueAt?: string;
  hostedInvoiceUrl?: string;
  issuedAt?: string;
  items: ProviderInvoiceItem[];
  paidAt?: string;
  periodEnd?: string;
  periodStart?: string;
  providerCustomerId?: string;
  providerInvoiceId: string;
  providerSubscriptionId?: string;
  status: string;
  subtotalMinor: number;
  taxBehavior: BillingTaxBehavior;
  taxMinor: number;
  tenantId: string;
  totalMinor: number;
};

export type ProviderInvoiceItem = {
  description: string;
  discountMinor?: number;
  priceProviderId?: string;
  quantity: number;
  subtotalMinor: number;
  taxBreakdown?: Record<string, unknown>[];
  taxMinor: number;
  totalMinor: number;
  unitAmountMinor: number;
};

export type PaymentMethodChangedEvent = {
  billingEmail?: string;
  billingName?: string;
  brand?: string;
  expMonth?: number;
  expYear?: number;
  last4?: string;
  providerCustomerId?: string;
  providerPaymentMethodId: string;
  status: string;
  tenantId: string;
  type: string;
};

export type RefundChangedEvent = {
  amountMinor: number;
  currency: string;
  invoiceProviderId?: string;
  providerPaymentId?: string;
  providerRefundId: string;
  reason?: string;
  status: string;
  tenantId: string;
};
