-- Payroll integrity hardening.
-- A closed time entry can belong to one payroll payment only.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_payroll_payment_entries_tenant_time_entry') THEN
    ALTER TABLE payroll_payment_time_entries
      ADD CONSTRAINT uq_payroll_payment_entries_tenant_time_entry UNIQUE (tenant_id, time_entry_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_worker_unpaid_closed
  ON time_entries(tenant_id, worker_id, clock_in)
  WHERE payroll_status = 'unpaid'
    AND clock_out IS NOT NULL
    AND status IN ('submitted', 'approved');
