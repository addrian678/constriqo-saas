# ConstructFlow Operations Readiness

## Estado F1.8

Preparado, no productivo.

## PWA y offline

- Service worker deshabilitado hasta QA.
- Escrituras offline deshabilitadas hasta definir politica de conflictos.
- Instalacion PWA preparada por manifest, no activada como flujo productivo.

## Observabilidad

- Cada request debe tener `requestId`.
- Logs estructurados requeridos antes de runtime HTTP.
- Metricas minimas: latencia HTTP, tasa de error, latencia DB y retraso del outbox.

## Backups

- Backup diario de PostgreSQL requerido antes de produccion.
- Backup diario de storage requerido antes de produccion.
- Ensayo de restauracion obligatorio antes de piloto.

## Despliegue

- Ambientes esperados: development, staging, production.
- Cada release productivo necesita plan de rollback.
- Migraciones deben tener orden, auditoria y criterio de reversa.

## Runtime HTTP F3.1

- `npm run server:dev` levanta el runtime Node nativo.
- `/health` valida que el proceso responde.
- `/ready` responde degradado mientras la base de datos no este conectada.
- `/api/modules` expone modulos disponibles.
- `/api/routes` expone contratos API.
- Las APIs funcionales responden `501 NOT_IMPLEMENTED` hasta conectar adaptadores reales.
