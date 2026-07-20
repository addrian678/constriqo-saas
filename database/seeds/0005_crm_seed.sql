INSERT INTO clients (tenant_id, name, status, primary_contact, phone, email)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Canyon Home Group', 'active', 'Avery Stone', '(801) 555-0101', 'avery@example.test'),
  ('00000000-0000-0000-0000-000000000001', 'Wasatch Property Partners', 'lead', 'Noah Miller', '(801) 555-0102', 'noah@example.test')
ON CONFLICT DO NOTHING;

INSERT INTO audit_events (tenant_id, action, module_id, entity_type, severity, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'crm.seed.prepared',
  'crm',
  'client',
  'info',
  '{"seed":"0005_crm_seed"}'::jsonb
);
