INSERT INTO capabilities (code, module_id, description)
VALUES
  ('estimates.cancel', 'estimates', 'Cancel tenant estimates without deleting audit history.')
ON CONFLICT (code) DO UPDATE
SET module_id = EXCLUDED.module_id,
    description = EXCLUDED.description;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON c.code = 'estimates.cancel'
WHERE r.code IN ('admin', 'owner', 'manager')
ON CONFLICT (role_id, capability_id) DO NOTHING;
