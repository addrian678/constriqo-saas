CREATE TABLE IF NOT EXISTS tenant_fiscal_profiles (
  tenant_fiscal_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  country_profile text NOT NULL,
  region_code text NOT NULL DEFAULT '',
  tax_id_label text NOT NULL,
  tax_mode text NOT NULL DEFAULT 'configurable',
  invoice_compliance_mode text NOT NULL DEFAULT 'not_certified_internal_document',
  electronic_invoicing_provider text,
  requires_external_provider boolean NOT NULL DEFAULT false,
  required_invoice_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  legal_review_status text NOT NULL DEFAULT 'pending_review',
  legal_reviewed_at timestamptz,
  configured_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, country_profile, region_code)
);

-- Expected RLS policy names created below:
-- tenant_fiscal_profiles_tenant_isolation
-- tenant_provider_settings_tenant_isolation

CREATE TABLE IF NOT EXISTS tenant_provider_settings (
  tenant_provider_setting_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  provider_type text NOT NULL,
  provider_code text NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  public_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_ref text,
  configured_by_user_id uuid REFERENCES users(user_id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider_type, provider_code),
  CHECK (provider_type IN ('email', 'storage', 'fiscal', 'domain')),
  CHECK (status IN ('planned', 'sandbox', 'configured', 'verified', 'disabled'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_fiscal_profiles_tenant_country
  ON tenant_fiscal_profiles(tenant_id, country_profile, region_code);

CREATE INDEX IF NOT EXISTS idx_tenant_provider_settings_tenant_type
  ON tenant_provider_settings(tenant_id, provider_type, status);

DO $$
DECLARE
  table_name text;
  policy_name text;
  scoped_tables text[] := ARRAY['tenant_fiscal_profiles', 'tenant_provider_settings'];
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

INSERT INTO capabilities (code, module_id, description)
VALUES
  ('organization.providers.manage', 'organization', 'Configurar proveedores externos no secretos por tenant.'),
  ('organization.fiscal.manage', 'organization', 'Configurar perfiles fiscales operativos por tenant.')
ON CONFLICT (code) DO UPDATE
SET module_id = EXCLUDED.module_id,
    description = EXCLUDED.description;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON c.code IN ('organization.providers.manage', 'organization.fiscal.manage')
WHERE r.code = 'admin'
ON CONFLICT (role_id, capability_id) DO NOTHING;

COMMENT ON TABLE tenant_fiscal_profiles IS
  'Operational fiscal profile per tenant/country. It is not a certification of electronic invoicing compliance.';

COMMENT ON TABLE tenant_provider_settings IS
  'Provider metadata only. Secrets must live in environment variables or an external secret manager referenced by secret_ref.';
