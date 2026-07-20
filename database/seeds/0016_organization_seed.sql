INSERT INTO audit_events (tenant_id, action, module_id, entity_type, severity, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'organization.seed.prepared',
  'organization',
  'settings',
  'info',
  '{"seed":"0016_organization_seed","featureFlags":true,"changeLog":true}'::jsonb
);
