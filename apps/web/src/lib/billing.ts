import {
  createBillingService,
  createMockPaymentProviderAdapter,
  createStripeCompatiblePaymentProviderAdapter,
  type PaymentProviderAdapter,
} from "@nextjs-saas/billing";

function configuredAdapters(): PaymentProviderAdapter[] {
  const adapters: PaymentProviderAdapter[] = [
    createMockPaymentProviderAdapter({
      baseUrl: process.env.NEXT_PUBLIC_APP_URL,
      webhookSecret: process.env.BILLING_MOCK_WEBHOOK_SECRET,
    }),
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

export function getBillingService() {
  return createBillingService({
    adapters: configuredAdapters(),
    appBaseUrl: process.env.NEXT_PUBLIC_APP_URL,
  });
}
