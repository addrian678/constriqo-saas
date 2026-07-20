INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
CROSS JOIN capabilities c
WHERE r.code = 'admin'
  AND c.code NOT LIKE 'superadmin.%'
ON CONFLICT (role_id, capability_id) DO NOTHING;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
CROSS JOIN capabilities c
WHERE r.code = 'manager'
  AND c.code = ANY(ARRAY[
    'clients.read',
    'clients.update',
    'estimates.read',
    'estimates.create',
    'estimates.update',
    'jobs.read',
    'jobs.update',
    'workforce.read',
    'attendance.read',
    'attendance.review.visual',
    'notifications.read',
    'reports.read'
  ]::text[])
ON CONFLICT (role_id, capability_id) DO NOTHING;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
CROSS JOIN capabilities c
WHERE r.code = 'worker'
  AND c.code = ANY(ARRAY[
    'worker.tasks.read',
    'worker.tasks.update',
    'attendance.self.visual',
    'notifications.read',
    'proofs.self.visual'
  ]::text[])
ON CONFLICT (role_id, capability_id) DO NOTHING;
