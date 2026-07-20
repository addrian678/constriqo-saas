-- Supabase can enable RLS automatically on newly created tables.
-- Runtime auth must still be able to read the current tenant row and global capability catalog.

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenants'
      AND policyname = 'tenants_tenant_isolation'
  ) THEN
    CREATE POLICY tenants_tenant_isolation ON tenants
      USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;

  IF to_regclass('public.capabilities') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE capabilities ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE capabilities FORCE ROW LEVEL SECURITY';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'capabilities'
        AND policyname = 'capabilities_runtime_read'
    ) THEN
      CREATE POLICY capabilities_runtime_read ON capabilities
        FOR SELECT
        USING (true);
    END IF;
  END IF;

  IF to_regclass('public.role_capabilities') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE role_capabilities ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE role_capabilities FORCE ROW LEVEL SECURITY';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'role_capabilities'
        AND policyname = 'role_capabilities_runtime_read'
    ) THEN
      CREATE POLICY role_capabilities_runtime_read ON role_capabilities
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1
            FROM roles
            WHERE roles.role_id = role_capabilities.role_id
              AND roles.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
          )
        );
    END IF;
  END IF;
END $$;
