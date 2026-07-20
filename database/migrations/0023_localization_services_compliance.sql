-- Adds production SaaS foundations required by the updated plan:
-- tenant localization, service/price catalog, quote snapshots, and policy acceptance evidence.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS country_profile text NOT NULL DEFAULT 'US';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS unit_system text NOT NULL DEFAULT 'imperial';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS app_language text NOT NULL DEFAULT 'es';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS document_language text NOT NULL DEFAULT 'es';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tenant_slug text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_slug ON tenants(lower(tenant_slug)) WHERE tenant_slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS service_catalog_items (
  service_catalog_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text NOT NULL DEFAULT '',
  country_profile text NOT NULL DEFAULT 'US',
  unit_system text NOT NULL DEFAULT 'imperial',
  unit_code text NOT NULL DEFAULT 'sq_ft',
  currency text NOT NULL DEFAULT 'USD',
  unit_price numeric(12, 2) NOT NULL DEFAULT 0,
  unit_cost numeric(12, 2) NOT NULL DEFAULT 0,
  default_tax_rate numeric(5, 2) NOT NULL DEFAULT 0,
  margin_percent numeric(5, 2) NOT NULL DEFAULT 0,
  minimum_quantity numeric(12, 2) NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  inclusions text NOT NULL DEFAULT '',
  exclusions text NOT NULL DEFAULT '',
  conditions text NOT NULL DEFAULT '',
  created_by_user_id uuid REFERENCES users(user_id),
  updated_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_catalog_tenant_item ON service_catalog_items(tenant_id, service_catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_service_catalog_tenant_status ON service_catalog_items(tenant_id, status, category, name);

ALTER TABLE estimate_items ADD COLUMN IF NOT EXISTS service_catalog_item_id uuid;
ALTER TABLE estimate_items ADD COLUMN IF NOT EXISTS unit_code text NOT NULL DEFAULT 'unit';
ALTER TABLE estimate_items ADD COLUMN IF NOT EXISTS service_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_estimate_items_tenant_service_catalog') THEN
    ALTER TABLE estimate_items
      ADD CONSTRAINT fk_estimate_items_tenant_service_catalog
      FOREIGN KEY (tenant_id, service_catalog_item_id) REFERENCES service_catalog_items(tenant_id, service_catalog_item_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tenant_policy_acceptances (
  policy_acceptance_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  user_id uuid NOT NULL REFERENCES users(user_id),
  policy_key text NOT NULL,
  policy_version text NOT NULL,
  language text NOT NULL DEFAULT 'es',
  consent_type text NOT NULL DEFAULT 'required_terms',
  status text NOT NULL DEFAULT 'accepted',
  ip_context text,
  user_agent text,
  evidence_hash text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_policy_acceptances_tenant_user ON tenant_policy_acceptances(tenant_id, user_id, policy_key, accepted_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_policy_acceptances_tenant_user') THEN
    ALTER TABLE tenant_policy_acceptances
      ADD CONSTRAINT fk_policy_acceptances_tenant_user
      FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, user_id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
DECLARE
  table_name text;
  policy_name text;
  scoped_tables text[] := ARRAY['service_catalog_items', 'tenant_policy_acceptances'];
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
