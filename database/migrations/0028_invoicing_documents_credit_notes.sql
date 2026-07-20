ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS corrects_invoice_id uuid,
  ADD COLUMN IF NOT EXISTS correction_reason text,
  ADD COLUMN IF NOT EXISTS pdf_document_id uuid;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS receipt_number text,
  ADD COLUMN IF NOT EXISTS document_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_tenant_corrects_invoice') THEN
    ALTER TABLE invoices
      ADD CONSTRAINT fk_invoices_tenant_corrects_invoice
      FOREIGN KEY (tenant_id, corrects_invoice_id) REFERENCES invoices(tenant_id, invoice_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_tenant_pdf_document') THEN
    ALTER TABLE invoices
      ADD CONSTRAINT fk_invoices_tenant_pdf_document
      FOREIGN KEY (tenant_id, pdf_document_id) REFERENCES documents(tenant_id, document_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payments_tenant_document') THEN
    ALTER TABLE payments
      ADD CONSTRAINT fk_payments_tenant_document
      FOREIGN KEY (tenant_id, document_id) REFERENCES documents(tenant_id, document_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_tenant_receipt_number
  ON payments(tenant_id, receipt_number)
  WHERE receipt_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_corrects ON invoices(tenant_id, corrects_invoice_id);

INSERT INTO capabilities (code, module_id, description)
VALUES
  ('invoices.pdf.download', 'invoicing', 'Descargar PDF de factura y recibo.'),
  ('invoices.credit_notes.create', 'invoicing', 'Crear facturas rectificativas con trazabilidad.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON c.code IN ('invoices.pdf.download', 'invoices.credit_notes.create', 'documents.read', 'documents.create')
WHERE r.code IN ('admin', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO role_capabilities (role_id, capability_id)
SELECT r.role_id, c.capability_id
FROM roles r
JOIN capabilities c ON c.code IN ('invoices.pdf.download', 'invoices.credit_notes.create', 'documents.read', 'documents.create')
WHERE r.code = 'manager'
ON CONFLICT DO NOTHING;
