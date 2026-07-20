ALTER TABLE email_deliveries
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS worker_id text,
  ADD COLUMN IF NOT EXISTS worker_locked_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_email_deliveries_worker_queue
  ON email_deliveries(status, next_attempt_at, queued_at)
  WHERE status IN ('queued', 'failed');

CREATE INDEX IF NOT EXISTS idx_email_deliveries_tenant_attempts
  ON email_deliveries(tenant_id, status, attempt_count, next_attempt_at);

COMMENT ON COLUMN email_deliveries.attempt_count IS 'Number of delivery attempts made by the outbox worker.';
COMMENT ON COLUMN email_deliveries.next_attempt_at IS 'Next safe retry time for queued or failed email deliveries.';
COMMENT ON COLUMN email_deliveries.provider_message_id IS 'Provider message identifier returned after successful delivery.';
COMMENT ON COLUMN email_deliveries.worker_locked_until IS 'Temporary worker lock to avoid duplicate processing across concurrent workers.';
