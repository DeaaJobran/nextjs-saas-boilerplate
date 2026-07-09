export const migrationManifest = [
  {
    id: "0001_content_foundation.sql",
    sql: String.raw`CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS managed_pages (
  id text PRIMARY KEY,
  kind text NOT NULL,
  slug text NOT NULL,
  locale text NOT NULL,
  version text,
  title text NOT NULL,
  description text NOT NULL,
  seo_title text NOT NULL,
  seo_description text NOT NULL,
  og_image text,
  publish_state text NOT NULL,
  published_at timestamptz,
  updated_at timestamptz NOT NULL,
  CONSTRAINT managed_pages_locale_kind_slug_unique UNIQUE (locale, kind, slug)
);

CREATE TABLE IF NOT EXISTS page_sections (
  page_id text NOT NULL REFERENCES managed_pages(id) ON DELETE CASCADE,
  id text NOT NULL,
  sort_order integer NOT NULL,
  eyebrow text,
  title text NOT NULL,
  body text NOT NULL,
  items jsonb,
  cta_label text,
  cta_href text,
  PRIMARY KEY (page_id, id)
);

CREATE TABLE IF NOT EXISTS managed_page_versions (
  id text PRIMARY KEY,
  page_id text NOT NULL REFERENCES managed_pages(id) ON DELETE CASCADE,
  version text,
  page_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS content_audit_events (
  id text PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  actor_id text,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS pricing_plans (
  locale text NOT NULL,
  id text NOT NULL,
  sort_order integer NOT NULL,
  name text NOT NULL,
  price_label text NOT NULL,
  description text NOT NULL,
  features jsonb NOT NULL,
  cta_label text NOT NULL,
  highlighted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (locale, id)
);

CREATE TABLE IF NOT EXISTS contact_fields (
  locale text NOT NULL,
  id text NOT NULL,
  sort_order integer NOT NULL,
  label text NOT NULL,
  type text NOT NULL,
  required boolean NOT NULL,
  min_length integer,
  max_length integer,
  PRIMARY KEY (locale, id)
);

CREATE TABLE IF NOT EXISTS contact_routing (
  locale text PRIMARY KEY,
  recipient_email text NOT NULL,
  subject_prefix text NOT NULL,
  spam_protection_enabled boolean NOT NULL,
  success_message text NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_submissions (
  id text PRIMARY KEY,
  locale text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  submitted_at timestamptz NOT NULL,
  status text NOT NULL,
  values jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS managed_pages_locale_kind_idx
  ON managed_pages (locale, kind);

CREATE INDEX IF NOT EXISTS page_sections_page_sort_idx
  ON page_sections (page_id, sort_order);

CREATE INDEX IF NOT EXISTS managed_page_versions_page_created_idx
  ON managed_page_versions (page_id, created_at DESC);

CREATE INDEX IF NOT EXISTS content_audit_events_entity_created_idx
  ON content_audit_events (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS contact_submissions_locale_submitted_idx
  ON contact_submissions (locale, submitted_at DESC);
`,
  },
  {
    id: "0002_service_foundation.sql",
    sql: String.raw`CREATE TABLE IF NOT EXISTS event_log (
  id text PRIMARY KEY,
  tenant_id text,
  event_type text NOT NULL,
  source text NOT NULL,
  subject_type text,
  subject_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id text PRIMARY KEY,
  tenant_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  idempotency_key text,
  dispatched_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key text PRIMARY KEY,
  tenant_id text,
  scope text NOT NULL,
  request_hash text NOT NULL,
  response_status integer,
  response_body jsonb,
  locked_until timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id text PRIMARY KEY,
  tenant_id text,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL,
  created_by text,
  updated_at timestamptz NOT NULL,
  updated_by text,
  deleted_at timestamptz,
  deleted_by text
);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  id text PRIMARY KEY,
  tenant_id text,
  identifier text NOT NULL,
  scope text NOT NULL,
  window_start timestamptz NOT NULL,
  window_seconds integer NOT NULL,
  count integer NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS background_jobs (
  id text PRIMARY KEY,
  tenant_id text,
  queue text NOT NULL DEFAULT 'default',
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  available_at timestamptz NOT NULL,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS cron_schedules (
  id text PRIMARY KEY,
  tenant_id text,
  name text NOT NULL,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  interval_seconds integer NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz NOT NULL,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS event_log_tenant_occurred_idx
  ON event_log (tenant_id, occurred_at);

CREATE INDEX IF NOT EXISTS event_log_type_occurred_idx
  ON event_log (event_type, occurred_at);

CREATE UNIQUE INDEX IF NOT EXISTS outbox_events_idempotency_unique
  ON outbox_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS outbox_events_status_available_idx
  ON outbox_events (status, available_at);

CREATE INDEX IF NOT EXISTS idempotency_keys_tenant_scope_idx
  ON idempotency_keys (tenant_id, scope);

CREATE INDEX IF NOT EXISTS idempotency_keys_expires_idx
  ON idempotency_keys (expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS api_keys_hash_unique
  ON api_keys (key_hash);

CREATE INDEX IF NOT EXISTS api_keys_tenant_active_idx
  ON api_keys (tenant_id, deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS rate_limit_buckets_window_unique
  ON rate_limit_buckets (tenant_id, identifier, scope, window_start);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_expires_idx
  ON rate_limit_buckets (expires_at);

CREATE INDEX IF NOT EXISTS background_jobs_claim_idx
  ON background_jobs (queue, status, available_at, priority);

CREATE INDEX IF NOT EXISTS background_jobs_tenant_status_idx
  ON background_jobs (tenant_id, status);

CREATE INDEX IF NOT EXISTS cron_schedules_due_idx
  ON cron_schedules (enabled, next_run_at, deleted_at);
`,
  },
  {
    id: "0003_auth_identity_foundation.sql",
    sql: String.raw`CREATE TABLE IF NOT EXISTS auth_users (
  id text PRIMARY KEY,
  email text NOT NULL,
  normalized_email text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  locale text,
  role text NOT NULL DEFAULT 'user',
  email_verified_at timestamptz,
  password_hash text,
  password_updated_at timestamptz,
  mfa_required boolean NOT NULL DEFAULT false,
  disabled_at timestamptz,
  deletion_requested_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_accounts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  provider_email text,
  access_token_hash text,
  refresh_token_hash text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  refresh_token_hash text NOT NULL,
  device_name text NOT NULL,
  ip_address text,
  user_agent text,
  expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id text PRIMARY KEY,
  user_id text REFERENCES auth_users(id) ON DELETE CASCADE,
  email text,
  kind text NOT NULL,
  token_hash text NOT NULL,
  target text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id text PRIMARY KEY,
  user_id text REFERENCES auth_users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  challenge text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_passkeys (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  credential_id text NOT NULL,
  public_key text NOT NULL,
  counter integer NOT NULL DEFAULT 0,
  transports jsonb NOT NULL DEFAULT '[]'::jsonb,
  label text NOT NULL,
  device_type text NOT NULL,
  backed_up boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL,
  last_used_at timestamptz
);

CREATE TABLE IF NOT EXISTS auth_mfa_factors (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  type text NOT NULL,
  label text NOT NULL,
  secret_ciphertext text NOT NULL,
  enabled_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_recovery_codes (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_invitations (
  id text PRIMARY KEY,
  email text NOT NULL,
  normalized_email text NOT NULL,
  role text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_by text REFERENCES auth_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_login_attempts (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  ip_address text,
  success boolean NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_oauth_states (
  id text PRIMARY KEY,
  provider text NOT NULL,
  state_hash text NOT NULL,
  code_verifier text NOT NULL,
  redirect_uri text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_audit_events (
  id text PRIMARY KEY,
  user_id text REFERENCES auth_users(id) ON DELETE SET NULL,
  actor_id text REFERENCES auth_users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  ip_address text,
  user_agent text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_users_normalized_email_active_unique
  ON auth_users (normalized_email)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS auth_accounts_provider_account_unique
  ON auth_accounts (provider, provider_account_id);

CREATE INDEX IF NOT EXISTS auth_accounts_user_provider_idx
  ON auth_accounts (user_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_token_hash_unique
  ON auth_sessions (token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_refresh_token_hash_unique
  ON auth_sessions (refresh_token_hash);

CREATE INDEX IF NOT EXISTS auth_sessions_user_active_idx
  ON auth_sessions (user_id, revoked_at, expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS auth_tokens_token_hash_unique
  ON auth_tokens (token_hash);

CREATE INDEX IF NOT EXISTS auth_tokens_user_kind_idx
  ON auth_tokens (user_id, kind, consumed_at);

CREATE INDEX IF NOT EXISTS auth_tokens_email_kind_idx
  ON auth_tokens (email, kind, consumed_at);

CREATE INDEX IF NOT EXISTS auth_challenges_user_kind_idx
  ON auth_challenges (user_id, kind, consumed_at);

CREATE UNIQUE INDEX IF NOT EXISTS auth_passkeys_credential_id_unique
  ON auth_passkeys (credential_id);

CREATE INDEX IF NOT EXISTS auth_passkeys_user_idx
  ON auth_passkeys (user_id);

CREATE INDEX IF NOT EXISTS auth_mfa_factors_user_type_idx
  ON auth_mfa_factors (user_id, type, enabled_at);

CREATE UNIQUE INDEX IF NOT EXISTS auth_recovery_codes_code_hash_unique
  ON auth_recovery_codes (code_hash);

CREATE INDEX IF NOT EXISTS auth_recovery_codes_user_idx
  ON auth_recovery_codes (user_id, used_at);

CREATE UNIQUE INDEX IF NOT EXISTS auth_invitations_token_hash_unique
  ON auth_invitations (token_hash);

CREATE INDEX IF NOT EXISTS auth_invitations_email_active_idx
  ON auth_invitations (normalized_email, accepted_at, expires_at);

CREATE INDEX IF NOT EXISTS auth_login_attempts_identifier_created_idx
  ON auth_login_attempts (identifier, created_at);

CREATE INDEX IF NOT EXISTS auth_login_attempts_ip_created_idx
  ON auth_login_attempts (ip_address, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS auth_oauth_states_state_hash_unique
  ON auth_oauth_states (state_hash);

CREATE INDEX IF NOT EXISTS auth_audit_events_user_created_idx
  ON auth_audit_events (user_id, created_at);

CREATE INDEX IF NOT EXISTS auth_audit_events_type_created_idx
  ON auth_audit_events (event_type, created_at);
`,
  },
  {
    id: "0004_tenant_admin_foundation.sql",
    sql: String.raw`CREATE TABLE IF NOT EXISTS organizations (
  id text PRIMARY KEY,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  website_url text,
  logo_url text,
  default_locale text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'active',
  created_by text REFERENCES auth_users(id) ON DELETE SET NULL,
  updated_by text REFERENCES auth_users(id) ON DELETE SET NULL,
  deleted_by text REFERENCES auth_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  role text NOT NULL,
  custom_permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  invited_by text REFERENCES auth_users(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text REFERENCES auth_users(id) ON DELETE SET NULL,
  removed_at timestamptz,
  removed_by text REFERENCES auth_users(id) ON DELETE SET NULL,
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS organization_invitations (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  normalized_email text NOT NULL,
  role text NOT NULL,
  custom_permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by text REFERENCES auth_users(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  rejected_by text REFERENCES auth_users(id) ON DELETE SET NULL,
  created_by text REFERENCES auth_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_feature_flags (
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flag_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL,
  updated_by text REFERENCES auth_users(id) ON DELETE SET NULL,
  PRIMARY KEY (organization_id, flag_key)
);

CREATE TABLE IF NOT EXISTS organization_usage_limits (
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  limit_key text NOT NULL,
  limit_value bigint NOT NULL,
  used_value bigint NOT NULL DEFAULT 0,
  window_seconds integer,
  reset_at timestamptz,
  updated_at timestamptz NOT NULL,
  updated_by text REFERENCES auth_users(id) ON DELETE SET NULL,
  PRIMARY KEY (organization_id, limit_key)
);

CREATE TABLE IF NOT EXISTS organization_quotas (
  organization_id text PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  storage_bytes_limit bigint NOT NULL,
  storage_bytes_used bigint NOT NULL DEFAULT 0,
  ai_token_limit bigint NOT NULL,
  ai_token_used bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL,
  updated_by text REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  subject_user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  ended_at timestamptz,
  ended_by text REFERENCES auth_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_audit_events (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id text REFERENCES auth_users(id) ON DELETE SET NULL,
  subject_type text NOT NULL,
  subject_id text,
  event_type text NOT NULL,
  impersonation_session_id text REFERENCES impersonation_sessions(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_active_unique
  ON organizations (slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS organization_memberships_user_active_idx
  ON organization_memberships (user_id, status, removed_at);

CREATE INDEX IF NOT EXISTS organization_memberships_org_role_idx
  ON organization_memberships (organization_id, role, status);

CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_token_hash_unique
  ON organization_invitations (token_hash);

CREATE INDEX IF NOT EXISTS organization_invitations_email_active_idx
  ON organization_invitations (normalized_email, accepted_at, rejected_at, expires_at);

CREATE INDEX IF NOT EXISTS organization_invitations_org_active_idx
  ON organization_invitations (organization_id, accepted_at, rejected_at, expires_at);

CREATE INDEX IF NOT EXISTS impersonation_sessions_actor_active_idx
  ON impersonation_sessions (actor_id, ended_at, expires_at);

CREATE INDEX IF NOT EXISTS impersonation_sessions_subject_active_idx
  ON impersonation_sessions (subject_user_id, ended_at, expires_at);

CREATE INDEX IF NOT EXISTS tenant_audit_events_org_created_idx
  ON tenant_audit_events (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tenant_audit_events_actor_created_idx
  ON tenant_audit_events (actor_id, created_at DESC);
`,
  },
  {
    id: "0005_localization_settings.sql",
    sql: String.raw`CREATE TABLE IF NOT EXISTS localization_settings (
  id text PRIMARY KEY,
  default_locale text NOT NULL,
  enabled_locales jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

INSERT INTO localization_settings (
  id,
  default_locale,
  enabled_locales,
  updated_at
)
VALUES (
  'default',
  'en',
  '["en", "ar"]'::jsonb,
  now()
)
ON CONFLICT (id) DO NOTHING;
`,
  },
  {
    id: "0006_billing_payments_currency_tax.sql",
    sql: String.raw`CREATE TABLE IF NOT EXISTS billing_payment_providers (
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
`,
  },
  {
    id: "0007_public_api_mobile_realtime.sql",
    sql: String.raw`CREATE TABLE IF NOT EXISTS api_audit_events (
  id text PRIMARY KEY,
  tenant_id text REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id text REFERENCES auth_users(id) ON DELETE SET NULL,
  api_key_id text REFERENCES api_keys(id) ON DELETE SET NULL,
  request_id text NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  status_code integer NOT NULL,
  error_code text,
  ip_address text,
  user_agent text,
  idempotency_key text,
  duration_ms integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS api_audit_events_tenant_created_idx
  ON api_audit_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS api_audit_events_request_idx
  ON api_audit_events (request_id);

CREATE TABLE IF NOT EXISTS api_usage_records (
  id text PRIMARY KEY,
  tenant_id text REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id text REFERENCES auth_users(id) ON DELETE SET NULL,
  api_key_id text REFERENCES api_keys(id) ON DELETE SET NULL,
  route_id text NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  status_code integer NOT NULL,
  request_units integer NOT NULL DEFAULT 1,
  occurred_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS api_usage_records_tenant_occurred_idx
  ON api_usage_records (tenant_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS api_webhook_endpoints (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  description text,
  event_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  signing_secret_hash text NOT NULL,
  secret_prefix text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  created_by text REFERENCES auth_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL,
  updated_by text REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS api_webhook_endpoints_tenant_active_idx
  ON api_webhook_endpoints (tenant_id, active);

CREATE TABLE IF NOT EXISTS api_webhook_deliveries (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  endpoint_id text NOT NULL REFERENCES api_webhook_endpoints(id) ON DELETE CASCADE,
  event_id text,
  event_type text NOT NULL,
  status text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  last_status_code integer,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS api_webhook_deliveries_endpoint_status_idx
  ON api_webhook_deliveries (endpoint_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS mobile_devices (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  device_name text NOT NULL,
  device_fingerprint_hash text,
  app_version text,
  push_token_hash text,
  last_seen_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS mobile_devices_user_seen_idx
  ON mobile_devices (user_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS mobile_sessions (
  id text PRIMARY KEY,
  device_id text NOT NULL REFERENCES mobile_devices(id) ON DELETE CASCADE,
  auth_session_id text NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  refresh_token_family text NOT NULL,
  rotated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS mobile_sessions_auth_session_unique
  ON mobile_sessions (auth_session_id);

CREATE INDEX IF NOT EXISTS mobile_sessions_device_active_idx
  ON mobile_sessions (device_id, revoked_at);

CREATE TABLE IF NOT EXISTS mobile_push_subscriptions (
  id text PRIMARY KEY,
  device_id text NOT NULL REFERENCES mobile_devices(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  token_hash text NOT NULL,
  topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS mobile_push_subscriptions_token_unique
  ON mobile_push_subscriptions (provider, token_hash);

CREATE TABLE IF NOT EXISTS mobile_deep_links (
  id text PRIMARY KEY,
  tenant_id text REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text REFERENCES auth_users(id) ON DELETE SET NULL,
  route text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  url text NOT NULL,
  expires_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS mobile_deep_links_user_created_idx
  ON mobile_deep_links (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mobile_upload_intents (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  content_type text NOT NULL,
  byte_size bigint NOT NULL,
  checksum_sha256 text,
  status text NOT NULL,
  token_hash text NOT NULL,
  uploaded_at timestamptz,
  expires_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS mobile_upload_intents_token_unique
  ON mobile_upload_intents (token_hash);

CREATE INDEX IF NOT EXISTS mobile_upload_intents_tenant_status_idx
  ON mobile_upload_intents (tenant_id, status, created_at DESC);
`,
  },
  {
    id: "0008_storage_file_management.sql",
    sql: String.raw`CREATE TABLE IF NOT EXISTS storage_providers (
  id text PRIMARY KEY,
  provider text NOT NULL,
  display_name text NOT NULL,
  kind text NOT NULL,
  bucket text NOT NULL,
  region text,
  endpoint text,
  public_base_url text,
  force_path_style boolean NOT NULL DEFAULT false,
  access_key_ref text,
  secret_key_ref text,
  active boolean NOT NULL DEFAULT true,
  max_upload_bytes bigint NOT NULL,
  allowed_mime_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  allowed_extensions jsonb NOT NULL DEFAULT '[]'::jsonb,
  virus_scanning_enabled boolean NOT NULL DEFAULT false,
  malware_scanner_ref text,
  image_processing_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS storage_providers_provider_unique
  ON storage_providers (provider);

CREATE TABLE IF NOT EXISTS storage_files (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id text REFERENCES auth_users(id) ON DELETE SET NULL,
  provider_id text NOT NULL REFERENCES storage_providers(id) ON DELETE RESTRICT,
  bucket text NOT NULL,
  object_key text NOT NULL,
  visibility text NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL,
  byte_size bigint NOT NULL,
  checksum_sha256 text,
  status text NOT NULL,
  access_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_metadata jsonb,
  document_metadata jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  uploaded_at timestamptz,
  deleted_at timestamptz,
  expires_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS storage_files_provider_object_unique
  ON storage_files (provider_id, object_key);

CREATE INDEX IF NOT EXISTS storage_files_tenant_status_created_idx
  ON storage_files (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS storage_files_owner_status_idx
  ON storage_files (owner_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS storage_file_variants (
  id text PRIMARY KEY,
  file_id text NOT NULL REFERENCES storage_files(id) ON DELETE CASCADE,
  kind text NOT NULL,
  object_key text NOT NULL,
  content_type text NOT NULL,
  byte_size bigint NOT NULL,
  width integer,
  height integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  UNIQUE (file_id, kind)
);

CREATE INDEX IF NOT EXISTS storage_file_variants_file_idx
  ON storage_file_variants (file_id);

CREATE TABLE IF NOT EXISTS storage_upload_intents (
  id text PRIMARY KEY,
  file_id text NOT NULL REFERENCES storage_files(id) ON DELETE CASCADE,
  tenant_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id text REFERENCES auth_users(id) ON DELETE SET NULL,
  provider_id text NOT NULL REFERENCES storage_providers(id) ON DELETE RESTRICT,
  object_key text NOT NULL,
  token_hash text NOT NULL,
  status text NOT NULL,
  upload_url text NOT NULL,
  expires_at timestamptz NOT NULL,
  byte_size bigint NOT NULL,
  content_type text NOT NULL,
  checksum_sha256 text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS storage_upload_intents_token_unique
  ON storage_upload_intents (token_hash);

CREATE INDEX IF NOT EXISTS storage_upload_intents_file_status_idx
  ON storage_upload_intents (file_id, status);

CREATE INDEX IF NOT EXISTS storage_upload_intents_expiry_idx
  ON storage_upload_intents (status, expires_at);

CREATE TABLE IF NOT EXISTS storage_access_grants (
  id text PRIMARY KEY,
  file_id text NOT NULL REFERENCES storage_files(id) ON DELETE CASCADE,
  tenant_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  grantee_type text NOT NULL,
  grantee_id text NOT NULL,
  permission text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL,
  created_by text REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS storage_access_grants_file_idx
  ON storage_access_grants (file_id, permission, expires_at);

CREATE INDEX IF NOT EXISTS storage_access_grants_grantee_idx
  ON storage_access_grants (tenant_id, grantee_type, grantee_id, permission);

CREATE TABLE IF NOT EXISTS storage_usage_records (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  file_id text REFERENCES storage_files(id) ON DELETE SET NULL,
  byte_delta bigint NOT NULL,
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS storage_usage_records_tenant_created_idx
  ON storage_usage_records (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS storage_audit_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  file_id text REFERENCES storage_files(id) ON DELETE SET NULL,
  actor_id text REFERENCES auth_users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS storage_audit_events_tenant_created_idx
  ON storage_audit_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS storage_audit_events_file_created_idx
  ON storage_audit_events (file_id, created_at DESC);
`,
  },
];
