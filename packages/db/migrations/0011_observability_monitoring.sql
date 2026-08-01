CREATE TABLE IF NOT EXISTS observability_logs (
  id text PRIMARY KEY,
  tenant_id text REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id text REFERENCES auth_users(id) ON DELETE SET NULL,
  timestamp timestamptz NOT NULL,
  level text NOT NULL,
  category text NOT NULL,
  service text NOT NULL,
  message text NOT NULL,
  request_id text,
  job_id text,
  trace_id text,
  span_id text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb
);

CREATE INDEX IF NOT EXISTS observability_logs_timestamp_idx
  ON observability_logs (timestamp DESC);

CREATE INDEX IF NOT EXISTS observability_logs_level_timestamp_idx
  ON observability_logs (level, timestamp DESC);

CREATE INDEX IF NOT EXISTS observability_logs_tenant_timestamp_idx
  ON observability_logs (tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS observability_logs_request_idx
  ON observability_logs (request_id);

CREATE INDEX IF NOT EXISTS observability_logs_trace_idx
  ON observability_logs (trace_id);

CREATE TABLE IF NOT EXISTS observability_metric_points (
  id text PRIMARY KEY,
  tenant_id text REFERENCES organizations(id) ON DELETE CASCADE,
  service text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL,
  value double precision NOT NULL,
  unit text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS observability_metric_points_name_recorded_idx
  ON observability_metric_points (name, recorded_at DESC);

CREATE INDEX IF NOT EXISTS observability_metric_points_tenant_recorded_idx
  ON observability_metric_points (tenant_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS observability_spans (
  id text PRIMARY KEY,
  tenant_id text REFERENCES organizations(id) ON DELETE CASCADE,
  service text NOT NULL,
  trace_id text NOT NULL,
  span_id text NOT NULL,
  parent_span_id text,
  name text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  duration_ms double precision NOT NULL,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS observability_spans_span_unique
  ON observability_spans (span_id);

CREATE INDEX IF NOT EXISTS observability_spans_trace_started_idx
  ON observability_spans (trace_id, started_at DESC);

CREATE INDEX IF NOT EXISTS observability_spans_tenant_started_idx
  ON observability_spans (tenant_id, started_at DESC);

CREATE TABLE IF NOT EXISTS uptime_monitors (
  id text PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  method text NOT NULL,
  expected_status integer NOT NULL,
  timeout_ms integer NOT NULL,
  interval_seconds integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  next_check_at timestamptz NOT NULL,
  last_checked_at timestamptz,
  last_status text,
  last_duration_ms double precision,
  last_error text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uptime_monitors_url_method_unique
  ON uptime_monitors (url, method);

CREATE INDEX IF NOT EXISTS uptime_monitors_due_idx
  ON uptime_monitors (active, next_check_at);

CREATE TABLE IF NOT EXISTS uptime_check_results (
  id text PRIMARY KEY,
  monitor_id text NOT NULL REFERENCES uptime_monitors(id) ON DELETE CASCADE,
  status text NOT NULL,
  status_code integer,
  duration_ms double precision NOT NULL,
  error text,
  checked_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS uptime_check_results_monitor_checked_idx
  ON uptime_check_results (monitor_id, checked_at DESC);
