CREATE TABLE IF NOT EXISTS organization_settings (
  organization_setting_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  setting_key text NOT NULL,
  setting_value text NOT NULL,
  value_type text NOT NULL DEFAULT 'string',
  updated_by_user_id uuid REFERENCES users(user_id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, setting_key)
);

CREATE TABLE IF NOT EXISTS tenant_feature_flags (
  feature_flag_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  module_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by_user_id uuid REFERENCES users(user_id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, module_id)
);

CREATE TABLE IF NOT EXISTS organization_change_log (
  organization_change_log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  changed_by_user_id uuid REFERENCES users(user_id),
  change_type text NOT NULL,
  target_key text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organization_settings_tenant ON organization_settings(tenant_id, setting_key);
CREATE INDEX IF NOT EXISTS idx_tenant_feature_flags_tenant ON tenant_feature_flags(tenant_id, module_id);
CREATE INDEX IF NOT EXISTS idx_organization_change_log_tenant ON organization_change_log(tenant_id, created_at DESC);
