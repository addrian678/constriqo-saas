CREATE TABLE IF NOT EXISTS document_sequences (
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  document_type text NOT NULL,
  series text NOT NULL DEFAULT 'default',
  fiscal_year integer NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, document_type, series, fiscal_year),
  CHECK (last_value >= 0),
  CHECK (fiscal_year >= 2000 AND fiscal_year <= 2200)
);

ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sequences FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'document_sequences'
      AND policyname = 'document_sequences_tenant_isolation'
  ) THEN
    CREATE POLICY document_sequences_tenant_isolation ON document_sequences
      USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_tenant_idempotency_key
  ON payments(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_financial_accounts_tenant_type_currency'
  ) THEN
    ALTER TABLE financial_accounts
      ADD CONSTRAINT uq_financial_accounts_tenant_type_currency
      UNIQUE (tenant_id, account_type, currency);
  END IF;
END $$;
