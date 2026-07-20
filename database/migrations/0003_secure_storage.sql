CREATE TABLE IF NOT EXISTS storage_objects (
  storage_object_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  bucket text NOT NULL,
  object_key text NOT NULL,
  original_file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  checksum_sha256 text,
  status text NOT NULL DEFAULT 'pending_upload',
  related_entity_type text,
  related_entity_id uuid,
  created_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, bucket, object_key)
);

CREATE TABLE IF NOT EXISTS storage_object_versions (
  storage_object_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  storage_object_id uuid NOT NULL REFERENCES storage_objects(storage_object_id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  object_key text NOT NULL,
  checksum_sha256 text,
  size_bytes bigint NOT NULL,
  created_by_user_id uuid REFERENCES users(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, storage_object_id, version_number)
);

CREATE TABLE IF NOT EXISTS storage_access_events (
  storage_access_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id),
  storage_object_id uuid NOT NULL REFERENCES storage_objects(storage_object_id),
  actor_user_id uuid REFERENCES users(user_id),
  action text NOT NULL,
  result text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS storage_object_id uuid REFERENCES storage_objects(storage_object_id);

CREATE INDEX IF NOT EXISTS idx_storage_objects_tenant_status ON storage_objects(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_storage_access_tenant_created ON storage_access_events(tenant_id, created_at DESC);
