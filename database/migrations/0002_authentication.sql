CREATE TABLE IF NOT EXISTS auth_password_credentials (
  credential_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  password_algorithm text NOT NULL DEFAULT 'argon2id',
  password_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS auth_invitations (
  invitation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  email text NOT NULL,
  role_code text NOT NULL,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  invited_by_user_id uuid NOT NULL REFERENCES users(user_id),
  accepted_by_user_id uuid REFERENCES users(user_id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, token_hash)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  session_token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, session_token_hash)
);

CREATE TABLE IF NOT EXISTS auth_login_attempts (
  login_attempt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(tenant_id),
  email text NOT NULL,
  succeeded boolean NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_invitations_email_status ON auth_invitations(tenant_id, email, status);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_status ON auth_sessions(tenant_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_email_created ON auth_login_attempts(email, created_at DESC);
