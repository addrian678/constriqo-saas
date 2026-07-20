CREATE TABLE IF NOT EXISTS worker_profiles (
  worker_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  worker_id uuid NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
  emergency_contact_name text,
  emergency_contact_phone text,
  preferred_language text NOT NULL DEFAULT 'es-US',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, worker_id)
);

CREATE TABLE IF NOT EXISTS worker_availability (
  availability_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  worker_id uuid NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
  availability_date date NOT NULL,
  status text NOT NULL DEFAULT 'available',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, worker_id, availability_date)
);

CREATE TABLE IF NOT EXISTS worker_certifications (
  certification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  worker_id uuid NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending_review',
  document_id uuid REFERENCES documents(document_id),
  expires_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_availability_worker_date ON worker_availability(tenant_id, worker_id, availability_date);
CREATE INDEX IF NOT EXISTS idx_worker_certifications_worker_status ON worker_certifications(tenant_id, worker_id, status);
