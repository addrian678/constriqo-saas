-- Runtime login validates the current tenant license before issuing a session.
-- Supabase automatic RLS can hide this table unless the tenant-scoped policy exists.

ALTER TABLE tenant_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_licenses FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_licenses'
      AND policyname = 'tenant_licenses_tenant_isolation'
  ) THEN
    CREATE POLICY tenant_licenses_tenant_isolation ON tenant_licenses
      USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;
