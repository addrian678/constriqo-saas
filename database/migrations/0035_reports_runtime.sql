INSERT INTO capabilities (code, module_id, description)
VALUES
  ('reports.read', 'reports', 'Read real tenant business reports.')
ON CONFLICT (code) DO UPDATE
SET module_id = EXCLUDED.module_id,
    description = EXCLUDED.description;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON c.code = 'reports.read'
WHERE r.code IN ('admin', 'manager')
ON CONFLICT (role_id, capability_id) DO NOTHING;
