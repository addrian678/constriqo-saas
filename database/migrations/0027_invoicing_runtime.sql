ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS estimate_id uuid,
  ADD COLUMN IF NOT EXISTS invoice_type text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS subtotal_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS issue_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS country_profile text NOT NULL DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS document_language text NOT NULL DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS billing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS unit_code text NOT NULL DEFAULT 'unit',
  ADD COLUMN IF NOT EXISTS tax_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS notes text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_tenant_estimate') THEN
    ALTER TABLE invoices
      ADD CONSTRAINT fk_invoices_tenant_estimate
      FOREIGN KEY (tenant_id, estimate_id) REFERENCES estimates(tenant_id, estimate_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status_due ON invoices(tenant_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_issue_date ON invoices(tenant_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_received ON payments(tenant_id, received_at DESC);

INSERT INTO capabilities (code, module_id, description)
VALUES
  ('invoices.update', 'invoicing', 'Actualizar estado y datos de facturas reales.'),
  ('invoices.issue', 'invoicing', 'Emitir facturas reales dentro del tenant.'),
  ('payments.record', 'invoicing', 'Registrar cobros de facturas reales.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON c.code IN ('invoices.read', 'invoices.create', 'invoices.update', 'invoices.issue', 'payments.record', 'finance.read', 'cashflow.read')
WHERE r.code IN ('admin', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON c.code IN ('invoices.read', 'invoices.create', 'invoices.update', 'payments.record', 'finance.read', 'cashflow.read')
WHERE r.code = 'manager'
ON CONFLICT DO NOTHING;
