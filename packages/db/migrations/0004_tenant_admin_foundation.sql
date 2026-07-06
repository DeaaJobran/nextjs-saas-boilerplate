CREATE TABLE IF NOT EXISTS organizations (
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
