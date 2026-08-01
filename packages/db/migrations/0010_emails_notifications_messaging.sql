CREATE TABLE IF NOT EXISTS notification_preferences (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  tenant_id text REFERENCES organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  email_enabled boolean NOT NULL DEFAULT true,
  in_app_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT false,
  locale text,
  quiet_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_scope_unique
  ON notification_preferences (user_id, COALESCE(tenant_id, ''), event_type);

CREATE INDEX IF NOT EXISTS notification_preferences_tenant_user_idx
  ON notification_preferences (tenant_id, user_id);

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id text PRIMARY KEY,
  tenant_id text REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  action_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS in_app_notifications_user_unread_idx
  ON in_app_notifications (user_id, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS in_app_notifications_tenant_created_idx
  ON in_app_notifications (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_deliveries (
  id text PRIMARY KEY,
  tenant_id text REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text REFERENCES auth_users(id) ON DELETE SET NULL,
  channel text NOT NULL,
  event_type text NOT NULL,
  template_key text NOT NULL,
  locale text NOT NULL,
  recipient text NOT NULL,
  provider text NOT NULL,
  subject text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  brand jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  idempotency_key text,
  provider_message_id text,
  last_error text,
  queued_at timestamptz NOT NULL,
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS message_deliveries_idempotency_unique
  ON message_deliveries (COALESCE(tenant_id, ''), idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS message_deliveries_status_queued_idx
  ON message_deliveries (status, queued_at);

CREATE INDEX IF NOT EXISTS message_deliveries_tenant_created_idx
  ON message_deliveries (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS message_deliveries_user_created_idx
  ON message_deliveries (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS messaging_audit_events (
  id text PRIMARY KEY,
  tenant_id text REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text REFERENCES auth_users(id) ON DELETE SET NULL,
  delivery_id text REFERENCES message_deliveries(id) ON DELETE SET NULL,
  actor_id text REFERENCES auth_users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS messaging_audit_events_tenant_created_idx
  ON messaging_audit_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS messaging_audit_events_delivery_created_idx
  ON messaging_audit_events (delivery_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS messaging_audit_events_delivery_sent_unique
  ON messaging_audit_events (delivery_id, event_type)
  WHERE delivery_id IS NOT NULL
    AND event_type = 'messaging.delivery.sent';
