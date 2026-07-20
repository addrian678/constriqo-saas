CREATE TABLE IF NOT EXISTS work_proofs (
  work_proof_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  field_report_id uuid NOT NULL REFERENCES field_reports(field_report_id) ON DELETE CASCADE,
  storage_object_id uuid REFERENCES storage_objects(storage_object_id),
  status text NOT NULL DEFAULT 'pending_upload',
  caption text,
  created_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by_user_id uuid REFERENCES users(user_id),
  reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS field_report_checklist_items (
  checklist_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  field_report_id uuid NOT NULL REFERENCES field_reports(field_report_id) ON DELETE CASCADE,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS field_report_materials (
  field_report_material_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  field_report_id uuid NOT NULL REFERENCES field_reports(field_report_id) ON DELETE CASCADE,
  material_name text NOT NULL,
  quantity numeric(12, 2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'unit',
  notes text
);

ALTER TABLE job_incidents
  ADD COLUMN IF NOT EXISTS field_report_id uuid REFERENCES field_reports(field_report_id);

CREATE INDEX IF NOT EXISTS idx_work_proofs_report_status ON work_proofs(tenant_id, field_report_id, status);
CREATE INDEX IF NOT EXISTS idx_field_checklist_report ON field_report_checklist_items(tenant_id, field_report_id);
CREATE INDEX IF NOT EXISTS idx_field_materials_report ON field_report_materials(tenant_id, field_report_id);
