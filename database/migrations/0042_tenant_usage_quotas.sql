ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS storage_size_bytes bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS tenant_usage_limits (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  plan_code text NOT NULL DEFAULT 'starter',
  storage_quota_mb integer NOT NULL DEFAULT 1024,
  document_quota integer NOT NULL DEFAULT 5000,
  photo_evidence_enabled boolean NOT NULL DEFAULT false,
  marketing_addon_enabled boolean NOT NULL DEFAULT true,
  dedicated_storage_enabled boolean NOT NULL DEFAULT false,
  updated_by_user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (storage_quota_mb > 0),
  CHECK (document_quota > 0)
);

ALTER TABLE tenant_usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_usage_limits FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_usage_limits'
      AND policyname = 'tenant_usage_limits_tenant_isolation'
  ) THEN
    CREATE POLICY tenant_usage_limits_tenant_isolation
      ON tenant_usage_limits
      USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_tenant_storage_size
  ON documents(tenant_id, status, storage_size_bytes)
  WHERE storage_key IS NOT NULL;
