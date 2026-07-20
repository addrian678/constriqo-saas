CREATE TABLE IF NOT EXISTS event_outbox (
  event_outbox_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  event_type text NOT NULL,
  module_id text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS notification_queue (
  notification_queue_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  audience_role text NOT NULL,
  channel text NOT NULL DEFAULT 'in_app',
  title text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  related_entity_type text,
  related_entity_id uuid,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS ip_hash text,
  ADD COLUMN IF NOT EXISTS user_agent_hash text;

CREATE INDEX IF NOT EXISTS idx_event_outbox_status ON event_outbox(status, occurred_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_module_action ON audit_events(tenant_id, module_id, action);
