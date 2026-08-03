# Billing, payments, currency, and tax

`@nextjs-saas/billing` owns plans, localized plan translations, prices, checkout sessions, subscriptions, invoices, invoice items, payment methods, coupons, discounts, refunds, usage meters, entitlements, exchange rates, tenant billing/tax settings, signed provider webhooks, and billing audit events.

## Service and tenant boundary

Use `createBillingService()` from server code. The service uses the shared database runtime by default and accepts injected database, clock, application URL, and payment adapters for tests or custom deployments. Tenant mutations require the corresponding `@nextjs-saas/tenant` permission; route and UI checks do not replace service authorization.

Public pricing reads active provider-aware plans and prices. Tenant checkout, portal, subscription, invoice, refund, usage, and entitlement operations should go through the service so authorization, currency capability checks, idempotency, and audit behavior stay consistent.

## Payment provider adapters

Providers implement `PaymentProviderAdapter`, including explicit capability flags for checkout, portal, refunds, payment methods, currencies, and webhook verification. The package includes:

- a local mock adapter for development and deterministic tests;
- a Stripe-compatible REST adapter for external payments.

Applications inject configured adapters:

```ts
import {
  createBillingService,
  createMockPaymentProviderAdapter,
  createStripeCompatiblePaymentProviderAdapter,
} from "@nextjs-saas/billing";

const billing = createBillingService({
  adapters: [
    createMockPaymentProviderAdapter({
      baseUrl: process.env.NEXT_PUBLIC_APP_URL,
      webhookSecret: process.env.BILLING_MOCK_WEBHOOK_SECRET,
    }),
    createStripeCompatiblePaymentProviderAdapter({
      secretKey: process.env.STRIPE_SECRET_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    }),
  ],
});
```

Keep provider credentials in environment or secret storage. Never persist adapter secrets in billing provider records.

## Webhook and subscription state

Billing truth comes from verified provider webhooks, not browser redirects. Pass the raw request body and signature to the adapter. Webhook event IDs are persisted for idempotency before state transitions are applied. Checkout and portal redirects are navigation helpers only.

Entitlements are derived from active or trialing subscriptions and usage rules. Past-due grace behavior must remain explicit in plan or tenant policy rather than being inferred in page components.

## Currency and tax

Currency utilities normalize codes, apply ISO-style decimal precision, round minor units, format localized values, and convert with explicit exchange rates. Providers declare supported currencies, and checkout rejects unsupported combinations.

The tax contract supports inclusive/exclusive behavior, tenant tax settings, customer region and tax IDs, reverse charge, manual tax rules, and stored invoice tax breakdowns. The bundled manual provider is an engineering fallback, not legal, accounting, or tax compliance advice. Production compliance may require a qualified external provider and professional review.

## Verification

Run:

```bash
pnpm --filter @nextjs-saas/billing test
pnpm --filter @nextjs-saas/billing typecheck
pnpm --filter @nextjs-saas/db test
```

Tests cover adapter capabilities, signed/idempotent webhooks, subscriptions, entitlements, usage, invoices, refunds, currency conversion and rounding, tax calculations, and tenant authorization.
