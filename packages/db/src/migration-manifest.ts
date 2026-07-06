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
] as const;
