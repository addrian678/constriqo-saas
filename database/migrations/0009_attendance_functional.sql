CREATE TABLE IF NOT EXISTS break_entries (
  break_entry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  time_entry_id uuid NOT NULL REFERENCES time_entries(time_entry_id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_approvals (
  attendance_approval_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  time_entry_id uuid NOT NULL REFERENCES time_entries(time_entry_id) ON DELETE CASCADE,
  status text NOT NULL,
  reviewed_by_user_id uuid NOT NULL REFERENCES users(user_id),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE TABLE IF NOT EXISTS attendance_exceptions (
  attendance_exception_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  time_entry_id uuid REFERENCES time_entries(time_entry_id) ON DELETE SET NULL,
  worker_id uuid NOT NULL REFERENCES workers(worker_id),
  exception_type text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  description text NOT NULL,
  reviewed_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS server_recorded boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_break_entries_time_entry ON break_entries(tenant_id, time_entry_id);
CREATE INDEX IF NOT EXISTS idx_attendance_approvals_time_entry ON attendance_approvals(tenant_id, time_entry_id);
CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_worker_status ON attendance_exceptions(tenant_id, worker_id, status);
