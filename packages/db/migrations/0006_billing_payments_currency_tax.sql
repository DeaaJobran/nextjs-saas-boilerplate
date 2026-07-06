CREATE TABLE IF NOT EXISTS billing_payment_providers (
  id text PRIMARY KEY,
  provider text NOT NULL,
  display_name text NOT NULL,
  mode text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  secret_ref text,
  webhook_secret_ref text,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_payment_providers_provider_unique
  ON billing_payment_providers (provider);

CREATE TABLE IF NOT EXISTS billing_tenant_settings (
  tenant_id text PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  default_currency text NOT NULL,
  payment_provider text NOT NULL,
  tax_behavior text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS billing_plans (
  id text PRIMARY KEY,
  slug text NOT NULL,
  status text NOT NULL,
  public_visible boolean NOT NULL DEFAULT true,
  highlighted boolean NOT NULL DEFAULT false,
  trial_days integer NOT NULL DEFAULT 0,
  seat_based boolean NOT NULL DEFAULT false,
  usage_based boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_plans_slug_unique
  ON billing_plans (slug);

CREATE INDEX IF NOT EXISTS billing_plans_public_status_idx
  ON billing_plans (public_visible, status, sort_order);

CREATE TABLE IF NOT EXISTS billing_plan_translations (
  plan_id text NOT NULL REFERENCES billing_plans(id) ON DELETE CASCADE,
  locale text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta_label text NOT NULL,
  PRIMARY KEY (plan_id, locale)
);

CREATE TABLE IF NOT EXISTS billing_prices (
  id text PRIMARY KEY,
  plan_id text NOT NULL REFERENCES billing_plans(id) ON DELETE CASCADE,
  provider text NOT NULL REFERENCES billing_payment_providers(provider) ON DELETE RESTRICT,
  provider_price_id text,
  currency text NOT NULL,
  unit_amount_minor bigint NOT NULL,
  interval text NOT NULL,
  interval_count integer NOT NULL DEFAULT 1,
  usage_type text NOT NULL,
  billing_scheme text NOT NULL,
  tax_behavior text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS billing_prices_plan_active_idx
  ON billing_prices (plan_id, active, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS billing_prices_provider_price_unique
  ON billing_prices (provider, provider_price_id)
  WHERE provider_price_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS billing_customers (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL REFERENCES billing_payment_providers(provider) ON DELETE RESTRICT,
  provider_customer_id text NOT NULL,
  email text,
  name text,
  preferred_currency text,
  billing_country text,
  billing_region text,
  tax_id text,
  reverse_charge boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_customers_provider_customer_unique
  ON billing_customers (provider, provider_customer_id);

CREATE INDEX IF NOT EXISTS billing_customers_tenant_provider_idx
  ON billing_customers (tenant_id, provider);

CREATE TABLE IF NOT EXISTS billing_checkout_sessions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL REFERENCES billing_payment_providers(provider) ON DELETE RESTRICT,
  provider_session_id text NOT NULL,
  plan_id text NOT NULL REFERENCES billing_plans(id) ON DELETE RESTRICT,
  price_id text NOT NULL REFERENCES billing_prices(id) ON DELETE RESTRICT,
  mode text NOT NULL,
  status text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  currency text NOT NULL,
  amount_minor bigint NOT NULL,
  client_reference_id text NOT NULL,
  url text NOT NULL,
  success_url text NOT NULL,
  cancel_url text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_checkout_sessions_provider_session_unique
  ON billing_checkout_sessions (provider, provider_session_id);

CREATE INDEX IF NOT EXISTS billing_checkout_sessions_tenant_status_idx
  ON billing_checkout_sessions (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL REFERENCES billing_payment_providers(provider) ON DELETE RESTRICT,
  provider_subscription_id text NOT NULL,
  provider_subscription_item_id text,
  provider_customer_id text,
  plan_id text NOT NULL REFERENCES billing_plans(id) ON DELETE RESTRICT,
  price_id text NOT NULL REFERENCES billing_prices(id) ON DELETE RESTRICT,
  status text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  grace_period_ends_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_subscriptions_provider_subscription_unique
  ON billing_subscriptions (provider, provider_subscription_id);

CREATE INDEX IF NOT EXISTS billing_subscriptions_tenant_status_idx
  ON billing_subscriptions (tenant_id, status, current_period_end DESC);

CREATE TABLE IF NOT EXISTS billing_invoices (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL REFERENCES billing_payment_providers(provider) ON DELETE RESTRICT,
  provider_invoice_id text NOT NULL,
  provider_customer_id text,
  subscription_id text REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
  status text NOT NULL,
  currency text NOT NULL,
  subtotal_minor bigint NOT NULL DEFAULT 0,
  discount_minor bigint NOT NULL DEFAULT 0,
  tax_minor bigint NOT NULL DEFAULT 0,
  total_minor bigint NOT NULL DEFAULT 0,
  amount_due_minor bigint NOT NULL DEFAULT 0,
  amount_paid_minor bigint NOT NULL DEFAULT 0,
  tax_behavior text NOT NULL,
  hosted_invoice_url text,
  due_at timestamptz,
  issued_at timestamptz,
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_invoices_provider_invoice_unique
  ON billing_invoices (provider, provider_invoice_id);

CREATE INDEX IF NOT EXISTS billing_invoices_tenant_status_idx
  ON billing_invoices (tenant_id, status, issued_at DESC);

CREATE TABLE IF NOT EXISTS billing_invoice_items (
  id text PRIMARY KEY,
  invoice_id text NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
  plan_id text REFERENCES billing_plans(id) ON DELETE SET NULL,
  price_id text REFERENCES billing_prices(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_amount_minor bigint NOT NULL DEFAULT 0,
  subtotal_minor bigint NOT NULL DEFAULT 0,
  discount_minor bigint NOT NULL DEFAULT 0,
  tax_minor bigint NOT NULL DEFAULT 0,
  total_minor bigint NOT NULL DEFAULT 0,
  tax_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS billing_invoice_items_invoice_idx
  ON billing_invoice_items (invoice_id);

CREATE TABLE IF NOT EXISTS billing_payment_methods (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL REFERENCES billing_payment_providers(provider) ON DELETE RESTRICT,
  provider_payment_method_id text NOT NULL,
  provider_customer_id text,
  type text NOT NULL,
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  billing_name text,
  billing_email text,
  status text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_payment_methods_provider_method_unique
  ON billing_payment_methods (provider, provider_payment_method_id);

CREATE INDEX IF NOT EXISTS billing_payment_methods_tenant_status_idx
  ON billing_payment_methods (tenant_id, status);

CREATE TABLE IF NOT EXISTS billing_coupons (
  id text PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  provider text REFERENCES billing_payment_providers(provider) ON DELETE SET NULL,
  provider_coupon_id text,
  discount_type text NOT NULL,
  percent_off_basis_points integer,
  amount_off_minor bigint,
  currency text,
  duration text NOT NULL,
  duration_months integer,
  max_redemptions integer,
  redeem_by timestamptz,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_coupons_code_unique
  ON billing_coupons (code);

CREATE UNIQUE INDEX IF NOT EXISTS billing_coupons_provider_coupon_unique
  ON billing_coupons (provider, provider_coupon_id)
  WHERE provider_coupon_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS billing_discounts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  coupon_id text NOT NULL REFERENCES billing_coupons(id) ON DELETE RESTRICT,
  subscription_id text REFERENCES billing_subscriptions(id) ON DELETE CASCADE,
  provider text REFERENCES billing_payment_providers(provider) ON DELETE SET NULL,
  provider_discount_id text,
  status text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS billing_discounts_tenant_status_idx
  ON billing_discounts (tenant_id, status, starts_at DESC);

CREATE TABLE IF NOT EXISTS billing_refunds (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id text REFERENCES billing_invoices(id) ON DELETE SET NULL,
  provider text NOT NULL REFERENCES billing_payment_providers(provider) ON DELETE RESTRICT,
  provider_refund_id text NOT NULL,
  provider_payment_id text,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  reason text,
  status text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  created_by text REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_refunds_provider_refund_unique
  ON billing_refunds (provider, provider_refund_id);

CREATE INDEX IF NOT EXISTS billing_refunds_tenant_status_idx
  ON billing_refunds (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS billing_usage_meters (
  id text PRIMARY KEY,
  key text NOT NULL,
  name text NOT NULL,
  aggregation text NOT NULL,
  unit text NOT NULL,
  reset_interval text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_usage_meters_key_unique
  ON billing_usage_meters (key);

CREATE TABLE IF NOT EXISTS billing_usage_records (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  meter_id text NOT NULL REFERENCES billing_usage_meters(id) ON DELETE RESTRICT,
  quantity bigint NOT NULL,
  idempotency_key text NOT NULL,
  occurred_at timestamptz NOT NULL,
  provider text REFERENCES billing_payment_providers(provider) ON DELETE SET NULL,
  provider_record_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_usage_records_meter_idempotency_unique
  ON billing_usage_records (tenant_id, meter_id, idempotency_key);

CREATE INDEX IF NOT EXISTS billing_usage_records_tenant_occurred_idx
  ON billing_usage_records (tenant_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS billing_entitlements (
  tenant_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  source text NOT NULL,
  plan_id text REFERENCES billing_plans(id) ON DELETE SET NULL,
  subscription_id text REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
  limit_value bigint,
  used_value bigint NOT NULL DEFAULT 0,
  reset_at timestamptz,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, feature_key)
);

CREATE INDEX IF NOT EXISTS billing_entitlements_tenant_enabled_idx
  ON billing_entitlements (tenant_id, enabled);

CREATE TABLE IF NOT EXISTS billing_exchange_rates (
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  rate_micro_units bigint NOT NULL,
  provider text NOT NULL,
  manual boolean NOT NULL DEFAULT false,
  valid_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text REFERENCES auth_users(id) ON DELETE SET NULL,
  PRIMARY KEY (base_currency, quote_currency)
);

CREATE TABLE IF NOT EXISTS billing_tax_settings (
  tenant_id text PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  business_name text,
  billing_country text,
  billing_region text,
  tax_id text,
  tax_exempt boolean NOT NULL DEFAULT false,
  reverse_charge boolean NOT NULL DEFAULT false,
  tax_behavior text NOT NULL,
  provider text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL,
  updated_by text REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS billing_tax_rates (
  id text PRIMARY KEY,
  country text NOT NULL,
  region text,
  tax_type text NOT NULL,
  percentage_basis_points integer NOT NULL,
  inclusive boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  provider text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS billing_tax_rates_country_active_idx
  ON billing_tax_rates (country, region, active);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id text PRIMARY KEY,
  provider text NOT NULL REFERENCES billing_payment_providers(provider) ON DELETE RESTRICT,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL,
  tenant_id text REFERENCES organizations(id) ON DELETE SET NULL,
  signature_header text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_body_sha256 text NOT NULL,
  processing_error text,
  received_at timestamptz NOT NULL,
  processed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_webhook_events_provider_event_unique
  ON billing_webhook_events (provider, provider_event_id);

CREATE INDEX IF NOT EXISTS billing_webhook_events_status_received_idx
  ON billing_webhook_events (status, received_at DESC);

CREATE TABLE IF NOT EXISTS billing_audit_events (
  id text PRIMARY KEY,
  tenant_id text REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id text REFERENCES auth_users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  subject_type text,
  subject_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS billing_audit_events_tenant_created_idx
  ON billing_audit_events (tenant_id, created_at DESC);

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
  updated_at
)
VALUES
  (
    'provider_mock',
    'mock',
    'Local mock payments',
    'test',
    true,
    NULL,
    'BILLING_MOCK_WEBHOOK_SECRET',
    '{"checkout":true,"portal":true,"refunds":true,"subscriptions":true,"supportedCurrencies":["USD","EUR","SAR"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'provider_stripe',
    'stripe',
    'Stripe-compatible',
    'test',
    false,
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    '{"checkout":true,"portal":true,"refunds":true,"subscriptions":true,"supportedCurrencies":["USD","EUR","SAR","GBP"]}'::jsonb,
    '{"apiBaseUrl":"https://api.stripe.com","apiVersion":"2025-09-30.clover"}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (provider) DO NOTHING;

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
  updated_at
)
VALUES
  (
    'plan_starter',
    'starter',
    'active',
    true,
    false,
    14,
    false,
    false,
    10,
    '{"features":["dashboard","organization_settings"],"limits":{"members":3,"api_keys":1}}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'plan_team',
    'team',
    'active',
    true,
    true,
    14,
    true,
    true,
    20,
    '{"features":["dashboard","organization_settings","team_management","api_access","priority_support"],"limits":{"members":25,"api_keys":10,"ai_tokens":100000}}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO billing_plan_translations (
  plan_id,
  locale,
  name,
  description,
  features,
  cta_label
)
VALUES
  (
    'plan_starter',
    'en',
    'Starter',
    'For evaluating the boilerplate with real billing boundaries.',
    '["Tenant dashboard","Organization settings","Local mock checkout"]'::jsonb,
    'Start trial'
  ),
  (
    'plan_team',
    'en',
    'Team',
    'For teams wiring subscriptions, seats, usage, and entitlements.',
    '["Seat-based subscriptions","Usage metering","API access entitlements"]'::jsonb,
    'Choose team'
  ),
  (
    'plan_starter',
    'ar',
    'البداية',
    'لتقييم القالب مع حدود فوترة حقيقية.',
    '["لوحة تحكم المستأجر","إعدادات المؤسسة","دفع محلي تجريبي"]'::jsonb,
    'ابدأ التجربة'
  ),
  (
    'plan_team',
    'ar',
    'الفريق',
    'للفرق التي تربط الاشتراكات والمقاعد والاستخدام والصلاحيات.',
    '["اشتراكات حسب المقاعد","قياس الاستخدام","صلاحيات API"]'::jsonb,
    'اختر الفريق'
  )
ON CONFLICT (plan_id, locale) DO NOTHING;

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
  updated_at
)
VALUES
  ('price_starter_mock_usd_month', 'plan_starter', 'mock', 'mock_price_starter_usd_month', 'USD', 0, 'month', 1, 'licensed', 'per_unit', 'exclusive', true, 10, '{}'::jsonb, now(), now()),
  ('price_starter_mock_usd_year', 'plan_starter', 'mock', 'mock_price_starter_usd_year', 'USD', 0, 'year', 1, 'licensed', 'per_unit', 'exclusive', true, 20, '{}'::jsonb, now(), now()),
  ('price_team_mock_usd_month', 'plan_team', 'mock', 'mock_price_team_usd_month', 'USD', 2900, 'month', 1, 'licensed', 'per_unit', 'exclusive', true, 30, '{}'::jsonb, now(), now()),
  ('price_team_mock_usd_year', 'plan_team', 'mock', 'mock_price_team_usd_year', 'USD', 29000, 'year', 1, 'licensed', 'per_unit', 'exclusive', true, 40, '{}'::jsonb, now(), now()),
  ('price_team_mock_usd_usage', 'plan_team', 'mock', 'mock_price_team_usd_usage', 'USD', 2, 'usage', 1, 'metered', 'per_unit', 'exclusive', true, 50, '{"meterKey":"ai_tokens"}'::jsonb, now(), now()),
  ('price_team_mock_usd_onboarding', 'plan_team', 'mock', 'mock_price_team_usd_onboarding', 'USD', 9900, 'one_time', 1, 'one_time', 'per_unit', 'exclusive', true, 60, '{}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO billing_usage_meters (
  id,
  key,
  name,
  aggregation,
  unit,
  reset_interval,
  active,
  metadata,
  created_at,
  updated_at
)
VALUES
  ('meter_ai_tokens', 'ai_tokens', 'AI tokens', 'sum', 'token', 'month', true, '{}'::jsonb, now(), now()),
  ('meter_api_requests', 'api_requests', 'API requests', 'sum', 'request', 'month', true, '{}'::jsonb, now(), now())
ON CONFLICT (key) DO NOTHING;
