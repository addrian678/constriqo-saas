CREATE TABLE IF NOT EXISTS notification_preferences (
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  event_key text NOT NULL,
  channel text NOT NULL DEFAULT 'push_future',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id, event_key, channel),
  CONSTRAINT chk_notification_preferences_channel CHECK (channel IN ('push_future', 'email_future', 'in_app_highlight'))
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_tenant_user
  ON notification_preferences(tenant_id, user_id, event_key);
