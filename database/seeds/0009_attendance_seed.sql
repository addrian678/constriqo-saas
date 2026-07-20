INSERT INTO audit_events (tenant_id, action, module_id, entity_type, severity, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'attendance.seed.prepared',
  'attendance',
  'time_entry',
  'info',
  '{"seed":"0009_attendance_seed","breaks":true,"approvals":true,"hardware":false}'::jsonb
);
