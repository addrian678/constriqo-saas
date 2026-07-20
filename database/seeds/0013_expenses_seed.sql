INSERT INTO audit_events (tenant_id, action, module_id, entity_type, severity, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'expenses.seed.prepared',
  'expenses',
  'expense',
  'info',
  '{"seed":"0013_expenses_seed","externalPayments":false,"approvals":true}'::jsonb
);
