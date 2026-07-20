# ConstructFlow - Runbook de actualizacion y rollback

## Alcance

Este runbook aplica al SaaS multi-tenant gestionado por proveedor y a futuros planes dedicados.

## Actualizacion segura

1. Confirmar version instalada.
2. Revisar `release/RELEASE_NOTES.md`.
3. Confirmar que `.env` productivo existe fuera de git.
4. Crear backup de base de datos con `npm run db:backup`.
5. Crear backup de storage si aplica.
6. Verificar backup con `npm run db:restore -- --verify-only`.
7. Seguir el runbook detallado `docs/runbooks/backup-restore.md`.
6. Ejecutar `npm run release:update -- --apply`.
7. Verificar `/health`, `/ready` y rutas API base.
8. Registrar version aplicada, fecha, operador, tenants afectados y resultado.

## Reglas obligatorias

- No aplicar migraciones sin backup.
- No imprimir `DATABASE_URL` ni secretos.
- No editar datos productivos manualmente sin registro.
- No entregar repositorio fuente al cliente.
- No aceptar `tenant_id` desde frontend como fuente de verdad.

## Rollback

Si falla antes de migrar:

1. Mantener version anterior activa.
2. Revisar logs sin exponer secretos.
3. Corregir y reintentar en staging.

Si falla despues de migrar:

1. Detener runtime nuevo.
2. Restaurar backup de base de datos con `npm run db:restore` siguiendo `docs/runbooks/backup-restore.md`.
3. Restaurar backup de storage si fue modificado.
4. Reinstalar artefacto anterior.
5. Ejecutar smoke tests.
6. Documentar causa, impacto y accion correctiva.

Si el fallo afecta solo un tenant:

1. Bloquear temporalmente acciones criticas de ese tenant.
2. Evaluar rollback/exportacion por tenant.
3. Mantener auditoria de impacto.
4. No revertir todos los tenants si no es necesario.

## Criterios para aprobar una actualizacion

- Backup creado.
- Migraciones aplicadas sin error.
- Smoke tests aprobados.
- `/ready` no expone secretos.
- Usuario administrador puede iniciar flujo operativo basico.
