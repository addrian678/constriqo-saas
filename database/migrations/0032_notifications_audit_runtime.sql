INSERT INTO capabilities (code, module_id, description)
VALUES
  ('notifications.read', 'notifications-audit-reports', 'Read and acknowledge tenant notifications.'),
  ('audit.read', 'notifications-audit-reports', 'Read tenant audit events.')
ON CONFLICT (code) DO UPDATE
SET module_id = EXCLUDED.module_id,
    description = EXCLUDED.description;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON
  (r.code = 'admin' AND c.code IN ('notifications.read', 'audit.read'))
  OR (r.code = 'manager' AND c.code IN ('notifications.read', 'audit.read'))
  OR (r.code = 'worker' AND c.code IN ('notifications.read'))
ON CONFLICT (role_id, capability_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_notification_queue_tenant_role_created
  ON notification_queue(tenant_id, audience_role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_module_created
  ON audit_events(tenant_id, module_id, created_at DESC);
