ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS worker_support_phone text,
  ADD COLUMN IF NOT EXISTS worker_support_whatsapp_url text;
