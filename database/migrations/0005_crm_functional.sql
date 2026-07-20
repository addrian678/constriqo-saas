CREATE TABLE IF NOT EXISTS client_contacts (
  contact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  client_id uuid NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  phone text,
  email text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_activities (
  activity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  client_id uuid NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  title text NOT NULL,
  due_at timestamptz,
  assigned_to_user_id uuid REFERENCES users(user_id),
  created_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_notes (
  note_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  client_id uuid NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON client_contacts(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_client_activities_client_status ON client_activities(tenant_id, client_id, status);
CREATE INDEX IF NOT EXISTS idx_client_notes_client_created ON client_notes(tenant_id, client_id, created_at DESC);
