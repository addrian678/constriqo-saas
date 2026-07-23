-- Rebrand provider tenant after the original licensing migration.
-- Historical migrations remain immutable so checksum validation can protect production databases.

UPDATE tenants
SET name = 'Constriqo Provider',
    updated_at = now()
WHERE tenant_id = '00000000-0000-4000-8000-000000000001'
  AND industry_profile = 'provider';
