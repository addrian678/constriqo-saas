INSERT INTO audit_events (tenant_id, action, module_id, entity_type, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'storage.seed.prepared',
  'storage',
  'tenant',
  '{"seed":"0003_storage_seed","provider":"not-configured","signedUrlExpiryMinutes":10}'::jsonb
);
