CREATE TABLE IF NOT EXISTS localization_settings (
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
