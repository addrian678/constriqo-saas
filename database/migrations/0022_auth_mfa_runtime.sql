-- Adds MFA foundations required before administrator sessions can be considered production-safe.

CREATE TABLE IF NOT EXISTS auth_mfa_factors (
  factor_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  factor_type text NOT NULL DEFAULT 'totp',
  label text NOT NULL DEFAULT 'Authenticator app',
  secret_ciphertext text,
  secret_iv text,
  secret_tag text,
  status text NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, factor_type, label)
);

CREATE TABLE IF NOT EXISTS auth_mfa_challenges (
  challenge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  factor_id uuid REFERENCES auth_mfa_factors(factor_id) ON DELETE CASCADE,
  purpose text NOT NULL,
  challenge_token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, challenge_token_hash)
);

CREATE TABLE IF NOT EXISTS auth_recovery_codes (
  recovery_code_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code_hash)
);

CREATE INDEX IF NOT EXISTS idx_auth_mfa_factors_user_status ON auth_mfa_factors(tenant_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_auth_mfa_challenges_user_status ON auth_mfa_challenges(tenant_id, user_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_recovery_codes_user_status ON auth_recovery_codes(tenant_id, user_id, status);

DO $$
DECLARE
  table_name text;
  policy_name text;
  scoped_tables text[] := ARRAY['auth_mfa_factors', 'auth_mfa_challenges', 'auth_recovery_codes'];
BEGIN
  FOREACH table_name IN ARRAY scoped_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    policy_name := table_name || '_tenant_isolation';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
        policy_name,
        table_name
      );
    END IF;
  END LOOP;
END $$;
