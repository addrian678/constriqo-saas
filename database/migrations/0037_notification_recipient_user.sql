ALTER TABLE notification_queue
  ADD COLUMN IF NOT EXISTS recipient_user_id uuid REFERENCES users(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notification_queue_tenant_recipient_created
  ON notification_queue(tenant_id, recipient_user_id, created_at DESC);
