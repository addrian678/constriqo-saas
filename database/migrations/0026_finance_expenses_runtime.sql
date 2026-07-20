ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS expense_number text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS tax_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS issue_date date,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE expenses
SET expense_number = 'EXP-' || lpad(row_number::text, 5, '0')
FROM (
  SELECT expense_id, row_number() OVER (PARTITION BY tenant_id ORDER BY created_at, expense_id) AS row_number
  FROM expenses
  WHERE expense_number IS NULL
) numbered
WHERE expenses.expense_id = numbered.expense_id;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_expenses_tenant_expense_number') THEN
    ALTER TABLE expenses
      ADD CONSTRAINT uq_expenses_tenant_expense_number UNIQUE (tenant_id, expense_number);
  END IF;
END $$;

ALTER TABLE expense_items
  ADD COLUMN IF NOT EXISTS tax_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS direction text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'posted';

INSERT INTO capabilities (code, module_id, description)
VALUES
  ('expenses.read', 'expenses', 'Read tenant expenses and vendors.'),
  ('expenses.create', 'expenses', 'Create tenant expenses and vendors.'),
  ('expenses.approve', 'expenses', 'Approve tenant expenses.'),
  ('finance.read', 'finance', 'Read financial dashboard and accounts.'),
  ('cashflow.read', 'finance', 'Read cashflow transactions.'),
  ('finance.manage', 'finance', 'Manage financial transactions.')
ON CONFLICT (code) DO UPDATE
SET module_id = EXCLUDED.module_id,
    description = EXCLUDED.description;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON
  (r.code = 'admin' AND c.code IN ('expenses.read', 'expenses.create', 'expenses.approve', 'finance.read', 'cashflow.read', 'finance.manage'))
  OR (r.code = 'manager' AND c.code IN ('expenses.read', 'expenses.create', 'expenses.approve', 'finance.read', 'cashflow.read'))
ON CONFLICT (role_id, capability_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_expenses_tenant_status_due
  ON expenses(tenant_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant_issue_date
  ON expenses(tenant_id, issue_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_tenant_type_date
  ON financial_transactions(tenant_id, transaction_type, occurred_at DESC);
