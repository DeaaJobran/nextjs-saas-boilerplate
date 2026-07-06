CREATE TABLE IF NOT EXISTS api_audit_events (
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
