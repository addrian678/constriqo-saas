INSERT INTO capabilities (code, module_id, description)
VALUES
  ('documents.read', 'documents', 'Read tenant document archive metadata.'),
  ('documents.create', 'documents', 'Create tenant document archive metadata.'),
  ('documents.update', 'documents', 'Update tenant document archive metadata.')
ON CONFLICT (code) DO UPDATE
SET module_id = EXCLUDED.module_id,
    description = EXCLUDED.description;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON
  (r.code = 'admin' AND c.code IN ('documents.read', 'documents.create', 'documents.update'))
  OR (r.code = 'manager' AND c.code IN ('documents.read', 'documents.create'))
ON CONFLICT (role_id, capability_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_documents_tenant_type_status
  ON documents(tenant_id, document_type, status, updated_at DESC);
