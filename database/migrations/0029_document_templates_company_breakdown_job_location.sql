ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS contractor_license text,
  ADD COLUMN IF NOT EXISTS company_address text,
  ADD COLUMN IF NOT EXISTS company_city text,
  ADD COLUMN IF NOT EXISTS company_region text,
  ADD COLUMN IF NOT EXISTS company_postal_code text,
  ADD COLUMN IF NOT EXISTS company_country text,
  ADD COLUMN IF NOT EXISTS company_phone text,
  ADD COLUMN IF NOT EXISTS company_email text,
  ADD COLUMN IF NOT EXISTS company_website text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS estimate_template_id text NOT NULL DEFAULT 'estimate_classic_blue',
  ADD COLUMN IF NOT EXISTS invoice_template_id text NOT NULL DEFAULT 'invoice_clean_red',
  ADD COLUMN IF NOT EXISTS document_company_visibility jsonb NOT NULL DEFAULT '{"logo":true,"commercialName":true,"legalName":true,"taxId":true,"license":true,"address":true,"phone":true,"email":true,"website":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS document_signature jsonb NOT NULL DEFAULT '{"name":"","title":"","imageUrl":""}'::jsonb;

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS template_id text,
  ADD COLUMN IF NOT EXISTS cost_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS project_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS company_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS template_id text,
  ADD COLUMN IF NOT EXISTS cost_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS company_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS project_address text,
  ADD COLUMN IF NOT EXISTS project_latitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS project_longitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS allowed_radius_meters integer NOT NULL DEFAULT 250;

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS job_distance_meters numeric(10, 2),
  ADD COLUMN IF NOT EXISTS location_status text NOT NULL DEFAULT 'not_checked';

INSERT INTO capabilities (code, module_id, description)
VALUES
  ('documents.templates.manage', 'organization', 'Configurar plantillas documentales por tenant.'),
  ('estimates.pdf.download', 'estimates', 'Descargar PDF de cotizacion.'),
  ('jobs.location.manage', 'jobs', 'Configurar ubicacion GPS y radio permitido de obra.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON c.code IN ('documents.templates.manage', 'estimates.pdf.download', 'jobs.location.manage')
WHERE r.code IN ('admin', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON c.code IN ('estimates.pdf.download', 'jobs.location.manage')
WHERE r.code = 'manager'
ON CONFLICT DO NOTHING;
