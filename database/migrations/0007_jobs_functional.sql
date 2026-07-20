CREATE TABLE IF NOT EXISTS job_phases (
  job_phase_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  job_id uuid NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sort_order integer NOT NULL DEFAULT 0,
  starts_on date,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_tasks (
  job_task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  job_id uuid NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  job_phase_id uuid REFERENCES job_phases(job_phase_id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  assigned_to_worker_id uuid REFERENCES workers(worker_id),
  due_at timestamptz,
  created_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_change_requests (
  change_request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  job_id uuid NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  amount_delta numeric(12, 2) NOT NULL DEFAULT 0,
  requested_by_user_id uuid REFERENCES users(user_id),
  approved_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_incidents (
  job_incident_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  job_id uuid NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  status text NOT NULL DEFAULT 'open',
  reported_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_job_phases_job ON job_phases(tenant_id, job_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_job_tasks_job_status ON job_tasks(tenant_id, job_id, status);
CREATE INDEX IF NOT EXISTS idx_job_change_requests_job ON job_change_requests(tenant_id, job_id, status);
CREATE INDEX IF NOT EXISTS idx_job_incidents_job ON job_incidents(tenant_id, job_id, status);
