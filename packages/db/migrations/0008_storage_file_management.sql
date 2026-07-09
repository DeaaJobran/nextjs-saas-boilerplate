CREATE TABLE IF NOT EXISTS storage_providers (
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
