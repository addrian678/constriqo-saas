CREATE TABLE IF NOT EXISTS marketing_campaigns (
  marketing_campaign_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  name text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  budget_amount numeric(12, 2) NOT NULL DEFAULT 0,
  created_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing_leads (
  marketing_lead_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  marketing_campaign_id uuid REFERENCES marketing_campaigns(marketing_campaign_id) ON DELETE SET NULL,
  name text NOT NULL,
  source text NOT NULL,
  service_interest text,
  status text NOT NULL DEFAULT 'new',
  consent_status text NOT NULL DEFAULT 'pending',
  converted_client_id uuid REFERENCES clients(client_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing_followups (
  marketing_followup_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  marketing_lead_id uuid NOT NULL REFERENCES marketing_leads(marketing_lead_id) ON DELETE CASCADE,
  followup_type text NOT NULL,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  assigned_to_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing_message_templates (
  marketing_message_template_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  name text NOT NULL,
  channel text NOT NULL,
  language text NOT NULL DEFAULT 'es-US',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing_reviews (
  marketing_review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  client_id uuid REFERENCES clients(client_id),
  source text NOT NULL,
  rating integer,
  status text NOT NULL DEFAULT 'requested',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_status ON marketing_leads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_marketing_followups_due ON marketing_followups(tenant_id, status, due_at);
