ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS corrected_by_transaction_id uuid,
  ADD COLUMN IF NOT EXISTS reversed_transaction_id uuid,
  ADD COLUMN IF NOT EXISTS correction_group_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_financial_transactions_tenant_transaction') THEN
    ALTER TABLE financial_transactions
      ADD CONSTRAINT uq_financial_transactions_tenant_transaction UNIQUE (tenant_id, financial_transaction_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_financial_transactions_corrected_by') THEN
    ALTER TABLE financial_transactions
      ADD CONSTRAINT fk_financial_transactions_corrected_by
      FOREIGN KEY (tenant_id, corrected_by_transaction_id)
      REFERENCES financial_transactions(tenant_id, financial_transaction_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_financial_transactions_reversed_transaction') THEN
    ALTER TABLE financial_transactions
      ADD CONSTRAINT fk_financial_transactions_reversed_transaction
      FOREIGN KEY (tenant_id, reversed_transaction_id)
      REFERENCES financial_transactions(tenant_id, financial_transaction_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_tenant_correction
  ON financial_transactions(tenant_id, correction_group_id, corrected_by_transaction_id);
