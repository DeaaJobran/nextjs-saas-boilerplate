ALTER TABLE billing_tenant_settings
  ADD COLUMN IF NOT EXISTS grace_period_days integer NOT NULL DEFAULT 0;

ALTER TABLE billing_invoices
  ADD COLUMN IF NOT EXISTS provider_payment_id text;

UPDATE billing_payment_providers
SET capabilities = capabilities || jsonb_build_object(
  'coupons', true,
  'paymentMethods', true,
  'usageReporting', true,
  'webhooks', true
),
updated_at = now()
WHERE provider IN ('mock', 'stripe');
