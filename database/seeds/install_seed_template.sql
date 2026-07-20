-- Constriqo install seed template.
-- Replace placeholders during a controlled installation. Do not commit real secrets.

INSERT INTO tenants (tenant_id, name, industry_profile, locale, currency, timezone)
VALUES (
  '{{TENANT_ID}}',
  '{{COMPANY_NAME}}',
  '{{INDUSTRY_PROFILE}}',
  '{{LOCALE}}',
  '{{CURRENCY}}',
  '{{TIMEZONE}}'
)
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO users (user_id, tenant_id, email, display_name, status)
VALUES (
  '{{ADMIN_USER_ID}}',
  '{{TENANT_ID}}',
  '{{ADMIN_EMAIL}}',
  '{{ADMIN_NAME}}',
  'invited'
)
ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
VALUES (
  '{{TENANT_ID}}',
  '{{ADMIN_USER_ID}}',
  'install.admin_invited',
  'organization',
  'user',
  '{{ADMIN_USER_ID}}',
  'info',
  '{"source":"install_seed_template","passwordSet":false}'::jsonb
);
