CREATE TABLE IF NOT EXISTS user_privacy_preferences (
  privacy_preference_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  policy_version text NOT NULL DEFAULT '2026-07-15',
  language text NOT NULL DEFAULT 'es',
  necessary_cookies boolean NOT NULL DEFAULT true,
  analytics_cookies boolean NOT NULL DEFAULT false,
  marketing_cookies boolean NOT NULL DEFAULT false,
  email_communications boolean NOT NULL DEFAULT false,
  sms_communications boolean NOT NULL DEFAULT false,
  push_notifications boolean NOT NULL DEFAULT false,
  updated_by_user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_privacy_preferences_tenant_user
  ON user_privacy_preferences(tenant_id, user_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_privacy_preferences_tenant_user') THEN
    ALTER TABLE user_privacy_preferences
      ADD CONSTRAINT fk_privacy_preferences_tenant_user
      FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, user_id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE user_privacy_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_privacy_preferences FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_privacy_preferences'
      AND policyname = 'user_privacy_preferences_tenant_isolation'
  ) THEN
    CREATE POLICY user_privacy_preferences_tenant_isolation
      ON user_privacy_preferences
      USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;
