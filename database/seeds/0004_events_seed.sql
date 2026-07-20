INSERT INTO audit_events (tenant_id, action, module_id, entity_type, severity, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'events.seed.prepared',
  'events',
  'tenant',
  'info',
  '{"seed":"0004_events_seed","outbox":"prepared","notificationChannels":["in_app"]}'::jsonb
);
