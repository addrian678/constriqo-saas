INSERT INTO audit_events (tenant_id, action, module_id, entity_type, severity, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'assets_liabilities.seed.prepared',
  'assets-liabilities',
  'asset',
  'info',
  '{"seed":"0015_assets_liabilities_seed","depreciation":"manual","payments":"scheduled"}'::jsonb
);
