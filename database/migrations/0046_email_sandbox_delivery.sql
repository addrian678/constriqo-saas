CREATE TABLE IF NOT EXISTS email_deliveries (
  email_delivery_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  recipient_email text NOT NULL,
  recipient_name text,
  from_email text,
  reply_to_email text,
  subject text NOT NULL,
  body_text text NOT NULL,
  body_html text,
  template_key text NOT NULL,
  provider text NOT NULL DEFAULT 'sandbox',
  status text NOT NULL DEFAULT 'sandboxed',
  related_entity_type text,
  related_entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  queued_by_user_id uuid REFERENCES users(user_id),
  queued_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('sandboxed', 'queued', 'sent', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_tenant_status
  ON email_deliveries(tenant_id, status, queued_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_tenant_entity
  ON email_deliveries(tenant_id, related_entity_type, related_entity_id);

ALTER TABLE email_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_deliveries FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'email_deliveries'
      AND policyname = 'email_deliveries_tenant_isolation'
  ) THEN
    CREATE POLICY email_deliveries_tenant_isolation ON email_deliveries
      USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;

INSERT INTO capabilities (code, module_id, description)
VALUES
  ('email.deliveries.read', 'notifications-audit-reports', 'Read tenant email delivery audit in sandbox or production.'),
  ('email.deliveries.send', 'notifications-audit-reports', 'Queue tenant transactional email deliveries.')
ON CONFLICT (code) DO UPDATE
SET module_id = EXCLUDED.module_id,
    description = EXCLUDED.description;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON c.code IN ('email.deliveries.read', 'email.deliveries.send')
WHERE r.code = 'admin'
ON CONFLICT (role_id, capability_id) DO NOTHING;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON c.code IN ('email.deliveries.read', 'email.deliveries.send')
WHERE r.code = 'manager'
ON CONFLICT (role_id, capability_id) DO NOTHING;
