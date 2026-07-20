INSERT INTO capabilities (code, module_id, description)
VALUES
  ('worker.tasks.read', 'worker-self', 'Worker can read only assigned job tasks.'),
  ('worker.tasks.update', 'worker-self', 'Worker can update only assigned job task checklist status.')
ON CONFLICT (code) DO UPDATE
SET module_id = EXCLUDED.module_id,
    description = EXCLUDED.description;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON c.code IN ('worker.tasks.read', 'worker.tasks.update')
WHERE r.code IN ('admin', 'manager', 'worker')
ON CONFLICT (role_id, capability_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_job_tasks_worker_status
  ON job_tasks(tenant_id, assigned_to_worker_id, status, due_at);

CREATE INDEX IF NOT EXISTS idx_workers_tenant_user
  ON workers(tenant_id, user_id)
  WHERE user_id IS NOT NULL;
