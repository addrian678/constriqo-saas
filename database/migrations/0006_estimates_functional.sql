CREATE TABLE IF NOT EXISTS estimate_versions (
  estimate_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  estimate_id uuid NOT NULL REFERENCES estimates(estimate_id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  subtotal_amount numeric(12, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(12, 2) NOT NULL DEFAULT 0,
  total_amount numeric(12, 2) NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, estimate_id, version_number)
);

CREATE TABLE IF NOT EXISTS estimate_sections (
  estimate_section_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  estimate_version_id uuid NOT NULL REFERENCES estimate_versions(estimate_version_id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS estimate_items (
  estimate_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  estimate_section_id uuid NOT NULL REFERENCES estimate_sections(estimate_section_id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(12, 2) NOT NULL DEFAULT 1,
  unit_price numeric(12, 2) NOT NULL DEFAULT 0,
  total_amount numeric(12, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS estimate_approvals (
  estimate_approval_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  estimate_id uuid NOT NULL REFERENCES estimates(estimate_id) ON DELETE CASCADE,
  approved_by_user_id uuid REFERENCES users(user_id),
  status text NOT NULL,
  approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimate_versions_estimate ON estimate_versions(tenant_id, estimate_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_estimate_items_section ON estimate_items(tenant_id, estimate_section_id);
CREATE INDEX IF NOT EXISTS idx_estimate_approvals_estimate ON estimate_approvals(tenant_id, estimate_id, created_at DESC);
