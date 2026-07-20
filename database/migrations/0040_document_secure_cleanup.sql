ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS heavy_file_original_storage_key text,
  ADD COLUMN IF NOT EXISTS heavy_file_cleaned_at timestamptz,
  ADD COLUMN IF NOT EXISTS heavy_file_cleaned_by_user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS heavy_file_cleanup_batch_id uuid,
  ADD COLUMN IF NOT EXISTS heavy_file_cleanup_cutoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS heavy_file_cleanup_note text;

INSERT INTO capabilities (code, module_id, description)
VALUES
  ('documents.cleanup', 'documents', 'Clean archived heavy document files after strong reauthentication.')
ON CONFLICT (code) DO UPDATE
SET module_id = EXCLUDED.module_id,
    description = EXCLUDED.description;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON c.code = 'documents.cleanup'
WHERE r.code = 'admin'
ON CONFLICT (role_id, capability_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_documents_tenant_heavy_cleanup_due
  ON documents(tenant_id, status, created_at)
  WHERE storage_key IS NOT NULL
    AND heavy_file_cleaned_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_documents_tenant_cleanup_batches
  ON documents(tenant_id, heavy_file_cleanup_batch_id, heavy_file_cleaned_at DESC)
  WHERE heavy_file_cleaned_at IS NOT NULL;
