-- Runtime readiness checks schema_migrations before accepting traffic.
-- Supabase automatic RLS can hide this metadata table from the limited runtime role.

ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'schema_migrations'
      AND policyname = 'schema_migrations_runtime_read'
  ) THEN
    CREATE POLICY schema_migrations_runtime_read ON schema_migrations
      FOR SELECT
      USING (true);
  END IF;
END $$;
