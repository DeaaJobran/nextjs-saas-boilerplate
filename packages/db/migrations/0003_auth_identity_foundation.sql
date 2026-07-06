CREATE TABLE IF NOT EXISTS auth_users (
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
