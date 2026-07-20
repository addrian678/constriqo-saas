ALTER TABLE notification_queue
  ADD COLUMN IF NOT EXISTS event_key text;

CREATE INDEX IF NOT EXISTS idx_notification_queue_tenant_event_key
  ON notification_queue(tenant_id, event_key, created_at DESC);
