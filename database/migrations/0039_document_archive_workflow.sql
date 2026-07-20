ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by_user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_batch_id uuid,
  ADD COLUMN IF NOT EXISTS archive_note text;

INSERT INTO capabilities (code, module_id, description)
VALUES
  ('documents.archive', 'documents', 'Confirm tenant document archive and retention workflow.')
ON CONFLICT (code) DO UPDATE
SET module_id = EXCLUDED.module_id,
    description = EXCLUDED.description;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON c.code = 'documents.archive'
WHERE r.code IN ('admin', 'manager')
ON CONFLICT (role_id, capability_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_documents_tenant_archive_due
  ON documents(tenant_id, status, created_at)
  WHERE storage_key IS NOT NULL;
