ALTER TABLE cron_schedules
  ADD COLUMN IF NOT EXISTS queue text NOT NULL DEFAULT 'default';
