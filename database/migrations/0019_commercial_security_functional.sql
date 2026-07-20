CREATE TABLE IF NOT EXISTS installation_licenses (
  installation_license_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  license_subject text NOT NULL,
  license_fingerprint_hash text NOT NULL,
  status text NOT NULL DEFAULT 'prepared',
  allowed_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, license_fingerprint_hash)
);

CREATE TABLE IF NOT EXISTS secret_rotation_events (
  secret_rotation_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  secret_scope text NOT NULL,
  rotation_reason text NOT NULL,
  rotated_by_user_id uuid REFERENCES users(user_id),
  rotated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS deployment_access_events (
  deployment_access_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  actor_user_id uuid REFERENCES users(user_id),
  action text NOT NULL,
  source_ip inet,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installation_licenses_status ON installation_licenses(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_secret_rotation_events_scope ON secret_rotation_events(tenant_id, secret_scope, rotated_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_access_events_action ON deployment_access_events(tenant_id, action, created_at DESC);
