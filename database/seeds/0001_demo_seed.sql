INSERT INTO tenants (tenant_id, name, industry_profile, locale, currency, timezone)
VALUES ('00000000-0000-0000-0000-000000000001', 'Canyon Build Services LLC', 'construction', 'es-US', 'USD', 'America/Denver')
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO roles (tenant_id, code, label, scope)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin', 'Administrador', 'global'),
  ('00000000-0000-0000-0000-000000000001', 'manager', 'Gestor de empresa', 'operational'),
  ('00000000-0000-0000-0000-000000000001', 'worker', 'Trabajador', 'field')
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO capabilities (code, module_id, description)
VALUES
  ('dashboard.read.visual', 'dashboard', 'Read visual dashboards'),
  ('crm.read', 'crm', 'Read CRM entities'),
  ('jobs.read', 'jobs', 'Read jobs'),
  ('finance.read', 'finance', 'Read finance visual data'),
  ('organization.read', 'organization', 'Read organization settings')
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (tenant_id, email, display_name, status)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'maria.torres@example.test', 'Maria Torres', 'active'),
  ('00000000-0000-0000-0000-000000000001', 'david.herrera@example.test', 'David Herrera', 'active'),
  ('00000000-0000-0000-0000-000000000001', 'carlos.mendoza@example.test', 'Carlos Mendoza', 'active')
ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO audit_events (tenant_id, action, module_id, entity_type, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'database.seeded',
  'system',
  'tenant',
  '{"seed":"0001_demo_seed"}'::jsonb
);
