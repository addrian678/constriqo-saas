CREATE TABLE IF NOT EXISTS invoice_items (
  invoice_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  invoice_id uuid NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(12, 2) NOT NULL DEFAULT 1,
  unit_price numeric(12, 2) NOT NULL DEFAULT 0,
  total_amount numeric(12, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  invoice_id uuid NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  method text NOT NULL,
  status text NOT NULL DEFAULT 'recorded',
  received_at timestamptz NOT NULL,
  recorded_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS receipts (
  receipt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  payment_id uuid NOT NULL REFERENCES payments(payment_id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  document_id uuid REFERENCES documents(document_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS invoice_status_history (
  invoice_status_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  invoice_id uuid NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by_user_id uuid REFERENCES users(user_id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(tenant_id, invoice_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_status_history_invoice ON invoice_status_history(tenant_id, invoice_id, changed_at DESC);
