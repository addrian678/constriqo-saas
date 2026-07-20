CREATE TABLE IF NOT EXISTS financial_accounts (
  financial_account_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  name text NOT NULL,
  account_type text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS financial_transactions (
  financial_transaction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  financial_account_id uuid NOT NULL REFERENCES financial_accounts(financial_account_id),
  transaction_type text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  related_entity_type text,
  related_entity_id uuid,
  occurred_at timestamptz NOT NULL,
  created_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financial_reconciliations (
  financial_reconciliation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  financial_account_id uuid NOT NULL REFERENCES financial_accounts(financial_account_id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'open',
  reviewed_by_user_id uuid REFERENCES users(user_id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_profitability_snapshots (
  job_profitability_snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  job_id uuid NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  income_amount numeric(12, 2) NOT NULL DEFAULT 0,
  cost_amount numeric(12, 2) NOT NULL DEFAULT 0,
  margin_amount numeric(12, 2) NOT NULL DEFAULT 0,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_account ON financial_transactions(tenant_id, financial_account_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_entity ON financial_transactions(tenant_id, related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_job_profitability_job ON job_profitability_snapshots(tenant_id, job_id, calculated_at DESC);
