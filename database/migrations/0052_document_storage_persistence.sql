ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS storage_provider text,
  ADD COLUMN IF NOT EXISTS storage_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS storage_checksum_sha256 text,
  ADD COLUMN IF NOT EXISTS storage_persisted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS storage_persist_error text;

CREATE INDEX IF NOT EXISTS idx_documents_tenant_storage_provider
  ON documents(tenant_id, storage_provider, storage_uploaded_at DESC)
  WHERE storage_key IS NOT NULL;

COMMENT ON COLUMN documents.storage_provider IS 'Physical storage provider used for the heavy file, for example local-dev or supabase-storage.';
COMMENT ON COLUMN documents.storage_uploaded_at IS 'Timestamp when the generated file was physically persisted to the configured storage provider.';
COMMENT ON COLUMN documents.storage_checksum_sha256 IS 'SHA-256 checksum of the last persisted heavy file buffer.';
COMMENT ON COLUMN documents.storage_persisted IS 'True when the heavy file was physically stored beyond metadata.';
