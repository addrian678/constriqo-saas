CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry_profile text NOT NULL DEFAULT 'construction',
  locale text NOT NULL DEFAULT 'es-US',
  currency text NOT NULL DEFAULT 'USD',
  timezone text NOT NULL DEFAULT 'America/Denver',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  code text NOT NULL,
  label text NOT NULL,
  scope text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS capabilities (
  capability_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  module_id text NOT NULL,
  description text NOT NULL
);

CREATE TABLE IF NOT EXISTS role_capabilities (
  role_id uuid NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  capability_id uuid NOT NULL REFERENCES capabilities(capability_id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, capability_id)
);

CREATE TABLE IF NOT EXISTS users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  email text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'invited',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS clients (
  client_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  name text NOT NULL,
  status text NOT NULL,
  primary_contact text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS estimates (
  estimate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  estimate_number text NOT NULL,
  status text NOT NULL,
  total_amount numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, estimate_number)
);

CREATE TABLE IF NOT EXISTS jobs (
  job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  estimate_id uuid REFERENCES estimates(estimate_id),
  job_number text NOT NULL,
  title text NOT NULL,
  status text NOT NULL,
  scheduled_start date,
  scheduled_end date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, job_number)
);

CREATE TABLE IF NOT EXISTS workers (
  worker_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  user_id uuid REFERENCES users(user_id),
  name text NOT NULL,
  status text NOT NULL,
  trade text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assignments (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  job_id uuid NOT NULL REFERENCES jobs(job_id),
  worker_id uuid NOT NULL REFERENCES workers(worker_id),
  starts_at timestamptz,
  ends_at timestamptz,
  status text NOT NULL
);

CREATE TABLE IF NOT EXISTS time_entries (
  time_entry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  worker_id uuid NOT NULL REFERENCES workers(worker_id),
  job_id uuid REFERENCES jobs(job_id),
  clock_in timestamptz NOT NULL,
  clock_out timestamptz,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS field_reports (
  field_report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  job_id uuid NOT NULL REFERENCES jobs(job_id),
  created_by uuid REFERENCES users(user_id),
  report_date date NOT NULL,
  status text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  title text NOT NULL,
  document_type text NOT NULL,
  status text NOT NULL,
  storage_key text,
  related_entity_type text,
  related_entity_id uuid,
  expires_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  invoice_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  client_id uuid NOT NULL REFERENCES clients(client_id),
  job_id uuid REFERENCES jobs(job_id),
  invoice_number text NOT NULL,
  status text NOT NULL,
  total_amount numeric(12, 2) NOT NULL DEFAULT 0,
  balance_amount numeric(12, 2) NOT NULL DEFAULT 0,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS expenses (
  expense_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  job_id uuid REFERENCES jobs(job_id),
  vendor_name text NOT NULL,
  status text NOT NULL,
  total_amount numeric(12, 2) NOT NULL DEFAULT 0,
  balance_amount numeric(12, 2) NOT NULL DEFAULT 0,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
  asset_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  status text NOT NULL,
  book_value numeric(12, 2) NOT NULL DEFAULT 0,
  warranty_expires_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS liabilities (
  liability_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  reference text NOT NULL,
  lender text NOT NULL,
  status text NOT NULL,
  principal_amount numeric(12, 2) NOT NULL DEFAULT 0,
  balance_amount numeric(12, 2) NOT NULL DEFAULT 0,
  next_due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, reference)
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  audience_role text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  audit_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  actor_user_id uuid REFERENCES users(user_id),
  action text NOT NULL,
  module_id text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_tenant_status ON clients(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_status ON jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_time_entries_worker ON time_entries(tenant_id, worker_id, clock_in);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_status ON documents(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_created ON audit_events(tenant_id, created_at DESC);
