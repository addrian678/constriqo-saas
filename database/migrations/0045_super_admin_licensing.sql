-- Global provider console and tenant licensing.
-- This panel is not part of any client tenant workspace.

INSERT INTO capabilities (code, module_id, description)
VALUES
  ('superadmin.read', 'super-admin', 'Read provider-level tenant and license status.'),
  ('superadmin.manage', 'super-admin', 'Manage provider-level tenant licenses.')
ON CONFLICT (code) DO UPDATE
SET module_id = EXCLUDED.module_id,
    description = EXCLUDED.description;

INSERT INTO tenants (tenant_id, name, industry_profile, locale, currency, timezone)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Constriqo Provider',
  'provider',
  'es-ES',
  'EUR',
  'Europe/Madrid'
)
ON CONFLICT (tenant_id) DO UPDATE
SET name = EXCLUDED.name,
    industry_profile = EXCLUDED.industry_profile,
    locale = EXCLUDED.locale,
    currency = EXCLUDED.currency,
    timezone = EXCLUDED.timezone,
    updated_at = now();

INSERT INTO roles (tenant_id, code, label, scope)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'super_admin',
  'Super Admin proveedor',
  'global'
)
ON CONFLICT (tenant_id, code) DO UPDATE
SET label = EXCLUDED.label,
    scope = EXCLUDED.scope;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON c.code IN ('superadmin.read', 'superadmin.manage')
WHERE r.tenant_id = '00000000-0000-4000-8000-000000000001'
  AND r.code = 'super_admin'
ON CONFLICT (role_id, capability_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS tenant_licenses (
  license_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  license_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'trial',
  plan_code text NOT NULL DEFAULT 'starter',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  trial_ends_at timestamptz,
  duration_preset text NOT NULL DEFAULT 'manual',
  seats_limit integer NOT NULL DEFAULT 5,
  storage_quota_mb integer NOT NULL DEFAULT 500,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by_user_id uuid REFERENCES users(user_id),
  updated_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id),
  CHECK (status IN ('trial', 'active', 'past_due', 'suspended', 'expired', 'revoked')),
  CHECK (duration_preset IN ('trial_7d', 'trial_30d', 'one_year', 'two_years', 'manual')),
  CHECK (seats_limit > 0),
  CHECK (storage_quota_mb > 0)
);

CREATE INDEX IF NOT EXISTS idx_tenant_licenses_status_expires
  ON tenant_licenses(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_tenant_licenses_tenant
  ON tenant_licenses(tenant_id);

CREATE TABLE IF NOT EXISTS super_admin_audit_events (
  audit_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(user_id),
  actor_email text,
  action text NOT NULL,
  target_tenant_id uuid REFERENCES tenants(tenant_id),
  entity_type text NOT NULL,
  entity_id uuid,
  severity text NOT NULL DEFAULT 'info',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_super_admin_audit_target_created
  ON super_admin_audit_events(target_tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_admin_audit_actor_created
  ON super_admin_audit_events(actor_user_id, created_at DESC);

INSERT INTO tenant_licenses (
  tenant_id,
  license_code,
  status,
  plan_code,
  starts_at,
  expires_at,
  duration_preset,
  seats_limit,
  storage_quota_mb,
  features
)
SELECT
  t.tenant_id,
  'LIC-' || upper(substr(replace(t.tenant_id::text, '-', ''), 1, 12)),
  'active',
  'starter',
  now(),
  now() + interval '1 year',
  'one_year',
  5,
  500,
  jsonb_build_object('marketingAddon', false, 'photoEvidenceAddon', false)
FROM tenants t
WHERE t.industry_profile <> 'provider'
ON CONFLICT (tenant_id) DO NOTHING;
