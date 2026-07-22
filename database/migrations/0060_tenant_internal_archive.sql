ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text,
  ADD COLUMN IF NOT EXISTS internal_test_data boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tenants_active_provider_list
  ON tenants(created_at DESC)
  WHERE archived_at IS NULL;

