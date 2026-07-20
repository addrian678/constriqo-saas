INSERT INTO audit_events (tenant_id, action, module_id, entity_type, severity, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'industry_profiles.seed.prepared',
  'industry-validation',
  'industry_profile',
  'info',
  '{"seed":"0017_industry_profiles_seed","construction":"active","cleaning":"prepared"}'::jsonb
);
