INSERT INTO audit_events (tenant_id, action, module_id, entity_type, severity, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'marketing.seed.prepared',
  'marketing',
  'marketing_campaign',
  'info',
  '{"seed":"0018_marketing_seed","externalAds":false,"consentRequired":true}'::jsonb
);
