INSERT INTO tenant_usage_limits (
  tenant_id,
  plan_code,
  storage_quota_mb,
  photo_evidence_enabled,
  marketing_addon_enabled,
  dedicated_storage_enabled,
  updated_by_user_id,
  metadata
)
SELECT
  tenant_id,
  plan_code,
  storage_quota_mb,
  COALESCE((features->>'photoEvidenceAddon')::boolean, false),
  COALESCE((features->>'marketingAddon')::boolean, false),
  plan_code = 'dedicated' OR COALESCE((features->>'dedicatedStorage')::boolean, false),
  updated_by_user_id,
  jsonb_build_object('source', 'migration-0059-license-sync')
FROM tenant_licenses
ON CONFLICT (tenant_id) DO UPDATE
SET plan_code = EXCLUDED.plan_code,
    storage_quota_mb = EXCLUDED.storage_quota_mb,
    photo_evidence_enabled = EXCLUDED.photo_evidence_enabled,
    marketing_addon_enabled = EXCLUDED.marketing_addon_enabled,
    dedicated_storage_enabled = EXCLUDED.dedicated_storage_enabled,
    updated_by_user_id = EXCLUDED.updated_by_user_id,
    updated_at = now(),
    metadata = tenant_usage_limits.metadata || EXCLUDED.metadata;
