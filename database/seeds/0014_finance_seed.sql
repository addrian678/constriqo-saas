INSERT INTO audit_events (tenant_id, action, module_id, entity_type, severity, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'finance.seed.prepared',
  'finance',
  'financial_account',
  'info',
  '{"seed":"0014_finance_seed","taxAccounting":false,"reconciliationPrepared":true}'::jsonb
);
