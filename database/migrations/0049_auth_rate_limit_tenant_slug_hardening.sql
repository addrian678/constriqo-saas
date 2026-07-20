CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_tenant_email_failed_recent
  ON auth_login_attempts (tenant_id, email, created_at DESC)
  WHERE succeeded = false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_tenant_slug_public_code
  ON tenants (tenant_slug)
  WHERE tenant_slug IS NOT NULL AND tenant_slug <> '';

COMMENT ON COLUMN tenants.tenant_slug IS
  'Public tenant code for login branding and support. Do not expose tenant UUIDs as public customer codes.';
