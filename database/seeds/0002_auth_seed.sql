INSERT INTO audit_events (tenant_id, action, module_id, entity_type, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'auth.seed.prepared',
  'auth',
  'tenant',
  '{"seed":"0002_auth_seed","publicRegistration":false,"passwordHash":"argon2id-required","tokenStorage":"hash-only"}'::jsonb
);
