# Constriqo Operations Readiness

## Estado actual

Piloto controlado con frontend y API publicados, base PostgreSQL/Supabase conectada y modulos reales auditados.

## PWA y offline

- Service worker deshabilitado hasta QA manual completa.
- Escrituras offline deshabilitadas hasta definir politica de conflictos.
- Instalacion PWA preparada por manifest, no activada como flujo productivo obligatorio.

## Observabilidad

- Cada request debe tener `requestId`.
- Logs estructurados en runtime Node.
- Metricas minimas: latencia HTTP, tasa de error, latencia DB, errores de autenticacion, retraso del outbox y uso de storage.
- Monitoreo externo recomendado sobre `https://api.constriqo.com/health`, `https://api.constriqo.com/ready` y `https://app.constriqo.com`.
- Validacion manual/periodica: `npm run monitor:production`.

## Backups

- Backup diario de PostgreSQL requerido antes de produccion comercial.
- Backup diario de storage requerido antes de produccion comercial.
- Ensayo de restauracion obligatorio antes de abrir mas clientes.
- Flujo documentado en `docs/runbooks/backup-restore.md`.

## Despliegue

- Ambientes esperados: development, staging, production.
- Cada release productivo necesita plan de rollback.
- Migraciones deben tener orden, auditoria y criterio de reversa.
- `npm run production:preflight` bloquea produccion completa si faltan proveedores externos reales.

## Runtime HTTP

- `/health` valida que el proceso responde.
- `/ready` valida base, migracion vigente y proveedores productivos cuando aplica.
- `/api/modules` expone modulos disponibles de forma controlada.
- `/api/routes` solo se inspecciona con permisos internos.
- Las APIs funcionales exigen sesion SaaS, licencia, rol, capability y tenant activo.

## Cierre final

Usar `docs/runbooks/production-finalization.md` para cerrar:

- Wildcard DNS por cliente.
- Storage real final.
- Backup/restore real.
- Monitoreo externo.
- QA Android real.
- Android nativo futuro.
- SMTP futuro como microservicio.
