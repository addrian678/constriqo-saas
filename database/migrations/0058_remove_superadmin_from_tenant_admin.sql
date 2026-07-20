DELETE FROM role_capabilities rc
USING roles r, capabilities c
WHERE rc.role_id = r.role_id
  AND rc.capability_id = c.capability_id
  AND r.scope = 'tenant'
  AND r.code <> 'super_admin'
  AND c.code LIKE 'superadmin.%';
