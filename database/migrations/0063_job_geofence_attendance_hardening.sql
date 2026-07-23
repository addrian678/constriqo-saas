ALTER TABLE attendance_exceptions
  ADD COLUMN IF NOT EXISTS job_id uuid,
  ADD COLUMN IF NOT EXISTS attempted_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS attempted_lat numeric(10, 7),
  ADD COLUMN IF NOT EXISTS attempted_lng numeric(10, 7),
  ADD COLUMN IF NOT EXISTS attempted_accuracy_m numeric(10, 2),
  ADD COLUMN IF NOT EXISTS job_distance_meters integer,
  ADD COLUMN IF NOT EXISTS location_status text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_exceptions_tenant_job') THEN
    ALTER TABLE attendance_exceptions
      ADD CONSTRAINT fk_attendance_exceptions_tenant_job
      FOREIGN KEY (tenant_id, job_id) REFERENCES jobs(tenant_id, job_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_exceptions_tenant_worker') THEN
    ALTER TABLE attendance_exceptions
      ADD CONSTRAINT fk_attendance_exceptions_tenant_worker
      FOREIGN KEY (tenant_id, worker_id) REFERENCES workers(tenant_id, worker_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_attendance_exceptions_location_status') THEN
    ALTER TABLE attendance_exceptions
      ADD CONSTRAINT chk_attendance_exceptions_location_status
      CHECK (
        location_status IS NULL
        OR location_status IN ('outside_radius', 'missing_worker_location', 'job_without_location', 'not_assigned_to_job')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_tenant_job_status
  ON attendance_exceptions(tenant_id, job_id, status, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_tenant_attempted
  ON attendance_exceptions(tenant_id, attempted_at DESC);
