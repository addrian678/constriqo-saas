INSERT INTO capabilities (code, module_id, description)
VALUES
  ('assets.read', 'assets-liabilities', 'Read tenant assets.'),
  ('assets.manage', 'assets-liabilities', 'Create and manage tenant assets.'),
  ('liabilities.read', 'assets-liabilities', 'Read tenant liabilities.'),
  ('liabilities.manage', 'assets-liabilities', 'Create and manage tenant liabilities.')
ON CONFLICT (code) DO UPDATE
SET module_id = EXCLUDED.module_id,
    description = EXCLUDED.description;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON
  (r.code = 'admin' AND c.code IN ('assets.read', 'assets.manage', 'liabilities.read', 'liabilities.manage'))
  OR (r.code = 'manager' AND c.code IN ('assets.read', 'liabilities.read'))
ON CONFLICT (role_id, capability_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_assets_tenant_status_category
  ON assets(tenant_id, status, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_liabilities_tenant_status_due
  ON liabilities(tenant_id, status, next_due_date);
