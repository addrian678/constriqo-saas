CREATE TABLE IF NOT EXISTS tenant_industry_profiles (
  tenant_industry_profile_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  profile_id text NOT NULL,
  status text NOT NULL DEFAULT 'prepared',
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, profile_id)
);

CREATE TABLE IF NOT EXISTS industry_terms (
  industry_term_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  profile_id text NOT NULL,
  term_key text NOT NULL,
  term_value text NOT NULL,
  updated_by_user_id uuid REFERENCES users(user_id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, profile_id, term_key)
);

CREATE TABLE IF NOT EXISTS industry_module_overrides (
  module_override_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  profile_id text NOT NULL,
  module_id text NOT NULL,
  override_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by_user_id uuid REFERENCES users(user_id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, profile_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_industry_profiles_status ON tenant_industry_profiles(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_industry_terms_profile ON industry_terms(tenant_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_industry_overrides_profile ON industry_module_overrides(tenant_id, profile_id);
