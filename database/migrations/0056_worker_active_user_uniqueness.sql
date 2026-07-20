CREATE UNIQUE INDEX IF NOT EXISTS uq_workers_tenant_active_user
  ON workers(tenant_id, user_id)
  WHERE user_id IS NOT NULL AND status = 'active';
