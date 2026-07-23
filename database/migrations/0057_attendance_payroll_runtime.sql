ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS payroll_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payroll_payment_id uuid;

ALTER TABLE break_entries
  ADD COLUMN IF NOT EXISTS planned_minutes integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_time_entries_payroll_status') THEN
    ALTER TABLE time_entries
      ADD CONSTRAINT chk_time_entries_payroll_status
      CHECK (payroll_status IN ('unpaid', 'paid', 'excluded'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_time_entries_tenant_cancelled_by') THEN
    ALTER TABLE time_entries
      ADD CONSTRAINT fk_time_entries_tenant_cancelled_by
      FOREIGN KEY (tenant_id, cancelled_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS payroll_worker_settings (
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  worker_id uuid NOT NULL REFERENCES workers(worker_id),
  pay_type text NOT NULL DEFAULT 'hourly',
  hourly_rate numeric(12, 2) NOT NULL DEFAULT 0,
  daily_rate numeric(12, 2) NOT NULL DEFAULT 0,
  payment_frequency text NOT NULL DEFAULT 'weekly',
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, worker_id),
  CHECK (pay_type IN ('hourly', 'daily')),
  CHECK (payment_frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  CHECK (status IN ('active', 'inactive')),
  CHECK (hourly_rate >= 0),
  CHECK (daily_rate >= 0)
);

CREATE TABLE IF NOT EXISTS payroll_payments (
  payroll_payment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  worker_id uuid NOT NULL REFERENCES workers(worker_id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_seconds integer NOT NULL DEFAULT 0,
  break_seconds integer NOT NULL DEFAULT 0,
  payable_seconds integer NOT NULL DEFAULT 0,
  paid_days integer NOT NULL DEFAULT 0,
  pay_type text NOT NULL,
  rate_amount numeric(12, 2) NOT NULL DEFAULT 0,
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'paid',
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(user_id),
  finance_transaction_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (pay_type IN ('hourly', 'daily')),
  CHECK (status IN ('paid', 'void')),
  CHECK (amount >= 0),
  CHECK (payable_seconds >= 0)
);

CREATE TABLE IF NOT EXISTS payroll_payment_time_entries (
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  payroll_payment_id uuid NOT NULL REFERENCES payroll_payments(payroll_payment_id) ON DELETE CASCADE,
  time_entry_id uuid NOT NULL REFERENCES time_entries(time_entry_id),
  gross_seconds integer NOT NULL DEFAULT 0,
  break_seconds integer NOT NULL DEFAULT 0,
  payable_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, payroll_payment_id, time_entry_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_payroll_payments_tenant_payment') THEN
    ALTER TABLE payroll_payments
      ADD CONSTRAINT uq_payroll_payments_tenant_payment UNIQUE (tenant_id, payroll_payment_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_worker_settings_tenant_worker') THEN
    ALTER TABLE payroll_worker_settings
      ADD CONSTRAINT fk_payroll_worker_settings_tenant_worker
      FOREIGN KEY (tenant_id, worker_id) REFERENCES workers(tenant_id, worker_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_payments_tenant_worker') THEN
    ALTER TABLE payroll_payments
      ADD CONSTRAINT fk_payroll_payments_tenant_worker
      FOREIGN KEY (tenant_id, worker_id) REFERENCES workers(tenant_id, worker_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_payments_tenant_created_by') THEN
    ALTER TABLE payroll_payments
      ADD CONSTRAINT fk_payroll_payments_tenant_created_by
      FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_payments_tenant_finance_transaction') THEN
    ALTER TABLE payroll_payments
      ADD CONSTRAINT fk_payroll_payments_tenant_finance_transaction
      FOREIGN KEY (tenant_id, finance_transaction_id) REFERENCES financial_transactions(tenant_id, financial_transaction_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_payment_entries_tenant_payment') THEN
    ALTER TABLE payroll_payment_time_entries
      ADD CONSTRAINT fk_payroll_payment_entries_tenant_payment
      FOREIGN KEY (tenant_id, payroll_payment_id) REFERENCES payroll_payments(tenant_id, payroll_payment_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_payment_entries_tenant_time_entry') THEN
    ALTER TABLE payroll_payment_time_entries
      ADD CONSTRAINT fk_payroll_payment_entries_tenant_time_entry
      FOREIGN KEY (tenant_id, time_entry_id) REFERENCES time_entries(tenant_id, time_entry_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_time_entries_tenant_payroll_payment') THEN
    ALTER TABLE time_entries
      ADD CONSTRAINT fk_time_entries_tenant_payroll_payment
      FOREIGN KEY (tenant_id, payroll_payment_id) REFERENCES payroll_payments(tenant_id, payroll_payment_id);
  END IF;
END $$;

INSERT INTO capabilities (code, module_id, description)
VALUES
  ('payroll.read', 'payroll', 'Read tenant payroll summaries and payments.'),
  ('payroll.manage', 'payroll', 'Manage payroll rates and record payroll payments.')
ON CONFLICT (code) DO UPDATE
SET module_id = EXCLUDED.module_id,
    description = EXCLUDED.description;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON
  (r.code = 'admin' AND c.code IN ('payroll.read', 'payroll.manage'))
  OR (r.code = 'manager' AND c.code IN ('payroll.read'))
ON CONFLICT (role_id, capability_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_worker_payroll
  ON time_entries(tenant_id, worker_id, payroll_status, clock_in DESC);

CREATE INDEX IF NOT EXISTS idx_break_entries_open_planned
  ON break_entries(tenant_id, time_entry_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_payments_worker_period
  ON payroll_payments(tenant_id, worker_id, period_start DESC, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_payment_entries_time_entry
  ON payroll_payment_time_entries(tenant_id, time_entry_id);

DO $$
DECLARE
  table_name text;
  policy_name text;
  scoped_tables text[] := ARRAY[
    'payroll_worker_settings',
    'payroll_payments',
    'payroll_payment_time_entries'
  ];
BEGIN
  FOREACH table_name IN ARRAY scoped_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    policy_name := table_name || '_tenant_isolation';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
        policy_name,
        table_name
      );
    END IF;
  END LOOP;
END $$;
