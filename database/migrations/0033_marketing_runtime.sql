ALTER TABLE marketing_leads
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS notes text;

INSERT INTO capabilities (code, module_id, description)
VALUES
  ('marketing.read', 'marketing', 'Read tenant marketing campaigns and leads.'),
  ('marketing.manage', 'marketing', 'Create and manage tenant marketing campaigns and leads.'),
  ('marketing.leads.convert', 'marketing', 'Convert accepted marketing leads to CRM clients.')
ON CONFLICT (code) DO UPDATE
SET module_id = EXCLUDED.module_id,
    description = EXCLUDED.description;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON
  (r.code = 'admin' AND c.code IN ('marketing.read', 'marketing.manage', 'marketing.leads.convert'))
  OR (r.code = 'manager' AND c.code IN ('marketing.read', 'marketing.manage', 'marketing.leads.convert'))
ON CONFLICT (role_id, capability_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_marketing_leads_tenant_campaign
  ON marketing_leads(tenant_id, marketing_campaign_id, status);
