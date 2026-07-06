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
] as const;
