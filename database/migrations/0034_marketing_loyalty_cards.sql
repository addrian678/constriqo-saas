CREATE TABLE IF NOT EXISTS marketing_loyalty_cards (
  marketing_loyalty_card_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  card_code text NOT NULL,
  title text NOT NULL,
  customer_name text,
  customer_phone text,
  required_stamps integer NOT NULL DEFAULT 10,
  current_stamps integer NOT NULL DEFAULT 0,
  reward_type text NOT NULL DEFAULT 'discount_percent',
  reward_value numeric(12, 2),
  reward_description text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  expires_on date,
  created_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, card_code),
  CHECK (required_stamps > 0 AND required_stamps <= 100),
  CHECK (current_stamps >= 0 AND current_stamps <= required_stamps)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_marketing_loyalty_cards_tenant_created_by') THEN
    ALTER TABLE marketing_loyalty_cards
      ADD CONSTRAINT fk_marketing_loyalty_cards_tenant_created_by
      FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES users(tenant_id, user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_marketing_loyalty_cards_tenant_status
  ON marketing_loyalty_cards(tenant_id, status, created_at DESC);
