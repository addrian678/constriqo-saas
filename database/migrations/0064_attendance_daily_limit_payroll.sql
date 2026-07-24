ALTER TABLE payroll_worker_settings
  ADD COLUMN IF NOT EXISTS max_daily_seconds integer NOT NULL DEFAULT 28800;

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS max_daily_seconds integer,
  ADD COLUMN IF NOT EXISTS payable_seconds_capped integer,
  ADD COLUMN IF NOT EXISTS exceeded_max_daily_at timestamptz,
  ADD COLUMN IF NOT EXISTS requires_admin_review boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_payroll_worker_settings_max_daily_seconds') THEN
    ALTER TABLE payroll_worker_settings
      ADD CONSTRAINT chk_payroll_worker_settings_max_daily_seconds
      CHECK (max_daily_seconds BETWEEN 3600 AND 86400);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_time_entries_max_daily_seconds') THEN
    ALTER TABLE time_entries
      ADD CONSTRAINT chk_time_entries_max_daily_seconds
      CHECK (max_daily_seconds IS NULL OR max_daily_seconds BETWEEN 3600 AND 86400);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_time_entries_payable_seconds_capped') THEN
    ALTER TABLE time_entries
      ADD CONSTRAINT chk_time_entries_payable_seconds_capped
      CHECK (payable_seconds_capped IS NULL OR payable_seconds_capped >= 0);
  END IF;
END $$;

UPDATE payroll_worker_settings
SET max_daily_seconds = 28800
WHERE max_daily_seconds IS NULL;

CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_worker_daily_review
  ON time_entries(tenant_id, worker_id, requires_admin_review, clock_in DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_exception_daily_limit_open
  ON attendance_exceptions(tenant_id, time_entry_id, exception_type)
  WHERE exception_type = 'daily_limit_exceeded' AND time_entry_id IS NOT NULL;
