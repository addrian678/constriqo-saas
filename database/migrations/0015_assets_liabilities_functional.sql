CREATE TABLE IF NOT EXISTS asset_maintenance (
  asset_maintenance_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  asset_id uuid NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
  scheduled_for date NOT NULL,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  vendor_id uuid REFERENCES vendors(vendor_id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_depreciation_entries (
  asset_depreciation_entry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  asset_id uuid NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'manual',
  created_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS liability_payment_schedule (
  liability_payment_schedule_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  liability_id uuid NOT NULL REFERENCES liabilities(liability_id) ON DELETE CASCADE,
  due_date date NOT NULL,
  amount numeric(12, 2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS liability_documents (
  liability_document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  liability_id uuid NOT NULL REFERENCES liabilities(liability_id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_maintenance_asset ON asset_maintenance(tenant_id, asset_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_asset_depreciation_asset ON asset_depreciation_entries(tenant_id, asset_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_liability_schedule_due ON liability_payment_schedule(tenant_id, status, due_date);
