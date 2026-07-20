INSERT INTO audit_events (tenant_id, action, module_id, entity_type, severity, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'work_proofs.seed.prepared',
  'work-proofs',
  'field_report',
  'info',
  '{"seed":"0010_work_proofs_seed","storageMetadataOnly":true}'::jsonb
);
