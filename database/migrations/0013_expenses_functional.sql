CREATE TABLE IF NOT EXISTS vendors (
  vendor_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  name text NOT NULL,
  category text,
  contact_name text,
  phone text,
  email text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES vendors(vendor_id),
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE TABLE IF NOT EXISTS expense_items (
  expense_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  expense_id uuid NOT NULL REFERENCES expenses(expense_id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(12, 2) NOT NULL DEFAULT 1,
  amount numeric(12, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS expense_payments (
  expense_payment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  expense_id uuid NOT NULL REFERENCES expenses(expense_id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  method text NOT NULL,
  status text NOT NULL DEFAULT 'recorded',
  paid_at timestamptz NOT NULL,
  recorded_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expense_status_history (
  expense_status_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  expense_id uuid NOT NULL REFERENCES expenses(expense_id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by_user_id uuid REFERENCES users(user_id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_tenant_status ON vendors(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_expense_items_expense ON expense_items(tenant_id, expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_payments_expense ON expense_payments(tenant_id, expense_id, paid_at DESC);
