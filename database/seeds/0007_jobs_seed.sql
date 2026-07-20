INSERT INTO audit_events (tenant_id, action, module_id, entity_type, severity, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'jobs.seed.prepared',
  'jobs',
  'job',
  'info',
  '{"seed":"0007_jobs_seed","phases":true,"tasks":true,"changeRequests":true}'::jsonb
);
