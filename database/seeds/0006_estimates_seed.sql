INSERT INTO audit_events (tenant_id, action, module_id, entity_type, severity, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'estimates.seed.prepared',
  'estimates',
  'estimate',
  'info',
  '{"seed":"0006_estimates_seed","versions":true,"approvals":true}'::jsonb
);
