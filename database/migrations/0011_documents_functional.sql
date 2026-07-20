CREATE TABLE IF NOT EXISTS document_versions (
  document_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  document_id uuid NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  storage_object_id uuid REFERENCES storage_objects(storage_object_id),
  created_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, document_id, version_number)
);

CREATE TABLE IF NOT EXISTS document_links (
  document_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  document_id uuid NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
  related_entity_type text NOT NULL,
  related_entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_permissions (
  document_permission_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  document_id uuid NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(role_id),
  user_id uuid REFERENCES users(user_id),
  permission_level text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_expiration_events (
  document_expiration_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  document_id uuid NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
  event_type text NOT NULL,
  scheduled_for date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_document_versions_document ON document_versions(tenant_id, document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_document_links_entity ON document_links(tenant_id, related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_document_permissions_document ON document_permissions(tenant_id, document_id);
CREATE INDEX IF NOT EXISTS idx_document_expiration_pending ON document_expiration_events(tenant_id, status, scheduled_for);
