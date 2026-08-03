# Billing, payments, currency, and tax

`@nextjs-saas/billing` owns plans, localized plan translations, prices, checkout sessions, subscriptions, invoices, invoice items, payment methods, coupons, discounts, refunds, usage meters, entitlements, exchange rates, tenant billing/tax settings, signed provider webhooks, and billing audit events.

## Service and tenant boundary

Use `createBillingService()` from server code. The service uses the shared database runtime by default and accepts injected database, clock, application URL, and payment adapters for tests or custom deployments. Tenant mutations require the corresponding `@nextjs-saas/tenant` permission; route and UI checks do not replace service authorization.

Public pricing reads active provider-aware plans and prices. Tenant checkout, portal, subscription, invoice, refund, usage, and entitlement operations should go through the service so authorization, currency capability checks, idempotency, and audit behavior stay consistent.

Provider customer, subscription, invoice, payment-method, and refund identifiers are permanently bound to their first established tenant. Signed webhook metadata can fill a missing tenant scope, but it cannot move an existing billing object to another tenant. Database guards also reject tenant reassignment and cross-tenant invoice, discount, refund, and entitlement references.

## Payment provider adapters

Providers implement `PaymentProviderAdapter`, including explicit capability flags for checkout, coupons, portal, refunds, payment methods, subscriptions, usage reporting, currencies, and webhook verification. Service operations require both the stored provider configuration and the runtime adapter to advertise the capability. The package includes these vendors in configurable display order:

- Stripe as the first supported external billing vendor;
- a local mock adapter for development and deterministic tests.

Applications inject configured adapters:

```ts
import {
  createBillingService,
  createMockPaymentProviderAdapter,
  createStripeCompatiblePaymentProviderAdapter,
} from "@nextjs-saas/billing";

const billing = createBillingService({
  adapters: [
    createStripeCompatiblePaymentProviderAdapter({
      secretKey: process.env.STRIPE_SECRET_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    }),
    createMockPaymentProviderAdapter({
      baseUrl: process.env.NEXT_PUBLIC_APP_URL,
      webhookSecret: process.env.BILLING_MOCK_WEBHOOK_SECRET,
    }),
  ],
});
```

Keep provider credentials in environment or secret storage. Never persist adapter secrets in billing provider records.

The mock provider is enabled by default only outside production. Set `BILLING_ALLOW_MOCK_PAYMENTS=true` solely for an intentional production-hosted sandbox; ordinary production deployments should configure a real adapter and leave the mock routes disabled.

Usage records are idempotent per tenant and meter. When an active usage-based subscription has a matching metered price, the service also reports the event through the provider adapter. Configure provider-specific meter event names in usage-meter `providerEventNames` metadata or price `providerMeterEventName` metadata; otherwise the meter key is used.

## Webhook and subscription state

Billing truth comes from verified provider webhooks, not browser redirects. Pass the raw request body and signature to the adapter. Webhook event IDs are persisted for idempotency before state transitions are applied. Checkout and portal redirects are navigation helpers only.

Entitlements are derived from active or trialing subscriptions and usage rules. Past-due access uses the tenant's explicit grace-period policy and is denied after that deadline even if no later webhook arrives.

Invoice webhooks persist the verified provider payment reference used for refunds. Refund requests lock the invoice, enforce the remaining paid balance, and pass a tenant-scoped idempotency key to the provider; callers do not supply arbitrary payment references. Automatic Stripe refunds are available only when one paid PaymentIntent accounts for the invoice's complete paid amount. Invoices with multiple, partial, or out-of-band payments require provider-specific reconciliation instead of guessing a refundable payment.

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
