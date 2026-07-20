INSERT INTO audit_events (tenant_id, action, module_id, entity_type, severity, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'invoicing.seed.prepared',
  'invoicing',
  'invoice',
  'info',
  '{"seed":"0012_invoicing_seed","externalPayments":false}'::jsonb
);
