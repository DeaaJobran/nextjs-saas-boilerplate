CREATE TABLE IF NOT EXISTS event_log (
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
