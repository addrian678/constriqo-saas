ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS clock_in_lat numeric(10, 7),
  ADD COLUMN IF NOT EXISTS clock_in_lng numeric(10, 7),
  ADD COLUMN IF NOT EXISTS clock_in_accuracy_m numeric(10, 2),
  ADD COLUMN IF NOT EXISTS clock_out_lat numeric(10, 7),
  ADD COLUMN IF NOT EXISTS clock_out_lng numeric(10, 7),
  ADD COLUMN IF NOT EXISTS clock_out_accuracy_m numeric(10, 2),
  ADD COLUMN IF NOT EXISTS clock_in_note text,
  ADD COLUMN IF NOT EXISTS clock_out_note text;

INSERT INTO capabilities (code, module_id, description)
VALUES
  ('attendance.read', 'attendance', 'Read tenant attendance entries.'),
  ('attendance.self.visual', 'attendance', 'Worker can clock in and out for own attendance.'),
  ('attendance.review.visual', 'attendance', 'Admin or manager can review attendance entries.'),
  ('organization.users.manage', 'organization', 'Manage tenant users, roles and temporary passwords.')
ON CONFLICT (code) DO UPDATE
SET module_id = EXCLUDED.module_id,
    description = EXCLUDED.description;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON
  (r.code = 'admin')
  OR (
    r.code = 'manager'
    AND c.code IN (
      'clients.read', 'clients.create', 'clients.update',
      'estimates.read', 'estimates.create', 'estimates.update', 'estimates.approve',
      'jobs.read', 'jobs.create', 'jobs.update',
      'workforce.read', 'workforce.manage',
      'attendance.read', 'attendance.review.visual',
      'worker.tasks.read', 'worker.tasks.update'
    )
  )
  OR (r.code = 'worker' AND c.code IN ('worker.tasks.read', 'worker.tasks.update', 'attendance.self.visual'))
ON CONFLICT (role_id, capability_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_status
  ON time_entries(tenant_id, status, clock_in DESC);

CREATE INDEX IF NOT EXISTS idx_time_entries_worker_open
  ON time_entries(tenant_id, worker_id, status)
  WHERE clock_out IS NULL;

CREATE INDEX IF NOT EXISTS idx_break_entries_open
  ON break_entries(tenant_id, time_entry_id, status)
  WHERE ended_at IS NULL;
