# Constriqo Release Notes

## 0.1.0 - SaaS privado piloto

Estado: piloto controlado con dominio real, API publicada y base PostgreSQL/Supabase conectada.

### Incluye

- App web SaaS multi-tenant con login real, MFA para administradores y ruta privada de proveedor.
- Aislamiento por empresa con tenant, roles, capabilities, auditoria y controles de integridad en PostgreSQL.
- API runtime publicada para dominio HTTPS y validada por `/health` y `/ready`.
- Frontend publicado para `app.constriqo.com` y preparado para `cliente.constriqo.com` mediante `tenant_slug`.
- Modulos reales: CRM, servicios/precios, cotizaciones, facturas, obras, trabajadores, asistencia, nomina, finanzas, activos/pasivos, documentos, notificaciones, reportes y Super Admin/licencias.
- PDFs descargables y archivables, con persistencia de storage preparada por backend.
- Email operativo inicial mediante apertura del cliente de correo del usuario; outbox/worker SMTP queda preparado como microservicio futuro.
- Control de jornada con geocerca por obra, intentos bloqueados auditados, limite diario de horas y relacion con nomina.
- UI/UX renovada con modo oscuro/claro, navegacion lateral, formularios en modal y vistas responsive.
- Branding Constriqo oficial y personalizacion de nombre/logo por tenant donde corresponde.
- Scripts de backup/restore, preflight, migraciones y auditorias automaticas.

### Pendiente manual o externo

- Activar wildcard DNS y asignar subdominios por cliente cuando el piloto lo requiera.
- Validar Supabase Storage real con bucket privado, cuota final y prueba de factura/cotizacion guardada.
- Ejecutar backup/restore real contra una base temporal de produccion antes de abrir mas clientes.
- Configurar monitoreo externo para `https://api.constriqo.com/health`, `https://api.constriqo.com/ready` y errores de Render/Vercel.
- Hacer QA manual completo en Android real, tablet y escritorio.
- Crear app Android nativa/hibrida con Capacitor/TWA cuando el flujo web este estabilizado.
- Activar push notifications reales solo con consentimiento, proveedor y app Android/PWA configurada.
- Completar perfiles por industria despues de estabilizar construccion: aseo, mantenimiento y otros.
- Revisar fiscalidad/plantillas con profesional para DIAN, AEAT/VERI*FACTU y Utah sales tax antes de prometer cumplimiento legal certificado.
- Conectar SMTP real como microservicio de pago/futuro si el cliente quiere envio automatico desde la plataforma.

### Actualizacion segura

Usar siempre:

```bash
npm run release:update -- --apply
```

El flujo exige backup antes de migrar, ejecuta migraciones pendientes y corre smoke tests. Antes de produccion comercial, ejecutar tambien:

```bash
npm run verify
npm run production:preflight
```
