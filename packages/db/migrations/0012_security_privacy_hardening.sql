CREATE TABLE IF NOT EXISTS legal_acceptances (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  tenant_id text REFERENCES organizations(id) ON DELETE SET NULL,
  document_id text REFERENCES managed_pages(id) ON DELETE SET NULL,
  document_slug text NOT NULL,
  locale text NOT NULL,
  version text NOT NULL,
  content_hash text NOT NULL,
  ip_address_hash text,
  user_agent_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS legal_acceptances_document_version_unique
  ON legal_acceptances (user_id, document_slug, locale, version);

CREATE INDEX IF NOT EXISTS legal_acceptances_user_accepted_idx
  ON legal_acceptances (user_id, accepted_at DESC);

CREATE TABLE IF NOT EXISTS privacy_requests (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  tenant_id text REFERENCES organizations(id) ON DELETE SET NULL,
  request_type text NOT NULL,
  status text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS privacy_requests_user_created_idx
  ON privacy_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS privacy_requests_status_created_idx
  ON privacy_requests (status, created_at);

CREATE TABLE IF NOT EXISTS security_audit_events (
  id text PRIMARY KEY,
  tenant_id text REFERENCES organizations(id) ON DELETE SET NULL,
  user_id text REFERENCES auth_users(id) ON DELETE SET NULL,
  actor_id text REFERENCES auth_users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL,
  request_id text,
  ip_address_hash text,
  user_agent_hash text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS security_audit_events_created_idx
  ON security_audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS security_audit_events_tenant_created_idx
  ON security_audit_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS security_audit_events_user_created_idx
  ON security_audit_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS security_audit_events_type_created_idx
  ON security_audit_events (event_type, created_at DESC);

ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS mfa_verified_at timestamptz;

ALTER TABLE auth_passkeys
  ADD COLUMN IF NOT EXISTS user_verified boolean NOT NULL DEFAULT false;

WITH ranked_buckets AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(tenant_id, ''), identifier, scope, window_start
      ORDER BY id
    ) AS position,
    LEAST(
      SUM(count) OVER (
        PARTITION BY COALESCE(tenant_id, ''), identifier, scope, window_start
      ),
      2147483647
    )::integer AS merged_count,
    MAX(window_seconds) OVER (
      PARTITION BY COALESCE(tenant_id, ''), identifier, scope, window_start
    ) AS merged_window_seconds,
    MAX(expires_at) OVER (
      PARTITION BY COALESCE(tenant_id, ''), identifier, scope, window_start
    ) AS merged_expires_at
  FROM rate_limit_buckets
), merged_buckets AS (
  UPDATE rate_limit_buckets AS bucket
  SET count = ranked.merged_count,
      window_seconds = ranked.merged_window_seconds,
      expires_at = ranked.merged_expires_at
  FROM ranked_buckets AS ranked
  WHERE bucket.id = ranked.id
    AND ranked.position = 1
  RETURNING bucket.id
)
DELETE FROM rate_limit_buckets AS bucket
USING ranked_buckets AS ranked
WHERE bucket.id = ranked.id
  AND ranked.position > 1;

DROP INDEX IF EXISTS rate_limit_buckets_window_unique;

CREATE UNIQUE INDEX IF NOT EXISTS rate_limit_buckets_window_unique
  ON rate_limit_buckets (
    COALESCE(tenant_id, ''), identifier, scope, window_start
  );

INSERT INTO managed_pages (
  id, kind, slug, locale, version, title, description,
  seo_title, seo_description, publish_state, published_at, updated_at
)
SELECT *
FROM (VALUES
  (
    'legal-terms-en', 'legal', 'terms', 'en', '2026.08',
    'Terms of Service',
    'Versioned terms content placeholder for the boilerplate.',
    'Terms of Service | Next.js SaaS Boilerplate',
    'Versioned terms rendered through the managed page system.',
    'published', '2026-07-06T00:00:00.000Z'::timestamptz, '2026-07-06T00:00:00.000Z'::timestamptz
  ),
  (
    'legal-terms-ar', 'legal', 'terms', 'ar', '2026.08',
    'شروط الخدمة',
    'محتوى شروط قابل للإصدار داخل القالب.',
    'شروط الخدمة | Next.js SaaS Boilerplate',
    'شروط بإصدارات تعرض عبر نظام الصفحات المدار.',
    'published', '2026-07-06T00:00:00.000Z'::timestamptz, '2026-07-06T00:00:00.000Z'::timestamptz
  ),
  (
    'legal-privacy-en', 'legal', 'privacy', 'en', '2026.07',
    'Privacy Policy',
    'Versioned legal content placeholder for the boilerplate.',
    'Privacy Policy | Next.js SaaS Boilerplate',
    'Versioned legal content rendered through the managed page system.',
    'published', '2026-07-06T00:00:00.000Z'::timestamptz, '2026-07-06T00:00:00.000Z'::timestamptz
  ),
  (
    'legal-privacy-ar', 'legal', 'privacy', 'ar', '2026.07',
    'سياسة الخصوصية',
    'محتوى قانوني قابل للإصدار داخل القالب.',
    'سياسة الخصوصية | Next.js SaaS Boilerplate',
    'محتوى قانوني بإصدارات يعرض عبر نظام الصفحات المدار.',
    'published', '2026-07-06T00:00:00.000Z'::timestamptz, '2026-07-06T00:00:00.000Z'::timestamptz
  )
) AS legal_pages (
  id, kind, slug, locale, version, title, description,
  seo_title, seo_description, publish_state, published_at, updated_at
)
WHERE EXISTS (SELECT 1 FROM managed_pages)
ON CONFLICT DO NOTHING;

INSERT INTO page_sections (page_id, id, sort_order, title, body)
SELECT
  'legal-terms-en',
  'terms',
  0,
  'Terms content source',
  'This starter ships configurable terms and acceptance tracking. Downstream products must replace this content with their own reviewed terms before launch.'
WHERE EXISTS (SELECT 1 FROM managed_pages WHERE id = 'legal-terms-en')
ON CONFLICT DO NOTHING;

INSERT INTO page_sections (page_id, id, sort_order, title, body)
SELECT
  'legal-terms-ar',
  'terms',
  0,
  'مصدر محتوى الشروط',
  'يوفر هذا القالب شروطاً قابلة للضبط وتتبعاً للموافقة. يجب على المنتجات المبنية عليه استبدال هذا النص بشروط مراجعة خاصة بها قبل الإطلاق.'
WHERE EXISTS (SELECT 1 FROM managed_pages WHERE id = 'legal-terms-ar')
ON CONFLICT DO NOTHING;

INSERT INTO page_sections (page_id, id, sort_order, title, body)
SELECT
  'legal-privacy-en',
  'privacy',
  0,
  'Privacy content source',
  'This starter ships a configurable legal page renderer. Downstream products must replace this content with their own reviewed policy before launch.'
WHERE EXISTS (SELECT 1 FROM managed_pages WHERE id = 'legal-privacy-en')
ON CONFLICT DO NOTHING;

INSERT INTO page_sections (page_id, id, sort_order, title, body)
SELECT
  'legal-privacy-ar',
  'privacy',
  0,
  'مصدر محتوى الخصوصية',
  'يوفر هذا القالب عارض صفحات قانونية قابل للضبط. يجب على المنتجات المبنية عليه استبدال هذا النص بسياسة مراجعة خاصة بها قبل الإطلاق.'
WHERE EXISTS (SELECT 1 FROM managed_pages WHERE id = 'legal-privacy-ar')
ON CONFLICT DO NOTHING;
