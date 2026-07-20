INSERT INTO audit_events (tenant_id, action, module_id, entity_type, severity, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'workforce.seed.prepared',
  'workforce',
  'worker',
  'info',
  '{"seed":"0008_workforce_seed","availability":true,"certifications":true}'::jsonb
);
