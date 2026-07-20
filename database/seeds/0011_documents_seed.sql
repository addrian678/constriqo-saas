INSERT INTO audit_events (tenant_id, action, module_id, entity_type, severity, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'documents.seed.prepared',
  'documents',
  'document',
  'info',
  '{"seed":"0011_documents_seed","versions":true,"permissions":true,"expirations":true}'::jsonb
);
