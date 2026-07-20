DO $$
DECLARE
  table_name text;
  policy_name text;
  scoped_tables text[] := ARRAY[
    'marketing_loyalty_cards',
    'notification_preferences',
    'email_deliveries'
  ];
BEGIN
  FOREACH table_name IN ARRAY scoped_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    policy_name := table_name || '_tenant_isolation';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
        policy_name,
        table_name
      );
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_preferences_tenant_user') THEN
    ALTER TABLE notification_preferences
      ADD CONSTRAINT fk_notification_preferences_tenant_user
      FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, user_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_email_deliveries_tenant_queued_by') THEN
    ALTER TABLE email_deliveries
      ADD CONSTRAINT fk_email_deliveries_tenant_queued_by
      FOREIGN KEY (tenant_id, queued_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit events are append-only'
    USING ERRCODE = '42501';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_audit_events_append_only'
  ) THEN
    CREATE TRIGGER trg_audit_events_append_only
      BEFORE UPDATE OR DELETE ON audit_events
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
  END IF;

  IF to_regclass('public.super_admin_audit_events') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_super_admin_audit_events_append_only'
    )
  THEN
    CREATE TRIGGER trg_super_admin_audit_events_append_only
      BEFORE UPDATE OR DELETE ON super_admin_audit_events
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
  END IF;
END $$;
